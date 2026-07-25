import os, sys
sys.path.insert(0, 'C:\\Users\\meck\\Documents\\madan')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from rest_framework.test import APIRequestFactory
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from machines.views import performance_report_view, analysis_report_view

factory = APIRequestFactory()
user = User.objects.filter(is_superuser=True).first()
print('User:', user.username, 'superuser:', user.is_superuser)
token = Token.objects.get_or_create(user=user)[0]

# Test 1: with factory_id=1
print('\n--- Test 1: factory_id=1 ---')
req = factory.get('/api/reports/performance/',
    {'range': '30days', 'format': 'pdf', 'factory_id': '1'},
    HTTP_AUTHORIZATION='Token ' + token.key)
resp = performance_report_view(req)
print('Status:', resp.status_code)
ct = resp.get('Content-Type', '')
print('Content-Type:', ct)
if resp.status_code == 404 and hasattr(resp, 'data'):
    d = resp.data
    for k, v in d.items():
        text = repr(v)
        safe = text.encode('ascii', 'replace').decode('ascii')
        print(' ', k, ':', safe[:200])

# Test 2: without factory_id
print('\n--- Test 2: no factory_id ---')
req2 = factory.get('/api/reports/performance/',
    {'range': '30days', 'format': 'pdf'},
    HTTP_AUTHORIZATION='Token ' + token.key)
resp2 = performance_report_view(req2)
print('Status:', resp2.status_code)
ct2 = resp2.get('Content-Type', '')
print('Content-Type:', ct2)
if resp2.status_code == 404 and hasattr(resp2, 'data'):
    d = resp2.data
    for k, v in d.items():
        safe = repr(v).encode('ascii', 'replace').decode('ascii')
        print(' ', k, ':', safe[:200])

# Test 3: check generate_performance_report directly
print('\n--- Test 3: Direct report generation ---')
from machines.reports import generate_performance_report
try:
    buf, ext = generate_performance_report(None, '30days', fmt='pdf')
    print('generate_performance_report OK:', len(buf.getvalue()), 'bytes')
except Exception as e:
    print('FAILED:', e)

# Test 4: Factory lookup
print('\n--- Test 4: Factory lookup ---')
from machines.models import Factory
print('Total factories:', Factory.objects.count())
for f in Factory.objects.all():
    print('  Factory id=', f.id, 'name=', f.name)
