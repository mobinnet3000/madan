import os, sys
sys.path.insert(0, 'C:\\Users\\meck\\Documents\\madan')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.http import HttpResponse
from rest_framework.test import APIRequestFactory
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User

# Import the raw view function (before DRF decorators)
from machines.views import performance_report_view

# Check what the actual function is
real_func = performance_report_view
print('View type:', type(real_func))
print('View name:', getattr(real_func, '__name__', 'N/A'))

# Check closures (the @api_view wraps the original function)
if hasattr(real_func, '__wrapped__'):
    print('Has __wrapped__')
    print('Wrapped:', real_func.__wrapped__)
if hasattr(real_func, 'cls'):
    print('Has cls')

# Try getting the inner function
view_class = getattr(real_func, 'cls', None)
print('View class:', view_class)

# Let's try a different approach - use Django's test client instead
from django.test import Client
c = Client()
user = User.objects.filter(is_superuser=True).first()
token = Token.objects.get_or_create(user=user)[0]

# Test with token auth using Django test client
# Django's Client requires session auth, not token auth
# So let's just login first
c.force_login(user)

# Now access the URL
response = c.get('/api/reports/performance/', {'range': '30days', 'format': 'pdf'})
print('\n--- Django test client ---')
print('Status:', response.status_code)
print('Content-Type:', response.get('Content-Type', ''))
if response.status_code == 200:
    print('Content length:', len(response.content))
elif hasattr(response, 'json'):
    try:
        j = response.json()
        print('JSON:', j)
    except:
        print('Content:', response.content[:200])
