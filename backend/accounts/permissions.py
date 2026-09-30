"""
ط³غŒط³طھظ… ط¯ط³طھط±ط³غŒ ظ…ط¨طھظ†غŒ ط¨ط± ظ†ظ‚ط´ (RBAC).

- `PERMISSIONS`: ع©ط§طھط§ظ„ظˆع¯ ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ ط¨ط±ظ†ط§ظ…ظ‡ (ع©ط¯ + ط¨ط±ع†ط³ط¨ + ع¯ط±ظˆظ‡).
- `permissions_for_role`: ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ ظ¾غŒط´â€Œظپط±ط¶ ظ‡ط± ظ†ظ‚ط´.
- ط¬ط¯ظˆظ„ `RolePermissionConfig` ط§ط¬ط§ط²ظ‡ ظ…غŒâ€Œط¯ظ‡ط¯ ظ…ط§طھط±غŒط³ آ«ظ†ظ‚ط´ أ— ط¯ط³طھط±ط³غŒآ» ط¨ظ‡â€Œطµظˆط±طھ ط³ظپط§ط±ط´غŒ طھط¹ط±غŒظپ ط´ظˆط¯.
- ط¯ط³طھط±ط³غŒ ظ…ط¤ط«ط± ظ‡ط± ع©ط§ط±ط¨ط± = ظ¾غŒط´â€Œظپط±ط¶/ظ¾غŒع©ط±ط¨ظ†ط¯غŒ ظ†ظ‚ط´ + ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ ط§ظپط²ظˆط¯ظ‡â€Œط´ط¯ظ‡ âˆ’ ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ ظ…ظ…ظ†ظˆط¹â€Œط´ط¯ظ‡ (ط¯ط± ظ¾ط±ظˆظپط§غŒظ„ ع©ط§ط±ط¨ط±).
"""

import functools
from django.http import JsonResponse
from rest_framework import permissions

ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_OPERATOR = "operator"
ROLE_VIEWER = "viewer"

ROLE_CHOICES = [
    (ROLE_ADMIN, "ظ…ط¯غŒط± ط³غŒط³طھظ… (ط§ط¯ظ…غŒظ†)"),
    (ROLE_MANAGER, "ظ…ط¯غŒط± ع©ط§ط±ط®ط§ظ†ظ‡"),
    (ROLE_OPERATOR, "ط§ظ¾ط±ط§طھظˆط±"),
    (ROLE_VIEWER, "ط¨غŒظ†ظ†ط¯ظ‡ (ظپظ‚ط· ظ…ط´ط§ظ‡ط¯ظ‡)"),
]

ALL_PERMISSIONS = [
    "dashboard.view",
    "factory.view",
    "lines.view",
    "lines.manage",
    "devices.view",
    "devices.manage",
    "logs.view",
    "logs.create",
    "logs.edit",
    "logs.delete",
    "contractor.manage",
    "factory-tabs.view",
    "factory-tabs.create",
    "factory-tabs.edit",
    "factory-tabs.delete",
    "factory-tabs.manage",
    "reports.view",
    "reports.export",
    "activity.view",
    "users.view",
    "users.manage",
    "roles.view",
    "roles.manage",
    "settings.view",
    "settings.manage",
]
ALL_SET = frozenset(ALL_PERMISSIONS)

PERMISSIONS_CATALOG = [
    {"code": "dashboard.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ط¯ط§ط´ط¨ظˆط±ط¯", "group": "ط¯ط§ط´ط¨ظˆط±ط¯"},
    {"code": "factory.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ع©ط§ط±ط®ط§ظ†ظ‡ ظˆ ط´غŒظپطھâ€Œظ‡ط§", "group": "ع©ط§ط±ط®ط§ظ†ظ‡"},
    {"code": "lines.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ط®ط·ظˆط· طھظˆظ„غŒط¯", "group": "ط®ط·ظˆط· طھظˆظ„غŒط¯"},
    {
        "code": "lines.manage",
        "label": "ظ…ط¯غŒط±غŒطھ ط®ط·ظˆط· (ظˆغŒط±ط§غŒط´ ظˆغŒعکع¯غŒâ€Œظ‡ط§)",
        "group": "ط®ط·ظˆط· طھظˆظ„غŒط¯",
    },
    {"code": "devices.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ط¯ط³طھع¯ط§ظ‡â€Œظ‡ط§", "group": "ط¯ط³طھع¯ط§ظ‡â€Œظ‡ط§"},
    {
        "code": "devices.manage",
        "label": "ظ…ط¯غŒط±غŒطھ ط¯ط³طھع¯ط§ظ‡â€Œظ‡ط§ (ظˆغŒط±ط§غŒط´ ظˆغŒعکع¯غŒâ€Œظ‡ط§)",
        "group": "ط¯ط³طھع¯ط§ظ‡â€Œظ‡ط§",
    },
    {"code": "logs.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ طھظˆظ‚ظپط§طھ ط®ط· طھظˆظ„غŒط¯", "group": "طھظˆظ‚ظپط§طھ ط®ط· طھظˆظ„غŒط¯"},
    {"code": "logs.create", "label": "ط«ط¨طھ طھظˆظ‚ظپ ط®ط· طھظˆظ„غŒط¯", "group": "طھظˆظ‚ظپط§طھ ط®ط· طھظˆظ„غŒط¯"},
    {"code": "logs.edit", "label": "ظˆغŒط±ط§غŒط´ طھظˆظ‚ظپ ط®ط· طھظˆظ„غŒط¯", "group": "طھظˆظ‚ظپط§طھ ط®ط· طھظˆظ„غŒط¯"},
    {"code": "logs.delete", "label": "ط­ط°ظپ طھظˆظ‚ظپ ط®ط· طھظˆظ„غŒط¯", "group": "طھظˆظ‚ظپط§طھ ط®ط· طھظˆظ„غŒط¯"},    {"code": "contractor.manage", "label": "ظ…ط¯غŒط±غŒطھ ظ¾غŒظ…ط§ظ†ع©ط§ط±ط§ظ†", "group": "ع©ط§ط±ط®ط§ظ†ظ‡"},    {"code": "factory-tabs.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ طھط¨â€Œظ‡ط§غŒ ع©ط§ط±ط®ط§ظ†ظ‡", "group": "طھط¨â€Œظ‡ط§غŒ ع©ط§ط±ط®ط§ظ†ظ‡"},
    {"code": "factory-tabs.create", "label": "ط«ط¨طھ ط±ع©ظˆط±ط¯ طھط¨ ع©ط§ط±ط®ط§ظ†ظ‡", "group": "طھط¨â€Œظ‡ط§غŒ ع©ط§ط±ط®ط§ظ†ظ‡"},
    {"code": "factory-tabs.edit", "label": "ظˆغŒط±ط§غŒط´ ط±ع©ظˆط±ط¯ طھط¨ ع©ط§ط±ط®ط§ظ†ظ‡", "group": "طھط¨â€Œظ‡ط§غŒ ع©ط§ط±ط®ط§ظ†ظ‡"},
    {"code": "factory-tabs.delete", "label": "ط­ط°ظپ ط±ع©ظˆط±ط¯ طھط¨ ع©ط§ط±ط®ط§ظ†ظ‡", "group": "طھط¨â€Œظ‡ط§غŒ ع©ط§ط±ط®ط§ظ†ظ‡"},
    {"code": "factory-tabs.manage", "label": "ظ…ط¯غŒط±غŒطھ طھط¨â€Œظ‡ط§غŒ ع©ط§ط±ط®ط§ظ†ظ‡ (ط³ط§ط®طھ طھط¨/ظˆط±ظˆط¯غŒ/ط®ط±ظˆط¬غŒ)", "group": "طھط¨â€Œظ‡ط§غŒ ع©ط§ط±ط®ط§ظ†ظ‡"},
    {
        "code": "reports.view",
        "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ع¯ط²ط§ط±ط´â€Œظ‡ط§ ظˆ ط®ط±ظˆط¬غŒ",
        "group": "ع¯ط²ط§ط±ط´â€Œظ‡ط§",
    },
    {"code": "reports.export", "label": "ط®ط±ظˆط¬غŒ ع¯ط²ط§ط±ط´â€Œظ‡ط§ (PDF/Excel/CSV)", "group": "ع¯ط²ط§ط±ط´â€Œظ‡ط§"},
    {"code": "activity.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ظ„ط§ع¯ ظپط¹ط§ظ„غŒطھâ€Œظ‡ط§", "group": "ظ…ط¯غŒط±غŒطھ"},
    {"code": "users.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ع©ط§ط±ط¨ط±ط§ظ†", "group": "ظ…ط¯غŒط±غŒطھ"},
    {
        "code": "users.manage",
        "label": "ظ…ط¯غŒط±غŒطھ ع©ط§ط±ط¨ط±ط§ظ† (ط§غŒط¬ط§ط¯/ظˆغŒط±ط§غŒط´/ط­ط°ظپ)",
        "group": "ظ…ط¯غŒط±غŒطھ",
    },
    {"code": "roles.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ ظ†ظ‚ط´â€Œظ‡ط§ ظˆ ط¯ط³طھط±ط³غŒâ€Œظ‡ط§", "group": "ظ…ط¯غŒط±غŒطھ"},
    {"code": "roles.manage", "label": "طھط¹ط±غŒظپ ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ ظ†ظ‚ط´â€Œظ‡ط§", "group": "ظ…ط¯غŒط±غŒطھ"},
    {"code": "settings.view", "label": "ظ…ط´ط§ظ‡ط¯ظ‡ طھظ†ط¸غŒظ…ط§طھ ع©ط§ط±ط®ط§ظ†ظ‡ ظˆ ط®ط·", "group": "طھظ†ط¸غŒظ…ط§طھ"},
    {"code": "settings.manage", "label": "ظ…ط¯غŒط±غŒطھ طھظ†ط¸غŒظ…ط§طھ ع©ط§ط±ط®ط§ظ†ظ‡ ظˆ ط®ط·", "group": "طھظ†ط¸غŒظ…ط§طھ"},
]

def permissions_for_role(role):
    """ظ¾غŒط´â€Œظپط±ط¶ ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ غŒع© ظ†ظ‚ط´."""
    if role == ROLE_ADMIN:
        return ALL_SET
    if role == ROLE_MANAGER:
        return {
            "dashboard.view",
            "factory.view",
            "lines.view",
            "lines.manage",
            "devices.view",
            "devices.manage",
            "logs.view",
            "logs.create",
            "logs.edit",
            "logs.delete",
                                                    "contractor.manage",
                                                                                    "factory-tabs.view",
            "factory-tabs.create",
            "factory-tabs.edit",
            "factory-tabs.delete",
            "factory-tabs.manage",
            "reports.view",
            "reports.export",
            "activity.view",
            "users.view",
            "users.manage",
            "settings.view",
            "settings.manage",
        }
    if role == ROLE_OPERATOR:
        return {
            "dashboard.view",
            "factory.view",
            "lines.view",
            "devices.view",
            "logs.view",
            "logs.create",
                                            "factory-tabs.view",
            "factory-tabs.create",
                            "reports.view",
            "reports.export",
        }
    if role == ROLE_VIEWER:
        return {
            "dashboard.view",
            "factory.view",
            "lines.view",
            "devices.view",
            "logs.view",
                            "factory-tabs.view",
                    "reports.view",
        }
    return set()

def effective_role_permissions(role):
    """ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ ظ†ظ‚ط´ ط¨ط§ ط§ط¹ظ…ط§ظ„ ظ…ط§طھط±غŒط³ ط³ظپط§ط±ط´غŒ (ط§ع¯ط± ط¨ط±ط§غŒ ط§غŒظ† ظ†ظ‚ط´ ط°ط®غŒط±ظ‡ ط´ط¯ظ‡ ط¨ط§ط´ط¯)."""
    from .models import RolePermissionConfig

    rows = list(RolePermissionConfig.objects.filter(role=role))
    if not rows:
        return permissions_for_role(role)
    return {row.permission for row in rows if row.enabled}

def role_permission_matrix():
    """ظ…ط§طھط±غŒط³ ع©ط§ظ…ظ„ ظ†ظ‚ط´أ—ط¯ط³طھط±ط³غŒ (ظ…ظ‚ط§ط¯غŒط± ظ…ط¤ط«ط± ظپط¹ظ„غŒ)."""
    from .models import RolePermissionConfig

    config = {
        (c.role, c.permission): c.enabled for c in RolePermissionConfig.objects.all()
    }
    matrix = {}
    for role, _ in ROLE_CHOICES:
        defaults = permissions_for_role(role)
        matrix[role] = {
            p: config.get((role, p), p in defaults) for p in ALL_PERMISSIONS
        }
    return matrix

def save_role_permission_matrix(role, enabled_list):
    """ط°ط®غŒط±ظ‡ ظ…ط§طھط±غŒط³ غŒع© ظ†ظ‚ط´ط› ط¨ط§ ط­ط°ظپ ط±ع©ظˆط±ط¯ظ‡ط§غŒ ظ‚ط¨ظ„غŒ ظˆ ط³ط§ط®طھ ظ…ط¬ظ…ظˆط¹ظ‡ ع©ط§ظ…ظ„."""
    from .models import RolePermissionConfig

    RolePermissionConfig.objects.filter(role=role).delete()
    rows = [
        RolePermissionConfig(role=role, permission=p, enabled=p in set(enabled_list))
        for p in ALL_PERMISSIONS
    ]
    RolePermissionConfig.objects.bulk_create(rows)
    return {p: (p in set(enabled_list)) for p in ALL_PERMISSIONS}

def user_permissions(user):
    """ظ…ط¬ظ…ظˆط¹ظ‡ ط¯ط³طھط±ط³غŒâ€Œظ‡ط§غŒ ظ…ط¤ط«ط± غŒع© ع©ط§ط±ط¨ط±."""
    if user.is_superuser:
        return ALL_SET
    profile = getattr(user, "profile", None)
    if profile is None:
        return set()
    base = effective_role_permissions(profile.role)
    custom = profile.permissions or {}
    granted = set(custom.get("granted", []))
    denied = set(custom.get("denied", []))
    return (base | granted) - denied

def user_has_permission(user, code):
    if user.is_superuser:
        return True
    return code in user_permissions(user)

def require_permission(code):
    """ط¯ع©ظˆط±غŒطھظˆط± ط¨ط±ط±ط³غŒ ط¯ط³طھط±ط³غŒ ط¨ط±ط§غŒ طھط§ط¨ط¹â€ŒظˆغŒظˆظ‡ط§غŒ @api_view (ط§ط¬ط±ط§غŒ ظ…ط·ظ…ط¦ظ† ظ‚ط¨ظ„ ط§ط² ط¨ط¯ظ†ظ‡)."""

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(request, *args, **kwargs):
            if not user_has_permission(request.user, code):
                return JsonResponse(
                    {"detail": "ط´ظ…ط§ ط¨ظ‡ ط§غŒظ† ط¨ط®ط´ ط¯ط³طھط±ط³غŒ ظ†ط¯ط§ط±غŒط¯."}, status=403
                )
            return fn(request, *args, **kwargs)

        return wrapper

    return decorator

class HasPermission(permissions.BasePermission):
    """
    ع©ظ„ط§ط³ ط¯ط³طھط±ط³غŒ DRF ط¨ط±ط§غŒ ظˆغŒظˆط³طھâ€Œظ‡ط§.
    ط±ظˆغŒ viewset: `required_permission` + `action_permissions` (ع©ظ„ط§ط³)
    """

    message = "ط´ظ…ط§ ط¨ظ‡ ط§غŒظ† ط¨ط®ط´ ط¯ط³طھط±ط³غŒ ظ†ط¯ط§ط±غŒط¯."

    def has_permission(self, request, view):
        action = getattr(view, "action", None)
        ap = getattr(view, "action_permissions", {})
        if action:
            code = ap.get(action) or getattr(view, "required_permission", None)
        else:
            code = ap.get(request.method) or getattr(view, "required_permission", None)
        if not code:
            return True
        return user_has_permission(request.user, code)
