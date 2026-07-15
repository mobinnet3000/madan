"""بارگذاری داده‌های نمونه غنی: 4 کارخانه، 3 ماه داده متنوع، تصاویر دستگاه، کاربران."""
import os, random, django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.files import File
from machines.models import (
    Factory, Shift, FailureReason, ProductionLineAttribute,
    ProductionLineTemplate, ProductionLine, Attribute, DeviceTemplate,
    Device, DeviceLog, DeviceDailyAnalysis, LINE_TYPE_CHOICES,
)
from accounts.models import UserProfile
from django.contrib.auth.models import User

MEDIA = os.path.join(os.path.dirname(__file__), 'media', 'devices')
os.makedirs(MEDIA, exist_ok=True)

ICON_COLORS = {
    'crusher': ('#f97316', '#c2410c'),
    'mill': ('#0ea5e9', '#075985'),
    'screen': ('#10b981', '#047857'),
    'magnet': ('#8b5cf6', '#6d28d9'),
    'conveyor': ('#64748b', '#334155'),
    'filter': ('#14b8a6', '#0f766e'),
    'tank': ('#6366f1', '#4338ca'),
    'flotation': ('#ec4899', '#be185d'),
    'flask': ('#f43f5e', '#be123c'),
    'cyclone': ('#f59e0b', '#b45309'),
    'dryer': ('#84cc16', '#4d7c0f'),
    'gear': ('#475569', '#1e293b'),
}

def icon_svg(icon):
    if icon == 'crusher':
        return '<polygon points="120,58 165,128 75,128" fill="rgba(255,255,255,0.92)"/><rect x="68" y="128" width="104" height="14" rx="6" fill="rgba(255,255,255,0.7)"/>'
    if icon == 'mill':
        return '<ellipse cx="120" cy="64" rx="44" ry="14" fill="rgba(255,255,255,0.92)"/><rect x="76" y="64" width="88" height="64" fill="rgba(255,255,255,0.85)"/><line x1="76" y1="96" x2="164" y2="96" stroke="rgba(0,0,0,0.15)" stroke-width="3"/>'
    if icon == 'screen':
        return ''.join('<rect x="80" y="%d" width="80" height="10" rx="5" fill="rgba(255,255,255,0.9)"/>' % (60+i*16) for i in range(4))
    if icon == 'magnet':
        return '<path d="M96 60 h13 v42 a14 14 0 0 0 28 0 v-42 h13 v42 a27 27 0 0 1 -54 0 z" fill="rgba(255,255,255,0.92)"/><rect x="96" y="54" width="13" height="9" fill="#fff"/><rect x="124" y="54" width="13" height="9" fill="#fff"/>'
    if icon == 'conveyor':
        return '<rect x="58" y="98" width="124" height="16" rx="8" fill="rgba(255,255,255,0.92)"/><circle cx="78" cy="106" r="14" fill="#fff"/><circle cx="162" cy="106" r="14" fill="#fff"/><rect x="96" y="72" width="48" height="22" rx="4" fill="rgba(255,255,255,0.7)"/>'
    if icon == 'filter':
        return '<rect x="80" y="58" width="80" height="40" rx="8" fill="rgba(255,255,255,0.92)"/><polygon points="80,98 200,98 150,128 130,128" fill="rgba(255,255,255,0.8)"/>'
    if icon == 'tank':
        return '<circle cx="120" cy="102" r="44" fill="rgba(255,255,255,0.92)"/><circle cx="120" cy="102" r="22" fill="rgba(0,0,0,0.12)"/><rect x="112" y="44" width="16" height="22" fill="rgba(255,255,255,0.8)"/>'
    if icon == 'flotation':
        return '<rect x="78" y="70" width="84" height="58" rx="10" fill="rgba(255,255,255,0.92)"/><circle cx="104" cy="94" r="7" fill="rgba(0,0,0,0.15)"/><circle cx="124" cy="108" r="9" fill="rgba(0,0,0,0.15)"/><circle cx="146" cy="92" r="6" fill="rgba(0,0,0,0.15)"/>'
    if icon == 'flask':
        return '<path d="M104 58 h32 l-6 22 v40 a8 8 0 0 1 -8 8 h-4 a8 8 0 0 1 -8 -8 v-40 z" fill="rgba(255,255,255,0.92)"/><rect x="100" y="52" width="40" height="8" rx="4" fill="#fff"/>'
    if icon == 'cyclone':
        return '<path d="M120 56 a40 40 0 1 1 -28 12 l24 24 z" fill="rgba(255,255,255,0.92)"/><circle cx="120" cy="104" r="10" fill="#fff"/>'
    if icon == 'dryer':
        return '<rect x="76" y="62" width="88" height="56" rx="12" fill="rgba(255,255,255,0.92)"/><line x1="92" y1="62" x2="92" y2="118" stroke="rgba(0,0,0,0.12)" stroke-width="3"/><line x1="120" y1="62" x2="120" y2="118" stroke="rgba(0,0,0,0.12)" stroke-width="3"/><line x1="148" y1="62" x2="148" y2="118" stroke="rgba(0,0,0,0.12)" stroke-width="3"/>'
    return '<circle cx="120" cy="100" r="46" fill="rgba(255,255,255,0.92)"/><circle cx="120" cy="100" r="30" fill="rgba(0,0,0,0.1)"/><circle cx="120" cy="100" r="14" fill="rgba(255,255,255,0.9)"/>'

def make_image(filename, label, icon):
    c1, c2 = ICON_COLORS.get(icon, ICON_COLORS['gear'])
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 170">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>'
        '<rect width="240" height="170" rx="18" fill="url(#g)"/>'
        '%s'
        '<text x="120" y="158" font-family="Vazirmatn, Tahoma, sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">%s</text>'
        '</svg>' % (c1, c2, icon_svg(icon), label)
    )
    path = os.path.join(MEDIA, filename)
    with open(path, 'wb') as f:
        f.write(svg.encode('utf-8'))
    return 'devices/' + filename

# پاکسازي
for m in (DeviceDailyAnalysis, DeviceLog, Device, ProductionLine, Shift,
          FailureReason, ProductionLineTemplate, ProductionLineAttribute,
          DeviceTemplate, Attribute, Factory):
    m.objects.all().delete()
UserProfile.objects.all().delete()
User.objects.exclude(is_superuser=True).delete()

# ويژگي‌ها و الگوها
la_cap = ProductionLineAttribute.objects.create(name='ظرفیت تولید', unit='تن/ساعت')
la_len = ProductionLineAttribute.objects.create(name='طول خط', unit='متر')
la_stn = ProductionLineAttribute.objects.create(name='تعداد ایستگاه', unit='عدد')
da_pow = Attribute.objects.create(name='توان', unit='کیلووات')
da_rpm = Attribute.objects.create(name='دور', unit='RPM')
da_cap = Attribute.objects.create(name='ظرفیت', unit='تن/ساعت')

def line_tpl(name):
    t = ProductionLineTemplate.objects.create(name=name, description=name)
    t.available_attributes.set([la_cap, la_len, la_stn])
    return t

def dev_tpl(name, attrs):
    t = DeviceTemplate.objects.create(name=name)
    t.available_attributes.set(attrs)
    return t

lt_crush = line_tpl('الگوی خط خردایش')
lt_proc = line_tpl('الگوی خط فرآوری')
dt_crusher = dev_tpl('سنگ‌شکن', [da_pow, da_cap])
dt_mill = dev_tpl('آسیای گلوله‌ای', [da_pow, da_rpm])
dt_screen = dev_tpl('سرند ارتعاشی', [da_pow])
dt_mag = dev_tpl('سپراتور مغناطیسی', [da_pow, da_cap])
dt_conv = dev_tpl('نوار نقاله', [da_pow])
dt_filter = dev_tpl('فیلتر پرس', [da_pow])
dt_thick = dev_tpl('تیکنر', [da_pow])
dt_flot = dev_tpl('سلول فلوتاسیون', [da_pow, da_cap])
dt_cyclone = dev_tpl('هیدروسیکلون', [da_pow])
dt_dry = dev_tpl('خشک‌کن', [da_pow])
dt_an = dev_tpl('آنالایزر پرتونگاری', [da_pow])

TEMPLATE_ICON = {
    'سنگ‌شکن': 'crusher', 'آسیای گلوله‌ای': 'mill', 'سرند ارتعاشی': 'screen',
    'سپراتور مغناطیسی': 'magnet', 'نوار نقاله': 'conveyor', 'فیلتر پرس': 'filter',
    'تیکنر': 'tank', 'سلول فلوتاسیون': 'flotation', 'هیدروسیکلون': 'cyclone',
    'خشک‌کن': 'dryer', 'آنالایزر پرتونگاری': 'flask',
}

def slug(s):
    return ''.join(c for c in s if c.isalnum()).lower()[:18] or 'dev'

factories_data = [
    {
        'name': 'مجتمع معدنی سنگ‌آهن مرکزی',
        'address': 'استان یزد، بافق - کیلومتر ۲۵ جاده معدن',
        'lines': [
            ('خط خردایش ۱', 'crushing', {'ظرفیت تولید': 170, 'طول خط': 320, 'تعداد ایستگاه': 4},
             [('سنگ‌شکن فکی', dt_crusher, 1, {'توان': 220, 'ظرفیت': 185}, False),
              ('آسیای مخروطی', dt_crusher, 2, {'توان': 315, 'ظرفیت': 200}, False),
              ('سرند اولیه', dt_screen, 3, {'توان': 30}, False),
              ('نوار نقاله ورودی', dt_conv, 4, {'توان': 22}, False)]),
            ('خط خردایش ۲', 'crushing', {'ظرفیت تولید': 150, 'طول خط': 280, 'تعداد ایستگاه': 3},
             [('سنگ‌شکن ضربه‌ای', dt_crusher, 1, {'توان': 160, 'ظرفیت': 160}, False),
              ('سرند ثانویه', dt_screen, 2, {'توان': 28}, False),
              ('نوار نقاله', dt_conv, 3, {'توان': 18}, False)]),
            ('خط فرآوری', 'processing', {'ظرفیت تولید': 165, 'طول خط': 410, 'تعداد ایستگاه': 5},
             [('آسیای گلوله‌ای', dt_mill, 1, {'توان': 3500, 'دور': 18.5}, False),
              ('سپراتور مغناطیسی', dt_mag, 2, {'توان': 95, 'ظرفیت': 160}, False),
              ('تیکنر', dt_thick, 3, {'توان': 45}, False),
              ('فیلتر پرس', dt_filter, 4, {'توان': 37}, False),
              ('آنالایزر پرتونگاری', dt_an, 5, {'توان': 5}, True)]),
        ],
    },
    {
        'name': 'کارخانه فرآوری مس سرچشمه',
        'address': 'استان کرمان، شهربابک - مجتمع مس سرچشمه',
        'lines': [
            ('خط خردایش', 'crushing', {'ظرفیت تولید': 220, 'طول خط': 360, 'تعداد ایستگاه': 3},
             [('سنگ‌شکن فکی', dt_crusher, 1, {'توان': 260, 'ظرفیت': 240}, False),
              ('آسیای ژیراتوری', dt_crusher, 2, {'توان': 480, 'ظرفیت': 260}, False),
              ('سرند ارتعاشی', dt_screen, 3, {'توان': 40}, False)]),
            ('خط فلوتاسیون', 'processing', {'ظرفیت تولید': 210, 'طول خط': 480, 'تعداد ایستگاه': 5},
             [('آسیای گلوله‌ای', dt_mill, 1, {'توان': 4200, 'دور': 16}, False),
              ('هیدروسیکلون', dt_cyclone, 2, {'توان': 55}, False),
              ('سلول فلوتاسیون', dt_flot, 3, {'توان': 120, 'ظرفیت': 200}, False),
              ('تیکنر', dt_thick, 4, {'توان': 60}, False),
              ('آنالایزر پرتونگاری', dt_an, 5, {'توان': 6}, True)]),
        ],
    },
    {
        'name': 'کارخانه کنسانتره زغال‌سنگ',
        'address': 'استان طبس - منطقه پروده',
        'lines': [
            ('خط خردایش', 'crushing', {'ظرفیت تولید': 120, 'طول خط': 240, 'تعداد ایستگاه': 2},
             [('سنگ‌شکن فکی', dt_crusher, 1, {'توان': 185, 'ظرفیت': 130}, False),
              ('سرند ارتعاشی', dt_screen, 2, {'توان': 25}, False)]),
            ('خط شستشو و فرآوری', 'processing', {'ظرفیت تولید': 110, 'طول خط': 360, 'تعداد ایستگاه': 4},
             [('تیکنر', dt_thick, 1, {'توان': 50}, False),
              ('فیلتر پرس', dt_filter, 2, {'توان': 33}, False),
              ('خشک‌کن', dt_dry, 3, {'توان': 70}, False),
              ('آنالایزر پرتونگاری', dt_an, 4, {'توان': 4}, True)]),
        ],
    },
    {
        'name': 'کارخانه فلوتاسیون سرب و روی',
        'address': 'استان زنجان - انگوران',
        'lines': [
            ('خط خردایش', 'crushing', {'ظرفیت تولید': 140, 'طول خط': 300, 'تعداد ایستگاه': 3},
             [('سنگ‌شکن فکی', dt_crusher, 1, {'توان': 200, 'ظرفیت': 150}, False),
              ('آسیای مخروطی', dt_crusher, 2, {'توان': 290, 'ظرفیت': 170}, False),
              ('سرند ارتعاشی', dt_screen, 3, {'توان': 30}, False)]),
            ('خط فلوتاسیون ۱', 'processing', {'ظرفیت تولید': 130, 'طول خط': 420, 'تعداد ایستگاه': 4},
             [('آسیای گلوله‌ای', dt_mill, 1, {'توان': 3100, 'دور': 19}, False),
              ('سلول فلوتاسیون', dt_flot, 2, {'توان': 95, 'ظرفیت': 130}, False),
              ('تیکنر', dt_thick, 3, {'توان': 40}, False),
              ('آنالایزر پرتونگاری', dt_an, 4, {'توان': 5}, True)]),
            ('خط فلوتاسیون ۲', 'processing', {'ظرفیت تولید': 135, 'طول خط': 430, 'تعداد ایستگاه': 4},
             [('آسیای گلوله‌ای', dt_mill, 1, {'توان': 3200, 'دور': 19}, False),
              ('سلول فلوتاسیون', dt_flot, 2, {'توان': 98, 'ظرفیت': 135}, False),
              ('تیکنر', dt_thick, 3, {'توان': 42}, False),
              ('آنالایزر پرتونگاری', dt_an, 4, {'توان': 5}, True)]),
        ],
    },
]

shifts_def = [('شیفت صبح', '06:00', '14:00'), ('شیفت عصر', '14:00', '22:00'), ('شیفت شب', '22:00', '06:00')]
failures_def = ['برقی', 'مکانیکی', 'توقف تأمین مواد', 'تعمیرات برنامه‌ریزی شده', 'افت کیفیت محصول', 'قطعی آب']

random.seed(7)
factories = []
for fd in factories_data:
    fac = Factory.objects.create(name=fd['name'], address=fd['address'])
    shifts = [Shift.objects.create(factory=fac, name=n, start_time=s, end_time=e, is_active=True) for n, s, e in shifts_def]
    failures = [FailureReason.objects.create(title=t) for t in failures_def]
    analyzers = []
    for lname, ltype, lattrs, devs in fd['lines']:
        line = ProductionLine.objects.create(
            name=lname, factory=fac, line_type=ltype,
            template=lt_crush if ltype == 'crushing' else lt_proc,
            description='خط %s کارخانه %s' % (lname, fd['name']),
            attributes_values=lattrs,
        )
        for dname, dtpl, order, dattrs, is_an in devs:
            icon = TEMPLATE_ICON.get(dtpl.name, 'gear')
            img = make_image('%s_%s.svg' % (slug(fac.name), slug(dname)), dname, icon)
            d = Device.objects.create(
                name=dname, line=line, template=dtpl, order=order,
                attributes_values=dattrs, is_analyzer=is_an, image=img,
            )
            if is_an:
                analyzers.append(d)
    factories.append((fac, shifts, failures, analyzers))

# گزارش‌های ۹۲ روزه با حالات متنوع
today = date.today()
down_reasons = [
    ('توقف برنامه‌ریزی شده جهت تعمیرات اساسی', 'بازدید و تعویض قطعات فرسوده انجام شد'),
    ('قطعی برق کارخانه', 'تغذیه برق پس از رفع ایراد شبکه وصل شد'),
    ('نبود مواد اولیه در انبار', 'هماهنگی با معدن برای ارسال خوراک'),
    ('خرابی پمپ هیدرولیک', 'پمپ تعمیر و روغن‌کاری گردید'),
]
log_total = 0
for fac, shifts, failures, analyzers in factories:
    lines = list(fac.lines.all())
    for line in lines:
        devices = list(line.devices.all())
        down_until = None
        for i in range(92):
            d = today - timedelta(days=i)
            # دوره خاموشي برنامه‌ريزي شده
            if down_until is None and random.random() < 0.05:
                down_until = d - timedelta(days=random.randint(1, 3))
            line_down = (down_until is not None and d <= down_until)
            for s in shifts:
                if line_down:
                    reason, repair = random.choice(down_reasons)
                    fr = random.choice(failures)
                    DeviceLog.objects.create(
                        line=line, shift=s, date=d, device=None,
                        failure_cause=fr, runtime_hours=0, downtime_hours=8,
                        feed_tonnage=0, product_tonnage=0, tailing_tonnage=0,
                        failure_description=reason, repair_description=repair,
                    )
                else:
                    feed = random.randint(1200, 1800)
                    ratio = random.uniform(0.58, 0.76)
                    product = int(feed * ratio)
                    tailing = feed - product
                    runtime = random.choice([7.5, 8.0])
                    downtime = 0
                    fr = None; fdesc = ''; rdesc = ''
                    if random.random() < 0.12:
                        downtime = random.choice([0.5, 1, 1.5, 2])
                        fr = random.choice(failures)
                        fdesc = 'توقف کوتاه جهت رفع عیب'
                        rdesc = 'تنظیم و راه‌اندازی مجدد'
                    dev = random.choice(devices) if random.random() < 0.4 else None
                    DeviceLog.objects.create(
                        line=line, shift=s, date=d, device=dev,
                        failure_cause=fr, runtime_hours=runtime, downtime_hours=downtime,
                        feed_tonnage=feed, product_tonnage=product, tailing_tonnage=tailing,
                        failure_description=fdesc, repair_description=rdesc,
                    )
                log_total += 1
    # آنالیزها در نقاط خوراک/باطله/محصول
    points_cfg = {
        'feed': (0, (58, 63), (2, 5), 'عیار خوراک در محدوده پایدار'),
        'tailing': (2, (4, 9), (1, 3), 'عیار باطله کنترل شده'),
        'product': (1, (60, 66), (1, 4), 'کنسانتره با کیفیت مطلوب'),
    }
    for an in analyzers:
        for i in range(92):
            d = today - timedelta(days=i)
            for point, (sidx, v1r, v2r, txt) in points_cfg.items():
                DeviceDailyAnalysis.objects.create(
                    device=an, sample_point=point, shift=shifts[sidx],
                    date=d, value_1=round(random.uniform(*v1r), 1),
                    value_2=round(random.uniform(*v2r), 1), analysis_text=txt,
                )

# کاربران نقش‌بندي شده
User.objects.filter(username='admin').delete()
admin_u = User.objects.create_superuser('admin', 'admin@madan.ir', 'Madan@1404')
UserProfile.objects.create(user=admin_u, role='admin', factory=None)

idx = 0
for fac, shifts, failures, analyzers in factories:
    idx += 1
    mu = User.objects.create_user('manager%d' % idx, 'manager%d@madan.ir' % idx, 'Madan@1404', first_name='مدیر', last_name='کارخانه %d' % idx)
    UserProfile.objects.create(user=mu, role='manager', factory=fac)
    ou = User.objects.create_user('operator%d' % idx, 'operator%d@madan.ir' % idx, 'Madan@1404', first_name='اپراتور', last_name='خط %d' % idx)
    UserProfile.objects.create(user=ou, role='operator', factory=fac)

print('OK - seed done')
print('Factories:', Factory.objects.count())
print('Lines:', ProductionLine.objects.count(), '| Devices:', Device.objects.count(), '| Analyzers:', Device.objects.filter(is_analyzer=True).count())
print('Logs:', DeviceLog.objects.count())
print('Analyses:', DeviceDailyAnalysis.objects.count())
print('Users:', User.objects.count())
