from rest_framework import serializers
from .models import UserProfile, ActivityLog


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    factory_name = serializers.CharField(source='factory.name', read_only=True)
    is_superuser = serializers.BooleanField(source='user.is_superuser', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'role', 'factory', 'factory_name', 'phone', 'is_superuser',
        ]


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'username', 'role', 'action', 'model_name',
            'object_repr', 'description', 'factory_name', 'ip', 'timestamp',
        ]

    def get_role(self, obj):
        if obj.user and hasattr(obj.user, 'profile'):
            return obj.user.profile.get_role_display()
        return '-'

    factory_name = serializers.CharField(source='factory.name', read_only=True)
