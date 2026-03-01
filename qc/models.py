# qc/models.py
import uuid
from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

User = get_user_model()


class UserProfile(models.Model):
    """User profile for role-based access control."""
    USER_TYPE_CHOICES = [
        ('qa', 'QA'),
        ('quality_head', 'Quality Head'),
        ('quality_supervisor', 'Quality Supervisor'),
        ('merchandiser', 'Merchandiser'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES, default='qa')
    
    def __str__(self):
        return f"{self.user.username} - {self.get_user_type_display()}"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create UserProfile when User is created (if not already exists)."""
    if created:
        UserProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """Auto-save profile when User is saved."""
    # Only save if profile exists (might not exist during admin inline creation)
    try:
        if hasattr(instance, 'profile') and instance.profile:
            instance.profile.save()
    except UserProfile.DoesNotExist:
        pass

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.name

class CustomerEmail(models.Model):
    EMAIL_TYPE_CHOICES = [
        ('to', 'To'),
        ('cc', 'CC'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, related_name="emails", on_delete=models.CASCADE)
    contact_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField()
    email_type = models.CharField(max_length=2, choices=EMAIL_TYPE_CHOICES, default='to')

    def __str__(self):
        if self.contact_name:
            return f"{self.contact_name} <{self.email}> [{self.get_email_type_display()}] ({self.customer.name})"
        return f"{self.email} [{self.get_email_type_display()}] ({self.customer.name})"

class Factory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    address = models.TextField(blank=True)
    contact_person = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Template(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="templates")

    def __str__(self):
        return self.name

class TemplatePOM(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(Template, related_name="poms", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    default_tol = models.FloatField(default=0.0)
    default_std = models.FloatField(null=True, blank=True) # Changed to allow empty
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.template.name} - {self.name}"

class Inspection(models.Model):
    # Updated Stages
    STAGE_CHOICES = [
        ("Dev", "Dev"), ("Proto", "Proto"), ("Fit", "Fit"),
        ("SMS", "SMS"), ("Size Set", "Size Set"), ("PPS", "PPS"), ("Shipment Sample", "Shipment Sample")
    ]
    # Updated Decisions
    DECISION_CHOICES = [
        ("Accepted", "Accepted"), ("Rejected", "Rejected"), ("Represent", "Represent")
    ]
    
    # Customer Feedback Choices
    CUSTOMER_DECISION_CHOICES = [
        ("Accepted", "Accepted"),
        ("Rejected", "Rejected"),
        ("Revision Requested", "Revision Requested"),
        ("Accepted with Comments", "Accepted with Comments"),
        ("Held Internally", "Held Internally"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    style = models.CharField(max_length=255)
    color = models.CharField(max_length=255, blank=True)
    po_number = models.CharField(max_length=255, blank=True)
    factory = models.CharField(max_length=255, blank=True, help_text='Factory name for analysis')
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default="Proto")
    template = models.ForeignKey(Template, null=True, on_delete=models.SET_NULL)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL)
    
    # --- Customer Comments by Category (Previous Feedback) ---
    customer_remarks = models.TextField(blank=True, verbose_name="Customer Feedback Summary")  # Keep for backward compatibility
    customer_fit_comments = models.TextField(blank=True, verbose_name="Customer Fit Comments")
    customer_workmanship_comments = models.TextField(blank=True, verbose_name="Customer Workmanship Comments")
    customer_wash_comments = models.TextField(blank=True, verbose_name="Customer Wash Comments")
    customer_fabric_comments = models.TextField(blank=True, verbose_name="Customer Fabric Comments")
    customer_accessories_comments = models.TextField(blank=True, verbose_name="Customer Accessories Comments")
    customer_comments_addressed = models.BooleanField(default=False, help_text="Check if all customer points are resolved")
    
    # --- QA Evaluation Comments ---
    qa_fit_comments = models.TextField(blank=True, verbose_name="QA Fit Comments")
    qa_workmanship_comments = models.TextField(blank=True, verbose_name="QA Workmanship Comments")
    qa_wash_comments = models.TextField(blank=True, verbose_name="QA Wash Comments")
    qa_fabric_comments = models.TextField(blank=True, verbose_name="QA Fabric Comments")
    qa_accessories_comments = models.TextField(blank=True, verbose_name="QA Accessories Comments")
    
    # --- Fabric Checks ---
    HANDFEEL_CHOICES = [('OK', 'OK'), ('Not OK', 'Not OK')]
    PILLING_CHOICES = [('None', 'None'), ('Low', 'Low'), ('High', 'High')]
    fabric_handfeel = models.CharField(max_length=10, choices=HANDFEEL_CHOICES, default='OK', blank=True)
    fabric_pilling = models.CharField(max_length=10, choices=PILLING_CHOICES, default='None', blank=True)
    
    # --- Dynamic Accessories Checklist ---
    # Structure: [{"name": "Zipper", "status": "OK", "comment": "Color matches sample"}]
    accessories_data = models.JSONField(default=list, blank=True)

    # General Remarks
    # this field is for Miscellaneous comments
    remarks = models.TextField(blank=True, verbose_name="General Remarks")
    
    # Customer Feedback Fields
    customer_decision = models.CharField(max_length=50, choices=CUSTOMER_DECISION_CHOICES, null=True, blank=True)
    customer_feedback_comments = models.TextField(blank=True, verbose_name="Customer Feedback Comments")
    customer_feedback_date = models.DateTimeField(null=True, blank=True)
    
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, null=True, blank=True)
    
    # Draft support
    is_draft = models.BooleanField(default=False, help_text="True if this inspection is a draft (incomplete, not finalized)")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.style} - {self.color} ({self.created_at.date()})"

class Measurement(models.Model):
    """Measurement row for a POM (Point of Measure) in an Inspection."""
    STATUS_CHOICES = [("OK","OK"), ("FAIL","FAIL")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection = models.ForeignKey(Inspection, related_name="measurements", on_delete=models.CASCADE)
    pom_name = models.CharField(max_length=255)
    tol = models.FloatField(default=0.0)
    std = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="OK")

    def __str__(self):
        return f"{self.pom_name} - {self.inspection.style}"


class MeasurementSample(models.Model):
    """Dynamic sample value linked to a Measurement."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    measurement = models.ForeignKey(
        Measurement, 
        related_name='samples', 
        on_delete=models.CASCADE
    )
    index = models.PositiveIntegerField(help_text="Sample number (1, 2, 3...)")
    value = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['index']
        unique_together = ['measurement', 'index']

    def __str__(self):
        return f"S{self.index}: {self.value}"

class InspectionImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection = models.ForeignKey(Inspection, related_name="images", on_delete=models.CASCADE)
    caption = models.CharField(max_length=100, default="Inspection Image")
    image = models.ImageField(upload_to="inspection_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.inspection} - {self.caption}"

class FilterPreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="filter_presets")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    filters = models.JSONField(default=dict)  # Store filter parameters as JSON
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [["user", "name"]]  # Prevent duplicate names per user

    def __str__(self):
        return f"{self.user.username} - {self.name}"

# ==================== Final Inspection Models ====================

def get_aql_limits(sample_size, aql_level):
    """
    Returns max allowed defects based on ISO 2859-1 AQL tables.
    Returns the acceptance number (Ac) for the given sample size and AQL level.
    
    Args:
        sample_size: Number of items in the sample
        aql_level: AQL level (0.0 for Critical, 2.5 for Major, 4.0 for Minor)
    
    Returns:
        int: Maximum allowed defects (acceptance number)
    """
    # ISO 2859-1 AQL Table (Updated from user provided tables)
    # Format: (sample_size, aql_level): acceptance_number
    aql_table = {
        # Sample Size 2 (for batch 2-8) - Assumed from Level I/Standard
        (2, 0.0): 0, (2, 1.5): 0, (2, 2.5): 0, (2, 4.0): 0,
        # Sample Size 3 (for batch 9-15)
        (3, 0.0): 0, (3, 1.5): 0, (3, 2.5): 0, (3, 4.0): 0,
        # Sample Size 5 (for batch 16-25)
        (5, 0.0): 0, (5, 1.5): 0, (5, 2.5): 0, (5, 4.0): 0,
        # Sample Size 8
        (8, 0.0): 0, (8, 1.5): 0, (8, 2.5): 0, (8, 4.0): 1,
        # Sample Size 13
        (13, 0.0): 0, (13, 1.5): 0, (13, 2.5): 1, (13, 4.0): 1,
        # Sample Size 20
        (20, 0.0): 0, (20, 1.5): 1, (20, 2.5): 1, (20, 4.0): 2,
        # Sample Size 32
        (32, 0.0): 0, (32, 1.5): 1, (32, 2.5): 2, (32, 4.0): 3,
        # Sample Size 50
        (50, 0.0): 0, (50, 1.5): 2, (50, 2.5): 3, (50, 4.0): 5,
        # Sample Size 80
        (80, 0.0): 0, (80, 1.5): 3, (80, 2.5): 5, (80, 4.0): 7,
        # Sample Size 125
        (125, 0.0): 0, (125, 1.5): 5, (125, 2.5): 7, (125, 4.0): 10,
        # Sample Size 200
        (200, 0.0): 0, (200, 1.5): 7, (200, 2.5): 10, (200, 4.0): 14,
        # Sample Size 315
        (315, 0.0): 0, (315, 1.5): 10, (315, 2.5): 14, (315, 4.0): 21,
        # Sample Size 500
        (500, 0.0): 1, (500, 1.5): 14, (500, 2.5): 21, (500, 4.0): 21,
        # Sample Size 800 - Standard tables
        (800, 0.0): 1, (800, 1.5): 21, (800, 2.5): 21, (800, 4.0): 21,
        # Sample Size 1250 - Standard tables
        (1250, 0.0): 2, (1250, 1.5): 21, (1250, 2.5): 21, (1250, 4.0): 21,
    }
    
    return aql_table.get((sample_size, aql_level), 0)


def calculate_sample_size(order_qty):
    """
    Calculate sample size based on total order quantity.
    Based on ISO 2859-1 General Inspection Level II (Single Sampling).
    
    Args:
        order_qty: Total order quantity
        
    Returns:
        int: Sample size to inspect
    """
    if order_qty <= 8:
        return 2  # Level II - Code A (2-8) -> 2
    elif order_qty <= 15:
        return 3  # Level II - Code B (9-15) -> 3
    elif order_qty <= 25:
        return 5  # Level II - Code C (16-25) -> 5
    elif order_qty <= 50:
        return 8  # Level II - Code D (26-50) -> 8
    elif order_qty <= 90:
        return 13 # Level II - Code E (51-90) -> 13
    elif order_qty <= 150:
        return 20 # Level II - Code F (91-150) -> 20
    elif order_qty <= 280:
        return 32 # Level II - Code G (151-280) -> 32
    elif order_qty <= 500:
        return 50 # Level II - Code H (281-500) -> 50
    elif order_qty <= 1200:
        return 80 # Level II - Code J (501-1200) -> 80
    elif order_qty <= 3200:
        return 125 # Level II - Code K (1201-3200) -> 125
    elif order_qty <= 10000:
        return 200 # Level II - Code L (3201-10000) -> 200
    elif order_qty <= 35000:
        return 315 # Level II - Code M (10001-35000) -> 315
    elif order_qty <= 150000:
        return 500 # Level II - Code N (35001-150000) -> 500
    elif order_qty <= 500000:
        return 800
    else:
        return 1250


class FinalInspection(models.Model):
    """
    Final Inspection Report for shipment audits based on AQL standards.
    Separate from development stage Inspections.
    """
    RESULT_CHOICES = [
        ('Pending', 'Pending'),
        ('Pass', 'Pass'),
        ('Fail', 'Fail'),
    ]
    
    WORKMANSHIP_CHOICES = [
        ('Pass', 'Pass'),
        ('Fail', 'Fail'),
        ('NA', 'N/A'),
    ]
    
    # Primary fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # General Information
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name='final_inspections')
    supplier = models.CharField(max_length=255, blank=True)
    factory = models.CharField(max_length=255, blank=True)
    inspection_date = models.DateField()
    order_no = models.CharField(max_length=255)
    style_no = models.CharField(max_length=255)
    color = models.CharField(max_length=255, blank=True)
    
    # Inspection Attempt Tracking
    INSPECTION_ATTEMPT_CHOICES = [
        ('1st', '1st Inspection'),
        ('2nd', '2nd Inspection'),
        ('3rd', '3rd Inspection'),
    ]
    inspection_attempt = models.CharField(
        max_length=20,
        choices=INSPECTION_ATTEMPT_CHOICES,
        default='1st',
        help_text='Inspection attempt number for this order'
    )
    
    # Quantities
    total_order_qty = models.PositiveIntegerField(default=0)
    presented_qty = models.PositiveIntegerField(default=0)
    
    # Sampling & AQL
    AQL_STANDARD_CHOICES = [
        ('strict', 'Strict (0/1.5/2.5)'),
        ('standard', 'Standard (0/2.5/4.0)'),
    ]
    aql_standard = models.CharField(max_length=20, choices=AQL_STANDARD_CHOICES, default='standard')
    sample_size = models.PositiveIntegerField(default=0)
    aql_critical = models.FloatField(default=0.0)
    aql_major = models.FloatField(default=2.5)
    aql_minor = models.FloatField(default=4.0)
    
    # Defect Counts (auto-populated from child defects)
    critical_found = models.PositiveIntegerField(default=0)
    major_found = models.PositiveIntegerField(default=0)
    minor_found = models.PositiveIntegerField(default=0)
    
    # AQL Limits (auto-calculated)
    max_allowed_critical = models.PositiveIntegerField(default=0)
    max_allowed_major = models.PositiveIntegerField(default=0)
    max_allowed_minor = models.PositiveIntegerField(default=0)
    
    # Result
    result = models.CharField(max_length=20, choices=RESULT_CHOICES, default='Pending')
    
    # Shipment Details
    total_cartons = models.PositiveIntegerField(default=0)
    selected_cartons = models.PositiveIntegerField(default=0)
    carton_length = models.FloatField(default=0.0, help_text="Length in cm")
    carton_width = models.FloatField(default=0.0, help_text="Width in cm")
    carton_height = models.FloatField(default=0.0, help_text="Height in cm")
    gross_weight = models.FloatField(default=0.0, help_text="Gross weight in kg")
    net_weight = models.FloatField(default=0.0, help_text="Net weight in kg")
    
    # Checklist
    quantity_check = models.BooleanField(default=False)
    workmanship = models.CharField(max_length=10, choices=WORKMANSHIP_CHOICES, default='NA')
    packing_method = models.CharField(max_length=10, choices=WORKMANSHIP_CHOICES, default='NA')
    marking_label = models.CharField(max_length=10, choices=WORKMANSHIP_CHOICES, default='NA')
    data_measurement = models.CharField(max_length=10, choices=WORKMANSHIP_CHOICES, default='NA')
    hand_feel = models.CharField(max_length=10, choices=WORKMANSHIP_CHOICES, default='NA')
    
    # Remarks
    remarks = models.TextField(blank=True)
    
    # Draft support
    is_draft = models.BooleanField(default=False, help_text="True if this inspection is a draft (incomplete, not finalized)")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    
    def calculate_aql_limits(self):
        """Calculate max allowed defects based on sample size and AQL levels."""
        self.max_allowed_critical = get_aql_limits(self.sample_size, self.aql_critical)
        self.max_allowed_major = get_aql_limits(self.sample_size, self.aql_major)
        self.max_allowed_minor = get_aql_limits(self.sample_size, self.aql_minor)
    
    def update_result(self):
        """Determine Pass/Fail based on defects vs AQL limits."""
        if self.critical_found > self.max_allowed_critical:
            self.result = 'Fail'
        elif self.major_found > self.max_allowed_major:
            self.result = 'Fail'
        elif self.minor_found > self.max_allowed_minor:
            self.result = 'Fail'
        else:
            self.result = 'Pass'
    
    def save(self, *args, **kwargs):
        """Auto-calculate AQL limits and result before saving."""
        # Set AQL levels based on standard
        if self.aql_standard == 'strict':
            self.aql_critical = 0.0
            self.aql_major = 1.5
            self.aql_minor = 2.5
        else:
            self.aql_critical = 0.0
            self.aql_major = 2.5
            self.aql_minor = 4.0

        # Auto-calculate sample size based on PRESENTED QTY (not order qty)
        if not self.sample_size and self.presented_qty:
            self.sample_size = calculate_sample_size(self.presented_qty)
        elif not self.sample_size and self.total_order_qty:
             # Fallback if presented_qty is 0
            self.sample_size = calculate_sample_size(self.total_order_qty)
        
        # Calculate AQL limits
        self.calculate_aql_limits()
        
        # Update result
        self.update_result()
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"FIR-{self.order_no} - {self.style_no} ({self.result})"
    
    class Meta:
        ordering = ['-created_at']


class FinalInspectionDefect(models.Model):
    """Individual defect found during final inspection."""
    SEVERITY_CHOICES = [
        ('Critical', 'Critical'),
        ('Major', 'Major'),
        ('Minor', 'Minor'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    final_inspection = models.ForeignKey(FinalInspection, related_name='defects', on_delete=models.CASCADE)
    description = models.CharField(max_length=255)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='Minor')
    count = models.PositiveIntegerField(default=1)
    photo = models.ImageField(upload_to='final_inspection_defects/', null=True, blank=True)
    
    def save(self, *args, **kwargs):
        """Update parent inspection's defect counts."""
        with transaction.atomic():
            super().save(*args, **kwargs)
            
            # Recalculate parent defect totals
            inspection = self.final_inspection
            # Lock the parent row to prevent race conditions
            inspection = FinalInspection.objects.select_for_update().get(id=inspection.id)
            
            inspection.critical_found = inspection.defects.filter(severity='Critical').aggregate(
                total=models.Sum('count'))['total'] or 0
            inspection.major_found = inspection.defects.filter(severity='Major').aggregate(
                total=models.Sum('count'))['total'] or 0
            inspection.minor_found = inspection.defects.filter(severity='Minor').aggregate(
                total=models.Sum('count'))['total'] or 0
            inspection.save()
    
    def delete(self, *args, **kwargs):
        """Update parent inspection's defect counts on delete."""
        with transaction.atomic():
            inspection = self.final_inspection
            super().delete(*args, **kwargs)
            
            # Recalculate parent defect totals
            # Lock the parent row to prevent race conditions
            inspection = FinalInspection.objects.select_for_update().get(id=inspection.id)

            inspection.critical_found = inspection.defects.filter(severity='Critical').aggregate(
                total=models.Sum('count'))['total'] or 0
            inspection.major_found = inspection.defects.filter(severity='Major').aggregate(
                total=models.Sum('count'))['total'] or 0
            inspection.minor_found = inspection.defects.filter(severity='Minor').aggregate(
                total=models.Sum('count'))['total'] or 0
            inspection.save()
    
    def __str__(self):
        return f"{self.description} ({self.severity}) x{self.count}"
    
    class Meta:
        ordering = ['severity', 'description']


class FinalInspectionSizeCheck(models.Model):
    """Quantity verification per size for final inspection."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    final_inspection = models.ForeignKey(FinalInspection, related_name='size_checks', on_delete=models.CASCADE)
    size = models.CharField(max_length=50)
    order_qty = models.PositiveIntegerField(default=0)
    packed_qty = models.PositiveIntegerField(default=0)
    
    @property
    def difference(self):
        """Calculate difference between packed and ordered quantity."""
        return self.packed_qty - self.order_qty
    
    @property
    def deviation_percent(self):
        """Calculate deviation percentage."""
        if self.order_qty == 0:
            return 0.0
        return round((self.difference / self.order_qty) * 100, 2)
    
    def __str__(self):
        return f"{self.final_inspection.order_no} - Size {self.size}"
    
    class Meta:
        ordering = ['size']


class FinalInspectionImage(models.Model):
    """Images for final inspection with captions and categories."""
    CATEGORY_CHOICES = [
        ('Packaging', 'Packaging'),
        ('Labeling', 'Labeling'),
        ('Defect', 'Defect'),
        ('General', 'General'),
        ('Measurement', 'Measurement'),
        ('On-Site Test', 'On-Site Test'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    final_inspection = models.ForeignKey(FinalInspection, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='final_inspection_images/')
    caption = models.CharField(max_length=255, default='Final Inspection Image')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='General')
    order = models.PositiveIntegerField(default=0, help_text="Display order")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.final_inspection.order_no} - {self.caption}"
    
    class Meta:
        ordering = ['order', 'uploaded_at']


class FinalInspectionMeasurement(models.Model):
    """Measurement row for a POM in a Final Inspection."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    final_inspection = models.ForeignKey(FinalInspection, related_name='measurements', on_delete=models.CASCADE)
    pom_name = models.CharField(max_length=255)
    tol = models.FloatField(default=0.0)
    spec = models.FloatField(default=0.0)
    size_name = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"{self.pom_name} - {self.final_inspection.order_no}"

    class Meta:
        ordering = ['id']


class FinalInspectionMeasurementSample(models.Model):
    """Dynamic sample value linked to a FinalInspectionMeasurement."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    measurement = models.ForeignKey(
        FinalInspectionMeasurement, 
        related_name='samples', 
        on_delete=models.CASCADE
    )
    index = models.PositiveIntegerField(help_text="Sample number (1, 2, 3...)")
    value = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['index']
        unique_together = ['measurement', 'index']

    def __str__(self):
        return f"S{self.index}: {self.value}"


# ==================== Style Cycle Models ====================

class StyleMaster(models.Model):
    """
    Master record for a Style, linking PO, style details, and customer.
    Merchandisers create these to track sample comments and related documents.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po_number = models.CharField(max_length=255, db_index=True, help_text="Purchase Order Number")
    style_name = models.CharField(max_length=255)
    color = models.CharField(max_length=255, blank=True)
    season = models.CharField(max_length=100, blank=True, help_text="e.g., Fall 2026, Spring 2027")
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name='styles')
    factory = models.ForeignKey(Factory, null=True, blank=True, on_delete=models.SET_NULL, related_name='styles')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_styles')

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Style Master"
        verbose_name_plural = "Style Masters"

    def __str__(self):
        return f"{self.po_number} - {self.style_name}"


class SampleComment(models.Model):
    """
    Customer comments on a specific sample type for a Style.
    Each sample type (Fit, PP, Size Set, TOP) can have multiple submissions (1st, 2nd, etc.).
    """
    SAMPLE_TYPE_CHOICES = [
        ('Fit Sample', 'Fit Sample'),
        ('PP Sample', 'PP Sample'),
        ('Size Set', 'Size Set'),
        ('SMS', 'SMS'),
        ('Shipment Sample', 'Shipment Sample'),
    ]

    SAMPLE_NUMBER_CHOICES = [
        (1, '1st Sample'),
        (2, '2nd Sample'),
        (3, '3rd Sample'),
        (4, '4th Sample'),
        (5, '5th Sample'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    style = models.ForeignKey(StyleMaster, on_delete=models.CASCADE, related_name='comments')
    sample_type = models.CharField(max_length=50, choices=SAMPLE_TYPE_CHOICES)
    sample_number = models.PositiveSmallIntegerField(choices=SAMPLE_NUMBER_CHOICES, default=1, help_text="Which submission number (1st, 2nd, etc.)")
    
    # Comment fields matching the Evaluation Form categories
    comments_general = models.TextField(blank=True, verbose_name="General Customer Feedback")
    comments_fit = models.TextField(blank=True, verbose_name="Fit Comments")
    comments_workmanship = models.TextField(blank=True, verbose_name="Workmanship Comments")
    comments_wash = models.TextField(blank=True, verbose_name="Wash Comments")
    comments_fabric = models.TextField(blank=True, verbose_name="Fabric Comments")
    comments_accessories = models.TextField(blank=True, verbose_name="Accessories Comments")

    # Per-section edit timestamps (reference only, not used by evaluation form)
    general_edited_at = models.DateTimeField(null=True, blank=True)
    fit_edited_at = models.DateTimeField(null=True, blank=True)
    workmanship_edited_at = models.DateTimeField(null=True, blank=True)
    wash_edited_at = models.DateTimeField(null=True, blank=True)
    fabric_edited_at = models.DateTimeField(null=True, blank=True)
    accessories_edited_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    # Mapping of comment fields to their corresponding edited_at timestamp fields
    SECTION_TIMESTAMP_MAP = {
        'comments_general': 'general_edited_at',
        'comments_fit': 'fit_edited_at',
        'comments_workmanship': 'workmanship_edited_at',
        'comments_wash': 'wash_edited_at',
        'comments_fabric': 'fabric_edited_at',
        'comments_accessories': 'accessories_edited_at',
    }

    class Meta:
        ordering = ['-sample_number', '-created_at']  # Latest sample number first
        verbose_name = "Sample Comment"
        verbose_name_plural = "Sample Comments"

    def save(self, *args, **kwargs):
        """Auto-detect which comment sections changed and stamp their edited_at fields."""
        if self.pk:
            try:
                old = SampleComment.objects.filter(pk=self.pk).values(
                    *self.SECTION_TIMESTAMP_MAP.keys()
                ).first()
                if old:
                    now = timezone.now()
                    for field, ts_field in self.SECTION_TIMESTAMP_MAP.items():
                        new_val = getattr(self, field, '')
                        old_val = old.get(field, '')
                        if new_val != old_val:
                            setattr(self, ts_field, now)
            except Exception:
                pass  # Fail silently — timestamps are reference-only
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.style.po_number} - {self.sample_type} ({self.get_sample_number_display()})"


class SampleCommentImage(models.Model):
    """
    Images attached to a sample comment, tagged by feedback category.
    Displayed as inline thumbnail tiles under the respective category card.
    """
    CATEGORY_CHOICES = [
        ('general', 'General'),
        ('fit', 'Fit'),
        ('workmanship', 'Workmanship'),
        ('wash', 'Wash'),
        ('fabric', 'Fabric'),
        ('accessories', 'Accessories'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    comment = models.ForeignKey(SampleComment, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='sample_comment_images/')
    caption = models.CharField(max_length=255, blank=True, default='')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']
        verbose_name = "Sample Comment Image"
        verbose_name_plural = "Sample Comment Images"

    def __str__(self):
        return f"{self.comment} - {self.get_category_display()} - {self.caption or 'Image'}"


class StyleLink(models.Model):
    """
    Related links and documents for a Style (e.g., spec sheets, approval emails).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    style = models.ForeignKey(StyleMaster, on_delete=models.CASCADE, related_name='links')
    label = models.CharField(max_length=255, help_text="Display name for the link")
    url = models.URLField(max_length=500)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['label']
        verbose_name = "Style Link"
        verbose_name_plural = "Style Links"


    def __str__(self):
        return f"{self.style.po_number} - {self.label}"

# ==================== Auth / Security Models ====================

class OTPVerification(models.Model):
    """Temporary storage for One-Time Passwords sent via email for password reset."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_requests')
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        """Check if the OTP is un-used and not expired."""
        return not self.is_used and self.expires_at > timezone.now()

    def __str__(self):
        return f"OTP for {self.user.email} - {'Used' if self.is_used else 'Active'}"

