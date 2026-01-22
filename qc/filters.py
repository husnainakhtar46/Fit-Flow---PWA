# qc/filters.py
import django_filters
from django.db import models
from .models import Inspection


class InspectionFilter(django_filters.FilterSet):
    """
    Advanced filtering for Inspection model
    Supports: date ranges, decision, stage, customer, and text search
    """
    # Date range filters
    created_at_after = django_filters.DateFilter(field_name='created_at', lookup_expr='gte', label='From Date')
    created_at_before = django_filters.DateFilter(field_name='created_at', lookup_expr='lte', label='To Date')
    
    # Choice filters
    decision = django_filters.MultipleChoiceFilter(
        choices=Inspection.DECISION_CHOICES,
        label='Decision'
    )
    stage = django_filters.MultipleChoiceFilter(
        choices=Inspection.STAGE_CHOICES,
        label='Stage'
    )
    
    # Customer filter
    customer = django_filters.UUIDFilter(field_name='customer__id', label='Customer')
    
    # Text search across multiple fields
    search = django_filters.CharFilter(method='filter_search', label='Search')
    
    def filter_search(self, queryset, name, value):
        """Search across style, po_number, customer name, and created_by username"""
        if not value:
            return queryset
        return queryset.filter(
            models.Q(style__icontains=value) |
            models.Q(po_number__icontains=value) |
            models.Q(customer__name__icontains=value) |
            models.Q(created_by__username__icontains=value)
        )
    
    class Meta:
        model = Inspection
        fields = ['decision', 'stage', 'customer', 'created_at_after', 'created_at_before', 'search']
