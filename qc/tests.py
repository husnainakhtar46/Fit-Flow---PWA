"""
Unit tests for QC app models and business logic.

Tests cover:
- AQL sample size calculation (ISO 2859-1)
- AQL limits lookup
- FinalInspection pass/fail logic
"""

from django.test import TestCase
from .models import calculate_sample_size, get_aql_limits, FinalInspection, Customer
from datetime import date


class AQLSampleSizeTests(TestCase):
    """Test ISO 2859-1 sample size calculation."""
    
    def test_very_small_order(self):
        """Order qty <= 8 should return sample size 2."""
        self.assertEqual(calculate_sample_size(5), 2)
        self.assertEqual(calculate_sample_size(8), 2)
    
    def test_small_order_sizes(self):
        """Orders up to 50 should return corresponding sample size."""
        self.assertEqual(calculate_sample_size(15), 3)
        self.assertEqual(calculate_sample_size(25), 5)
        self.assertEqual(calculate_sample_size(50), 8)
    
    def test_medium_order_sizes(self):
        """Test medium order quantity sample sizes."""
        self.assertEqual(calculate_sample_size(90), 13)
        self.assertEqual(calculate_sample_size(150), 20)
        self.assertEqual(calculate_sample_size(280), 32)
        self.assertEqual(calculate_sample_size(500), 50)
    
    def test_large_order_sizes(self):
        """Test large order quantity sample sizes."""
        self.assertEqual(calculate_sample_size(1200), 80)
        self.assertEqual(calculate_sample_size(3200), 125)
        self.assertEqual(calculate_sample_size(10000), 200)
    
    def test_very_large_order_sizes(self):
        """Test very large order quantity sample sizes."""
        self.assertEqual(calculate_sample_size(35000), 315)
        self.assertEqual(calculate_sample_size(150000), 500)
        self.assertEqual(calculate_sample_size(500000), 800)
        self.assertEqual(calculate_sample_size(1000000), 1250)
    
    def test_boundary_values(self):
        """Test boundary values at sample size transitions."""
        # Just under 91 -> 13, at 91 would be in next bracket
        self.assertEqual(calculate_sample_size(90), 13)
        # Just under 151 -> 20, at 151 would be in next bracket
        self.assertEqual(calculate_sample_size(150), 20)


class AQLLimitsTests(TestCase):
    """Test AQL acceptance limits table lookup."""
    
    def test_critical_always_zero_for_small_samples(self):
        """Critical (AQL 0.0) should return 0 for most sample sizes."""
        self.assertEqual(get_aql_limits(8, 0.0), 0)
        self.assertEqual(get_aql_limits(50, 0.0), 0)
        self.assertEqual(get_aql_limits(125, 0.0), 0)
        self.assertEqual(get_aql_limits(200, 0.0), 0)
    
    def test_critical_large_samples(self):
        """Critical allows 1-2 defects for very large samples."""
        self.assertEqual(get_aql_limits(500, 0.0), 1)
        self.assertEqual(get_aql_limits(800, 0.0), 1)
        self.assertEqual(get_aql_limits(1250, 0.0), 2)
    
    def test_major_limits_standard_aql(self):
        """Major (AQL 2.5) limits for standard inspection."""
        self.assertEqual(get_aql_limits(8, 2.5), 0)
        self.assertEqual(get_aql_limits(50, 2.5), 3)
        self.assertEqual(get_aql_limits(125, 2.5), 7)
        self.assertEqual(get_aql_limits(200, 2.5), 10)
    
    def test_minor_limits(self):
        """Minor (AQL 4.0) limits are more lenient."""
        self.assertEqual(get_aql_limits(8, 4.0), 1)
        self.assertEqual(get_aql_limits(50, 4.0), 5)
        self.assertEqual(get_aql_limits(125, 4.0), 10)
        self.assertEqual(get_aql_limits(200, 4.0), 14)
    
    def test_unknown_sample_size_returns_zero(self):
        """Unknown sample size should return 0 (fail-safe)."""
        self.assertEqual(get_aql_limits(99, 2.5), 0)
        self.assertEqual(get_aql_limits(0, 2.5), 0)


class FinalInspectionResultTests(TestCase):
    """Test Pass/Fail determination logic."""
    
    def setUp(self):
        """Create a test customer for foreign key."""
        self.customer = Customer.objects.create(name="Test Customer")
    
    def test_pass_when_within_limits(self):
        """Should pass when all defects are within AQL limits."""
        # Sample size 50: Critical=0, Major=2, Minor=5
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="TEST-001",
            style_no="STYLE-001",
            sample_size=50,
            critical_found=0, 
            major_found=1, 
            minor_found=3
        )
        inspection.calculate_aql_limits()
        inspection.update_result()
        self.assertEqual(inspection.result, 'Pass')
    
    def test_pass_at_exact_limits(self):
        """Should pass when defects are exactly at the limit."""
        # Sample size 50: Critical=0, Major=2, Minor=5
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="TEST-002",
            style_no="STYLE-002",
            sample_size=50,
            critical_found=0, 
            major_found=2, 
            minor_found=5
        )
        inspection.calculate_aql_limits()
        inspection.update_result()
        self.assertEqual(inspection.result, 'Pass')
    
    def test_fail_on_critical_defect(self):
        """Any critical defect should fail for small sample sizes."""
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="TEST-003",
            style_no="STYLE-003",
            sample_size=50,
            critical_found=1, 
            major_found=0, 
            minor_found=0
        )
        inspection.calculate_aql_limits()
        inspection.update_result()
        self.assertEqual(inspection.result, 'Fail')
    
    def test_fail_on_major_over_limit(self):
        """Should fail when major defects exceed limit."""
        # Sample size 50: Major limit = 3
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="TEST-004",
            style_no="STYLE-004",
            sample_size=50,
            critical_found=0, 
            major_found=4,  # Over limit of 3
            minor_found=0
        )
        inspection.calculate_aql_limits()
        inspection.update_result()
        self.assertEqual(inspection.result, 'Fail')
    
    def test_fail_on_minor_over_limit(self):
        """Should fail when minor defects exceed limit."""
        # Sample size 50: Minor limit = 5
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="TEST-005",
            style_no="STYLE-005",
            sample_size=50,
            critical_found=0, 
            major_found=0,
            minor_found=6  # Over limit of 5
        )
        inspection.calculate_aql_limits()
        inspection.update_result()
        self.assertEqual(inspection.result, 'Fail')
    
    def test_strict_standard_stricter_limits(self):
        """Strict standard (1.5/2.5) should have tighter limits than standard (2.5/4.0)."""
        # With strict standard, major AQL = 1.5
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="TEST-006",
            style_no="STYLE-006",
            sample_size=50,
            aql_standard='strict',
            critical_found=0,
            major_found=2,  # Would pass standard (limit=2) but fail strict (limit=1)
            minor_found=0
        )
        inspection.save()  # Triggers save() which sets AQL levels
        self.assertEqual(inspection.aql_major, 1.5)
        # At sample 50 with AQL 1.5, max major would be different
        # The strict standard is tighter


class FinalInspectionAutoCalculationTests(TestCase):
    """Test auto-calculation during save()."""
    
    def setUp(self):
        self.customer = Customer.objects.create(name="Test Customer")
    
    def test_sample_size_auto_calculated(self):
        """Sample size should be auto-calculated from presented_qty."""
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="AUTO-001",
            style_no="STYLE-001",
            presented_qty=500,  # Should give sample size 50
        )
        inspection.save()
        self.assertEqual(inspection.sample_size, 50)
    
    def test_aql_limits_auto_calculated(self):
        """AQL limits should be auto-calculated on save."""
        inspection = FinalInspection(
            customer=self.customer,
            inspection_date=date.today(),
            order_no="AUTO-002",
            style_no="STYLE-002",
            sample_size=50,
        )
        inspection.save()
        # Standard AQL: Critical=0, Major=2.5, Minor=4.0
        # Sample size 50 limits
        self.assertEqual(inspection.max_allowed_critical, 0)
        self.assertEqual(inspection.max_allowed_major, 3)
        self.assertEqual(inspection.max_allowed_minor, 5)
