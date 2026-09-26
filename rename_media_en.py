import os, re, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from machines.models import Device

BASE = os.path.join(os.path.dirname(__file__), 'media', 'devices')

def slug_en(name):
    s = (name or '').strip().lower()
    # feeder / hydrocone / jaw by device name
    if 'feeder' in s or 'فیدر' in (name or ''):
        return 'feeder'
    if 'hydrocone' in s or 'gyratory' in s or 'هیدروکن' in (name or '') or 'مخروطی' in (name or ''):
        return 'hydrocone'
    if 'jaw' in s or 'فکی' in (name or ''):
        return 'jaw-crusher'
    return None

count = 0
for dev in Device.objects.select_related('template').all():
    cur = (dev.image.name if dev.image else '') or ''
    base = os.path.basename(cur)
    # only v4 farsi-named targets
    if not base.startswith('dev_%d_' % dev.id) and cur and not base.endswith('_v4.svg'):
        continue
    tpl = (dev.template.name if dev.template_id else '')
    tmap = {'سنگ‌شکن': 'crusher', 'آسیای گلوله‌ای': 'ball-mill', 'سرند ارتعاشی': 'vibrating-screen','سپراتور مغناطیسی': 'drum-separator', 'نوار نقاله': 'conveyor', 'فیلتر پرس': 'filter-press','تیکنر': 'thickener', 'سلول فلوتاسیون': 'flotation-cell', 'هیدروسیکلون': 'hydrocyclone','خشک‌کن': 'dryer', 'آنالایزر پرتونگاری': 'analyzer'}
    key = tmap.get(tpl.strip(), 'device')
    hint = slug_en(dev.name)
    suffix = hint if hint else ('%s-%s' % (key, slug_en(dev.name) or str(dev.id)))
    if key == 'crusher' and not hint:
        suffix = 'cone-crusher'
    newname = 'device-%03d-%s.svg' % (dev.id, suffix)
    oldpath = os.path.join(BASE, base) if base else None
    newpath = os.path.join(BASE, newname)
    if oldpath and os.path.exists(oldpath) and oldpath != newpath:
        os.replace(oldpath, newpath)
    elif not (oldpath and os.path.exists(oldpath)):
        print('missing file for device', dev.id, base)
        continue
    dev.image = 'devices/' + newname
    dev.save(update_fields=['image'])
    count += 1

# cleanup old v1/v2/v3 leftovers dev_<id>_*
for f in os.listdir(BASE):
    if f.startswith('dev_'):
        try: os.remove(os.path.join(BASE, f))
        except: pass
print('renamed', count)
