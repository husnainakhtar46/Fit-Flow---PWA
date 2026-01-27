# qc/models.py
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

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
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.style} - {self.color} ({self.created_at.date()})"

class Measurement(models.Model):
    STATUS_CHOICES = [("OK","OK"), ("FAIL","FAIL")]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection = models.ForeignKey(Inspection, related_name="measurements", on_delete=models.CASCADE)
    pom_name = models.CharField(max_length=255)
    tol = models.FloatField(default=0.0)
    std = models.FloatField(null=True, blank=True) # Changed to allow empty
    
    # Expanded to 6 samples
    s1 = models.FloatField(null=True, blank=True)
    s2 = models.FloatField(null=True, blank=True)
    s3 = models.FloatField(null=True, blank=True)
    s4 = models.FloatField(null=True, blank=True)
    s5 = models.FloatField(null=True, blank=True)
    s6 = models.FloatField(null=True, blank=True)
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="OK")

    def __str__(self):
        return f"{self.pom_name} - {self.inspection.style}"

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
    # ISO 2859-1 AQL Table (simplified for common textile inspection)
    # Format: (sample_size, aql_level): acceptance_number
    aql_table = {
        # Sample Size 8
        (8, 0.0): 0, (8, 2.5): 0, (8, 4.0): 1,
        # Sample Size 13
        (13, 0.0): 0, (13, 2.5): 1, (13, 4.0): 1,
        # Sample Size 20
        (20, 0.0): 0, (20, 2.5): 1, (20, 4.0): 2,
        # Sample Size 32
        (32, 0.0): 0, (32, 2.5): 1, (32, 4.0): 3,
        # Sample Size 50
        (50, 0.0): 0, (50, 2.5): 2, (50, 4.0): 5,
        # Sample Size 80
        (80, 0.0): 0, (80, 2.5): 3, (80, 4.0): 7,
        # Sample Size 125
        (125, 0.0): 0, (125, 2.5): 5, (125, 4.0): 10,
        # Sample Size 200
        (200, 0.0): 0, (200, 2.5): 7, (200, 4.0): 14,
        # Sample Size 315
        (315, 0.0): 0, (315, 2.5): 10, (315, 4.0): 21,
        # Sample Size 500
        (500, 0.0): 1, (500, 2.5): 14, (500, 4.0): 21,
        # Sample Size 800
        (800, 0.0): 1, (800, 2.5): 21, (800, 4.0): 21,
        # Sample Size 1250
        (1250, 0.0): 2, (1250, 2.5): 21, (1250, 4.0): 21,
    }
    
    return aql_table.get((sample_size, aql_level), 0)


def calculate_sample_size(order_qty):
    """
    Calculate sample size based on total order quantity.
    Based on ISO 2859-1 General Inspection Level II.
    
    Args:
        order_qty: Total order quantity
        
    Returns:
        int: Sample size to inspect
    """
    if order_qty <= 8:
        return 8
    elif order_qty <= 15:
        return 8
    elif order_qty <= 25:
        return 8
    elif order_qty <= 50:
        return 8
    elif order_qty <= 90:
        return 13
    elif order_qty <= 150:
        return 20
    elif order_qty <= 280:
        return 32
    elif order_qty <= 500:
        return 50
    elif order_qty <= 1200:
        return 80
    elif order_qty <= 3200:
        return 125
    elif order_qty <= 10000:
        return 200
    elif order_qty <= 35000:
        return 315
    elif order_qty <= 150000:
        return 500
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
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
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
        super().save(*args, **kwargs)
        
        # Recalculate parent defect totals
        inspection = self.final_inspection
        inspection.critical_found = inspection.defects.filter(severity='Critical').aggregate(
            total=models.Sum('count'))['total'] or 0
        inspection.major_found = inspection.defects.filter(severity='Major').aggregate(
            total=models.Sum('count'))['total'] or 0
        inspection.minor_found = inspection.defects.filter(severity='Minor').aggregate(
            total=models.Sum('count'))['total'] or 0
        inspection.save()
    
    def delete(self, *args, **kwargs):
        """Update parent inspection's defect counts on delete."""
        inspection = self.final_inspection
        super().delete(*args, **kwargs)
        
        # Recalculate parent defect totals
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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    final_inspection = models.ForeignKey(FinalInspection, related_name='measurements', on_delete=models.CASCADE)
    pom_name = models.CharField(max_length=255)
    tol = models.FloatField(default=0.0)
    spec = models.FloatField(default=0.0) # User editable standard
    s1 = models.CharField(max_length=50, blank=True)
    s2 = models.CharField(max_length=50, blank=True)
    s3 = models.CharField(max_length=50, blank=True)
    s4 = models.CharField(max_length=50, blank=True)
    s5 = models.CharField(max_length=50, blank=True)
    s6 = models.CharField(max_length=50, blank=True)
    size_name = models.CharField(max_length=50, blank=True)

    def __str__(self):
        return f"{self.pom_name} - {self.final_inspection.order_no}"

    class Meta:
        ordering = ['id']
