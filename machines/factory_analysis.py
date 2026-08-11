"""
سرویس آنالیز داینامیک در سطح کارخانه.

- تعریف ورودی‌های کارخانه + خروجی‌ها با فرمول (مشابه سیستم خط تولید ولی بدون موقعیت).
- ساخت Schema برای فرم داینامیک.
- اعتبارسنجی و محاسبه‌ی رکوردهای ProductionReport.
"""
from .formula import FormulaError, evaluate, variables, validate_expr
from .analysis import _topo_sort


def formula_variables_for_factory(factory):
    """متغیرهای قابل‌استفاده در فرمول‌های یک کارخانه (برای فرمول‌ساز ادمین)."""
    items = []
    factory_def = getattr(factory, "factory_analysis_definition", None)
    if factory_def:
        for inp in factory_def.inputs.all():
            items.append({"var": inp.key, "label": inp.name, "group": "ورودی‌های کارخانه"})
        for out in factory_def.outputs.all():
            items.append({"var": out.key, "label": out.name, "group": "خروجی‌ها"})
    return items


def validate_formula_for_factory(factory, expr):
    """اعتبارسنجی فرمول نسبت به کارخانه؛ لیست خطاها (خالی = معتبر)."""
    errors = []
    if not expr or not str(expr).strip():
        return ["فرمول خالی است."]
    try:
        validate_expr(expr)
    except FormulaError as e:
        return [str(e)]
    factory_def = getattr(factory, "factory_analysis_definition", None)
    valid = set()
    if factory_def:
        valid.update(factory_def.inputs.values_list("key", flat=True))
        valid.update(factory_def.outputs.values_list("key", flat=True))
    try:
        used = set(variables(expr))
    except FormulaError as e:
        return [str(e)]
    for v in sorted(used):
        if "." in v or v not in valid:
            errors.append(f"متغیر «{v}» در این کارخانه تعریف نشده است.")
    return errors


def validate_output_formula_for_factory(factory_def):
    """بررسی متغیرهای فرمول هر خروجی در سطح تعریف کارخانه."""
    if not factory_def.pk:
        return
    valid = set(factory_def.inputs.values_list("key", flat=True))
    valid.update(factory_def.outputs.values_list("key", flat=True))
    for out in factory_def.outputs.all():
        try:
            validate_expr(out.formula)
        except FormulaError as e:
            raise ValueError(f"فرمول خروجی «{out.name}» نامعتبر است: {e}")
        for v in variables(out.formula):
            if "." in v or v not in valid:
                raise ValueError(
                    f"فرمول خروجی «{out.name}» به متغیر نامعتبر «{v}» اشاره دارد."
                )


def validate_outputs_no_cycle_factory(factory_def):
    """جلوگیری از وابستگی دایره‌ای بین خروجی‌ها."""
    if not factory_def.pk:
        return
    key_to_name = {o.key: o.name for o in factory_def.outputs.all()}

    def _used(expr):
        try:
            return set(variables(expr))
        except FormulaError:
            return set()

    graph = {
        o.key: {v for v in _used(o.formula) if v in key_to_name and v != o.key}
        for o in factory_def.outputs.all()
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


def build_schema(factory):
    """ساختار کامل فرم داینامیک رکورد آنالیز کارخانه."""
    factory_def = getattr(factory, "factory_analysis_definition", None)
    return {
        "factory": {"id": factory.id, "name": factory.name},
        "inputs": [
            {
                "id": i.id,
                "key": i.key,
                "name": i.name,
                "type": i.input_type,
                "required": i.required,
                "unit": i.unit,
            }
            for i in (factory_def.inputs.all() if factory_def else [])
        ],
        "outputs": [
            {"id": o.id, "key": o.key, "name": o.name, "unit": o.unit}
            for o in (factory_def.outputs.all() if factory_def else [])
        ],
        "defined": factory_def is not None,
    }


def validate_and_compute(line, payload, factory_def=None):
    """اعتبارسنجی و محاسبه‌ی یک رکورد آنالیز کارخانه بر اساس Inputهای ارسالی."""
    if factory_def is None:
        factory_def = getattr(line.factory, "factory_analysis_definition", None)
    if factory_def is None:
        raise ValueError(
            "برای این کارخانه تعریف آنالیز (ورودی/خروجی/فرمول) ثبت نشده است."
        )

    allowed = {i.key: i for i in factory_def.inputs.all()}
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
        else:
            cleaned[key] = str(value)

    env = {
        k: float(v)
        for k, v in cleaned.items()
        if isinstance(v, (int, float)) and not isinstance(v, bool)
    }
    outputs = _compute_outputs(factory_def, env)
    return cleaned, outputs


def _compute_outputs(factory_def, env):
    output_defs = list(factory_def.outputs.all())
    by_key = {o.key: o for o in output_defs}

    def deps(o):
        try:
            used = set(variables(o.formula))
        except FormulaError:
            used = set()
        return {v for v in used if v in by_key and v != o.key}

    order = _topo_sort([o.key for o in output_defs], deps_by_key={o.key: deps(o) for o in output_defs})
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