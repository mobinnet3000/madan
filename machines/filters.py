import django_filters
from .models import DeviceDailyAnalysis, DeviceLog

class DailyAnalysisFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name="date", lookup_expr='lte')
    devices = django_filters.BaseInFilter(field_name='device', lookup_expr='in')

    class Meta:
        model = DeviceDailyAnalysis
        fields = ['device', 'devices', 'shift', 'date']

class DeviceLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name="date", lookup_expr='lte')
    lines = django_filters.BaseInFilter(field_name='line', lookup_expr='in')

    class Meta:
        model = DeviceLog
        fields = ['line', 'lines', 'shift', 'device', 'failure_cause', 'date']
