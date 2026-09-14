import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from machines.models import Device

BASE = os.path.join(os.path.dirname(__file__), 'media', 'devices')
os.makedirs(BASE, exist_ok=True)

PALETTE = {
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

TEMPLATE_ICON = {
    'سنگ‌شکن': 'crusher', 'آسیای گلوله‌ای': 'mill', 'سرند ارتعاشی': 'screen',
    'سپراتور مغناطیسی': 'magnet', 'نوار نقاله': 'conveyor', 'فیلتر پرس': 'filter',
    'تیکنر': 'tank', 'سلول فلوتاسیون': 'flotation', 'هیدروسیکلون': 'cyclone',
    'خشک‌کن': 'dryer', 'آنالایزر پرتونگاری': 'flask',
}

def icon_for(device):
    tpl_name = (device.template.name if device.template_id else '').strip()
    return TEMPLATE_ICON.get(tpl_name, 'gear')

def slug(s):
    return ''.join(c for c in s if c.isalnum()).lower()[:20] or 'dev'

updated = 0
for dev in Device.objects.select_related('template', 'line').all():
    if dev.image:
        continue
    icon = icon_for(dev)
    c1, c2 = PALETTE.get(icon, PALETTE['gear'])
    fname = 'dev_%d_%s.svg' % (dev.id, slug(dev.name))
    fpath = os.path.join(BASE, fname)
    if not os.path.exists(fpath):
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 170">'
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs>'
            '<rect width="240" height="170" rx="18" fill="url(#g)"/>'
            '%s'
            '</svg>' % (c1, c2, icon_svg(icon))
        )
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(svg)
    dev.image = 'devices/' + fname
    dev.save(update_fields=['image'])
    updated += 1

print('updated', updated, 'total', Device.objects.count())
print('with image', Device.objects.exclude(image='').exclude(image__isnull=True).count())
