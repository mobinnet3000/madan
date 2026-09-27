from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import (
    Factory,
    Shift,
    FailureReason,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
    Attribute,
    DeviceTemplate,
    Device,
    DeviceLog,
    ProductionReport,
    Contractor,
    AnalysisTypeDefinition,
    AnalysisInputDefinition,
    AnalysisPosition,
    LineAnalysisDefinition,
    AdditionalInputDefinition,
    AnalysisOutputDefinition,
    ActualAnalysis,
    FactoryAnalysisDefinition,
    FactoryAnalysisInput,
    FactoryAnalysisOutput,
    DeliveredTonnageDefinition,
    DeliveredTonnageInput,
    DeliveredTonnageOutput,
    DeliveredTonnage,
    FactoryTab,
    FactoryTabInput,
    FactoryTabOutput,
    FactoryTabRecord,
    FactoryTabReport,
    FactoryTabWidget,
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


class AnalysisInputDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisInputDefinition
        fields = ["id", "key", "name", "input_type", "unit", "required", "order"]


class AnalysisTypeDefinitionSerializer(serializers.ModelSerializer):
    inputs = AnalysisInputDefinitionSerializer(many=True, read_only=True)

    class Meta:
        model = AnalysisTypeDefinition
        fields = ["id", "name", "description", "inputs", "created_at"]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        inputs = self.initial_data.get("inputs") or []
        definition = AnalysisTypeDefinition.objects.create(
            name=validated_data["name"],
            description=validated_data.get("description", ""),
        )
        _sync_inputs(definition, inputs)
        return definition

    def update(self, instance, validated_data):
        instance.name = validated_data.get("name", instance.name)
        instance.description = validated_data.get("description", instance.description)
        instance.save()
        if "inputs" in self.initial_data:
            _sync_inputs(instance, self.initial_data.get("inputs") or [])
        return instance


def _sync_inputs(definition, inputs):
    """همگام‌سازی ورودی‌های یک تعریف نوع آنالیز بر اساس لیست ارسالی."""
    if not isinstance(inputs, list):
        raise serializers.ValidationError({"inputs": "باید یک لیست باشد."})
    existing = {i.key: i for i in definition.inputs.all()}
    seen = set()
    for idx, item in enumerate(inputs):
        key = item.get("key")
        if not key:
            raise serializers.ValidationError(
                {"inputs": f"ردیف {idx + 1}: کلید (key) الزامی است."}
            )
        if key in seen:
            raise serializers.ValidationError(
                {"inputs": f"کلید تکراری «{key}» در ورودی‌ها."}
            )
        seen.add(key)
        defaults = {
            "name": item.get("name", key),
            "input_type": item.get("input_type", "number"),
            "unit": item.get("unit", ""),
            "required": item.get("required", True),
            "order": item.get("order", idx),
        }
        if key in existing:
            for f, v in defaults.items():
                setattr(existing[key], f, v)
            existing[key].save()
        else:
            AnalysisInputDefinition.objects.create(
                definition=definition, key=key, **defaults
            )
    for key in set(existing.keys()) - seen:
        existing[key].delete()


class AnalysisPositionSerializer(serializers.ModelSerializer):
    definition = AnalysisTypeDefinitionSerializer(read_only=True)
    inputs = serializers.SerializerMethodField()

    class Meta:
        model = AnalysisPosition
        fields = ["id", "line", "name", "key", "definition", "inputs", "order"]
        read_only_fields = ["line"]

    def get_inputs(self, obj):
        if not obj.definition_id:
            return []
        return AnalysisInputDefinitionSerializer(
            obj.definition.inputs.all(), many=True
        ).data

    def validate(self, attrs):
        line_id = self.context.get("line_id")
        if not line_id:
            raise serializers.ValidationError("خط تولید نامشخص است.")
        attrs["line_id"] = line_id
        return attrs


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


class TonnageInputBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveredTonnageInput
        fields = ["id", "key", "name", "input_type", "unit", "required", "order"]


class TonnageOutputBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveredTonnageOutput
        fields = ["id", "key", "name", "unit", "formula", "order"]


class TonnageDefinitionBriefSerializer(serializers.ModelSerializer):
    inputs = TonnageInputBriefSerializer(many=True, read_only=True)
    outputs = TonnageOutputBriefSerializer(many=True, read_only=True)

    class Meta:
        model = DeliveredTonnageDefinition
        fields = ["id", "description", "inputs", "outputs"]


class ProductionLineSerializer(serializers.ModelSerializer):
    devices = DeviceSerializer(many=True, read_only=True)
    shifts = ShiftSerializer(many=True, read_only=True)
    template_name = serializers.ReadOnlyField(source="template.name")
    attribute_defs = serializers.SerializerMethodField()
    analysis_positions = AnalysisPositionSerializer(many=True, read_only=True)
    tonnage_definition = TonnageDefinitionBriefSerializer(read_only=True)

    class Meta:
        model = ProductionLine
        fields = [
            "id",
            "name",
            "description",
            "line_type",
            "template_name",
            "attributes_values",
            "attribute_defs",
            "devices",
            "shifts",
            "analysis_positions",
            "tonnage_definition",
        ]

    def get_attribute_defs(self, obj):
        return (
            _attr_defs(obj.template.available_attributes.all())
            if obj.template_id
            else []
        )


class FactoryAnalysisInputBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryAnalysisInput
        fields = ["id", "key", "name", "input_type", "unit", "required", "order"]


class FactoryAnalysisOutputBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryAnalysisOutput
        fields = ["id", "key", "name", "unit", "formula", "order"]


class FactoryAnalysisDefinitionBriefSerializer(serializers.ModelSerializer):
    inputs = FactoryAnalysisInputBriefSerializer(many=True, read_only=True)
    outputs = FactoryAnalysisOutputBriefSerializer(many=True, read_only=True)

    class Meta:
        model = FactoryAnalysisDefinition
        fields = ["id", "description", "inputs", "outputs"]


class FactoryFullDetailSerializer(serializers.ModelSerializer):
    shifts = serializers.SerializerMethodField()
    lines = ProductionLineSerializer(many=True, read_only=True)
    failure_reasons = serializers.SerializerMethodField()
    contractors = ContractorSerializer(many=True, read_only=True)
    factory_analysis_definition = FactoryAnalysisDefinitionBriefSerializer(
        read_only=True
    )
    report_tabs = serializers.SerializerMethodField()

    class Meta:
        model = Factory
        fields = [
            "id",
            "name",
            "address",
            "shifts",
            "lines",
            "failure_reasons",
            "contractors",
            "factory_analysis_definition",
            "report_tabs",
        ]

    def get_shifts(self, obj):
        from .models import Shift
        return ShiftSerializer(Shift.objects.filter(line__factory=obj), many=True).data

    def get_report_tabs(self, obj):
        qs = obj.report_tabs.filter(is_active=True).prefetch_related("inputs", "outputs")
        return FactoryTabBriefSerializer(qs, many=True).data

    def get_failure_reasons(self, obj):
        return FailureReasonSerializer(FailureReason.objects.all(), many=True).data


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


class ProductionReportSerializer(serializers.ModelSerializer):
    line = ProductionLineMinSerializer(read_only=True)
    contractor = ContractorSerializer(read_only=True)
    date_from_jalali = serializers.SerializerMethodField()
    date_to_jalali = serializers.SerializerMethodField()

    class Meta:
        model = ProductionReport
        fields = [
            "id",
            "line",
            "contractor",
            "date_from",
            "date_to",
            "date_from_jalali",
            "date_to_jalali",
            "inputs",
            "outputs",
            "note",
            "created_at",
        ]
        read_only_fields = ["created_at", "outputs"]

    def get_date_from_jalali(self, obj):
        return jalali_and_weekday(obj.date_from)["date_jalali"]

    def get_date_to_jalali(self, obj):
        return jalali_and_weekday(obj.date_to)["date_jalali"]


class ProductionReportWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionReport
        fields = [
            "line",
            "contractor",
            "date_from",
            "date_to",
            "inputs",
            "note",
        ]


# ═══════════════════ سیستم آنالیز داینامیک (تعریف‌محور) ═══════════════════


class AdditionalInputDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdditionalInputDefinition
        fields = ["id", "key", "name", "input_type", "unit", "required", "order"]


class AnalysisOutputDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisOutputDefinition
        fields = ["id", "key", "name", "unit", "formula", "order"]


class LineAnalysisDefinitionSerializer(serializers.ModelSerializer):
    additional_inputs = AdditionalInputDefinitionSerializer(many=True, read_only=True)
    outputs = AnalysisOutputDefinitionSerializer(many=True, read_only=True)

    class Meta:
        model = LineAnalysisDefinition
        fields = [
            "id",
            "line",
            "contractor_required",
            "notes",
            "additional_inputs",
            "outputs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        instance = LineAnalysisDefinition.objects.create(**validated_data)
        _sync_line_def_nested(instance, self.initial_data)
        return instance

    def update(self, instance, validated_data):
        instance.contractor_required = validated_data.get(
            "contractor_required", instance.contractor_required
        )
        instance.notes = validated_data.get("notes", instance.notes)
        instance.save()
        _sync_line_def_nested(instance, self.initial_data)
        return instance


def _sync_line_def_nested(instance, data):
    additional = data.get("additional_inputs")
    if additional is not None:
        _sync_additional_inputs(instance, additional)
    outputs = data.get("outputs")
    if outputs is not None:
        _sync_outputs(instance, outputs)
    instance.full_clean()


def _sync_additional_inputs(instance, items):
    if not isinstance(items, list):
        raise serializers.ValidationError({"additional_inputs": "باید یک لیست باشد."})
    existing = {i.key: i for i in instance.additional_inputs.all()}
    seen = set()
    for idx, item in enumerate(items):
        key = item.get("key")
        if not key:
            raise serializers.ValidationError(
                {"additional_inputs": f"ردیف {idx + 1}: کلید (key) الزامی است."}
            )
        if key in seen:
            raise serializers.ValidationError(
                {"additional_inputs": f"کلید تکراری «{key}»."}
            )
        seen.add(key)
        defaults = {
            "name": item.get("name", key),
            "input_type": item.get("input_type", "number"),
            "unit": item.get("unit", ""),
            "required": item.get("required", True),
            "order": item.get("order", idx),
        }
        if key in existing:
            for f, v in defaults.items():
                setattr(existing[key], f, v)
            existing[key].save()
        else:
            AdditionalInputDefinition.objects.create(
                line_definition=instance, key=key, **defaults
            )
    for key in set(existing.keys()) - seen:
        existing[key].delete()


def _sync_outputs(instance, items):
    if not isinstance(items, list):
        raise serializers.ValidationError({"outputs": "باید یک لیست باشد."})
    existing = {i.key: i for i in instance.outputs.all()}
    seen = set()
    for idx, item in enumerate(items):
        key = item.get("key")
        if not key:
            raise serializers.ValidationError(
                {"outputs": f"ردیف {idx + 1}: کلید (key) الزامی است."}
            )
        if key in seen:
            raise serializers.ValidationError({"outputs": f"کلید تکراری «{key}»."})
        seen.add(key)
        formula = item.get("formula")
        if not formula or not str(formula).strip():
            raise serializers.ValidationError(
                {"outputs": f"فرمول خروجی «{key}» خالی است."}
            )
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
            AnalysisOutputDefinition.objects.create(
                line_definition=instance, key=key, **defaults
            )
    for key in set(existing.keys()) - seen:
        existing[key].delete()


class ActualAnalysisSerializer(serializers.ModelSerializer):
    line = ProductionLineMinSerializer(read_only=True)
    contractor = ContractorSerializer(read_only=True)
    shift = ShiftSerializer(read_only=True)
    date_from_jalali = serializers.SerializerMethodField()
    date_to_jalali = serializers.SerializerMethodField()
    line_devices = serializers.SerializerMethodField()

    class Meta:
        model = ActualAnalysis
        fields = [
            "id",
            "line",
            "contractor",
            "date_from",
            "date_to",
            "date_from_jalali",
            "date_to_jalali",
            "shift",
            "inputs",
            "outputs",
            "line_devices",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["created_by", "created_at", "outputs"]

    def get_date_from_jalali(self, obj):
        return jalali_and_weekday(obj.date_from)["date_jalali"]

    def get_date_to_jalali(self, obj):
        return jalali_and_weekday(obj.date_to)["date_jalali"]

    def get_line_devices(self, obj):
        return [
            {"id": d.id, "name": d.name, "code": d.code, "order": d.order}
            for d in obj.line.devices.all().order_by("order")
        ]


class FactoryAnalysisInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryAnalysisInput
        fields = ["id", "key", "name", "input_type", "unit", "required", "order"]


class FactoryAnalysisOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryAnalysisOutput
        fields = ["id", "key", "name", "unit", "formula", "order"]


class FactoryAnalysisDefinitionSerializer(serializers.ModelSerializer):
    inputs = FactoryAnalysisInputSerializer(many=True, read_only=True)
    outputs = FactoryAnalysisOutputSerializer(many=True, read_only=True)

    class Meta:
        model = FactoryAnalysisDefinition
        fields = ["id", "factory", "description", "inputs", "outputs", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        instance = FactoryAnalysisDefinition.objects.create(**validated_data)
        _sync_factory_nested(instance, self.initial_data)
        return instance

    def update(self, instance, validated_data):
        instance.description = validated_data.get("description", instance.description)
        instance.save()
        _sync_factory_nested(instance, self.initial_data)
        return instance


def _sync_factory_nested(instance, data):
    if data.get("inputs") is not None:
        _sync_factory_inputs(instance, data["inputs"])
    if data.get("outputs") is not None:
        _sync_factory_outputs(instance, data["outputs"])
    instance.full_clean()


def _sync_factory_inputs(instance, items):
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
        defaults = {
            "name": item.get("name", key),
            "input_type": item.get("input_type", "number"),
            "unit": item.get("unit", ""),
            "required": item.get("required", True),
            "order": item.get("order", idx),
        }
        if key in existing:
            for f, v in defaults.items():
                setattr(existing[key], f, v)
            existing[key].save()
        else:
            FactoryAnalysisInput.objects.create(definition=instance, key=key, **defaults)
    for key in set(existing.keys()) - seen:
        existing[key].delete()


def _sync_factory_outputs(instance, items):
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
            FactoryAnalysisOutput.objects.create(definition=instance, key=key, **defaults)
    for key in set(existing.keys()) - seen:
        existing[key].delete()

# ═══════════════════ تناژ تحویلی خطوط تولید (تعریف‌محور) ═══════════════════


class DeliveredTonnageInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveredTonnageInput
        fields = ["id", "key", "name", "input_type", "unit", "required", "order"]


class DeliveredTonnageOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveredTonnageOutput
        fields = ["id", "key", "name", "unit", "formula", "order"]


class DeliveredTonnageDefinitionSerializer(serializers.ModelSerializer):
    inputs = DeliveredTonnageInputSerializer(many=True, read_only=True)
    outputs = DeliveredTonnageOutputSerializer(many=True, read_only=True)

    class Meta:
        model = DeliveredTonnageDefinition
        fields = ["id", "line", "description", "inputs", "outputs", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        instance = DeliveredTonnageDefinition.objects.create(**validated_data)
        _sync_tonnage_nested(instance, self.initial_data)
        return instance

    def update(self, instance, validated_data):
        instance.description = validated_data.get("description", instance.description)
        instance.save()
        _sync_tonnage_nested(instance, self.initial_data)
        return instance


def _sync_tonnage_nested(instance, data):
    if data.get("inputs") is not None:
        _sync_tonnage_inputs(instance, data["inputs"])
    if data.get("outputs") is not None:
        _sync_tonnage_outputs(instance, data["outputs"])
    instance.full_clean()


def _sync_tonnage_inputs(instance, items):
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
        defaults = {
            "name": item.get("name", key),
            "input_type": item.get("input_type", "number"),
            "unit": item.get("unit", ""),
            "required": item.get("required", True),
            "order": item.get("order", idx),
        }
        if key in existing:
            for f, v in defaults.items():
                setattr(existing[key], f, v)
            existing[key].save()
        else:
            DeliveredTonnageInput.objects.create(definition=instance, key=key, **defaults)
    for key in set(existing.keys()) - seen:
        existing[key].delete()


def _sync_tonnage_outputs(instance, items):
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
            DeliveredTonnageOutput.objects.create(definition=instance, key=key, **defaults)
    for key in set(existing.keys()) - seen:
        existing[key].delete()


class DeliveredTonnageSerializer(serializers.ModelSerializer):
    line = ProductionLineMinSerializer(read_only=True)
    contractor = ContractorSerializer(read_only=True)
    date_jalali = serializers.SerializerMethodField()

    class Meta:
        model = DeliveredTonnage
        fields = [
            "id",
            "line",
            "contractor",
            "date",
            "date_jalali",
            "hour",
            "inputs",
            "outputs",
            "note",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["created_by", "created_at", "outputs"]

    def get_date_jalali(self, obj):
        return jalali_and_weekday(obj.date)["date_jalali"]


class DeliveredTonnageWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveredTonnage
        fields = [
            "line",
            "contractor",
            "date",
            "hour",
            "inputs",
            "note",
        ]


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

    class Meta:
        model = FactoryTabRecord
        fields = [
            "id", "tab", "line", "contractor",
            "date_from", "date_to", "date_from_jalali", "date_to_jalali",
            "hour", "inputs", "outputs", "note", "created_by", "created_at",
        ]
        read_only_fields = ["created_by", "created_at", "outputs"]

    def get_date_from_jalali(self, obj):
        return jalali_and_weekday(obj.date_from)["date_jalali"]

    def get_date_to_jalali(self, obj):
        return jalali_and_weekday(obj.date_to)["date_jalali"]


class FactoryTabRecordWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactoryTabRecord
        fields = ["tab", "line", "contractor", "date_from", "date_to", "hour", "inputs", "note"]


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
