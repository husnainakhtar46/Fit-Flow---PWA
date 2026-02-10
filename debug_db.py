
import os
import sys
import django
from django.conf import settings

# Setup Django setup
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quality_check.settings")
django.setup()

def check_db():
    db_settings = settings.DATABASES['default']
    engine = db_settings.get('ENGINE', '')
    name = db_settings.get('NAME', '')
    host = db_settings.get('HOST', '')
    
    print("-" * 40)
    print("ACTIVE DATABASE CONNECTION DEBUG INFO")
    print("-" * 40)
    print(f"Engine: {engine}")
    print(f"DB Name: {name}")
    print(f"Host:   {host}")
    
    if 'sqlite' in engine or 'sqlite' in name:
        print("\n⚠️  WARNING: You are connected to SQLite (Local DB)!")
    elif 'postgresql' in engine:
        print("\n✅ SUCCESS: You are connected to PostgreSQL!")
        if 'supabase' in host:
             print("   (Looks like Supabase)")
    
    print("-" * 40)

if __name__ == "__main__":
    check_db()
