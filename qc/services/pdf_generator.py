"""
PDF Generation Service for Quality Check Reports.

This module contains all PDF generation logic, extracted from views.py
for better separation of concerns and maintainability.
"""

import io
import textwrap
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph, 
                                 Spacer, Image as RLImage, PageBreak)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from PIL import Image as PILImage


def generate_pdf_buffer(inspection):
    """
    Generate PDF report for Sample Evaluation (development stage inspections).
    
    Args:
        inspection: Inspection model instance
        
    Returns:
        BytesIO buffer containing the PDF
    """
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
    
    # helper for label/value pair
    def draw_pair(x, y, label, value):
        p.setFont("Helvetica-Bold", 12)
        p.drawString(x, y, f"{label}:")
        p.setFont("Helvetica", 12)
        p.drawString(x + 70, y, str(value))

    # Left Column
    draw_pair(50, y_pos, "Style", inspection.style)
    draw_pair(50, y_pos - 20, "Color", inspection.color)
    draw_pair(50, y_pos - 40, "PO #", inspection.po_number)
    
    # Factory Name Lookup (Manual because factory is CharField soft-FK)
    factory_name = 'N/A'
    if inspection.factory:
        try:
            # Import locally to avoid circular import if needed, or rely on top-level
            from ..models import Factory
            factory_obj = Factory.objects.filter(id=inspection.factory).first()
            if factory_obj:
                factory_name = factory_obj.name
        except Exception:
            factory_name = str(inspection.factory) # Fallback to raw value

    # Right Column
    draw_pair(300, y_pos, "Date", inspection.created_at.strftime('%Y-%m-%d'))
    draw_pair(300, y_pos - 20, "Stage", inspection.stage)
    draw_pair(300, y_pos - 40, "Customer", inspection.customer.name if inspection.customer else 'N/A')
    draw_pair(300, y_pos - 60, "Factory", factory_name)
    
    y_pos -= 80

    # Table Header (6 Samples)
    # Calculate Max Samples Used
    all_measurements = list(inspection.measurements.all()) # Evaluate queryset once
    max_sample_index = 3 # Default min
    for m in all_measurements:
        # Pre-fetch samples for efficiency
        s_indices = [s.index for s in m.samples.all()]
        if s_indices:
            max_sample_index = max(max_sample_index, max(s_indices))
    
    # Cap at some reasonable number if needed, but requirements say dynamic
    # Let's assume standard max is 6, but we handle whatever. 
    # If > 10, layout might break, but 6 is the norm.
    
    # Column configuration
    page_width_printable = 500 # 50 to 550
    col_width_std = 30
    col_width_tol = 30
    col_width_sample = 35
    
    total_sample_width = max_sample_index * col_width_sample
    pom_width = page_width_printable - col_width_std - col_width_tol - total_sample_width
    
    # Ensure POM has minimum space (e.g., 100). If not, reduce sample width or warn?
    # With 6 samples: 30+30 + (6*35) = 270. 500-270 = 230 for POM. Plenty.
    
    # X Coordinates
    x_pom = 50
    x_tol = x_pom + pom_width
    x_std = x_tol + col_width_tol
    x_samples_start = x_std + col_width_std
    
    # Header
    y_pos -= 10
    p.setFont("Helvetica-Bold", 8)
    
    p.drawString(x_pom, y_pos, "POM")
    p.drawString(x_tol, y_pos, "Tol")
    p.drawString(x_std, y_pos, "Std")
    
    for i in range(max_sample_index):
        p.drawString(x_samples_start + (i * col_width_sample), y_pos, f"S{i+1}")
        
    y_pos -= 2
    p.line(50, y_pos, 550, y_pos)
    y_pos -= 12
    
    # Measurements Loop
    p.setFont("Helvetica", 8)
    
    # Helper for wrapping text
    from reportlab.lib.utils import simpleSplit
    
    for m in all_measurements:
        # Prepare Data
        samples_dict = {s.index: s.value for s in m.samples.all()}
        
        # Wrapped POM Text
        pom_text = m.pom_name
        # Estimate char width ~ 4px for font size 8? No, simpleSplit is better.
        # simpleSplit(text, fontName, fontSize, maxWidth)
        wrapped_lines = simpleSplit(pom_text, "Helvetica", 8, pom_width - 5)
        
        row_height = max(12, len(wrapped_lines) * 10) # 10pts per line
        
        # Check Page Break
        if y_pos - row_height < 50:
            p.showPage()
            y_pos = height - 50
            # Redraw Header
            p.setFont("Helvetica-Bold", 8)
            p.drawString(x_pom, y_pos, "POM")
            p.drawString(x_tol, y_pos, "Tol")
            p.drawString(x_std, y_pos, "Std")
            for i in range(max_sample_index):
                p.drawString(x_samples_start + (i * col_width_sample), y_pos, f"S{i+1}")
            y_pos -= 14
            p.setFont("Helvetica", 8)

        # Draw POM (Multi-line)
        text_y = y_pos
        for line in wrapped_lines:
            p.drawString(x_pom, text_y, line)
            text_y -= 10
            
        # Draw Fixed Columns (Tol, Std)
        # Center vertically in the row? Or top align? Top align is safer for reading.
        p.drawString(x_tol, y_pos, str(m.tol))
        p.drawString(x_std, y_pos, str(m.std) if m.std is not None else '-')
        
        # Draw Dynamic Samples
        for i in range(max_sample_index):
            idx = i + 1
            val_str = samples_dict.get(idx)
            x = x_samples_start + (i * col_width_sample)
            
            # Validation Logic
            val = float(val_str) if val_str is not None and val_str != '' else None
            is_error = False
            if val is not None and m.std is not None and m.tol is not None:
                if abs(val - m.std) > m.tol:
                    is_error = True
            
            if is_error:
                p.setFillColorRGB(1, 0, 0) # Red
            else:
                p.setFillColorRGB(0, 0, 0)
                
            p.drawString(x, y_pos, str(val) if val is not None else '-')
            p.setFillColorRGB(0, 0, 0) # Reset
            
        y_pos -= (row_height + 4) # Add buffer

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

    # --- Fabric Check Status ---
    if y_pos < 80:
        p.showPage()
        y_pos = height - 50
    
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y_pos, "Fabric Check:")
    y_pos -= 15
    p.setFont("Helvetica", 10)
    handfeel = getattr(inspection, 'fabric_handfeel', 'OK') or 'OK'
    pilling = getattr(inspection, 'fabric_pilling', 'None') or 'None'
    
    # Handfeel with color
    p.drawString(50, y_pos, "Handfeel: ")
    if handfeel == 'Not OK':
        p.setFillColorRGB(1, 0, 0)  # Red
    else:
        p.setFillColorRGB(0, 0.5, 0)  # Green
    p.drawString(110, y_pos, handfeel)
    p.setFillColorRGB(0, 0, 0)
    
    # Pilling with color
    p.drawString(200, y_pos, "Pilling: ")
    if pilling == 'High':
        p.setFillColorRGB(1, 0, 0)  # Red
    elif pilling == 'Low':
        p.setFillColorRGB(1, 0.5, 0)  # Orange
    else:
        p.setFillColorRGB(0, 0.5, 0)  # Green
    p.drawString(250, y_pos, pilling)
    p.setFillColorRGB(0, 0, 0)
    y_pos -= 25
    
    # --- Accessories Checklist Table ---
    accessories_data = getattr(inspection, 'accessories_data', []) or []
    if accessories_data:
        if y_pos < 100:
            p.showPage()
            y_pos = height - 50
        
        p.setFont("Helvetica-Bold", 12)
        p.drawString(50, y_pos, "Accessories Checklist:")
        y_pos -= 20
        
        # Table header (2 columns: Item and Remarks)
        p.setFont("Helvetica-Bold", 9)
        p.setFillColorRGB(0.9, 0.9, 0.9)
        p.rect(50, y_pos - 15, 500, 15, fill=1)
        p.setFillColorRGB(0, 0, 0)
        p.drawString(55, y_pos - 12, "Item")
        p.drawString(250, y_pos - 12, "Remarks")
        y_pos -= 15
        
        # Table rows
        p.setFont("Helvetica", 9)
        for acc in accessories_data:
            if y_pos < 50:
                p.showPage()
                y_pos = height - 50
            
            p.rect(50, y_pos - 15, 500, 15)
            p.drawString(55, y_pos - 12, str(acc.get('name', ''))[:30])
            
            comment = str(acc.get('comment', ''))
            
            # Apply styling based on comment value
            if comment == 'Not Ok':
                p.setFillColorRGB(1, 0, 0) # Red
                p.setFont("Helvetica-Bold", 9)
            elif comment == 'Available':
                p.setFillColorRGB(1, 0.5, 0) # Orange
                p.setFont("Helvetica-Bold", 9)
            elif comment in ['Ok', 'Improved']:
                p.setFillColorRGB(0, 0.5, 0) # Green
                p.setFont("Helvetica", 9)
            else:
                p.setFillColorRGB(0, 0, 0) # Black
                p.setFont("Helvetica", 9)

            p.drawString(250, y_pos - 12, comment[:65])
            
            # Reset styles for next iteration
            p.setFillColorRGB(0, 0, 0)
            p.setFont("Helvetica", 9)
            
            y_pos -= 15
        
        y_pos -= 10

    # --- Customer Comments Addressed ---
    if y_pos < 50:
        p.showPage()
        y_pos = height - 50
    
    addressed = getattr(inspection, 'customer_comments_addressed', False)
    p.setFont("Helvetica-Bold", 10)
    p.drawString(50, y_pos, "Customer Comments Addressed: ")
    if addressed:
        p.setFillColorRGB(0, 0.5, 0)
        p.drawString(220, y_pos, "✓ YES")
    else:
        p.setFillColorRGB(1, 0.5, 0)
        p.drawString(220, y_pos, "○ NO")
    p.setFillColorRGB(0, 0, 0)
    y_pos -= 25

    # --- Customer vs QA Comparison Section ---
    if y_pos < 100:
        p.showPage()
        y_pos = height - 50
    
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y_pos, "Evaluation Comments (Customer → QA):")
    y_pos -= 20
    
    # Category comparison pairs
    comparison_pairs = [
        ("Fit", inspection.customer_fit_comments, inspection.qa_fit_comments),
        ("Workmanship", inspection.customer_workmanship_comments, inspection.qa_workmanship_comments),
        ("Wash", inspection.customer_wash_comments, inspection.qa_wash_comments),
        ("Fabric", inspection.customer_fabric_comments, inspection.qa_fabric_comments),
        ("Accessories", inspection.customer_accessories_comments, inspection.qa_accessories_comments),
    ]
    
    for category, cust_comment, qa_comment in comparison_pairs:
        if cust_comment or qa_comment:
            if y_pos < 80:
                p.showPage()
                y_pos = height - 50
            
            p.setFont("Helvetica-Bold", 10)
            p.drawString(50, y_pos, f"{category}:")
            y_pos -= 12
            
            if cust_comment:
                p.setFont("Helvetica-Oblique", 9)
                p.setFillColorRGB(0.6, 0.4, 0)  # Brown/yellow for customer
                p.drawString(60, y_pos, "Customer:")
                y_pos -= 12
                # Handle multi-line comments - split by newlines first, then wrap each line
                comment_lines = cust_comment.replace('\r\n', '\n').replace('\r', '\n').split('\n')
                for comment_line in comment_lines:
                    wrapped_lines = textwrap.wrap(comment_line, width=85) if comment_line.strip() else ['']
                    for line in wrapped_lines:
                        if y_pos < 50:
                            p.showPage()
                            y_pos = height - 50
                            p.setFont("Helvetica-Oblique", 9)
                            p.setFillColorRGB(0.6, 0.4, 0)
                        p.drawString(70, y_pos, line)
                        y_pos -= 12
                p.setFillColorRGB(0, 0, 0)
            
            if qa_comment:
                p.setFont("Helvetica", 9)
                p.setFillColorRGB(0, 0, 0.6)  # Blue for QA
                p.drawString(60, y_pos, "QA: " + qa_comment[:80])
                y_pos -= 12
                p.setFillColorRGB(0, 0, 0)
            
            y_pos -= 5

    # Legacy Customer Remarks (if present)
    draw_text_block("Customer Feedback Summary:", inspection.customer_remarks)

    # 4. Final Remarks
    draw_text_block("Final Remarks:", inspection.remarks)

    # --- Page 2: Images ---
    images = inspection.images.all()
    if images.exists():
        p.showPage()
        p.setFont("Helvetica-Bold", 16)
        p.drawString(50, height - 50, "INSPECTION IMAGES")
        
        img_width = 250
        img_height = 200
        col_gap = 20
        row_gap = 50
        
        start_y = height - 100 # Top of first row (y_draw = start_y - img_height)
        current_y = start_y
        
        # Filter valid images? existing code iterates images[:4]
        # We iterate all
        
        for i, img_obj in enumerate(images):
            # 2 columns per row
            col = i % 2
            
            # If starting a new row (and not first image), move down
            if i > 0 and col == 0:
                current_y -= (img_height + row_gap)
            
            # Check if this row fits
            # y_draw would be current_y - img_height
            if current_y - img_height < 50:
                p.showPage()
                p.setFont("Helvetica-Bold", 16)
                p.drawString(50, height - 50, "INSPECTION IMAGES (Cont.)")
                current_y = start_y
            
            x = 50 if col == 0 else 320
            y = current_y - img_height # Bottom-left corner for drawImage

            try:
                with PILImage.open(img_obj.image) as pil_img:
                    if pil_img.mode in ("RGBA", "P"): pil_img = pil_img.convert("RGB")
                    pil_img.thumbnail((800, 800))
                    img_buffer = io.BytesIO()
                    pil_img.save(img_buffer, format='JPEG', quality=85, optimize=True)
                    img_buffer.seek(0)
                    reportlab_img = ImageReader(img_buffer)
                    p.drawImage(reportlab_img, x, y, width=img_width, height=img_height, preserveAspectRatio=True)

                p.setFont("Helvetica-Bold", 10)
                p.setFillColorRGB(0, 0, 0)
                caption = img_obj.caption or "Image"
                p.drawCentredString(x + (img_width/2), y - 15, caption)
            except Exception as e:
                p.drawString(x, y, "Error loading image")

    p.save()
    buffer.seek(0)
    return buffer


def generate_final_inspection_pdf(final_inspection):
    """
    Generate a professional PDF report for Final Inspection (Softwood/Intertek Style).
    
    Page 1: Executive Summary, AQL Result, Carton Quantities
    Page 2: Measurement Chart
    Page 3: Defect Breakdown
    Page 4+: Photo Appendix (Categorized)
    
    Args:
        final_inspection: FinalInspection model instance
        
    Returns:
        BytesIO buffer containing the PDF
    """
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
        ["AQL Standard:", final_inspection.get_aql_standard_display() if hasattr(final_inspection, 'get_aql_standard_display') else final_inspection.aql_standard, "Order No:", final_inspection.order_no],
        ["Factory:", final_inspection.factory, "Style No:", final_inspection.style_no],
        ["Color:", final_inspection.color, "Inspection Attempt:", final_inspection.get_inspection_attempt_display() if hasattr(final_inspection, 'get_inspection_attempt_display') else final_inspection.inspection_attempt],
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
        
    # ==================== PAGE 2: MEASUREMENTS ====================
    p.showPage()
    y_pos = height - 50
    p.setFont("Helvetica-Bold", 16)
    p.drawString(50, y_pos, "4. Measurement Data")
    y_pos -= 30
    
    if final_inspection.measurements.exists():
        # Header: POM | Tol | Std | S1 | S2 | S3 | S4 | S5 | S6
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
            samples_dict = {s.index: s.value for s in m.samples.all()}
            
            def get_sample_val(idx):
                val = samples_dict.get(idx)
                return val if val is not None else "-"

            vals = [
                m.pom_name, str(m.tol), str(m.spec),
                get_sample_val(1), get_sample_val(2), get_sample_val(3),
                get_sample_val(4), get_sample_val(5), get_sample_val(6)
            ]
            curr_x = 50
            max_height = 20
            
            for i, v in enumerate(vals):
                p.rect(curr_x, y_pos - 20, col_widths[i], 20)
                
                # Highlight out of tolerance
                is_fail = False
                if i > 2 and v: # Check S1-S6
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
                with PILImage.open(img_obj.image) as pil_img:
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
