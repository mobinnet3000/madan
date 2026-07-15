from rest_framework import viewsets, permissions
from rest_framework.response import Response
from django.core.paginator import Paginator
from django_filters.rest_framework import DjangoFilterBackend
from .models import DeviceDailyAnalysis, DeviceLog, Factory
from .serializers import (
    DeviceDailyAnalysisSerializer,
    DeviceLogSerializer,
    FactoryFullDetailSerializer,
)
from .filters import DailyAnalysisFilter, DeviceLogFilter
from accounts.utils import log_activity
from accounts.models import UserProfile


def get_user_factory(request):
    """کارخانه‌ای که کاربر اجازه دسترسی به آن را دارد (برای مدیر/اپراتور)."""
    user = request.user
    if user.is_superuser:
        return None
    profile = getattr(user, 'profile', None)
    if profile and profile.role == 'admin':
        return None
    return profile.factory if profile else None


def maybe_paginate(viewset, queryset):
    page = viewset.request.query_params.get('page')
    page_size = viewset.request.query_params.get('page_size')
    if not page and not page_size:
        return None
    try:
        page_number = int(page or 1)
        size = min(max(int(page_size or 50), 1), 100)
    except ValueError:
        page_number = 1
        size = 50
    paginator = Paginator(queryset, size)
    current = paginator.get_page(page_number)
    return {
        'count': paginator.count,
        'next': current.next_page_number() if current.has_next() else None,
        'previous': current.previous_page_number() if current.has_previous() else None,
        'results': list(current.object_list),
    }


class FactoryDetailViewSet(viewsets.ReadOnlyModelViewSet):
    """
    تمام اطلاعات یک کارخانه شامل خطوط، دستگاه‌ها، شیفت‌ها و علل خرابی.
    مدیر/اپراتور فقط کارخانه خودشان را می‌بینند.
    """
    serializer_class = FactoryFullDetailSerializer

    def get_queryset(self):
        qs = Factory.objects.all().prefetch_related(
            'shifts', 'lines__devices', 'lines__template'
        )
        factory = get_user_factory(self.request)
        if factory is not None:
            qs = qs.filter(id=factory.id)
        return qs


class DeviceLogViewSet(viewsets.ModelViewSet):
    queryset = DeviceLog.objects.all()
    serializer_class = DeviceLogSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = DeviceLogFilter
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = maybe_paginate(self, queryset)
        if page is None:
            return Response(self.get_serializer(queryset, many=True).data)
        return Response({
            **page,
            'results': self.get_serializer(page['results'], many=True).data,
        })

    def get_queryset(self):
        qs = DeviceLog.objects.all().select_related('line', 'shift', 'device', 'failure_cause')
        factory = get_user_factory(self.request)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        return qs

    def _factory(self, obj):
        return obj.line.factory if obj.line else None

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user, 'create', 'گزارش عملکرد',
            f"{obj.line.name} - {obj.date}", self.request,
            factory=self._factory(obj),
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user, 'update', 'گزارش عملکرد',
            f"{obj.line.name} - {obj.date}", self.request,
            factory=self._factory(obj),
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user, 'delete', 'گزارش عملکرد',
            f"{instance.line.name} - {instance.date}", self.request,
            factory=self._factory(instance),
        )
        instance.delete()


class DeviceDailyAnalysisViewSet(viewsets.ModelViewSet):
    queryset = DeviceDailyAnalysis.objects.all()
    serializer_class = DeviceDailyAnalysisSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = DailyAnalysisFilter
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = maybe_paginate(self, queryset)
        if page is None:
            return Response(self.get_serializer(queryset, many=True).data)
        return Response({
            **page,
            'results': self.get_serializer(page['results'], many=True).data,
        })

    def get_queryset(self):
        qs = DeviceDailyAnalysis.objects.all().select_related('device', 'shift')
        factory = get_user_factory(self.request)
        if factory is not None:
            qs = qs.filter(device__line__factory=factory)
        return qs

    def _factory(self, obj):
        return obj.device.line.factory if obj.device and obj.device.line else None

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user, 'create', 'آنالیز روزانه',
            f"{obj.device.name} - {obj.date}", self.request,
            factory=self._factory(obj),
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user, 'update', 'آنالیز روزانه',
            f"{obj.device.name} - {obj.date}", self.request,
            factory=self._factory(obj),
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user, 'delete', 'آنالیز روزانه',
            f"{instance.device.name} - {instance.date}", self.request,
            factory=self._factory(instance),
        )
        instance.delete()
