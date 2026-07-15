from rest_framework import serializers

from .models import (
    Factory, Shift, FailureReason, ProductionLine, 
    ProductionLineAttribute, Device, Attribute, DeviceTemplate , DeviceDailyAnalysis, DeviceLog
)

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
    
    class Meta:
        model = Device
        fields = ['id', 'name', 'order', 'template_name', 'attributes_values', 'is_analyzer', 'image']

class ProductionLineSerializer(serializers.ModelSerializer):
    devices = DeviceSerializer(many=True, read_only=True)
    template_name = serializers.ReadOnlyField(source='template.name')

    class Meta:
        model = ProductionLine
        fields = ['id', 'name', 'description', 'line_type', 'template_name', 'attributes_values', 'devices']

class FactoryFullDetailSerializer(serializers.ModelSerializer):
    # اتصال شیفت‌ها و خطوط تولید به صورت تو در تو
    shifts = ShiftSerializer(many=True, read_only=True)
    lines = ProductionLineSerializer(many=True, read_only=True)
    
    # فیلد اضافی برای ارسال لیست خرابی‌ها (چون عمومی هستند)
    failure_reasons = serializers.SerializerMethodField()

    class Meta:
        model = Factory
        fields = ['id', 'name', 'address', 'shifts', 'lines', 'failure_reasons']

    def get_failure_reasons(self, obj):
        reasons = FailureReason.objects.all()
        return FailureReasonSerializer(reasons, many=True).data



class DeviceDailyAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceDailyAnalysis
        fields = '__all__'
        read_only_fields = ['created_at']
        depth = 1

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
    efficiency = serializers.FloatField(read_only=True)
    line = ProductionLineMinSerializer(read_only=True)
    shift = ShiftSerializer(read_only=True)
    device = DeviceSerializer(read_only=True)
    failure_cause = FailureReasonSerializer(read_only=True)

    class Meta:
        model = DeviceLog
        fields = '__all__'
        read_only_fields = ['created_at', 'efficiency']
