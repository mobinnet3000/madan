from django.http import FileResponse, Http404
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    DeviceDailyAnalysis,
    DeviceLog,
    Factory,
    Device,
    ProductionLine,
    ProductionReport,
    Contractor,
    AnalysisTypeDefinition,
    AnalysisPosition,
    AdditionalInputDefinition,
    AnalysisOutputDefinition,
    ActualAnalysis,
    Shift,
)
from .serializers import (
    DeviceDailyAnalysisSerializer,
    DeviceDailyAnalysisWriteSerializer,
    DeviceLogSerializer,
    DeviceLogWriteSerializer,
    FactoryFullDetailSerializer,
    ProductionReportSerializer,
    ProductionReportWriteSerializer,
    ContractorSerializer,
    AnalysisTypeDefinitionSerializer,
    AnalysisPositionSerializer,
    AdditionalInputDefinitionSerializer,
    AnalysisOutputDefinitionSerializer,
    LineAnalysisDefinitionSerializer,
    ActualAnalysisSerializer,
)
from .filters import (
    DailyAnalysisFilter,
    DeviceLogFilter,
    ProductionReportFilter,
    ActualAnalysisFilter,
)
from .reports import RANGE_LABELS
from .analysis import build_schema, validate_and_compute, validate_formula_for_line
from accounts.services import get_user_factory, log_activity
from accounts.permissions import HasPermission, require_permission, user_has_permission
from core.pagination import StandardPagination


class FactoryDetailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FactoryFullDetailSerializer
    pagination_class = None
    required_permission = "factory.view"
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_queryset(self):
        qs = Factory.objects.all().prefetch_related(
            "shifts",
            "contractors",
            "lines__template",
            "lines__devices__template",
            "lines__devices__template__available_attributes",
            "lines__analysis_positions__definition__inputs",
            "lines__analysis_definition__additional_inputs",
            "lines__analysis_definition__outputs",
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(id=factory.id)
        return qs


class DeviceLogViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceLogSerializer
    filterset_class = DeviceLogFilter
    pagination_class = StandardPagination
    required_permission = "logs.view"
    action_permissions = {
        "create": "logs.create",
        "update": "logs.edit",
        "partial_update": "logs.edit",
        "destroy": "logs.delete",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return DeviceLogWriteSerializer
        return DeviceLogSerializer

    def get_queryset(self):
        qs = DeviceLog.objects.all().select_related(
            "line__factory", "shift", "device", "failure_cause"
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user,
            "create",
            "گزارش عملکرد",
            f"{obj.line.name} - {obj.date}",
            self.request,
            factory=obj.line.factory,
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user,
            "update",
            "گزارش عملکرد",
            f"{obj.line.name} - {obj.date}",
            self.request,
            factory=obj.line.factory,
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user,
            "delete",
            "گزارش عملکرد",
            f"{instance.line.name} - {instance.date}",
            self.request,
            factory=instance.line.factory,
        )
        instance.delete()


class DeviceDailyAnalysisViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceDailyAnalysisSerializer
    filterset_class = DailyAnalysisFilter
    pagination_class = StandardPagination
    required_permission = "analysis.view"
    action_permissions = {
        "create": "analysis.create",
        "update": "analysis.edit",
        "partial_update": "analysis.edit",
        "destroy": "analysis.delete",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return DeviceDailyAnalysisWriteSerializer
        return DeviceDailyAnalysisSerializer

    def get_queryset(self):
        qs = DeviceDailyAnalysis.objects.all().select_related(
            "device__line__factory", "shift"
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(device__line__factory=factory)
        return qs

    def _get_factory_for(self, obj):
        return (
            obj.device.line.factory
            if obj.device and hasattr(obj.device, "line")
            else None
        )

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user,
            "create",
            "آنالیز روزانه",
            f"{obj.device.name} - {obj.date}",
            self.request,
            factory=self._get_factory_for(obj),
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user,
            "update",
            "آنالیز روزانه",
            f"{obj.device.name} - {obj.date}",
            self.request,
            factory=self._get_factory_for(obj),
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user,
            "delete",
            "آنالیز روزانه",
            f"{instance.device.name} - {instance.date}",
            self.request,
            factory=self._get_factory_for(instance),
        )
        instance.delete()


class ProductionReportViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionReportSerializer
    filterset_class = ProductionReportFilter
    pagination_class = StandardPagination
    required_permission = "production.view"
    action_permissions = {
        "create": "production.create",
        "update": "production.edit",
        "partial_update": "production.edit",
        "destroy": "production.delete",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ProductionReportWriteSerializer
        return ProductionReportSerializer

    def get_queryset(self):
        qs = ProductionReport.objects.all().select_related("line__factory")
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user,
            "create",
            "گزارش تولید",
            f"{obj.line.name} - {obj.date_from} تا {obj.date_to}",
            self.request,
            factory=obj.line.factory,
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user,
            "update",
            "گزارش تولید",
            f"{obj.line.name} - {obj.date_from} تا {obj.date_to}",
            self.request,
            factory=obj.line.factory,
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user,
            "delete",
            "گزارش تولید",
            f"{instance.line.name} - {instance.date_from}",
            self.request,
            factory=instance.line.factory,
        )
        instance.delete()


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@require_permission("lines.view")
def line_attributes_view(request, uid):
    if request.method == "PATCH" and not user_has_permission(
        request.user, "lines.manage"
    ):
        return Response(
            {"detail": "شما اجازه‌ی ویرایش ویژگی‌ها را ندارید."}, status=403
        )
    try:
        line = ProductionLine.objects.select_related("template").get(pk=uid)
    except ProductionLine.DoesNotExist:
        raise Http404
    factory = get_user_factory(request.user)
    if factory is not None and line.factory_id != factory.id:
        raise Http404

    if request.method == "GET":
        defs = (
            [
                {"name": a.name, "unit": a.unit or ""}
                for a in line.template.available_attributes.all()
            ]
            if line.template_id
            else []
        )
        return Response(
            {
                "id": line.id,
                "attributes_values": line.attributes_values or {},
                "attribute_defs": defs,
            }
        )

    values = request.data.get("attributes_values")
    if not isinstance(values, dict):
        return Response(
            {"error": "attributes_values باید یک شیء باشد."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    line.attributes_values = values
    line.save()
    log_activity(
        request.user,
        "update",
        "خط تولید",
        line.name,
        request,
        "ویرایش مقادیر ویژگی‌های فنی",
        factory=line.factory,
    )
    return Response({"ok": True, "attributes_values": line.attributes_values})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@require_permission("devices.view")
def device_attributes_view(request, uid):
    if request.method == "PATCH" and not user_has_permission(
        request.user, "devices.manage"
    ):
        return Response(
            {"detail": "شما اجازه‌ی ویرایش ویژگی‌ها را ندارید."}, status=403
        )
    try:
        device = Device.objects.select_related("template", "line").get(pk=uid)
    except Device.DoesNotExist:
        raise Http404
    factory = get_user_factory(request.user)
    if factory is not None and device.line.factory_id != factory.id:
        raise Http404

    if request.method == "GET":
        defs = (
            [
                {"name": a.name, "unit": a.unit or ""}
                for a in device.template.available_attributes.all()
            ]
            if device.template_id
            else []
        )
        return Response(
            {
                "id": device.id,
                "name": device.name,
                "code": device.code,
                "attributes_values": device.attributes_values or {},
                "attribute_defs": defs,
            }
        )

    values = request.data.get("attributes_values")
    if not isinstance(values, dict):
        return Response(
            {"error": "attributes_values باید یک شیء باشد."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    device.attributes_values = values
    device.save()
    log_activity(
        request.user,
        "update",
        "دستگاه",
        device.name,
        request,
        "ویرایش مقادیر ویژگی‌های فنی",
        factory=device.line.factory,
    )
    return Response({"ok": True, "attributes_values": device.attributes_values})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("reports.view")
def report_ranges_view(request):
    ranges = {k: v for k, v in RANGE_LABELS.items()}
    return Response(ranges)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("reports.view")
def performance_report_view(request):
    # Bypass everything - just generate and return
    from machines.reports import generate_performance_report as gen_report

    range_key = request.query_params.get("range", "30days")
    fmt = request.query_params.get("format", "pdf").lower()
    factory_id = request.query_params.get("factory_id")

    factory = get_user_factory(request.user)
    if factory and not factory_id:
        factory_id = factory.id
    if factory_id:
        if not Factory.objects.filter(id=factory_id).exists():
            raise Http404

    from datetime import datetime

    date_from_o = None
    date_to_o = None
    df = request.query_params.get("date_from")
    dt = request.query_params.get("date_to")
    if df:
        try:
            date_from_o = datetime.strptime(df, "%Y-%m-%d").date()
        except:
            pass
    if dt:
        try:
            date_to_o = datetime.strptime(dt, "%Y-%m-%d").date()
        except:
            pass

    try:
        buf, ext = gen_report(factory_id, range_key, date_from_o, date_to_o, fmt=fmt)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

    ctype = (
        "application/pdf"
        if fmt == "pdf"
        else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    fname = f'report_{factory_id or "all"}_{range_key}.{fmt}'
    return FileResponse(buf, as_attachment=True, filename=fname, content_type=ctype)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("reports.view")
def analysis_report_view(request):
    from machines.reports import generate_analysis_report as gen_report

    range_key = request.query_params.get("range", "30days")
    fmt = request.query_params.get("format", "pdf").lower()
    factory_id = request.query_params.get("factory_id")

    factory = get_user_factory(request.user)
    if factory and not factory_id:
        factory_id = factory.id
    if factory_id:
        if not Factory.objects.filter(id=factory_id).exists():
            raise Http404

    from datetime import datetime

    date_from_o = None
    date_to_o = None
    df = request.query_params.get("date_from")
    dt = request.query_params.get("date_to")
    if df:
        try:
            date_from_o = datetime.strptime(df, "%Y-%m-%d").date()
        except:
            pass
    if dt:
        try:
            date_to_o = datetime.strptime(dt, "%Y-%m-%d").date()
        except:
            pass

    buf, ext = gen_report(factory_id, range_key, date_from_o, date_to_o, fmt=fmt)
    ctype = (
        "application/pdf"
        if fmt == "pdf"
        else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    fname = f'report_{factory_id or "all"}_{range_key}.{fmt}'
    return FileResponse(buf, as_attachment=True, filename=fname, content_type=ctype)


# ═══════════════════ سیستم آنالیز داینامیک (تعریف‌محور) ═══════════════════


def _get_scoped_line(request, line_id):
    try:
        line = ProductionLine.objects.get(pk=line_id)
    except ProductionLine.DoesNotExist:
        raise Http404
    factory = get_user_factory(request.user)
    if factory is not None and line.factory_id != factory.id:
        raise Http404
    return line


def _get_scoped_line_definition(request, line_id, create=False):
    line = _get_scoped_line(request, line_id)
    line_def = getattr(line, "analysis_definition", None)
    if line_def is None and not create:
        raise Http404
    return line, line_def


def _error(msg, code=status.HTTP_400_BAD_REQUEST):
    return Response({"errors": {"detail": str(msg)}}, status=code)


class ContractorViewSet(viewsets.ModelViewSet):
    serializer_class = ContractorSerializer
    pagination_class = None
    required_permission = "factory.view"
    action_permissions = {
        "create": "contractor.manage",
        "update": "contractor.manage",
        "partial_update": "contractor.manage",
        "destroy": "contractor.manage",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_queryset(self):
        qs = Contractor.objects.select_related("factory")
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(factory=factory)
        factory_q = self.request.query_params.get("factory")
        if factory_q:
            qs = qs.filter(factory_id=factory_q)
        return qs.order_by("name")

    def perform_create(self, serializer):
        factory = get_user_factory(self.request.user)
        if factory is not None:
            serializer.save(factory=factory)
        else:
            serializer.save()
        log_activity(
            self.request.user,
            "create",
            "پیمانکار",
            serializer.instance.name,
            self.request,
            factory=serializer.instance.factory,
        )

    def perform_update(self, serializer):
        factory = get_user_factory(self.request.user)
        if factory is not None:
            serializer.save(factory=factory)
        else:
            serializer.save()
        log_activity(
            self.request.user,
            "update",
            "پیمانکار",
            serializer.instance.name,
            self.request,
            factory=serializer.instance.factory,
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user,
            "delete",
            "پیمانکار",
            instance.name,
            self.request,
            factory=instance.factory,
        )
        instance.delete()


class AnalysisTypeDefinitionViewSet(viewsets.ModelViewSet):
    serializer_class = AnalysisTypeDefinitionSerializer
    pagination_class = StandardPagination
    required_permission = "analysis.view"
    action_permissions = {
        "create": "analysis.manage",
        "update": "analysis.manage",
        "partial_update": "analysis.manage",
        "destroy": "analysis.manage",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_queryset(self):
        return AnalysisTypeDefinition.objects.all().prefetch_related("inputs")

    def perform_create(self, serializer):
        serializer.save()
        log_activity(
            self.request.user,
            "create",
            "تعریف نوع آنالیز",
            serializer.instance.name,
            self.request,
        )

    def perform_update(self, serializer):
        serializer.save()
        log_activity(
            self.request.user,
            "update",
            "تعریف نوع آنالیز",
            serializer.instance.name,
            self.request,
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user, "delete", "تعریف نوع آنالیز", instance.name, self.request
        )
        instance.delete()


class ActualAnalysisViewSet(viewsets.ModelViewSet):
    serializer_class = ActualAnalysisSerializer
    filterset_class = ActualAnalysisFilter
    pagination_class = StandardPagination
    required_permission = "analysis.view"
    action_permissions = {
        "create": "analysis.create",
        "update": "analysis.edit",
        "partial_update": "analysis.edit",
        "destroy": "analysis.delete",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_queryset(self):
        qs = ActualAnalysis.objects.select_related(
            "line__factory", "contractor", "shift"
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        return qs

    def _make_actual(self, request):
        """پردازش Payload و محاسبه‌ی خروجی‌ها؛ خروجی: (line, contractor, date_from, date_to, shift, inputs, outputs)."""
        data = request.data
        line_id = data.get("line_id") or (
            data.get("line", {}).get("id")
            if isinstance(data.get("line"), dict)
            else None
        )
        if not line_id:
            raise ValueError("خط تولید (line_id) الزامی است.")
        line = _get_scoped_line(request, line_id)

        date_from, date_to = self._resolve_dates(data)
        if date_to < date_from:
            raise ValueError("تاریخ پایان بازه نمی‌تواند قبل از تاریخ شروع باشد.")

        contractor = None
        contractor_id = data.get("contractor_id")
        if contractor_id:
            contractor = Contractor.objects.filter(
                pk=contractor_id, factory=line.factory_id, is_active=True
            ).first()
            if contractor is None:
                raise ValueError(
                    "پیمانکار انتخاب‌شده متعلق به کارخانه‌ی همین خط نیست یا غیرفعال است."
                )

        shift = None
        shift_id = data.get("shift")
        if shift_id:
            shift = Shift.objects.filter(pk=shift_id, factory=line.factory_id).first()
            if shift is None:
                raise ValueError("شیفت انتخاب‌شده متعلق به کارخانه‌ی همین خط نیست.")

        inputs, outputs = validate_and_compute(line, data)
        return line, contractor, date_from, date_to, shift, inputs, outputs

    def _resolve_dates(self, data):
        """تاریخ تکی (date) یا بازه (date_from/date_to) را برمی‌گرداند."""
        from datetime import datetime

        raw_from = data.get("date_from") or data.get("date")
        raw_to = data.get("date_to") or data.get("date")
        if not raw_from:
            raise ValueError("تاریخ شروع آنالیز (date یا date_from) الزامی است.")
        if not raw_to:
            raise ValueError("تاریخ پایان آنالیز (date یا date_to) الزامی است.")
        try:
            date_from = datetime.strptime(str(raw_from), "%Y-%m-%d").date()
            date_to = datetime.strptime(str(raw_to), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("فرمت تاریخ باید YYYY-MM-DD باشد.")
        return date_from, date_to

    def create(self, request, *args, **kwargs):
        try:
            line, contractor, date_from, date_to, shift, inputs, outputs = (
                self._make_actual(request)
            )
        except ValueError as e:
            return _error(e)
        obj = ActualAnalysis.objects.create(
            line=line,
            contractor=contractor,
            date_from=date_from,
            date_to=date_to,
            shift=shift,
            inputs=inputs,
            outputs=outputs,
            created_by=request.user,
        )
        log_activity(
            request.user,
            "create",
            "آنالیز واقعی",
            f"{line.name} - {date_from} تا {date_to}",
            request,
            factory=line.factory,
        )
        return Response(
            ActualAnalysisSerializer(obj).data, status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            line, contractor, date_from, date_to, shift, inputs, outputs = (
                self._make_actual(request)
            )
        except ValueError as e:
            return _error(e)
        instance.line = line
        instance.contractor = contractor
        instance.date_from = date_from
        instance.date_to = date_to
        instance.shift = shift
        instance.inputs = inputs
        instance.outputs = outputs
        instance.save()
        log_activity(
            request.user,
            "update",
            "آنالیز واقعی",
            f"{line.name} - {date_from} تا {date_to}",
            request,
            factory=line.factory,
        )
        return Response(ActualAnalysisSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        log_activity(
            self.request.user,
            "delete",
            "آنالیز واقعی",
            f"{instance.line.name} - {instance.date_from}",
            self.request,
            factory=instance.line.factory,
        )
        instance.delete()


# ── Schema داینامیک فرم Actual Analysis بر اساس Line ──
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def line_analysis_schema_view(request, line_id):
    line = _get_scoped_line(request, line_id)
    return Response(build_schema(line))


# ── جزئیات کامل خط تولید: تعریف/ورودی‌ها + دستگاه‌ها (ماشین‌ها) ──
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def production_line_detail_view(request, line_id):
    line = _get_scoped_line(request, line_id)
    schema = build_schema(line)
    devices = [
        {"id": d.id, "name": d.name, "code": d.code, "order": d.order}
        for d in line.devices.all().order_by("order")
    ]
    return Response({**schema, "devices": devices})


# ── اعتبارسنجی آنی فرمول در ادمین/فرانت ──
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def formula_validate_view(request):
    line_id = request.data.get("line_id")
    expression = request.data.get("expression") or ""
    if not line_id:
        return _error("line_id الزامی است.")
    line = _get_scoped_line(request, line_id)
    errors = validate_formula_for_line(line, expression)
    return Response({"ok": not errors, "errors": errors})


# ── مدیریت موقعیت‌های آنالیز یک خط ──
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def line_analysis_positions_view(request, line_id):
    line = _get_scoped_line(request, line_id)
    if request.method == "POST":
        if not user_has_permission(request.user, "analysis.manage"):
            return _error(
                "شما اجازه‌ی مدیریت تعریف‌های آنالیز را ندارید.",
                status.HTTP_403_FORBIDDEN,
            )
        serializer = AnalysisPositionSerializer(
            data=request.data, context={"line_id": line.id}
        )
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except Exception as e:  # noqa: BLE001
            from django.core.exceptions import ValidationError as _DVE
            from rest_framework.exceptions import ValidationError as _RVE

            if isinstance(e, (_DVE, _RVE)):
                return _error(e)
            raise
        log_activity(
            request.user,
            "create",
            "موقعیت آنالیز",
            f"{line.name} - {serializer.instance.name}",
            request,
            factory=line.factory,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    positions = line.analysis_positions.select_related("definition").prefetch_related(
        "definition__inputs"
    )
    return Response(AnalysisPositionSerializer(positions, many=True).data)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def line_analysis_position_detail_view(request, line_id, pk):
    line = _get_scoped_line(request, line_id)
    position = AnalysisPosition.objects.filter(line=line, pk=pk).first()
    if position is None:
        raise Http404
    if request.method in ("PATCH", "DELETE") and not user_has_permission(
        request.user, "analysis.manage"
    ):
        return _error(
            "شما اجازه‌ی مدیریت تعریف‌های آنالیز را ندارید.", status.HTTP_403_FORBIDDEN
        )
    if request.method == "DELETE":
        log_activity(
            request.user,
            "delete",
            "موقعیت آنالیز",
            f"{line.name} - {position.name}",
            request,
            factory=line.factory,
        )
        position.delete()
        return Response({"detail": "حذف شد."})
    if request.method == "PATCH":
        serializer = AnalysisPositionSerializer(
            position, data=request.data, partial=True, context={"line_id": line.id}
        )
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save()
        except Exception as e:  # noqa: BLE001
            from django.core.exceptions import ValidationError as _DVE
            from rest_framework.exceptions import ValidationError as _RVE

            if isinstance(e, (_DVE, _RVE)):
                return _error(e)
            raise
        log_activity(
            request.user,
            "update",
            "موقعیت آنالیز",
            f"{line.name} - {serializer.instance.name}",
            request,
            factory=line.factory,
        )
        return Response(AnalysisPositionSerializer(serializer.instance).data)
    return Response(AnalysisPositionSerializer(position).data)


# ── مدیریت تعریف آنالیز خط ──
@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def line_analysis_definition_view(request, line_id):
    if request.method == "DELETE":
        if not user_has_permission(request.user, "analysis.manage"):
            return _error(
                "شما اجازه‌ی مدیریت تعریف‌های آنالیز را ندارید.",
                status.HTTP_403_FORBIDDEN,
            )
        line, line_def = _get_scoped_line_definition(request, line_id)
        log_activity(
            request.user,
            "delete",
            "تعریف آنالیز خط",
            line.name,
            request,
            factory=line.factory,
        )
        line_def.delete()
        return Response({"detail": "تعریف آنالیز خط حذف شد."})
    line, line_def = _get_scoped_line_definition(request, line_id)
    return Response(LineAnalysisDefinitionSerializer(line_def).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.manage")
def line_analysis_definition_upsert_view(request, line_id):
    line = _get_scoped_line(request, line_id)
    line_def = getattr(line, "analysis_definition", None)
    data = request.data.copy()
    data["line"] = line.id
    if line_def is None:
        serializer = LineAnalysisDefinitionSerializer(data=data)
    else:
        serializer = LineAnalysisDefinitionSerializer(line_def, data=data)
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
    except Exception as e:  # noqa: BLE001
        from django.core.exceptions import ValidationError as _DVE
        from rest_framework.exceptions import ValidationError as _RVE

        if isinstance(e, (_DVE, _RVE)):
            return _error(e)
        raise
    log_activity(
        request.user,
        "update" if line_def else "create",
        "تعریف آنالیز خط",
        line.name,
        request,
        factory=line.factory,
    )
    return Response(LineAnalysisDefinitionSerializer(serializer.instance).data)


# ── مدیریت ورودی‌های اضافه ──
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def line_additional_inputs_view(request, line_id):
    line, line_def = _get_scoped_line_definition(request, line_id)
    if request.method == "POST":
        if not user_has_permission(request.user, "analysis.manage"):
            return _error(
                "شما اجازه‌ی مدیریت تعریف‌های آنالیز را ندارید.",
                status.HTTP_403_FORBIDDEN,
            )
        serializer = AdditionalInputDefinitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(line_definition=line_def)
        except Exception as e:  # noqa: BLE001
            from django.core.exceptions import ValidationError as _DVE
            from rest_framework.exceptions import ValidationError as _RVE

            if isinstance(e, (_DVE, _RVE)):
                return _error(e)
            raise
        log_activity(
            request.user,
            "create",
            "ورودی اضافه",
            f"{line.name} - {serializer.instance.name}",
            request,
            factory=line.factory,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(
        AdditionalInputDefinitionSerializer(
            line_def.additional_inputs.all(), many=True
        ).data
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.manage")
def line_additional_input_detail_view(request, line_id, pk):
    line, line_def = _get_scoped_line_definition(request, line_id)
    item = AdditionalInputDefinition.objects.filter(
        line_definition=line_def, pk=pk
    ).first()
    if item is None:
        raise Http404
    if request.method == "DELETE":
        log_activity(
            request.user,
            "delete",
            "ورودی اضافه",
            f"{line.name} - {item.name}",
            request,
            factory=line.factory,
        )
        item.delete()
        return Response({"detail": "حذف شد."})
    serializer = AdditionalInputDefinitionSerializer(
        item, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
    except Exception as e:  # noqa: BLE001
        from django.core.exceptions import ValidationError as _DVE
        from rest_framework.exceptions import ValidationError as _RVE

        if isinstance(e, (_DVE, _RVE)):
            return _error(e)
        raise
    log_activity(
        request.user,
        "update",
        "ورودی اضافه",
        f"{line.name} - {serializer.instance.name}",
        request,
        factory=line.factory,
    )
    return Response(serializer.data)


# ── مدیریت خروجی‌ها و فرمول‌ها ──
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.view")
def line_outputs_view(request, line_id):
    line, line_def = _get_scoped_line_definition(request, line_id)
    if request.method == "POST":
        if not user_has_permission(request.user, "analysis.manage"):
            return _error(
                "شما اجازه‌ی مدیریت تعریف‌های آنالیز را ندارید.",
                status.HTTP_403_FORBIDDEN,
            )
        serializer = AnalysisOutputDefinitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(line_definition=line_def)
            line_def.full_clean()
        except Exception as e:  # noqa: BLE001
            from django.core.exceptions import ValidationError

            if isinstance(e, ValidationError):
                return _error(e)
            raise
        log_activity(
            request.user,
            "create",
            "خروجی آنالیز",
            f"{line.name} - {serializer.instance.name}",
            request,
            factory=line.factory,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(
        AnalysisOutputDefinitionSerializer(line_def.outputs.all(), many=True).data
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@require_permission("analysis.manage")
def line_output_detail_view(request, line_id, pk):
    line, line_def = _get_scoped_line_definition(request, line_id)
    item = AnalysisOutputDefinition.objects.filter(
        line_definition=line_def, pk=pk
    ).first()
    if item is None:
        raise Http404
    if request.method == "DELETE":
        log_activity(
            request.user,
            "delete",
            "خروجی آنالیز",
            f"{line.name} - {item.name}",
            request,
            factory=line.factory,
        )
        item.delete()
        return Response({"detail": "حذف شد."})
    serializer = AnalysisOutputDefinitionSerializer(
        item, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
        line_def.full_clean()
    except Exception as e:  # noqa: BLE001
        from django.core.exceptions import ValidationError

        if isinstance(e, ValidationError):
            return _error(e)
        raise
    log_activity(
        request.user,
        "update",
        "خروجی آنالیز",
        f"{line.name} - {serializer.instance.name}",
        request,
        factory=line.factory,
    )
    return Response(serializer.data)
