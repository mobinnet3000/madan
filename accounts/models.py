from django.db import models
from django.contrib.auth.models import User

ROLE_CHOICES = [
    ('admin', 'ادمین'),
    ('manager', 'مدیر کارخانه'),
    ('operator', 'اپراتور'),
]


class UserProfile(models.Model):
    """
    پروفایل کاربر شامل نقش و کارخانه مرتبط.
    - admin: دسترسی کامل به همه کارخانه‌ها و لاگ فعالیت‌ها
    - manager: مدیر یک کارخانه (مشاهده و مدیریت داده‌های همان کارخانه)
    - operator: اپراتور ورود داده (ثبت گزارش و آنالیز برای کارخانه خود)
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='profile'
    )
    factory = models.ForeignKey(
        'machines.Factory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='profiles',
        verbose_name='کارخانه',
    )
    role = models.CharField(
        max_length=20, choices=ROLE_CHOICES, default='operator', verbose_name='نقش'
    )
    phone = models.CharField(max_length=20, blank=True, verbose_name='شماره تماس')

    class Meta:
        verbose_name = 'پروفایل کاربر'
        verbose_name_plural = 'پروفایل‌های کاربران'

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"


class ActivityLog(models.Model):
    """ثبت فعالیت‌های کاربران برای ممیزی (audit trail)."""

    ACTION_CHOICES = [
        ('login', 'ورود'),
        ('logout', 'خروج'),
        ('create', 'ایجاد'),
        ('update', 'ویرایش'),
        ('delete', 'حذف'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activities',
        verbose_name='کاربر',
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name='عملیات')
    model_name = models.CharField(max_length=60, blank=True, verbose_name='مدل')
    object_repr = models.CharField(max_length=200, blank=True, verbose_name='شیء')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    factory = models.ForeignKey(
        'machines.Factory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs',
        verbose_name='کارخانه',
    )
    ip = models.GenericIPAddressField(null=True, blank=True, verbose_name='آی‌پی')
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name='زمان')

    class Meta:
        verbose_name = 'لاگ فعالیت'
        verbose_name_plural = 'لاگ‌های فعالیت'
        ordering = ['-timestamp']

    def __str__(self):
        u = self.user.username if self.user else 'نامشخص'
        return f"{u} - {self.get_action_display()} - {self.model_name}"
