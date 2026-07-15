from django.urls import path
from .views import login_view, me_view, logout_view, activity_logs_view

urlpatterns = [
    path('api/auth/login/', login_view, name='login'),
    path('api/auth/me/', me_view, name='me'),
    path('api/auth/logout/', logout_view, name='logout'),
    path('api/activity-logs/', activity_logs_view, name='activity-logs'),
]
