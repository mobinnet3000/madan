from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

from .models import ActivityLog, UserProfile
from .serializers import UserProfileSerializer, LoginSerializer, ActivityLogSerializer, ManageUserSerializer
from .permissions import (
    HasPermission, role_permission_matrix, save_role_permission_matrix,
    ALL_PERMISSIONS, PERMISSIONS_CATALOG, require_permission,
)
from .services import log_activity, ensure_profile, get_user_factory
from core.pagination import StandardPagination


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(
        username=serializer.validated_data['username'],
        password=serializer.validated_data['password'],
    )
    if not user:
        return Response({'detail': 'نام کاربری یا رمز عبور اشتباه است.'}, status=400)

    token, _ = Token.objects.get_or_create(user=user)
    ensure_profile(user)
    log_activity(user, 'login', 'حساب کاربری', user.username, request)
    return Response({'token': token.key, 'user': UserProfileSerializer(user.profile).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    ensure_profile(request.user)
    return Response(UserProfileSerializer(request.user.profile).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    if request.auth:
        request.auth.delete()
    log_activity(request.user, 'logout', 'حساب کاربری', request.user.username, request)
    return Response({'detail': 'خروج با موفقیت انجام شد.'})


class ActivityLogPagination(StandardPagination):
    max_page_size = 200


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activity_logs_view(request):
    qs = ActivityLog.objects.all().select_related('user', 'factory')
    user = request.user
    factory = get_user_factory(user)

    if factory is None and not user.is_superuser:
        profile = getattr(user, 'profile', None)
        if profile and profile.role != 'admin':
            qs = qs.none()
    elif factory is not None:
        qs = qs.filter(factory=factory)

    model = request.query_params.get('model')
    action = request.query_params.get('action')
    if model:
        qs = qs.filter(model_name=model)
    if action:
        qs = qs.filter(action=action)

    paginator = ActivityLogPagination()
    page = paginator.paginate_queryset(qs, request)
    serializer = ActivityLogSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


# ─────────────────────────── مدیریت کاربران و دسترسی‌ها ───────────────────────────

def _is_full_admin(user):
    return user.is_superuser or (getattr(user, 'profile', None) and user.profile.role == 'admin')


def _manager_scope(user):
    """کارخانه‌ای که مدیرِ آن است؛ None یعنی دسترسی کل."""
    profile = getattr(user, 'profile', None)
    if user.is_superuser:
        return None
    if profile and profile.role == 'admin':
        return None
    return profile.factory_id if profile else None


def _scoped_profiles(user):
    qs = UserProfile.objects.select_related('user', 'factory')
    scope = _manager_scope(user)
    if scope is not None:
        qs = qs.filter(factory_id=scope).exclude(user__is_superuser=True).exclude(role='admin')
    return qs


def _allowed_roles(user):
    """نقش‌هایی که این کاربر اجازه‌ی تعیین دارد."""
    if _is_full_admin(user):
        return {'admin', 'manager', 'operator', 'viewer'}
    return {'operator', 'viewer'}


def _can_edit_target(user, target):
    """آیا کاربر می‌تواند پروفایل هدف را ویرایش کند؟"""
    if user.is_superuser:
        return True
    if _is_full_admin(user):
        return not target.user.is_superuser
    # مدیر کارخانه
    scope = _manager_scope(user)
    if target.user.is_superuser or target.role == 'admin':
        return False
    return scope is not None and target.factory_id == scope


def _ensure_not_last_superuser(user_id_to_delete):
    qs = User.objects.filter(is_superuser=True, is_active=True)
    if qs.count() == 1 and qs.first().id == user_id_to_delete:
        return False
    return True


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('users.view')
def users_list_view(request):
    qs = _scoped_profiles(request.user).order_by('user__username')
    paginator = StandardPagination()
    page = paginator.paginate_queryset(qs, request)
    serializer = ManageUserSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@require_permission('users.manage')
def user_create_view(request):
    data = request.data
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return Response({'detail': 'نام کاربری و رمز عبور الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=username).exists():
        return Response({'detail': 'این نام کاربری قبلاً ثبت شده است.'}, status=status.HTTP_400_BAD_REQUEST)

    role = data.get('role', 'operator')
    if role not in _allowed_roles(request.user):
        return Response({'detail': 'تعیین این نقش برای شما مجاز نیست.'}, status=status.HTTP_403_FORBIDDEN)

    scope = _manager_scope(request.user)
    factory_id = data.get('factory')
    if scope is not None:
        if str(factory_id) != str(scope):
            return Response({'detail': 'فقط می‌توانید در کارخانه‌ی خودتان کاربر بسازید.'}, status=status.HTTP_403_FORBIDDEN)
        factory_id = scope
    if not factory_id:
        factory_id = None

    user = User.objects.create_user(username=username, password=password)
    user.first_name = (data.get('first_name') or '')[:150]
    user.last_name = (data.get('last_name') or '')[:150]
    user.email = (data.get('email') or '')[:254]
    user.is_active = bool(data.get('is_active', True))
    user.save()

    custom = data.get('permissions') or {}
    profile, _ = UserProfile.objects.update_or_create(
        user=user,
        defaults={
            'role': role,
            'factory_id': factory_id,
            'phone': (data.get('phone') or '')[:20],
            'permissions': {
                'granted': list(custom.get('granted', [])),
                'denied': list(custom.get('denied', [])),
            },
        },
    )
    log_activity(request.user, 'create', 'کاربر', username, request, f'ایجاد کاربر با نقش {profile.get_role_display()}')
    return Response(ManageUserSerializer(profile).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@require_permission('users.manage')
def user_update_view(request, uid):
    try:
        target = UserProfile.objects.select_related('user').get(pk=uid)
    except UserProfile.DoesNotExist:
        return Response({'detail': 'کاربر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

    if target.user_id == request.user.id:
        return Response({'detail': 'نمی‌توانید حساب کاربری خودتان را ویرایش کنید.'}, status=status.HTTP_400_BAD_REQUEST)
    if not _can_edit_target(request.user, target):
        return Response({'detail': 'شما اجازه‌ی ویرایش این کاربر را ندارید.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    u = target.user

    role = data.get('role')
    if role and role not in _allowed_roles(request.user):
        return Response({'detail': 'تعیین این نقش برای شما مجاز نیست.'}, status=status.HTTP_403_FORBIDDEN)

    scope = _manager_scope(request.user)
    factory_id = data.get('factory')
    if scope is not None:
        if factory_id and str(factory_id) != str(scope):
            return Response({'detail': 'فقط می‌توانید در کارخانه‌ی خودتان کاربر بسازید.'}, status=status.HTTP_403_FORBIDDEN)
        factory_id = scope
    if factory_id is not None:
        target.factory_id = factory_id

    for field in ('first_name', 'last_name', 'email'):
        if field in data:
            setattr(u, field, (data.get(field) or '')[:254])
    if 'is_active' in data:
        u.is_active = bool(data.get('is_active'))
    if data.get('password'):
        u.set_password(str(data.get('password')))
    u.save()

    if role:
        target.role = role
    if 'phone' in data:
        target.phone = (data.get('phone') or '')[:20]
    if data.get('permissions') is not None:
        custom = data.get('permissions')
        target.permissions = {
            'granted': list(custom.get('granted', [])),
            'denied': list(custom.get('denied', [])),
        }
    target.save()

    log_activity(request.user, 'update', 'کاربر', target.user.username, request, 'به‌روزرسانی پروفایل/دسترسی‌ها')
    return Response(ManageUserSerializer(target).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@require_permission('users.manage')
def user_delete_view(request, uid):
    try:
        target = UserProfile.objects.select_related('user').get(pk=uid)
    except UserProfile.DoesNotExist:
        return Response({'detail': 'کاربر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

    if target.user_id == request.user.id:
        return Response({'detail': 'نمی‌توانید حساب خودتان را حذف کنید.'}, status=status.HTTP_400_BAD_REQUEST)
    if not _can_edit_target(request.user, target):
        return Response({'detail': 'شما اجازه‌ی حذف این کاربر را ندارید.'}, status=status.HTTP_403_FORBIDDEN)
    if target.user.is_superuser and not _ensure_not_last_superuser(target.user_id):
        return Response({'detail': 'نمی‌توانید آخرین مدیر کل فعال را حذف کنید.'}, status=status.HTTP_400_BAD_REQUEST)

    username = target.user.username
    target.user.delete()
    log_activity(request.user, 'delete', 'کاربر', username, request)
    return Response({'detail': 'کاربر حذف شد.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_permission('roles.view')
def roles_view(request):
    matrix = role_permission_matrix()
    return Response({
        'roles': [{'value': v, 'label': l} for v, l in UserProfile.role.field.choices],
        'permissions': PERMISSIONS_CATALOG,
        'matrix': matrix,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@require_permission('roles.manage')
def roles_update_view(request):
    role = request.data.get('role')
    enabled = request.data.get('enabled') or []
    if role not in dict(UserProfile.role.field.choices):
        return Response({'detail': 'نقش نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
    invalid = set(enabled) - set(ALL_PERMISSIONS)
    if invalid:
        return Response({'detail': f'دسترسی نامعتبر: {", ".join(invalid)}'}, status=status.HTTP_400_BAD_REQUEST)
    matrix = save_role_permission_matrix(role, enabled)
    log_activity(request.user, 'update', 'دسترسی نقش', role, request, 'به‌روزرسانی ماتریس دسترسی نقش')
    return Response({'role': role, 'matrix': matrix})
