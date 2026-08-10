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
    factory = models.ForeignKey(
        Factory, on_delete=models.CASCADE, related_name="shifts", verbose_name="کارخانه"
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
                fields=["factory", "name"], name="uniq_shift_per_factory"
            ),
        ]
        ordering = ["factory", "start_time"]

    def __str__(self):
        return f"{self.name} - {self.factory.name}"


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
    is_analyzer = models.BooleanField(default=False, verbose_name="آیا آنالیزور است؟")

    class Meta:
        verbose_name = "دستگاه"
        verbose_name_plural = "دستگاه‌ها"
        ordering = ["line", "order"]
        indexes = [models.Index(fields=["line", "is_analyzer"])]

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


class DeviceDailyAnalysis(models.Model):
    SAMPLE_POINT_CHOICES = [
        ("feed", "خوراک (Feed)"),
        ("tailing", "باطله (Tailing)"),
        ("product", "محصول نهایی (Product)"),
    ]

    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        related_name="daily_analyses",
        verbose_name="دستگاه (آنالیزور)",
    )
    sample_point = models.CharField(
        max_length=20,
        choices=SAMPLE_POINT_CHOICES,
        null=True,
        blank=True,
        verbose_name="نقطه نمونه‌برداری",
    )
    shift = models.ForeignKey(
        Shift,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="daily_analyses",
        verbose_name="شیفت",
    )
    date = models.DateField(verbose_name="تاریخ آنالیز")
    analysis_text = models.TextField(
        verbose_name="شرح/نتیجه آنالیز", null=True, blank=True
    )
    value_1 = models.FloatField(verbose_name="پارامتر ۱", null=True, blank=True)
    value_2 = models.FloatField(verbose_name="پارامتر ۲", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "آنالیز روزانه دستگاه"
        verbose_name_plural = "آنالیزهای روزانه دستگاه"
        ordering = ["-date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["device", "date", "shift"],
                name="uniq_device_daily_analysis_per_day_shift",
            ),
        ]
        indexes = [models.Index(fields=["date", "device"])]

    def __str__(self):
        dev = self.device.name if self.device else "بدون دستگاه"
        d = self.date.isoformat() if self.date else "بدون تاریخ"
        sh = self.shift.name if self.shift else "بدون شیفت"
        return f"{dev} - {d} - {sh}"

    def clean(self):
        super().clean()
        if self.device and not self.device.is_analyzer:
            raise ValidationError(
                {
                    "device": "این دستگاه آنالیزور نیست و نباید برای آن رکورد آنالیز ثبت شود."
                }
            )
        if self.device and self.shift:
            if self.shift.factory_id != self.device.line.factory_id:
                raise ValidationError(
                    {"shift": "شیفت انتخاب‌شده متعلق به کارخانه خط این دستگاه نیست."}
                )
        if (self.shift and not self.date) or (self.date and not self.shift):
            raise ValidationError("تاریخ و شیفت باید هم‌زمان پر شوند.")


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
    date = models.DateField(verbose_name="تاریخ گزارش", db_index=True)
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
        verbose_name = "گزارش عملکرد روزانه"
        verbose_name_plural = "گزارشات عملکرد روزانه"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["line", "date"]),
            models.Index(fields=["date", "shift"]),
        ]

    def __str__(self):
        return f"گزارش {self.line.name} - {self.date} - {self.shift.name}"

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
            and self.shift.factory_id != self.line.factory_id
        ):
            raise ValidationError(
                {"shift": "شیفت انتخاب‌شده متعلق به کارخانه این خط تولید نیست."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ProductionReport(models.Model):
    """آنالیز خطوط تولید — ریز عملکرد هر خط در یک بازه زمانی."""

    line = models.ForeignKey(
        ProductionLine,
        on_delete=models.CASCADE,
        related_name="production_reports",
        verbose_name="خط تولید",
    )
    contractor = models.ForeignKey(
        "Contractor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_reports",
        verbose_name="پیمانکار",
    )
    date_from = models.DateField(verbose_name="تاریخ شروع بازه")
    date_to = models.DateField(verbose_name="تاریخ پایان بازه")
    batala_avalieh = models.FloatField(default=0, verbose_name="باطله اولیه")
    darsad_batale = models.FloatField(default=0, verbose_name="درصد باطله")
    darsad_dane_dorosht = models.FloatField(default=0, verbose_name="درصد دانه درشت")
    darsad_rotobat = models.FloatField(default=0, verbose_name="درصد رطوبت")
    darsad_takhfif = models.FloatField(default=0, verbose_name="درصد تخفیف")
    darsad_jerime = models.FloatField(default=0, verbose_name="درصد جریمه")
    note = models.TextField(blank=True, verbose_name="توضیحات / ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "آنالیز خط تولید"
        verbose_name_plural = "آنالیز خطوط تولید"
        ordering = ["-date_from", "-created_at"]
        indexes = [
            models.Index(fields=["line", "date_from"]),
            models.Index(fields=["line", "date_to"]),
        ]

    def __str__(self):
        return f"آنالیز {self.line.name} - {self.date_from} تا {self.date_to}"

    def clean(self):
        super().clean()
        if self.contractor_id and self.contractor.factory_id != self.line.factory_id:
            raise ValidationError(
                {"contractor": "پیمانکار باید متعلق به کارخانه‌ی همین خط تولید باشد."}
            )
        if self.date_from and self.date_to and self.date_to < self.date_from:
            raise ValidationError(
                {"date_to": "تاریخ پایان بازه نمی‌تواند قبل از تاریخ شروع باشد."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


from .analysis_validation import validate_outputs_no_cycle, validate_output_formula

INPUT_TYPE_CHOICES = [
    ("number", "عدد (Number)"),
    ("text", "متن (Text)"),
]


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


class AnalysisTypeDefinition(models.Model):
    name = models.CharField(
        max_length=100, unique=True, verbose_name="نام تعریف نوع آنالیز"
    )
    description = models.TextField(blank=True, verbose_name="توضیحات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "تعریف نوع آنالیز"
        verbose_name_plural = "تعریف‌های نوع آنالیز"
        ordering = ["name"]

    def __str__(self):
        return self.name


class AnalysisInputDefinition(models.Model):
    definition = models.ForeignKey(
        AnalysisTypeDefinition,
        on_delete=models.CASCADE,
        related_name="inputs",
        verbose_name="تعریف نوع",
    )
    key = models.SlugField(max_length=60, verbose_name="کلید (Key)")
    name = models.CharField(max_length=100, verbose_name="نام نمایشی")
    input_type = models.CharField(
        max_length=20,
        choices=INPUT_TYPE_CHOICES,
        default="number",
        verbose_name="نوع ورودی",
    )
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")
    required = models.BooleanField(default=True, verbose_name="الزامی")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "ورودی تعریف آنالیز"
        verbose_name_plural = "ورودی‌های تعریف آنالیز"
        ordering = ["definition", "order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["definition", "key"], name="uniq_input_key_per_definition"
            ),
        ]

    def __str__(self):
        return f"{self.definition.name} - {self.name}"


class AnalysisPosition(models.Model):
    line = models.ForeignKey(
        ProductionLine,
        on_delete=models.CASCADE,
        related_name="analysis_positions",
        verbose_name="خط تولید",
    )
    name = models.CharField(max_length=100, verbose_name="نام موقعیت")
    key = models.SlugField(max_length=60, verbose_name="کلید (Key)")
    definition = models.ForeignKey(
        AnalysisTypeDefinition,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="positions",
        verbose_name="تعریف نوع آنالیز",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "موقعیت آنالیز خط"
        verbose_name_plural = "موقعیت‌های آنالیز خط"
        ordering = ["line", "order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["line", "key"], name="uniq_position_key_per_line"
            ),
        ]

    def __str__(self):
        return f"{self.line.name} - {self.name}"


class LineAnalysisDefinition(models.Model):
    line = models.OneToOneField(
        ProductionLine,
        on_delete=models.CASCADE,
        related_name="analysis_definition",
        verbose_name="خط تولید",
    )
    contractor_required = models.BooleanField(
        default=True, verbose_name="انتخاب پیمانکار الزامی است"
    )
    notes = models.TextField(blank=True, verbose_name="توضیحات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین ویرایش")

    class Meta:
        verbose_name = "تعریف آنالیز خط"
        verbose_name_plural = "تعریف‌های آنالیز خط"

    def __str__(self):
        return f"تعریف آنالیز {self.line.name}"

    def clean(self):
        super().clean()
        if self.pk:
            try:
                validate_output_formula(self)
                validate_outputs_no_cycle(self)
            except ValueError as e:
                raise ValidationError({"outputs": str(e)})


class AdditionalInputDefinition(models.Model):
    line_definition = models.ForeignKey(
        LineAnalysisDefinition,
        on_delete=models.CASCADE,
        related_name="additional_inputs",
        verbose_name="تعریف آنالیز خط",
    )
    key = models.SlugField(max_length=60, verbose_name="کلید (Key)")
    name = models.CharField(max_length=100, verbose_name="نام نمایشی")
    input_type = models.CharField(
        max_length=20,
        choices=INPUT_TYPE_CHOICES,
        default="number",
        verbose_name="نوع ورودی",
    )
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")
    required = models.BooleanField(default=True, verbose_name="الزامی")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "ورودی اضافه خط"
        verbose_name_plural = "ورودی‌های اضافه خط"
        ordering = ["line_definition", "order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["line_definition", "key"],
                name="uniq_add_input_key_per_line_def",
            ),
        ]

    def __str__(self):
        return f"{self.line_definition.line.name} - {self.name}"


class AnalysisOutputDefinition(models.Model):
    line_definition = models.ForeignKey(
        LineAnalysisDefinition,
        on_delete=models.CASCADE,
        related_name="outputs",
        verbose_name="تعریف آنالیز خط",
    )
    key = models.SlugField(max_length=60, verbose_name="کلید (Key)")
    name = models.CharField(max_length=100, verbose_name="نام نمایشی")
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")
    formula = models.TextField(
        verbose_name="فرمول", help_text="مثال: product.fe / feed.fe * 100"
    )
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "خروجی تعریف آنالیز"
        verbose_name_plural = "خروجی‌های تعریف آنالیز"
        ordering = ["line_definition", "order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["line_definition", "key"], name="uniq_output_key_per_line_def"
            ),
        ]

    def __str__(self):
        return f"{self.line_definition.line.name} - {self.name}"


class ActualAnalysis(models.Model):
    line = models.ForeignKey(
        ProductionLine,
        on_delete=models.PROTECT,
        related_name="actual_analyses",
        verbose_name="خط تولید",
    )
    contractor = models.ForeignKey(
        Contractor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="actual_analyses",
        verbose_name="پیمانکار",
    )
    date_from = models.DateField(verbose_name="تاریخ شروع بازه", db_index=True)
    date_to = models.DateField(verbose_name="تاریخ پایان بازه")
    shift = models.ForeignKey(
        Shift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="actual_analyses",
        verbose_name="شیفت",
    )
    inputs = models.JSONField(default=dict, blank=True, verbose_name="مقادیر ورودی")
    outputs = models.JSONField(
        default=dict, blank=True, verbose_name="خروجی‌های محاسبه‌شده"
    )
    created_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_actual_analyses",
        verbose_name="ثبت‌کننده",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "آنالیز واقعی"
        verbose_name_plural = "آنالیزهای واقعی"
        ordering = ["-date_from", "-created_at"]
        indexes = [
            models.Index(fields=["line", "date_from"]),
            models.Index(fields=["line", "date_to"]),
            models.Index(fields=["contractor"]),
        ]

    def __str__(self):
        label = (
            self.date_from
            if self.date_from == self.date_to
            else f"{self.date_from} تا {self.date_to}"
        )
        return f"آنالیز {self.line.name} - {label}"

    @property
    def is_range(self):
        return self.date_from != self.date_to

    def clean(self):
        super().clean()
        if self.contractor_id and self.contractor.factory_id != self.line.factory_id:
            raise ValidationError(
                {"contractor": "پیمانکار باید متعلق به کارخانه‌ی همین خط تولید باشد."}
            )
        if self.date_from and self.date_to and self.date_to < self.date_from:
            raise ValidationError(
                {"date_to": "تاریخ پایان بازه نمی‌تواند قبل از تاریخ شروع باشد."}
            )
