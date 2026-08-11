"""
سرویس تناژ تحویلی خطوط تولید — تعریف‌محور.

- تعریف ورودی‌های هر خط تولید + خروجی‌ها با فرمول (مشابه آنالیز کارخانه/خط).
- ساخت Schema برای فرم داینامیک ثبت تناژ.
- اعتبارسنجی و محاسبه‌ی رکوردهای DeliveredTonnage.
"""
from .formula import FormulaError, evaluate, variables, validate_expr
from .factory_analysis import (
    _compute_outputs,
    validate_output_formula_for_factory,
    validate_outputs_no_cycle_factory,
)


def formula_variables_for_tonnage(line):
    """متغیرهای قابل‌استفاده در فرمول‌های تناژ یک خط (برای فرمول‌ساز ادمین)."""
    items = []
    line_def = getattr(line, "tonnage_definition", None)
    if line_def:
        for inp in line_def.inputs.all():
            items.append({"var": inp.key, "label": inp.name, "group": "ورودی‌های تناژ"})
        for out in line_def.outputs.all():
            items.append({"var": out.key, "label": out.name, "group": "خروجی‌ها"})
    return items


def validate_formula_for_tonnage(line, expr):
    """اعتبارسنجی فرمول نسبت به خط؛ لیست خطاها (خالی = معتبر)."""
    errors = []
    if not expr or not str(expr).strip():
        return ["فرمول خالی است."]
    try:
        validate_expr(expr)
    except FormulaError as e:
        return [str(e)]
    line_def = getattr(line, "tonnage_definition", None)
    valid = set()
    if line_def:
        valid.update(line_def.inputs.values_list("key", flat=True))
        valid.update(line_def.outputs.values_list("key", flat=True))
    try:
        used = set(variables(expr))
    except FormulaError as e:
        return [str(e)]
    for v in sorted(used):
        if "." in v or v not in valid:
            errors.append(f"متغیر «{v}» در این خط تعریف نشده است.")
    return errors


def build_schema(line):
    """ساختار کامل فرم داینامیک ثبت تناژ تحویلی یک خط."""
    line_def = getattr(line, "tonnage_definition", None)
    return {
        "line": {"id": line.id, "name": line.name},
        "inputs": [
            {
                "id": i.id,
                "key": i.key,
                "name": i.name,
                "type": i.input_type,
                "required": i.required,
                "unit": i.unit,
            }
            for i in (line_def.inputs.all() if line_def else [])
        ],
        "outputs": [
            {"id": o.id, "key": o.key, "name": o.name, "unit": o.unit}
            for o in (line_def.outputs.all() if line_def else [])
        ],
        "defined": line_def is not None,
    }


def validate_and_compute(line, payload, tonnage_def=None):
    """اعتبارسنجی و محاسبه‌ی یک رکورد تناژ بر اساس Inputهای ارسالی."""
    if tonnage_def is None:
        tonnage_def = getattr(line, "tonnage_definition", None)
    if tonnage_def is None:
        raise ValueError(
            "برای این خط تولید تعریف تناژ تحویلی (ورودی/خروجی/فرمول) ثبت نشده است."
        )

    allowed = {i.key: i for i in tonnage_def.inputs.all()}
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
    outputs = _compute_outputs(tonnage_def, env)
    return cleaned, outputs
