"""
سرویس تب‌های داینامیک کارخانه — ساختار یکسان برای همه تب‌ها.

- هر تب: ورودی‌ها + خروجی‌ها با فرمول (موتور فرمول امن).
- ساخت Schema برای فرم داینامیک ثبت رکورد.
- اعتبارسنجی و محاسبه‌ی رکوردهای FactoryTabRecord.
"""

from .formula import FormulaError, evaluate, variables, validate_expr
from .analysis import _topo_sort


def formula_variables_for_tab(tab):
    """متغیرهای قابل‌استفاده در فرمول‌های یک تب (برای فرمول‌ساز ادمین).

    شامل ورودی/خروجی‌های عددی خود تب و تب‌های دیگر همین کارخانه با
    پیشوند «<key>.» (کلید با زیرخط نوشته می‌شود: tonnage_delivery.tonnage).
    """
    items = []
    for inp in tab.inputs.filter(input_type="number"):
        items.append({"var": inp.key, "label": inp.name, "group": "ورودی‌های این تب"})
    for out in tab.outputs.all():
        items.append({"var": out.key, "label": out.name, "group": "خروجی‌های این تب"})
    for other in other_tabs(tab):
        prefix = norm_tab_key(other.key)
        for inp in other.inputs.filter(input_type="number"):
            items.append({
                "var": f"{prefix}.{inp.key}",
                "label": f"{inp.name} ({other.name})",
                "group": f"ورودی‌های تب {other.name}",
            })
        for out in other.outputs.all():
            items.append({
                "var": f"{prefix}.{out.key}",
                "label": f"{out.name} ({other.name})",
                "group": f"خروجی‌های تب {other.name}",
            })
    return items


def norm_tab_key(key):
    """کلید تب برای استفاده در فرمول: خط‌تیره به زیرخط (چون `-` عملگر تفریق است)."""
    return str(key or "").replace("-", "_")


def other_tabs(tab):
    """تب‌های فعال دیگرِ همان کارخانه."""
    from .models import FactoryTab

    if tab.pk is None or tab.factory_id is None:
        return FactoryTab.objects.none()
    return FactoryTab.objects.filter(factory_id=tab.factory_id, is_active=True).exclude(id=tab.id)


def other_tab_map(tab):
    """نگاشت «کلید نرمال‌شده → تب» برای تب‌های دیگر."""
    return {norm_tab_key(o.key): o for o in other_tabs(tab)}


def cross_tab_refs(tab):
    """ارجاع‌های معتبر بین‌تبی: {"<normkey>.<field>": "نام تب › نام فیلد"}."""
    refs = {}
    for other in other_tabs(tab):
        prefix = norm_tab_key(other.key)
        for inp in other.inputs.filter(input_type="number"):
            refs[f"{prefix}.{inp.key}"] = f"{other.name} › {inp.name}"
        for out in other.outputs.all():
            refs[f"{prefix}.{out.key}"] = f"{other.name} › {out.name}"
    return refs


def _select_keys(tab):
    return set(tab.inputs.filter(input_type="select").values_list("key", flat=True))


def _own_keys(tab):
    keys = set(tab.inputs.values_list("key", flat=True))
    keys.update(tab.outputs.values_list("key", flat=True))
    return keys


def _validate_vars(tab, used, extra_help=""):
    """اعتبارسنجی متغیرهای یک فرمول تب؛ لیست خطاها برمی‌گرداند."""
    errors = []
    own = _own_keys(tab)
    cross = cross_tab_refs(tab)
    others = other_tab_map(tab)
    selects = _select_keys(tab)
    for v in sorted(used):
        parts = v.split(".")
        if len(parts) == 1:
            if v in selects:
                errors.append(f"متغیر «{v}» از نوع انتخابی است و در فرمول عددی قابل استفاده نیست.")
            elif v not in own:
                errors.append(f"متغیر «{v}» در این تب تعریف نشده است.")
        elif len(parts) == 2 and parts[0] in others:
            if v not in cross:
                errors.append(
                    f"«{v}» در تب «{others[parts[0]].key}» تعریف نشده است.{extra_help}"
                )
        else:
            errors.append(f"متغیر «{v}» نامعتبر است.{extra_help}")
    return errors


def validate_formula_for_tab(tab, expr):
    """اعتبارسنجی فرمول نسبت به یک تب؛ لیست خطاها (خالی = معتبر)."""
    if not expr or not str(expr).strip():
        return ["فرمول خالی است."]
    try:
        validate_expr(expr)
        used = set(variables(expr))
    except FormulaError as e:
        return [str(e)]
    return _validate_vars(
        tab,
        used,
        " فقط «ورودی/خروجی همین تب» یا «کلیدتب.کلیدفیلد» برای تب‌های دیگر مجاز است.",
    )


def validate_output_formula_for_tab(tab):
    """بررسی متغیرهای فرمول هر خروجی در سطح تعریف تب (شامل ارجاع بین‌تبی)."""
    if not tab.pk:
        return
    for out in tab.outputs.all():
        try:
            validate_expr(out.formula)
            used = set(variables(out.formula))
        except FormulaError as e:
            raise ValueError(f"فرمول خروجی «{out.name}» نامعتبر است: {e}")
        errors = _validate_vars(
            tab,
            used,
            " فقط «ورودی/خروجی همین تب» یا «کلیدتب.کلیدفیلد» برای تب‌های دیگر مجاز است.",
        )
        if errors:
            raise ValueError(f"فرمول خروجی «{out.name}»: " + " ".join(errors))


def validate_outputs_no_cycle_tab(tab):
    """جلوگیری از وابستگی دایره‌ای بین خروجی‌های تب."""
    if not tab.pk:
        return
    key_to_name = {o.key: o.name for o in tab.outputs.all()}

    def _used(expr):
        try:
            return set(variables(expr))
        except FormulaError:
            return set()

    graph = {
        o.key: {v for v in _used(o.formula) if v in key_to_name and v != o.key}
        for o in tab.outputs.all()
    }
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {k: WHITE for k in graph}

    def dfs(k, stack):
        color[k] = GRAY
        for dep in graph[k]:
            if color[dep] == GRAY:
                raise ValueError(
                    "وابستگی دایره‌ای بین خروجی‌ها: " + " -> ".join(stack + [dep])
                )
            if color[dep] == WHITE:
                dfs(dep, stack + [dep])
        color[k] = BLACK

    for k in graph:
        if color[k] == WHITE:
            dfs(k, [k])


def build_schema(tab):
    """ساختار کامل فرم داینامیک ثبت رکورد یک تب."""
    factory = tab.factory
    contractors = (
        factory.contractors.filter(is_active=True).order_by("name")
        if factory.id
        else []
    )
    lines = factory.lines.order_by("name") if factory.id else []
    return {
        "tab": {
            "id": tab.id,
            "key": tab.key,
            "name": tab.name,
            "record_type": tab.record_type,
            "require_line": tab.require_line,
        },
        "contractor": {
            "required": bool(tab.contractor_required),
            "options": [
                {
                    "id": c.id,
                    "name": c.name,
                    "contact_name": c.contact_name,
                    "phone": c.phone,
                }
                for c in contractors
            ],
        },
        "lines": [{"id": l.id, "name": l.name} for l in lines],
        "inputs": [
            {
                "id": i.id,
                "key": i.key,
                "name": i.name,
                "type": i.input_type,
                "options": list(i.options or []),
                "required": i.required,
                "unit": i.unit,
            }
            for i in tab.inputs.all()
        ],
        "outputs": [
            {"id": o.id, "key": o.key, "name": o.name, "unit": o.unit}
            for o in tab.outputs.all()
        ],
        "defined": True,
    }


def validate_and_compute(tab, payload, cross_ctx=None):
    """اعتبارسنجی و محاسبه‌ی یک رکورد تب بر اساس Inputهای ارسالی.

    cross_ctx: دیکشنری مقادیر ارجاع بین‌تبی («<normkey>.<field>» → عدد)
    که در فرمول خروجی‌های این تب قابل استفاده است.
    """
    allowed = {i.key: i for i in tab.inputs.all()}
    raw = payload.get("inputs") or {}
    if not isinstance(raw, dict):
        raise ValueError("ساختار inputs باید یک شیء باشد.")
    unknown = set(raw.keys()) - set(allowed.keys())
    if unknown:
        raise ValueError("ورودی‌های ناشناخته: " + ", ".join(sorted(unknown)))

    cleaned = {}
    for key, inp in allowed.items():
        if key not in raw or raw[key] is None or raw[key] == "":
            if inp.required:
                raise ValueError(f"ورودی اجباری «{inp.name}» وارد نشده است.")
            continue
        value = raw[key]
        if inp.input_type == "number":
            if isinstance(value, bool):
                raise ValueError(f"مقدار «{inp.name}» باید عدد باشد.")
            try:
                cleaned[key] = float(value)
            except (TypeError, ValueError):
                raise ValueError(f"مقدار «{inp.name}» باید عدد باشد.")
        elif inp.input_type == "select":
            text = str(value).strip() if not isinstance(value, bool) else ""
            if text not in (inp.options or []):
                raise ValueError(
                    f"مقدار «{inp.name}» باید یکی از گزینه‌ها باشد: "
                    + "، ".join(inp.options or [])
                )
            cleaned[key] = text
        else:
            cleaned[key] = str(value)

    env = {
        k: float(v)
        for k, v in cleaned.items()
        if isinstance(v, (int, float)) and not isinstance(v, bool)
    }
    if cross_ctx:
        env.update({k: v for k, v in cross_ctx.items() if isinstance(v, (int, float))})
    outputs = _compute_outputs(tab, env)
    return cleaned, outputs


def build_cross_context(tab, date_from=None, date_to=None, line=None):
    """مقادیر ارجاع بین‌تبی برای یک رکورد: آخرین/میانگین رکوردهای هم‌بازه.

    برای هر فیلد عددی هر تب دیگرِ همان کارخانه، در بازه‌ی تاریخی رکورد
    (و در صورت وجود، همان خط) میانگین آن مقدار برگردانده می‌شود.
    """
    from .models import FactoryTabRecord

    if not tab.pk or tab.factory_id is None:
        return {}
    ctx = {}
    for other in other_tabs(tab):
        qs = FactoryTabRecord.objects.filter(tab=other)
        if date_from:
            qs = qs.filter(date_to__gte=date_from)
        if date_to:
            qs = qs.filter(date_from__lte=date_to)
        if line is not None and getattr(line, "id", None):
            qs = qs.filter(line_id=line.id)
        qs = qs.order_by("-date_from", "-created_at")[:500]
        records = list(qs)
        if not records:
            continue
        prefix = norm_tab_key(other.key)
        fields = {i.key: "in" for i in other.inputs.filter(input_type="number")}
        for o in other.outputs.all():
            fields[o.key] = "out"
        for key, src in fields.items():
            vals = []
            for r in records:
                bucket = r.outputs if src == "out" else r.inputs
                v = (bucket or {}).get(key)
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    vals.append(float(v))
            if vals:
                ctx[f"{prefix}.{key}"] = sum(vals) / len(vals)
    return ctx


def _compute_outputs(tab, env):
    output_defs = list(tab.outputs.all())
    by_key = {o.key: o for o in output_defs}

    def deps(o):
        try:
            used = set(variables(o.formula))
        except FormulaError:
            used = set()
        return {v for v in used if v in by_key and v != o.key}

    order = _topo_sort(
        [o.key for o in output_defs], deps_by_key={o.key: deps(o) for o in output_defs}
    )
    results = {}
    for key in order:
        o = by_key[key]
        try:
            value = evaluate(o.formula, env)
        except FormulaError as e:
            raise ValueError(f"خطا در محاسبه‌ی خروجی «{o.name}»: {e}")
        results[key] = round(float(value), 6)
        env[key] = results[key]
    return results
