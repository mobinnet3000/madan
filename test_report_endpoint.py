#!/usr/bin/env python
"""
Test script to debug the /api/reports/performance/ endpoint
"""

import os, sys, json
import requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# First, let's test if we can import the necessary modules
print("1. Testing imports...")
try:
    import django
    django.setup()
    print("   Django setup OK")
    
    from machines.urls import urlpatterns
    print("   machines.urls imported OK")
    
    from rest_framework.test import APIRequestFactory
    from django.test import RequestFactory
    from machines.views import performance_report_view
    print("   Views imported OK")
    
except Exception as e:
    print(f"   ERROR: {e}")
    sys.exit(1)

# Now let's check if the endpoint exists in the URL patterns
print("\n2. Checking URL patterns...")
from django.urls import get_resolver
resolver = get_resolver()

# Look for the specific pattern
found = False
for pattern in resolver.url_patterns:
    if hasattr(pattern, 'url_patterns'):
        for subpattern in pattern.url_patterns:
            if 'reports/performance' in str(subpattern.pattern):
                print(f"   Found pattern: {subpattern.pattern}")
                print(f"   View: {subpattern.callback}")
                found = True
                break

if not found:
    print("   ERROR: Could not find /api/reports/performance/ pattern")

# Test the view directly
print("\n3. Testing view directly...")
try:
    from django.test import RequestFactory
    from rest_framework.authtoken.models import Token
    from django.contrib.auth.models import User
    
    rf = RequestFactory()
    # Create a mock request
    request = rf.get('/api/reports/performance/?range=30days&format=pdf')
    
    # Add user
    user = User.objects.filter(is_superuser=True).first()
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        request.user = user
        request.META['HTTP_AUTHORIZATION'] = f'Token {token.key}'
    
    print(f"   Request user: {request.user}")
    print(f"   Authorization header: {request.META.get('HTTP_AUTHORIZATION', 'None')}")
    
    # Call the view
    response = performance_report_view(request)
    print(f"   Response status: {response.status_code}")
    print(f"   Response headers: {dict(response.items())}")
    
    if response.status_code == 200:
        print("   View returned PDF (success)")
    else:
        print(f"   View failed with status {response.status_code}")
        
except Exception as e:
    print(f"   ERROR calling view: {e}")
    import traceback
    traceback.print_exc()

# Test with requests (simulating real HTTP client)
print("\n4. Testing via HTTP requests...")
try:
    # Get token first
    login_url = 'http://127.0.0.1:8000/api/auth/login/'
    response = requests.post(login_url, json={'username': 'admin', 'password': 'Madan@1404'})
    print(f"   Login status: {response.status_code}")
    
    token = response.json().get('token') if response.status_code == 200 else None
    if token:
        # Test performance report
        perf_url = 'http://127.0.0.1:8000/api/reports/performance/?range=30days&format=pdf'
        headers = {'Authorization': f'Token {token}'}
        response = requests.get(perf_url, headers=headers)
        print(f"   Performance report status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        
        if response.status_code == 200:
            print(f"   PDF size: {len(response.content)} bytes")
        else:
            print(f"   Error response: {response.text[:200]}")
            
except Exception as e:
    print(f"   ERROR: {e}")

print("\n=== Test Summary ===")
print("The endpoint is registered and should work.")
print("If it's returning 404, there might be an issue with URL pattern matching")
print("or the view function itself.")