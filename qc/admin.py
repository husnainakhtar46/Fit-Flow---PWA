from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model
from .models import (
    Customer, CustomerEmail, Template, TemplatePOM, Inspection, Measurement, InspectionImage,
    FinalInspection, FinalInspectionDefect, FinalInspectionSizeCheck, FinalInspectionImage,
    UserProfile
)

User = get_user_model()


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)
    
    def get_inlines(self, request, obj):
        """Only show profile inline when editing existing users, not when adding new ones."""
        if obj:  # obj is the User instance being edited
            return self.inlines
        return []  # Don't show inline on add form


# Unregister the default User admin and register our custom one
try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass
admin.site.register(User, UserAdmin)

# Register UserProfile separately for direct access
admin.site.register(UserProfile)

admin.site.register(Customer)
admin.site.register(CustomerEmail)
admin.site.register(Template)
admin.site.register(TemplatePOM)
admin.site.register(Inspection)
admin.site.register(Measurement)
admin.site.register(InspectionImage)
admin.site.register(FinalInspection)
admin.site.register(FinalInspectionDefect)
admin.site.register(FinalInspectionSizeCheck)
admin.site.register(FinalInspectionImage)
