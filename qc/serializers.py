# qc/serializers.py
from rest_framework import serializers
from .models import (
    Customer, CustomerEmail, Template, TemplatePOM, Inspection, Measurement, MeasurementSample, InspectionImage, FilterPreset,
    FinalInspection, FinalInspectionDefect, FinalInspectionSizeCheck, FinalInspectionImage,
    FinalInspectionMeasurement, FinalInspectionMeasurementSample,
    StyleMaster, SampleComment, SampleCommentImage, StyleLink, Factory
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils import timezone

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['username'] = self.user.username
        data['is_superuser'] = self.user.is_superuser
        # Include user_type from profile (default to 'qa' if no profile)
        try:
            data['user_type'] = self.user.profile.user_type
        except:
            data['user_type'] = 'qa'
        return data

class CustomerEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerEmail
        fields = ["id", "contact_name", "email", "email_type"]

class CustomerSerializer(serializers.ModelSerializer):
    emails = CustomerEmailSerializer(many=True, required=False)
    class Meta:
        model = Customer
        fields = ["id", "name", "created_at", "emails"]

    def create(self, validated_data):
        emails_data = validated_data.pop("emails", [])
        customer = Customer.objects.create(**validated_data)
        for email_data in emails_data:
            CustomerEmail.objects.create(customer=customer, **email_data)
        return customer

    def update(self, instance, validated_data):
        emails_data = validated_data.pop("emails", None)
        
        # Update main fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update emails if provided
        if emails_data is not None:
            instance.emails.all().delete()
            for email_data in emails_data:
                CustomerEmail.objects.create(customer=instance, **email_data)
        return instance

class TemplatePOMSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplatePOM
        fields = ["id", "name", "default_tol", "default_std", "order"]

class FactorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Factory
        fields = ["id", "name", "address", "contact_person", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

class TemplateSerializer(serializers.ModelSerializer):
    poms = TemplatePOMSerializer(many=True)
    class Meta:
        model = Template
        fields = ["id", "name", "description", "created_at", "poms", "customer"]

    def create(self, validated_data):
        poms_data = validated_data.pop("poms", [])
        template = Template.objects.create(**validated_data)
        for i, pom in enumerate(poms_data):
            TemplatePOM.objects.create(template=template, order=i, **pom)
        return template

    def update(self, instance, validated_data):
        poms_data = validated_data.pop("poms", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if poms_data is not None:
            instance.poms.all().delete()
            for i, pom in enumerate(poms_data):
                TemplatePOM.objects.create(
                    template=instance,
                    order=i,
                    name=pom.get('name', ''),
                    default_tol=pom.get('default_tol', 0.0),
                    default_std=pom.get('default_std', None),
                )
        return instance

class MeasurementSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeasurementSample
        fields = ['id', 'index', 'value']


class MeasurementSerializer(serializers.ModelSerializer):
    samples = MeasurementSampleSerializer(many=True, required=False)

    class Meta:
        model = Measurement
        fields = ['id', 'pom_name', 'tol', 'std', 'status', 'samples']

class InspectionImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionImage
        fields = ["id","caption","image","uploaded_at"]

class InspectionListSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    class Meta:
        model = Inspection
        fields = [
            "id","style","color","po_number","stage","template","customer",
            "remarks","decision","created_at", "updated_at", "created_by_username",
            "customer_decision", "customer_feedback_comments", "customer_feedback_date",
            "is_draft"
        ]

class InspectionCopySerializer(serializers.ModelSerializer):
    measurements = MeasurementSerializer(many=True, read_only=True)
    images = InspectionImageSerializer(many=True, read_only=True)
    class Meta:
        model = Inspection
        fields = [
            "id","style","color","po_number","factory","stage","template","customer",
            # Customer Comments by Category
            "customer_remarks", "customer_fit_comments", "customer_workmanship_comments",
            "customer_wash_comments", "customer_fabric_comments", "customer_accessories_comments",
            "customer_comments_addressed",
            # QA Comments by Category
            "qa_fit_comments", "qa_workmanship_comments", 
            "qa_wash_comments", "qa_fabric_comments", "qa_accessories_comments",
            # Fabric Checks
            "fabric_handfeel", "fabric_pilling",
            # Dynamic Accessories
            "accessories_data",
            # General
            "remarks","decision","created_at","updated_at","measurements","images",
            "customer_decision", "customer_feedback_comments", "customer_feedback_date",
            "is_draft"
        ]

class InspectionSerializer(serializers.ModelSerializer):
    measurements = MeasurementSerializer(many=True)
    images = InspectionImageSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Inspection
        fields = [
            "id","style","color","po_number","factory","stage","template","customer",
            # Customer Comments by Category
            "customer_remarks", "customer_fit_comments", "customer_workmanship_comments",
            "customer_wash_comments", "customer_fabric_comments", "customer_accessories_comments",
            "customer_comments_addressed",
            # QA Comments by Category
            "qa_fit_comments", "qa_workmanship_comments", 
            "qa_wash_comments", "qa_fabric_comments", "qa_accessories_comments",
            # Fabric Checks
            "fabric_handfeel", "fabric_pilling",
            # Dynamic Accessories
            "accessories_data",
            # General
            "remarks","decision","created_at","updated_at","measurements","images",
            "created_by_username",
            "customer_decision", "customer_feedback_comments", "customer_feedback_date",
            "is_draft"
        ]

    def create(self, validated_data):
        measurements_data = validated_data.pop("measurements", [])
        inspection = Inspection.objects.create(**validated_data)
        for m_data in measurements_data:
            samples_data = m_data.pop("samples", [])
            measurement = Measurement.objects.create(inspection=inspection, **m_data)
            for s_data in samples_data:
                MeasurementSample.objects.create(measurement=measurement, **s_data)
        return inspection

    def update(self, instance, validated_data):
        measurements_data = validated_data.pop("measurements", None)
        
        # Update feedback date if feedback is provided
        if 'customer_decision' in validated_data or 'customer_feedback_comments' in validated_data:
            instance.customer_feedback_date = timezone.now()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if measurements_data is not None:
            instance.measurements.all().delete()
            for m_data in measurements_data:
                samples_data = m_data.pop("samples", [])
                measurement = Measurement.objects.create(inspection=instance, **m_data)
                for s_data in samples_data:
                    MeasurementSample.objects.create(measurement=measurement, **s_data)
        return instance

class FilterPresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = FilterPreset
        fields = ["id", "name", "description", "filters", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

# ==================== Final Inspection Serializers ====================
class FinalInspectionMeasurementSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinalInspectionMeasurementSample
        fields = ['id', 'index', 'value']


class FinalInspectionMeasurementSerializer(serializers.ModelSerializer):
    samples = FinalInspectionMeasurementSampleSerializer(many=True, required=False)

    class Meta:
        model = FinalInspectionMeasurement
        fields = ['id', 'pom_name', 'tol', 'spec', 'size_name', 'samples']

class FinalInspectionDefectSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinalInspectionDefect
        fields = ['id', 'description', 'severity', 'count', 'photo']


class FinalInspectionSizeCheckSerializer(serializers.ModelSerializer):
    difference = serializers.ReadOnlyField()
    deviation_percent = serializers.ReadOnlyField()
    
    class Meta:
        model = FinalInspectionSizeCheck
        fields = ['id', 'size', 'order_qty', 'packed_qty', 'difference', 'deviation_percent']


class FinalInspectionImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinalInspectionImage
        fields = ['id', 'image', 'caption', 'category', 'order', 'uploaded_at']


class FinalInspectionListSerializer(serializers.ModelSerializer):
    """Minimal serializer for list views."""
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = FinalInspection
        fields = [
            'id', 'order_no', 'style_no', 'color', 'inspection_attempt', 'customer', 'customer_name',
            'inspection_date', 'result', 'total_order_qty', 'sample_size',
            'created_at', 'updated_at', 'created_by_username', 'is_draft'
        ]


class FinalInspectionSerializer(serializers.ModelSerializer):
    """Full serializer with nested relationships."""
    defects = FinalInspectionDefectSerializer(many=True, required=False)
    size_checks = FinalInspectionSizeCheckSerializer(many=True, required=False)
    measurements = FinalInspectionMeasurementSerializer(many=True, required=False)
    images = FinalInspectionImageSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    
    # Read-only calculated fields
    max_allowed_critical = serializers.ReadOnlyField()
    max_allowed_major = serializers.ReadOnlyField()
    max_allowed_minor = serializers.ReadOnlyField()
    result = serializers.ReadOnlyField()
    
    class Meta:
        model = FinalInspection
        fields = [
            'id', 'customer', 'customer_name', 'supplier', 'factory',
            'inspection_date', 'order_no', 'style_no', 'color', 'inspection_attempt',
            'total_order_qty', 'presented_qty', 'sample_size',
            'aql_standard', 'aql_critical', 'aql_major', 'aql_minor',
            'critical_found', 'major_found', 'minor_found',
            'max_allowed_critical', 'max_allowed_major', 'max_allowed_minor',
            'result', 'total_cartons', 'selected_cartons',
            'carton_length', 'carton_width', 'carton_height',
            'gross_weight', 'net_weight',
            'quantity_check', 'workmanship', 'packing_method',
            'marking_label', 'data_measurement', 'hand_feel',
            'remarks', 'created_at', 'updated_at', 'created_by', 'created_by_username',
            'defects', 'size_checks', 'images', 'measurements', 'is_draft'
        ]
    
    def create(self, validated_data):
        """Create FinalInspection with nested defects and size_checks."""
        defects_data = validated_data.pop('defects', [])
        size_checks_data = validated_data.pop('size_checks', [])
        measurements_data = validated_data.pop('measurements', [])
        
        # Create the main inspection
        final_inspection = FinalInspection.objects.create(**validated_data)
        
        # Create nested defects
        for defect_data in defects_data:
            FinalInspectionDefect.objects.create(
                final_inspection=final_inspection,
                **defect_data
            )
        
        # Create nested size checks
        for size_check_data in size_checks_data:
            FinalInspectionSizeCheck.objects.create(
                final_inspection=final_inspection,
                **size_check_data
            )

        # Create nested measurements with samples
        for m_data in measurements_data:
            samples_data = m_data.pop('samples', [])
            measurement = FinalInspectionMeasurement.objects.create(
                final_inspection=final_inspection,
                **m_data
            )
            for s_data in samples_data:
                FinalInspectionMeasurementSample.objects.create(measurement=measurement, **s_data)
        
        return final_inspection
    
    def update(self, instance, validated_data):
        """Update FinalInspection with nested defects and size_checks."""
        defects_data = validated_data.pop('defects', None)
        size_checks_data = validated_data.pop('size_checks', None)
        measurements_data = validated_data.pop('measurements', None)
        
        # Update main fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update defects if provided
        if defects_data is not None:
            instance.defects.all().delete()
            for defect_data in defects_data:
                FinalInspectionDefect.objects.create(
                    final_inspection=instance,
                    **defect_data
                )
        
        # Update size checks if provided
        if size_checks_data is not None:
            instance.size_checks.all().delete()
            for size_check_data in size_checks_data:
                FinalInspectionSizeCheck.objects.create(
                    final_inspection=instance,
                    **size_check_data
                )

        # Update measurements with samples if provided
        if measurements_data is not None:
            instance.measurements.all().delete()
            for m_data in measurements_data:
                samples_data = m_data.pop('samples', [])
                measurement = FinalInspectionMeasurement.objects.create(
                    final_inspection=instance,
                    **m_data
                )
                for s_data in samples_data:
                    FinalInspectionMeasurementSample.objects.create(measurement=measurement, **s_data)
        
        return instance


# ==================== Style Cycle Serializers ====================

class StyleLinkSerializer(serializers.ModelSerializer):
    """Serializer for related links/documents."""
    class Meta:
        model = StyleLink
        fields = ['id', 'label', 'url', 'created_at']
        read_only_fields = ['id', 'created_at']


class SampleCommentImageSerializer(serializers.ModelSerializer):
    """Serializer for sample comment images (inline attachment tiles)."""
    class Meta:
        model = SampleCommentImage
        fields = ['id', 'image', 'caption', 'category', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class SampleCommentSerializer(serializers.ModelSerializer):
    """Serializer for sample comments by type."""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    sample_number_display = serializers.CharField(source='get_sample_number_display', read_only=True)
    images = SampleCommentImageSerializer(many=True, read_only=True)
    
    class Meta:
        model = SampleComment
        fields = [
            'id', 'sample_type', 'sample_number', 'sample_number_display',
            'comments_general', 'comments_fit', 'comments_workmanship',
            'comments_wash', 'comments_fabric', 'comments_accessories',
            'general_edited_at', 'fit_edited_at', 'workmanship_edited_at',
            'wash_edited_at', 'fabric_edited_at', 'accessories_edited_at',
            'images',
            'created_at', 'updated_at', 'created_by_username'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'created_by_username', 'sample_number_display',
            'general_edited_at', 'fit_edited_at', 'workmanship_edited_at',
            'wash_edited_at', 'fabric_edited_at', 'accessories_edited_at',
        ]


class StyleMasterListSerializer(serializers.ModelSerializer):
    """Minimal serializer for list views."""
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    factory_name = serializers.CharField(source='factory.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    comments_count = serializers.SerializerMethodField()
    
    class Meta:
        model = StyleMaster
        fields = [
            'id', 'po_number', 'style_name', 'color', 'season',
            'customer', 'customer_name', 'factory', 'factory_name',
            'comments_count',
            'created_at', 'created_by_username'
        ]
    
    def get_comments_count(self, obj):
        return obj.comments.count()


class StyleMasterSerializer(serializers.ModelSerializer):
    """Full serializer with nested comments and links."""
    comments = SampleCommentSerializer(many=True, required=False)
    links = StyleLinkSerializer(many=True, required=False)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    factory_name = serializers.CharField(source='factory.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = StyleMaster
        fields = [
            'id', 'po_number', 'style_name', 'color', 'season',
            'customer', 'customer_name', 'factory', 'factory_name',
            'comments', 'links',
            'created_at', 'updated_at', 'created_by', 'created_by_username'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by_username']
    
    def create(self, validated_data):
        """Create StyleMaster with nested comments and links."""
        comments_data = validated_data.pop('comments', [])
        links_data = validated_data.pop('links', [])
        
        style = StyleMaster.objects.create(**validated_data)
        
        for comment_data in comments_data:
            SampleComment.objects.create(style=style, **comment_data)
        
        for link_data in links_data:
            StyleLink.objects.create(style=style, **link_data)
        
        return style
    
    def update(self, instance, validated_data):
        """Update StyleMaster with nested comments and links."""
        comments_data = validated_data.pop('comments', None)
        links_data = validated_data.pop('links', None)
        
        # Update main fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update comments if provided
        if comments_data is not None:
            instance.comments.all().delete()
            for comment_data in comments_data:
                SampleComment.objects.create(style=instance, **comment_data)
        
        # Update links if provided
        if links_data is not None:
            instance.links.all().delete()
            for link_data in links_data:
                StyleLink.objects.create(style=instance, **link_data)
        
        return instance
