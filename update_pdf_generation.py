import re

file_path = r'c:\Users\husna\Music\Dapp\quality_check_project\qc\views.py'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Create backup
backup_path = file_path + '.backup'
with open(backup_path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"✓ Created backup at {backup_path}")

# Find and add inspection_attempt to the PDF general info table
old_text = '''    data = [
        ["Customer:", final_inspection.customer.name if final_inspection.customer else 'N/A', "Inspection Date:", final_inspection.inspection_date.strftime('%d-%b-%Y')],
        ["Supplier:", final_inspection.supplier, "Order No:", final_inspection.order_no],
        ["Factory:", final_inspection.factory, "Style No:", final_inspection.style_no],
        ["Color:", final_inspection.color, "AQL Standard:", final_inspection.get_aql_standard_display() if hasattr(final_inspection, 'get_aql_standard_display') else final_inspection.aql_standard],
    ]'''

new_text = '''    data = [
        ["Customer:", final_inspection.customer.name if final_inspection.customer else 'N/A', "Inspection Date:", final_inspection.inspection_date.strftime('%d-%b-%Y')],
        ["Supplier:", final_inspection.supplier, "Order No:", final_inspection.order_no],
        ["Factory:", final_inspection.factory, "Style No:", final_inspection.style_no],
        ["Color:", final_inspection.color, "Inspection Attempt:", final_inspection.get_inspection_attempt_display() if hasattr(final_inspection, 'get_inspection_attempt_display') else final_inspection.inspection_attempt],
        ["AQL Standard:", final_inspection.get_aql_standard_display() if hasattr(final_inspection, 'get_aql_standard_display') else final_inspection.aql_standard, "", ""],
    ]'''

if old_text in content:
    content = content.replace(old_text, new_text)
    print("✓ Added Inspection Attempt to PDF general info table")
else:
    print("⚠ Could not find exact pattern in views.py")
    exit(1)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✓ Successfully updated {file_path}")
print("\n✓ PDF will now display 'Inspection Attempt' in the general information section")
