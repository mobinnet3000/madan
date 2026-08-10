"""سایت ادمین سفارشی با صفحه‌ی اصلی دسته‌بندی‌شده.

صفحه‌ی اصلی (index) به‌جای یک لیست ساده، مدل‌ها را بر اساس موضوع گروه‌بندی می‌کند
تا دسترسی سریع‌تر و منظم‌تر باشد.
"""
from django.apps import apps
from django.contrib import admin as djadmin
from django.contrib.admin.sites import AdminSite
from django.urls import reverse

MODEL_GROUPS = [
    (
        "کارخانه‌ها، خطوط تولید و پیمانکاران",
        [
            "contractor",
            "factory",
            "shift",
            "productionline",
            "productionlinetemplate",
            "productionlineattribute",
        ],
    ),
    ("دستگاه‌ها و تجهیزات", ["device", "devicetemplate", "attribute"]),
    (
        "آنالیز — تعریف‌ها، ورودی‌ها و رکوردهای واقعی",
        [
            "analysistypedefinition",
            "analysisinputdefinition",
            "analysisposition",
            "lineanalysisdefinition",
            "additionalinputdefinition",
            "analysisoutputdefinition",
            "actualanalysis",
            "devicedailyanalysis",
        ],
    ),
    ("گزارش عملکرد و تولید", ["devicelog", "productionreport", "failurereason"]),
    (
        "کاربران و دسترسی‌ها",
        ["user", "group", "userprofile", "rolepermissionconfig", "activitylog"],
    ),
]


class MadanAdminSite(AdminSite):
    index_template = "admin/madan_index.html"
    site_header = "پنل مدیریت — خط فرآوری معدن"
    site_title = "مدیریت"
    index_title = "دسترسی سریع و دسته‌بندی‌شده"

    def get_madan_groups(self, request):
        registry = self._registry
        by_name = {}
        for model in apps.get_models():
            by_name.setdefault(model._meta.model_name, model)

        def entry(model, admin_obj):
            opts = model._meta
            perms = admin_obj.get_model_perms(request)
            if not any(perms.values()):
                return None
            label = "admin:%s_%s" % (opts.app_label, opts.model_name)
            return {
                "verbose_name": opts.verbose_name,
                "verbose_name_plural": opts.verbose_name_plural,
                "changelist_url": reverse(label + "_changelist"),
                "add_url": reverse(label + "_add") if perms.get("add") else None,
            }

        groups = []
        matched = set()
        for title, names in MODEL_GROUPS:
            items = []
            for name in names:
                model = by_name.get(name)
                if model is None or model not in registry:
                    continue
                item = entry(model, registry[model])
                if item:
                    items.append(item)
                    matched.add(model)
            if items:
                groups.append({"title": title, "models": items})

        rest = []
        for model, admin_obj in registry.items():
            if model in matched:
                continue
            item = entry(model, admin_obj)
            if item:
                rest.append(item)
        if rest:
            groups.append({"title": "سایر", "models": rest})
        return groups

    def index(self, request, extra_context=None):
        extra_context = dict(extra_context or {})
        extra_context["madan_groups"] = self.get_madan_groups(request)
        return super().index(request, extra_context)


madan_site = MadanAdminSite(name="madan")

# انتقال رجیستری مدل‌ها از سایت پیش‌فرض به سایت سفارشی
for model, admin_obj in list(djadmin.site._registry.items()):
    madan_site.register(model, admin_obj.__class__)
