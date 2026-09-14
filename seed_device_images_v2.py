import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from machines.models import Device

BASE = os.path.join(os.path.dirname(__file__), 'media', 'devices')
os.makedirs(BASE, exist_ok=True)

# ــ industrial svg per type — richer, more realistic
def svg_crusher(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>
<linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<!-- feed hopper -->
<path d="M62 44 L178 44 L162 62 L78 62 Z" fill="url(#steel)" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
<rect x="78" y="62" width="84" height="4" rx="2" fill="#334155" opacity="0.9"/>
<!-- crushing chamber -->
<path d="M78 66 L162 66 L148 122 L92 122 Z" fill="#1e293b" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
<!-- mantle -->
<path d="M120 68 L138 118 L102 118 Z" fill="#f1f5f9" stroke="#0f172a" stroke-width="0.8" opacity="0.96"/>
<line x1="120" y1="68" x2="120" y2="118" stroke="#0f172a" stroke-width="0.6" opacity="0.5"/>
<!-- discharge -->
<rect x="84" y="122" width="72" height="10" rx="3" fill="#334155"/>
<rect x="96" y="132" width="48" height="6" rx="3" fill="rgba(255,255,255,0.75)"/>
<!-- frame -->
<rect x="62" y="138" width="116" height="8" rx="4" fill="rgba(0,0,0,0.25)"/>
<rect x="70" y="136" width="100" height="2" rx="1" fill="rgba(255,255,255,0.35)"/>
'''

def svg_mill(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<!-- drum -->
<ellipse cx="120" cy="96" rx="66" ry="34" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="8"/>
<ellipse cx="120" cy="96" rx="66" ry="34" fill="#f8fafc" stroke="#0f172a" stroke-width="1.2"/>
<ellipse cx="120" cy="96" rx="66" ry="34" fill="none" stroke="#0f172a" stroke-width="0.6" opacity="0.25"/>
<ellipse cx="86" cy="96" rx="10" ry="16" fill="#334155" stroke="rgba(255,255,255,0.5)" stroke-width="0.8"/>
<ellipse cx="154" cy="96" rx="10" ry="16" fill="#334155" stroke="rgba(255,255,255,0.5)" stroke-width="0.8"/>
<!-- liner bolts -->
<circle cx="120" cy="72" r="3" fill="#0f172a" opacity="0.55"/><circle cx="142" cy="80" r="3" fill="#0f172a" opacity="0.55"/><circle cx="142" cy="112" r="3" fill="#0f172a" opacity="0.55"/><circle cx="120" cy="120" r="3" fill="#0f172a" opacity="0.55"/><circle cx="98" cy="112" r="3" fill="#0f172a" opacity="0.55"/><circle cx="98" cy="80" r="3" fill="#0f172a" opacity="0.55"/>
<!-- support -->
<rect x="52" y="128" width="136" height="8" rx="4" fill="rgba(0,0,0,0.28)"/>
'''

def svg_screen(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<rect x="56" y="52" width="128" height="82" rx="10" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
<g stroke="rgba(15,23,42,0.2)" stroke-width="0.7">
<line x1="64" y1="68" x2="176" y2="68"/><line x1="64" y1="84" x2="176" y2="84"/><line x1="64" y1="100" x2="176" y2="100"/><line x1="64" y1="116" x2="176" y2="116"/>
<line x1="78" y1="56" x2="78" y2="130"/><line x1="100" y1="56" x2="100" y2="130"/><line x1="122" y1="56" x2="122" y2="130"/><line x1="144" y1="56" x2="144" y2="130"/><line x1="166" y1="56" x2="166" y2="130"/>
</g>
<circle cx="72" cy="124" r="5" fill="white" opacity="0.9"/><circle cx="168" cy="124" r="5" fill="white" opacity="0.9"/>
<rect x="62" y="134" width="116" height="6" rx="3" fill="rgba(0,0,0,0.22)"/>
'''

def svg_magnet(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<rect x="78" y="46" width="84" height="18" rx="4" fill="#e2e8f0" stroke="rgba(0,0,0,0.15)" stroke-width="0.8"/>
<path d="M88 64 H101 V110 A12 12 0 0 0 125 122 A12 12 0 0 0 137 110 V64 H150 V110 A25 25 0 0 1 100 135 A25 25 0 0 1 88 110 Z" fill="#f8fafc" stroke="#0f172a" stroke-width="1"/>
<rect x="88" y="62" width="13" height="4" rx="1" fill="#ef4444"/><rect x="137" y="62" width="13" height="4" rx="1" fill="#3b82f6"/>
<rect x="96" y="136" width="48" height="6" rx="2" fill="rgba(255,255,255,0.65)"/>
'''

def svg_conveyor(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<rect x="36" y="102" width="168" height="10" rx="5" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
<line x1="52" y1="107" x2="188" y2="107" stroke="#0f172a" stroke-width="0.6" opacity="0.25" stroke-dasharray="8 6"/>
<circle cx="62" cy="112" r="16" fill="none" stroke="#0f172a" stroke-width="1.1"/><circle cx="62" cy="112" r="5" fill="#0f172a"/>
<circle cx="178" cy="112" r="16" fill="none" stroke="#0f172a" stroke-width="1.1"/><circle cx="178" cy="112" r="5" fill="#0f172a"/>
<rect x="86" y="78" width="68" height="20" rx="4" fill="rgba(255,255,255,0.88)" stroke="rgba(0,0,0,0.12)" stroke-width="0.8"/>
<line x1="98" y1="78" x2="98" y2="98" stroke="rgba(0,0,0,0.12)" stroke-width="0.7"/><line x1="122" y1="78" x2="122" y2="98" stroke="rgba(0,0,0,0.12)" stroke-width="0.7"/><line x1="142" y1="78" x2="142" y2="98" stroke="rgba(0,0,0,0.12)" stroke-width="0.7"/>
'''

def svg_filter(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<rect x="58" y="54" width="124" height="56" rx="8" fill="#f8fafc" stroke="#0f172a" stroke-width="0.9"/>
<g stroke="#0f172a" stroke-width="0.55" opacity="0.22">
<line x1="76" y1="54" x2="76" y2="110"/><line x1="94" y1="54" x2="94" y2="110"/><line x1="112" y1="54" x2="112" y2="110"/><line x1="130" y1="54" x2="130" y2="110"/><line x1="148" y1="54" x2="148" y2="110"/><line x1="166" y1="54" x2="166" y2="110"/>
</g>
<path d="M58 110 L182 110 L162 132 L78 132 Z" fill="#f1f5f9" stroke="#0f172a" stroke-width="0.7"/>
<rect x="108" y="132" width="24" height="7" rx="2" fill="rgba(0,0,0,0.22)"/>
'''

def svg_tank(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>
<radialGradient id="liq" cx="50%" cy="38%"><stop offset="0" stop-color="rgba(255,255,255,0.45)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="62" rx="52" ry="16" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.9"/>
<rect x="68" y="62" width="104" height="58" fill="#f8fafc" stroke="#0f172a" stroke-width="0.9"/>
<ellipse cx="120" cy="120" rx="52" ry="16" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.9"/>
<ellipse cx="120" cy="96" rx="38" ry="18" fill="#38bdf8" opacity="0.45"/>
<ellipse cx="120" cy="96" rx="38" ry="18" fill="url(#liq)"/>
<rect x="114" y="36" width="12" height="18" rx="2" fill="#cbd5e1" stroke="#0f172a" stroke-width="0.7"/>
<circle cx="120" cy="96" r="4" fill="#0f172a" opacity="0.9"/>
<line x1="120" y1="70" x2="120" y2="92" stroke="#0f172a" stroke-width="1.1" opacity="0.5"/>
'''

def svg_flotation(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<rect x="60" y="64" width="120" height="62" rx="10" fill="#f8fafc" stroke="#0f172a" stroke-width="0.9"/>
<line x1="60" y1="96" x2="180" y2="96" stroke="#0f172a" stroke-width="0.6" opacity="0.18"/>
<circle cx="92" cy="88" r="6" fill="none" stroke="#0f172a" stroke-width="0.7" opacity="0.25"/><circle cx="92" cy="88" r="2.5" fill="white" opacity="0.9"/>
<circle cx="120" cy="74" r="4" fill="none" stroke="#0f172a" stroke-width="0.7" opacity="0.25"/><circle cx="120" cy="74" r="1.6" fill="white" opacity="0.9"/>
<circle cx="148" cy="86" r="5" fill="none" stroke="#0f172a" stroke-width="0.7" opacity="0.25"/><circle cx="148" cy="86" r="2" fill="white" opacity="0.9"/>
<circle cx="112" cy="108" r="7" fill="none" stroke="#0f172a" stroke-width="0.7" opacity="0.25"/><circle cx="112" cy="108" r="3" fill="white" opacity="0.9"/>
<circle cx="138" cy="112" r="5" fill="none" stroke="#0f172a" stroke-width="0.7" opacity="0.25"/><circle cx="138" cy="112" r="2" fill="white" opacity="0.9"/>
<rect x="110" y="126" width="20" height="8" rx="2" fill="rgba(0,0,0,0.2)"/>
'''

def svg_flask(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<rect x="96" y="42" width="48" height="10" rx="3" fill="#f8fafc" stroke="#0f172a" stroke-width="0.8"/>
<path d="M108 52 H132 L126 88 C126 96 122 102 116 104 H124 C118 106 110 104 108 96 L102 52 Z" fill="rgba(248,250,252,0.95)" stroke="#0f172a" stroke-width="0.9"/>
<path d="M108 92 Q120 108 132 92 L128 102 Q120 114 112 102 Z" fill="#38bdf8" opacity="0.85" stroke="#0f172a" stroke-width="0.6"/>
<circle cx="118" cy="78" r="2" fill="white" opacity="0.85"/><circle cx="124" cy="84" r="1.4" fill="white" opacity="0.7"/>
'''

def svg_cyclone(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<path d="M78 52 H162 L154 94 L120 136 L86 94 Z" fill="#f8fafc" stroke="#0f172a" stroke-width="0.9"/>
<path d="M86 94 Q120 110 154 94" fill="none" stroke="#0f172a" stroke-width="0.6" opacity="0.22"/>
<path d="M120 64 L124 96 L120 128" fill="none" stroke="#0f172a" stroke-width="0.55" opacity="0.28" stroke-dasharray="4 4"/>
<rect x="78" y="52" width="84" height="10" rx="2" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.7"/>
<circle cx="122" cy="80" r="2" fill="#0f172a" opacity="0.12"/><circle cx="118" cy="100" r="2" fill="#0f172a" opacity="0.12"/>
'''

def svg_dryer(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<rect x="56" y="64" width="128" height="52" rx="16" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
<rect x="56" y="64" width="128" height="52" rx="16" fill="#f8fafc" stroke="#0f172a" stroke-width="0.9"/>
<ellipse cx="56" cy="90" rx="8" ry="26" fill="#cbd5e1" stroke="#0f172a" stroke-width="0.7"/>
<ellipse cx="184" cy="90" rx="8" ry="26" fill="#cbd5e1" stroke="#0f172a" stroke-width="0.7"/>
<g stroke="#0f172a" stroke-width="0.55" opacity="0.22">
<line x1="78" y1="66" x2="78" y2="114"/><line x1="96" y1="66" x2="96" y2="114"/><line x1="114" y1="66" x2="114" y2="114"/><line x1="132" y1="66" x2="132" y2="114"/><line x1="150" y1="66" x2="150" y2="114"/><line x1="168" y1="66" x2="168" y2="114"/>
</g>
<path d="M96 84 Q120 76 144 84" fill="none" stroke="#f59e0b" stroke-width="1.2" opacity="0.9" stroke-dasharray="3 3"/>
<circle cx="120" cy="82" r="2" fill="#f59e0b"/>
'''

def svg_gear(c1, c2):
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<g transform="translate(120,90)" stroke="#f8fafc" stroke-width="1" fill="none" opacity="0.95">
<circle r="28" fill="#f8fafc" stroke="#0f172a" stroke-width="1"/>
<circle r="12" fill="#0f172a" opacity="0.08"/><circle r="6" fill="#0f172a"/>
<g stroke-linecap="round" stroke="#0f172a" stroke-width="0.7" opacity="0.25">
<line x1="0" y1="-28" x2="0" y2="-40"/><line x1="20" y1="-20" x2="28" y2="-28"/><line x1="28" y1="0" x2="40" y2="0"/><line x1="20" y1="20" x2="28" y2="28"/><line x1="0" y1="28" x2="0" y2="40"/><line x1="-20" y1="20" x2="-28" y2="28"/><line x1="-28" y1="0" x2="-40" y2="0"/><line x1="-20" y1="-20" x2="-28" y2="-28"/>
</g>
</g>
'''

ICON_MAP = {
    'سنگ‌شکن': svg_crusher, 'آسیای گلوله‌ای': svg_mill, 'سرند ارتعاشی': svg_screen,
    'سپراتور مغناطیسی': svg_magnet, 'نوار نقاله': svg_conveyor, 'فیلتر پرس': svg_filter,
    'تیکنر': svg_tank, 'سلول فلوتاسیون': svg_flotation, 'هیدروسیکلون': svg_cyclone,
    'خشک‌کن': svg_dryer, 'آنالایزر پرتونگاری': svg_flask,
}
PALETTE = {
    'crusher': ('#f97316', '#c2410c'), 'mill': ('#0ea5e9', '#075985'), 'screen': ('#10b981', '#047857'),
    'magnet': ('#8b5cf6', '#6d28d9'), 'conveyor': ('#64748b', '#334155'), 'filter': ('#14b8a6', '#0f766e'),
    'tank': ('#6366f1', '#4338ca'), 'flotation': ('#ec4899', '#be185d'), 'flask': ('#f43f5e', '#be123c'),
    'cyclone': ('#f59e0b', '#b45309'), 'dryer': ('#84cc16', '#4d7c0f'), 'gear': ('#475569', '#1e293b'),
}
TEMPLATE_ICON = {'سنگ‌شکن': 'crusher', 'آسیای گلوله‌ای': 'mill', 'سرند ارتعاشی': 'screen','سپراتور مغناطیسی': 'magnet', 'نوار نقاله': 'conveyor', 'فیلتر پرس': 'filter','تیکنر': 'tank', 'سلول فلوتاسیون': 'flotation', 'هیدروسیکلون': 'cyclone','خشک‌کن': 'dryer', 'آنالایزر پرتونگاری': 'flask'}

def icon_for(dev):
    tpl = (dev.template.name if dev.template_id else '').strip()
    return TEMPLATE_ICON.get(tpl, 'gear')

def slug(s):
    return ''.join(c for c in s if c.isalnum()).lower()[:20] or 'dev'

count = 0
for dev in Device.objects.select_related('template', 'line').all():
    tpl_name = (dev.template.name if dev.template_id else '').strip()
    fn = ICON_MAP.get(tpl_name, svg_gear)
    icon_key = icon_for(dev)
    c1, c2 = PALETTE.get(icon_key, PALETTE['gear'])
    body = fn(c1, c2)
    # subtle device-specific offset to avoid identical duplicates on same template
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 170">{body}</svg>'
    fname = 'dev_%d_%s_v2.svg' % (dev.id, slug(dev.name))
    fpath = os.path.join(BASE, fname)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(svg)
    # remove old v1 files for same device
    for old in os.listdir(BASE):
        if old.startswith('dev_%d_' % dev.id) and old != fname:
            try: os.remove(os.path.join(BASE, old))
            except: pass
    dev.image = 'devices/' + fname
    dev.save(update_fields=['image'])
    count += 1

print('regenerated', count, 'devices, imaged', Device.objects.exclude(image='').count())
