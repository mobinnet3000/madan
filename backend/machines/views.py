from django.http import FileResponse, Http404
from datetime import datetime
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Contractor,
    Device,
    DeviceLog,
    Factory,
    FactoryTab,
    FactoryTabInput,
    FactoryTabOutput,
    FactoryTabRecord,
    FactoryTabReport,
    FactoryTabWidget,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
    Shift,
    Attribute,
    DeviceTemplate,
    FailureReason,
)
from .serializers import (
    ContractorSerializer,
    DeviceLogSerializer,
    DeviceLogWriteSerializer,
    DeviceSerializer,
    DeviceWriteSerializer,
    FactoryFullDetailSerializer,
    FactorySerializer,
    FactoryTabInputSerializer,
    FactoryTabOutputSerializer,
    FactoryTabRecordSerializer,
    FactoryTabRecordWriteSerializer,
    FactoryTabReportSerializer,
    FactoryTabWidgetSerializer,
    FactoryTabSerializer,
    FailureReasonSerializer,
    ProductionLineWriteSerializer,
    ShiftSerializer,
    AttributeSerializer,
    DeviceTemplateSerializer,
    ProductionLineTemplateSerializer,
    ProductionLineAttributeSerializer,
)
from .filters import DeviceLogFilter, FactoryTabRecordFilter
from .reports import RANGE_LABELS
from .factory_tabs import (
    build_schema as build_tab_schema,
    formula_variables_for_tab,
    validate_and_compute as validate_and_compute_tab,
    validate_formula_for_tab,
)
from accounts.services import get_user_factory, log_activity
from accounts.permissions import HasPermission, require_permission, user_has_permission
from core.pagination import StandardPagination

class FactoryViewSet(viewsets.ModelViewSet):
    serializer_class = FactorySerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    def get_queryset(self):
        factory = get_user_factory(self.request.user)
        qs = Factory.objects.all()
        if factory is not None:
            qs = qs.filter(id=factory.id)
        return qs
    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, "create", "کارخانه", obj.name, self.request, factory=obj)
    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, "update", "کارخانه", obj.name, self.request, factory=obj)
    def perform_destroy(self, instance):
        log_activity(self.request.user, "delete", "کارخانه", instance.name, self.request)

class DeviceViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None
    required_permission = "devices.view"
    action_permissions = {"create": "devices.manage", "update": "devices.manage", "partial_update": "devices.manage", "destroy": "devices.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return DeviceWriteSerializer
        return DeviceSerializer

    def get_queryset(self):
        qs = Device.objects.select_related("line__factory", "template")
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        line = self.request.query_params.get("line")
        if line:
            qs = qs.filter(line_id=line)
        return qs.order_by("line_id", "order", "id")

    def perform_create(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, "create", "دستگاه", obj.name, self.request, factory=obj.line.factory)

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(self.request.user, "update", "دستگاه", obj.name, self.request, factory=obj.line.factory)

    def perform_destroy(self, instance):
        log_activity(self.request.user, "delete", "دستگاه", instance.name, self.request, factory=instance.line.factory)
        instance.delete()

class FailureReasonViewSet(viewsets.ModelViewSet):
    serializer_class = FailureReasonSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    queryset = FailureReason.objects.all()

class AttributeViewSet(viewsets.ModelViewSet):
    serializer_class = AttributeSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    queryset = Attribute.objects.all()

class ProductionLineAttributeViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionLineAttributeSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    queryset = ProductionLineAttribute.objects.all()

class DeviceTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = DeviceTemplateSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    queryset = DeviceTemplate.objects.all()

class ProductionLineTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionLineTemplateSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    queryset = ProductionLineTemplate.objects.all()

class ProductionLineViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionLineWriteSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    def get_queryset(self):
        qs = ProductionLine.objects.select_related("factory", "template")
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(factory=factory)
        fac = self.request.query_params.get("factory")
        if fac:
            qs = qs.filter(factory_id=fac)
        return qs.order_by("factory_id", "name")

class FactoryDetailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = FactoryFullDetailSerializer
    pagination_class = None
    required_permission = "factory.view"
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_queryset(self):
        qs = Factory.objects.all().prefetch_related(
            "lines__shifts",
            "contractors",
            "lines__template",
            "lines__devices__template",
            "lines__devices__template__available_attributes",
            "report_tabs__inputs",
            "report_tabs__outputs",
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(id=factory.id)
        return qs

class ShiftViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "settings.manage", "update": "settings.manage", "partial_update": "settings.manage", "destroy": "settings.manage"}
    permission_classes = [permissions.IsAuthenticated, HasPermission]
    def get_queryset(self):
        qs = Shift.objects.select_related("line__factory")
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(line__factory=factory)
        line_id = self.request.query_params.get("line")
        if line_id:
            qs = qs.filter(line_id=line_id)
        return qs.order_by("line_id", "start_time")
    def perform_create(self, serializer):
        actual_line = serializer.validated_data["line"]
        factory = get_user_factory(self.request.user)
        if factory is not None and actual_line.factory_id != factory.id:
            from django.http import Http404
            raise Http404
        serializer.save()
        log_activity(self.request.user, "create", "شیفت", f"{actual_line.name} - {serializer.instance.name}", self.request, factory=actual_line.factory)
    def perform_update(self, serializer):
        serializer.save()
        log_activity(self.request.user, "update", "شیفت", serializer.instance.name, self.request, factory=serializer.instance.line.factory)
    def perform_destroy(self, instance):
        log_activity(self.request.user, "delete", "شیفت", instance.name, self.request, factory=instance.line.factory)
        instance.delete()

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
            "توقفات خط تولید",
            f"{obj.line.name} - {obj.date}",
            self.request,
            factory=obj.line.factory,
        )

    def perform_update(self, serializer):
        obj = serializer.save()
        log_activity(
            self.request.user,
            "update",
            "توقفات خط تولید",
            f"{obj.line.name} - {obj.date}",
            self.request,
            factory=obj.line.factory,
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user,
            "delete",
            "توقفات خط تولید",
            f"{instance.line.name} - {instance.date}",
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
        except (ValueError, TypeError):
            return Response({"detail": "date_from باید YYYY-MM-DD باشد."}, status=status.HTTP_400_BAD_REQUEST)
    if dt:
        try:
            date_to_o = datetime.strptime(dt, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return Response({"detail": "date_to باید YYYY-MM-DD باشد."}, status=status.HTTP_400_BAD_REQUEST)
    if fmt not in ("pdf", "excel", "xlsx"):
        return Response({"detail": "format باید pdf یا excel باشد."}, status=status.HTTP_400_BAD_REQUEST)
    if fmt == "xlsx":
        fmt = "excel"

    try:
        buf, ext = gen_report(factory_id, range_key, date_from_o, date_to_o, fmt=fmt)
    except ValueError as e:
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:  # noqa: BLE001
        import logging
        logging.getLogger("machines").exception("generate_performance_report failed")
        return Response({"detail": "خطا در تولید گزارش."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

def _error(msg, code=status.HTTP_400_BAD_REQUEST):
    return Response({"errors": {"detail": str(msg)}}, status=code)

class ContractorViewSet(viewsets.ModelViewSet):
    serializer_class = ContractorSerializer
    pagination_class = None
    required_permission = "settings.view"
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

# ── Schema داینامیک فرم Actual Analysis بر اساس Line ──

# ── جزئیات کامل خط تولید: تعریف/ورودی‌ها + دستگاه‌ها (ماشین‌ها) ──

# ── اعتبارسنجی آنی فرمول در ادمین/فرانت ──

# ── مدیریت موقعیت‌های آنالیز یک خط ──

# ── مدیریت تعریف آنالیز خط ──

# ── مدیریت ورودی‌های اضافه ──

# ── مدیریت خروجی‌ها و فرمول‌ها ──

# ═══════════════════ آنالیز داینامیک کارخانه (ورودی/خروجی/فرمول) ═══════════════════

def _get_scoped_factory(request, factory_id):
    try:
        factory = Factory.objects.get(pk=factory_id)
    except Factory.DoesNotExist:
        raise Http404
    scope = get_user_factory(request.user)
    if scope is not None and scope.id != factory.id:
        raise Http404
    return factory

# ═══════════════════ تناژ تحویلی خطوط تولید (تعریف‌محور) ═══════════════════

# ═══════════════════ تب‌های داینامیک کارخانه ═══════════════════

def _get_scoped_tab(request, tab_id):
    try:
        tab = FactoryTab.objects.select_related("factory").get(pk=tab_id)
    except FactoryTab.DoesNotExist:
        raise Http404
    scope = get_user_factory(request.user)
    if scope is not None and scope.id != tab.factory_id:
        raise Http404
    return tab

class FactoryTabViewSet(viewsets.ModelViewSet):
    serializer_class = FactoryTabSerializer
    pagination_class = None
    required_permission = "factory-tabs.view"
    action_permissions = {
        "create": "factory-tabs.manage",
        "update": "factory-tabs.manage",
        "partial_update": "factory-tabs.manage",
        "destroy": "factory-tabs.manage",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_queryset(self):
        qs = FactoryTab.objects.select_related("factory").prefetch_related(
            "inputs", "outputs"
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(factory=factory)
        factory_q = self.request.query_params.get("factory")
        if factory_q:
            qs = qs.filter(factory_id=factory_q)
        active = self.request.query_params.get("active")
        if active == "1":
            qs = qs.filter(is_active=True)
        elif active == "0":
            qs = qs.filter(is_active=False)
        return qs.order_by("factory_id", "order", "id")

    @action(detail=True, methods=["get"], url_path="formula-vars")
    def formula_vars(self, request, pk=None):
        """متغیرهای مجاز فرمول این تب (شامل ارجاع ورودی/خروجی تب‌های دیگر)."""
        tab = self.get_object()
        return Response(formula_variables_for_tab(tab))

    def perform_create(self, serializer):
        factory = get_user_factory(self.request.user)
        if factory is not None:
            serializer.save(factory=factory)
        else:
            serializer.save()
        log_activity(
            self.request.user, "create", "تب کارخانه",
            f"{serializer.instance.factory.name} - {serializer.instance.name}",
            self.request, factory=serializer.instance.factory,
        )

    def perform_update(self, serializer):
        factory = get_user_factory(self.request.user)
        if factory is not None:
            serializer.save(factory=factory)
        else:
            serializer.save()
        log_activity(
            self.request.user, "update", "تب کارخانه",
            f"{serializer.instance.factory.name} - {serializer.instance.name}",
            self.request, factory=serializer.instance.factory,
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user, "delete", "تب کارخانه",
            f"{instance.factory.name} - {instance.name}",
            self.request, factory=instance.factory,
        )
        instance.delete()

class FactoryTabRecordViewSet(viewsets.ModelViewSet):
    serializer_class = FactoryTabRecordSerializer
    filterset_class = FactoryTabRecordFilter
    pagination_class = StandardPagination
    required_permission = "factory-tabs.view"
    action_permissions = {
        "create": "factory-tabs.create",
        "update": "factory-tabs.edit",
        "partial_update": "factory-tabs.edit",
        "destroy": "factory-tabs.delete",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return FactoryTabRecordWriteSerializer
        return FactoryTabRecordSerializer

    def get_queryset(self):
        qs = FactoryTabRecord.objects.select_related(
            "tab__factory", "line__factory", "contractor"
        )
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(tab__factory=factory)
        return qs

    def _make_record(self, request):
        data = request.data
        tab_id = data.get("tab") or data.get("tab_id")
        if isinstance(tab_id, dict):
            tab_id = tab_id.get("id")
        if not tab_id:
            raise ValueError("تب (tab) الزامی است.")
        tab = _get_scoped_tab(request, tab_id)

        line = None
        line_id = data.get("line_id") or data.get("line")
        if isinstance(line_id, dict):
            line_id = line_id.get("id")
        if line_id:
            line = _get_scoped_line(request, line_id)
            if line.factory_id != tab.factory_id:
                raise ValueError("خط تولید باید متعلق به کارخانه‌ی همین تب باشد.")
        elif tab.require_line:
            raise ValueError("انتخاب خط تولید برای این تب الزامی است.")

        from datetime import datetime

        raw_from = data.get("date_from") or data.get("date")
        raw_to = data.get("date_to") or data.get("date")
        if not raw_from or not raw_to:
            raise ValueError("تاریخ شروع و پایان (بازه) الزامی است.")
        try:
            date_from = datetime.strptime(str(raw_from), "%Y-%m-%d").date()
            date_to = datetime.strptime(str(raw_to), "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("فرمت تاریخ باید YYYY-MM-DD باشد.")
        if date_to < date_from:
            raise ValueError("تاریخ پایان بازه نمی‌تواند قبل از شروع باشد.")

        hour = None
        if tab.record_type == "daily":
            raw_hour = data.get("hour")
            if not raw_hour:
                raise ValueError("ساعت ثبت برای تب روزانه الزامی است.")
            try:
                hour = datetime.strptime(str(raw_hour)[:5], "%H:%M").time()
            except ValueError:
                raise ValueError("فرمت ساعت باید HH:MM باشد.")
            date_from = date_to = date_from

        contractor = None
        contractor_id = data.get("contractor_id") or data.get("contractor")
        if isinstance(contractor_id, dict):
            contractor_id = contractor_id.get("id")
        if contractor_id:
            contractor = Contractor.objects.filter(
                pk=contractor_id, factory=tab.factory_id
            ).first()
            if contractor is None:
                raise ValueError(
                    "پیمانکار انتخاب‌شده متعلق به کارخانه‌ی همین تب نیست."
                )
        elif tab.contractor_required:
            raise ValueError("انتخاب پیمانکار برای این تب الزامی است.")

        from .factory_tabs import (
            build_cross_context,
            validate_linked_records as _validate_linked,
        )
        from .factory_tabs import validate_and_compute as _vtc

        raw_linked = request.data.get("linked_records")
        if raw_linked is None:
            raw_linked = request.data.get("linked")
        linked_records = _validate_linked(tab, raw_linked)
        cross_ctx = build_cross_context(
            tab, date_from, date_to, line, linked_records=linked_records
        )
        inputs, outputs = _vtc(tab, data, cross_ctx=cross_ctx)
        return tab, line, contractor, date_from, date_to, hour, inputs, outputs, linked_records

    def create(self, request, *args, **kwargs):
        try:
            (tab, line, contractor, date_from, date_to, hour, inputs, outputs,
             linked_records) = self._make_record(request)
        except ValueError as e:
            return _error(e)
        obj = FactoryTabRecord.objects.create(
            tab=tab,
            line=line,
            contractor=contractor,
            date_from=date_from,
            date_to=date_to,
            hour=hour,
            inputs=inputs,
            outputs=outputs,
            linked_records=linked_records,
            note=request.data.get("note", ""),
            created_by=request.user if hasattr(request, "user") else None,
        )
        log_activity(
            request.user, "create", "رکورد تب",
            f"{tab.name} - {date_from} تا {date_to}",
            request, factory=tab.factory,
        )
        return Response(FactoryTabRecordSerializer(obj).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            (tab, line, contractor, date_from, date_to, hour, inputs, outputs,
             linked_records) = self._make_record(request)
        except ValueError as e:
            return _error(e)
        instance.tab = tab
        instance.line = line
        instance.contractor = contractor
        instance.date_from = date_from
        instance.date_to = date_to
        instance.hour = hour
        instance.inputs = inputs
        instance.outputs = outputs
        instance.linked_records = linked_records
        if request.data.get("note") is not None:
            instance.note = request.data.get("note", "")
        instance.save()
        log_activity(
            request.user, "update", "رکورد تب",
            f"{tab.name} - {date_from} تا {date_to}",
            request, factory=tab.factory,
        )
        return Response(FactoryTabRecordSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        log_activity(
            self.request.user, "delete", "رکورد تب",
            f"{instance.tab.name} - {instance.date_from}",
            self.request, factory=instance.tab.factory,
        )
        instance.delete()

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.view")
def factory_tab_inputs_view(request, tab_id):
    tab = _get_scoped_tab(request, tab_id)
    if request.method == "POST":
        if not user_has_permission(request.user, "factory-tabs.manage"):
            return _error("شما اجازه‌ی مدیریت تب‌ها را ندارید.", status.HTTP_403_FORBIDDEN)
        serializer = FactoryTabInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(tab=tab)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(FactoryTabInputSerializer(tab.inputs.all(), many=True).data)

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.manage")
def factory_tab_input_detail_view(request, tab_id, pk):
    tab = _get_scoped_tab(request, tab_id)
    item = FactoryTabInput.objects.filter(tab=tab, pk=pk).first()
    if item is None:
        raise Http404
    if request.method == "DELETE":
        item.delete()
        return Response({"detail": "حذف شد."})
    serializer = FactoryTabInputSerializer(item, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.view")
def factory_tab_outputs_view(request, tab_id):
    tab = _get_scoped_tab(request, tab_id)
    if request.method == "POST":
        if not user_has_permission(request.user, "factory-tabs.manage"):
            return _error("شما اجازه‌ی مدیریت تب‌ها را ندارید.", status.HTTP_403_FORBIDDEN)
        serializer = FactoryTabOutputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(tab=tab)
            tab.full_clean()
        except Exception as e:  # noqa: BLE001
            from django.core.exceptions import ValidationError
            if isinstance(e, ValidationError):
                return _error(e)
            raise
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(FactoryTabOutputSerializer(tab.outputs.all(), many=True).data)

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.manage")
def factory_tab_output_detail_view(request, tab_id, pk):
    tab = _get_scoped_tab(request, tab_id)
    item = FactoryTabOutput.objects.filter(tab=tab, pk=pk).first()
    if item is None:
        raise Http404
    if request.method == "DELETE":
        item.delete()
        return Response({"detail": "حذف شد."})
    serializer = FactoryTabOutputSerializer(item, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
        tab.full_clean()
    except Exception as e:  # noqa: BLE001
        from django.core.exceptions import ValidationError
        if isinstance(e, ValidationError):
            return _error(e)
        raise
    return Response(serializer.data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.view")
def factory_tab_schema_view(request, tab_id):
    tab = _get_scoped_tab(request, tab_id)
    return Response(build_tab_schema(tab))

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.view")
def formula_validate_tab_view(request):
    tab_id = request.data.get("tab_id")
    expression = request.data.get("expression") or ""
    if not tab_id:
        return _error("tab_id الزامی است.")
    tab = _get_scoped_tab(request, tab_id)
    errors = validate_formula_for_tab(tab, expression)
    return Response({"ok": not errors, "errors": errors})

# ═══════════════════ گزارش‌های تب کارخانه ═══════════════════

def _get_scoped_report(request, report_id):
    try:
        report = FactoryTabReport.objects.select_related("tab__factory").get(pk=report_id)
    except FactoryTabReport.DoesNotExist:
        raise Http404
    scope = get_user_factory(request.user)
    if scope is not None and scope.id != report.tab.factory_id:
        raise Http404
    return report

class FactoryTabReportViewSet(viewsets.ModelViewSet):
    serializer_class = FactoryTabReportSerializer
    pagination_class = None
    required_permission = "factory-tabs.view"
    action_permissions = {
        "create": "factory-tabs.manage",
        "update": "factory-tabs.manage",
        "partial_update": "factory-tabs.manage",
        "destroy": "factory-tabs.manage",
    }
    permission_classes = [permissions.IsAuthenticated, HasPermission]

    def get_queryset(self):
        qs = FactoryTabReport.objects.select_related("tab__factory").prefetch_related("widgets")
        factory = get_user_factory(self.request.user)
        if factory is not None:
            qs = qs.filter(tab__factory=factory)
        tab_q = self.request.query_params.get("tab")
        if tab_q:
            qs = qs.filter(tab_id=tab_q)
        active = self.request.query_params.get("active")
        if active == "1":
            qs = qs.filter(is_active=True)
        elif active == "0":
            qs = qs.filter(is_active=False)
        return qs.order_by("tab_id", "order", "id")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        tab_id = self.request.data.get("tab") if self.request.data else None
        if isinstance(tab_id, dict):
            tab_id = tab_id.get("id")
        if tab_id and self.action in ("create", "update", "partial_update"):
            ctx["tab"] = _get_scoped_tab(self.request, tab_id)
        return ctx

    def perform_create(self, serializer):
        factory = get_user_factory(self.request.user)
        if factory is not None:
            tab = _get_scoped_tab(self.request, serializer.validated_data["tab"].id)
            serializer.save(tab=tab)
        else:
            serializer.save()
        log_activity(
            self.request.user, "create", "گزارش تب",
            f"{serializer.instance.tab.name} - {serializer.instance.name}",
            self.request, factory=serializer.instance.tab.factory,
        )

    def perform_update(self, serializer):
        serializer.save()
        log_activity(
            self.request.user, "update", "گزارش تب",
            f"{serializer.instance.tab.name} - {serializer.instance.name}",
            self.request, factory=serializer.instance.tab.factory,
        )

    def perform_destroy(self, instance):
        log_activity(
            self.request.user, "delete", "گزارش تب",
            f"{instance.tab.name} - {instance.name}",
            self.request, factory=instance.tab.factory,
        )
        instance.delete()

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.view")
def factory_tab_report_widgets_view(request, report_id):
    report = _get_scoped_report(request, report_id)
    if request.method == "POST":
        if not user_has_permission(request.user, "factory-tabs.manage"):
            return _error("شما اجازه‌ی مدیریت گزارش‌ها را ندارید.", status.HTTP_403_FORBIDDEN)
        serializer = FactoryTabWidgetSerializer(
            data=request.data, context={"report": report}
        )
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(report=report)
        except Exception as e:  # noqa: BLE001
            from django.core.exceptions import ValidationError as _DVE
            from rest_framework.exceptions import ValidationError as _RVE

            if isinstance(e, (_DVE, _RVE)):
                return _error(e)
            raise
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(
        FactoryTabWidgetSerializer(
            report.widgets.order_by("order", "id"), many=True
        ).data
    )

@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.manage")
def factory_tab_report_widget_detail_view(request, report_id, pk):
    report = _get_scoped_report(request, report_id)
    item = FactoryTabWidget.objects.filter(report=report, pk=pk).first()
    if item is None:
        raise Http404
    if request.method == "DELETE":
        item.delete()
        return Response({"detail": "حذف شد."})
    serializer = FactoryTabWidgetSerializer(
        item, data=request.data, partial=True, context={"report": report}
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
    return Response(serializer.data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.view")
def factory_tab_report_run_view(request, report_id):
    from .tab_reports import REPORT_MAX_RECORDS, WIDGET_TYPES, run_report

    report = _get_scoped_report(request, report_id)
    tab = report.tab
    base_qs = FactoryTabRecord.objects.filter(tab=tab)
    try:
        payload = run_report(tab, report, base_qs, request.query_params)
    except ValueError as e:
        return _error(e)
    payload["meta"] = {
        "engine": "tab_reports/1",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "max_records": REPORT_MAX_RECORDS,
        "widget_types": sorted(WIDGET_TYPES),
    }
    return Response(payload)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_permission("factory-tabs.view")
def factory_tab_report_types_view(request):
    from .tab_reports import AGG_STATS, ALLOWED_REPORT_FILTERS, GROUP_BYS, WIDGET_TYPES

    return Response(
        {
            "widget_types": sorted(WIDGET_TYPES),
            "widget_labels": {k: v["label"] for k, v in WIDGET_TYPES.items()},
            "aggregations": list(AGG_STATS),
            "group_bys": list(GROUP_BYS),
            "filters": list(ALLOWED_REPORT_FILTERS),
        }
    )