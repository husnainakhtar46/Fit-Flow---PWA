import requests
import os
import django
import sys

# Setup Django standalone
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quality_check.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

# Get a token
try:
    # Use the test user if exists, or first superuser
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("No superuser found to test with.")
        sys.exit(1)
        
    print(f"Testing with user: {user.username}")
    
    # Generate token manually since we can't easily perform login via requests without password
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    token = str(refresh.access_token)
    
    print("Token generated successfully.")
    
    headers = {'Authorization': f'Bearer {token}'}

    # Test endpoints
    endpoints = ['customers', 'templates', 'factories']
    
    for endpoint in endpoints:
        print(f"\n--- Testing usage of {endpoint} ---")
        url = f'http://localhost:8000/{endpoint}/?page=1'
        print(f"Requesting: {url}")
        try:
            response = requests.get(url, headers=headers)
            print(f"Status Code: {response.status_code} {response.reason}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'results' in data:
                        print(f"Success! Count: {data.get('count')}")
                    else:
                        print(f"Success (List)! Length: {len(data)}")
                except Exception as e:
                    print(f"Failed to parse JSON: {e}")
            else:
                 # Try to extract title
                import re
                title = re.search(r'<title>(.*?)</title>', response.text)
                if title:
                    print(f"Page Title: {title.group(1)}")
                print("First 500 chars:")
                print(response.text[:500])
                
        except Exception as e:
            print(f"Request failed: {e}")

except Exception as e:
    print(f"Exception: {e}")
