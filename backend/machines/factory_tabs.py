"""
سرویس تب‌های داینامیک کارخانه — ساختار یکسان برای همه تب‌ها.

- هر تب: ورودی‌ها + خروجی‌ها با فرمول (موتور فرمول امن).
- ساخت Schema برای فرم داینامیک ثبت رکورد.
- اعتبارسنجی و محاسبه‌ی رکوردهای FactoryTabRecord.
"""

from .formula import FormulaError, evaluate, variables, validate_expr


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
        "cross_tabs": [
            {
                "id": o.id,
                "key": o.key,
                "norm_key": norm_tab_key(o.key),
                "name": o.name,
                "record_type": o.record_type,
            }
            for o in other_tabs(tab).order_by("order", "id")
        ],
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


def build_cross_context(tab, date_from=None, date_to=None, line=None, linked_records=None):
    """مقادیر ارجاع بین‌تبی برای یک رکورد.

    اگر linked_records شامل {norm_key: record_id} باشد، مقدار دقیق همان رکورد
    (با چک کارخانه/تب) برگردانده می‌شود. در غیر این صورت میانگین رکوردهای
    هم‌بازه/هم‌خط (سازگار با رفتار قبلی).

    میانگین فقط وقتی محاسبه می‌شود که کاربر رکورد خاصی انتخاب نکرده باشد.
    اگر میانگینی هم یافت نشود، کلیدی در ctx گذاشته نمی‌شود تا فرمول خطای
    صریح «متغیر وجود ندارد» بدهد.
    """
    from .models import FactoryTabRecord

    if not tab.pk or tab.factory_id is None:
        return {}
    ctx = {}
    linked_records = linked_records or {}
    tab_map = other_tab_map(tab)
    for other in other_tabs(tab):
        prefix = norm_tab_key(other.key)
        linked_id = linked_records.get(prefix)
        if linked_id is not None:
            try:
                linked_id = int(linked_id)
            except (TypeError, ValueError):
                linked_id = None
        if linked_id is not None:
            expected_tab = tab_map.get(prefix)
            rec = FactoryTabRecord.objects.filter(pk=linked_id).first()
            if rec is None or rec.tab_id != (expected_tab.id if expected_tab else other.id):
                continue
            fields = {i.key: "in" for i in other.inputs.filter(input_type="number")}
            for o in other.outputs.all():
                fields[o.key] = "out"
            for key, src in fields.items():
                bucket = rec.outputs if src == "out" else rec.inputs
                v = (bucket or {}).get(key)
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    ctx[f"{prefix}.{key}"] = float(v)
            continue
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


def validate_linked_records(tab, linked_records):
    """اعتبارسنجی نگاشت {norm_key: record_id}."""
    if not linked_records:
        return {}
    if not isinstance(linked_records, dict):
        raise ValueError("linked_records باید یک شی (نگاشت تب→شناسه رکورد) باشد.")
    from .models import FactoryTabRecord

    norm_map = other_tab_map(tab)
    cleaned: dict[str, int] = {}
    for raw_key, raw_id in linked_records.items():
        key = str(raw_key).strip().replace("-", "_")
        if not key:
            continue
        if key not in norm_map:
            raise ValueError(f"کلید تب «{raw_key}» در این کارخانه یافت نشد.")
        try:
            rid = int(raw_id)
        except (TypeError, ValueError):
            raise ValueError(f"شناسه رکورد برای «{raw_key}» باید عدد باشد.")
        rec = FactoryTabRecord.objects.filter(pk=rid).select_related("tab").first()
        if rec is None:
            raise ValueError(f"رکورد {rid} برای تب «{raw_key}» یافت نشد.")
        if rec.tab_id != norm_map[key].id:
            raise ValueError(f"رکورد {rid} متعلق به تب «{raw_key}» نیست.")
        if rec.tab.factory_id != tab.factory_id:
            raise ValueError(f"رکورد {rid} متعلق به همین کارخانه نیست.")
        cleaned[key] = rid
    return cleaned


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
    cross_names = set(cross_tab_refs(tab).keys())
    results = {}
    for key in order:
        o = by_key[key]
        try:
            value = evaluate(o.formula, env)
        except FormulaError as e:
            msg = str(e)
            # پیام واضح‌تر برای ارجاع بین‌تبی خالی
            if "وجود ندارد" in msg:
                try:
                    needed = set(variables(o.formula))
                except Exception:
                    needed = set()
                cross_needed = sorted(needed & cross_names)
                if cross_needed:
                    hint = "، ".join(cross_needed)
                    msg += f" — برای «{hint}» یا رکورد خاص همان تب را انتخاب کنید یا بازه‌ای بگذارید که در تب مقصد رکورد داشته باشد (میانگین هم‌بازه فعلاً خالی است)."
            raise ValueError(f"خطا در محاسبه‌ی خروجی «{o.name}»: {msg}")
        results[key] = round(float(value), 6)
        env[key] = results[key]
    return results
