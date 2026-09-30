from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import (
    Contractor,
    Factory,
    FactoryTab,
    FactoryTabInput,
    FactoryTabOutput,
    FactoryTabRecord,
    FactoryTabReport,
    FactoryTabWidget,
    Device,
    DeviceLog,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
    Shift,
    Attribute,
    DeviceTemplate,
    FailureReason,
)
from .jalali import jalali_and_weekday


def _attr_defs(queryset):
    """تبدیل ویژگی‌های الگو (نام + واحد) به لیست سریالایزری."""
    return [{"name": a.name, "unit": a.unit or ""} for a in queryset]


# ── پیمانکار و تعریف‌های نوع آنالیز (قبل از سریالایزر خط تا ارجاع حل شود) ──
class ContractorSerializer(serializers.ModelSerializer):
    factory_name = serializers.CharField(source="factory.name", read_only=True)

    class Meta:
        model = Contractor
        fields = [
            "id",
            "factory",
            "factory_name",
            "name",
            "contact_name",
            "phone",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["created_at"]










class FailureReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = FailureReason
        fields = "__all__"


class FactorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Factory
        fields = ["id", "name", "address"]


class ProductionLineAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionLineAttribute
        fields = ["id", "name", "unit"]


class AttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attribute
        fields = ["id", "name", "unit"]


class DeviceTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceTemplate
        fields = ["id", "name", "description", "available_attributes"]
        read_only_fields = ["available_attributes"]


class ProductionLineTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionLineTemplate
        fields = ["id", "name", "description", "available_attributes"]
        read_only_fields = ["available_attributes"]


class ProductionLineWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionLine
        fields = ["id", "factory", "name", "description", "line_type", "template", "attributes_values"]
        read_only_fields = ["id"]


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = ["id", "line", "name", "start_time", "end_time", "is_active"]


class DeviceWriteSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, allow_null=True, use_url=True)

    class Meta:
        model = Device
        fields = ["id", "line", "template", "name", "code", "order", "attributes_values", "image"]
        read_only_fields = ["id"]
        extra_kwargs = {"image": {"required": False, "allow_null": True}}

    def validate_image(self, value):
        if value is None or value == "":
            return value
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("حجم تصویر نباید بیش از ۵ مگابایت باشد.")
        ext = (value.name or "").lower().rsplit(".", 1)[-1] if "." in (value.name or "") else ""
        if ext not in ("jpg", "jpeg", "png", "webp"):
            raise serializers.ValidationError("فرمت مجاز: jpg, jpeg, png, webp")
        return value


class DeviceSerializer(serializers.ModelSerializer):
    template_name = serializers.ReadOnlyField(source="template.name")
    attribute_defs = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = [
            "id",
            "name",
            "code",
            "order",
            "template_name",
            "attributes_values",
            "attribute_defs",
            "image",
        ]

    def get_attribute_defs(self, obj):
        return (
            _attr_defs(obj.template.available_attributes.all())
            if obj.template_id
            else []
        )
















class FactoryFullDetailSerializer(serializers.ModelSerializer):
    shifts = serializers.SerializerMethodField()
    lines = serializers.SerializerMethodField()
    failure_reasons = serializers.SerializerMethodField()
    contractors = ContractorSerializer(many=True, read_only=True)
    report_tabs = serializers.SerializerMethodField()

    class Meta:
        model = Factory
        fields = ["id", "name", "address", "shifts", "lines", "failure_reasons", "contractors", "report_tabs"]

    def get_shifts(self, obj):
        cached = []
        for line in getattr(obj, "lines").all():
            cached.extend(list(getattr(line, "shifts").all()))
        if cached:
            return ShiftSerializer(cached, many=True).data
        from .models import Shift
        return ShiftSerializer(Shift.objects.filter(line__factory=obj), many=True).data

    def get_lines(self, obj):
        lines = getattr(obj, "lines").all()
        out = []
        for l in lines:
            tmpl_attrs = l.template.available_attributes.all() if l.template_id and hasattr(l.template, "available_attributes") else []
            out.append({"id": l.id, "name": l.name, "description": l.description, "line_type": l.line_type, "template_name": l.template.name if l.template_id else "", "attributes_values": l.attributes_values, "attribute_defs": _attr_defs(tmpl_attrs) if l.template_id else [], "devices": DeviceSerializer(l.devices.all(), many=True).data, "shifts": ShiftSerializer(l.shifts.all(), many=True).data})
        return out

    def get_failure_reasons(self, obj):
        return FailureReasonSerializer(FailureReason.objects.all(), many=True).data

    def get_report_tabs(self, obj):
        tabs = [t for t in getattr(obj, "report_tabs").all() if t.is_active]
        return FactoryTabBriefSerializer(tabs, many=True).data


class FactoryMinSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factory
        fields = ["id", "name"]


class ProductionLineMinSerializer(serializers.ModelSerializer):
    factory = FactoryMinSerializer(read_only=True)

    class Meta:
        model = ProductionLine
        fields = ["id", "name", "factory"]


class DeviceLogSerializer(serializers.ModelSerializer):
    efficiency = serializers.ReadOnlyField()
    line = ProductionLineMinSerializer(read_only=True)
    shift = ShiftSerializer(read_only=True)
    device = DeviceSerializer(read_only=True)
    failure_cause = FailureReasonSerializer(read_only=True)
    date_jalali = serializers.SerializerMethodField()
    day_of_week = serializers.SerializerMethodField()

    class Meta:
        model = DeviceLog
        fields = [
            "id",
            "line",
            "shift",
            "date",
            "date_jalali",
            "day_of_week",
            "device",
            "failure_cause",
            "runtime_hours",
            "downtime_hours",
            "failure_description",
            "repair_description",
            "feed_tonnage",
            "product_tonnage",
            "tailing_tonnage",
            "efficiency",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_date_jalali(self, obj):
        return jalali_and_weekday(obj.date)["date_jalali"]

    def get_day_of_week(self, obj):
        return jalali_and_weekday(obj.date)["day_of_week"]


class DeviceLogWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceLog
        fields = [
            "line",
            "shift",
            "date",
            "device",
            "failure_cause",
            "runtime_hours",
            "downtime_hours",
            "failure_description",
            "repair_description",
            "feed_tonnage",
            "product_tonnage",
            "tailing_tonnage",
        ]






# ═══════════════════ سیستم آنالیز داینامیک (تعریف‌محور) ═══════════════════



























# ═══════════════════ تناژ تحویلی خطوط تولید (تعریف‌محور) ═══════════════════


















# ═══════════════════ تب‌های داینامیک کارخانه ═══════════════════


class FactoryTabInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryTabInput
        fields = ["id", "key", "name", "input_type", "options", "unit", "required", "order"]

    def validate(self, attrs):
        from .models import normalize_select_options

        itype = attrs.get("input_type")
        if itype is None and self.instance is not None:
            itype = self.instance.input_type
        if itype is None:
            itype = "number"
        if itype not in ("number", "text", "select"):
            raise serializers.ValidationError(
                {"input_type": "نوع ورودی باید یکی از number/text/select باشد."}
            )
        if itype == "select" or "options" in attrs:
            opts = attrs.get(
                "options",
                getattr(self.instance, "options", []) or [],
            )
            if itype == "select":
                label = attrs.get("name") or (
                    self.instance.name if self.instance else ""
                )
                try:
                    attrs["options"] = normalize_select_options(opts, label=label)
                except Exception as e:  # noqa: BLE001
                    from django.core.exceptions import ValidationError as _DVE

                    if isinstance(e, _DVE):
                        raise serializers.ValidationError({"options": e.messages})
                    raise
            else:
                attrs["options"] = []
        return attrs


class FactoryTabOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryTabOutput
        fields = ["id", "key", "name", "unit", "formula", "order"]


class FactoryTabSerializer(serializers.ModelSerializer):
    inputs = FactoryTabInputSerializer(many=True, read_only=True)
    outputs = FactoryTabOutputSerializer(many=True, read_only=True)

    class Meta:
        model = FactoryTab
        fields = [
            "id", "factory", "key", "name", "description", "record_type",
            "require_line", "contractor_required", "order", "is_active",
            "inputs", "outputs", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        instance = FactoryTab.objects.create(**validated_data)
        _sync_tab_nested(instance, self.initial_data)
        return instance

    def update(self, instance, validated_data):
        for f in ("key", "name", "description", "record_type", "require_line",
                  "contractor_required", "order", "is_active"):
            if f in validated_data:
                setattr(instance, f, validated_data[f])
        instance.save()
        _sync_tab_nested(instance, self.initial_data)
        return instance


def _sync_tab_nested(instance, data):
    cache = getattr(instance, "_prefetched_objects_cache", None)
    if cache is not None:
        cache.pop("inputs", None)
        cache.pop("outputs", None)
    if data.get("inputs") is not None:
        _sync_tab_inputs(instance, data["inputs"])
    if data.get("outputs") is not None:
        _sync_tab_outputs(instance, data["outputs"])
    if cache is not None:
        cache.pop("inputs", None)
        cache.pop("outputs", None)
    try:
        instance.full_clean()
    except DjangoValidationError as e:
        raise serializers.ValidationError(
            {"detail": "; ".join(sum(([str(m) for m in v] for v in e.message_dict.values()), []))}
        )


def _sync_tab_inputs(instance, items):
    if not isinstance(items, list):
        raise serializers.ValidationError({"inputs": "باید یک لیست باشد."})
    existing = {i.key: i for i in instance.inputs.all()}
    seen = set()
    for idx, item in enumerate(items):
        key = item.get("key")
        if not key:
            raise serializers.ValidationError({"inputs": f"ردیف {idx + 1}: کلید (key) الزامی است."})
        if key in seen:
            raise serializers.ValidationError({"inputs": f"کلید تکراری «{key}»."})
        seen.add(key)
        itype = item.get("input_type", "number")
        if itype not in ("number", "text", "select"):
            raise serializers.ValidationError(
                {"inputs": f"ردیف {idx + 1}: نوع ورودی باید یکی از number/text/select باشد."}
            )
        defaults = {
            "name": item.get("name", key),
            "input_type": itype,
            "options": [],
            "unit": item.get("unit", ""),
            "required": item.get("required", True),
            "order": item.get("order", idx),
        }
        if itype == "select":
            from .models import normalize_select_options

            try:
                defaults["options"] = normalize_select_options(
                    item.get("options") or [], label=defaults["name"]
                )
            except Exception as e:  # noqa: BLE001
                from django.core.exceptions import ValidationError as _DVE

                if isinstance(e, _DVE):
                    raise serializers.ValidationError(
                        {"inputs": f"ردیف {idx + 1}: {'; '.join(e.messages)}"}
                    )
                raise
        if key in existing:
            for f, v in defaults.items():
                setattr(existing[key], f, v)
            existing[key].save()
        else:
            FactoryTabInput.objects.create(tab=instance, key=key, **defaults)
    for key in set(existing.keys()) - seen:
        existing[key].delete()


def _sync_tab_outputs(instance, items):
    if not isinstance(items, list):
        raise serializers.ValidationError({"outputs": "باید یک لیست باشد."})
    existing = {i.key: i for i in instance.outputs.all()}
    seen = set()
    for idx, item in enumerate(items):
        key = item.get("key")
        if not key:
            raise serializers.ValidationError({"outputs": f"ردیف {idx + 1}: کلید (key) الزامی است."})
        if key in seen:
            raise serializers.ValidationError({"outputs": f"کلید تکراری «{key}»."})
        seen.add(key)
        formula = item.get("formula")
        if not formula or not str(formula).strip():
            raise serializers.ValidationError({"outputs": f"فرمول خروجی «{key}» خالی است."})
        defaults = {
            "name": item.get("name", key),
            "unit": item.get("unit", ""),
            "formula": formula,
            "order": item.get("order", idx),
        }
        if key in existing:
            for f, v in defaults.items():
                setattr(existing[key], f, v)
            existing[key].save()
        else:
            FactoryTabOutput.objects.create(tab=instance, key=key, **defaults)
    for key in set(existing.keys()) - seen:
        existing[key].delete()


class FactoryTabBriefSerializer(serializers.ModelSerializer):
    inputs = FactoryTabInputSerializer(many=True, read_only=True)
    outputs = FactoryTabOutputSerializer(many=True, read_only=True)

    class Meta:
        model = FactoryTab
        fields = [
            "id", "key", "name", "description", "icon", "color",
            "record_type", "require_line", "contractor_required", "order",
            "is_active", "inputs", "outputs",
        ]


class FactoryTabRecordSerializer(serializers.ModelSerializer):
    tab = FactoryTabBriefSerializer(read_only=True)
    line = ProductionLineMinSerializer(read_only=True)
    contractor = ContractorSerializer(read_only=True)
    date_from_jalali = serializers.SerializerMethodField()
    date_to_jalali = serializers.SerializerMethodField()
    linked_records_detail = serializers.SerializerMethodField()

    class Meta:
        model = FactoryTabRecord
        fields = [
            "id", "tab", "line", "contractor",
            "date_from", "date_to", "date_from_jalali", "date_to_jalali",
            "hour", "inputs", "outputs", "note", "linked_records",
            "linked_records_detail", "created_by", "created_at",
        ]
        read_only_fields = ["created_by", "created_at", "outputs"]

    def get_date_from_jalali(self, obj):
        return jalali_and_weekday(obj.date_from)["date_jalali"]

    def get_date_to_jalali(self, obj):
        return jalali_and_weekday(obj.date_to)["date_jalali"]

    def get_linked_records_detail(self, obj):
        from .models import FactoryTabRecord as _Record

        detail = []
        for key, rid in (obj.linked_records or {}).items():
            rec = _Record.objects.filter(pk=rid).select_related("tab", "line", "contractor").first()
            if rec is None:
                continue
            detail.append({
                "tab_key": key,
                "record_id": rec.id,
                "tab_name": rec.tab.name if rec.tab_id else "",
                "line_name": rec.line.name if rec.line_id else None,
                "date_from": rec.date_from.isoformat() if rec.date_from else None,
                "date_to": rec.date_to.isoformat() if rec.date_to else None,
                "hour": rec.hour.strftime("%H:%M") if rec.hour else None,
                "inputs": rec.inputs or {},
                "outputs": rec.outputs or {},
            })
        return detail


class FactoryTabRecordWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryTabRecord
        fields = ["tab", "line", "contractor", "date_from", "date_to", "hour", "inputs", "note", "linked_records"]


class FactoryTabWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryTabWidget
        fields = ["id", "widget_type", "title", "order", "is_active", "config"]

    def validate(self, attrs):
        from .tab_reports import WIDGET_TYPES, validate_widget_config

        wtype = attrs.get("widget_type") or (self.instance.widget_type if self.instance else None)
        if wtype not in WIDGET_TYPES:
            raise serializers.ValidationError(
                {"widget_type": f"نوع ویجت «{wtype}» ناشناخته است؛ انواع مجاز: {sorted(WIDGET_TYPES)}"}
            )
        config = attrs.get("config", getattr(self.instance, "config", {}) or {})
        if not isinstance(config, dict):
            raise serializers.ValidationError({"config": "تنظیمات ویجت باید یک شیء باشد."})
        report = self.context.get("report") or (self.instance.report if self.instance else None)
        if report is not None:
            try:
                metric_keys = [m.get("key") for m in (report.metrics or []) if isinstance(m, dict)]
                attrs["config"] = validate_widget_config(report.tab, wtype, config, metric_keys=metric_keys)
            except ValueError as e:
                raise serializers.ValidationError({"config": str(e)})
        return attrs


class FactoryTabReportSerializer(serializers.ModelSerializer):
    widgets = FactoryTabWidgetSerializer(many=True, read_only=True)

    class Meta:
        model = FactoryTabReport
        fields = [
            "id", "tab", "name", "description", "is_default", "order", "is_active",
            "filters", "metrics", "widgets", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        from .tab_reports import ALLOWED_REPORT_FILTERS, normalize_report_filters, validate_report_metrics

        tab = attrs.get("tab") or (self.instance.tab if self.instance else None)
        if tab is None and self.context.get("tab") is not None:
            tab = self.context["tab"]
            attrs["tab"] = tab
        if "filters" in attrs:
            if not isinstance(attrs["filters"], list) or any(f not in ALLOWED_REPORT_FILTERS for f in attrs["filters"]):
                raise serializers.ValidationError(
                    {"filters": f"فیلترها باید زیرمجموعه‌ای از {list(ALLOWED_REPORT_FILTERS)} باشند."}
                )
            attrs["filters"] = normalize_report_filters(attrs["filters"])
        if "metrics" in attrs and tab is not None:
            try:
                attrs["metrics"] = validate_report_metrics(tab, attrs["metrics"] or [])
            except ValueError as e:
                raise serializers.ValidationError({"metrics": str(e)})
        return attrs
