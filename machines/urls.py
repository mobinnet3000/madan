from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DeviceDailyAnalysisViewSet,
    DeviceLogViewSet,
    FactoryDetailViewSet,
    ProductionReportViewSet,
    ContractorViewSet,
    AnalysisTypeDefinitionViewSet,
    ActualAnalysisViewSet,
    performance_report_view,
    analysis_report_view,
    report_ranges_view,
    line_attributes_view,
    device_attributes_view,
    line_analysis_schema_view,
    line_analysis_positions_view,
    line_analysis_position_detail_view,
    line_analysis_definition_view,
    line_analysis_definition_upsert_view,
    line_additional_inputs_view,
    line_additional_input_detail_view,
    line_outputs_view,
    line_output_detail_view,
    production_line_detail_view,
    formula_validate_view,
)

router = DefaultRouter()
router.register(r"factory-setup", FactoryDetailViewSet, basename="factory-setup")
router.register(
    r"daily-analysis", DeviceDailyAnalysisViewSet, basename="daily-analysis"
)
router.register(r"device-logs", DeviceLogViewSet, basename="device-logs")
router.register(
    r"production-reports", ProductionReportViewSet, basename="production-reports"
)
router.register(r"contractors", ContractorViewSet, basename="contractors")
router.register(
    r"analysis-type-definitions",
    AnalysisTypeDefinitionViewSet,
    basename="analysis-type-definitions",
)
router.register(r"actual-analyses", ActualAnalysisViewSet, basename="actual-analyses")

urlpatterns = [
    path("api/", include(router.urls)),
    path("api/reports/ranges/", report_ranges_view, name="report-ranges"),
    path(
        "api/reports/performance/", performance_report_view, name="report-performance"
    ),
    path("api/reports/analysis/", analysis_report_view, name="report-analysis"),
    path(
        "api/lines/<int:uid>/attributes/", line_attributes_view, name="line-attributes"
    ),
    path(
        "api/devices/<int:uid>/attributes/",
        device_attributes_view,
        name="device-attributes",
    ),
    # ── سیستم آنالیز داینامیک ──
    path(
        "api/production-lines/<int:line_id>/",
        production_line_detail_view,
        name="production-line-detail",
    ),
    path(
        "api/formula/validate/",
        formula_validate_view,
        name="formula-validate",
    ),
    path(
        "api/production-lines/<int:line_id>/analysis-definition/",
        line_analysis_schema_view,
        name="line-analysis-schema",
    ),
    path(
        "api/production-lines/<int:line_id>/analysis-positions/",
        line_analysis_positions_view,
        name="line-positions",
    ),
    path(
        "api/production-lines/<int:line_id>/analysis-positions/<int:pk>/",
        line_analysis_position_detail_view,
        name="line-position-detail",
    ),
    path(
        "api/production-lines/<int:line_id>/line-analysis-definition/",
        line_analysis_definition_view,
        name="line-definition",
    ),
    path(
        "api/production-lines/<int:line_id>/line-analysis-definition/upsert/",
        line_analysis_definition_upsert_view,
        name="line-definition-upsert",
    ),
    path(
        "api/production-lines/<int:line_id>/additional-inputs/",
        line_additional_inputs_view,
        name="line-add-inputs",
    ),
    path(
        "api/production-lines/<int:line_id>/additional-inputs/<int:pk>/",
        line_additional_input_detail_view,
        name="line-add-input-detail",
    ),
    path(
        "api/production-lines/<int:line_id>/outputs/",
        line_outputs_view,
        name="line-outputs",
    ),
    path(
        "api/production-lines/<int:line_id>/outputs/<int:pk>/",
        line_output_detail_view,
        name="line-output-detail",
    ),
]
