from rest_framework import serializers
from .models import (
    Factory,
    Shift,
    FailureReason,
    ProductionLine,
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


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = ["id", "name", "start_time", "end_time", "is_active"]


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
    shifts = ShiftSerializer(many=True, read_only=True)
    lines = ProductionLineSerializer(many=True, read_only=True)
    failure_reasons = serializers.SerializerMethodField()
    contractors = ContractorSerializer(many=True, read_only=True)
    factory_analysis_definition = FactoryAnalysisDefinitionBriefSerializer(
        read_only=True
    )

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
        ]

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
