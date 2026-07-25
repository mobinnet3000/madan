import io
from django.http import FileResponse, Http404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import DeviceDailyAnalysis, DeviceLog, Factory
from .serializers import (
    DeviceDailyAnalysisSerializer,
    DeviceDailyAnalysisWriteSerializer,
    DeviceLogSerializer,
    DeviceLogWriteSerializer,
    FactoryFullDetailSerializer,
)
from .filters import DailyAnalysisFilter, DeviceLogFilter
from .reports import generate_performance_report, generate_analysis_report, get_date_range, RANGE_LABELS
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

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return DeviceLogWriteSerializer
        return DeviceLogSerializer

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

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return DeviceDailyAnalysisWriteSerializer
        return DeviceDailyAnalysisSerializer

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_ranges_view(request):
    ranges = {k: v for k, v in RANGE_LABELS.items()}
    return Response(ranges)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def performance_report_view(request):
    # Bypass everything - just generate and return
    from machines.reports import generate_performance_report as gen_report
    range_key = request.query_params.get('range', '30days')
    fmt = request.query_params.get('format', 'pdf').lower()
    factory_id = request.query_params.get('factory_id')

    factory = get_user_factory(request.user)
    if factory and not factory_id:
        factory_id = factory.id
    if factory_id:
        try:
            fac_obj = Factory.objects.get(id=factory_id)
        except Factory.DoesNotExist:
            raise Http404

    from datetime import datetime
    date_from_o = None
    date_to_o = None
    df = request.query_params.get('date_from')
    dt = request.query_params.get('date_to')
    if df:
        try: date_from_o = datetime.strptime(df, '%Y-%m-%d').date()
        except: pass
    if dt:
        try: date_to_o = datetime.strptime(dt, '%Y-%m-%d').date()
        except: pass

    try:
        buf, ext = gen_report(factory_id, range_key, date_from_o, date_to_o, fmt=fmt)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

    ctype = 'application/pdf' if fmt == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    fname = f'report_{factory_id or "all"}_{range_key}.{fmt}'
    return FileResponse(buf, as_attachment=True, filename=fname, content_type=ctype)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analysis_report_view(request):
    from machines.reports import generate_analysis_report as gen_report
    range_key = request.query_params.get('range', '30days')
    fmt = request.query_params.get('format', 'pdf').lower()
    factory_id = request.query_params.get('factory_id')

    factory = get_user_factory(request.user)
    if factory and not factory_id:
        factory_id = factory.id
    if factory_id:
        try:
            fac_obj = Factory.objects.get(id=factory_id)
        except Factory.DoesNotExist:
            raise Http404

    from datetime import datetime
    date_from_o = None
    date_to_o = None
    df = request.query_params.get('date_from')
    dt = request.query_params.get('date_to')
    if df:
        try: date_from_o = datetime.strptime(df, '%Y-%m-%d').date()
        except: pass
    if dt:
        try: date_to_o = datetime.strptime(dt, '%Y-%m-%d').date()
        except: pass

    buf, ext = gen_report(factory_id, range_key, date_from_o, date_to_o, fmt=fmt)
    ctype = 'application/pdf' if fmt == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    fname = f'report_{factory_id or "all"}_{range_key}.{fmt}'
    return FileResponse(buf, as_attachment=True, filename=fname, content_type=ctype)
