import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from machines.models import Device
BASE = os.path.join(os.path.dirname(__file__), 'media', 'devices')
os.makedirs(BASE, exist_ok=True)

# unified tone — warm steel / slate industrial
C1, C2 = "#0f172a", "#334155"
STEEL = "#e2e8f0"
STEEL2 = "#94a3b8"
INK = "#0f172a"

def svg_jaw_crusher():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{STEEL}"/><stop offset="1" stop-color="{STEEL2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="58" ry="6" fill="black" opacity="0.22"/>
<!-- hopper -->
<path d="M54 34 L186 34 L170 54 L70 54 Z" fill="url(#s)" stroke="{INK}" stroke-width="0.9"/>
<line x1="90" y1="34" x2="98" y2="54" stroke="{INK}" stroke-width="0.45" opacity="0.20"/><line x1="150" y1="34" x2="142" y2="54" stroke="{INK}" stroke-width="0.45" opacity="0.20"/>
<rect x="70" y="52" width="100" height="6" rx="1" fill="#cbd5e1" stroke="{INK}" stroke-width="0.5"/>
<!-- fixed jaw (left) -->
<path d="M70 58 L96 58 L92 124 L70 124 Z" fill="#334155" stroke="{INK}" stroke-width="0.8"/>
<path d="M74 62 L92 62" stroke="{STEEL}" stroke-width="0.5" opacity="0.45"/><path d="M74 76 L92 76" stroke="{STEEL}" stroke-width="0.5" opacity="0.45"/><path d="M73 90 L91 90" stroke="{STEEL}" stroke-width="0.5" opacity="0.45"/><path d="M72 104 L90 104" stroke="{STEEL}" stroke-width="0.5" opacity="0.45"/><path d="M72 118 L90 118" stroke="{STEEL}" stroke-width="0.5" opacity="0.45"/>
<!-- movable jaw (right, angled) -->
<path d="M170 58 L144 58 L132 124 L158 124 Z" fill="#f8fafc" stroke="{INK}" stroke-width="0.85"/>
<path d="M166 62 L142 62" stroke="{INK}" stroke-width="0.38" opacity="0.14"/><path d="M162 76 L140 76" stroke="{INK}" stroke-width="0.38" opacity="0.14"/><path d="M158 90 L138 90" stroke="{INK}" stroke-width="0.38" opacity="0.14"/><path d="M154 104 L136 104" stroke="{INK}" stroke-width="0.38" opacity="0.14"/>
<!-- eccentric / pitman -->
<ellipse cx="158" cy="52" rx="10" ry="7" fill="#475569" stroke="{INK}" stroke-width="0.6"/>
<circle cx="158" cy="52" r="3" fill="{STEEL}"/>
<line x1="152" y1="58" x2="144" y2="68" stroke="{INK}" stroke-width="0.9" opacity="0.5"/>
<!-- toggle -->
<path d="M132 124 L148 138 L96 138 L92 124 Z" fill="rgba(0,0,0,0.28)" stroke="{INK}" stroke-width="0.5" opacity="0.6"/>
<!-- discharge -->
<rect x="88" y="138" width="56" height="4" rx="2" fill="rgba(255,255,255,0.45)"/>
'''

def svg_cone_crusher():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{STEEL}"/><stop offset="1" stop-color="{STEEL2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="58" ry="6" fill="black" opacity="0.22"/>
<path d="M56 36 L184 36 L168 58 L72 58 Z" fill="url(#s)" stroke="{INK}" stroke-width="0.9"/>
<line x1="92" y1="36" x2="100" y2="58" stroke="{INK}" stroke-width="0.45" opacity="0.20"/><line x1="148" y1="36" x2="140" y2="58" stroke="{INK}" stroke-width="0.45" opacity="0.20"/>
<path d="M72 58 L168 58 L158 70 L82 70 Z" fill="#cbd5e1" stroke="{INK}" stroke-width="0.6"/>
<rect x="82" y="68" width="76" height="2" rx="1" fill="{INK}" opacity="0.16"/>
<path d="M72 70 L168 70 L152 124 L88 124 Z" fill="#1e293b" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
<path d="M72 70 L88 124" stroke="rgba(255,255,255,0.20)" stroke-width="1.4"/><path d="M168 70 L152 124" stroke="rgba(255,255,255,0.10)" stroke-width="1.4"/>
<!-- bowl liner teeth -->
<path d="M76 70 L82 64 L88 70 L94 64 L100 70 L106 64 L112 70" fill="none" stroke="{STEEL}" stroke-width="0.52" opacity="0.5"/>
<!-- mantle cone -->
<path d="M120 72 L140 120 L100 120 Z" fill="#f8fafc" stroke="{INK}" stroke-width="0.9"/>
<ellipse cx="120" cy="120" rx="14" ry="3.2" fill="{INK}" opacity="0.14"/>
<path d="M120 72 L120 120" stroke="{INK}" stroke-width="0.55" opacity="0.38"/>
<g stroke="{INK}" stroke-width="0.36" opacity="0.15"><line x1="112" y1="82" x2="128" y2="82"/><line x1="108" y1="94" x2="132" y2="94"/><line x1="106" y1="106" x2="134" y2="106"/></g>
<rect x="84" y="124" width="72" height="10" rx="3" fill="#334155" stroke="{INK}" stroke-width="0.6"/>
<rect x="94" y="134" width="52" height="5" rx="2" fill="rgba(255,255,255,0.48)"/>
<rect x="56" y="142" width="128" height="8" rx="4" fill="rgba(0,0,0,0.30)"/>
<rect x="62" y="140" width="116" height="2" rx="1" fill="rgba(255,255,255,0.24)"/>
'''

def svg_crusher():
    return svg_cone_crusher()

def svg_mill():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="62" ry="6" fill="black" opacity="0.22"/>
<!-- drum outer -->
<ellipse cx="120" cy="94" rx="70" ry="36" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="8"/>
<ellipse cx="120" cy="94" rx="70" ry="36" fill="#f8fafc" stroke="{INK}" stroke-width="1.1"/>
<ellipse cx="120" cy="94" rx="70" ry="36" fill="none" stroke="{INK}" stroke-width="0.5" opacity="0.18"/>
<!-- trunnions -->
<ellipse cx="58" cy="94" rx="14" ry="20" fill="#334155" stroke="{INK}" stroke-width="0.8"/>
<ellipse cx="182" cy="94" rx="14" ry="20" fill="#334155" stroke="{INK}" stroke-width="0.8"/>
<ellipse cx="58" cy="94" rx="6" ry="10" fill="{INK}" opacity="0.22"/><ellipse cx="182" cy="94" rx="6" ry="10" fill="{INK}" opacity="0.22"/>
<!-- liner bolts ring -->
<circle cx="120" cy="70" r="2.8" fill="{INK}" opacity="0.55"/><circle cx="144" cy="78" r="2.8" fill="{INK}" opacity="0.55"/><circle cx="144" cy="110" r="2.8" fill="{INK}" opacity="0.55"/><circle cx="120" cy="118" r="2.8" fill="{INK}" opacity="0.55"/><circle cx="96" cy="110" r="2.8" fill="{INK}" opacity="0.55"/><circle cx="96" cy="78" r="2.8" fill="{INK}" opacity="0.55"/>
<!-- support pedestals -->
<path d="M42 126 L74 126 L68 138 L48 138 Z" fill="#475569" stroke="{INK}" stroke-width="0.6"/>
<path d="M166 126 L198 126 L192 138 L172 138 Z" fill="#475569" stroke="{INK}" stroke-width="0.6"/>
'''

def svg_screen():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="60" ry="5" fill="black" opacity="0.22"/>
<rect x="52" y="46" width="136" height="88" rx="12" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
<rect x="52" y="46" width="136" height="88" rx="12" fill="none" stroke="{INK}" stroke-width="0.7" opacity="0.35"/>
<!-- mesh -->
<g stroke="{INK}" stroke-width="0.55" opacity="0.30">
<line x1="62" y1="66" x2="178" y2="66"/><line x1="62" y1="82" x2="178" y2="82"/><line x1="62" y1="98" x2="178" y2="98"/><line x1="62" y1="114" x2="178" y2="114"/>
<line x1="76" y1="50" x2="76" y2="130"/><line x1="98" y1="50" x2="98" y2="130"/><line x1="120" y1="50" x2="120" y2="130"/><line x1="142" y1="50" x2="142" y2="130"/><line x1="164" y1="50" x2="164" y2="130"/>
</g>
<!-- vibration motor -->
<rect x="104" y="32" width="32" height="12" rx="6" fill="{STEEL}" stroke="{INK}" stroke-width="0.6"/>
<circle cx="120" cy="38" r="2" fill="{INK}" opacity="0.7"/>
<!-- springs -->
<path d="M64 132 L64 142 L72 142 L72 132" fill="none" stroke="{STEEL}" stroke-width="1.6" stroke-linecap="round"/>
<path d="M168 132 L168 142 L176 142 L176 132" fill="none" stroke="{STEEL}" stroke-width="1.6" stroke-linecap="round"/>
<rect x="58" y="142" width="124" height="4" rx="2" fill="rgba(0,0,0,0.28)"/>
'''

def svg_magnet():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{STEEL}"/><stop offset="1" stop-color="{STEEL2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="54" ry="5" fill="black" opacity="0.22"/>
<!-- feed chute (left) -->
<path d="M40 84 L78 84 L72 96 L46 96 Z" fill="url(#s)" stroke="{INK}" stroke-width="0.62"/>
<!-- tank -->
<path d="M60 92 L180 92 L174 122 L66 122 Z" fill="#1e293b" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
<!-- drum -->
<ellipse cx="120" cy="86" rx="40" ry="30" fill="#f8fafc" stroke="{INK}" stroke-width="0.9"/>
<ellipse cx="120" cy="86" rx="40" ry="30" fill="none" stroke="{INK}" stroke-width="0.42" opacity="0.12"/>
<!-- end flanges -->
<ellipse cx="84" cy="86" rx="7" ry="14" fill="#334155" stroke="{INK}" stroke-width="0.62"/>
<ellipse cx="156" cy="86" rx="7" ry="14" fill="#334155" stroke="{INK}" stroke-width="0.62"/>
<ellipse cx="84" cy="86" rx="3" ry="7" fill="{INK}" opacity="0.2"/><ellipse cx="156" cy="86" rx="3" ry="7" fill="{INK}" opacity="0.2"/>
<!-- internal magnet arc visible -->
<path d="M90 72 A34 26 0 0 1 150 72" fill="none" stroke="{INK}" stroke-width="0.5" opacity="0.18" stroke-dasharray="3 3"/>
<!-- concent + tail chutes -->
<path d="M104 122 L112 136 L132 136 L128 122 Z" fill="#cbd5e1" stroke="{INK}" stroke-width="0.6"/>
<path d="M134 122 L142 136 L162 136 L154 122 Z" fill="rgba(255,255,255,0.65)" stroke="{INK}" stroke-width="0.5"/>
<text x="113" y="133" font-size="4" fill="{INK}" opacity="0.6" font-family="monospace">M</text><text x="144" y="133" font-size="4" fill="{INK}" opacity="0.6" font-family="monospace">T</text>
<!-- slurry level -->
<line x1="68" y1="104" x2="172" y2="104" stroke="white" stroke-width="0.5" opacity="0.35" stroke-dasharray="5 4"/>
<!-- motor -->
<rect x="166" y="58" width="22" height="12" rx="6" fill="#475569" stroke="{INK}" stroke-width="0.6"/><circle cx="177" cy="64" r="2" fill="{STEEL}"/>
<line x1="166" y1="64" x2="158" y2="72" stroke="{INK}" stroke-width="0.8" opacity="0.5"/>
'''

def svg_conveyor():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="62" ry="5" fill="black" opacity="0.22"/>
<!-- single belt -->
<rect x="36" y="102" width="168" height="10" rx="5" fill="#f8fafc" stroke="{INK}" stroke-width="0.85"/>
<line x1="52" y1="107" x2="188" y2="107" stroke="{INK}" stroke-width="0.5" opacity="0.18" stroke-dasharray="8 6"/>
<!-- two pulleys only -->
<circle cx="60" cy="112" r="14" fill="none" stroke="{INK}" stroke-width="0.9"/><circle cx="60" cy="112" r="4" fill="{INK}"/>
<circle cx="180" cy="112" r="14" fill="none" stroke="{INK}" stroke-width="0.9"/><circle cx="180" cy="112" r="4" fill="{INK}"/>
'''

def svg_filter():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="58" ry="5" fill="black" opacity="0.22"/>
<rect x="54" y="50" width="132" height="58" rx="8" fill="#f8fafc" stroke="{INK}" stroke-width="0.9"/>
<g stroke="{INK}" stroke-width="0.5" opacity="0.24">
<line x1="72" y1="50" x2="72" y2="108"/><line x1="90" y1="50" x2="90" y2="108"/><line x1="108" y1="50" x2="108" y2="108"/><line x1="126" y1="50" x2="126" y2="108"/><line x1="144" y1="50" x2="144" y2="108"/><line x1="162" y1="50" x2="162" y2="108"/>
</g>
<!-- hydraulic -->
<rect x="104" y="36" width="32" height="14" rx="3" fill="#475569" stroke="{INK}" stroke-width="0.6"/><line x1="120" y1="36" x2="120" y2="50" stroke="{INK}" stroke-width="1"/>
<path d="M54 108 L186 108 L168 130 L72 130 Z" fill="#e2e8f0" stroke="{INK}" stroke-width="0.7"/>
<rect x="106" y="130" width="28" height="6" rx="2" fill="rgba(0,0,0,0.28)"/>
'''

def svg_tank():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>
<radialGradient id="liq" cx="50%" cy="38%"><stop offset="0" stop-color="rgba(255,255,255,0.42)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="56" ry="5" fill="black" opacity="0.22"/>
<ellipse cx="120" cy="60" rx="54" ry="16" fill="#e2e8f0" stroke="{INK}" stroke-width="0.85"/>
<rect x="66" y="60" width="108" height="62" fill="#f8fafc" stroke="{INK}" stroke-width="0.85"/>
<ellipse cx="120" cy="122" rx="54" ry="16" fill="#e2e8f0" stroke="{INK}" stroke-width="0.85"/>
<ellipse cx="120" cy="98" rx="40" ry="18" fill="#38bdf8" opacity="0.38"/>
<ellipse cx="120" cy="98" rx="40" ry="18" fill="url(#liq)"/>
<!-- bridge -->
<rect x="66" y="70" width="108" height="4" rx="2" fill="{INK}" opacity="0.18"/>
<rect x="112" y="34" width="16" height="20" rx="2" fill="#cbd5e1" stroke="{INK}" stroke-width="0.65"/>
<circle cx="120" cy="98" r="9" fill="none" stroke="{INK}" stroke-width="0.7" opacity="0.5"/><circle cx="120" cy="98" r="4" fill="{INK}" opacity="0.85"/>
<line x1="120" y1="54" x2="120" y2="89" stroke="{INK}" stroke-width="1" opacity="0.55"/>
'''

def svg_flotation():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="58" ry="5" fill="black" opacity="0.22"/>
<rect x="58" y="60" width="124" height="66" rx="10" fill="#f8fafc" stroke="{INK}" stroke-width="0.9"/>
<line x1="58" y1="98" x2="182" y2="98" stroke="{INK}" stroke-width="0.6" opacity="0.18"/>
<!-- froth -->
<path d="M60 60 Q90 64 120 60 Q150 56 182 60" fill="white" opacity="0.22"/>
<!-- bubbles -->
<circle cx="90" cy="86" r="6" fill="none" stroke="{INK}" stroke-width="0.65" opacity="0.24"/><circle cx="90" cy="86" r="2.6" fill="white" opacity="0.9"/>
<circle cx="118" cy="76" r="4" fill="none" stroke="{INK}" stroke-width="0.65" opacity="0.24"/><circle cx="118" cy="76" r="1.7" fill="white" opacity="0.9"/>
<circle cx="146" cy="84" r="5" fill="none" stroke="{INK}" stroke-width="0.65" opacity="0.24"/><circle cx="146" cy="84" r="2.1" fill="white" opacity="0.9"/>
<circle cx="110" cy="110" r="7" fill="none" stroke="{INK}" stroke-width="0.65" opacity="0.24"/><circle cx="110" cy="110" r="3" fill="white" opacity="0.9"/>
<circle cx="138" cy="114" r="5" fill="none" stroke="{INK}" stroke-width="0.65" opacity="0.24"/><circle cx="138" cy="114" r="2" fill="white" opacity="0.9"/>
<!-- impeller shaft -->
<line x1="120" y1="60" x2="120" y2="110" stroke="{INK}" stroke-width="0.9" opacity="0.45"/>
<rect x="114" y="110" width="12" height="6" rx="1" fill="{INK}" opacity="0.9"/>
'''

def svg_flask():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="42" ry="5" fill="black" opacity="0.22"/>
<rect x="94" y="40" width="52" height="10" rx="3" fill="#f8fafc" stroke="{INK}" stroke-width="0.75"/>
<rect x="100" y="42" width="40" height="2" rx="1" fill="white" opacity="0.6"/>
<path d="M108 50 H132 L126 90 C126 100 122 108 116 110 H124 C118 112 110 108 108 98 L102 50 Z" fill="rgba(248,250,252,0.96)" stroke="{INK}" stroke-width="0.85"/>
<path d="M108 96 Q120 112 132 96 L128 106 Q120 118 112 106 Z" fill="#38bdf8" opacity="0.82" stroke="{INK}" stroke-width="0.55"/>
<circle cx="118" cy="78" r="2" fill="white" opacity="0.85"/><circle cx="124" cy="84" r="1.3" fill="white" opacity="0.7"/>
<line x1="108" y1="62" x2="132" y2="62" stroke="{INK}" stroke-width="0.35" opacity="0.12"/><line x1="106" y1="74" x2="130" y2="74" stroke="{INK}" stroke-width="0.35" opacity="0.12"/>
'''

def svg_cyclone():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="44" ry="5" fill="black" opacity="0.22"/>
<path d="M76 48 H164 L156 92 L120 138 L84 92 Z" fill="#f8fafc" stroke="{INK}" stroke-width="0.9"/>
<path d="M84 92 Q120 110 156 92" fill="none" stroke="{INK}" stroke-width="0.55" opacity="0.20"/>
<path d="M120 62 L124 96 L120 130" fill="none" stroke="{INK}" stroke-width="0.5" opacity="0.26" stroke-dasharray="4 4"/>
<rect x="76" y="48" width="88" height="12" rx="2" fill="#e2e8f0" stroke="{INK}" stroke-width="0.65"/>
<rect x="92" y="52" width="56" height="2" rx="1" fill="white" opacity="0.55"/>
<circle cx="108" cy="100" r="1.6" fill="{INK}" opacity="0.14"/><circle cx="132" cy="112" r="1.6" fill="{INK}" opacity="0.14"/>
'''

def svg_dryer():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="60" ry="5" fill="black" opacity="0.22"/>
<rect x="54" y="62" width="132" height="56" rx="18" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.8"/>
<rect x="54" y="62" width="132" height="56" rx="18" fill="#f8fafc" stroke="{INK}" stroke-width="0.9"/>
<ellipse cx="54" cy="90" rx="9" ry="28" fill="#cbd5e1" stroke="{INK}" stroke-width="0.7"/>
<ellipse cx="186" cy="90" rx="9" ry="28" fill="#cbd5e1" stroke="{INK}" stroke-width="0.7"/>
<g stroke="{INK}" stroke-width="0.5" opacity="0.22">
<line x1="76" y1="64" x2="76" y2="116"/><line x1="94" y1="64" x2="94" y2="116"/><line x1="112" y1="64" x2="112" y2="116"/><line x1="130" y1="64" x2="130" y2="116"/><line x1="148" y1="64" x2="148" y2="116"/><line x1="166" y1="64" x2="166" y2="116"/>
</g>
<path d="M94 86 Q120 74 146 86" fill="none" stroke="#f59e0b" stroke-width="1.1" opacity="0.88" stroke-dasharray="3 3"/>
<circle cx="120" cy="82" r="2" fill="#f59e0b"/>
<rect x="92" y="122" width="56" height="4" rx="2" fill="rgba(0,0,0,0.22)"/>
'''

def svg_feeder():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="52" ry="5" fill="black" opacity="0.22"/>
<!-- hopper -->
<path d="M68 42 L172 42 L156 64 L84 64 Z" fill="{STEEL}" stroke="{INK}" stroke-width="0.8"/>
<line x1="84" y1="64" x2="156" y2="64" stroke="{INK}" stroke-width="0.45" opacity="0.22"/>
<!-- vibrating pan -->
<rect x="52" y="82" width="136" height="18" rx="4" fill="#f8fafc" stroke="{INK}" stroke-width="0.85"/>
<g stroke="{INK}" stroke-width="0.4" opacity="0.16"><line x1="72" y1="86" x2="72" y2="96"/><line x1="92" y1="86" x2="92" y2="96"/><line x1="112" y1="86" x2="112" y2="96"/><line x1="132" y1="86" x2="132" y2="96"/><line x1="152" y1="86" x2="152" y2="96"/></g>
<!-- springs -->
<path d="M68 100 L68 116 L76 116" fill="none" stroke="{STEEL}" stroke-width="1.8" stroke-linecap="round"/>
<path d="M172 100 L172 116 L164 116" fill="none" stroke="{STEEL}" stroke-width="1.8" stroke-linecap="round"/>
<!-- motor -->
<rect x="106" y="112" width="28" height="12" rx="6" fill="#475569" stroke="{INK}" stroke-width="0.6"/><circle cx="120" cy="118" r="2" fill="{STEEL}"/>
'''

def svg_gear():
    return f'''
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient></defs>
<rect width="240" height="170" rx="18" fill="url(#g)"/>
<ellipse cx="120" cy="152" rx="40" ry="5" fill="black" opacity="0.22"/>
<g transform="translate(120,88)" stroke="#f8fafc" stroke-width="1" fill="none" opacity="0.96">
<circle r="30" fill="#f8fafc" stroke="{INK}" stroke-width="0.9"/>
<circle r="12" fill="{INK}" opacity="0.07"/><circle r="6" fill="{INK}"/>
<g stroke-linecap="round" stroke="{INK}" stroke-width="0.65" opacity="0.22">
<line x1="0" y1="-30" x2="0" y2="-42"/><line x1="21" y1="-21" x2="30" y2="-30"/><line x1="30" y1="0" x2="42" y2="0"/><line x1="21" y1="21" x2="30" y2="30"/><line x1="0" y1="30" x2="0" y2="42"/><line x1="-21" y1="21" x2="-30" y2="30"/><line x1="-30" y1="0" x2="-42" y2="0"/><line x1="-21" y1="-21" x2="-30" y2="-30"/>
</g>
</g>
'''

MAP = {
    'سنگ‌شکن': svg_crusher, 'آسیای گلوله‌ای': svg_mill, 'سرند ارتعاشی': svg_screen,
    'سپراتور مغناطیسی': svg_magnet, 'نوار نقاله': svg_conveyor, 'فیلتر پرس': svg_filter,
    'تیکنر': svg_tank, 'سلول فلوتاسیون': svg_flotation, 'هیدروسیکلون': svg_cyclone,
    'خشک‌کن': svg_dryer, 'آنالایزر پرتونگاری': svg_flask,
}

def slug(s):
    return ''.join(c for c in s if c.isalnum()).lower()[:20] or 'dev'

def pick_fn(dev):
    name = (dev.name or '').strip()
    lower = name.lower()
    # hydrocone / gyratory by device name
    if 'هیدروکن' in name or 'مخروطی' in name or 'hydrocone' in lower or 'gyratory' in lower:
        return svg_cone_crusher
    if 'فکی' in name or 'jaw' in lower:
        return svg_jaw_crusher
    if 'فیدر' in name or 'feeder' in lower:
        return svg_feeder
    tpl = (dev.template.name if dev.template_id else '').strip()
    if tpl == 'سنگ‌شکن':
        return svg_cone_crusher
    return MAP.get(tpl, svg_gear)

count = 0
for dev in Device.objects.select_related('template','line').all():
    fn = pick_fn(dev)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 170">{fn()}</svg>'
    fname = 'dev_%d_%s_v3.svg' % (dev.id, slug(dev.name))
    fpath = os.path.join(BASE, fname)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(svg)
    for old in os.listdir(BASE):
        if old.startswith('dev_%d_' % dev.id) and old != fname:
            try: os.remove(os.path.join(BASE, old))
            except: pass
    dev.image = 'devices/' + fname
    dev.save(update_fields=['image'])
    count += 1
print('v3 regenerated', count)
