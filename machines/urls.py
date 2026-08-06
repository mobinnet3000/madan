from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DeviceDailyAnalysisViewSet, DeviceLogViewSet, FactoryDetailViewSet,
    ProductionReportViewSet,
    performance_report_view, analysis_report_view, report_ranges_view,
    line_attributes_view, device_attributes_view,
)

router = DefaultRouter()
router.register(r'factory-setup', FactoryDetailViewSet, basename='factory-setup')
router.register(r'daily-analysis', DeviceDailyAnalysisViewSet, basename='daily-analysis')
router.register(r'device-logs', DeviceLogViewSet, basename='device-logs')
router.register(r'production-reports', ProductionReportViewSet, basename='production-reports')

urlpatterns = [
    path('api/', include(router.urls)),

    path('api/reports/ranges/', report_ranges_view, name='report-ranges'),
    path('api/reports/performance/', performance_report_view, name='report-performance'),
    path('api/reports/analysis/', analysis_report_view, name='report-analysis'),

    path('api/lines/<int:uid>/attributes/', line_attributes_view, name='line-attributes'),
    path('api/devices/<int:uid>/attributes/', device_attributes_view, name='device-attributes'),
]
