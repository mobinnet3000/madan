from .models import ActivityLog


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
