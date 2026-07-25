import os, sys
sys.path.insert(0, 'C:\\Users\\meck\\Documents\\madan')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.test import Client
from django.contrib.auth.models import User

c = Client()
user = User.objects.filter(is_superuser=True).first()
c.force_login(user)

# Test the URL
response = c.get('/api/reports/performance/', {'range': '30days', 'format': 'pdf'})
print('Status:', response.status_code)
if response.status_code == 404:
    print('404 body:', response.content.decode('utf-8'))
    
# Also test the analysis endpoint
response2 = c.get('/api/reports/analysis/', {'range': '30days', 'format': 'pdf'})
print('\nAnalysis Status:', response2.status_code)
if response2.status_code == 404:
    print('404 body:', response2.content.decode('utf-8'))

# Test ranges endpoint
response3 = c.get('/api/reports/ranges/')
print('\nRanges Status:', response3.status_code)
if response3.status_code == 200:
    print('Ranges:', response3.json())
    
# Check if the URL routing works at all by testing a viewset URL
response4 = c.get('/api/device-logs/')
print('\nDevice-logs Status:', response4.status_code)
