from django.contrib import admin
from .models import UserProfile, ActivityLog


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'factory', 'phone')
    list_filter = ('role', 'factory')
    search_fields = ('user__username', 'user__first_name')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action', 'model_name', 'object_repr', 'factory')
    list_filter = ('action', 'model_name', 'factory')
    search_fields = ('user__username', 'object_repr')
    readonly_fields = [f.name for f in ActivityLog._meta.fields]
