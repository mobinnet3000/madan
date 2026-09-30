from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FactoryViewSet,
    ShiftViewSet,
    DeviceViewSet,
    DeviceLogViewSet,
    FactoryDetailViewSet,
    ProductionLineViewSet,
    ContractorViewSet,
    FailureReasonViewSet,
    AttributeViewSet,
    ProductionLineAttributeViewSet,
    DeviceTemplateViewSet,
    ProductionLineTemplateViewSet,
    line_attributes_view,
    device_attributes_view,
    FactoryTabViewSet,
    FactoryTabRecordViewSet,
    FactoryTabReportViewSet,
    factory_tab_inputs_view,
    factory_tab_input_detail_view,
    factory_tab_outputs_view,
    factory_tab_output_detail_view,
    factory_tab_schema_view,
    formula_validate_tab_view,
    factory_tab_report_widgets_view,
    factory_tab_report_widget_detail_view,
    factory_tab_report_run_view,
    factory_tab_report_types_view,
)

router = DefaultRouter()
router.register(r"factory-setup", FactoryDetailViewSet, basename="factory-setup")
router.register(r"factories", FactoryViewSet, basename="factories")
router.register(r"shifts", ShiftViewSet, basename="shifts")
router.register(r"production-lines", ProductionLineViewSet, basename="production-lines")
router.register(r"devices", DeviceViewSet, basename="devices")
router.register(r"contractors", ContractorViewSet, basename="contractors")
router.register(r"failure-reasons", FailureReasonViewSet, basename="failure-reasons")
router.register(r"attributes", AttributeViewSet, basename="attributes")
router.register(r"production-line-attributes", ProductionLineAttributeViewSet, basename="pl-attributes")
router.register(r"device-templates", DeviceTemplateViewSet, basename="device-templates")
router.register(r"production-line-templates", ProductionLineTemplateViewSet, basename="pl-templates")
router.register(r"device-logs", DeviceLogViewSet, basename="device-logs")
router.register(r"factory-tabs", FactoryTabViewSet, basename="factory-tabs")
router.register(r"factory-tab-records", FactoryTabRecordViewSet, basename="factory-tab-records")
router.register(r"factory-tab-reports", FactoryTabReportViewSet, basename="factory-tab-reports")

urlpatterns = [
    # باید قبل از router باشد تا "types" به‌عنوان pk تفسیر نشود
    path(
        "api/factory-tab-reports/types/",
        factory_tab_report_types_view,
        name="factory-tab-report-types",
    ),
    path("api/", include(router.urls)),
    path(
        "api/lines/<int:uid>/attributes/", line_attributes_view, name="line-attributes"
    ),
    path(
        "api/devices/<int:uid>/attributes/",
        device_attributes_view,
        name="device-attributes",
    ),
    # ── تب‌های داینامیک کارخانه ──
    path(
        "api/factory-tabs/<int:tab_id>/schema/",
        factory_tab_schema_view,
        name="factory-tab-schema",
    ),
    path(
        "api/factory-tabs/<int:tab_id>/inputs/",
        factory_tab_inputs_view,
        name="factory-tab-inputs",
    ),
    path(
        "api/factory-tabs/<int:tab_id>/inputs/<int:pk>/",
        factory_tab_input_detail_view,
        name="factory-tab-input-detail",
    ),
    path(
        "api/factory-tabs/<int:tab_id>/outputs/",
        factory_tab_outputs_view,
        name="factory-tab-outputs",
    ),
    path(
        "api/factory-tabs/<int:tab_id>/outputs/<int:pk>/",
        factory_tab_output_detail_view,
        name="factory-tab-output-detail",
    ),
    path(
        "api/formula/validate-tab/",
        formula_validate_tab_view,
        name="formula-validate-tab",
    ),
    # ── گزارش‌های تب کارخانه ──
    path(
        "api/factory-tab-reports/<int:report_id>/run/",
        factory_tab_report_run_view,
        name="factory-tab-report-run",
    ),
    path(
        "api/factory-tab-reports/<int:report_id>/widgets/",
        factory_tab_report_widgets_view,
        name="factory-tab-report-widgets",
    ),
    path(
        "api/factory-tab-reports/<int:report_id>/widgets/<int:pk>/",
        factory_tab_report_widget_detail_view,
        name="factory-tab-report-widget-detail",
    ),
]
