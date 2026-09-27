import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from machines.models import Factory, FactoryTab, FactoryTabRecord
from datetime import date, timedelta

admin = User.objects.filter(is_superuser=True).first()
c = APIClient(); c.force_authenticate(user=admin)
fac = Factory.objects.get(id=42)
ton = FactoryTab.objects.get(factory=fac, key='mega-tonnage')
perf = FactoryTab.objects.get(factory=fac, key='mega-performance')
ton_recs = list(FactoryTabRecord.objects.filter(tab=ton)[:5])
print('tonnage recs:', [(r.id, r.outputs.get('dry_tonnage')) for r in ton_recs])
lines = list(fac.lines.all())[:2]
ctr = list(fac.contractors.all())[:1]
today = date.today()

def mk(payload, label):
    r = c.post('/api/factory-tab-records/', payload, format='json')
    print(label, '->', r.status_code, str(r.data)[:260])
    return r

base = dict(tab=perf.id, line=lines[0].id, contractor=ctr[0].id,
            date_from=str(today), date_to=str(today),
            inputs={'feed_fe': 45.0, 'product_fe': 62.0, 'sio2': 6.0, 'method': 'مغناطیسی'})

print()
print('=== 1) بدون linked_records (میانگین هم‌بازه) ===')
r1 = mk(base, 'avg-mode')
REC_MEAN = r1.data['id'] if r1.status_code == 201 else None
if r1.status_code == 201:
    print('   tonnage_ref =', r1.data['outputs'].get('tonnage_ref'))

print()
print('=== 2) با رکورد خاص تب دیگر ===')
target = ton_recs[0]
want = target.outputs.get('dry_tonnage')
r2 = mk({**base, 'linked_records': {'mega_tonnage': target.id}},
        'linked to tonnage#%s dry=%s' % (target.id, want))
if r2.status_code == 201:
    ref = r2.data['outputs'].get('tonnage_ref')
    print('   tonnage_ref =', ref, ' expected ~', (want * 0.1 + (62.0 / 45.0 * 100 * (1 - 6.0 / 200))))
    print('   detail =', str(r2.data.get('linked_records_detail'))[:200])

print()
print('=== 3) خطاها ===')
mk({**base, 'linked_records': {'mega_tonnage': 999999}}, 'bad record id -> expect 400')
mk({**base, 'linked_records': {'nope_tab': 1}}, 'bad tab key -> expect 400')
if REC_MEAN:
    mk({**base, 'linked_records': {'mega_tonnage': REC_MEAN}}, 'record from wrong tab -> expect 400')

print()
print('=== 4) schema cross_tabs ===')
r = c.get('/api/factory-tabs/%s/schema/' % perf.id)
print('cross_tabs =', r.data.get('cross_tabs'))

print()
print('=== 5) فرمول بدون ارجاع بین‌تبی (تب shift) هنوز سالم است؟ ===')
shift = FactoryTab.objects.get(factory=fac, key='mega-shift')
rs = c.post('/api/factory-tab-records/', {
    'tab': shift.id, 'date_from': str(today), 'date_to': str(today),
    'inputs': {'downtime_h': 1.5, 'shift_name': 'صبح', 'status': 'عادی', 'overtime': 0.5},
}, format='json')
print('shift record ->', rs.status_code, str(rs.data)[:160])

print()
print('=== 6) فرمول ارجاع‌دار ولی هیچ رکوردی در تب مقصد نیست ===')
perf2 = FactoryTab.objects.get(factory=fac, key='mega-performance')
r6 = c.post('/api/factory-tab-records/', {
    'tab': perf2.id, 'line': lines[1].id, 'date_from': str(today - timedelta(days=900)),
    'date_to': str(today - timedelta(days=900)),
    'inputs': {'feed_fe': 45.0, 'product_fe': 62.0, 'sio2': 6.0, 'method': 'مغناطیسی'},
}, format='json')
print('far-range no-match ->', r6.status_code, str(r6.data)[:200])
