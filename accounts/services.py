from django.contrib.auth.models import User
from .models import UserProfile, ActivityLog


def get_user_factory(user: User):
    """Returns the factory the user is scoped to, or None for full access."""
    if user.is_superuser:
        return None
    profile = getattr(user, 'profile', None)
    if profile and profile.role == 'admin':
        return None
    return profile.factory if profile else None


def log_activity(user, action, model_name, object_repr, request=None,
                 description='', factory=None):
    ip = None
    if request:
        ip = request.META.get('REMOTE_ADDR')
    ActivityLog.objects.create(
        user=user,
        action=action,
        model_name=model_name,
        object_repr=str(object_repr)[:200],
        description=description,
        factory=factory,
        ip=ip,
    )


def ensure_profile(user: User):
    UserProfile.objects.get_or_create(user=user)
