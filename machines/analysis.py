"""
سرویس سیستم آنالیز داینامیک.

- ساخت Schema برای ساختن فرم داینامیک بر اساس Line.
- اعتبارسنجی ورودی‌های Actual Analysis بر اساس تعریف‌ها.
- محاسبه‌ی خروجی‌ها با موتور فرمول امن.
"""

from .formula import FormulaError, variables, evaluate


def _position_inputs(position):
    """لیست ورودی‌های یک موقعیت از تعریف نوع آنالیز آن."""
    if not position.definition_id:
        return []
    return [
        {
            "id": inp.id,
            "key": inp.key,
            "name": inp.name,
            "type": inp.input_type,
            "required": inp.required,
            "unit": inp.unit,
        }
        for inp in position.definition.inputs.all()
    ]


def build_schema(line):
    """ساخت ساختار کامل Schema برای فرم داینامیک Actual Analysis یک خط."""
    positions = line.analysis_positions.select_related("definition").prefetch_related(
        "definition__inputs"
    )
    line_def = getattr(line, "analysis_definition", None)

    contractors = (
        line.factory.contractors.filter(is_active=True).order_by("name")
        if line.factory_id
        else []
    )

    return {
        "line": {"id": line.id, "name": line.name},
        "contractor": {
            "required": bool(line_def and line_def.contractor_required),
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
        "positions": [
            {
                "id": p.id,
                "key": p.key,
                "name": p.name,
                "definition": (
                    {"id": p.definition_id, "name": p.definition.name}
                    if p.definition_id
                    else None
                ),
                "inputs": _position_inputs(p),
            }
            for p in positions
        ],
        "additional_inputs": [
            {
                "id": a.id,
                "key": a.key,
                "name": a.name,
                "type": a.input_type,
                "required": a.required,
                "unit": a.unit,
            }
            for a in (line_def.additional_inputs.all() if line_def else [])
        ],
        "outputs": [
            {"id": o.id, "key": o.key, "name": o.name, "unit": o.unit}
            for o in (line_def.outputs.all() if line_def else [])
        ],
        "defined": line_def is not None,
    }


def _to_float(value, label):
    if isinstance(value, bool):
        raise ValueError(f"مقدار «{label}» باید عدد باشد.")
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"مقدار «{label}» باید عدد باشد.")


def _validate_input_value(value, inp_def, label):
    if inp_def.input_type == "number":
        return _to_float(value, label)
    if value is None:
        raise ValueError(f"مقدار «{label}» نمی‌تواند خالی باشد.")
    return str(value)


def validate_and_compute(line, payload, line_def=None):
    """
    اعتبارسنجی و محاسبه‌ی یک Actual Analysis بر اساس Definition خط.

    در صورت موفقیت tuple (inputs_normalized, outputs) برمی‌گرداند؛
    در صورت خطا ValueError با پیام مناسب پرتاب می‌کند.
    """
    if line_def is None:
        line_def = getattr(line, "analysis_definition", None)
    if line_def is None:
        raise ValueError(
            "برای این خط تولید تعریف آنالیز (Line Analysis Definition) ثبت نشده است."
        )

    # ── پیمانکار ──
    contractor_id = payload.get("contractor_id")
    contractor = None
    if contractor_id:
        contractor = line.factory.contractors.filter(pk=contractor_id).first()
        if contractor is None or not contractor.is_active:
            raise ValueError(
                "پیمانکار انتخاب‌شده متعلق به کارخانه‌ی همین خط تولید نیست یا غیرفعال است."
            )
    elif line_def.contractor_required:
        raise ValueError("انتخاب پیمانکار برای این خط الزامی است.")

    # ── موقعیت‌ها و ورودی‌هایشان ──
    positions_payload = payload.get("positions") or {}
    if not isinstance(positions_payload, dict):
        raise ValueError("ساختار positions باید یک شیء باشد.")
    positions = list(
        line.analysis_positions.select_related("definition").prefetch_related(
            "definition__inputs"
        )
    )
    by_key = {p.key: p for p in positions}
    by_id = {str(p.id): p for p in positions}

    normalized_positions = {}
    for raw_key, values in positions_payload.items():
        pos = by_key.get(raw_key) or by_id.get(str(raw_key))
        if pos is None:
            raise ValueError(f"موقعیت «{raw_key}» متعلق به این خط تولید نیست.")
        if pos.definition_id is None:
            raise ValueError(
                f"برای موقعیت «{pos.name}» تعریف نوع آنالیز مشخص نشده است."
            )
        if not isinstance(values, dict):
            raise ValueError(f"مقادیر موقعیت «{pos.name}» باید یک شیء باشد.")

        allowed = {inp.key: inp for inp in pos.definition.inputs.all()}
        unknown = set(values.keys()) - set(allowed.keys())
        if unknown:
            raise ValueError(
                f'موقعیت «{pos.name}» ورودی‌های ناشناخته دارد: {", ".join(sorted(unknown))}'
            )

        cleaned = {}
        for inp_key, inp in allowed.items():
            label = f"{pos.name}.{inp.name}"
            if (
                inp_key not in values
                or values[inp_key] is None
                or values[inp_key] == ""
            ):
                if inp.required:
                    raise ValueError(f"ورودی اجباری «{label}» وارد نشده است.")
                continue
            cleaned[inp_key] = _validate_input_value(values[inp_key], inp, label)
        normalized_positions[pos.key] = cleaned

    # ── ورودی‌های اضافه ──
    additional_payload = payload.get("additional_inputs") or {}
    if not isinstance(additional_payload, dict):
        raise ValueError("ساختار additional_inputs باید یک شیء باشد.")
    add_defs = list(line_def.additional_inputs.all())
    allowed_add = {a.key: a for a in add_defs}
    unknown_add = set(additional_payload.keys()) - set(allowed_add.keys())
    if unknown_add:
        raise ValueError(
            f'ورودی‌های اضافه‌ی ناشناخته: {", ".join(sorted(unknown_add))}'
        )

    normalized_additional = {}
    for add_key, add in allowed_add.items():
        if (
            add_key not in additional_payload
            or additional_payload[add_key] is None
            or additional_payload[add_key] == ""
        ):
            if add.required:
                raise ValueError(f"ورودی اجباری «{add.name}» وارد نشده است.")
            continue
        normalized_additional[add_key] = _validate_input_value(
            additional_payload[add_key], add, add.name
        )

    # ── محاسبه‌ی خروجی‌ها ──
    env = {}
    for pos_key, vals in normalized_positions.items():
        for inp_key, val in vals.items():
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                env[f"{pos_key}.{inp_key}"] = float(val)

    for add_key, val in normalized_additional.items():
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            env[add_key] = float(val)

    outputs = _compute_outputs(line_def, env)

    inputs_normalized = {
        "positions": normalized_positions,
        "additional_inputs": normalized_additional,
    }
    return inputs_normalized, outputs


def _compute_outputs(line_def, env):
    """محاسبه‌ی خروجی‌ها به ترتیب وابستگی (بدون چرخه)."""
    output_defs = list(line_def.outputs.all())
    by_key = {o.key: o for o in output_defs}

    def deps(o):
        used = set()
        try:
            used = set(variables(o.formula))
        except FormulaError:
            used = set()
        return {v for v in used if "." not in v and v in by_key}

    ordered = _topo_sort(
        [o.key for o in output_defs], deps_by_key={o.key: deps(o) for o in output_defs}
    )
    results = {}
    for key in ordered:
        o = by_key[key]
        try:
            value = evaluate(o.formula, env)
        except FormulaError as e:
            raise ValueError(f"خطا در محاسبه‌ی خروجی «{o.name}»: {e}")
        results[key] = round(float(value), 6)
        env[key] = results[key]
    return results


def _topo_sort(keys, deps_by_key):
    """مرتب‌سازی توپولوژیک خروجی‌ها؛ در صورت چرخه ValueError پرتاب می‌کند."""
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
