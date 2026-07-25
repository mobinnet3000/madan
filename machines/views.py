from rest_framework import viewsets, permissions

from .models import DeviceDailyAnalysis, DeviceLog, Factory
from .serializers import (
    DeviceDailyAnalysisSerializer,
    DeviceLogSerializer,
    FactoryFullDetailSerializer,
)
from .filters import DailyAnalysisFilter, DeviceLogFilter
from accounts.services import get_user_factory, log_activity
from core.pagination import StandardPagination


class FactoryDetailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FactoryFullDetailSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Factory.objects.all().prefetch_related(
            'shifts', 'lines__devices', 'lines__template'
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(id=factory.id)
        return qs


class DeviceLogViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceLogSerializer
    filterset_class = DeviceLogFilter
    pagination_class = StandardPagination
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = DeviceLog.objects.all().select_related('line__factory', 'shift', 'device', 'failure_cause')
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, 'create', 'گزارش عملکرد',
                     f"{obj.line.name} - {obj.date}", self.request,
                     factory=obj.line.factory)

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, 'update', 'گزارش عملکرد',
                     f"{obj.line.name} - {obj.date}", self.request,
                     factory=obj.line.factory)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'delete', 'گزارش عملکرد',
                     f"{instance.line.name} - {instance.date}", self.request,
                     factory=instance.line.factory)
        instance.delete()


class DeviceDailyAnalysisViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceDailyAnalysisSerializer
    filterset_class = DailyAnalysisFilter
    pagination_class = StandardPagination
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = DeviceDailyAnalysis.objects.all().select_related('device__line__factory', 'shift')
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(device__line__factory=factory)
        return qs

    def _get_factory_for(self, obj):
        return obj.device.line.factory if obj.device and hasattr(obj.device, 'line') else None

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, 'create', 'آنالیز روزانه',
                     f"{obj.device.name} - {obj.date}", self.request,
                     factory=self._get_factory_for(obj))

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, 'update', 'آنالیز روزانه',
                     f"{obj.device.name} - {obj.date}", self.request,
                     factory=self._get_factory_for(obj))

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'delete', 'آنالیز روزانه',
                     f"{instance.device.name} - {instance.date}", self.request,
                     factory=self._get_factory_for(instance))
        instance.delete()
