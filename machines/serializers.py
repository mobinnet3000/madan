from rest_framework import serializers
from .models import (
    Factory, Shift, FailureReason, ProductionLine,
    Device, DeviceDailyAnalysis, DeviceLog, ProductionReport
)
from .jalali import jalali_and_weekday


def _attr_defs(queryset):
    """تبدیل ویژگی‌های الگو (نام + واحد) به لیست serillizable."""
    return [{'name': a.name, 'unit': a.unit or ''} for a in queryset]


class FailureReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = FailureReason
        fields = '__all__'


class ShiftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shift
        fields = ['id', 'name', 'start_time', 'end_time', 'is_active']


class DeviceSerializer(serializers.ModelSerializer):
    template_name = serializers.ReadOnlyField(source='template.name')
    attribute_defs = serializers.SerializerMethodField()

    class Meta:
        model = Device
        fields = ['id', 'name', 'code', 'order', 'template_name', 'attributes_values', 'attribute_defs', 'is_analyzer', 'image']

    def get_attribute_defs(self, obj):
        return _attr_defs(obj.template.available_attributes.all()) if obj.template_id else []


class ProductionLineSerializer(serializers.ModelSerializer):
    devices = DeviceSerializer(many=True, read_only=True)
    template_name = serializers.ReadOnlyField(source='template.name')
    attribute_defs = serializers.SerializerMethodField()

    class Meta:
        model = ProductionLine
        fields = ['id', 'name', 'description', 'line_type', 'template_name', 'attributes_values', 'attribute_defs', 'devices']

    def get_attribute_defs(self, obj):
        return _attr_defs(obj.template.available_attributes.all()) if obj.template_id else []


class FactoryFullDetailSerializer(serializers.ModelSerializer):
    shifts = ShiftSerializer(many=True, read_only=True)
    lines = ProductionLineSerializer(many=True, read_only=True)
    failure_reasons = serializers.SerializerMethodField()

    class Meta:
        model = Factory
        fields = ['id', 'name', 'address', 'shifts', 'lines', 'failure_reasons']

    def get_failure_reasons(self, obj):
        return FailureReasonSerializer(FailureReason.objects.all(), many=True).data

class DeviceDailyAnalysisSerializer(serializers.ModelSerializer):
    device = DeviceSerializer(read_only=True)
    shift = ShiftSerializer(read_only=True)
    sample_point_display = serializers.SerializerMethodField()
    date_jalali = serializers.SerializerMethodField()
    day_of_week = serializers.SerializerMethodField()

    class Meta:
        model = DeviceDailyAnalysis
        fields = ['id', 'device', 'sample_point', 'sample_point_display',
                  'shift', 'date', 'date_jalali', 'day_of_week', 'analysis_text', 'value_1', 'value_2', 'created_at']
        read_only_fields = ['created_at']

    def get_sample_point_display(self, obj):
        return obj.get_sample_point_display() if obj.sample_point else None

    def get_date_jalali(self, obj):
        return jalali_and_weekday(obj.date)['date_jalali']

    def get_day_of_week(self, obj):
        return jalali_and_weekday(obj.date)['day_of_week']


class DeviceDailyAnalysisWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceDailyAnalysis
        fields = ['device', 'sample_point', 'shift', 'date', 'analysis_text', 'value_1', 'value_2']


class FactoryMinSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factory
        fields = ['id', 'name']


class ProductionLineMinSerializer(serializers.ModelSerializer):
    factory = FactoryMinSerializer(read_only=True)

    class Meta:
        model = ProductionLine
        fields = ['id', 'name', 'factory']


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
            'id', 'line', 'shift', 'date', 'date_jalali', 'day_of_week', 'device', 'failure_cause',
            'runtime_hours', 'downtime_hours', 'failure_description', 'repair_description',
            'feed_tonnage', 'product_tonnage', 'tailing_tonnage', 'efficiency', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_date_jalali(self, obj):
        return jalali_and_weekday(obj.date)['date_jalali']

    def get_day_of_week(self, obj):
        return jalali_and_weekday(obj.date)['day_of_week']


class DeviceLogWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceLog
        fields = [
            'line', 'shift', 'date', 'device', 'failure_cause',
            'runtime_hours', 'downtime_hours', 'failure_description', 'repair_description',
            'feed_tonnage', 'product_tonnage', 'tailing_tonnage',
        ]


class ProductionReportSerializer(serializers.ModelSerializer):
    efficiency = serializers.ReadOnlyField()
    line = ProductionLineMinSerializer(read_only=True)
    date_from_jalali = serializers.SerializerMethodField()
    date_to_jalali = serializers.SerializerMethodField()

    class Meta:
        model = ProductionReport
        fields = [
            'id', 'line', 'date_from', 'date_to', 'date_from_jalali', 'date_to_jalali',
            'feed_tonnage', 'product_tonnage', 'tailing_tonnage', 'efficiency', 'note', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_date_from_jalali(self, obj):
        return jalali_and_weekday(obj.date_from)['date_jalali']

    def get_date_to_jalali(self, obj):
        return jalali_and_weekday(obj.date_to)['date_jalali']


class ProductionReportWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionReport
        fields = [
            'line', 'date_from', 'date_to', 'feed_tonnage',
            'product_tonnage', 'tailing_tonnage', 'note',
        ]
