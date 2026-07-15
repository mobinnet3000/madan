from django.db import models
from django.core.exceptions import ValidationError

# -------------------------------------------------------------------------
# مدل کارخانه (Factory)
# -------------------------------------------------------------------------
class Factory(models.Model):
    """
    بالاترین سطح سلسله مراتب: نمایانگر یک واحد صنعتی یا کارخانه.
    """
    name = models.CharField(max_length=255, verbose_name="نام کارخانه")
    address = models.TextField(blank=True, verbose_name="آدرس")

    class Meta:
        verbose_name = "کارخانه"
        verbose_name_plural = "کارخانه‌ها"

    def __str__(self):
        return self.name

class Shift(models.Model):
    """
    مدل شیفت کاری برای هر کارخانه
    مثل: شیفت صبح، عصر، شب
    """
    factory = models.ForeignKey(
        Factory,
        on_delete=models.CASCADE,
        related_name="shifts",
        verbose_name="کارخانه"
    )
    name = models.CharField(max_length=100, verbose_name="نام شیفت")
    start_time = models.TimeField(verbose_name="ساعت شروع")
    end_time = models.TimeField(verbose_name="ساعت پایان")
    is_active = models.BooleanField(default=True, verbose_name="فعال")

    class Meta:
        verbose_name = "شیفت کاری"
        verbose_name_plural = "شیفت‌های کاری"
        unique_together = ("factory", "name")
        ordering = ["factory", "start_time"]

    def __str__(self):
        return f"{self.name} - {self.factory.name}"


class FailureReason(models.Model):
    """مدل عناوین خرابی (مثلاً: برقی، مکانیکی، توقف مواد و ...)"""
    title = models.CharField(max_length=100, verbose_name="عنوان خرابی")

    class Meta:
        verbose_name = "علت خرابی مرجع"
        verbose_name_plural = "لیست علل خرابی"

    def __str__(self):
        return self.title

# -------------------------------------------------------------------------
# مدل ویژگی‌های فنی خط تولید (ProductionLineAttribute)
# -------------------------------------------------------------------------

class ProductionLineAttribute(models.Model):
    """
    تعریف ویژگی‌های فنی پایه که مخصوص خط تولید هستند.
    مثلاً: ظرفیت تولید روزانه، تعداد ایستگاه‌ها، طول خط، عرض خط، ...
    """
    name = models.CharField(max_length=100, unique=True, verbose_name="نام ویژگی خط تولید")
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")

    class Meta:
        verbose_name = "ویژگی فنی خط تولید"
        verbose_name_plural = "ویژگی‌های فنی خط تولید"

    def __str__(self):
        return f"{self.name} ({self.unit})" if self.unit else self.name


# -------------------------------------------------------------------------
# مدل الگوی خط تولید (ProductionLineTemplate)
# -------------------------------------------------------------------------


class ProductionLineTemplate(models.Model):

    """
    مشخص می‌کند هر نوع خط (مثلاً فرآوری یا خردایش) چه ویژگی‌هایی باید داشته باشد.
    """
    name = models.CharField(max_length=100, verbose_name="نام مدل/تیپ خط تولید")
    description = models.TextField(blank=True, verbose_name="توضیحات")

    available_attributes = models.ManyToManyField(
        ProductionLineAttribute,
        verbose_name="ویژگی‌های مورد نیاز این خط"
    )

    class Meta:
        verbose_name = "الگوی خط تولید"
        verbose_name_plural = "الگوهای خط تولید"

    def __str__(self):
        return self.name


# -------------------------------------------------------------------------
# مدل خط تولید (ProductionLine)
# -------------------------------------------------------------------------

LINE_TYPE_CHOICES = [
    ('crushing', 'خردایش'),
    ('processing', 'فرآوری'),
    ('conveying', 'انتقال / نوار نقاله'),
    ('other', 'سایر'),
]


class ProductionLine(models.Model):
    """
    لایه میانی: هر کارخانه می‌تواند چندین خط تولید داشته باشد.
    دارای template و attributes_values مشابه Device.
    """
    name = models.CharField(max_length=255, verbose_name="نام خط تولید")
    factory = models.ForeignKey(
        "Factory",
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="کارخانه مربوطه",
    )
    description = models.TextField(blank=True, verbose_name="توضیحات خط تولید")

    line_type = models.CharField(
        max_length=20,
        choices=LINE_TYPE_CHOICES,
        default='crushing',
        verbose_name="نوع خط",
    )

    template = models.ForeignKey(
        ProductionLineTemplate,
        on_delete=models.PROTECT,
        verbose_name="الگوی خط",
    )

    attributes_values = models.JSONField(
        default=dict,
        blank=True,
        null=True,
        verbose_name="مقادیر ویژگی‌های فنی خط",
        help_text='مثال: {"ظرفیت": 1500, "طول": 75}',
    )

    class Meta:
        verbose_name = "خط تولید"
        verbose_name_plural = "خطوط تولید"

    def clean(self):
        super().clean()

        # مرحله ایجاد اولیه: اجازه بده خط ساخته شود، بعداً مقادیر را پر کند
        if not self.pk:
            return

        if not self.template_id:
            return

        allowed_attributes = set(
            self.template.available_attributes.values_list("name", flat=True)
        )
        current_values = self.attributes_values or {}

        cleaned_data = {}
        for attr_name in allowed_attributes:
            val = current_values.get(attr_name, 0)

            # تبدیل به عدد، در صورت خطا 0
            try:
                cleaned_data[attr_name] = float(val) if val is not None else 0
            except (ValueError, TypeError):
                cleaned_data[attr_name] = 0

        # حذف کلیدهای اضافی به صورت ضمنی (چون فقط allowed را می‌سازیم)
        self.attributes_values = cleaned_data

    def save(self, *args, **kwargs):
        # نگذار None ذخیره شود
        if self.attributes_values is None:
            self.attributes_values = {}

        # ایجاد اولیه: بدون full_clean (مثل Device شما)
        if not self.pk:
            super().save(*args, **kwargs)
        else:
            self.full_clean()
            super().save(*args, **kwargs)

    def __str__(self):
        # اگر Factory مدل‌تان __str__ درست دارد، همین کافی است
        return f"{self.name} ({self.factory.name})"


# -------------------------------------------------------------------------
# مدل ویژگی‌ها (Attribute)
# -------------------------------------------------------------------------
class Attribute(models.Model):
    """
    تعریف ویژگی‌های فنی پایه که به صورت داینامیک در دستگاه‌ها استفاده می‌شود.
    مثلاً: توان، دمای کاری، سرعت چرخش.
    """
    name = models.CharField(max_length=100, unique=True, verbose_name="نام ویژگی")
    unit = models.CharField(max_length=50, blank=True, verbose_name="واحد اندازه‌گیری")

    class Meta:
        verbose_name = "ویژگی فنی"
        verbose_name_plural = "ویژگی‌های فنی"

    def __str__(self):
        return f"{self.name} ({self.unit})" if self.unit else self.name

# -------------------------------------------------------------------------
# مدل الگوی دستگاه (Device Template)
# -------------------------------------------------------------------------
class DeviceTemplate(models.Model):
    """
    مشخص می‌کند هر نوع دستگاه (مثلاً پمپ یا ژنراتور) چه ویژگی‌هایی باید داشته باشد.
    """
    name = models.CharField(max_length=100, verbose_name="نام مدل/تیپ دستگاه")
    description = models.TextField(blank=True, verbose_name="توضیحات")

    available_attributes = models.ManyToManyField(
        Attribute, 
        blank=True, 
        null=True,
        verbose_name="ویژگی‌های مورد نیاز این مدل"
    )

    class Meta:
        verbose_name = "الگوی دستگاه"
        verbose_name_plural = "الگوهای دستگاه"

    def __str__(self):
        return self.name


# -------------------------------------------------------------------------
# مدل دستگاه (Device)
# -------------------------------------------------------------------------
class Device(models.Model):
    """
    اینستنس واقعی از یک دستگاه که در یک خط تولید خاص نصب شده است.
    """
    name = models.CharField(max_length=255, verbose_name="نام/کد دستگاه")
    
    # اتصال به خط تولید (که خودش به کارخانه متصل است)
    line = models.ForeignKey(
        ProductionLine, 
        on_delete=models.CASCADE, 
        related_name='devices', 
        verbose_name="خط تولید"
    )
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب در خط")

    template = models.ForeignKey(
        DeviceTemplate, 
        on_delete=models.PROTECT, 
        verbose_name="الگوی مدل"
    )
    
    # ذخیره مقادیر ویژگی‌ها به صورت کلید-مقدار در قالب JSON
    # مثال: {"توان": 150, "سرعت": 2800}
    attributes_values = models.JSONField(
        default=dict, 
        blank=True, 
        null=True,
        verbose_name="مقادیر ویژگی‌های فنی"
    )
    image = models.ImageField(
        upload_to='devices/',
        null=True,
        blank=True,
        verbose_name="تصویر دستگاه",
    )
    is_analyzer = models.BooleanField(default=False, verbose_name="آیا آنالیزور است؟")

    class Meta:
        verbose_name = "دستگاه"
        verbose_name_plural = "دستگاه‌ها"
        ordering = ['line', 'order']

    # def clean(self):
    #     super().clean()   
    #     # نکته کلیدی: اگر دستگاه هنوز ساخته نشده (PK ندارد)، 
    #     # اعتبارسنجی JSON را انجام نده تا کاربر بتواند در مرحله بعد آن را پر کند.
    #     if not self.pk:
    #         return

    #     if self.template:
    #         required_names = set(self.template.available_attributes.values_list('name', flat=True))
    #         current_values = self.attributes_values if self.attributes_values else {}
    #         provided_keys = set(current_values.keys())
            
    #         # ۱. بررسی وجود فیلدهای اجباری
    #         missing = required_names - provided_keys
    #         if missing:
    #             raise ValidationError({
    #                 'attributes_values': f"مقادیر این ویژگی‌ها الزامی است: {', '.join(missing)}"
    #             })

    #         # ۲. بررسی عددی بودن مقادیر
    #         for key, value in current_values.items():
    #             if not isinstance(value, (int, float)):
    #                 raise ValidationError({
    #                     'attributes_values': f"مقدار ویژگی '{key}' باید عدد باشد."
    #                 })
    def clean(self):
        super().clean()
        if not self.pk:
            return

        if self.template:
            # ۱. استخراج نام تمام ویژگی‌های مجاز از تمپلیت
            allowed_attributes = set(self.template.available_attributes.values_list('name', flat=True))
            
            # ۲. آماده‌سازی داده‌های فعلی (اگر خالی بود، دیکشنری خالی)
            current_values = self.attributes_values if self.attributes_values else {}
            
            # ۳. ساخت دیکشنری جدید: فقط کلیدهای مجاز را نگه دار، اگر نبود مقدار 0 بگذار
            cleaned_data = {}
            for attr_name in allowed_attributes:
                val = current_values.get(attr_name, 0)
                # اطمینان از عدد بودن
                try:
                    cleaned_data[attr_name] = float(val) if val is not None else 0
                except (ValueError, TypeError):
                    cleaned_data[attr_name] = 0
            
            # ۴. جایگزینی داده‌های پالایش شده
            self.attributes_values = cleaned_data

    def save(self, *args, **kwargs):
        # اطمینان از اینکه مقدار نال ذخیره نشود
        if self.attributes_values is None:
            self.attributes_values = {}
        
        # در زمان ایجاد اولیه (PK=None)، full_clean را بدون فیلد JSON صدا می‌زنیم
        # یا اجازه می‌دهیم در مرحله Save خطا نگیرد
        if not self.pk:
            super().save(*args, **kwargs)
        else:
            self.full_clean()
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (خط {self.line.name} - {self.line.factory.name})"




class DeviceDailyAnalysis(models.Model):
    """
    ثبت آنالیز روزانه/شیفتی در نقاط مختلف خط (خوراک، باطله، محصول نهایی).
    - device اختیاری است ولی اگر انتخاب شد باید is_analyzer=True باشد.
    - sample_point مشخص می‌کند آنالیز در کدام نقطه خط گرفته شده است.
    """

    SAMPLE_POINT_CHOICES = [
        ('feed', 'خوراک (Feed)'),
        ('tailing', 'باطله (Tailing)'),
        ('product', 'محصول نهایی (Product)'),
    ]

    device = models.ForeignKey(
        "Device",
        on_delete=models.CASCADE,
        related_name="daily_analyses",
        verbose_name="دستگاه (آنالیزور)"
    )

    sample_point = models.CharField(
        max_length=20,
        choices=SAMPLE_POINT_CHOICES,
        null=True,
        blank=True,
        verbose_name="نقطه نمونه‌برداری",
    )

    shift = models.ForeignKey(
        "Shift",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="daily_analyses",
        verbose_name="شیفت"
    )

    date = models.DateField(
        verbose_name="تاریخ آنالیز",

    )

    analysis_text = models.TextField(
        verbose_name="شرح/نتیجه آنالیز",
        null=True,
        blank=True
    )

    # چند نمونه پارامتر عددی (هر تعداد خواستی اضافه کن)
    value_1 = models.FloatField(verbose_name="پارامتر ۱", null=True, blank=True)
    value_2 = models.FloatField(verbose_name="پارامتر ۲", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")

    class Meta:
        verbose_name = "آنالیز روزانه دستگاه"
        verbose_name_plural = "آنالیزهای روزانه دستگاه"
        ordering = ["-date", "-created_at"]

        # یکتایی فقط وقتی معنی دارد که date و shift و device پر باشند.
        # (در DB، NULLها معمولاً باعث می‌شوند رکوردهای متعدد مجاز باشند)
        constraints = [
            models.UniqueConstraint(
                fields=["device", "date", "shift"],
                name="uniq_device_daily_analysis_per_day_shift",
            )
        ]

    def __str__(self):
        dev = self.device.name if self.device else "بدون دستگاه"
        d = self.date.isoformat() if self.date else "بدون تاریخ"
        sh = self.shift.name if self.shift else "بدون شیفت"
        return f"{dev} - {d} - {sh}"

    def clean(self):
        super().clean()

        # 1) اگر دستگاه انتخاب شد، باید آنالیزور باشد
        if self.device and not self.device.is_analyzer:
            raise ValidationError({
                "device": "این دستگاه آنالیزور نیست و نباید برای آن رکورد آنالیز ثبت شود."
            })

        # 2) اگر شیفت انتخاب شد، باید با کارخانه دستگاه/خط هم‌خوان باشد
        # (Shift به Factory وصل است؛ Device به ProductionLine وصل است؛ ProductionLine به Factory)
        if self.device and self.shift:
            device_factory_id = self.device.line.factory_id
            if self.shift.factory_id != device_factory_id:
                raise ValidationError({
                    "shift": "شیفت انتخاب‌شده متعلق به کارخانه خط این دستگاه نیست."
                })

        # 3) پیشنهاد: اگر شیفت پر شد ولی تاریخ خالی بود (یا برعکس) خطا بده
        # اگر دوست داری ورود مرحله‌ای آزاد باشد، این بخش را حذف کن.
        if self.shift and not self.date:
            raise ValidationError({"date": "وقتی شیفت انتخاب می‌شود، تاریخ آنالیز هم باید وارد شود."})
        if self.date and not self.shift:
            raise ValidationError({"shift": "وقتی تاریخ ثبت می‌شود، شیفت هم باید انتخاب شود."})

class DeviceLog(models.Model):
    """مدل ثبت گزارش روزانه برای خط تولید + خرابی + عملکرد تولید"""

    # خط تولید
    line = models.ForeignKey(
        ProductionLine, 
        on_delete=models.CASCADE, 
        related_name='logs', 
        verbose_name="خط تولید"
    )

    shift = models.ForeignKey(
        Shift,
        on_delete=models.PROTECT,
        related_name="device_logs",
        verbose_name="شیفت"
    )



    date = models.DateField(verbose_name="تاریخ گزارش")

    # دستگاهی که خرابی روی آن اتفاق افتاده (اختیاری)
    device = models.ForeignKey(
        Device, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='logs', 
        verbose_name="دستگاه خراب/مورد نظر",
        help_text="اختیاری: اگر خرابی مربوط به دستگاه خاصی است"
    )

    # علت خرابی از مدل مرجع
    failure_cause = models.ForeignKey(
        FailureReason,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="علت خرابی (سیستمی)",
    )

    # ساعات عملکرد
    runtime_hours = models.FloatField(default=0, verbose_name="ساعت کارکرد خط")
    downtime_hours = models.FloatField(default=0, verbose_name="ساعت خرابی/توقف")

    # توضیحات خرابی
    failure_description = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="توضیحات تکمیلی خرابی"
    )
    repair_description = models.TextField(
        blank=True, 
        null=True, 
        verbose_name="شرح اقدامات/تعمیرات"
    )

    # ------------------------- #
    #     فیلدهای تولیدی خط     #
    # ------------------------- #

    # تناژها
    feed_tonnage = models.FloatField(
        default=0,
        verbose_name="تناژ ورودی (Feed)"
    )

    product_tonnage = models.FloatField(
        default=0,
        verbose_name="تناژ محصول/خروجی خط"
    )

    tailing_tonnage = models.FloatField(
        default=0,
        verbose_name="تناژ باطله"
    )

    # راندمان تولید (اختیاری)
    efficiency = models.FloatField(
        null=True,
        blank=True,
        editable=False,
        verbose_name="بهره‌وری/راندمان (%)"
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ثبت")
    
    class Meta:
        verbose_name = "گزارش عملکرد روزانه"
        verbose_name_plural = "گزارشات عملکرد روزانه"
        # unique_together = ('line', 'date', 'shift')
        ordering = ['-date']

    def __str__(self):
        return f"گزارش {self.line.name} - {self.date} - {self.shift.name}"

    def clean(self):
        super().clean()

        # ساعات نباید از 24 بیشتر شوند
        if (self.runtime_hours or 0) + (self.downtime_hours or 0) > 24:
            raise ValidationError("مجموع ساعت کارکرد و توقف نمی‌تواند بیش از ۲۴ ساعت باشد.")

        # اعتبارسنجی: دستگاه باید متعلق به همین خط باشد
        if self.device and self.device.line != self.line:
            raise ValidationError({
                'device': f"دستگاه '{self.device.name}' متعلق به این خط تولید نیست."
            })
        # شیفت باید متعلق به کارخانه همان خط باشد
        if self.shift and self.line:
            if self.shift.factory_id != self.line.factory_id:
                raise ValidationError({
                    'shift': "شیفت انتخاب‌شده متعلق به کارخانه این خط تولید نیست."
                })

    def save(self, *args, **kwargs):
        self.full_clean()

        # محاسبه راندمان (Efficiency)
        # فرمول پیشنهادی: (محصول)/(ورودی) × 100
        if self.feed_tonnage > 0:
            self.efficiency = (self.product_tonnage / self.feed_tonnage) * 100
        else:
            self.efficiency = None

        super().save(*args, **kwargs)
