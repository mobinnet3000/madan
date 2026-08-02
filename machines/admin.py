from django.contrib import admin
from django import forms
from django.urls import reverse
from django.http import HttpResponseRedirect
from django_jsonform.forms.fields import JSONFormField
from .models import (
    DeviceDailyAnalysis, DeviceLog, Factory, FailureReason, ProductionLine,
    ProductionLineAttribute, ProductionLineTemplate, Attribute, DeviceTemplate,
    Device, Shift
)


def display_attributes_summary(self, obj):
    if not obj.attributes_values:
        return "-"
    return ", ".join([f"{k}: {v}" for k, v in list(obj.attributes_values.items())[:3]])
display_attributes_summary.short_description = "ویژگی‌های فنی"


def build_schema(template_attr_field):
    def make_schema(template):
        properties = {
            attr.name: {
                'type': 'number',
                'default': 0,
                'title': f"{attr.name} ({attr.unit if attr.unit else 'واحد ندارد'})"
            } for attr in template_attr_field(template).all()
        }
        return {'type': 'object', 'properties': properties}
    return make_schema


class DynamicJSONFormMixin:
    json_field = 'attributes_values'
    schema_builder = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        inst = self.instance
        if inst and inst.pk and self.schema_builder:
            try:
                template = getattr(inst, 'template', None)
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
        fields = '__all__'


class DeviceForm(DynamicJSONFormMixin, forms.ModelForm):
    schema_builder = build_schema(lambda t: t.available_attributes)

    class Meta:
        model = Device
        fields = '__all__'


class ShiftInline(admin.TabularInline):
    model = Shift
    extra = 1


class DeviceLogInline(admin.TabularInline):
    model = DeviceLog
    extra = 1
    fields = ('date', 'shift', 'device', 'runtime_hours', 'downtime_hours', 'failure_cause')
    classes = ['collapse']


class DeviceInline(admin.TabularInline):
    model = Device
    fields = ('order', 'name', 'template')
    extra = 0
    ordering = ('order',)


class DeviceDailyAnalysisInline(admin.TabularInline):
    model = DeviceDailyAnalysis
    extra = 0
    fields = ("date", "shift", "value_1", "value_2", "analysis_text")
    ordering = ("-date",)


@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'address')
    search_fields = ('name',)
    inlines = [ShiftInline]


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ('name', 'factory', 'start_time', 'end_time', 'is_active')
    list_filter = ('factory', 'is_active')


@admin.register(FailureReason)
class FailureReasonAdmin(admin.ModelAdmin):
    list_display = ('title',)
    search_fields = ('title',)


@admin.register(ProductionLineAttribute)
class ProductionLineAttributeAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit')


@admin.register(ProductionLineTemplate)
class ProductionLineTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    filter_horizontal = ('available_attributes',)


@admin.register(ProductionLine)
class ProductionLineAdmin(admin.ModelAdmin):
    form = ProductionLineForm
    list_display = ('name', 'factory', 'template', 'display_attributes')
    list_filter = ('factory', 'template')
    inlines = [DeviceInline, DeviceLogInline]
    search_fields = ('name',)

    def get_fields(self, request, obj=None):
        if not obj:
            return ('factory', 'template', 'name', 'description')
        return ('factory', 'template', 'name', 'description', 'attributes_values')

    display_attributes = display_attributes_summary

    def response_add(self, request, obj, post_url_continue=None):
        return HttpResponseRedirect(reverse('admin:machines_productionline_change', args=(obj.pk,)))


@admin.register(Attribute)
class AttributeAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit')
    search_fields = ('name',)


@admin.register(DeviceTemplate)
class DeviceTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_attributes_list')
    filter_horizontal = ('available_attributes',)

    def get_attributes_list(self, obj):
        return ", ".join([a.name for a in obj.available_attributes.all()])
    get_attributes_list.short_description = "ویژگی‌های الگو"


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    form = DeviceForm
    list_display = ('order', 'name', 'line', 'template', 'display_attributes')
    display_attributes = display_attributes_summary
    list_editable = ('order',)
    list_display_links = ('name',)
    list_filter = ('line__factory', 'line', 'template')
    search_fields = ('name', 'line__name')

    def get_inline_instances(self, request, obj=None):
        if obj and obj.is_analyzer:
            return [DeviceDailyAnalysisInline(self.model, self.admin_site)]
        return []

    def get_fields(self, request, obj=None):
        if not obj:
            return ('line', 'template', 'name', 'order', 'is_analyzer')
        return ('line', 'template', 'name', 'order', 'is_analyzer', 'attributes_values')

    def response_add(self, request, obj, post_url_continue=None):
        return HttpResponseRedirect(reverse('admin:machines_device_change', args=(obj.pk,)))


@admin.register(DeviceDailyAnalysis)
class DeviceDailyAnalysisAdmin(admin.ModelAdmin):
    list_display = ("device", "date", "shift", "created_at")
    list_filter = ("date", "shift__factory")
    search_fields = ("device__name", "analysis_text")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "device":
            kwargs["queryset"] = Device.objects.filter(is_analyzer=True)
        if db_field.name == "shift":
            obj_id = request.resolver_match.kwargs.get('object_id')
            if obj_id:
                obj = self.get_object(request, obj_id)
                if obj and obj.device:
                    kwargs["queryset"] = Shift.objects.filter(factory=obj.device.line.factory)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(DeviceLog)
class DeviceLogAdmin(admin.ModelAdmin):
    list_display = ('line', 'date', 'shift', 'runtime_hours', 'downtime_hours', 'efficiency', 'failure_cause', 'device')
    list_filter = ('line__factory', 'line', 'shift', 'failure_cause', 'date')
    search_fields = ("line__name", "device__name", "failure_description", "repair_description")
    readonly_fields = ("created_at", "efficiency")

    fieldsets = (
        ("اطلاعات کلی", {"fields": ("line", "date", "shift")}),
        ("اطلاعات خرابی / توقف", {"fields": ("device", "failure_cause", "failure_description", "repair_description")}),
        ("ساعات عملکرد", {"fields": ("runtime_hours", "downtime_hours")}),
        ("اطلاعات تولیدی خط", {"fields": ("feed_tonnage", "product_tonnage", "tailing_tonnage", "efficiency")}),
        ("متفرقه", {"fields": ("created_at",)}),
    )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        obj_id = request.resolver_match.kwargs.get('object_id')
        log_obj = self.get_object(request, obj_id) if obj_id else None
        if db_field.name == "device" and log_obj:
            kwargs["queryset"] = Device.objects.filter(line=log_obj.line)
        if db_field.name == "shift" and log_obj:
            kwargs["queryset"] = Shift.objects.filter(factory=log_obj.line.factory)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
