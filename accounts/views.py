from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate

from .models import UserProfile, ActivityLog
from .serializers import UserProfileSerializer, LoginSerializer, ActivityLogSerializer
from .utils import log_activity


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
    profile, _ = UserProfile.objects.get_or_create(user=user)
    log_activity(user, 'login', 'حساب کاربری', user.username, request)
    return Response({'token': token.key, 'user': UserProfileSerializer(profile).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    return Response(UserProfileSerializer(profile).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    if request.auth:
        request.auth.delete()
    log_activity(request.user, 'logout', 'حساب کاربری', request.user.username, request)
    return Response({'detail': 'خروج با موفقیت انجام شد.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activity_logs_view(request):
    qs = ActivityLog.objects.all().select_related('user', 'factory')
    user = request.user
    profile = getattr(user, 'profile', None)

    # ادمین همه لاگ‌ها را می‌بیند؛ مدیر/اپراتور فقط لاگ کارخانه خودشان
    if not (user.is_superuser or (profile and profile.role == 'admin')):
        if profile and profile.factory:
            qs = qs.filter(factory=profile.factory)
        else:
            qs = qs.none()

    # فیلتر بر اساس مدل/عملیات
    model = request.query_params.get('model')
    action = request.query_params.get('action')
    if model:
        qs = qs.filter(model_name=model)
    if action:
        qs = qs.filter(action=action)

    qs = qs[:200]
    return Response(ActivityLogSerializer(qs, many=True).data)
