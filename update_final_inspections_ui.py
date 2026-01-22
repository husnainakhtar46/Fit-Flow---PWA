import re

file_path = r'c:\Users\husna\Music\Dapp\quality_check_project\frontend\src\pages\FinalInspections.tsx'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Create backup
backup_path = file_path + '.backup'
with open(backup_path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"✓ Created backup at {backup_path}")

# Find and replace the grid section where we display Order, Style, Sample
# We want to add inspection_attempt display

old_pattern = r'(<div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">\s*<div><span className="font-medium">Order:</span> \{inspection\.order_no\}</div>\s*<div><span className="font-medium">Style:</span> \{inspection\.style_no\}</div>\s*<div><span className="font-medium">Sample:</span> \{inspection\.sample_size\} pcs</div>)'

new_pattern = r'''<div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
              <div><span className="font-medium">Order:</span> {inspection.order_no}</div>
              <div><span className="font-medium">Style:</span> {inspection.style_no}</div>
              <div><span className="font-medium">Attempt:</span> {inspection.inspection_attempt}</div>
              <div><span className="font-medium">Sample:</span> {inspection.sample_size} pcs</div>'''

if re.search(old_pattern, content):
    content = re.sub(old_pattern, new_pattern, content)
    print("✓ Found and replaced inspection display section")
else:
    print("⚠ Pattern not found - checking alternative...")
    # Try a simpler search
    if '<div><span className="font-medium">Sample:</span> {inspection.sample_size} pcs</div>' in content:
        # Manual replacement
        old_text = '''            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
              <div><span className="font-medium">Order:</span> {inspection.order_no}</div>
              <div><span className="font-medium">Style:</span> {inspection.style_no}</div>
              <div><span className="font-medium">Sample:</span> {inspection.sample_size} pcs</div>'''
        
        new_text = '''            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
              <div><span className="font-medium">Order:</span> {inspection.order_no}</div>
              <div><span className="font-medium">Style:</span> {inspection.style_no}</div>
              <div><span className="font-medium">Attempt:</span> {inspection.inspection_attempt}</div>
              <div><span className="font-medium">Sample:</span> {inspection.sample_size} pcs</div>'''
        
        if old_text in content:
            content = content.replace(old_text, new_text)
            print("✓ Used alternative method - replaced successfully")
        else:
            print("✗ Could not find the exact pattern")
            exit(1)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✓ Successfully updated {file_path}")
print("\n✓ Added 'Inspection Attempt' display to the list view")
