from django.contrib import admin
from django import forms
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.utils.html import format_html, escape
from django.utils.safestring import mark_safe
from django_jsonform.forms.fields import JSONFormField
from .models import (
    DeviceDailyAnalysis,
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
)
from .analysis import (
    build_schema as build_analysis_schema,
    validate_and_compute,
    formula_variables_for_line,
)
import json


def display_attributes_summary(self, obj):
    if not obj.attributes_values:
        return "-"
    return ", ".join([f"{k}: {v}" for k, v in list(obj.attributes_values.items())[:3]])


display_attributes_summary.short_description = "ویژگی‌های فنی"


def build_schema(template_attr_field):
    def make_schema(template):
        properties = {
            attr.name: {
                "type": "number",
                "default": 0,
                "title": f"{attr.name} ({attr.unit if attr.unit else 'واحد ندارد'})",
            }
            for attr in template_attr_field(template).all()
        }
        return {"type": "object", "properties": properties}

    return make_schema


class DynamicJSONFormMixin:
    json_field = "attributes_values"
    schema_builder = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        inst = self.instance
        if inst and inst.pk and self.schema_builder:
            try:
                template = getattr(inst, "template", None)
                if template:
                    self.fields[self.json_field] = JSONFormField(
                        schema=self.schema_builder(template),
                        label=self.fields[self.json_field].label,
                        required=False,
                    )
                    return
            except Exception:
                pass
        if self.json_field in self.fields:
            self.fields[self.json_field].widget = forms.HiddenInput()


class ProductionLineForm(DynamicJSONFormMixin, forms.ModelForm):
    schema_builder = build_schema(lambda t: t.available_attributes)

    class Meta:
        model = ProductionLine
        fields = "__all__"


class DeviceForm(DynamicJSONFormMixin, forms.ModelForm):
    schema_builder = build_schema(lambda t: t.available_attributes)

    class Meta:
        model = Device
        fields = "__all__"


class ShiftInline(admin.TabularInline):
    model = Shift
    extra = 1


class DeviceLogInline(admin.TabularInline):
    model = DeviceLog
    extra = 1
    fields = (
        "date",
        "shift",
        "device",
        "runtime_hours",
        "downtime_hours",
        "failure_cause",
    )
    classes = ["collapse"]


class DeviceInline(admin.TabularInline):
    model = Device
    fields = ("order", "code", "name", "template")
    extra = 0
    ordering = ("order",)


class DeviceDailyAnalysisInline(admin.TabularInline):
    model = DeviceDailyAnalysis
    extra = 0
    fields = ("date", "shift", "value_1", "value_2", "analysis_text")
    ordering = ("-date",)


class LineAnalysisDefinitionInline(admin.StackedInline):
    """لایه‌ی میانی اتصال خط تولید به آنالیزهای واقعی (تعریف ورودی/خروجی/فرمول)."""

    model = LineAnalysisDefinition
    fk_name = "line"
    max_num = 1
    extra = 0
    can_delete = True
    fields = ("contractor_required", "notes", "definition_link", "updated_at")
    readonly_fields = ("definition_link", "updated_at")

    def definition_link(self, obj):
        if not obj.pk:
            return "—"
        url = reverse("admin:machines_lineanalysisdefinition_change", args=[obj.pk])
        return format_html(
            '<a class="button" href="{}">مدیریت ورودی‌ها و فرمول‌های خروجی (لایه میانی)</a>',
            url,
        )

    definition_link.short_description = "فرمول‌ها و خروجی‌ها"


@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display = ("name", "address")
    search_fields = ("name",)
    inlines = [ShiftInline]


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("name", "factory", "start_time", "end_time", "is_active")
    list_filter = ("factory", "is_active")


@admin.register(FailureReason)
class FailureReasonAdmin(admin.ModelAdmin):
    list_display = ("title",)
    search_fields = ("title",)


@admin.register(ProductionLineAttribute)
class ProductionLineAttributeAdmin(admin.ModelAdmin):
    list_display = ("name", "unit")


@admin.register(ProductionLineTemplate)
class ProductionLineTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    filter_horizontal = ("available_attributes",)


@admin.register(ProductionLine)
class ProductionLineAdmin(admin.ModelAdmin):
    form = ProductionLineForm
    list_display = (
        "name",
        "factory",
        "template",
        "analysis_definition_link",
        "display_attributes",
    )
    list_filter = ("factory", "template")
    inlines = [LineAnalysisDefinitionInline, DeviceInline, DeviceLogInline]
    search_fields = ("name",)

    def get_fields(self, request, obj=None):
        if not obj:
            return ("factory", "template", "name", "description")
        return ("factory", "template", "name", "description", "attributes_values")

    display_attributes = display_attributes_summary

    def analysis_definition_link(self, obj):
        try:
            line_def = obj.analysis_definition
        except LineAnalysisDefinition.DoesNotExist:
            return "—"
        url = reverse(
            "admin:machines_lineanalysisdefinition_change", args=[line_def.pk]
        )
        return format_html('<a href="{}">تعریف آنالیز خط ({})</a>', url, line_def.pk)

    analysis_definition_link.short_description = "لایه میانی آنالیز"

    def response_add(self, request, obj, post_url_continue=None):
        return HttpResponseRedirect(
            reverse("admin:machines_productionline_change", args=(obj.pk,))
        )


@admin.register(Attribute)
class AttributeAdmin(admin.ModelAdmin):
    list_display = ("name", "unit")
    search_fields = ("name",)


@admin.register(DeviceTemplate)
class DeviceTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "get_attributes_list")
    filter_horizontal = ("available_attributes",)

    def get_attributes_list(self, obj):
        return ", ".join([a.name for a in obj.available_attributes.all()])

    get_attributes_list.short_description = "ویژگی‌های الگو"


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    form = DeviceForm
    list_display = ("order", "code", "name", "line", "template", "display_attributes")
    display_attributes = display_attributes_summary
    list_editable = ("order",)
    list_display_links = ("name",)
    list_filter = ("line__factory", "line", "template")
    search_fields = ("name", "code", "line__name")

    def get_inline_instances(self, request, obj=None):
        if obj and obj.is_analyzer:
            return [DeviceDailyAnalysisInline(self.model, self.admin_site)]
        return []

    def get_fields(self, request, obj=None):
        if not obj:
            return ("line", "template", "name", "code", "order", "is_analyzer")
        return (
            "line",
            "template",
            "name",
            "code",
            "order",
            "is_analyzer",
            "attributes_values",
        )

    def response_add(self, request, obj, post_url_continue=None):
        return HttpResponseRedirect(
            reverse("admin:machines_device_change", args=(obj.pk,))
        )


@admin.register(DeviceDailyAnalysis)
class DeviceDailyAnalysisAdmin(admin.ModelAdmin):
    list_display = ("device", "date", "shift", "created_at")
    list_filter = ("date", "shift__factory")
    search_fields = ("device__name", "analysis_text")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "device":
            kwargs["queryset"] = Device.objects.filter(is_analyzer=True)
        if db_field.name == "shift":
            obj_id = request.resolver_match.kwargs.get("object_id")
            if obj_id:
                obj = self.get_object(request, obj_id)
                if obj and obj.device:
                    kwargs["queryset"] = Shift.objects.filter(
                        factory=obj.device.line.factory
                    )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(DeviceLog)
class DeviceLogAdmin(admin.ModelAdmin):
    list_display = (
        "line",
        "date",
        "shift",
        "runtime_hours",
        "downtime_hours",
        "efficiency",
        "failure_cause",
        "device",
    )
    list_filter = ("line__factory", "line", "shift", "failure_cause", "date")
    search_fields = (
        "line__name",
        "device__name",
        "failure_description",
        "repair_description",
    )
    readonly_fields = ("created_at", "efficiency")

    fieldsets = (
        ("اطلاعات کلی", {"fields": ("line", "date", "shift")}),
        (
            "اطلاعات خرابی / توقف",
            {
                "fields": (
                    "device",
                    "failure_cause",
                    "failure_description",
                    "repair_description",
                )
            },
        ),
        ("ساعات عملکرد", {"fields": ("runtime_hours", "downtime_hours")}),
        ("متفرقه", {"fields": ("created_at",)}),
    )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        obj_id = request.resolver_match.kwargs.get("object_id")
        log_obj = self.get_object(request, obj_id) if obj_id else None
        if db_field.name == "device" and log_obj:
            kwargs["queryset"] = Device.objects.filter(line=log_obj.line)
        if db_field.name == "shift" and log_obj:
            kwargs["queryset"] = Shift.objects.filter(factory=log_obj.line.factory)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(ProductionReport)
class ProductionReportAdmin(admin.ModelAdmin):
    list_display = (
        "line",
        "contractor",
        "date_from",
        "date_to",
        "batala_avalieh",
        "darsad_batale",
        "darsad_dane_dorosht",
    )
    list_filter = ("line__factory", "line", "contractor")
    search_fields = ("line__name", "note")
    readonly_fields = ("created_at",)
    fieldsets = (
        (
            "اطلاعات کلی",
            {"fields": ("line", "contractor", "date_from", "date_to")},
        ),
        (
            "آنالیز خطوط تولید",
            {
                "fields": (
                    "batala_avalieh",
                    "darsad_batale",
                    "darsad_dane_dorosht",
                    "darsad_rotobat",
                    "darsad_takhfif",
                    "darsad_jerime",
                )
            },
        ),
        ("سایر", {"fields": ("note", "created_at")}),
    )


class AnalysisInputDefinitionInline(admin.TabularInline):
    model = AnalysisInputDefinition
    extra = 0
    fields = ("key", "name", "input_type", "unit", "required", "order")


@admin.register(Contractor)
class ContractorAdmin(admin.ModelAdmin):
    list_display = ("name", "factory", "contact_name", "phone", "is_active")
    list_filter = ("factory", "is_active")
    search_fields = ("name", "contact_name")


@admin.register(AnalysisTypeDefinition)
class AnalysisTypeDefinitionAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)
    inlines = [AnalysisInputDefinitionInline]


class AdditionalInputDefinitionInline(admin.TabularInline):
    model = AdditionalInputDefinition
    extra = 0
    fields = ("key", "name", "input_type", "unit", "required", "order")


class AnalysisOutputDefinitionInline(admin.StackedInline):
    model = AnalysisOutputDefinition
    extra = 1  # همیشه یک ردیف فرمول‌نویس آماده دیده شود
    fields = (("key", "name", "unit", "order"), "formula")

    class Media:
        js = ("madan_admin/js/formula_builder.js",)
        css = {"all": ("madan_admin/css/formula_builder.css",)}

    def get_formset(self, request, obj=None, **kwargs):
        variables = []
        line_id = ""
        if obj is not None:
            variables = formula_variables_for_line(obj.line)
            line_id = obj.line_id
        validate_url = reverse("formula-validate")
        formset_cls = super().get_formset(request, obj, **kwargs)

        class OutputFormSet(formset_cls):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                widget = FormulaInputWidget(
                    variables=variables,
                    validate_url=validate_url,
                    line_id=line_id,
                )
                for form in self.forms:
                    if "formula" in form.fields:
                        form.fields["formula"].widget = widget
                # ردیف‌های خالی («افزودن خروجی جدید») هم همین ویرایشگر را داشته باشند
                try:
                    if "formula" in self.empty_form.fields:
                        self.empty_form.fields["formula"].widget = widget
                except Exception:  # noqa: BLE001
                    pass

        return OutputFormSet


class FormulaInputWidget(forms.Textarea):
    """ویرایشگر فرمول: متن بزرگ + لیست قابل کلیک تمام ورودی‌ها/متغیرها کنار فرمول.

    کلیک روی هر متغیر، استرینگ آن را داخل فرمول (محل نشانگر) می‌نویسد.
    """

    def __init__(self, attrs=None, variables=None, validate_url="", line_id=""):
        super().__init__(attrs)
        self.variables = variables or []
        self.validate_url = validate_url
        self.line_id = line_id or ""

    def render(self, name, value, attrs=None, renderer=None):
        attrs = dict(attrs or {})
        attrs["class"] = (attrs.get("class", "") + " formula-source fb-textarea").strip()
        attrs["cols"] = 60
        attrs["rows"] = 6
        attrs["placeholder"] = "مثال: (feed.fe - tail.fe) / (product.fe - tail.fe) * 100"
        text = super().render(name, value, attrs, renderer)
        vars_json = json.dumps(self.variables, ensure_ascii=False)
        vars_json_attr = escape(vars_json)
        out = (
            '<div class="fb-layout">'
            '<div class="fb-main">'
            + text
            + (
                '<div class="fb-tools">'
                '<div class="fb-tool-row">'
                '<span class="fb-tool-label">عملگر</span><span class="fb-ops"></span>'
                '<span class="fb-tool-label fb-label-fns">تابع</span><span class="fb-fns"></span>'
                "</div>"
                '<div class="fb-tool-row">'
                '<span class="fb-tool-label">عدد</span>'
                '<input type="text" class="fb-num" placeholder="مثلاً 100" />'
                '<button type="button" class="fb-btn fb-add-num">+ عدد</button>'
                "</div>"
                '<div class="fb-tool-row fb-validate-row">'
                '<button type="button" class="fb-btn fb-btn-validate">اعتبارسنجی فرمول</button>'
                '<span class="fb-result"></span>'
                "</div>"
                "</div>"
            )
            + "</div>"
            '<div class="fb-vars">'
            '<div class="fb-vars-title">ورودی‌ها و متغیرهای موجود — کلیک = افزودن به فرمول</div>'
            '<div class="fb-chips"></div>'
            "</div>"
            f'<div class="fb-data" data-vars="{vars_json_attr}" '
            f'data-url="{self.validate_url}" data-line="{self.line_id}" '
            'style="display:none"></div>'
            "</div>"
        )
        # خروجی را safe می‌کنیم تا Django دوباره کل HTML را escape نکند
        return mark_safe(out)


@admin.register(AnalysisPosition)
class AnalysisPositionAdmin(admin.ModelAdmin):
    list_display = ("line", "name", "key", "definition", "order")
    list_filter = ("line__factory", "line", "definition")
    search_fields = ("line__name", "name")


@admin.register(LineAnalysisDefinition)
class LineAnalysisDefinitionAdmin(admin.ModelAdmin):
    """
    جریان دو مرحله‌ای:
    مرحله ۱ (افزودن): انتخاب خط + ورودی‌های اضافه (متغیرهای ورودی).
    مرحله ۲ (تغییر): تعریف خروجی‌ها با ویرایشگر فرمول که همه‌ی ورودی‌ها را نشان می‌دهد.
    """

    list_display = (
        "line",
        "factory",
        "contractor_required",
        "inputs_count",
        "outputs_count",
        "updated_at",
    )
    list_filter = ("line__factory", "contractor_required")
    search_fields = ("line__name",)
    readonly_fields = ("line_variables_preview", "updated_at")

    class Media:
        js = ("madan_admin/js/line_def_step1.js",)
        css = {"all": ("madan_admin/css/formula_builder.css",)}

    def get_inlines(self, request, obj):
        # مرحله ۱: فقط ورودی‌های اضافه و متغیرها؛ مرحله ۲: + خروجی‌ها
        if obj is None:
            return [AdditionalInputDefinitionInline]
        return [AdditionalInputDefinitionInline, AnalysisOutputDefinitionInline]

    def get_fieldsets(self, request, obj=None):
        base = ["line", "contractor_required", "notes"]
        if obj is None:
            # در افزودن، پیش‌نمایش زنده‌ی ورودی‌های موقعیت‌ها نمایش داده می‌شود
            base = base + ["line_variables_preview"]
        return [
            (
                "اطلاعات پایه (انتخاب خط و تنظیمات)",
                {"fields": base},
            ),
        ]

    def response_add(self, request, obj, post_url_continue=None):
        self.message_user(
            request,
            "مرحله ۱ ثبت شد؛ حالا در همین صفحه خروجی‌ها را تعریف کنید (مرحله ۲).",
        )
        return HttpResponseRedirect(
            reverse("admin:machines_lineanalysisdefinition_change", args=(obj.pk,))
        )

    def factory(self, obj):
        return obj.line.factory

    factory.short_description = "کارخانه"

    def inputs_count(self, obj):
        return obj.additional_inputs.count()

    inputs_count.short_description = "ورودی‌های اضافه"

    def outputs_count(self, obj):
        return obj.outputs.count()

    outputs_count.short_description = "خروجی‌ها / فرمول‌ها"

    def line_variables_preview(self, obj):
        """نمایش ورودی‌های قابل‌استفاده در فرمول (موقعیت‌ها + ورودی‌های اضافه)."""
        if obj is None or obj.line_id is None:
            inner = (
                '<span class="fb-empty">با انتخاب خط تولید، ورودی‌های موقعیت‌ها و '
                "متغیرهای قابل‌استفاده اینجا نمایش داده می‌شود.</span>"
            )
        else:
            inner = self._variables_html(formula_variables_for_line(obj.line))
        return mark_safe(
            f'<div id="line-vars-preview" class="fb-vars-preview">'
            f'<div class="fb-vars-title">ورودی‌های موجود (موقعیت‌های آنالیز خط + ورودی‌ها)</div>'
            f'{inner}</div>'
        )

    line_variables_preview.short_description = "ورودی‌های قابل‌استفاده"

    def _variables_html(self, items):
        groups = {}
        for item in items:
            groups.setdefault(item["group"], []).append(item)
        if not groups:
            return '<span class="fb-empty">ورودی/متغیری تعریف نشده است.</span>'
        parts = []
        for group, arr in groups.items():
            parts.append(f'<div class="fb-chips-group">{escape(group)}</div>')
            for item in arr:
                label = escape(item["label"])
                var = escape(item["var"])
                parts.append(
                    f'<span class="fb-chip-static" data-var="{var}" title="{var}">{label}</span>'
                )
        return "".join(parts)


class ActualAnalysisAdminForm(forms.ModelForm):
    """فرم داینامیک: بر اساس خط انتخاب‌شده، فیلدهای ورودی/خروجی را می‌سازد و خروجی را محاسبه می‌کند."""

    class Meta:
        model = ActualAnalysis
        fields = ["line", "date_from", "date_to", "shift", "contractor"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["contractor"].queryset = Contractor.objects.none()
        self.fields["shift"].queryset = Shift.objects.none()
        line_id = self._resolve_line_id()
        if line_id:
            self._build_dynamic_fields(line_id)

    def _resolve_line_id(self):
        raw = None
        if self.data:
            raw = self.data.get("line")
        if not raw and getattr(self, "request", None):
            raw = self.request.GET.get("line")
        if not raw and self.instance and self.instance.pk:
            raw = self.instance.line_id
        if not raw:
            raw = self.initial.get("line")
        return raw

    def _build_dynamic_fields(self, line_id):
        try:
            line = ProductionLine.objects.select_related("factory").get(pk=line_id)
        except ProductionLine.DoesNotExist:
            return
        schema = build_analysis_schema(line)
        self.fields["contractor"].queryset = Contractor.objects.filter(
            factory=line.factory_id, is_active=True
        ).order_by("name")
        self.fields["shift"].queryset = Shift.objects.filter(factory=line.factory_id)

        existing_positions = {}
        existing_additional = {}
        if self.instance and self.instance.pk and self.instance.inputs:
            existing_positions = self.instance.inputs.get("positions", {})
            existing_additional = self.instance.inputs.get("additional_inputs", {})

        for pos in schema["positions"]:
            for inp in pos["inputs"]:
                name = f'pos_{pos["id"]}_{inp["key"]}'
                initial = ""
                if existing_positions:
                    val = existing_positions.get(pos["key"], {}).get(inp["key"])
                    if val is not None:
                        initial = val
                self.fields[name] = forms.DecimalField(
                    required=inp["required"],
                    initial=initial,
                    label=f'{pos["name"]} — {inp["name"]}'
                    + (f" ({inp['unit']})" if inp.get("unit") else ""),
                )
        for add in schema["additional_inputs"]:
            name = f'add_{add["key"]}'
            initial = ""
            if existing_additional:
                val = existing_additional.get(add["key"])
                if val is not None:
                    initial = val
            self.fields[name] = forms.DecimalField(
                required=add["required"],
                initial=initial,
                label=add["name"] + (f" ({add['unit']})" if add.get("unit") else ""),
            )

    def save(self, commit=True):
        instance = super().save(commit=False)
        if (
            instance.date_from
            and instance.date_to
            and instance.date_to < instance.date_from
        ):
            raise forms.ValidationError(
                {"date_to": "تاریخ پایان بازه نمی‌تواند قبل از تاریخ شروع باشد."}
            )
        positions = {}
        additional = {}
        for name, value in self.cleaned_data.items():
            if value is None or value == "":
                continue
            if name.startswith("pos_"):
                _, pos_id, input_key = name.split("_", 2)
                positions.setdefault(pos_id, {})[input_key] = float(value)
            elif name.startswith("add_"):
                additional[name[4:]] = float(value)

        payload = {"positions": positions, "additional_inputs": additional}
        if instance.contractor_id:
            payload["contractor_id"] = instance.contractor_id
        try:
            inputs, outputs = validate_and_compute(instance.line, payload)
        except ValueError as e:
            raise forms.ValidationError(str(e))
        instance.inputs = inputs
        instance.outputs = outputs
        request = getattr(self, "request", None)
        if request is not None and getattr(request, "user", None):
            instance.created_by = request.user
        if commit:
            instance.save()
        return instance


@admin.register(ActualAnalysis)
class ActualAnalysisAdmin(admin.ModelAdmin):
    form = ActualAnalysisAdminForm
    list_display = (
        "line",
        "date_range",
        "contractor",
        "outputs_summary",
        "created_by",
        "created_at",
    )
    list_filter = ("line__factory", "line", "contractor")
    search_fields = ("line__name",)
    readonly_fields = ("outputs", "created_at", "created_by")
    save_on_top = True

    class Media:
        js = ("madan_admin/js/actual_analysis_line.js",)

    def date_range(self, obj):
        if obj.date_from == obj.date_to:
            return obj.date_from
        return f"{obj.date_from} تا {obj.date_to}"

    date_range.short_description = "بازه تاریخ"

    def outputs_summary(self, obj):
        if not obj.outputs:
            return "—"
        return ", ".join(f"{k}: {v}" for k, v in obj.outputs.items())

    outputs_summary.short_description = "خروجی‌های محاسبه‌شده"

    def get_form(self, request, obj=None, change=False, **kwargs):
        request_holder = [request]

        class DynamicActualAnalysisForm(self.form):
            def __init__(self, *args, **form_kwargs):
                self.request = request_holder[0]
                super().__init__(*args, **form_kwargs)

        return DynamicActualAnalysisForm

    def get_fields(self, request, obj=None):
        base = ["line", "date_from", "date_to", "shift", "contractor"]
        if getattr(request, "method", None) == "POST":
            line_id = request.POST.get("line")
        else:
            line_id = request.GET.get("line") or (obj.line_id if obj else None)
        if line_id:
            try:
                schema = build_analysis_schema(
                    ProductionLine.objects.select_related("factory").get(pk=line_id)
                )
            except ProductionLine.DoesNotExist:
                schema = None
            if schema:
                for pos in schema["positions"]:
                    for inp in pos["inputs"]:
                        base.append(f'pos_{pos["id"]}_{inp["key"]}')
                for add in schema["additional_inputs"]:
                    base.append(f'add_{add["key"]}')
        return base + ["outputs", "created_at", "created_by"]
