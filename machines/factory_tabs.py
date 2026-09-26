"""
سرویس تب‌های داینامیک کارخانه — ساختار یکسان برای همه تب‌ها.

- هر تب: ورودی‌ها + خروجی‌ها با فرمول (موتور فرمول امن).
- ساخت Schema برای فرم داینامیک ثبت رکورد.
- اعتبارسنجی و محاسبه‌ی رکوردهای FactoryTabRecord.
"""

from .formula import FormulaError, evaluate, variables, validate_expr
from .analysis import _topo_sort


def formula_variables_for_tab(tab):
    """متغیرهای قابل‌استفاده در فرمول‌های یک تب (برای فرمول‌ساز ادمین)."""
    items = []
    for inp in tab.inputs.all():
        items.append({"var": inp.key, "label": inp.name, "group": "ورودی‌ها"})
    for out in tab.outputs.all():
        items.append({"var": out.key, "label": out.name, "group": "خروجی‌ها"})
    return items


def _select_keys(tab):
    return set(tab.inputs.filter(input_type="select").values_list("key", flat=True))


def validate_formula_for_tab(tab, expr):
    """اعتبارسنجی فرمول نسبت به یک تب؛ لیست خطاها (خالی = معتبر)."""
    errors = []
    if not expr or not str(expr).strip():
        return ["فرمول خالی است."]
    try:
        validate_expr(expr)
    except FormulaError as e:
        return [str(e)]
    valid = set(tab.inputs.values_list("key", flat=True))
    valid.update(tab.outputs.values_list("key", flat=True))
    try:
        used = set(variables(expr))
    except FormulaError as e:
        return [str(e)]
    selects = _select_keys(tab)
    for v in sorted(used):
        if "." in v or v not in valid:
            errors.append(f"متغیر «{v}» در این تب تعریف نشده است.")
        elif v in selects:
            errors.append(f"متغیر «{v}» از نوع انتخابی است و در فرمول عددی قابل استفاده نیست.")
    return errors


def validate_output_formula_for_tab(tab):
    """بررسی متغیرهای فرمول هر خروجی در سطح تعریف تب."""
    if not tab.pk:
        return
    valid = set(tab.inputs.values_list("key", flat=True))
    valid.update(tab.outputs.values_list("key", flat=True))
    selects = _select_keys(tab)
    for out in tab.outputs.all():
        try:
            validate_expr(out.formula)
        except FormulaError as e:
            raise ValueError(f"فرمول خروجی «{out.name}» نامعتبر است: {e}")
        for v in variables(out.formula):
            if "." in v or v not in valid:
                raise ValueError(
                    f"فرمول خروجی «{out.name}» به متغیر نامعتبر «{v}» اشاره دارد."
                )
            if v in selects:
                raise ValueError(
                    f"فرمول خروجی «{out.name}» به ورودی انتخابی «{v}» اشاره دارد؛ "
                    "ورودی انتخابی متنی است و در فرمول عددی مجاز نیست."
                )


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


def validate_and_compute(tab, payload):
    """اعتبارسنجی و محاسبه‌ی یک رکورد تب بر اساس Inputهای ارسالی."""
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
    outputs = _compute_outputs(tab, env)
    return cleaned, outputs


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
