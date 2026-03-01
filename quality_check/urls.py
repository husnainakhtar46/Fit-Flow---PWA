# qc/urls.py
from rest_framework import routers
from django.contrib import admin
from django.urls import path, include
from qc.views import (
    CustomerViewSet, TemplateViewSet, InspectionViewSet, DashboardView, 
    CustomTokenObtainPairView, FilterPresetViewSet, FinalInspectionViewSet,
    StyleMasterViewSet, SampleCommentViewSet, SampleCommentImageViewSet, StyleLinkViewSet, FactoryViewSet
)
from rest_framework_simplejwt.views import TokenRefreshView


router = routers.DefaultRouter()
router.register(r"customers", CustomerViewSet)
router.register(r"templates", TemplateViewSet)
router.register(r"inspections", InspectionViewSet)
router.register(r'filter-presets', FilterPresetViewSet, basename='filterpreset')
router.register(r'final-inspections', FinalInspectionViewSet)
router.register(r'factories', FactoryViewSet)
# Style Cycle routes
router.register(r'styles', StyleMasterViewSet)
router.register(r'sample-comments', SampleCommentViewSet)
router.register(r'sample-comment-images', SampleCommentImageViewSet)
router.register(r'style-links', StyleLinkViewSet)
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path("", include(router.urls)),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/', include('qc.auth_urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
