import django_filters
from .models import (
    DeviceDailyAnalysis,
    DeviceLog,
    ProductionReport,
    ActualAnalysis,
    DeliveredTonnage,
)


class DailyAnalysisFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    devices = django_filters.BaseInFilter(field_name="device", lookup_expr="in")

    class Meta:
        model = DeviceDailyAnalysis
        fields = ["device", "devices", "shift", "date"]


class DeviceLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    lines = django_filters.BaseInFilter(field_name="line", lookup_expr="in")

    class Meta:
        model = DeviceLog
        fields = ["line", "lines", "shift", "device", "failure_cause", "date"]


class ProductionReportFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date_from", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date_to", lookup_expr="lte")
    lines = django_filters.BaseInFilter(field_name="line", lookup_expr="in")

    class Meta:
        model = ProductionReport
        fields = ["line", "lines", "contractor"]


class ActualAnalysisFilter(django_filters.FilterSet):
    lines = django_filters.BaseInFilter(field_name="line", lookup_expr="in")
    date_from = django_filters.DateFilter(method="filter_overlap_start")
    date_to = django_filters.DateFilter(method="filter_overlap_end")

    class Meta:
        model = ActualAnalysis
        fields = ["line", "lines", "contractor"]

    def filter_overlap_start(self, queryset, name, value):
        """رکوردهایی که بازه‌شان با تاریخ شروع درخواست هم‌پوشانی دارد."""
        if value is None:
            return queryset
        return queryset.filter(date_to__gte=value)

    def filter_overlap_end(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(date_from__lte=value)


class DeliveredTonnageFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    lines = django_filters.BaseInFilter(field_name="line", lookup_expr="in")

    class Meta:
        model = DeliveredTonnage
        fields = ["line", "lines", "contractor", "date"]
