import os, sys
sys.path.insert(0, 'C:\\Users\\meck\\Documents\\madan')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.http import Http404
from machines.views import performance_report_view
from machines.models import Factory

# Check what get_user_factory returns for the admin user
from accounts.services import get_user_factory
from django.contrib.auth.models import User

admin = User.objects.filter(is_superuser=True).first()
print('Admin factory:', get_user_factory(admin))

# Check what generate_performance_report returns with factory_id=1
from machines.reports import generate_performance_report
try:
    buf, ext = generate_performance_report(None, '30days', fmt='pdf')
    print('generate OK:', len(buf.getvalue()))
except Exception as e:
    print('generate FAILED:', e)

# Now simulate the view logic step by step
factory_id = None
range_key = '30days'
date_from = None
date_to = None
fmt = 'pdf'

factory = get_user_factory(admin)
print('factory:', factory)
if factory and not factory_id:
    factory_id = factory.id

print('factory_id after:', factory_id)

if factory_id:
    print('checking factory_id...')
    try:
        fac_obj = Factory.objects.get(id=factory_id)
        print('  found:', fac_obj.name)
    except Factory.DoesNotExist:
        print('  NOT FOUND, raising Http404')
        raise Http404
else:
    print('factory_id is None, skipping check')

print('Calling generate_performance_report...')
buf, ext = generate_performance_report(factory_id, range_key, date_from, date_to, fmt='pdf')
print('OK:', len(buf.getvalue()))
