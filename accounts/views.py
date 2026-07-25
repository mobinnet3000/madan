from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate

from .models import ActivityLog
from .serializers import UserProfileSerializer, LoginSerializer, ActivityLogSerializer
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
