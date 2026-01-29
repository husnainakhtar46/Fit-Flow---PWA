
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quality_check.settings')
django.setup()

from qc.models import calculate_sample_size, get_aql_limits

def analyze():
    output = []
    
    # --- Sample Sizes ---
    output.append("--- Checking Sample Sizes (Level II) ---")
    expected_samples = [
        (2, 2),   
        (8, 2),   
        (9, 3),   
        (15, 3),  
        (16, 5),  
        (25, 5),  
        (26, 8),  
        (50, 8),  
        (51, 13), 
        (90, 13), 
        (91, 20), 
        (150, 20),
        (151, 32),
        (280, 32),
        (281, 50),
        (500, 50),
        (501, 80),
        (1200, 80),
        (1201, 125),
        (3200, 125),
        (3201, 200),
        (10000, 200),
        (10001, 315),
        (35000, 315),
        (35001, 500),
        (150000, 500)
    ]
    
    for qty, exp_size in expected_samples:
        calc_size = calculate_sample_size(qty)
        status = "MATCH" if calc_size == exp_size else "MISMATCH"
        output.append(f"Batch: {qty} | Expected: {exp_size} | Got: {calc_size} | {status}")

    # --- AQL Limits ---
    output.append("\n--- Checking AQL Limits (Image 3) ---")
    test_cases_limits = [
        # AQL 1.5
        (13, 1.5, 0),
        (20, 1.5, 1),
        (32, 1.5, 1),
        (50, 1.5, 2),
        (80, 1.5, 3),
        (125, 1.5, 5),
        (200, 1.5, 7),
        (315, 1.5, 10),
        (500, 1.5, 14),
        
        # AQL 2.5
        (13, 2.5, 1),
        (20, 2.5, 1),
        (32, 2.5, 2),
        (50, 2.5, 3),
        (80, 2.5, 5),
        (125, 2.5, 7),
        (200, 2.5, 10),
        (315, 2.5, 14),
        (500, 2.5, 21),
        
        # AQL 4.0
        (13, 4.0, 1),
        (20, 4.0, 2),
        (32, 4.0, 3),
        (50, 4.0, 5),
        (80, 4.0, 7),
        (125, 4.0, 10),
        (200, 4.0, 14),
        (315, 4.0, 21),
        (500, 4.0, 21),
    ]
    
    for size, aql, exp_ac in test_cases_limits:
        calc_ac = get_aql_limits(size, aql)
        status = "MATCH" if calc_ac == exp_ac else "MISMATCH"
        output.append(f"Size: {size}, AQL: {aql} | Expected: {exp_ac} | Got: {calc_ac} | {status}")

    with open('analysis_result_utf8.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(output))

if __name__ == "__main__":
    analyze()
