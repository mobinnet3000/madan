from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DeviceDailyAnalysisViewSet, DeviceLogViewSet, FactoryDetailViewSet

router = DefaultRouter()
router.register(r'factory-setup', FactoryDetailViewSet, basename='factory-setup')
router.register(r'daily-analysis', DeviceDailyAnalysisViewSet, basename='daily-analysis'),
router.register(r'device-logs', DeviceLogViewSet, basename='device-logs'),


urlpatterns = [
    path('api/', include(router.urls)),

]
