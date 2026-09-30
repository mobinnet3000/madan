import django_filters
from .models import DeviceLog, FactoryTabRecord


class DeviceLogFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    lines = django_filters.BaseInFilter(field_name="line", lookup_expr="in")

    class Meta:
        model = DeviceLog
        fields = ["line", "lines", "shift", "device", "failure_cause", "date"]


class FactoryTabRecordFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(method="filter_overlap_start")
    date_to = django_filters.DateFilter(method="filter_overlap_end")
    lines = django_filters.BaseInFilter(field_name="line", lookup_expr="in")

    class Meta:
        model = FactoryTabRecord
        fields = ["tab", "line", "lines", "contractor"]

    def filter_overlap_start(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(date_to__gte=value)

    def filter_overlap_end(self, queryset, name, value):
        if value is None:
            return queryset
        return queryset.filter(date_from__lte=value)
