import django_filters
from .models import DeviceDailyAnalysis, DeviceLog

class DailyAnalysisFilter(django_filters.FilterSet):
    # فیلتر بازه زمانی
    date_from = django_filters.DateFilter(field_name="date", lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name="date", lookup_expr='lte')

    class Meta:
        model = DeviceDailyAnalysis
        fields = ['device', 'shift', 'date']

class DeviceLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name="date", lookup_expr='lte')

    class Meta:
        model = DeviceLog
        fields = ['line', 'shift', 'device', 'failure_cause', 'date']
