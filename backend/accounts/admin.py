from django.contrib import admin
from .models import UserProfile, ActivityLog, RolePermissionConfig


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'factory', 'phone', 'is_active')
    list_filter = ('role', 'factory', 'user__is_active')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')
    raw_id_fields = ('user', 'factory')

    def is_active(self, obj):
        return obj.user.is_active
    is_active.boolean = True
    is_active.short_description = 'فعال'


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action', 'model_name', 'object_repr', 'factory')
    list_filter = ('action', 'model_name', 'factory')
    search_fields = ('user__username', 'object_repr')
    readonly_fields = [f.name for f in ActivityLog._meta.fields]


@admin.register(RolePermissionConfig)
class RolePermissionConfigAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission', 'enabled')
    list_filter = ('role', 'enabled')
    search_fields = ('permission',)
