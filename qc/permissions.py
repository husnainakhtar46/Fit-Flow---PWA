# qc/permissions.py
"""
Custom DRF permission classes for role-based access control.
"""
from rest_framework.permissions import BasePermission


def get_user_type(user):
    """Get user type from profile, returns None for superusers to allow all access."""
    if user.is_superuser:
        return 'admin'
    try:
        return user.profile.user_type
    except:
        return 'qa'  # Default fallback


class CanEditEvaluation(BasePermission):
    """
    Only Quality Head and Quality Supervisor can edit evaluations.
    Superusers always have access.
    """
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        user = request.user
        if user.is_superuser:
            return True
        user_type = get_user_type(user)
        return user_type in ['quality_head', 'quality_supervisor']
    
    def has_object_permission(self, request, view, obj):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        user = request.user
        if user.is_superuser:
            return True
        user_type = get_user_type(user)
        return user_type in ['quality_head', 'quality_supervisor']


class CanEditFinalInspection(BasePermission):
    """
    Quality Head/Supervisor can edit all.
    QA can only edit their own final inspections.
    Superusers always have access.
    """
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        user = request.user
        if user.is_superuser:
            return True
        user_type = get_user_type(user)
        # QA, Quality Head, Quality Supervisor can create
        return user_type in ['qa', 'quality_head', 'quality_supervisor']
    
    def has_object_permission(self, request, view, obj):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        user = request.user
        if user.is_superuser:
            return True
        user_type = get_user_type(user)
        # Quality Head/Supervisor can edit any
        if user_type in ['quality_head', 'quality_supervisor']:
            return True
        # QA can only edit their own
        if user_type == 'qa':
            return obj.created_by == user
        return False


class CanAddCustomerFeedback(BasePermission):
    """
    Only Merchandiser can add/edit customer feedback.
    Others can only view.
    Superusers always have access.
    """
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        user = request.user
        if user.is_superuser:
            return True
        user_type = get_user_type(user)
        return user_type == 'merchandiser'


class CanCreateInspection(BasePermission):
    """
    QA, Quality Head, Quality Supervisor can create inspections.
    Merchandiser cannot create, only view.
    Superusers always have access.
    """
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        user = request.user
        if user.is_superuser:
            return True
        user_type = get_user_type(user)
        return user_type in ['qa', 'quality_head', 'quality_supervisor']


class IsQualityHeadOrAdmin(BasePermission):
    """Only Quality Head or Superuser can manage customers."""
    def has_permission(self, request, view):
        user = request.user
        if user.is_superuser:
            return True
        user_type = get_user_type(user)
        return user_type == 'quality_head'
