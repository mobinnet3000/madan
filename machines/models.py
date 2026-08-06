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
    factory = models.ForeignKey(Factory, on_delete=models.CASCADE, related_name="shifts", verbose_name="کارخانه")
    name = models.CharField(max_length=100, verbose_name="نام شیفت")
    start_time = models.TimeField(verbose_name="ساعت شروع")
    end_time = models.TimeField(verbose_name="ساعت پایان")
    is_active = models.BooleanField(default=True, verbose_name="فعال")

    class Meta:
        verbose_name = "شیفت کاری"
        verbose_name_plural = "شیفت‌های کاری"
        constraints = [
            models.UniqueConstraint(fields=["factory", "name"], name="uniq_shift_per_factory"),
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
    name = models.CharField(max_length=100, unique=True, verbose_name="نام ویژگی خط تولید")
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")

    class Meta:
        verbose_name = "ویژگی فنی خط تولید"
        verbose_name_plural = "ویژگی‌های فنی خط تولید"

    def __str__(self):
        return f"{self.name} ({self.unit})" if self.unit else self.name


class ProductionLineTemplate(models.Model):
    name = models.CharField(max_length=100, verbose_name="نام مدل/تیپ خط تولید")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    available_attributes = models.ManyToManyField(ProductionLineAttribute, verbose_name="ویژگی‌های مورد نیاز این خط")

    class Meta:
        verbose_name = "الگوی خط تولید"
        verbose_name_plural = "الگوهای خط تولید"

    def __str__(self):
        return self.name


LINE_TYPE_CHOICES = [
    ('crushing', 'خردایش'),
    ('processing', 'فرآوری'),
    ('conveying', 'انتقال / نوار نقاله'),
    ('other', 'سایر'),
]


class ProductionLine(models.Model):
    name = models.CharField(max_length=255, verbose_name="نام خط تولید")
    factory = models.ForeignKey(Factory, on_delete=models.CASCADE, related_name="lines", verbose_name="کارخانه مربوطه")
    description = models.TextField(blank=True, verbose_name="توضیحات خط تولید")
    line_type = models.CharField(max_length=20, choices=LINE_TYPE_CHOICES, default='crushing', verbose_name="نوع خط")
    template = models.ForeignKey(ProductionLineTemplate, on_delete=models.PROTECT, verbose_name="الگوی خط")
    attributes_values = models.JSONField(default=dict, blank=True, verbose_name="مقادیر ویژگی‌های فنی خط",
        help_text='مثال: {"ظرفیت": 1500, "طول": 75}')

    class Meta:
        verbose_name = "خط تولید"
        verbose_name_plural = "خطوط تولید"
        indexes = [models.Index(fields=['factory', 'line_type'])]

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
    available_attributes = models.ManyToManyField(Attribute, blank=True, verbose_name="ویژگی‌های مورد نیاز این مدل")

    class Meta:
        verbose_name = "الگوی دستگاه"
        verbose_name_plural = "الگوهای دستگاه"

    def __str__(self):
        return self.name


class Device(models.Model):
    name = models.CharField(max_length=255, verbose_name="نام دستگاه")
    code = models.CharField(max_length=100, blank=True, verbose_name="کد دستگاه", help_text="کد/شماره فنی دستگاه (جدا از نام)")
    line = models.ForeignKey(ProductionLine, on_delete=models.CASCADE, related_name='devices', verbose_name="خط تولید")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب در خط")
    template = models.ForeignKey(DeviceTemplate, on_delete=models.PROTECT, verbose_name="الگوی مدل")
    attributes_values = models.JSONField(default=dict, blank=True, verbose_name="مقادیر ویژگی‌های فنی")
    image = models.ImageField(upload_to='devices/', null=True, blank=True, verbose_name="تصویر دستگاه")
    is_analyzer = models.BooleanField(default=False, verbose_name="آیا آنالیزور است؟")

    class Meta:
        verbose_name = "دستگاه"
        verbose_name_plural = "دستگاه‌ها"
        ordering = ['line', 'order']
        indexes = [models.Index(fields=['line', 'is_analyzer'])]

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
        ('feed', 'خوراک (Feed)'),
        ('tailing', 'باطله (Tailing)'),
        ('product', 'محصول نهایی (Product)'),
    ]

    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name="daily_analyses", verbose_name="دستگاه (آنالیزور)")
    sample_point = models.CharField(max_length=20, choices=SAMPLE_POINT_CHOICES, null=True, blank=True, verbose_name="نقطه نمونه‌برداری")
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, null=True, blank=True, related_name="daily_analyses", verbose_name="شیفت")
    date = models.DateField(verbose_name="تاریخ آنالیز")
    analysis_text = models.TextField(verbose_name="شرح/نتیجه آنالیز", null=True, blank=True)
    value_1 = models.FloatField(verbose_name="پارامتر ۱", null=True, blank=True)
    value_2 = models.FloatField(verbose_name="پارامتر ۲", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "آنالیز روزانه دستگاه"
        verbose_name_plural = "آنالیزهای روزانه دستگاه"
        ordering = ["-date", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["device", "date", "shift"], name="uniq_device_daily_analysis_per_day_shift"),
        ]
        indexes = [models.Index(fields=['date', 'device'])]

    def __str__(self):
        dev = self.device.name if self.device else "بدون دستگاه"
        d = self.date.isoformat() if self.date else "بدون تاریخ"
        sh = self.shift.name if self.shift else "بدون شیفت"
        return f"{dev} - {d} - {sh}"

    def clean(self):
        super().clean()
        if self.device and not self.device.is_analyzer:
            raise ValidationError({"device": "این دستگاه آنالیزور نیست و نباید برای آن رکورد آنالیز ثبت شود."})
        if self.device and self.shift:
            if self.shift.factory_id != self.device.line.factory_id:
                raise ValidationError({"shift": "شیفت انتخاب‌شده متعلق به کارخانه خط این دستگاه نیست."})
        if (self.shift and not self.date) or (self.date and not self.shift):
            raise ValidationError("تاریخ و شیفت باید هم‌زمان پر شوند.")


class DeviceLog(models.Model):
    line = models.ForeignKey(ProductionLine, on_delete=models.CASCADE, related_name='logs', verbose_name="خط تولید")
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="device_logs", verbose_name="شیفت")
    date = models.DateField(verbose_name="تاریخ گزارش", db_index=True)
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs',
        verbose_name="دستگاه خراب/مورد نظر", help_text="اختیاری: اگر خرابی مربوط به دستگاه خاصی است")
    failure_cause = models.ForeignKey(FailureReason, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="علت خرابی (سیستمی)")
    runtime_hours = models.FloatField(default=0, verbose_name="ساعت کارکرد خط")
    downtime_hours = models.FloatField(default=0, verbose_name="ساعت خرابی/توقف")
    failure_description = models.TextField(blank=True, verbose_name="توضیحات تکمیلی خرابی")
    repair_description = models.TextField(blank=True, verbose_name="شرح اقدامات/تعمیرات")
    feed_tonnage = models.FloatField(default=0, verbose_name="تناژ ورودی (Feed)")
    product_tonnage = models.FloatField(default=0, verbose_name="تناژ محصول/خروجی خط")
    tailing_tonnage = models.FloatField(default=0, verbose_name="تناژ باطله")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "گزارش عملکرد روزانه"
        verbose_name_plural = "گزارشات عملکرد روزانه"
        ordering = ['-date']
        indexes = [
            models.Index(fields=['line', 'date']),
            models.Index(fields=['date', 'shift']),
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
            raise ValidationError("مجموع ساعت کارکرد و توقف نمی‌تواند بیش از ۲۴ ساعت باشد.")
        if self.device and self.device.line != self.line:
            raise ValidationError({'device': f"دستگاه '{self.device.name}' متعلق به این خط تولید نیست."})
        if self.shift_id and self.line_id and self.shift.factory_id != self.line.factory_id:
            raise ValidationError({'shift': "شیفت انتخاب‌شده متعلق به کارخانه این خط تولید نیست."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class ProductionReport(models.Model):
    """گزارش تولیدی خط در یک بازه زمانی (جدای از گزارش عملکرد روزانه)."""
    line = models.ForeignKey(ProductionLine, on_delete=models.CASCADE, related_name="production_reports", verbose_name="خط تولید")
    date_from = models.DateField(verbose_name="تاریخ شروع بازه")
    date_to = models.DateField(verbose_name="تاریخ پایان بازه")
    feed_tonnage = models.FloatField(default=0, verbose_name="تناژ ورودی (Feed)")
    product_tonnage = models.FloatField(default=0, verbose_name="تناژ محصول/خروجی خط")
    tailing_tonnage = models.FloatField(default=0, verbose_name="تناژ باطله")
    note = models.TextField(blank=True, verbose_name="توضیحات / ملاحظات")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "گزارش تولید"
        verbose_name_plural = "گزارش‌های تولید"
        ordering = ['-date_from', '-created_at']
        indexes = [
            models.Index(fields=['line', 'date_from']),
            models.Index(fields=['line', 'date_to']),
        ]

    def __str__(self):
        return f"گزارش تولید {self.line.name} - {self.date_from} تا {self.date_to}"

    @property
    def efficiency(self):
        if self.feed_tonnage > 0:
            return round((self.product_tonnage / self.feed_tonnage) * 100, 2)
        return None

    def clean(self):
        super().clean()
        if self.date_from and self.date_to and self.date_to < self.date_from:
            raise ValidationError({"date_to": "تاریخ پایان بازه نمی‌تواند قبل از تاریخ شروع باشد."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
