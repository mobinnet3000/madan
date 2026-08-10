"""
اعتبارسنجی فرمول‌های خروجی در سطح تعریف.

- `validate_output_formula`: هر فرمول باید از نظر نحوی معتبر باشد و تمام متغیرهایش
  به ورودی‌های همان خط (موقعیت یا ورودی اضافه) یا خروجی‌های دیگر اشاره کنند.
- `validate_outputs_no_cycle`: شناسایی و ممانعت از وابستگی دایره‌ای بین خروجی‌ها.

این ماژول هیچ وابستگی به مدل‌ها ندارد تا از import دایره‌ای جلوگیری شود.
"""

from .formula import FormulaError, validate_expr, variables


def _position_input_keys(line_def):
    """نگاشت 'positionKey.inputKey' -> قابل قبول برای ورودی‌های موقعیت‌ها."""
    valid = set()
    positions = line_def.line.analysis_positions.select_related(
        "definition"
    ).prefetch_related("definition__inputs")
    for pos in positions:
        if not pos.definition_id:
            continue
        for inp in pos.definition.inputs.all():
            valid.add(f"{pos.key}.{inp.key}")
    return valid


def _single_keys(line_def):
    """کلیدهای تک‌بخشی مجاز: ورودی‌های اضافه + کلید خروجی‌ها."""
    single = set(line_def.additional_inputs.values_list("key", flat=True))
    single.update(line_def.outputs.values_list("key", flat=True))
    return single


def validate_output_formula(line_def):
    """بررسی می‌کند تمام متغیرهای فرمول هر خروجی معتبر باشند."""
    if not line_def.pk:
        return
    position_inputs = _position_input_keys(line_def)
    single_keys = _single_keys(line_def)

    for out in line_def.outputs.all():
        expr = out.formula
        try:
            validate_expr(expr)
        except FormulaError as e:
            raise ValueError(f"فرمول خروجی «{out.name}» نامعتبر است: {e}")
        try:
            used = set(variables(expr))
        except FormulaError as e:
            raise ValueError(f"فرمول خروجی «{out.name}» نامعتبر است: {e}")
        for var in used:
            parts = var.split(".")
            if len(parts) == 2:
                if var not in position_inputs:
                    raise ValueError(
                        f"فرمول خروجی «{out.name}» به ورودی نامعتبر «{var}» اشاره دارد. "
                        f"موقعیت/ورودی آن در این خط تعریف نشده است."
                    )
            elif len(parts) == 1:
                if var not in single_keys:
                    raise ValueError(
                        f"فرمول خروجی «{out.name}» به متغیر نامعتبر «{var}» اشاره دارد. "
                        f"این ورودی اضافه یا خروجی در تعریف خط وجود ندارد."
                    )
            else:
                raise ValueError(f"متغیر «{var}» در فرمول «{out.name}» نامعتبر است.")


def validate_outputs_no_cycle(line_def):
    """جلوگیری از وابستگی دایره‌ای بین خروجی‌ها (DFS + تشخیص چرخه)."""
    if not line_def.pk:
        return
    outputs = list(line_def.outputs.values("key", "name"))
    key_to_name = {o["key"]: o["name"] for o in outputs}
    graph = {}
    for o in outputs:
        expr = _formula_for(line_def, o["key"])
        deps = set()
        try:
            used = set(variables(expr))
        except FormulaError:
            used = set()
        for var in used:
            if "." not in var and var in key_to_name and var != o["key"]:
                deps.add(var)
        graph[o["key"]] = deps

    WHITE, GRAY, BLACK = 0, 1, 2
    color = {k: WHITE for k in graph}

    def dfs(key, stack):
        color[key] = GRAY
        for dep in graph[key]:
            if color[dep] == GRAY:
                cycle = " -> ".join(stack + [dep])
                raise ValueError(f"وابستگی دایره‌ای بین خروجی‌ها یافت شد: {cycle}")
            if color[dep] == WHITE:
                dfs(dep, stack + [dep])
        color[key] = BLACK

    for key in graph:
        if color[key] == WHITE:
            dfs(key, [key])


def _formula_for(line_def, key):
    for out in line_def.outputs.filter(key=key):
        return out.formula
    return ""
