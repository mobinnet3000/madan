from typing import Optional


def clean_json_attributes(
    template,
    current_values: Optional[dict],
    attr_field: str = 'available_attributes',
) -> dict:
    """Validate and sanitize JSON attributes against a template's allowed attributes."""
    if not template:
        return current_values or {}
    allowed = set(
        getattr(template, attr_field).values_list('name', flat=True)
    )
    current = current_values or {}
    cleaned = {}
    for name in allowed:
        val = current.get(name, 0)
        try:
            cleaned[name] = float(val) if val is not None else 0
        except (ValueError, TypeError):
            cleaned[name] = 0
    return cleaned
