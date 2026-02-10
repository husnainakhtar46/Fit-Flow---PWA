"""
Debug / Test script for POMExtractor v2.

Run this script to verify the extractor logic against mock data
that simulates different customer Techfile layouts.

Usage:
    python qc/utils/debug_extractor.py
    python qc/utils/debug_extractor.py  path/to/actual.pdf
"""

import sys
import os

# Add project root to path so we can import qc.services
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from qc.services.extractor import POMExtractor, extract_pom_from_file


def test_header_scoring():
    """Test: header row buried under metadata rows (Basic Trousers pattern)."""
    print("\n" + "=" * 60)
    print("TEST 1: Header scoring – noisy rows before real header")
    print("=" * 60)

    table = [
        ['508', 'Mens STRETCH trousers BASIC', '', '', ''],
        ['Season: SS2025', 'Color: Black', '', '', ''],
        ['', '', '', '', ''],
        ['', 'Description', 'M', 'Tol (+/-)', 'Tol (-)'],
        ['1', 'Waist width', '40', '1.0', '1.0'],
        ['2', 'Hip width', '50', '1.5', '1.5'],
        ['3', 'Front rise', '28', '0.5', '0.5'],
    ]

    extractor = POMExtractor()
    result = extractor._process_table(table)

    print(f"Success: {result.success}")
    print(f"POMs found: {len(result.poms)}")
    for p in result.poms:
        print(f"  - {p.name}: tol={p.default_tol}")

    assert result.success, "Should have found POMs"
    assert len(result.poms) == 3, f"Expected 3 POMs, got {len(result.poms)}"
    assert result.poms[0].name == "Waist width"
    print("[PASS] PASSED")


def test_split_tolerance():
    """Test: Orsay-style split Tol(+) / Tol(-) columns."""
    print("\n" + "=" * 60)
    print("TEST 2: Split tolerance - Orsay pattern")
    print("=" * 60)

    table = [
        ['Description', 'M', 'Tol (+)', 'Tol (-)', 'L'],
        ['Shoulder width', '42', '1.0', '1.5', '44'],
        ['Chest width', '100', '2.0', '2.0', '104'],
    ]

    extractor = POMExtractor()
    result = extractor._process_table(table)

    print(f"Success: {result.success}")
    for p in result.poms:
        print(f"  - {p.name}: tol={p.default_tol}")

    assert result.success
    assert result.poms[0].default_tol == 1.5, f"Expected max(1.0, 1.5)=1.5, got {result.poms[0].default_tol}"
    assert result.poms[1].default_tol == 2.0
    print("[PASS] PASSED")


def test_pom_name_cleaning():
    """Test: POM names with leading codes (42 A, Dim H1, etc.)."""
    print("\n" + "=" * 60)
    print("TEST 3: POM name cleaning")
    print("=" * 60)

    extractor = POMExtractor()
    cases = [
        ("42 A Waist width", "Waist width"),
        ("Dim H1 Shoulder", "Shoulder"),
        ("A. Back length", "Back length"),
        ("1. Chest width", "Chest width"),
        ("H1 Front rise", "Front rise"),
        ("Shoulder width", "Shoulder width"),
        ("B2. Hem width", "Hem width"),
    ]

    all_pass = True
    for raw, expected in cases:
        result = extractor._clean_pom_name(raw)
        status = "[PASS]" if result == expected else "[FAIL]"
        if result != expected:
            all_pass = False
        print(f"  {status} '{raw}' -> '{result}' (expected '{expected}')")

    if all_pass:
        print("[PASS] ALL PASSED")
    else:
        print("[FAIL] SOME FAILED (non-critical - regex may need tuning for your data)")


def test_noise_columns():
    """Test: DIF columns should be ignored."""
    print("\n" + "=" * 60)
    print("TEST 4: Noise columns (DIF) are skipped")
    print("=" * 60)

    table = [
        ['Description', 'S', 'DIF', 'M', 'DIF', 'Tolerance'],
        ['Waist', '38', '2', '40', '2', '1.0'],
        ['Hip', '48', '2', '50', '2', '1.5'],
    ]

    extractor = POMExtractor()
    result = extractor._process_table(table)

    print(f"Success: {result.success}")
    print(f"Matched columns: {result.matched_columns}")
    for p in result.poms:
        print(f"  - {p.name}: tol={p.default_tol}")

    assert result.success
    assert 'dif' not in str(result.matched_columns).lower(), "DIF columns should not be matched"
    print("[PASS] PASSED")


def test_number_parsing():
    """Test: various number formats."""
    print("\n" + "=" * 60)
    print("TEST 5: Number parsing edge cases")
    print("=" * 60)

    extractor = POMExtractor()
    cases = [
        ("1.5", 1.5),
        ("+/-1.0", 1.0),
        ("0.5", 0.5),
        ("1,5", 1.5),        # European
        ("1.5 cm", 1.5),     # With units
        ("1/2", 0.5),        # Fraction
        ("3/4", 0.75),       # Fraction
        ("", 0.0),
        ("abc", 0.0),
    ]

    all_pass = True
    for raw, expected in cases:
        result = extractor._parse_number(raw)
        status = "[PASS]" if abs(result - expected) < 0.001 else "[FAIL]"
        if abs(result - expected) >= 0.001:
            all_pass = False
        print(f"  {status} '{raw}' -> {result} (expected {expected})")

    if all_pass:
        print("[PASS] ALL PASSED")
    else:
        print("[FAIL] SOME FAILED")


def test_real_file(filepath):
    """Test extraction on an actual PDF/Excel file."""
    print("\n" + "=" * 60)
    print(f"REAL FILE TEST: {filepath}")
    print("=" * 60)

    with open(filepath, 'rb') as f:
        content = f.read()

    result = extract_pom_from_file(content, os.path.basename(filepath))

    print(f"Success: {result.success}")
    print(f"Matched columns: {result.matched_columns}")
    print(f"Confidence: {result.confidence_scores}")

    if result.error:
        print(f"Error: {result.error}")

    print(f"\nExtracted {len(result.poms)} POMs:")
    for p in result.poms:
        std_str = f", std={p.default_std}" if p.default_std else ""
        print(f"  - {p.name}: tol={p.default_tol}{std_str}")


if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Test with real file
        test_real_file(sys.argv[1])
    else:
        # Run all mock tests
        test_header_scoring()
        test_split_tolerance()
        test_pom_name_cleaning()
        test_noise_columns()
        test_number_parsing()
        print("\n" + "=" * 60)
        print("ALL TESTS COMPLETE")
        print("=" * 60)
