import pathlib, re

def clean_views():
    p = pathlib.Path("machines/views.py")
    t = p.read_text(encoding="utf-8")
    orig = t
    # Imports
    t = t.replace("""from .models import (
    DeviceLog,
    Factory,
    FailureReason,
    Attribute,
    ProductionLineAttribute,
    ProductionLineTemplate,
    DeviceTemplate,
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
    FactoryAnalysisDefinition,
    FactoryAnalysisInput,
    FactoryAnalysisOutput,
    DeliveredTonnageDefinition,
    DeliveredTonnageInput,
    DeliveredTonnageOutput,
    DeliveredTonnage,
    FactoryTab,
    FactoryTabInput,
    FactoryTabOutput,
    FactoryTabRecord,
    FactoryTabReport,
    FactoryTabWidget,
)""", """from .models import (
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
)""")
    t = t.replace("""from .serializers import (
    FactorySerializer,
    ShiftSerializer,
    DeviceSerializer,
    DeviceWriteSerializer,
    DeviceLogSerializer,
    DeviceLogWriteSerializer,
    FactoryFullDetailSerializer,
    ProductionReportSerializer,
    ProductionReportWriteSerializer,
    ContractorSerializer,
    ProductionLineWriteSerializer,
    FailureReasonSerializer,
    AttributeSerializer,
    DeviceTemplateSerializer,
    ProductionLineTemplateSerializer,
    ProductionLineAttributeSerializer,
    AnalysisTypeDefinitionSerializer,
    AnalysisPositionSerializer,
    AdditionalInputDefinitionSerializer,
    AnalysisOutputDefinitionSerializer,
    LineAnalysisDefinitionSerializer,
    ActualAnalysisSerializer,
    FactoryAnalysisDefinitionSerializer,
    FactoryAnalysisInputSerializer,
    FactoryAnalysisOutputSerializer,
    DeliveredTonnageSerializer,
    DeliveredTonnageWriteSerializer,
    DeliveredTonnageInputSerializer,
    DeliveredTonnageOutputSerializer,
    DeliveredTonnageDefinitionSerializer,
    FactoryTabSerializer,
    FactoryTabInputSerializer,
    FactoryTabOutputSerializer,
    FactoryTabRecordSerializer,
    FactoryTabRecordWriteSerializer,
    FactoryTabReportSerializer,
    FactoryTabWidgetSerializer,
)""", """from .serializers import (
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
)""")
    t = t.replace("""from .filters import (
    DeviceLogFilter,
    ProductionReportFilter,
    ActualAnalysisFilter,
    DeliveredTonnageFilter,
    FactoryTabRecordFilter,
)""", """from .filters import DeviceLogFilter, FactoryTabRecordFilter""")
    t = t.replace("""from .reports import RANGE_LABELS
from .analysis import build_schema, validate_and_compute, validate_formula_for_line
from .factory_analysis import (
    build_schema as build_factory_schema,
    validate_and_compute as validate_and_compute_factory,
    validate_formula_for_factory,
    formula_variables_for_factory,
)
from .tonnage import (
    build_schema as build_tonnage_schema,
    validate_and_compute as validate_and_compute_tonnage,
    validate_formula_for_tonnage,
)
from .factory_tabs import (
    build_schema as build_tab_schema,
    formula_variables_for_tab,
    validate_and_compute as validate_and_compute_tab,
    validate_formula_for_tab,
)""", """from .reports import RANGE_LABELS
from .factory_tabs import (
    build_cross_context,
    build_schema as build_tab_schema,
    formula_variables_for_tab,
    validate_and_compute as validate_and_compute_tab,
    validate_formula_for_tab,
)""")
    # Remove old ViewSets and functions via regex blocks
    # Remove ProductionReportViewSet
    t = re.sub(r'\nclass ProductionReportViewSet\(viewsets\.ModelViewSet\):.*?\n    def perform_destroy\(self, instance\):.*?instance\.delete\(\)\n', '\n', t, flags=re.S)
    t = re.sub(r'\nclass DeliveredTonnageViewSet\(viewsets\.ModelViewSet\):.*?\n    def perform_destroy\(self, instance\):.*?instance\.delete\(\)\n', '\n', t, flags=re.S)
    t = re.sub(r'\nclass AnalysisTypeDefinitionViewSet\(viewsets\.ModelViewSet\):.*?\n    def perform_destroy\(self, instance\):.*?instance\.delete\(\)\n', '\n', t, flags=re.S)
    t = re.sub(r'\nclass ActualAnalysisViewSet\(viewsets\.ModelViewSet\):.*?\n    def perform_destroy\(self, instance\):.*?instance\.delete\(\)\n', '\n', t, flags=re.S)
    t = re.sub(r'\nclass ContractorViewSet\(viewsets\.ModelViewSet\):.*?\n    def perform_destroy\(self, instance\):.*?instance\.delete\(\)\n', '', t, flags=re.S)
    # But we need ContractorViewSet - re-add minimal one later if deleted
    # Remove helper functions for old system
    for name in ["line_analysis_schema_view","production_line_detail_view","formula_validate_view","line_analysis_positions_view","line_analysis_position_detail_view","line_analysis_definition_view","line_analysis_definition_upsert_view","line_additional_inputs_view","line_additional_input_detail_view","line_outputs_view","line_output_detail_view","factory_analysis_definition_view","factory_analysis_inputs_view","factory_analysis_input_detail_view","factory_analysis_outputs_view","factory_analysis_output_detail_view","factory_analysis_schema_view","formula_validate_factory_view","tonnage_definition_view","tonnage_inputs_view","tonnage_input_detail_view","tonnage_outputs_view","tonnage_output_detail_view","tonnage_schema_view","formula_validate_tonnage_view"]:
        # Remove @api_view block for that function
        pat = rf'\n@api_view\(.*?\)\n@permission_classes.*?def {name}\(.*?\).*?(?=\n@api_view|\nclass |\n# ══|\Z)'
        t = re.sub(pat, '\n', t, flags=re.S)
    # Fix FactoryDetailViewSet prefetch - remove old analysis/tonnage prefetches
    t = t.replace(
        '''            "lines__analysis_positions__definition__inputs",
            "lines__analysis_definition__additional_inputs",
            "lines__analysis_definition__outputs",
            "lines__tonnage_definition__inputs",
            "lines__tonnage_definition__outputs",
            "factory_analysis_definition__inputs",
            "factory_analysis_definition__outputs",''',
        ''
    )
    # Re-add ContractorViewSet minimal (was deleted)
    if "class ContractorViewSet" not in t:
        contractor_code = '''
class ContractorViewSet(viewsets.ModelViewSet):
    serializer_class = ContractorSerializer
    pagination_class = None
    required_permission = "settings.view"
    action_permissions = {"create": "contractor.manage", "update": "contractor.manage", "partial_update": "contractor.manage", "destroy": "contractor.manage"}
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
    def perform_update(self, serializer):
        factory = get_user_factory(self.request.user)
        if factory is not None:
            serializer.save(factory=factory)
        else:
            serializer.save()
    def perform_destroy(self, instance):
        instance.delete()
'''
        # Insert before FactoryTabViewSet
        t = t.replace("class FactoryTabViewSet", contractor_code + "\nclass FactoryTabViewSet")
    # Clean double newlines
    t = re.sub(r"\n{3,}", "\n\n", t)
    p.write_text(t, encoding="utf-8")
    print("views cleaned", len(t))
    return t

def clean_urls():
    p = pathlib.Path("machines/urls.py")
    t = p.read_text(encoding="utf-8")
    t = t.replace("    ProductionReportViewSet,\n", "")
    t = t.replace("    ContractorViewSet,\n", "")
    # keep ContractorViewSet - need to re-add import
    if "ContractorViewSet" not in t:
        t = t.replace("    ProductionLineViewSet,\n", "    ProductionLineViewSet,\n    ContractorViewSet,\n")
    for old in ["AnalysisTypeDefinitionViewSet","ActualAnalysisViewSet","DeliveredTonnageViewSet","performance_report_view","report_ranges_view","line_analysis_schema_view","line_analysis_positions_view","line_analysis_position_detail_view","line_analysis_definition_view","line_analysis_definition_upsert_view","line_additional_inputs_view","line_additional_input_detail_view","line_outputs_view","line_output_detail_view","production_line_detail_view","formula_validate_view","factory_analysis_definition_view","factory_analysis_inputs_view","factory_analysis_input_detail_view","factory_analysis_outputs_view","factory_analysis_output_detail_view","factory_analysis_schema_view","formula_validate_factory_view","tonnage_definition_view","tonnage_inputs_view","tonnage_input_detail_view","tonnage_outputs_view","tonnage_output_detail_view","tonnage_schema_view","formula_validate_tonnage_view"]:
        t = t.replace(f"    {old},\n", "")
    t = re.sub(r"router\.register\(r\"production-reports\".*?\n", "", t, flags=re.S)
    t = re.sub(r"router\.register\(r\"analysis-type-definitions\".*?\n", "", t, flags=re.S)
    t = re.sub(r"router\.register\(r\"actual-analyses\".*?\n", "", t, flags=re.S)
    t = re.sub(r"router\.register\(r\"delivered-tonnages\".*?\n", "", t, flags=re.S)
    t = re.sub(r"router\.register\(r\"contractors\".*?\n", "", t, flags=re.S)
    # Re-add contractors
    t = t.replace(
        'router.register(r"failure-reasons"',
        'router.register(r"contractors", ContractorViewSet, basename="contractors")\nrouter.register(r"failure-reasons"'
    )
    # Remove old path blocks
    t = re.sub(r"    path\(\n        \"api/reports/ranges/\".*?\),\n", "", t, flags=re.S)
    t = re.sub(r"    path\(\n        \"api/reports/performance/\".*?\),\n", "", t, flags=re.S)
    t = re.sub(r"    # ── سیستم آنالیز داینامیک ──.*?    # ── تناژ تحویلی خطوط تولید ──\n", "    # ── تب‌های داینامیک کارخانه ──\n", t, flags=re.S)
    # The tonnage section after that was already replaced, but ensure duplicate header not doubled
    t = re.sub(r"    # ── تب‌های داینامیک کارخانه ──\n    # ── تب‌های داینامیک کارخانه ──\n", "    # ── تب‌های داینامیک کارخانه ──\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    p.write_text(t, encoding="utf-8")
    print("urls cleaned", len(t))

def clean_filters():
    p = pathlib.Path("machines/filters.py")
    t = """import django_filters
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
"""
    p.write_text(t, encoding="utf-8")
    print("filters cleaned")

def clean_admin():
    p = pathlib.Path("machines/admin.py")
    t = p.read_text(encoding="utf-8")
    t = t.replace("""from .models import (
    DeviceLog,
    Factory,
    FailureReason,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
    Attribute,
    DeviceTemplate,
    Device,
    Shift,
    ProductionReport,
    Contractor,
    AnalysisTypeDefinition,
    AnalysisInputDefinition,
    AnalysisPosition,
    LineAnalysisDefinition,
    AdditionalInputDefinition,
    AnalysisOutputDefinition,
    ActualAnalysis,
    FactoryAnalysisDefinition,
    FactoryAnalysisInput,
    FactoryAnalysisOutput,
    DeliveredTonnageDefinition,
    DeliveredTonnageInput,
    DeliveredTonnageOutput,
    DeliveredTonnage,
    FactoryTab,
    FactoryTabInput,
    FactoryTabOutput,
    FactoryTabRecord,
    FactoryTabReport,
    FactoryTabWidget,
)
from .analysis import (
    build_schema as build_analysis_schema,
    validate_and_compute,
    formula_variables_for_line,
)
from .factory_analysis import formula_variables_for_factory
from .tonnage import formula_variables_for_tonnage
from .factory_tabs import formula_variables_for_tab""", """from .models import (
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
from .factory_tabs import formula_variables_for_tab""")
    # Remove old admin classes via regex
    for cls in ["LineAnalysisDefinitionInline","ProductionReportAdmin","AnalysisInputDefinitionInline","AnalysisTypeDefinitionAdmin","AdditionalInputDefinitionInline","AnalysisOutputDefinitionInline","AnalysisPositionAdmin","LineAnalysisDefinitionAdmin","ActualAnalysisAdminForm","ActualAnalysisAdmin","FactoryAnalysisInputInline","FactoryAnalysisOutputInline","FactoryAnalysisDefinitionAdmin","DeliveredTonnageInputInline","DeliveredTonnageOutputInline","DeliveredTonnageDefinitionAdmin","DeliveredTonnageAdmin"]:
        # Find class definition
        pat = rf"\nclass {cls}\(.*?\).*?(?=\nclass |\n@admin\.register|\Z)"
        t2 = re.sub(pat, "\n", t, flags=re.S)
        if t2 != t:
            print(f"removed {cls}")
            t = t2
        else:
            print(f"not found {cls}")
    # Remove ContractorAdmin? Keep it!
    # Clean FactoryAdmin old link
    t = t.replace(
        """@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display = ("name", "address", "analysis_definition_link")
    list_display_links = ("name",)
    search_fields = ("name",)

    def analysis_definition_link(self, obj):
        try:
            definition = obj.factory_analysis_definition
        except FactoryAnalysisDefinition.DoesNotExist:
            add_url = reverse("admin:machines_factoryanalysisdefinition_add")
            return format_html(
                '<a class="button" href="{}?factory={}">افزودن تعریف آنالیز کارخانه</a>',
                add_url,
                obj.pk,
            )
        url = reverse(
            "admin:machines_factoryanalysisdefinition_change", args=[definition.pk]
        )
        return format_html(
            '<a href="{}">تعریف آنالیز کارخانه ({})</a>', url, definition.pk
        )

    analysis_definition_link.short_description = "آنالیز کارخانه\"""",
        """@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display = ("name", "address")
    list_display_links = ("name",)
    search_fields = ("name",)"""
    )
    # Clean ProductionLineAdmin old links
    t = t.replace(
        '    list_display = (\n        "name",\n        "factory",\n        "template",\n        "analysis_definition_link",\n        "tonnage_definition_link",\n        "display_attributes",\n    )',
        '    list_display = ("name", "factory", "template", "display_attributes")'
    )
    t = t.replace('    inlines = [ShiftInline, LineAnalysisDefinitionInline, DeviceInline, DeviceLogInline]', '    inlines = [ShiftInline, DeviceInline, DeviceLogInline]')
    # Remove old link methods
    t = re.sub(r'\n    def analysis_definition_link\(self, obj\):.*?    analysis_definition_link\.short_description = "لایه میانی آنالیز"\n', '\n', t, flags=re.S)
    t = re.sub(r'\n    def tonnage_definition_link\(self, obj\):.*?    tonnage_definition_link\.short_description = "تناژ تحویلی"\n', '\n', t, flags=re.S)
    # Remove ContractorAdmin duplicate? Keep one
    t = re.sub(r"\n{3,}", "\n\n", t)
    p.write_text(t, encoding="utf-8")
    print("admin cleaned", len(t))

def clean_permissions():
    p = pathlib.Path("accounts/permissions.py")
    t = p.read_text(encoding="utf-8")
    # Remove old perms from ALL_PERMISSIONS
    for perm in ["analysis.view","analysis.create","analysis.edit","analysis.delete","analysis.manage","production.view","production.create","production.edit","production.delete","tonnage.view","tonnage.create","tonnage.edit","tonnage.delete","tonnage.manage"]:
        t = t.replace(f'    "{perm}",\n', "")
    # Remove from catalog
    t = re.sub(r'\s*\{"code": "analysis\..*?\},\n', "", t)
    t = re.sub(r'\s*\{"code": "production\..*?\},\n', "", t, flags=re.S)
    t = re.sub(r'\s*\{"code": "tonnage\..*?\},\n', "", t)
    # Remove from manager/operator/viewer sets - do simple replace
    for block in ['"analysis.view"', '"production.view"', '"tonnage.view"', '"analysis.create"', '"production.create"', '"tonnage.create"', '"analysis.edit"', '"production.edit"', '"tonnage.edit"', '"analysis.delete"', '"production.delete"', '"tonnage.delete"', '"analysis.manage"', '"tonnage.manage"', '"contractor.manage"']:
        # keep contractor.manage - it's not old tab specific? Actually Contractor is kept, but perm contractor.manage is for contractors, keep it
        if block == '"contractor.manage"':
            continue
    # For now just remove explicit old blocks via regex
    t = re.sub(r'\s+"analysis\.view",\n', "", t)
    t = re.sub(r'\s+"analysis\.create",\n', "", t)
    t = re.sub(r'\s+"analysis\.edit",\n', "", t)
    t = re.sub(r'\s+"analysis\.delete",\n', "", t)
    t = re.sub(r'\s+"analysis\.manage",\n', "", t)
    t = re.sub(r'\s+"production\.view",\n', "", t)
    t = re.sub(r'\s+"production\.create",\n', "", t)
    t = re.sub(r'\s+"production\.edit",\n', "", t)
    t = re.sub(r'\s+"production\.delete",\n', "", t)
    t = re.sub(r'\s+"tonnage\.view",\n', "", t)
    t = re.sub(r'\s+"tonnage\.create",\n', "", t)
    t = re.sub(r'\s+"tonnage\.edit",\n', "", t)
    t = re.sub(r'\s+"tonnage\.delete",\n', "", t)
    t = re.sub(r'\s+"tonnage\.manage",\n', "", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    p.write_text(t, encoding="utf-8")
    print("permissions cleaned", len(t))

clean_views()
clean_urls()
clean_filters()
clean_admin()
clean_permissions()
print("all done")
