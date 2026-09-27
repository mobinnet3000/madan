"""
موتور گزارش تب‌های کارخانه — اجرای Config گزارش روی رکوردها.

- منطق Report صفحه (KPI/جدول/نمودار) که قبلا در فرانت (recharts) بود، اینجا Generic اجرا می‌شود.
- ویجت جدید = یک ورودی به WIDGET_TYPES با دو تابع validate و run.
- فرمول متریک‌ها با همان موتور امن formula.py ارزیابی می‌شود.
"""

from datetime import datetime

from .formula import FormulaError, evaluate, validate_expr, variables
from .jalali import to_jalali


def _topo_sort(keys, deps_by_key):
    visited = {}
    order = []

    def visit(key, stack):
        visited[key] = 1
        for dep in deps_by_key[key]:
            if visited.get(dep) == 1:
                raise ValueError(f"وابستگی دایره‌ای بین خروجی‌ها: {key} -> {dep}")
            if visited.get(dep) is None:
                visit(dep, stack + [dep])
        visited[key] = 2
        order.append(key)

    for key in keys:
        if visited.get(key) is None:
            visit(key, [key])
    return order

ALLOWED_REPORT_FILTERS = ("line", "contractor", "date_from", "date_to")
REPORT_MAX_RECORDS = 10000
AGG_STATS = ("sum", "avg", "min", "max", "count")
GROUP_BYS = ("line", "contractor", "date", "week", "month", "hour", "field_value")
ROUND_DIGITS = 4


def normalize_report_filters(filters):
    """ترتیب کانونی فیلترها؛ تکراری‌ها حذف می‌شوند."""
    seen = set(filters or [])
    return [f for f in ALLOWED_REPORT_FILTERS if f in seen]


def _field_refs(tab):
    """ارجاع‌های عددی: {"out.key"/"in.key": label} + ارجاع‌های بین‌تبی."""
    from .factory_tabs import cross_tab_refs, norm_tab_key, other_tabs

    refs = {}
    for o in tab.outputs.all():
        refs[f"out.{o.key}"] = o.name
    for i in tab.inputs.filter(input_type="number"):
        refs[f"in.{i.key}"] = i.name
    for other in other_tabs(tab):
        prefix = norm_tab_key(other.key)
        for i in other.inputs.filter(input_type="number"):
            refs[f"{prefix}.in.{i.key}"] = f"{other.name} › {i.name}"
        for o in other.outputs.all():
            refs[f"{prefix}.out.{o.key}"] = f"{other.name} › {o.name}"
    return refs


def _cat_refs(tab):
    """ارجاع‌های دسته‌ای (select/text): {"in.key": label}."""
    return {f"in.{i.key}": i.name for i in tab.inputs.filter(input_type__in=("select", "text"))}


def _is_cross(ref):
    return len((ref or "").split(".")) == 3


def _split_ref(ref):
    parts = (ref or "").split(".")
    if len(parts) == 3:
        if parts[1] not in ("out", "in"):
            raise ValueError(
                f"ارجاع فیلد «{ref}» نامعتبر است؛ قالب بین‌تبی: key.out.key یا key.in.key"
            )
        return parts[1], f"{parts[0]}.{parts[2]}"
    if len(parts) != 2 or parts[0] not in ("out", "in") or not parts[1]:
        raise ValueError(f"ارجاع فیلد «{ref}» نامعتبر است؛ قالب درست: out.key یا in.key")
    return parts[0], parts[1]


def validate_report_metrics(tab, metrics):
    """اعتبارسنجی متریک‌ها؛ لیست نرمال‌شده برمی‌گرداند."""
    if not isinstance(metrics, list):
        raise ValueError("متریک‌ها باید یک لیست باشند.")
    if len(metrics) > 30:
        raise ValueError("حداکثر ۳۰ متریک در هر گزارش مجاز است.")
    numeric = _field_refs(tab)
    agg_vars = {f"{ref}__{a}" for ref in numeric for a in AGG_STATS}
    keys = [m.get("key") for m in metrics if isinstance(m, dict)]
    if any(not k for k in keys):
        raise ValueError("همه متریک‌ها باید کلید (key) داشته باشند.")
    if len(set(keys)) != len(keys):
        raise ValueError("کلید متریک تکراری مجاز نیست.")
    import re as _re

    for m in metrics:
        if not _re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", m["key"]):
            raise ValueError(f"کلید متریک «{m['key']}» معتبر نیست (حروف/عدد/_).")
    allowed = set(agg_vars) | {"record_count"} | set(keys)
    for m in metrics:
        formula = (m.get("formula") or "").strip()
        if not formula:
            raise ValueError(f"فرمول متریک «{m['key']}» خالی است.")
        try:
            validate_expr(formula)
        except FormulaError as e:
            raise ValueError(f"فرمول متریک «{m['key']}» نامعتبر است: {e}")
        for v in variables(formula):
            if v not in allowed:
                raise ValueError(
                    f"فرمول متریک «{m['key']}» به «{v}» اشاره دارد؛ "
                    "فقط خروجی/ورودی عددی با پسوند __sum/__avg/__min/__max/__count، "
                    "record_count و کلید متریک‌های دیگر مجاز است."
                )
    by_key = {m["key"]: m for m in metrics}

    def _deps(m):
        try:
            used = set(variables(m["formula"]))
        except FormulaError:
            used = set()
        return {v for v in used if v in by_key and v != m["key"]}

    try:
        _topo_sort(list(by_key), {k: _deps(by_key[k]) for k in by_key})
    except ValueError as e:
        raise ValueError(f"وابستگی دایره‌ای بین متریک‌ها: {e}")
    return [
        {
            "key": m["key"],
            "label": m.get("label") or m["key"],
            "formula": m["formula"].strip(),
            "unit": m.get("unit") or "",
        }
        for m in metrics
    ]


def _r4(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        return round(float(value), ROUND_DIGITS)
    except (TypeError, ValueError):
        return None


def _aggregate(values, stat):
    vals = [float(v) for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if stat == "count":
        return len(vals)
    if not vals:
        return None
    if stat == "sum":
        return sum(vals)
    if stat == "avg":
        return sum(vals) / len(vals)
    if stat == "min":
        return min(vals)
    if stat == "max":
        return max(vals)
    raise ValueError(f"تجمیع «{stat}» نامعتبر است.")


def _week_key(d):
    iso = d.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _record_rows(tab, records):
    rows = []
    for r in records:
        outputs = r.outputs or {}
        inputs = r.inputs or {}
        d = r.date_from
        rows.append(
            {
                "id": r.id,
                "date": d.isoformat(),
                "date_label": to_jalali(d),
                "week": _week_key(d),
                "month": d.strftime("%Y-%m"),
                "hour": r.hour.strftime("%H:00") if r.hour else None,
                "line": r.line.name if r.line else "—",
                "line_id": r.line_id,
                "contractor": r.contractor.name if r.contractor else "بدون پیمانکار",
                "contractor_id": r.contractor_id,
                "out": {
                    k: v
                    for k, v in outputs.items()
                    if isinstance(v, (int, float)) and not isinstance(v, bool)
                },
                "in_num": {
                    k: v
                    for k, v in inputs.items()
                    if isinstance(v, (int, float)) and not isinstance(v, bool)
                },
                "cat": {k: str(v) for k, v in inputs.items() if isinstance(v, str)},
            }
        )
    return rows


def _group_key_label(row, group_by, field=None):
    if group_by == "line":
        return (f"line:{row['line_id'] or 0}", row["line"])
    if group_by == "contractor":
        return (f"contractor:{row['contractor_id'] or 0}", row["contractor"])
    if group_by == "date":
        return (f"date:{row['date']}", row["date_label"] or row["date"])
    if group_by == "week":
        return (f"week:{row['week']}", row["week"])
    if group_by == "month":
        return (f"month:{row['month']}", row["month"])
    if group_by == "hour":
        return (f"hour:{row['hour'] or '—'}", row["hour"] or "—")
    if group_by == "field_value":
        source, key = _split_ref(field)
        if source == "out":
            val = row["out"].get(key)
            text = str(val) if val is not None else "—"
        else:
            val = row["in_num"].get(key, row["cat"].get(key))
            text = str(val) if val is not None else "—"
        return (f"field:{text}", text)
    raise ValueError(f"group_by نامعتبر است: «{group_by}»")


def _ref_values(rows, ref):
    parts = (ref or "").split(".")
    if len(parts) == 3:
        tab_key, source, key = parts
        return [row.get(f"cross.{tab_key}.{key}") for row in rows]
    source, key = _split_ref(ref)
    bucket = "out" if source == "out" else "in_num"
    return [row[bucket].get(key) for row in rows]


def _check_ref(ref, numeric, label="فیلد"):
    if ref not in numeric:
        raise ValueError(
            f"{label} «{ref}» در این تب تعریف نشده است (فقط خروجی‌ها و ورودی‌های عددی)."
        )


def _check_stats(stats):
    stats = list(stats or ["sum", "avg"])
    if not stats or any(s not in AGG_STATS for s in stats):
        raise ValueError(f"stats باید زیرمجموعه‌ای از {list(AGG_STATS)} باشد.")
    return stats


# ── ویجت: KPI ──

def _validate_kpi(tab, config, metric_keys=None):
    numeric = _field_refs(tab)
    cards = config.get("cards")
    if not isinstance(cards, list) or not cards or len(cards) > 12:
        raise ValueError("ویجت kpi باید ۱ تا ۱۲ کارت (cards) داشته باشد.")
    out = []
    for idx, c in enumerate(cards):
        if not isinstance(c, dict):
            raise ValueError(f"کارت {idx + 1} باید یک شیء باشد.")
        kind = c.get("kind", "stat")
        if kind == "count":
            out.append({"kind": "count", "label": c.get("label") or "تعداد رکورد"})
        elif kind == "stat":
            ref = c.get("field") or ""
            _check_ref(ref, numeric, label=f"فیلد کارت {idx + 1}")
            stat = c.get("stat", "sum")
            if stat not in AGG_STATS:
                raise ValueError(f"stat کارت {idx + 1} نامعتبر است.")
            out.append(
                {
                    "kind": "stat",
                    "label": c.get("label") or numeric[ref],
                    "field": ref,
                    "stat": stat,
                    "sub_stats": _check_stats(c.get("sub_stats", ["avg", "min", "max"])),
                }
            )
        elif kind == "metric":
            key = c.get("metric") or ""
            if metric_keys is not None and key not in metric_keys:
                raise ValueError(f"متریک «{key}» در کارت {idx + 1} تعریف نشده است.")
            out.append({"kind": "metric", "label": c.get("label") or key, "metric": key})
        else:
            raise ValueError(f"kind کارت {idx + 1} باید یکی از count/stat/metric باشد.")
    return {"cards": out}


def _run_kpi(rows, ctx, config):
    cards = []
    for c in config["cards"]:
        if c["kind"] == "count":
            cards.append({"label": c["label"], "value": len(rows), "sub": {}})
        elif c["kind"] == "stat":
            vals = _ref_values(rows, c["field"])
            cards.append(
                {
                    "label": c["label"],
                    "value": _r4(_aggregate(vals, c["stat"])),
                    "sub": {s: _r4(_aggregate(vals, s)) for s in c["sub_stats"]},
                }
            )
        else:
            m = ctx["metrics"].get(c["metric"], {})
            cards.append({"label": c["label"], "value": m.get("value"), "sub": {}})
    return {"cards": cards}


# ── ویجت: جدول آماری هر فیلد ──

def _ref_source(ref):
    """منبع یک ارجاع (out/in) برای چک sources — بین‌تبی هم پشتیبانی می‌شود."""
    parts = (ref or "").split(".")
    if len(parts) == 3:
        if parts[1] not in ("out", "in"):
            raise ValueError(f"ارجاع فیلد «{ref}» نامعتبر است.")
        return parts[1]
    return parts[0]


def _validate_stat_table(tab, config, metric_keys=None):
    numeric = _field_refs(tab)
    sources = config.get("sources", ["out"])
    if not isinstance(sources, list) or not sources or any(s not in ("out", "in") for s in sources):
        raise ValueError("sources باید زیرمجموعه‌ای از [out, in] باشد.")
    fields = config.get("fields")
    if fields is None:
        fields = [r for r in numeric if _ref_source(r) in sources]
    if not isinstance(fields, list) or not fields or len(fields) > 50:
        raise ValueError("fields باید لیستی از ۱ تا ۵۰ ارجاع فیلد باشد.")
    for f in fields:
        _check_ref(f, numeric)
        if _ref_source(f) not in sources:
            raise ValueError(f"فیلد «{f}» با sources انتخابی سازگار نیست.")
    return {"sources": sources, "fields": fields, "stats": _check_stats(config.get("stats"))}


def _run_stat_table(rows, ctx, config):
    table = []
    for ref in config["fields"]:
        vals = _ref_values(rows, ref)
        entry = {"field": ref, "label": ctx["labels"].get(ref, ref)}
        for s in config["stats"]:
            entry[s] = _r4(_aggregate(vals, s))
        table.append(entry)
    return {"columns": ["field", "label"] + config["stats"], "rows": table}


# ── ویجت: جدول گروه‌بندی ──

_GROUP_SORTS = ("count_desc", "label_asc", "value_desc")


def _validate_group_table(tab, config, metric_keys=None):
    numeric = _field_refs(tab)
    group_by = config.get("group_by")
    if group_by not in GROUP_BYS:
        raise ValueError(f"group_by باید یکی از {list(GROUP_BYS)} باشد.")
    field = config.get("field")
    if group_by == "field_value":
        if not field:
            raise ValueError("برای group_by=field_value باید field مشخص شود.")
        source, key = _split_ref(field)
        cats = _cat_refs(tab)
        if source == "in" and field not in cats and field not in numeric:
            raise ValueError(f"فیلد گروه‌بندی «{field}» ورودی متنی/انتخابی این تب نیست.")
        if source == "out" and field not in numeric:
            raise ValueError(f"فیلد گروه‌بندی «{field}» خروجی این تب نیست.")
    fields = config.get("fields")
    if fields is None:
        fields = list(numeric)
    if not isinstance(fields, list) or not fields or len(fields) > 20:
        raise ValueError("fields باید لیستی از ۱ تا ۲۰ ارجاع فیلد باشد.")
    for f in fields:
        _check_ref(f, numeric)
    sort = config.get("sort", "count_desc")
    if sort not in _GROUP_SORTS:
        raise ValueError(f"sort باید یکی از {list(_GROUP_SORTS)} باشد.")
    sort_field = config.get("sort_field")
    sort_stat = config.get("sort_stat", "sum")
    if sort == "value_desc":
        if not sort_field:
            raise ValueError("برای sort=value_desc باید sort_field مشخص شود.")
        _check_ref(sort_field, numeric, label="sort_field")
        if sort_stat not in AGG_STATS:
            raise ValueError("sort_stat نامعتبر است.")
    limit = config.get("limit", 50)
    if not isinstance(limit, int) or not 1 <= limit <= 200:
        raise ValueError("limit باید عدد صحیح ۱ تا ۲۰۰ باشد.")
    return {
        "group_by": group_by,
        "field": field,
        "fields": fields,
        "stats": _check_stats(config.get("stats", ["sum", "avg"])),
        "sort": sort,
        "sort_field": sort_field,
        "sort_stat": sort_stat,
        "limit": limit,
        "include_total": bool(config.get("include_total", True)),
    }


def _group_rows(rows, group_by, field=None):
    groups = {}
    for row in rows:
        key, label = _group_key_label(row, group_by, field)
        if key not in groups:
            groups[key] = {"key": key, "label": label, "rows": []}
        groups[key]["rows"].append(row)
    return groups


def _run_group_table(rows, ctx, config):
    groups = _group_rows(rows, config["group_by"], config["field"])
    table = []
    for g in groups.values():
        entry = {"key": g["key"], "label": g["label"], "count": len(g["rows"])}
        for ref in config["fields"]:
            vals = _ref_values(g["rows"], ref)
            for s in config["stats"]:
                entry[f"{ref}__{s}"] = _r4(_aggregate(vals, s))
        table.append(entry)
    if config["sort"] == "label_asc":
        table.sort(key=lambda e: e["label"])
    elif config["sort"] == "value_desc":
        col = f"{config['sort_field']}__{config['sort_stat']}"
        table.sort(key=lambda e: (e[col] is None, -(e[col] or 0)))
    else:
        table.sort(key=lambda e: -e["count"])
    table = table[: config["limit"]]
    total = None
    if config["include_total"]:
        total = {"key": "__total__", "label": "جمع کل", "count": len(rows)}
        for ref in config["fields"]:
            vals = _ref_values(rows, ref)
            for s in config["stats"]:
                total[f"{ref}__{s}"] = _r4(_aggregate(vals, s))
    cols = ["label", "count"]
    for ref in config["fields"]:
        cols += [f"{ref}__{s}" for s in config["stats"]]
    return {"columns": cols, "rows": table, "total": total}


# ── ویجت: نمودار ──

def _validate_chart(tab, config, metric_keys=None):
    numeric = _field_refs(tab)
    chart = config.get("chart", "bar")
    if chart not in ("bar", "line", "pie"):
        raise ValueError("chart باید یکی از bar/line/pie باشد.")
    group_by = config.get("group_by", "date")
    if group_by not in GROUP_BYS:
        raise ValueError(f"group_by باید یکی از {list(GROUP_BYS)} باشد.")
    field = config.get("field")
    if group_by == "field_value":
        if not field:
            raise ValueError("برای group_by=field_value باید field مشخص شود.")
        cats = _cat_refs(tab)
        if field not in cats and field not in numeric:
            raise ValueError(f"فیلد گروه‌بندی «{field}» ورودی متنی/انتخابی این تب نیست.")
    value = config.get("value", "count")
    if isinstance(value, dict):
        ref = value.get("field") or ""
        _check_ref(ref, numeric, label="فیلد نمودار")
        stat = value.get("stat", "sum")
        if stat not in AGG_STATS:
            raise ValueError("stat نمودار نامعتبر است.")
        value = {"field": ref, "stat": stat}
    elif value != "count":
        raise ValueError("value نمودار باید count یا {field, stat} باشد.")
    sort = config.get("sort")
    if sort is None:
        sort = "label_asc" if group_by in ("date", "week", "month", "hour") else "value_desc"
    if sort not in _GROUP_SORTS:
        raise ValueError(f"sort باید یکی از {list(_GROUP_SORTS)} باشد.")
    limit = config.get("limit", 12)
    if not isinstance(limit, int) or not 1 <= limit <= 100:
        raise ValueError("limit باید عدد صحیح ۱ تا ۱۰۰ باشد.")
    return {
        "chart": chart,
        "group_by": group_by,
        "field": field,
        "value": value,
        "sort": sort,
        "limit": limit,
    }


def _run_chart(rows, ctx, config):
    groups = _group_rows(rows, config["group_by"], config["field"])
    points = []
    for g in groups.values():
        if config["value"] == "count":
            v = len(g["rows"])
        else:
            vals = _ref_values(g["rows"], config["value"]["field"])
            v = _aggregate(vals, config["value"]["stat"])
        points.append({"x": g["key"], "label": g["label"], "value": _r4(v)})
    if config["sort"] == "label_asc":
        points.sort(key=lambda p: p["x"])
    elif config["sort"] == "count_desc":
        counts = {g["key"]: len(g["rows"]) for g in groups.values()}
        points.sort(key=lambda p: -counts.get(p["x"], 0))
    else:
        points.sort(key=lambda p: (p["value"] is None, -(p["value"] or 0)))
    points = points[: config["limit"]]
    value_label = "تعداد رکورد"
    if config["value"] != "count":
        value_label = f"{ctx['labels'].get(config['value']['field'], config['value']['field'])} ({config['value']['stat']})"
    return {"chart": config["chart"], "value_label": value_label, "points": points}


WIDGET_TYPES = {
    "kpi": {"label": "شاخص‌ها (KPI)", "validate": _validate_kpi, "run": _run_kpi},
    "stat_table": {"label": "جدول آماری فیلدها", "validate": _validate_stat_table, "run": _run_stat_table},
    "group_table": {"label": "جدول گروه‌بندی", "validate": _validate_group_table, "run": _run_group_table},
    "chart": {"label": "نمودار", "validate": _validate_chart, "run": _run_chart},
}


def validate_widget_config(tab, widget_type, config, metric_keys=None):
    """اعتبارسنجی config یک ویجت؛ config نرمال‌شده برمی‌گرداند."""
    entry = WIDGET_TYPES.get(widget_type)
    if entry is None:
        raise ValueError(
            f"نوع ویجت «{widget_type}» ناشناخته است؛ انواع مجاز: {sorted(WIDGET_TYPES)}"
        )
    if not isinstance(config, dict):
        raise ValueError("config ویجت باید یک شیء باشد.")
    return entry["validate"](tab, config, metric_keys)


def _first(value):
    """اولین مقدار از QueryDict/list/tuple، وگرنه خود مقدار."""
    if isinstance(value, (list, tuple)):
        return value[0] if value else None
    return value


def _apply_params(qs, params, allowed):
    line = _first(params.get("line"))
    lines = _first(params.get("lines"))
    ids = set()
    for raw in (str(lines).split(",") if isinstance(lines, str) and lines else []) + (
        [line] if line not in (None, "") else []
    ):
        try:
            ids.add(int(str(raw).strip()))
        except (TypeError, ValueError):
            raise ValueError(f"شناسه خط «{raw}» نامعتبر است.")
    if ids and "line" in allowed:
        qs = qs.filter(line_id__in=ids)
    contractor = _first(params.get("contractor"))
    if contractor not in (None, "") and "contractor" in allowed:
        try:
            qs = qs.filter(contractor_id=int(str(contractor).strip()))
        except (TypeError, ValueError):
            raise ValueError(f"شناسه پیمانکار «{contractor}» نامعتبر است.")
    date_from = _first(params.get("date_from"))
    date_to = _first(params.get("date_to"))
    parsed_from = parsed_to = None
    if date_from and "date_from" in allowed:
        try:
            parsed_from = datetime.strptime(str(date_from), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("فرمت date_from باید YYYY-MM-DD باشد.")
        qs = qs.filter(date_to__gte=parsed_from)
    if date_to and "date_to" in allowed:
        try:
            parsed_to = datetime.strptime(str(date_to), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("فرمت date_to باید YYYY-MM-DD باشد.")
        qs = qs.filter(date_from__lte=parsed_to)
    if parsed_from and parsed_to and parsed_to < parsed_from:
        raise ValueError("date_to نمی‌تواند قبل از date_from باشد.")
    return qs


def _compute_metrics(metrics, env):
    by_key = {m["key"]: m for m in metrics}

    def _deps(m):
        try:
            used = set(variables(m["formula"]))
        except FormulaError:
            used = set()
        return {v for v in used if v in by_key and v != m["key"]}

    order = _topo_sort(list(by_key), {k: _deps(by_key[k]) for k in by_key})
    results = {}
    errors = {}
    for key in order:
        m = by_key[key]
        try:
            value = round(float(evaluate(m["formula"], env)), ROUND_DIGITS)
            results[key] = value
            env[key] = value
        except FormulaError as e:
            results[key] = None
            errors[key] = str(e)
    return [
        {
            "key": m["key"],
            "label": m["label"],
            "unit": m.get("unit") or "",
            "value": results[m["key"]],
            "error": errors.get(m["key"]),
        }
        for m in metrics
    ]


def run_report(tab, report, base_qs, params):
    """اجرای گزارش: فیلتر → تجمیع → متریک‌ها → ویجت‌ها. خروجی آماده رندر فرانت."""
    allowed = set(report.filters) if report.filters else set(ALLOWED_REPORT_FILTERS)
    params = dict(params.lists()) if hasattr(params, "lists") else dict(params or {})
    qs = _apply_params(base_qs.filter(tab=tab), params, allowed)
    total = qs.count()
    if total > REPORT_MAX_RECORDS:
        raise ValueError(
            f"تعداد رکوردها ({total}) بیش از سقف گزارش ({REPORT_MAX_RECORDS}) است؛ بازه را محدود کنید."
        )
    records = list(qs.select_related("line", "contractor").order_by("-date_from", "-created_at"))
    rows = _record_rows(tab, records)
    numeric = _field_refs(tab)
    labels = dict(numeric)
    for m in report.metrics or []:
        labels[m["key"]] = m.get("label") or m["key"]

    env = {"record_count": len(rows)}
    for ref in numeric:
        vals = _ref_values(rows, ref)
        for stat in AGG_STATS:
            v = _aggregate(vals, stat)
            if v is not None:
                env[f"{ref}__{stat}"] = v
    computed_metrics = _compute_metrics(report.metrics or [], dict(env))
    metrics_map = {m["key"]: m for m in computed_metrics}
    ctx = {"record_count": len(rows), "labels": labels, "metrics": metrics_map}

    widgets = []
    metric_keys = [m.get("key") for m in (report.metrics or []) if isinstance(m, dict)]
    for w in report.widgets.filter(is_active=True).order_by("order", "id"):
        entry = WIDGET_TYPES.get(w.widget_type)
        if entry is None:
            widgets.append(
                {"id": w.id, "type": w.widget_type, "title": w.title,
                 "error": f"نوع ویجت «{w.widget_type}» پشتیبانی نمی‌شود."}
            )
            continue
        try:
            # نرمال‌سازی مجدد در زمان اجرا: کانفیگ‌های قدیمی/دستی (ادمین/سید)
            # که از مسیر validate عبور نکرده‌اند هم کار کنند.
            cfg = validate_widget_config(
                tab, w.widget_type, w.config or {}, metric_keys=metric_keys
            )
            data = entry["run"](rows, ctx, cfg)
            widgets.append({"id": w.id, "type": w.widget_type, "title": w.title, "data": data})
        except (ValueError, FormulaError) as e:
            widgets.append(
                {"id": w.id, "type": w.widget_type, "title": w.title, "error": str(e)}
            )

    applied = {}
    for k in sorted(allowed):
        v = _first(params.get(k))
        if v not in (None, ""):
            applied[k] = str(v)
    return {
        "report": {
            "id": report.id,
            "name": report.name,
            "tab": {"id": tab.id, "key": tab.key, "name": tab.name},
        },
        "filters_applied": applied,
        "record_count": len(rows),
        "metrics": computed_metrics,
        "widgets": widgets,
    }
