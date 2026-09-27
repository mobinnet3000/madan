from django.contrib import admin
from django import forms
from django.urls import reverse
from django.http import HttpResponseRedirect
from django.utils.html import format_html, escape
from django.utils.safestring import mark_safe
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
from .factory_tabs import formula_variables_for_tab
import json

def display_attributes_summary(self, obj):
    if not obj.attributes_values:
        return "-"
    return ", ".join([f"{k}: {v}" for k, v in list(obj.attributes_values.items())[:3]])

display_attributes_summary.short_description = "ویژگی‌های فنی"

class AttributeValuesFormMixin:
    """فرم ویژگی‌ها بر اساس الگو: یک فیلد عددی برای هر ویژگیِ الگو.

    همراه با جریان دو مرحله‌ای ادمین:
    مرحله ۱ (افزودن): اطلاعات پایه + انتخاب الگو.
    مرحله ۲ (تغییر): مقداردهی ویژگی‌های خوانده‌شده از الگو.
    """

    template_model = None  # e.g. ProductionLineTemplate

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._attr_map = {}
        template = self._resolve_template()
        if template is not None:
            existing = self.instance.attributes_values or {}
            for attr in template.available_attributes.all():
                fname = f"attr_{attr.id}"
                self._attr_map[fname] = attr
                initial = existing.get(attr.name)
                self.fields[fname] = forms.DecimalField(
                    required=False,
                    initial=initial if initial is not None else 0,
                    label=attr.name + (f" ({attr.unit})" if attr.unit else ""),
                    widget=forms.NumberInput(attrs={"step": "any"}),
                )
        if "attributes_values" in self.fields:
            self.fields["attributes_values"].widget = forms.HiddenInput()
            self.fields["attributes_values"].required = False

    def _resolve_template(self):
        raw = self.data.get("template") if self.data else None
        if raw:
            pk = raw[0] if isinstance(raw, list) else raw
            try:
                return self.template_model.objects.get(pk=pk)
            except (self.template_model.DoesNotExist, TypeError, ValueError):
                pass
        if self.instance and self.instance.pk and self.instance.template_id:
            return self.instance.template
        return None

    def save(self, commit=True):
        instance = super().save(commit=False)
        values = dict(instance.attributes_values or {})
        for fname, attr in self._attr_map.items():
            raw = self.cleaned_data.get(fname)
            values[attr.name] = float(raw) if raw not in (None, "") else 0
        instance.attributes_values = values
        if commit:
            instance.save()
        return instance

# class AttributeFieldsAdminMixin:
#     """پشتیبانی ادمین از فیلدهای داینامیک ویژگی‌ها (مرحله ۲) در fieldsets."""

#     template_model = None
#     step1_fields = ()

#     def _template_from_request(self, request, obj):
#         raw = (request.POST or request.GET).get("template")
#         if raw:
#             try:
#                 return self.template_model.objects.get(pk=raw)
#             except (self.template_model.DoesNotExist, TypeError, ValueError):
#                 pass
#         if obj is not None and obj.template_id:
#             return obj.template
#         return None

#     def _attr_field_names(self, request, obj):
#         template = self._template_from_request(request, obj)
#         if template is None:
#             return []
#         return [f"attr_{a.id}" for a in template.available_attributes.all()]

#     def get_fieldsets(self, request, obj=None):
#         fieldsets = [
#             ("مرحله ۱ — اطلاعات پایه و الگو", {"fields": list(self.step1_fields)}),
#         ]
#         attr_fields = self._attr_field_names(request, obj)
#         if attr_fields:
#             fieldsets.append(
#                 ("مرحله ۲ — مقادیر ویژگی‌های الگو", {"fields": attr_fields})
#             )
#         return fieldsets

class AttributeFieldsAdminMixin:
    """پشتیبانی ادمین از فیلدهای داینامیک ویژگی‌ها."""

    template_model = None
    step1_fields = ()

    def _template_from_request(self, request, obj):
        raw = (request.POST or request.GET).get("template")

        if raw:
            try:
                return self.template_model.objects.get(pk=raw)
            except (
                self.template_model.DoesNotExist,
                TypeError,
                ValueError,
            ):
                pass

        if obj is not None and obj.template_id:
            return obj.template

        return None

    def _attr_field_names(self, request, obj):
        template = self._template_from_request(request, obj)

        if template is None:
            return []

        return [
            f"attr_{a.id}"
            for a in template.available_attributes.all()
        ]

    def get_form(self, request, obj=None, change=False, **kwargs):
        kwargs["fields"] = list(self.step1_fields)

        return super().get_form(
            request,
            obj,
            change=change,
            **kwargs,
        )

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            (
                "مرحله ۱ — اطلاعات پایه و الگو",
                {
                    "fields": list(self.step1_fields),
                },
            ),
        ]

        attr_fields = self._attr_field_names(request, obj)

        if attr_fields:
            fieldsets.append(
                (
                    "مرحله ۲ — مقادیر ویژگی‌های الگو",
                    {
                        "fields": attr_fields,
                    },
                )
            )

        return fieldsets
        
class ProductionLineForm(AttributeValuesFormMixin, forms.ModelForm):
    template_model = ProductionLineTemplate

    class Meta:
        model = ProductionLine
        fields = "__all__"

class DeviceForm(AttributeValuesFormMixin, forms.ModelForm):
    template_model = DeviceTemplate

    class Meta:
        model = Device
        fields = "__all__"

class ShiftInline(admin.TabularInline):
    model = Shift
    extra = 1
    fields = ("name", "start_time", "end_time", "is_active")

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

@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display = ("name", "address")
    list_display_links = ("name",)
    search_fields = ("name",)

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("name", "line", "start_time", "end_time", "is_active")
    list_filter = ("line__factory", "line", "is_active")

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
class ProductionLineAdmin(AttributeFieldsAdminMixin, admin.ModelAdmin):
    form = ProductionLineForm
    template_model = ProductionLineTemplate
    step1_fields = ("factory", "template", "name", "description")
    list_display = ("name", "factory", "template", "display_attributes")
    list_filter = ("factory", "template")
    inlines = [ShiftInline, DeviceInline, DeviceLogInline]
    search_fields = ("name",)

    display_attributes = display_attributes_summary

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
class DeviceAdmin(AttributeFieldsAdminMixin, admin.ModelAdmin):
    form = DeviceForm
    template_model = DeviceTemplate
    step1_fields = ("line", "template", "name", "code", "order", "image")
    list_display = ("order", "code", "name", "line", "template", "display_attributes")
    display_attributes = display_attributes_summary
    list_editable = ("order",)
    list_display_links = ("name",)
    list_filter = ("line__factory", "line", "template")
    search_fields = ("name", "code", "line__name")

    def response_add(self, request, obj, post_url_continue=None):
        return HttpResponseRedirect(
            reverse("admin:machines_device_change", args=(obj.pk,))
        )

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
            kwargs["queryset"] = Shift.objects.filter(line=log_obj.line)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

@admin.register(Contractor)
class ContractorAdmin(admin.ModelAdmin):
    list_display = ("name", "factory", "contact_name", "phone", "is_active")
    list_filter = ("factory", "is_active")
    search_fields = ("name", "contact_name")

class FormulaInputWidget(forms.Textarea):
    """ویرایشگر فرمول: متن بزرگ + لیست قابل کلیک تمام ورودی‌ها/متغیرها کنار فرمول.

    کلیک روی هر متغیر، استرینگ آن را داخل فرمول (محل نشانگر) می‌نویسد.
    """

    def __init__(self, attrs=None, variables=None, validate_url="", line_id="", tab_id=""):
        super().__init__(attrs)
        self.variables = variables or []
        self.validate_url = validate_url
        self.line_id = line_id or ""
        self.tab_id = tab_id or ""

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
            f'data-tab="{self.tab_id}" '
            'style="display:none"></div>'
            "</div>"
        )
        # خروجی را safe می‌کنیم تا Django دوباره کل HTML را escape نکند
        return mark_safe(out)

# ═══════════════════ تناژ تحویلی خطوط تولید ═══════════════════

# ═══════════════════ تب‌های داینامیک کارخانه ═══════════════════

class FactoryTabInputForm(forms.ModelForm):
    """گزینه‌ها با کاما جدا می‌شوند، مثلا: الف، ب، ج."""

    options_text = forms.CharField(
        required=False,
        label="گزینه‌ها (با کاما جدا کنید)",
        widget=forms.TextInput(attrs={"size": 40, "dir": "rtl"}),
        help_text="فقط برای نوع «انتخابی».",
    )

    class Meta:
        model = FactoryTabInput
        fields = ("key", "name", "input_type", "options_text", "unit", "required", "order")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk and self.instance.options:
            self.fields["options_text"].initial = "، ".join(self.instance.options)

    def clean(self):
        cleaned = super().clean()
        from django.core.exceptions import ValidationError as _DVE

        from .models import normalize_select_options

        itype = cleaned.get("input_type") or (
            self.instance.input_type if self.instance and self.instance.pk else "number"
        )
        raw = cleaned.get("options_text", "")
        opts = [p.strip() for p in str(raw).replace("،", ",").split(",") if p.strip()]
        if itype == "select":
            label = cleaned.get("name") or cleaned.get("key") or ""
            try:
                normalize_select_options(opts, label=label)
            except _DVE as e:
                raise forms.ValidationError("; ".join(e.messages))
        cleaned["options"] = opts
        return cleaned

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.options = self.cleaned_data.get("options", [])
        if commit:
            instance.save()
        return instance

class FactoryTabInputInline(admin.TabularInline):
    model = FactoryTabInput
    form = FactoryTabInputForm
    extra = 1
    fields = ("key", "name", "input_type", "options_text", "unit", "required", "order")

class FactoryTabOutputInline(admin.StackedInline):
    model = FactoryTabOutput
    extra = 1
    fields = (("key", "name", "unit", "order"), "formula")

    class Media:
        js = ("madan_admin/js/formula_builder.js",)
        css = {"all": ("madan_admin/css/formula_builder.css",)}

    def get_formset(self, request, obj=None, **kwargs):
        variables = []
        line_id = ""
        tab_id = ""
        if obj is not None:
            variables = formula_variables_for_tab(obj)
            tab_id = obj.id
            first_line = obj.factory.lines.first()
            line_id = first_line.id if first_line else ""
        validate_url = reverse("formula-validate-tab")
        formset_cls = super().get_formset(request, obj, **kwargs)

        class TabOutputFormSet(formset_cls):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                widget = FormulaInputWidget(
                    variables=variables,
                    validate_url=validate_url,
                    line_id=line_id,
                    tab_id=tab_id,
                )
                for form in self.forms:
                    if "formula" in form.fields:
                        form.fields["formula"].widget = widget
                try:
                    if "formula" in self.empty_form.fields:
                        self.empty_form.fields["formula"].widget = widget
                except Exception:  # noqa: BLE001
                    pass

        return TabOutputFormSet

@admin.register(FactoryTab)
class FactoryTabAdmin(admin.ModelAdmin):
    list_display = ("factory", "name", "key", "icon", "record_type", "reports_link", "inputs_count", "outputs_count", "is_active", "updated_at")
    list_filter = ("factory", "record_type", "is_active", "icon")
    search_fields = ("name", "key", "factory__name")

    class Media:
        css = {"all": ("madan_admin/css/formula_builder.css",)}

    def get_inlines(self, request, obj):
        if obj is None:
            return [FactoryTabInputInline]
        return [FactoryTabInputInline, FactoryTabOutputInline, FactoryTabReportInline]

    def response_add(self, request, obj, post_url_continue=None):
        self.message_user(
            request,
            "تب ساخته شد؛ حالا در همین صفحه ورودی‌ها را بازبینی و خروجی‌ها را تعریف کنید.",
        )
        return HttpResponseRedirect(
            reverse("admin:machines_factorytab_change", args=(obj.pk,))
        )

    def inputs_count(self, obj):
        return obj.inputs.count()

    inputs_count.short_description = "ورودی‌ها"

    def outputs_count(self, obj):
        return obj.outputs.count()

    outputs_count.short_description = "خروجی‌ها / فرمول‌ها"

    def reports_link(self, obj):
        n = obj.reports.count()
        url = reverse("admin:machines_factorytabreport_changelist") + f"?tab__id__exact={obj.pk}"
        add = reverse("admin:machines_factorytabreport_add") + f"?tab={obj.pk}"
        return format_html(
            '<a href="{}">{} گزارش</a> · <a class="button" href="{}">+ گزارش</a>',
            url, n, add,
        )

    reports_link.short_description = "گزارش‌ها"

class FactoryTabReportInline(admin.TabularInline):
    model = FactoryTabReport
    extra = 0
    fields = ("name", "is_default", "is_active", "order", "report_link")
    readonly_fields = ("report_link",)
    show_change_link = True

    def report_link(self, obj):
        if not obj.pk:
            return "—"
        url = reverse("admin:machines_factorytabreport_change", args=[obj.pk])
        run_url = f"/api/factory-tab-reports/{obj.pk}/run/"
        return format_html(
            '<a href="{}">ویرایش گزارش و ویجت‌ها</a> · <a href="{}" target="_blank">اجرای زنده</a>',
            url, run_url,
        )

    report_link.short_description = "گزارش"

@admin.register(FactoryTabRecord)
class FactoryTabRecordAdmin(admin.ModelAdmin):
    list_display = ("tab", "line", "date_from", "date_to", "contractor", "outputs_summary", "created_by", "created_at")
    list_filter = ("tab__factory", "tab", "line", "contractor", "date_from")
    search_fields = ("tab__name", "line__name", "note")
    readonly_fields = ("inputs", "outputs", "created_by", "created_at")
    fieldsets = (
        ("اطلاعات کلی", {"fields": ("tab", "line", "contractor", "date_from", "date_to", "hour")}),
        ("ورودی‌ها / خروجی‌های محاسبه‌شده", {"fields": ("inputs", "outputs")}),
        ("سایر", {"fields": ("note", "created_by", "created_at")}),
    )

    def outputs_summary(self, obj):
        if not obj.outputs:
            return "—"
        return ", ".join(f"{k}: {v}" for k, v in obj.outputs.items())

    outputs_summary.short_description = "خروجی‌ها"

class FactoryTabWidgetForm(forms.ModelForm):
    """انتخاب نوع ویجت کشویی + قالب آماده config + راهنمای فیلدهای معتبر همان تب."""

    class Meta:
        model = FactoryTabWidget
        fields = ("report", "widget_type", "title", "order", "is_active", "config")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .tab_reports import WIDGET_TYPES

        self.fields["widget_type"] = forms.ChoiceField(
            label="نوع ویجت",
            choices=[(k, f"{k} — {v['label']}") for k, v in WIDGET_TYPES.items()],
        )
        tab = self._resolve_tab()
        if tab is not None:
            from .tab_reports import _cat_refs, _field_refs

            numeric = sorted(_field_refs(tab))
            cats = sorted(_cat_refs(tab))
            metrics = [m.get("key") for m in (self._resolve_metrics() or []) if isinstance(m, dict)]
            help_text = (
                "ارجاع عددی: " + (", ".join(numeric) if numeric else "—")
                + " | دسته‌ای: " + (", ".join(cats) if cats else "—")
                + " | متریک: " + (", ".join(metrics) if metrics else "—")
                + " | group_by: line/contractor/date/week/month/hour/field_value"
                + " | تجمیع: sum/avg/min/max/count"
            )
            self.fields["config"].help_text = help_text
            widget = self.fields["config"].widget
            widget.attrs.update(
                {
                    "rows": 8,
                    "cols": 60,
                    "dir": "ltr",
                    "placeholder": self._template_for(self.initial.get("widget_type") or getattr(self.instance, "widget_type", "") or "kpi"),
                }
            )

    def _resolve_tab(self):
        if getattr(self.instance, "report_id", None):
            return self.instance.report.tab
        report = self._resolve_report()
        return report.tab if report is not None else None

    def _resolve_report(self):
        raw = None
        if self.data:
            raw = self.data.get("report")
        if not raw and getattr(self, "request", None):
            raw = self.request.GET.get("report")
        if not raw and self.instance and self.instance.pk:
            return self.instance.report
        if not raw:
            raw = self.initial.get("report")
        if not raw:
            return None
        try:
            return FactoryTabReport.objects.select_related("tab").get(pk=raw)
        except (FactoryTabReport.DoesNotExist, TypeError, ValueError):
            return None

    def _resolve_metrics(self):
        report = self._resolve_report()
        if report is not None:
            return report.metrics or []
        if self.instance and self.instance.pk:
            return self.instance.report.metrics or []
        return []

    @staticmethod
    def _template_for(wtype):
        return {
            "kpi": '{"cards": [{"kind": "count"}, {"kind": "stat", "field": "in.feed", "stat": "sum"}, {"kind": "metric", "metric": "recovery"}]}',
            "stat_table": '{"sources": ["out", "in"], "stats": ["sum", "avg", "min", "max", "count"]}',
            "group_table": '{"group_by": "line", "fields": ["in.feed"], "stats": ["sum", "avg"]}',
            "chart": '{"chart": "bar", "group_by": "date", "value": {"field": "in.feed", "stat": "sum"}}',
        }.get(wtype, '{"cards": [{"kind": "count"}]}')

class FactoryTabWidgetInline(admin.StackedInline):
    model = FactoryTabWidget
    form = FactoryTabWidgetForm
    extra = 1
    fields = (("widget_type", "title", "order", "is_active"), "config")

    def get_formset(self, request, obj=None, **kwargs):
        formset_cls = super().get_formset(request, obj, **kwargs)

        class RequestFormSet(formset_cls):
            def __init__(self, *args, **form_kwargs):
                super().__init__(*args, **form_kwargs)
                for form in self.forms:
                    form.request = request

        return RequestFormSet

@admin.register(FactoryTabReport)
class FactoryTabReportAdmin(admin.ModelAdmin):
    list_display = ("tab", "name", "is_default", "widgets_count", "run_link", "is_active", "updated_at")
    list_filter = ("tab__factory", "tab", "is_active")
    search_fields = ("name", "tab__name")
    readonly_fields = ("run_link", "metrics_help")
    inlines = [FactoryTabWidgetInline]
    fieldsets = (
        ("اطلاعات کلی", {"fields": ("tab", "name", "description", "is_default", "order", "is_active")}),
        ("فیلترها و متریک‌ها", {"fields": ("filters", "metrics", "metrics_help")}),
        ("اجرا", {"fields": ("run_link",)}),
    )

    def get_form(self, request, obj=None, change=False, **kwargs):
        form = super().get_form(request, obj, change=change, **kwargs)
        tab_id = request.GET.get("tab")
        if tab_id and not change and "tab" in form.base_fields:
            try:
                form.base_fields["tab"].initial = int(tab_id)
            except (TypeError, ValueError):
                pass
        return form

    def widgets_count(self, obj):
        return obj.widgets.count()

    widgets_count.short_description = "ویجت‌ها"

    def run_link(self, obj):
        if not obj.pk:
            return "—"
        url = f"/api/factory-tab-reports/{obj.pk}/run/"
        return format_html(
            '<a class="button" href="{}" target="_blank">اجرای زنده گزارش (JSON)</a>', url
        )

    run_link.short_description = "اجرا"

    def metrics_help(self, obj):
        tab = obj.tab if obj and obj.pk else None
        if tab is None:
            return "ابتدا تب را انتخاب و ذخیره کنید تا ارجاع‌های معتبر نمایش داده شود."
        from .tab_reports import _field_refs

        numeric = sorted(_field_refs(tab))
        inner = (
            "متریک: " + ", ".join(f"{r}__sum|avg|min|max|count" for r in numeric[:4])
            + ("…" if len(numeric) > 4 else "")
            + " + record_count. مثال: "
            + '{"key": "recovery", "label": "بازیابی", "formula": "in.feed__sum / record_count"}'
        )
        return mark_safe(f'<div class="fb-vars-preview">{escape(inner)}</div>')

    metrics_help.short_description = "راهنمای متریک"

@admin.register(FactoryTabWidget)
class FactoryTabWidgetAdmin(admin.ModelAdmin):
    form = FactoryTabWidgetForm
    list_display = ("report", "title", "widget_type", "order", "is_active")
    list_filter = ("report__tab__factory", "widget_type", "is_active")
    search_fields = ("title", "report__name")

    def get_form(self, request, obj=None, change=False, **kwargs):
        request_holder = [request]

        class RequestWidgetForm(self.form):
            def __init__(self, *args, **form_kwargs):
                self.request = request_holder[0]
                super().__init__(*args, **form_kwargs)

        return RequestWidgetForm
