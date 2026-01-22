# qc/urls.py
from rest_framework import routers
from django.contrib import admin
from django.urls import path, include
from qc.views import CustomerViewSet, TemplateViewSet, InspectionViewSet, DashboardView, CustomTokenObtainPairView, FilterPresetViewSet, FinalInspectionViewSet
from rest_framework_simplejwt.views import TokenRefreshView


router = routers.DefaultRouter()
router.register(r"customers", CustomerViewSet)
router.register(r"templates", TemplateViewSet)
router.register(r"inspections", InspectionViewSet)
router.register(r'filter-presets', FilterPresetViewSet, basename='filterpreset')
router.register(r'final-inspections', FinalInspectionViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path("", include(router.urls)),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
