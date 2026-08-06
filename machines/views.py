import io
from django.http import FileResponse, Http404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.http import FileResponse, Http404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import DeviceDailyAnalysis, DeviceLog, Factory, Device, ProductionLine, ProductionReport
from .serializers import (
    DeviceDailyAnalysisSerializer,
    DeviceDailyAnalysisWriteSerializer,
    DeviceLogSerializer,
    DeviceLogWriteSerializer,
    FactoryFullDetailSerializer,
    ProductionReportSerializer,
    ProductionReportWriteSerializer,
)
from .filters import DailyAnalysisFilter, DeviceLogFilter, ProductionReportFilter
from .reports import generate_performance_report, generate_analysis_report, get_date_range, RANGE_LABELS
from accounts.services import get_user_factory, log_activity
from accounts.permissions import HasPermission, require_permission, user_has_permission
from core.pagination import StandardPagination


class FactoryDetailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FactoryFullDetailSerializer
    pagination_class = None
    required_permission = 'factory.view'
    permission_classes = [permissions.IsAuthenticated, HasPermission]

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
    required_permission = 'logs.view'
    action_permissions = {
        'create': 'logs.create',
        'update': 'logs.edit',
        'partial_update': 'logs.edit',
        'destroy': 'logs.delete',
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

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
    required_permission = 'analysis.view'
    action_permissions = {
        'create': 'analysis.create',
        'update': 'analysis.edit',
        'partial_update': 'analysis.edit',
        'destroy': 'analysis.delete',
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

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


class ProductionReportViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionReportSerializer
    filterset_class = ProductionReportFilter
    pagination_class = StandardPagination
    required_permission = 'production.view'
    action_permissions = {
        'create': 'production.create',
        'update': 'production.edit',
        'partial_update': 'production.edit',
        'destroy': 'production.delete',
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ProductionReportWriteSerializer
        return ProductionReportSerializer

    def get_queryset(self):
        qs = ProductionReport.objects.all().select_related('line__factory')
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, 'create', 'گزارش تولید',
                     f"{obj.line.name} - {obj.date_from} تا {obj.date_to}", self.request,
                     factory=obj.line.factory)

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, 'update', 'گزارش تولید',
                     f"{obj.line.name} - {obj.date_from} تا {obj.date_to}", self.request,
                     factory=obj.line.factory)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'delete', 'گزارش تولید',
                     f"{instance.line.name} - {instance.date_from}", self.request,
                     factory=instance.line.factory)
        instance.delete()


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@require_permission('lines.view')
def line_attributes_view(request, uid):
    if request.method == 'PATCH' and not user_has_permission(request.user, 'lines.manage'):
        return Response({'detail': 'شما اجازه‌ی ویرایش ویژگی‌ها را ندارید.'}, status=403)
    try:
        line = ProductionLine.objects.select_related('template').get(pk=uid)
    except ProductionLine.DoesNotExist:
        raise Http404
    factory = get_user_factory(request.user)
    if factory is not None and line.factory_id != factory.id:
        raise Http404

    if request.method == 'GET':
        defs = [{'name': a.name, 'unit': a.unit or ''} for a in line.template.available_attributes.all()] if line.template_id else []
        return Response({'id': line.id, 'attributes_values': line.attributes_values or {}, 'attribute_defs': defs})

    values = request.data.get('attributes_values')
    if not isinstance(values, dict):
        return Response({'error': 'attributes_values باید یک شیء باشد.'}, status=status.HTTP_400_BAD_REQUEST)
    line.attributes_values = values
    line.save()
    log_activity(request.user, 'update', 'خط تولید', line.name, request, 'ویرایش مقادیر ویژگی‌های فنی', factory=line.factory)
    return Response({'ok': True, 'attributes_values': line.attributes_values})


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
@require_permission('devices.view')
def device_attributes_view(request, uid):
    if request.method == 'PATCH' and not user_has_permission(request.user, 'devices.manage'):
        return Response({'detail': 'شما اجازه‌ی ویرایش ویژگی‌ها را ندارید.'}, status=403)
    try:
        device = Device.objects.select_related('template', 'line').get(pk=uid)
    except Device.DoesNotExist:
        raise Http404
    factory = get_user_factory(request.user)
    if factory is not None and device.line.factory_id != factory.id:
        raise Http404

    if request.method == 'GET':
        defs = [{'name': a.name, 'unit': a.unit or ''} for a in device.template.available_attributes.all()] if device.template_id else []
        return Response({'id': device.id, 'name': device.name, 'code': device.code,
                         'attributes_values': device.attributes_values or {}, 'attribute_defs': defs})

    values = request.data.get('attributes_values')
    if not isinstance(values, dict):
        return Response({'error': 'attributes_values باید یک شیء باشد.'}, status=status.HTTP_400_BAD_REQUEST)
    device.attributes_values = values
    device.save()
    log_activity(request.user, 'update', 'دستگاه', device.name, request, 'ویرایش مقادیر ویژگی‌های فنی', factory=device.line.factory)
    return Response({'ok': True, 'attributes_values': device.attributes_values})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('reports.view')
def report_ranges_view(request):
    ranges = {k: v for k, v in RANGE_LABELS.items()}
    return Response(ranges)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('reports.view')
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
@require_permission('reports.view')
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
