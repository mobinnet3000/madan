from django.db import models
from django.core.exceptions import ValidationError
from .utils import clean_json_attributes


class Factory(models.Model):
    name = models.CharField(max_length=255, verbose_name="نام کارخانه")
    address = models.TextField(blank=True, verbose_name="آدرس")

    class Meta:
        verbose_name = "کارخانه"
        verbose_name_plural = "کارخانه‌ها"

    def __str__(self):
        return self.name


class Shift(models.Model):
    line = models.ForeignKey(
        "ProductionLine", on_delete=models.CASCADE, related_name="shifts", verbose_name="خط تولید"
    )
    name = models.CharField(max_length=100, verbose_name="نام شیفت")
    start_time = models.TimeField(verbose_name="ساعت شروع")
    end_time = models.TimeField(verbose_name="ساعت پایان")
    is_active = models.BooleanField(default=True, verbose_name="فعال")

    class Meta:
        verbose_name = "شیفت کاری"
        verbose_name_plural = "شیفت‌های کاری"
        constraints = [
            models.UniqueConstraint(
                fields=["line", "name"], name="uniq_shift_per_line"
            ),
        ]
        ordering = ["line", "start_time"]

    def __str__(self):
        return f"{self.name} - {self.line.name}"


class FailureReason(models.Model):
    title = models.CharField(max_length=100, verbose_name="عنوان خرابی")

    class Meta:
        verbose_name = "علت خرابی مرجع"
        verbose_name_plural = "لیست علل خرابی"

    def __str__(self):
        return self.title


class ProductionLineAttribute(models.Model):
    name = models.CharField(
        max_length=100, unique=True, verbose_name="نام ویژگی خط تولید"
    )
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")

    class Meta:
        verbose_name = "ویژگی فنی خط تولید"
        verbose_name_plural = "ویژگی‌های فنی خط تولید"

    def __str__(self):
        return f"{self.name} ({self.unit})" if self.unit else self.name


class ProductionLineTemplate(models.Model):
    name = models.CharField(max_length=100, verbose_name="نام مدل/تیپ خط تولید")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    available_attributes = models.ManyToManyField(
        ProductionLineAttribute, verbose_name="ویژگی‌های مورد نیاز این خط"
    )

    class Meta:
        verbose_name = "الگوی خط تولید"
        verbose_name_plural = "الگوهای خط تولید"

    def __str__(self):
        return self.name


LINE_TYPE_CHOICES = [
    ("crushing", "خردایش"),
    ("processing", "فرآوری"),
    ("conveying", "انتقال / نوار نقاله"),
    ("other", "سایر"),
]


class ProductionLine(models.Model):
    name = models.CharField(max_length=255, verbose_name="نام خط تولید")
    factory = models.ForeignKey(
        Factory,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="کارخانه مربوطه",
    )
    description = models.TextField(blank=True, verbose_name="توضیحات خط تولید")
    line_type = models.CharField(
        max_length=20,
        choices=LINE_TYPE_CHOICES,
        default="crushing",
        verbose_name="نوع خط",
    )
    template = models.ForeignKey(
        ProductionLineTemplate, on_delete=models.PROTECT, verbose_name="الگوی خط"
    )
    attributes_values = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="مقادیر ویژگی‌های فنی خط",
        help_text='مثال: {"ظرفیت": 1500, "طول": 75}',
    )

    class Meta:
        verbose_name = "خط تولید"
        verbose_name_plural = "خطوط تولید"
        indexes = [models.Index(fields=["factory", "line_type"])]

    def clean(self):
        super().clean()
        if not self.pk or not self.template_id:
            return
        self.attributes_values = clean_json_attributes(
            self.template, self.attributes_values
        )

    def save(self, *args, **kwargs):
        if self.attributes_values is None:
            self.attributes_values = {}
        if self.pk:
            self.attributes_values = clean_json_attributes(
                self.template, self.attributes_values
            )
            self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.factory.name})"


class Attribute(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="نام ویژگی")
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")

    class Meta:
        verbose_name = "ویژگی فنی"
        verbose_name_plural = "ویژگی‌های فنی"

    def __str__(self):
        return f"{self.name} ({self.unit})" if self.unit else self.name


class DeviceTemplate(models.Model):
    name = models.CharField(max_length=100, verbose_name="نام مدل/تیپ دستگاه")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    available_attributes = models.ManyToManyField(
        Attribute, blank=True, verbose_name="ویژگی‌های مورد نیاز این مدل"
    )

    class Meta:
        verbose_name = "الگوی دستگاه"
        verbose_name_plural = "الگوهای دستگاه"

    def __str__(self):
        return self.name


class Device(models.Model):
    name = models.CharField(max_length=255, verbose_name="نام دستگاه")
    code = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="کد دستگاه",
        help_text="کد/شماره فنی دستگاه (جدا از نام)",
    )
    line = models.ForeignKey(
        ProductionLine,
        on_delete=models.CASCADE,
        related_name="devices",
        verbose_name="خط تولید",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب در خط")
    template = models.ForeignKey(
        DeviceTemplate, on_delete=models.PROTECT, verbose_name="الگوی مدل"
    )
    attributes_values = models.JSONField(
        default=dict, blank=True, verbose_name="مقادیر ویژگی‌های فنی"
    )
    image = models.ImageField(
        upload_to="devices/", null=True, blank=True, verbose_name="تصویر دستگاه"
    )

    class Meta:
        verbose_name = "دستگاه"
        verbose_name_plural = "دستگاه‌ها"
        ordering = ["line", "order"]

    def clean(self):
        super().clean()
        if not self.pk or not self.template_id:
            return
        self.attributes_values = clean_json_attributes(
            self.template, self.attributes_values
        )

    def save(self, *args, **kwargs):
        if self.attributes_values is None:
            self.attributes_values = {}
        if self.pk:
            self.attributes_values = clean_json_attributes(
                self.template, self.attributes_values
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (خط {self.line.name} - {self.line.factory.name})"


class DeviceLog(models.Model):
    line = models.ForeignKey(
        ProductionLine,
        on_delete=models.CASCADE,
        related_name="logs",
        verbose_name="خط تولید",
    )
    shift = models.ForeignKey(
        Shift, on_delete=models.PROTECT, related_name="device_logs", verbose_name="شیفت"
    )
    date = models.DateField(verbose_name="تاریخ توقف", db_index=True)
    device = models.ForeignKey(
        Device,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs",
        verbose_name="دستگاه خراب/مورد نظر",
        help_text="اختیاری: اگر خرابی مربوط به دستگاه خاصی است",
    )
    failure_cause = models.ForeignKey(
        FailureReason,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="علت خرابی (سیستمی)",
    )
    runtime_hours = models.FloatField(default=0, verbose_name="ساعت کارکرد خط")
    downtime_hours = models.FloatField(default=0, verbose_name="ساعت خرابی/توقف")
    failure_description = models.TextField(
        blank=True, verbose_name="توضیحات تکمیلی خرابی"
    )
    repair_description = models.TextField(
        blank=True, verbose_name="شرح اقدامات/تعمیرات"
    )
    feed_tonnage = models.FloatField(default=0, verbose_name="تناژ ورودی (Feed)")
    product_tonnage = models.FloatField(default=0, verbose_name="تناژ محصول/خروجی خط")
    tailing_tonnage = models.FloatField(default=0, verbose_name="تناژ باطله")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "توقف خط تولید"
        verbose_name_plural = "توقفات خط تولید"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["line", "date"]),
            models.Index(fields=["date", "shift"]),
        ]

    def __str__(self):
        return f"توقف {self.line.name} - {self.date} - {self.shift.name}"

    @property
    def efficiency(self):
        if self.feed_tonnage > 0:
            return round((self.product_tonnage / self.feed_tonnage) * 100, 2)
        return None

    def clean(self):
        super().clean()
        if (self.runtime_hours or 0) + (self.downtime_hours or 0) > 24:
            raise ValidationError(
                "مجموع ساعت کارکرد و توقف نمی‌تواند بیش از ۲۴ ساعت باشد."
            )
        if self.device and self.device.line != self.line:
            raise ValidationError(
                {"device": f"دستگاه '{self.device.name}' متعلق به این خط تولید نیست."}
            )
        if (
            self.shift_id
            and self.line_id
            and self.shift.line_id != self.line_id
        ):
            raise ValidationError(
                {"shift": "شیفت انتخاب‌شده متعلق به این خط تولید نیست."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


INPUT_TYPE_CHOICES = [
    ("number", "عدد (Number)"),
    ("text", "متن (Text)"),
]

TAB_INPUT_TYPE_CHOICES = [
    ("number", "عدد (Number)"),
    ("text", "متن (Text)"),
    ("select", "انتخابی (Select)"),
]


def normalize_select_options(options, label=""):
    """اعتبارسنجی و نرمال‌سازی گزینه‌های ورودی انتخابی؛ لیست رشته‌ای برمی‌گرداند."""
    prefix = f"«{label}» " if label else ""
    if not isinstance(options, list) or not options:
        raise ValidationError(
            f"{prefix}ورودی انتخابی باید حداقل یک گزینه داشته باشد."
        )
    if len(options) > 50:
        raise ValidationError(f"{prefix}حداکثر ۵۰ گزینه مجاز است.")
    cleaned = []
    for opt in options:
        if isinstance(opt, dict):
            opt = opt.get("value", opt.get("label", ""))
        if not isinstance(opt, (str, int, float)) or isinstance(opt, bool):
            raise ValidationError(f"{prefix}هر گزینه باید متن یا عدد باشد.")
        text = str(opt).strip()
        if not text:
            raise ValidationError(f"{prefix}گزینه خالی مجاز نیست.")
        if len(text) > 100:
            raise ValidationError(f"{prefix}طول هر گزینه حداکثر ۱۰۰ کاراکتر است.")
        if text in cleaned:
            raise ValidationError(f"{prefix}گزینه تکراری «{text}» مجاز نیست.")
        cleaned.append(text)
    return cleaned


class Contractor(models.Model):
    factory = models.ForeignKey(
        Factory,
        on_delete=models.CASCADE,
        related_name="contractors",
        verbose_name="کارخانه",
    )
    name = models.CharField(max_length=255, verbose_name="نام پیمانکار")
    contact_name = models.CharField(
        max_length=255, blank=True, verbose_name="نام مسئول"
    )
    phone = models.CharField(max_length=50, blank=True, verbose_name="شماره تماس")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "پیمانکار"
        verbose_name_plural = "پیمانکاران"
        ordering = ["factory", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["factory", "name"], name="uniq_contractor_per_factory"
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.factory.name})"



TAB_RECORD_TYPE_CHOICES = [
    ("range", "بازه تاریخی (از تاریخ تا تاریخ)"),
    ("daily", "روزانه (چند رکورد در روز با ساعت)"),
]

TAB_ICON_CHOICES = [(k, k) for k in (
    "layers", "truck", "gauge", "flask", "activity", "bar-chart", "trending-up",
    "box", "clipboard-list", "database", "filter", "layers-3", "pie-chart",
    "line-chart", "package", "factory", "scale", "clock", "map-pin", "cpu",
    "wrench", "zap", "droplet", "thermometer", "settings", "target", "grid",
)]

TAB_COLOR_CHOICES = [(k, k) for k in (
    "slate", "orange", "emerald", "violet", "sky", "rose", "teal", "amber",
    "indigo", "lime", "cyan", "fuchsia",
)]


class FactoryTab(models.Model):
    """تب داینامیک کارخانه — ساختار یکسان: ورودی‌ها + خروجی‌های فرمولی."""

    factory = models.ForeignKey(
        Factory,
        on_delete=models.CASCADE,
        related_name="report_tabs",
        verbose_name="کارخانه",
    )
    key = models.SlugField(max_length=60, verbose_name="کلید (Key)")
    name = models.CharField(max_length=100, verbose_name="نام تب")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    icon = models.CharField(max_length=30, choices=TAB_ICON_CHOICES, default="layers", verbose_name="آیکون")
    color = models.CharField(max_length=20, choices=TAB_COLOR_CHOICES, default="slate", verbose_name="رنگ")
    record_type = models.CharField(
        max_length=20,
        choices=TAB_RECORD_TYPE_CHOICES,
        default="range",
        verbose_name="نوع ثبت رکورد",
    )
    require_line = models.BooleanField(default=True, verbose_name="خط تولید الزامی است")
    contractor_required = models.BooleanField(
        default=False, verbose_name="انتخاب پیمانکار الزامی است"
    )
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین ویرایش")

    class Meta:
        verbose_name = "تب کارخانه"
        verbose_name_plural = "تب‌های کارخانه"
        ordering = ["factory", "order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["factory", "key"], name="uniq_tab_key_per_factory"
            ),
        ]

    def __str__(self):
        return f"{self.factory.name} - {self.name}"

    def clean(self):
        super().clean()
        if self.pk:
            from .factory_tabs import (
                validate_output_formula_for_tab,
                validate_outputs_no_cycle_tab,
            )

            try:
                validate_output_formula_for_tab(self)
                validate_outputs_no_cycle_tab(self)
            except ValueError as e:
                raise ValidationError({"outputs": str(e)})


class FactoryTabInput(models.Model):
    tab = models.ForeignKey(
        FactoryTab,
        on_delete=models.CASCADE,
        related_name="inputs",
        verbose_name="تب",
    )
    key = models.SlugField(max_length=60, verbose_name="کلید (Key)")
    name = models.CharField(max_length=100, verbose_name="نام نمایشی")
    input_type = models.CharField(
        max_length=20, choices=TAB_INPUT_TYPE_CHOICES, default="number", verbose_name="نوع ورودی"
    )
    options = models.JSONField(
        default=list,
        blank=True,
        verbose_name="گزینه‌ها",
        help_text='فقط برای نوع «انتخابی»: لیست گزینه‌ها، مثل ["الف", "ب", "ج"]',
    )
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")
    required = models.BooleanField(default=True, verbose_name="الزامی")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "ورودی تب"
        verbose_name_plural = "ورودی‌های تب"
        ordering = ["tab", "order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["tab", "key"], name="uniq_tab_input_key_per_tab"),
        ]

    def __str__(self):
        return f"{self.tab.name} - {self.name}"

    def clean(self):
        super().clean()
        if self.options is None:
            self.options = []
        if self.input_type == "select":
            self.options = normalize_select_options(
                self.options, label=self.name or self.key
            )
        else:
            self.options = []


class FactoryTabOutput(models.Model):
    tab = models.ForeignKey(
        FactoryTab,
        on_delete=models.CASCADE,
        related_name="outputs",
        verbose_name="تب",
    )
    key = models.SlugField(max_length=60, verbose_name="کلید (Key)")
    name = models.CharField(max_length=100, verbose_name="نام نمایشی")
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")
    formula = models.TextField(verbose_name="فرمول")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "خروجی تب"
        verbose_name_plural = "خروجی‌های تب"
        ordering = ["tab", "order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["tab", "key"], name="uniq_tab_output_key_per_tab"),
        ]

    def __str__(self):
        return f"{self.tab.name} - {self.name}"


class FactoryTabRecord(models.Model):
    """رکورد ثبت‌شده یک تب — ورودی‌ها + خروجی‌های محاسبه‌شده."""

    tab = models.ForeignKey(
        FactoryTab,
        on_delete=models.CASCADE,
        related_name="records",
        verbose_name="تب",
    )
    line = models.ForeignKey(
        ProductionLine,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="tab_records",
        verbose_name="خط تولید",
    )
    contractor = models.ForeignKey(
        Contractor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tab_records",
        verbose_name="پیمانکار",
    )
    date_from = models.DateField(verbose_name="تاریخ شروع", db_index=True)
    date_to = models.DateField(verbose_name="تاریخ پایان")
    hour = models.TimeField(null=True, blank=True, verbose_name="ساعت ثبت")
    inputs = models.JSONField(default=dict, blank=True, verbose_name="مقادیر ورودی")
    outputs = models.JSONField(default=dict, blank=True, verbose_name="خروجی‌های محاسبه‌شده")
    note = models.TextField(blank=True, verbose_name="توضیحات / ملاحظات")
    created_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tab_records",
        verbose_name="ثبت‌کننده",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "رکورد تب"
        verbose_name_plural = "رکوردهای تب"
        ordering = ["-date_from", "-created_at"]
        indexes = [
            models.Index(fields=["tab", "date_from"]),
            models.Index(fields=["tab", "date_to"]),
            models.Index(fields=["line", "date_from"]),
            models.Index(fields=["contractor"]),
        ]

    def __str__(self):
        label = (
            self.date_from
            if self.date_from == self.date_to
            else f"{self.date_from} تا {self.date_to}"
        )
        return f"{self.tab.name} - {label}"

    def clean(self):
        super().clean()
        if self.tab_id and self.line_id:
            if self.line.factory_id != self.tab.factory_id:
                raise ValidationError(
                    {"line": "خط تولید باید متعلق به کارخانه‌ی همین تب باشد."}
                )
        if self.tab_id and self.contractor_id:
            if self.contractor.factory_id != self.tab.factory_id:
                raise ValidationError(
                    {"contractor": "پیمانکار باید متعلق به کارخانه‌ی همین تب باشد."}
                )
        if self.date_from and self.date_to and self.date_to < self.date_from:
            raise ValidationError(
                {"date_to": "تاریخ پایان بازه نمی‌تواند قبل از تاریخ شروع باشد."}
            )
        if self.tab_id and self.tab.require_line and not self.line_id:
            raise ValidationError({"line": "انتخاب خط تولید برای این تب الزامی است."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class FactoryTabReport(models.Model):
    """گزارش قابل‌تنظیم یک تب — Backend منطق Report فرانت را از روی Config اجرا می‌کند."""

    tab = models.ForeignKey(
        FactoryTab,
        on_delete=models.CASCADE,
        related_name="reports",
        verbose_name="تب",
    )
    name = models.CharField(max_length=100, verbose_name="نام گزارش")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    is_default = models.BooleanField(default=False, verbose_name="پیش‌فرض تب")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    filters = models.JSONField(
        default=list,
        blank=True,
        verbose_name="فیلترهای مجاز",
        help_text='زیرمجموعه‌ای از ["line", "contractor", "date_from", "date_to"] — خالی یعنی همه.',
    )
    metrics = models.JSONField(
        default=list,
        blank=True,
        verbose_name="متریک‌های محاسباتی",
        help_text='مثل [{"key": "recovery", "label": "بازیابی", "formula": "out.product__sum / out.feed__sum * 100"}]',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین ویرایش")

    class Meta:
        verbose_name = "گزارش تب"
        verbose_name_plural = "گزارش‌های تب"
        ordering = ["tab", "order", "id"]

    def __str__(self):
        return f"{self.tab.name} - {self.name}"

    def clean(self):
        super().clean()
        from .tab_reports import (
            ALLOWED_REPORT_FILTERS,
            normalize_report_filters,
            validate_report_metrics,
        )

        if self.filters is None:
            self.filters = []
        if not isinstance(self.filters, list) or any(
            f not in ALLOWED_REPORT_FILTERS for f in self.filters
        ):
            raise ValidationError(
                {"filters": f"فیلترها باید زیرمجموعه‌ای از {list(ALLOWED_REPORT_FILTERS)} باشند."}
            )
        self.filters = normalize_report_filters(self.filters)
        if self.tab_id:
            try:
                self.metrics = validate_report_metrics(self.tab, self.metrics or [])
            except ValueError as e:
                raise ValidationError({"metrics": str(e)})


class FactoryTabWidget(models.Model):
    """ویجت یک گزارش — نوع از رجیستری WIDGET_TYPES، پارامترها در config."""

    report = models.ForeignKey(
        FactoryTabReport,
        on_delete=models.CASCADE,
        related_name="widgets",
        verbose_name="گزارش",
    )
    widget_type = models.CharField(max_length=20, verbose_name="نوع ویجت")
    title = models.CharField(max_length=100, verbose_name="عنوان")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="تنظیمات",
        help_text="پارامترهای نوع ویجت (field/group_by/aggregation/...) — مستندات: TAB_REPORTS.md",
    )

    class Meta:
        verbose_name = "ویجت گزارش"
        verbose_name_plural = "ویجت‌های گزارش"
        ordering = ["report", "order", "id"]

    def __str__(self):
        return f"{self.report.name} - {self.title}"

    def clean(self):
        super().clean()
        if self.config is None:
            self.config = {}
        if self.report_id and self.report.tab_id:
            from .tab_reports import validate_widget_config

            metrics = self.report.metrics or []
            metric_keys = [m.get("key") for m in metrics if isinstance(m, dict)]
            try:
                self.config = validate_widget_config(
                    self.report.tab,
                    self.widget_type,
                    self.config or {},
                    metric_keys=metric_keys,
                )
            except ValueError as e:
                raise ValidationError({"config": str(e)})
