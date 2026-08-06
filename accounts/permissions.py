"""
سیستم دسترسی مبتنی بر نقش (RBAC).

- `PERMISSIONS`: کاتالوگ دسترسی‌های برنامه (کد + برچسب + گروه).
- `permissions_for_role`: دسترسی‌های پیش‌فرض هر نقش.
- جدول `RolePermissionConfig` اجازه می‌دهد ماتریس «نقش × دسترسی» به‌صورت سفارشی تعریف شود.
- دسترسی مؤثر هر کاربر = پیش‌فرض/پیکربندی نقش + دسترسی‌های افزوده‌شده − دسترسی‌های ممنوع‌شده (در پروفایل کاربر).
"""
from django.contrib.auth.models import User

import functools
from django.http import JsonResponse

ROLE_ADMIN = 'admin'
ROLE_MANAGER = 'manager'
ROLE_OPERATOR = 'operator'
ROLE_VIEWER = 'viewer'

ROLE_CHOICES = [
    (ROLE_ADMIN, 'مدیر سیستم (ادمین)'),
    (ROLE_MANAGER, 'مدیر کارخانه'),
    (ROLE_OPERATOR, 'اپراتور'),
    (ROLE_VIEWER, 'بیننده (فقط مشاهده)'),
]

ALL_PERMISSIONS = [
    'dashboard.view',
    'factory.view',
    'lines.view', 'lines.manage',
    'devices.view', 'devices.manage',
    'logs.view', 'logs.create', 'logs.edit', 'logs.delete',
    'analysis.view', 'analysis.create', 'analysis.edit', 'analysis.delete',
    'production.view', 'production.create', 'production.edit', 'production.delete',
    'reports.view',
    'activity.view',
    'users.view', 'users.manage',
    'roles.view', 'roles.manage',
]
ALL_SET = frozenset(ALL_PERMISSIONS)

PERMISSIONS_CATALOG = [
    {'code': 'dashboard.view', 'label': 'مشاهده داشبورد', 'group': 'داشبورد'},
    {'code': 'factory.view', 'label': 'مشاهده کارخانه و شیفت‌ها', 'group': 'کارخانه'},
    {'code': 'lines.view', 'label': 'مشاهده خطوط تولید', 'group': 'خطوط تولید'},
    {'code': 'lines.manage', 'label': 'مدیریت خطوط (ویرایش ویژگی‌ها)', 'group': 'خطوط تولید'},
    {'code': 'devices.view', 'label': 'مشاهده دستگاه‌ها', 'group': 'دستگاه‌ها'},
    {'code': 'devices.manage', 'label': 'مدیریت دستگاه‌ها (ویرایش ویژگی‌ها)', 'group': 'دستگاه‌ها'},
    {'code': 'logs.view', 'label': 'مشاهده گزارش عملکرد', 'group': 'گزارش عملکرد'},
    {'code': 'logs.create', 'label': 'ثبت گزارش عملکرد', 'group': 'گزارش عملکرد'},
    {'code': 'logs.edit', 'label': 'ویرایش گزارش عملکرد', 'group': 'گزارش عملکرد'},
    {'code': 'logs.delete', 'label': 'حذف گزارش عملکرد', 'group': 'گزارش عملکرد'},
    {'code': 'analysis.view', 'label': 'مشاهده آنالیز', 'group': 'آنالیز'},
    {'code': 'analysis.create', 'label': 'ثبت آنالیز', 'group': 'آنالیز'},
    {'code': 'analysis.edit', 'label': 'ویرایش آنالیز', 'group': 'آنالیز'},
    {'code': 'analysis.delete', 'label': 'حذف آنالیز', 'group': 'آنالیز'},
    {'code': 'production.view', 'label': 'مشاهده گزارش تولید', 'group': 'گزارش‌های تولید'},
    {'code': 'production.create', 'label': 'ثبت گزارش تولید', 'group': 'گزارش‌های تولید'},
    {'code': 'production.edit', 'label': 'ویرایش گزارش تولید', 'group': 'گزارش‌های تولید'},
    {'code': 'production.delete', 'label': 'حذف گزارش تولید', 'group': 'گزارش‌های تولید'},
    {'code': 'reports.view', 'label': 'خروجی و گزارش‌گیری (PDF/Excel)', 'group': 'گزارش‌ها'},
    {'code': 'activity.view', 'label': 'مشاهده لاگ فعالیت‌ها', 'group': 'مدیریت'},
    {'code': 'users.view', 'label': 'مشاهده کاربران', 'group': 'مدیریت'},
    {'code': 'users.manage', 'label': 'مدیریت کاربران (ایجاد/ویرایش/حذف)', 'group': 'مدیریت'},
    {'code': 'roles.view', 'label': 'مشاهده نقش‌ها و دسترسی‌ها', 'group': 'مدیریت'},
    {'code': 'roles.manage', 'label': 'تعریف دسترسی‌های نقش‌ها', 'group': 'مدیریت'},
]


def permissions_for_role(role):
    """پیش‌فرض دسترسی‌های یک نقش."""
    if role == ROLE_ADMIN:
        return ALL_SET
    if role == ROLE_MANAGER:
        return {
            'dashboard.view', 'factory.view',
            'lines.view', 'lines.manage',
            'devices.view', 'devices.manage',
            'logs.view', 'logs.create', 'logs.edit', 'logs.delete',
            'analysis.view', 'analysis.create', 'analysis.edit', 'analysis.delete',
            'production.view', 'production.create', 'production.edit', 'production.delete',
            'reports.view', 'activity.view',
            'users.view', 'users.manage',
        }
    if role == ROLE_OPERATOR:
        return {
            'dashboard.view', 'factory.view',
            'lines.view', 'devices.view',
            'logs.view', 'logs.create',
            'production.view', 'production.create',
            'analysis.view', 'analysis.create',
            'reports.view',
        }
    if role == ROLE_VIEWER:
        return {
            'dashboard.view', 'factory.view',
            'lines.view', 'devices.view',
            'logs.view', 'production.view', 'analysis.view',
            'reports.view',
        }
    return set()


def effective_role_permissions(role):
    """دسترسی‌های نقش با اعمال ماتریس سفارشی (اگر برای این نقش ذخیره شده باشد)."""
    from .models import RolePermissionConfig
    rows = list(RolePermissionConfig.objects.filter(role=role))
    if not rows:
        return permissions_for_role(role)
    return {row.permission for row in rows if row.enabled}


def role_permission_matrix():
    """ماتریس کامل نقش×دسترسی (مقادیر مؤثر فعلی)."""
    from .models import RolePermissionConfig
    config = {(c.role, c.permission): c.enabled for c in RolePermissionConfig.objects.all()}
    matrix = {}
    for role, _ in ROLE_CHOICES:
        defaults = permissions_for_role(role)
        matrix[role] = {
            p: config.get((role, p), p in defaults) for p in ALL_PERMISSIONS
        }
    return matrix


def save_role_permission_matrix(role, enabled_list):
    """ذخیره ماتریس یک نقش؛ با حذف رکوردهای قبلی و ساخت مجموعه کامل."""
    from .models import RolePermissionConfig
    RolePermissionConfig.objects.filter(role=role).delete()
    rows = [
        RolePermissionConfig(role=role, permission=p, enabled=p in set(enabled_list))
        for p in ALL_PERMISSIONS
    ]
    RolePermissionConfig.objects.bulk_create(rows)
    return {p: (p in set(enabled_list)) for p in ALL_PERMISSIONS}


def user_permissions(user):
    """مجموعه دسترسی‌های مؤثر یک کاربر."""
    if user.is_superuser:
        return ALL_SET
    profile = getattr(user, 'profile', None)
    if profile is None:
        return set()
    base = effective_role_permissions(profile.role)
    custom = profile.permissions or {}
    granted = set(custom.get('granted', []))
    denied = set(custom.get('denied', []))
    return (base | granted) - denied


def user_has_permission(user, code):
    if user.is_superuser:
        return True
    return code in user_permissions(user)


def require_permission(code):
    """دکوریتور بررسی دسترسی برای تابع‌ویوهای @api_view (اجرای مطمئن قبل از بدنه)."""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(request, *args, **kwargs):
            if not user_has_permission(request.user, code):
                return JsonResponse({'detail': 'شما به این بخش دسترسی ندارید.'}, status=403)
            return fn(request, *args, **kwargs)
        return wrapper
    return decorator


class HasPermission:
    """
    کلاس دسترسی DRF برای ویوست‌ها.
    روی viewset: `required_permission` + `action_permissions` (کلاس)
    """
    message = 'شما به این بخش دسترسی ندارید.'

    def has_permission(self, request, view):
        action = getattr(view, 'action', None)
        ap = getattr(view, 'action_permissions', {})
        if action:
            code = ap.get(action) or getattr(view, 'required_permission', None)
        else:
            code = ap.get(request.method) or getattr(view, 'required_permission', None)
        if not code:
            return True
        return user_has_permission(request.user, code)
