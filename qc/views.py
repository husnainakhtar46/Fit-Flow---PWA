from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from django.core.mail import EmailMessage
from django.conf import settings
from django.http import FileResponse
import io
from PIL import Image as PILImage
from .models import Customer, CustomerEmail, Template, Inspection, InspectionImage, Measurement, FilterPreset, Factory
from .serializers import (
    CustomerSerializer, CustomerEmailSerializer, TemplateSerializer, 
    InspectionSerializer, InspectionListSerializer, CustomTokenObtainPairSerializer,
    InspectionCopySerializer, FilterPresetSerializer, FactorySerializer
)
from django.db.models import Prefetch
from .filters import InspectionFilter
from .services.pdf_generator import generate_pdf_buffer, generate_final_inspection_pdf
from .permissions import CanEditEvaluation, CanEditFinalInspection, CanCreateInspection, CanAddCustomerFeedback, IsQualityHeadOrAdmin, CanViewDashboard, CanManageTemplates
from .utils import process_and_compress_image


class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]  # Explicitly allow unauthenticated access for login
    serializer_class = CustomTokenObtainPairSerializer


class InspectionViewSet(viewsets.ModelViewSet):
    """ViewSet for Evaluation/Inspection reports with role-based permissions."""
    queryset = Inspection.objects.all()
    serializer_class = InspectionSerializer
    permission_classes = [CanEditEvaluation]
    
    # Use django-filter for advanced filtering + ordering
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = InspectionFilter
    ordering_fields = ['created_at', 'style', 'decision', 'stage']
    ordering = ['-created_at'] 

    def get_queryset(self):
        queryset = Inspection.objects.select_related('customer', 'template', 'created_by').order_by("-created_at")
        # Exclude drafts from the main list (they have their own endpoint)
        if self.action == 'list':
            queryset = queryset.filter(is_draft=False)
        if self.action != 'list' or self.action == 'retrieve':
            queryset = queryset.prefetch_related(
                'measurements', 
                Prefetch('images', queryset=InspectionImage.objects.only('id', 'caption'))
            )
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return InspectionListSerializer
        if self.action == 'retrieve':
            return InspectionCopySerializer
        return InspectionSerializer

    def perform_create(self, serializer):
        # Save the user who created this report
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        inspection = self.get_object()
        if inspection.is_draft:
            return Response({"error": "Cannot generate PDF for a draft inspection."}, status=status.HTTP_400_BAD_REQUEST)
        buffer = generate_pdf_buffer(inspection)
        return FileResponse(buffer, filename=f"{inspection.style}_Report.pdf", content_type="application/pdf")

    @action(detail=False, methods=["get"])
    def drafts(self, request):
        """Return only the current user's draft inspections."""
        drafts = Inspection.objects.filter(
            is_draft=True, created_by=request.user
        ).select_related('customer', 'template', 'created_by').order_by('-updated_at')
        serializer = InspectionListSerializer(drafts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def upload_image(self, request, pk=None):
        inspection = self.get_object()
        image_file = request.FILES.get("image")
        caption = request.data.get("caption", "Inspection Image")
        
        if not image_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            compressed_file, _ = process_and_compress_image(image_file)
            InspectionImage.objects.create(
                inspection=inspection,
                image=compressed_file,
                caption=caption
            )
            return Response({"status": "Image uploaded and compressed"}, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"])
    def send_email(self, request, pk=None):
        inspection = self.get_object()
        
        # Separate emails by type (To/CC)
        if inspection.customer:
            to_emails = list(inspection.customer.emails.filter(email_type='to').values_list('email', flat=True))
            cc_emails = list(inspection.customer.emails.filter(email_type='cc').values_list('email', flat=True))
        else:
            to_emails = []
            cc_emails = []
            
        if not to_emails:
             return Response({"error": "No 'To' recipients found. Add at least one 'To' email to the Customer first."}, status=status.HTTP_400_BAD_REQUEST)

        # Block email for draft inspections
        if inspection.is_draft:
            return Response({"error": "Cannot send email for a draft inspection. Please finalize it first."}, status=status.HTTP_400_BAD_REQUEST)

        # Updated Subject and Body
        date_str = inspection.created_at.strftime('%Y-%m-%d')
        subject = f"{inspection.customer.name if inspection.customer else 'N/A'} - PO: {inspection.po_number} - Style: {inspection.style} - Color: {inspection.color or 'N/A'} - {date_str} - Decision: {inspection.decision}"
        
        body = (
            f"Dear Team,\n\n"
            f"Please find attached the sample evaluation report against the titled style.\n\n"
            f"Style: {inspection.style}\n"
            f"PO Number: {inspection.po_number}\n"
            f"Stage: {inspection.stage}\n"
            f"Decision: {inspection.decision}\n\n"
            f"Thank you."
        )
        
        buffer = generate_pdf_buffer(inspection)
        filename = f"{inspection.style}_{inspection.po_number}_Report.pdf"
        
        try:
            # Try Gmail API first (OAuth2)
            from .gmail_service import send_gmail_message
            
            attachments = [(filename, buffer.getvalue(), "application/pdf")]
            result = send_gmail_message(
                to_emails=to_emails,
                subject=subject,
                body=body,
                attachments=attachments,
                cc_emails=cc_emails if cc_emails else None
            )
            return Response({"sent": True, "to": to_emails, "cc": cc_emails, "method": "gmail_api"})
            
        except Exception as gmail_error:
            # Fall back to SMTP if Gmail API not configured
            try:
                email = EmailMessage(subject, body, settings.EMAIL_HOST_USER, to_emails, cc=cc_emails if cc_emails else None)
                email.attach(filename, buffer.getvalue(), "application/pdf")
                email.send(fail_silently=False)
                return Response({"sent": True, "to": to_emails, "cc": cc_emails, "method": "smtp"})
            except Exception as smtp_error:
                error_msg = f"Gmail API: {str(gmail_error)} | SMTP: {str(smtp_error)}"
                return Response(
                    {"error": f"Email failed: {error_msg}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    @action(detail=True, methods=["patch"], permission_classes=[CanAddCustomerFeedback])
    def update_customer_feedback(self, request, pk=None):
        """
        Update customer feedback fields only.
        Only merchandisers and admin can use this.
        """
        from django.utils import timezone
        inspection = self.get_object()
        
        # Only allow updating feedback-specific fields
        allowed_fields = ['customer_decision', 'customer_feedback_comments']
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        
        if not data:
            return Response({"error": "No valid feedback fields provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update the fields
        for field, value in data.items():
            setattr(inspection, field, value)
        
        # Auto-set feedback date (use full datetime for precision)
        inspection.customer_feedback_date = timezone.now()
        inspection.save()
        
        return Response({
            "id": str(inspection.id),
            "customer_decision": inspection.customer_decision,
            "customer_feedback_comments": inspection.customer_feedback_comments,
            "customer_feedback_date": str(inspection.customer_feedback_date),
        })

class CustomerViewSet(viewsets.ModelViewSet):
    """ViewSet for Customer management - Quality Head/Admin only."""
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsQualityHeadOrAdmin]
    
    def get_queryset(self):
        print(f"DEBUG: CustomerViewSet.get_queryset called by user: {self.request.user}")
        qs = Customer.objects.all()
        print(f"DEBUG: Customer Count in DB: {qs.count()}")
        return qs
    
    @action(detail=True, methods=["post"])
    def add_email(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerEmailSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(customer=customer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class FactoryViewSet(viewsets.ModelViewSet):
    queryset = Factory.objects.all().order_by('-created_at')
    serializer_class = FactorySerializer
    permission_classes = [permissions.IsAuthenticated]

class TemplateViewSet(viewsets.ModelViewSet):
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer
    permission_classes = [CanManageTemplates]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'customer__name']

    def get_queryset(self):
        queryset = Template.objects.all()
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        return queryset


class FilterPresetViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user filter presets"""
    serializer_class = FilterPresetSerializer
    
    def get_queryset(self):
        # Only return presets for the current user
        return FilterPreset.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        # Auto-assign the current user when creating a preset
        serializer.save(user=self.request.user)

from django.db.models import Count, Q
from django.db.models.functions import TruncMonth

class DashboardView(APIView):
    permission_classes = [CanViewDashboard]
    
    def get(self, request):
        # Parse optional date range filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        customer_id = request.query_params.get('customer_id')
        factory_name = request.query_params.get('factory_name')
        
        # ==================== EVALUATION ANALYTICS ====================
        # Base queryset with filters
        eval_qs = Inspection.objects.all()
        if start_date:
            eval_qs = eval_qs.filter(created_at__date__gte=start_date)
        if end_date:
            eval_qs = eval_qs.filter(created_at__date__lte=end_date)
        if customer_id:
            eval_qs = eval_qs.filter(customer_id=customer_id)
        if factory_name:
            eval_qs = eval_qs.filter(factory=factory_name)
        
        total_inspections = eval_qs.count()
        pass_count = eval_qs.filter(decision="Accepted").count()
        fail_count = eval_qs.exclude(decision="Accepted").count()
        pass_rate = (pass_count / total_inspections * 100) if total_inspections > 0 else 0
        
        recent_inspections = eval_qs.select_related('customer', 'template') \
                                               .order_by("-created_at")[:5]
        recent_serializer = InspectionListSerializer(recent_inspections, many=True)

        # 1. Inspections by Stage
        inspections_by_stage = eval_qs.values('stage').annotate(count=Count('id')).order_by('-count')

        # 2. Inspections by Customer
        inspections_by_customer = eval_qs.values('customer__name').annotate(count=Count('id')).order_by('-count')

        # 3. Monthly Inspection Trend
        monthly_trend = eval_qs.annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id')).order_by('month')

        # 4. Customer vs Internal Decision
        internal_decisions = eval_qs.values('decision').annotate(count=Count('id'))
        customer_decisions = eval_qs.values('customer_decision').annotate(count=Count('id'))

        # ==================== FINAL INSPECTION ANALYTICS ====================
        # Base queryset with filters
        fi_qs = FinalInspection.objects.all()
        if start_date:
            fi_qs = fi_qs.filter(inspection_date__gte=start_date)
        if end_date:
            fi_qs = fi_qs.filter(inspection_date__lte=end_date)
        if customer_id:
            fi_qs = fi_qs.filter(customer_id=customer_id)
        if factory_name:
            fi_qs = fi_qs.filter(factory=factory_name)
        
        fi_total = fi_qs.count()
        fi_pass = fi_qs.filter(result='Pass').count()
        fi_fail = fi_qs.filter(result='Fail').count()
        fi_pass_rate = (fi_pass / fi_total * 100) if fi_total > 0 else 0

        # 1. Pass/Fail Monthly Trend
        fi_monthly_pass = fi_qs.filter(result='Pass').annotate(
            month=TruncMonth('inspection_date')
        ).values('month').annotate(count=Count('id')).order_by('month')
        
        fi_monthly_fail = fi_qs.filter(result='Fail').annotate(
            month=TruncMonth('inspection_date')
        ).values('month').annotate(count=Count('id')).order_by('month')

        # 2. By Customer (Pass/Fail counts)
        fi_by_customer = fi_qs.values('customer__name').annotate(
            pass_count=Count('id', filter=Q(result='Pass')),
            fail_count=Count('id', filter=Q(result='Fail'))
        ).order_by('-pass_count')[:10]

        # 3. Top Defect Types (filter by inspection date via related FinalInspection)
        defect_qs = FinalInspectionDefect.objects.all()
        if start_date:
            defect_qs = defect_qs.filter(final_inspection__inspection_date__gte=start_date)
        if end_date:
            defect_qs = defect_qs.filter(final_inspection__inspection_date__lte=end_date)
        fi_top_defects = defect_qs.values('description').annotate(
            total=Count('id')
        ).order_by('-total')[:10]

        return Response({
            # Evaluation Data
            "total_inspections": total_inspections,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "pass_rate": round(pass_rate, 1),
            "recent_inspections": recent_serializer.data,
            "inspections_by_stage": list(inspections_by_stage),
            "inspections_by_customer": list(inspections_by_customer),
            "monthly_trend": list(monthly_trend),
            "internal_decisions": list(internal_decisions),
            "customer_decisions": list(customer_decisions),
            # Final Inspection Data
            "fi_total": fi_total,
            "fi_pass": fi_pass,
            "fi_fail": fi_fail,
            "fi_pass_rate": round(fi_pass_rate, 1),
            "fi_monthly_pass": list(fi_monthly_pass),
            "fi_monthly_fail": list(fi_monthly_fail),
            "fi_by_customer": list(fi_by_customer),
            "fi_top_defects": list(fi_top_defects),
        })

# ==================== Final Inspection ViewSet ====================

from .models import FinalInspection, FinalInspectionDefect, FinalInspectionSizeCheck, FinalInspectionImage, calculate_sample_size, get_aql_limits
from .serializers import FinalInspectionSerializer, FinalInspectionListSerializer, FinalInspectionImageSerializer


class FinalInspectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Final Inspection Reports with AQL-based shipment audits.
    Role-based permissions: QA can edit own, Quality Head/Supervisor can edit all.
    """
    queryset = FinalInspection.objects.all()
    serializer_class = FinalInspectionSerializer
    permission_classes = [CanEditFinalInspection]
    
    # Filtering and ordering
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['order_no', 'style_no', 'factory', 'supplier', 'customer__name']
    ordering_fields = ['created_at', 'inspection_date', 'result', 'order_no']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Optimize queries with select_related and prefetch_related."""
        queryset = FinalInspection.objects.select_related('customer', 'created_by').order_by('-created_at')
        
        # Only prefetch nested data for detail views
        if self.action in ['retrieve', 'update', 'partial_update']:
            queryset = queryset.prefetch_related('defects', 'size_checks', 'images')
        
        # Filter out drafts from the main list (they have their own endpoint)
        if self.action == 'list':
            queryset = queryset.filter(is_draft=False)

        # Filter by query params
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        
        result = self.request.query_params.get('result')
        if result:
            queryset = queryset.filter(result=result)
        
        # Date range filtering
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(inspection_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(inspection_date__lte=date_to)
        
        return queryset
    
    def get_serializer_class(self):
        """Use list serializer for list view, full serializer otherwise."""
        if self.action == 'list':
            return FinalInspectionListSerializer
        return FinalInspectionSerializer
    
    def perform_create(self, serializer):
        """Save the user who created this report."""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def upload_image(self, request, pk=None):
        """Upload and attach an image to a final inspection with caption and category."""
        final_inspection = self.get_object()
        image_file = request.FILES.get('image')
        caption = request.data.get('caption', 'Final Inspection Image')
        category = request.data.get('category', 'General')
        order = request.data.get('order', 0)
        
        if not image_file:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            compressed_file, _ = process_and_compress_image(image_file)
            
            img_obj = FinalInspectionImage.objects.create(
                final_inspection=final_inspection,
                image=compressed_file,
                caption=caption,
                category=category,
                order=int(order)
            )
            
            serializer = FinalInspectionImageSerializer(img_obj)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def drafts(self, request):
        """Return only the current user's draft final inspections."""
        drafts = FinalInspection.objects.filter(
            is_draft=True, created_by=request.user
        ).select_related('customer', 'created_by').order_by('-updated_at')
        serializer = FinalInspectionListSerializer(drafts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def calculate_aql(self, request):
        """
        Centralized Calculation Endpoint.
        Input: { "qty": 2000, "standard": "standard", "critical": 0, "major": 5, "minor": 8 }
        Output: { "sample_size": 125, "limits": { ... }, "result": "Pass/Fail" }
        """
        try:
            # 1. Get Inputs
            qty = int(request.data.get('qty', 0))
            standard = request.data.get('standard', 'standard')
            
            # defect counts (optional, for checking result)
            critical_found = int(request.data.get('critical', 0))
            major_found = int(request.data.get('major', 0))
            minor_found = int(request.data.get('minor', 0))

            # 2. Calculate Sample Size
            sample_size = calculate_sample_size(qty)

            # 3. Determine AQL Levels
            if standard == 'strict':
                aql_critical, aql_major, aql_minor = 0.0, 1.5, 2.5
            else:
                aql_critical, aql_major, aql_minor = 0.0, 2.5, 4.0

            # 4. Get Allowed Limits
            max_critical = get_aql_limits(sample_size, aql_critical)
            max_major = get_aql_limits(sample_size, aql_major)
            max_minor = get_aql_limits(sample_size, aql_minor)

            # 5. Determine Result
            result = "Pass"
            if (critical_found > max_critical or 
                major_found > max_major or 
                minor_found > max_minor):
                result = "Fail"

            return Response({
                "sample_size": sample_size,
                "limits": {
                    "critical": max_critical,
                    "major": max_major,
                    "minor": max_minor
                },
                "result": result,
                "standard_used": standard
            })
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

            
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Generate and download PDF report for final inspection."""
        final_inspection = self.get_object()
        buffer = generate_final_inspection_pdf(final_inspection)
        filename = f"FIR_{final_inspection.order_no}_{final_inspection.style_no}.pdf"
        return FileResponse(buffer, filename=filename, content_type='application/pdf')


# ==================== Style Cycle ViewSet ====================

from .models import StyleMaster, SampleComment, SampleCommentImage, StyleLink
from .serializers import (
    StyleMasterSerializer, StyleMasterListSerializer, 
    SampleCommentSerializer, SampleCommentImageSerializer, StyleLinkSerializer
)


class StyleMasterViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Style Cycle management.
    Merchandisers use this to create style files and add customer sample comments.
    QA can load the latest comments into the Evaluation Form.
    """
    queryset = StyleMaster.objects.all()
    serializer_class = StyleMasterSerializer
    permission_classes = [IsAuthenticated]
    
    # Filtering and ordering
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['po_number', 'style_name', 'customer__name', 'season', 'factory__name']
    ordering_fields = ['created_at', 'po_number', 'style_name']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Optimize queries with select_related and prefetch_related."""
        queryset = StyleMaster.objects.select_related('customer', 'created_by').order_by('-created_at')
        
        # Only prefetch nested data for detail views
        if self.action in ['retrieve', 'update', 'partial_update']:
            queryset = queryset.prefetch_related('comments', 'links')
        
        # Filter by query params
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        
        return queryset
    
    def get_serializer_class(self):
        """Use list serializer for list view, full serializer otherwise."""
        if self.action == 'list':
            return StyleMasterListSerializer
        return StyleMasterSerializer
    
    def perform_create(self, serializer):
        """Save the user who created this style."""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def by_po(self, request):
        """
        Get style details by PO number with fuzzy matching support.
        Used by EvaluationForm to load customer comments.
        
        Query Params:
            po_number: The PO number to search for
        
        Returns: 
            - Exact match: StyleMaster with nested comments and links
            - No exact match: List of similar PO suggestions
        """
        po_number = request.query_params.get('po_number', '').strip()
        if not po_number:
            return Response(
                {'error': 'po_number query parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Try exact match first (case-insensitive)
        try:
            style = StyleMaster.objects.prefetch_related('comments', 'links').get(po_number__iexact=po_number)
            serializer = StyleMasterSerializer(style)
            return Response(serializer.data)
        except StyleMaster.DoesNotExist:
            pass
        
        # No exact match - search for similar PO numbers using DB queries
        # Strategy 1: Contains search
        contains_matches = StyleMaster.objects.filter(
            po_number__icontains=po_number
        ).select_related('customer')[:10]
        
        suggestions = []
        seen_ids = set()
        
        for s in contains_matches:
            suggestions.append({
                'id': str(s.id),
                'po_number': s.po_number,
                'style_name': s.style_name,
                'color': s.color,
                'customer_name': s.customer.name if s.customer else None,
            })
            seen_ids.add(s.id)
            
        # Strategy 2: If we don't have enough suggestions, try a broader search
        # (e.g., matching start/end or removing special chars if your DB supports regex, 
        # but for portability/simplicity here we'll stick to 'icontains' or maybe 'istartswith')
        if len(suggestions) < 10:
             # Just an example of getting more if needed, can be expanded based on specific "fuzzy" needs
             # For now, strict 'icontains' is usually sufficient for users.
             pass

        if suggestions:
            return Response({
                'exact_match': False,
                'suggestions': suggestions,
                'searched_po': po_number
            }, status=status.HTTP_200_OK)
        
        return Response(
            {'error': f'No style found with PO number: {po_number}', 'suggestions': []},
            status=status.HTTP_404_NOT_FOUND
        )
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Add a new sample comment to a style."""
        style = self.get_object()
        serializer = SampleCommentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(style=style, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_link(self, request, pk=None):
        """Add a new link to a style."""
        style = self.get_object()
        serializer = StyleLinkSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(style=style)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def latest_comments(self, request, pk=None):
        """
        Get the latest sample comment for a style.
        This is used by EvaluationForm to auto-populate customer comments.
        """
        style = self.get_object()
        latest_comment = style.comments.order_by('-created_at').first()
        
        if latest_comment:
            serializer = SampleCommentSerializer(latest_comment)
            return Response(serializer.data)
        return Response({'message': 'No comments found for this style'}, status=status.HTTP_404_NOT_FOUND)


class SampleCommentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing individual sample comments."""
    queryset = SampleComment.objects.all()
    serializer_class = SampleCommentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = SampleComment.objects.select_related('style', 'created_by').order_by('-created_at')
        
        # Filter by style
        style_id = self.request.query_params.get('style')
        if style_id:
            queryset = queryset.filter(style_id=style_id)
        
        # Filter by sample_type
        sample_type = self.request.query_params.get('sample_type')
        if sample_type:
            queryset = queryset.filter(sample_type=sample_type)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def upload_images(self, request, pk=None):
        """Upload one or more images to a sample comment (compressed to WebP)."""
        import logging
        logger = logging.getLogger(__name__)
        
        comment = self.get_object()
        files = request.FILES.getlist('images')
        category = request.data.get('category', 'general')
        caption = request.data.get('caption', '')

        if not files:
            return Response({'error': 'No images provided'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for f in files:
            try:
                logger.info(f"Processing image: {f.name}, size: {f.size}")
                compressed_file, _ = process_and_compress_image(f)
                logger.info(f"Compressed to: {compressed_file.name}, saving to storage...")
                img = SampleCommentImage.objects.create(
                    comment=comment,
                    image=compressed_file,
                    caption=caption,
                    category=category,
                )
                logger.info(f"Image saved successfully: {img.image.url}")
                created.append(SampleCommentImageSerializer(img).data)
            except ValueError as e:
                logger.error(f"Image processing error: {e}")
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                logger.error(f"Image upload failed: {type(e).__name__}: {e}", exc_info=True)
                return Response({'error': f'Upload failed: {type(e).__name__}: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(created, status=status.HTTP_201_CREATED)


class SampleCommentImageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing individual sample comment images (primarily for deletion)."""
    queryset = SampleCommentImage.objects.all()
    serializer_class = SampleCommentImageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = SampleCommentImage.objects.select_related('comment').order_by('uploaded_at')
        comment_id = self.request.query_params.get('comment')
        if comment_id:
            queryset = queryset.filter(comment_id=comment_id)
        return queryset


class StyleLinkViewSet(viewsets.ModelViewSet):
    """ViewSet for managing style links."""
    queryset = StyleLink.objects.all()
    serializer_class = StyleLinkSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = StyleLink.objects.select_related('style').order_by('label')
        
        # Filter by style
        style_id = self.request.query_params.get('style')
        if style_id:
            queryset = queryset.filter(style_id=style_id)
        
        return queryset
