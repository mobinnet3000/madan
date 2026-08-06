from django.urls import path
from .views import (
    login_view, me_view, logout_view, activity_logs_view,
    users_list_view, user_create_view, user_update_view, user_delete_view,
    roles_view, roles_update_view,
)

urlpatterns = [
    path('api/auth/login/', login_view, name='login'),
    path('api/auth/me/', me_view, name='me'),
    path('api/auth/logout/', logout_view, name='logout'),
    path('api/activity-logs/', activity_logs_view, name='activity-logs'),
    path('api/users/', users_list_view, name='users-list'),
    path('api/users/create/', user_create_view, name='user-create'),
    path('api/users/<int:uid>/', user_update_view, name='user-update'),
    path('api/users/<int:uid>/delete/', user_delete_view, name='user-delete'),
    path('api/roles/', roles_view, name='roles'),
    path('api/roles/update/', roles_update_view, name='roles-update'),
]