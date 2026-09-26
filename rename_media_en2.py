import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from machines.models import Device
BASE = os.path.join(os.path.dirname(__file__), 'media', 'devices')
NAMES = {
    338: 'feeder-grizzly',
    339: 'jaw-crusher',
    340: 'conveyor-01',
    341: 'hydrocone-primary',
    342: 'vibrating-screen-01',
    343: 'conveyor-02',
    344: 'conveyor-03',
    345: 'drum-separator-low',
    346: 'drum-separator-high',
    347: 'conveyor-04',
    348: 'hydrocone-secondary',
    349: 'conveyor-05',
    350: 'conveyor-06',
    351: 'vibrating-screen-02',
    352: 'conveyor-07-product',
    353: 'conveyor-08-tailing',
}
n = 0
for dev in Device.objects.all().order_by('id'):
    key = NAMES.get(dev.id)
    if not key:
        continue
    newname = 'device-%03d-%s.svg' % (dev.id, key)
    old = (dev.image.name if dev.image else '') or ''
    oldbase = os.path.basename(old)
    oldpath = os.path.join(BASE, oldbase) if oldbase else None
    newpath = os.path.join(BASE, newname)
    if oldpath and os.path.exists(oldpath) and oldpath != newpath:
        os.replace(oldpath, newpath)
    elif newname != oldbase and not (oldpath and os.path.exists(oldpath)):
        print('skip missing', dev.id, oldbase)
        continue
    dev.image = 'devices/' + newname
    dev.save(update_fields=['image'])
    n += 1
print('renamed', n)
