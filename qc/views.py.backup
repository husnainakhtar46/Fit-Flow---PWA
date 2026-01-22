from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from django.core.mail import EmailMessage
from django.conf import settings
from django.http import FileResponse
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
from .models import Customer, CustomerEmail, Template, Inspection, InspectionImage, Measurement, FilterPreset
from .serializers import (
    CustomerSerializer, CustomerEmailSerializer, TemplateSerializer, 
    InspectionSerializer, InspectionListSerializer, CustomTokenObtainPairSerializer,
    InspectionCopySerializer, FilterPresetSerializer
)
from django.db.models import Prefetch
from .filters import InspectionFilter

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

def generate_pdf_buffer(inspection):
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y_pos = height - 50 

    # --- Page 1: Header ---
    p.setFont("Helvetica-Bold", 18)
    p.drawString(50, y_pos, "SAMPLE EVALUATION REPORT")
    y_pos -= 20
    
    # Decision Status
    p.setFont("Helvetica-Bold", 14)
    decision = inspection.decision or "PENDING"
    if decision == "Rejected":
        p.setFillColorRGB(1, 0, 0) 
    elif decision == "Accepted":
        p.setFillColorRGB(0, 0.5, 0)
    elif decision == "Represent":
        p.setFillColorRGB(1, 0.5, 0) # Orange
    else:
        p.setFillColorRGB(0, 0, 0)
        
    p.drawRightString(550, height - 50, f"STATUS: {decision.upper()}")
    p.setFillColorRGB(0, 0, 0)

    # Info Block
    p.setFont("Helvetica", 12)
    y_pos -= 10
    p.drawString(50, y_pos, f"Style: {inspection.style}")
    p.drawString(50, y_pos - 15, f"Color: {inspection.color}")
    p.drawString(50, y_pos - 30, f"PO #: {inspection.po_number}")
    
    p.drawString(300, y_pos, f"Date: {inspection.created_at.strftime('%Y-%m-%d')}")
    p.drawString(300, y_pos - 15, f"Stage: {inspection.stage}")
    p.drawString(300, y_pos - 30, f"Customer: {inspection.customer.name if inspection.customer else 'N/A'}")
    y_pos -= 30

    # Table Header (6 Samples)
    y_pos -= 10
    p.setFont("Helvetica-Bold", 8)
    
    # Coordinates for 6 columns + POM/Tol/Std
    # X-Positions: POM(50), Tol(200), Std(240), S1(280), S2(320), S3(360), S4(400), S5(440), S6(480)
    col_starts = [50, 200, 240, 280, 320, 360, 400, 440, 480]
    
    p.drawString(col_starts[0], y_pos, "POM")
    p.drawString(col_starts[1], y_pos, "Tol")
    p.drawString(col_starts[2], y_pos, "Std")
    p.drawString(col_starts[3], y_pos, "S1")
    p.drawString(col_starts[4], y_pos, "S2")
    p.drawString(col_starts[5], y_pos, "S3")
    p.drawString(col_starts[6], y_pos, "S4")
    p.drawString(col_starts[7], y_pos, "S5")
    p.drawString(col_starts[8], y_pos, "S6")
    
    y_pos -= 2
    p.line(50, y_pos, 550, y_pos)
    y_pos -= 12

    # Measurements Table
    p.setFont("Helvetica", 8)
    for m in inspection.measurements.all():
        # Helper to draw value and apply red color if out of tolerance
        def draw_value(x, value, std, tol):
            val = float(value) if value is not None and value != '' else None
            if val is not None and std is not None and tol is not None:
                if abs(val - std) > tol:
                    p.setFillColorRGB(1, 0, 0) # Red
                else:
                    p.setFillColorRGB(0, 0, 0) # Black
                p.drawString(x, y_pos, str(val))
            else:
                p.setFillColorRGB(0, 0, 0)
                p.drawString(x, y_pos, '-')
        
        p.setFillColorRGB(0, 0, 0)
        pom_display = (m.pom_name[:30] + '..') if len(m.pom_name) > 30 else m.pom_name
        p.drawString(col_starts[0], y_pos, pom_display)
        p.drawString(col_starts[1], y_pos, str(m.tol))
        p.drawString(col_starts[2], y_pos, str(m.std) if m.std is not None else '-')

        draw_value(col_starts[3], m.s1, m.std, m.tol)
        draw_value(col_starts[4], m.s2, m.std, m.tol)
        draw_value(col_starts[5], m.s3, m.std, m.tol)
        draw_value(col_starts[6], m.s4, m.std, m.tol)
        draw_value(col_starts[7], m.s5, m.std, m.tol)
        draw_value(col_starts[8], m.s6, m.std, m.tol)
        
        y_pos -= 12
        if y_pos < 50:
            p.showPage()
            y_pos = height - 50

    p.setFillColorRGB(0, 0, 0)
    
    # --- Comment Sections ---
    y_pos -= 30
    
    def draw_text_block(title, content):
        nonlocal y_pos
        if not content: return
        
        if y_pos < 60:
            p.showPage()
            y_pos = height - 50

        p.setFont("Helvetica-Bold", 10)
        p.drawString(50, y_pos, title)
        y_pos -= 12
        
        p.setFont("Helvetica", 9)
        text_obj = p.beginText(50, y_pos)
        # Simple line splitting for PDF
        import textwrap
        lines = textwrap.wrap(content, width=95) 
        for line in lines:
            if y_pos < 50:
                p.drawText(text_obj)
                p.showPage()
                y_pos = height - 50
                text_obj = p.beginText(50, y_pos)
                text_obj.setFont("Helvetica", 9)
            
            text_obj.textLine(line)
            y_pos -= 12
        
        p.drawText(text_obj)
        y_pos -= 10

    # 1. Customer Remarks
    draw_text_block("Customer Feedback Summary:", inspection.customer_remarks)

    # 2. QA Evaluation Header
    if y_pos < 50:
        p.showPage()
        y_pos = height - 50
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y_pos, "QA Evaluation:")
    y_pos -= 20

    # 3. Specific Comments
    comments = [
        ("Fit Comments:", inspection.qa_fit_comments),
        ("Workmanship Comments:", inspection.qa_workmanship_comments),
        ("Wash Comments:", inspection.qa_wash_comments),
        ("Fabric Comments:", inspection.qa_fabric_comments),
        ("Accessories Comments:", inspection.qa_accessories_comments),
    ]
    
    for title, text in comments:
        if text:
            draw_text_block(title, text)

    # 4. Final Remarks
    draw_text_block("Final Remarks:", inspection.remarks)

    # --- Page 2: Images ---
    images = inspection.images.all()
    if images.exists():
        p.showPage()
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, height - 50, "INSPECTION IMAGES")
        
        positions = [
            (50, height - 300), (320, height - 300), 
            (50, height - 550), (320, height - 550)
        ]
        
        for i, img_obj in enumerate(images[:4]):
            if i >= 4: break
            x, y = positions[i]
            try:
                with PILImage.open(img_obj.image.path) as pil_img:
                    if pil_img.mode in ("RGBA", "P"): pil_img = pil_img.convert("RGB")
                    pil_img.thumbnail((800, 800))
                    img_buffer = io.BytesIO()
                    pil_img.save(img_buffer, format='JPEG', quality=85, optimize=True)
                    img_buffer.seek(0)
                    reportlab_img = ImageReader(img_buffer)
                    p.drawImage(reportlab_img, x, y, width=250, height=200, preserveAspectRatio=True)

                p.setFont("Helvetica-Bold", 10)
                p.setFillColorRGB(0, 0, 0)
                caption = img_obj.caption or "Image"
                # Center-align caption under the image (image width is 250, so center is x + 125)
                p.drawCentredString(x + 125, y - 15, caption)
            except Exception as e:
                p.drawString(x, y, "Error loading image")

    p.save()
    buffer.seek(0)
    return buffer



def generate_final_inspection_pdf(final_inspection):
    """
    Generate a professional PDF report for Final Inspection (Softwood/Intertek Style).
    
    Page 1: Executive Summary, AQL Result, Carton Quantities
    Page 2: Measurement Chart (New)
    Page 3: Defect Breakdown
    Page 4+: Photo Appendix (Categorized)
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph, 
                                     Spacer, Image as RLImage, PageBreak)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    import textwrap
    
    buffer = io.BytesIO()
    width, height = A4  # Use A4 for professional reports
    
    # Create canvas
    p = canvas.Canvas(buffer, pagesize=A4)
    y_pos = height - 50
    
    # Helper to check page break
    def check_page_break(y, required_space=50):
        if y < required_space:
            p.showPage()
            return height - 50
        return y

    # ==================== PAGE 1: EXECUTIVE SUMMARY ====================
    
    # Header
    p.setFont("Helvetica-Bold", 22)
    p.drawString(50, y_pos, "FINAL INSPECTION REPORT")
    
    # Result Badge (Top Right)
    result = final_inspection.result
    p.setFont("Helvetica-Bold", 18)
    if result == 'Pass':
        p.setFillColorRGB(0, 0.6, 0)  # Green
        badge_text = "PASS"
    elif result == 'Fail':
        p.setFillColorRGB(1, 0, 0)  # Red
        badge_text = "FAIL"
    else:
        p.setFillColorRGB(0.5, 0.5, 0.5)  # Gray
        badge_text = "PENDING"
    
    p.drawRightString(550, y_pos, f"RESULT: {badge_text}")
    p.setFillColorRGB(0, 0, 0)  # Reset
    y_pos -= 40
    
    # General Info Table
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y_pos, "1. General Information")
    y_pos -= 20
    
    data = [
        ["Customer:", final_inspection.customer.name if final_inspection.customer else 'N/A', "Inspection Date:", final_inspection.inspection_date.strftime('%d-%b-%Y')],
        ["Supplier:", final_inspection.supplier, "Order No:", final_inspection.order_no],
        ["Factory:", final_inspection.factory, "Style No:", final_inspection.style_no],
        ["Color:", final_inspection.color, "AQL Standard:", final_inspection.get_aql_standard_display() if hasattr(final_inspection, 'get_aql_standard_display') else final_inspection.aql_standard],
    ]
    
    # Draw simple grid for info
    row_height = 20
    col_widths = [80, 180, 90, 150]
    x_start = 50
    
    p.setFont("Helvetica", 10)
    for row in data:
        curr_x = x_start
        for i, cell in enumerate(row):
            p.rect(curr_x, y_pos - row_height + 5, col_widths[i], row_height, stroke=1, fill=0)
            p.drawString(curr_x + 5, y_pos - 10, str(cell))
            curr_x += col_widths[i]
        y_pos -= row_height
    
    y_pos -= 20
    
    # AQL Result Table
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y_pos, "2. AQL Result Summary")
    y_pos -= 20
    
    # Header
    headers = ["Sample Size", "Critical (0)", f"Major ({final_inspection.aql_major})", f"Minor ({final_inspection.aql_minor})", "Result"]
    col_widths = [100, 100, 100, 100, 100]
    curr_x = 50
    
    p.setFillColorRGB(0.9, 0.9, 0.9) # Header bg
    p.rect(50, y_pos - 20, 500, 20, fill=1)
    p.setFillColorRGB(0, 0, 0)
    
    for i, h in enumerate(headers):
        p.drawString(curr_x + 5, y_pos - 15, h)
        curr_x += col_widths[i]
    y_pos -= 20
    
    # Values
    values = [
        str(final_inspection.sample_size),
        f"{final_inspection.critical_found} / {final_inspection.max_allowed_critical}",
        f"{final_inspection.major_found} / {final_inspection.max_allowed_major}",
        f"{final_inspection.minor_found} / {final_inspection.max_allowed_minor}",
        badge_text
    ]
    
    curr_x = 50
    for i, v in enumerate(values):
        p.rect(curr_x, y_pos - 20, col_widths[i], 20)
        
        # Color code the result cell
        if i == 4:
            if v == "PASS": p.setFillColorRGB(0, 0.6, 0)
            elif v == "FAIL": p.setFillColorRGB(1, 0, 0)
            p.setFont("Helvetica-Bold", 10)
        
        p.drawString(curr_x + 5, y_pos - 15, v)
        p.setFillColorRGB(0, 0, 0)
        p.setFont("Helvetica", 10)
        curr_x += col_widths[i]
        
    y_pos -= 40
    
    # Quantities Table
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y_pos, "3. Shipment Quantities")
    y_pos -= 20
    
    qty_data = [
        ["Total Order Qty:", str(final_inspection.total_order_qty)],
        ["Presented Qty:", str(final_inspection.presented_qty)],
        ["Total Cartons:", str(final_inspection.total_cartons)],
        ["Selected Cartons:", str(final_inspection.selected_cartons)],
        ["Net Weight (kg):", str(final_inspection.net_weight)],
        ["Gross Weight (kg):", str(final_inspection.gross_weight)],
    ]
    
    for row in qty_data:
        p.drawString(50, y_pos, row[0])
        p.drawString(200, y_pos, row[1])
        y_pos -= 15
        
    # ==================== PAGE 2: MEASUREMENTS (Updated Layout) ====================
    p.showPage()
    y_pos = height - 50
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, y_pos, "4. Measurement Data")
    y_pos -= 30
    
    if final_inspection.measurements.exists():
        # Header: POM | Tol | Std | S1 | S2 | S3 | S4 | S5
        headers = ["POM", "Tol (+/-)", "Standard", "S1", "S2", "S3", "S4", "S5", "S6"]
        col_widths = [140, 50, 50, 40, 40, 40, 40, 40, 40]
        
        p.setFont("Helvetica-Bold", 9)
        p.setFillColorRGB(0.9, 0.9, 0.9)
        p.rect(50, y_pos - 20, sum(col_widths), 20, fill=1)
        p.setFillColorRGB(0, 0, 0)
        
        curr_x = 50
        for i, h in enumerate(headers):
            p.drawString(curr_x + 5, y_pos - 14, h)
            curr_x += col_widths[i]
        y_pos -= 20
        
        p.setFont("Helvetica", 9)
        for m in final_inspection.measurements.all():
            vals = [m.pom_name, str(m.tol), str(m.spec), m.s1, m.s2, m.s3, m.s4, m.s5, m.s6]
            curr_x = 50
            max_height = 20
            
            for i, v in enumerate(vals):
                p.rect(curr_x, y_pos - 20, col_widths[i], 20)
                
                # Highlight out of tolerance
                is_fail = False
                if i > 2 and v: # Check S1-S5
                    try:
                        val_float = float(v)
                        if abs(val_float - m.spec) > m.tol:
                            is_fail = True
                    except:
                        pass
                
                if is_fail:
                    p.setFillColorRGB(1, 0, 0) # Red text
                    p.setFont("Helvetica-Bold", 9)
                else:
                    p.setFillColorRGB(0, 0, 0)
                    p.setFont("Helvetica", 9)
                    
                p.drawString(curr_x + 5, y_pos - 14, str(v))
                curr_x += col_widths[i]
            
            y_pos -= 20
            y_pos = check_page_break(y_pos)
            
    else:
        p.drawString(50, y_pos, "No measurements recorded.")

    # ==================== PAGE 3: DEFECTS ====================
    p.showPage()
    y_pos = height - 50
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, y_pos, "5. Defect Breakdown")
    y_pos -= 30
    
    if final_inspection.defects.exists():
        headers = ["Description", "Severity", "Count"]
        col_widths = [250, 100, 80]
        
        p.setFont("Helvetica-Bold", 10)
        p.setFillColorRGB(0.9, 0.9, 0.9)
        p.rect(50, y_pos - 20, 430, 20, fill=1)
        p.setFillColorRGB(0, 0, 0)
        
        curr_x = 50
        for i, h in enumerate(headers):
            p.drawString(curr_x + 5, y_pos - 15, h)
            curr_x += col_widths[i]
        y_pos -= 20
        
        p.setFont("Helvetica", 10)
        for defect in final_inspection.defects.all():
            vals = [defect.description, defect.severity, str(defect.count)]
            curr_x = 50
            
            for i, v in enumerate(vals):
                p.rect(curr_x, y_pos - 20, col_widths[i], 20)
                
                if i == 1: # Severity color
                    if v == 'Critical': p.setFillColorRGB(1, 0, 0)
                    elif v == 'Major': p.setFillColorRGB(1, 0.5, 0)
                
                p.drawString(curr_x + 5, y_pos - 15, v)
                p.setFillColorRGB(0, 0, 0)
                curr_x += col_widths[i]
            
            y_pos -= 20
            y_pos = check_page_break(y_pos)
    else:
        p.drawString(50, y_pos, "No defects recorded.")

    # ==================== PAGE 4: PHOTO APPENDIX ====================
    p.showPage()
    y_pos = height - 50
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, y_pos, "6. Photo Appendix")
    y_pos -= 30

    categories = ['Packaging', 'Labeling', 'Defect', 'General', 'Measurement', 'On-Site Test']
    
    for category in categories:
        cat_images = final_inspection.images.filter(category=category)
        if not cat_images.exists():
            continue
        
        # Check if we have enough space for Header + 1 Row of images (approx 250px)
        if y_pos < 250:
            p.showPage()
            y_pos = height - 50

        # Section Header
        p.setFont("Helvetica-Bold", 14)
        p.setFillColorRGB(0, 0, 0.5) # Dark Blue header
        p.drawString(50, y_pos, category)
        p.line(50, y_pos - 5, 550, y_pos - 5)
        p.setFillColorRGB(0, 0, 0)
        y_pos -= 30
        
        # Grid Layout
        row_y = y_pos
        for i, img_obj in enumerate(cat_images):
            # Start a new page if needed
            if row_y < 220: 
                p.showPage()
                y_pos = height - 50
                row_y = y_pos
            
            # Left col (0, 2, 4...) or Right col (1, 3, 5...)
            is_right = i % 2 != 0
            x = 310 if is_right else 50
            
            try:
                # Image Processing
                with PILImage.open(img_obj.image.path) as pil_img:
                    if pil_img.mode != "RGB": pil_img = pil_img.convert("RGB")
                    pil_img.thumbnail((600, 600))
                    img_buffer = io.BytesIO()
                    pil_img.save(img_buffer, format='JPEG')
                    img_buffer.seek(0)
                    
                    # Draw Image
                    p.drawImage(ImageReader(img_buffer), x, row_y - 180, width=240, height=180, preserveAspectRatio=True)
                    p.rect(x, row_y - 180, 240, 180)
                    
                    # Caption
                    caption = img_obj.caption or "No Caption"
                    p.setFont("Helvetica", 9)
                    p.drawCentredString(x + 120, row_y - 195, caption[:50])
            except:
                p.drawString(x, row_y - 100, "Image Missing")

            # If we just filled the right column, move down for the next row
            if is_right:
                row_y -= 230
        
        # After finishing a category, set y_pos to where the last row ended
        # If we ended on a left image, we still need to move down
        if len(cat_images) % 2 != 0:
            row_y -= 230
            
        y_pos = row_y # Update main cursor

    p.save()
    buffer.seek(0)
    return buffer
class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.all()
    serializer_class = InspectionSerializer
    
    # Use django-filter for advanced filtering + ordering
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = InspectionFilter
    ordering_fields = ['created_at', 'style', 'decision', 'stage']
    ordering = ['-created_at'] 

    def get_queryset(self):
        queryset = Inspection.objects.select_related('customer', 'template', 'created_by').order_by("-created_at")
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
        buffer = generate_pdf_buffer(inspection)
        return FileResponse(buffer, filename=f"{inspection.style}_Report.pdf", content_type="application/pdf")

    @action(detail=True, methods=["post"])
    def upload_image(self, request, pk=None):
        inspection = self.get_object()
        image_file = request.FILES.get("image")
        caption = request.data.get("caption", "Inspection Image")
        
        if not image_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Open and compress the image
            with PILImage.open(image_file) as img:
                # Convert RGBA/P to RGB for WebP compatibility
                if img.mode in ("RGBA", "P", "LA"):
                    # Create white background for transparency
                    rgb_img = PILImage.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                    img = rgb_img
                elif img.mode != "RGB":
                    img = img.convert("RGB")
                
                # Resize to max 1600x1600 (maintains aspect ratio)
                img.thumbnail((1600, 1600), PILImage.Resampling.LANCZOS)
                
                # Save as WebP with quality 85
                compressed_buffer = io.BytesIO()
                img.save(compressed_buffer, format='WEBP', quality=85, method=6)
                compressed_buffer.seek(0)
                
                # Create filename with .webp extension
                original_name = image_file.name.rsplit('.', 1)[0] if '.' in image_file.name else image_file.name
                webp_filename = f"{original_name}.webp"
                
                # Create Django File object
                from django.core.files.base import ContentFile
                compressed_file = ContentFile(compressed_buffer.read(), name=webp_filename)
                
                InspectionImage.objects.create(
                    inspection=inspection,
                    image=compressed_file,
                    caption=caption
                )
                return Response({"status": "Image uploaded and compressed"}, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({"error": f"Image processing failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

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
        email = EmailMessage(subject, body, settings.EMAIL_HOST_USER, to_emails, cc=cc_emails if cc_emails else None)
        email.attach(f"{inspection.style}_{inspection.po_number}_Report.pdf", buffer.getvalue(), "application/pdf")
        email.send(fail_silently=False)
        return Response({"sent": True, "to": to_emails, "cc": cc_emails})

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    @action(detail=True, methods=["post"])
    def add_email(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerEmailSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(customer=customer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TemplateViewSet(viewsets.ModelViewSet):
    queryset = Template.objects.all()
    serializer_class = TemplateSerializer
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

from django.db.models import Count
from django.db.models.functions import TruncMonth

class DashboardView(APIView):
    def get(self, request):
        total_inspections = Inspection.objects.count()
        pass_count = Inspection.objects.filter(decision="Accepted").count()
        fail_count = Inspection.objects.exclude(decision="Accepted").count()
        pass_rate = (pass_count / total_inspections * 100) if total_inspections > 0 else 0
        
        recent_inspections = Inspection.objects.select_related('customer', 'template') \
                                               .order_by("-created_at")[:5]
        recent_serializer = InspectionListSerializer(recent_inspections, many=True)

        # 1. Inspections by Stage
        inspections_by_stage = Inspection.objects.values('stage').annotate(count=Count('id')).order_by('-count')

        # 2. Inspections by Customer
        inspections_by_customer = Inspection.objects.values('customer__name').annotate(count=Count('id')).order_by('-count')

        # 3. Monthly Inspection Trend
        monthly_trend = Inspection.objects.annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id')).order_by('month')

        # 4. Customer vs Internal Decision
        # We want to see how often they match or differ, or just counts of each
        # Let's return counts for both to compare side-by-side or stacked
        internal_decisions = Inspection.objects.values('decision').annotate(count=Count('id'))
        customer_decisions = Inspection.objects.values('customer_decision').annotate(count=Count('id'))

        return Response({
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
        })

# ==================== Final Inspection ViewSet ====================

from .models import FinalInspection, FinalInspectionDefect, FinalInspectionSizeCheck, FinalInspectionImage, calculate_sample_size, get_aql_limits
from .serializers import FinalInspectionSerializer, FinalInspectionListSerializer, FinalInspectionImageSerializer


class FinalInspectionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Final Inspection Reports with AQL-based shipment audits.
    """
    queryset = FinalInspection.objects.all()
    serializer_class = FinalInspectionSerializer
    
    # Filtering and ordering
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ['created_at', 'inspection_date', 'result', 'order_no']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Optimize queries with select_related and prefetch_related."""
        queryset = FinalInspection.objects.select_related('customer', 'created_by').order_by('-created_at')
        
        # Only prefetch nested data for detail views
        if self.action in ['retrieve', 'update', 'partial_update']:
            queryset = queryset.prefetch_related('defects', 'size_checks', 'images')
        
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
            # Open and compress the image
            with PILImage.open(image_file) as img:
                # Convert RGBA/P to RGB for WebP compatibility
                if img.mode in ('RGBA', 'P', 'LA'):
                    rgb_img = PILImage.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = rgb_img
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize to max 1600x1600
                img.thumbnail((1600, 1600), PILImage.Resampling.LANCZOS)
                
                # Save as WebP with quality 85
                compressed_buffer = io.BytesIO()
                img.save(compressed_buffer, format='WEBP', quality=85, method=6)
                compressed_buffer.seek(0)
                
                # Create filename
                original_name = image_file.name.rsplit('.', 1)[0] if '.' in image_file.name else image_file.name
                webp_filename = f"{original_name}.webp"
                
                # Create Django File object
                from django.core.files.base import ContentFile
                compressed_file = ContentFile(compressed_buffer.read(), name=webp_filename)
                
                # Create image record
                img_obj = FinalInspectionImage.objects.create(
                    final_inspection=final_inspection,
                    image=compressed_file,
                    caption=caption,
                    category=category,
                    order=int(order)
                )
                
                serializer = FinalInspectionImageSerializer(img_obj)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response({'error': f'Image processing failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    
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
