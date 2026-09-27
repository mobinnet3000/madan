import pathlib, re
p = pathlib.Path("machines/serializers.py")
t = p.read_text(encoding="utf-8")

# 1. Fix imports: remove old models
old_imports = """from .models import (
    Factory,
    Shift,
    FailureReason,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
    Attribute,
    DeviceTemplate,
    Device,
    DeviceLog,
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
)"""
new_imports = """from .models import (
    Contractor,
    Factory,
    FactoryTab,
    FactoryTabInput,
    FactoryTabOutput,
    FactoryTabRecord,
    FactoryTabReport,
    FactoryTabWidget,
    Device,
    DeviceLog,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
    Shift,
    Attribute,
    DeviceTemplate,
    FailureReason,
)"""
if old_imports in t:
    t = t.replace(old_imports, new_imports)
    print("imports fixed")
else:
    print("imports not found")

# 2. Remove _attr_defs helper if needed later - keep it for any future use, but move minimal

# 3. Remove old serializer classes by finding their class definitions and deleting until next class/def at same indent
# We will do regex-based removal for known blocks

# Helper to remove a class block
def remove_class(text, classname):
    # Find "class ClassName" and remove until next "\nclass " or "\ndef _sync" or "\n# ===" at col 0
    # Use simple approach: find start, find next "\nclass " after it
    start = text.find(f"class {classname}")
    if start == -1:
        print(f"not found {classname}")
        return text
    # Find next class at column 0 after start+len
    next_pos = -1
    for pat in ["\nclass ", "\ndef _sync", "\n# \u2550", "\nclass FactoryTab"]:
        idx = text.find(pat, start + 1)
        if idx != -1 and (next_pos == -1 or idx < next_pos):
            next_pos = idx
    if next_pos == -1:
        print(f"no next for {classname}")
        return text
    # If next is FactoryTab family, keep it
    new_text = text[:start] + text[next_pos:]
    # Clean double blank lines
    print(f"removed {classname}")
    return new_text

# Order matters: remove from bottom to top to keep indices stable, or just sequentially since we search again
to_remove = [
    "AnalysisInputDefinitionSerializer",
    "AnalysisTypeDefinitionSerializer",
    "AnalysisPositionSerializer",
    "TonnageInputBriefSerializer",
    "TonnageOutputBriefSerializer",
    "TonnageDefinitionBriefSerializer",
    "ProductionLineSerializer",
    "FactoryAnalysisInputBriefSerializer",
    "FactoryAnalysisOutputBriefSerializer",
    "FactoryAnalysisDefinitionBriefSerializer",
    "FactoryFullDetailSerializer",
    "ProductionReportSerializer",
    "ProductionReportWriteSerializer",
    "AdditionalInputDefinitionSerializer",
    "AnalysisOutputDefinitionSerializer",
    "LineAnalysisDefinitionSerializer",
    "ActualAnalysisSerializer",
    "FactoryAnalysisInputSerializer",
    "FactoryAnalysisOutputSerializer",
    "FactoryAnalysisDefinitionSerializer",
    "DeliveredTonnageInputSerializer",
    "DeliveredTonnageOutputSerializer",
    "DeliveredTonnageDefinitionSerializer",
    "DeliveredTonnageSerializer",
    "DeliveredTonnageWriteSerializer",
]

# Also remove helper functions: _sync_inputs, _sync_line_def_nested, _sync_additional_inputs, _sync_outputs, _sync_factory_nested, _sync_factory_inputs, _sync_factory_outputs, _sync_tonnage_nested, etc.
# We'll handle those via regex after class removal

# First, move keepers: keep _attr_defs, ContractorSerializer, FailureReasonSerializer, FactorySerializer etc.
# Need to save keepers before removal: let's just remove classes listed

# To avoid messing with FactoryTab serializers, we do targeted removal only for old names
for name in to_remove:
    t = remove_class(t, name)

# Remove helper functions for old sync
helpers = ["def _sync_inputs", "def _sync_line_def_nested", "def _sync_additional_inputs", "def _sync_outputs", "def _sync_factory_nested", "def _sync_factory_inputs", "def _sync_factory_outputs", "def _sync_tonnage_nested", "def _sync_tonnage_inputs", "def _sync_tonnage_outputs"]
for h in helpers:
    start = t.find(f"\n{h}")
    if start == -1:
        print(f"helper not found {h}")
        continue
    # find next def at same indent (\ndef ) after start+1
    # Also "\nclass " is boundary
    next_pos = t.find("\nclass ", start+1)
    next_def = t.find("\ndef ", start+1)
    candidates = [x for x in [next_pos, next_def] if x != -1]
    if not candidates:
        print(f"no next for helper {h}")
        continue
    end = min(candidates)
    # Don't delete if next is FactoryTab family helper _sync_tab_nested etc - ensure we don't delete those
    # _sync_tab_* should be kept
    if "_sync_tab" in t[end:end+30]:
        # find next after that
        end2 = t.find("\nclass ", end+1)
        end3 = t.find("\ndef ", end+1)
        cands2 = [x for x in [end2, end3] if x!=-1]
        if cands2:
            end = min(cands2)
        else:
            print(f"skip helper {h} would delete tab")
            continue
    # Actually check if this helper is tab-related: it shouldn't be in helpers list
    # So safe to delete up to end
    # But ensure we don't delete too much: if helper is _sync_inputs (old) it will hit next def which is _sync_line_def etc which is also to delete - that's okay we will delete sequentially
    # So find immediate next def after start
    # For now just delete to end
    # Workaround: delete only up to next def
    t = t[:start] + t[end:]
    print(f"removed helper {h}")

# Also remove duplicate imports that may have been left: clean double blank lines
t = re.sub(r"\n{3,}", "\n\n", t)

# Ensure _attr_defs and jalali import remain
# _attr_defs is kept, but FactoryTabBriefSerializer uses no _attr_defs - okay
# Check for duplicate jalali import

# Now fix FactoryFullDetail vs new detail: we removed old FactoryFullDetailSerializer, but we need a new one for factory tabs only
# If missing, create it

if "class FactoryFullDetailSerializer" not in t:
    # Add a minimal version after FactoryAnalysisDefinitionBriefSerializer removal area - insert before FactoryMinSerializer
    insert = '''
class FactoryFullDetailSerializer(serializers.ModelSerializer):
    shifts = serializers.SerializerMethodField()
    lines = ProductionLineSerializerMinimal(many=True, read_only=True) if False else serializers.SerializerMethodField()
    contractors = ContractorSerializer(many=True, read_only=True)
    report_tabs = serializers.SerializerMethodField()

    class Meta:
        model = Factory
        fields = ["id", "name", "address", "shifts", "lines", "failure_reasons", "contractors", "report_tabs"]

    def get_shifts(self, obj):
        from .models import Shift
        return ShiftSerializer(Shift.objects.filter(line__factory=obj), many=True).data

    def get_lines(self, obj):
        from .models import ProductionLine
        # Minimal line rep to avoid circular
        lines = obj.lines.all().prefetch_related("devices", "shifts")
        return [{"id": l.id, "name": l.name, "description": l.description, "line_type": l.line_type} for l in lines]

    def get_failure_reasons(self, obj):
        return FailureReasonSerializer(FailureReason.objects.all(), many=True).data

    def get_report_tabs(self, obj):
        qs = obj.report_tabs.filter(is_active=True).prefetch_related("inputs", "outputs")
        return FactoryTabBriefSerializer(qs, many=True).data

'''
    # Insert before FactoryMinSerializer
    idx = t.find("class FactoryMinSerializer")
    if idx != -1:
        t = t[:idx] + insert + "\n" + t[idx:]
        print("inserted new FactoryFullDetailSerializer")

# Fix ProductionLineSerializer if removed and needed for new detail: ensure minimal exists
# Not needed, we use inline in get_lines

# Clean again
t = re.sub(r"\n{3,}", "\n\n", t)
p.write_text(t, encoding="utf-8")
print("written", len(t))
print("remaining classes:", re.findall(r"^class (\w+)", t, re.M))
