import os, random, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
os.environ['PYTHONIOENCODING'] = 'utf-8'
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except: pass
import django
django.setup()
from datetime import date, time, timedelta, datetime
from django.contrib.auth.models import User
from accounts.models import UserProfile
from machines.models import *
from machines.factory_tabs import validate_and_compute, build_cross_context
from machines.tab_reports import run_report

FA_NAME = "کارخانه جامع فیک — همه حالت‌ها"
random.seed(14040505)
rng = random.Random(14040505)

def slug(s):
    return ''.join(c for c in s if c.isalnum()).lower()[:20] or 'x'

MEDIA = os.path.join(os.path.dirname(__file__), 'media', 'devices')
os.makedirs(MEDIA, exist_ok=True)

ICON_COLORS = {'crusher':('#f97316','#c2410c'),'mill':('#0ea5e9','#075985'),'screen':('#10b981','#047857'),'magnet':('#8b5cf6','#6d28d9'),'conveyor':('#64748b','#334155'),'filter':('#14b8a6','#0f766e'),'tank':('#6366f1','#4338ca'),'flotation':('#ec4899','#be185d'),'flask':('#f43f5e','#be123c'),'cyclone':('#f59e0b','#b45309'),'dryer':('#84cc16','#4d7c0f'),'gear':('#475569','#1e293b')}
def icon_svg(icon):
    m={'crusher':'<polygon points="120,58 165,128 75,128" fill="rgba(255,255,255,0.92)"/><rect x="68" y="128" width="104" height="14" rx="6" fill="rgba(255,255,255,0.7)"/>','mill':'<ellipse cx="120" cy="64" rx="44" ry="14" fill="rgba(255,255,255,0.92)"/><rect x="76" y="64" width="88" height="64" fill="rgba(255,255,255,0.85)"/>','screen':''.join('<rect x="80" y="%d" width="80" height="10" rx="5" fill="rgba(255,255,255,0.9)"/>'%(60+i*16) for i in range(4)),'magnet':'<path d="M96 60 h13 v42 a14 14 0 0 0 28 0 v-42 h13 v42 a27 27 0 0 1 -54 0 z" fill="rgba(255,255,255,0.92)"/>','conveyor':'<rect x="58" y="98" width="124" height="16" rx="8" fill="rgba(255,255,255,0.92)"/><circle cx="78" cy="106" r="14" fill="#fff"/><circle cx="162" cy="106" r="14" fill="#fff"/>','filter':'<rect x="80" y="58" width="80" height="40" rx="8" fill="rgba(255,255,255,0.92)"/>','tank':'<circle cx="120" cy="102" r="44" fill="rgba(255,255,255,0.92)"/>','flotation':'<rect x="78" y="70" width="84" height="58" rx="10" fill="rgba(255,255,255,0.92)"/>','flask':'<path d="M104 58 h32 l-6 22 v40 a8 8 0 0 1 -8 8 h-4 a8 8 0 0 1 -8 -8 v-40 z" fill="rgba(255,255,255,0.92)"/>','cyclone':'<path d="M120 56 a40 40 0 1 1 -28 12 l24 24 z" fill="rgba(255,255,255,0.92)"/>','dryer':'<rect x="76" y="62" width="88" height="56" rx="12" fill="rgba(255,255,255,0.92)"/>','gear':'<circle cx="120" cy="100" r="46" fill="rgba(255,255,255,0.92)"/><circle cx="120" cy="100" r="14" fill="#fff"/>'}
    return m.get(icon,m['gear'])
def make_image(filename,label,icon):
    c1,c2=ICON_COLORS.get(icon,ICON_COLORS['gear'])
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 170"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient></defs><rect width="240" height="170" rx="18" fill="url(#g)"/>%s<text x="120" y="158" font-family="Tahoma" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">%s</text></svg>'%(c1,c2,icon_svg(icon),label)
    p=os.path.join(MEDIA,filename)
    open(p,'wb').write(svg.encode('utf-8'))
    return 'devices/'+filename

print(">> cleanup old mega factory")
old = Factory.objects.filter(name=FA_NAME).first()
if old:
    FactoryTabRecord.objects.filter(tab__factory=old).delete()
    FactoryTabWidget.objects.filter(report__tab__factory=old).delete()
    FactoryTabReport.objects.filter(tab__factory=old).delete()
    FactoryTabInput.objects.filter(tab__factory=old).delete()
    FactoryTabOutput.objects.filter(tab__factory=old).delete()
    FactoryTab.objects.filter(factory=old).delete()
    DeviceLog.objects.filter(line__factory=old).delete()
    Device.objects.filter(line__factory=old).delete()
    Shift.objects.filter(line__factory=old).delete()
    ProductionLine.objects.filter(factory=old).delete()
    Contractor.objects.filter(factory=old).delete()
    UserProfile.objects.filter(factory=old).delete()
    User.objects.filter(username__in=['mega_manager','mega_operator','mega_viewer','mega_operator2']).delete()
    old.delete()
    print("  old removed")

fac = Factory.objects.create(name=FA_NAME, address="استان تست — کیلومتر ۹۹ جاده فیک — پلاک همه‌حالت‌ها")
print(f">> Factory {fac.id}: {fac.name}")

def goc_la(name,unit):
    o,_=ProductionLineAttribute.objects.get_or_create(name=name, defaults=dict(unit=unit))
    return o
def goc_a(name,unit):
    o,_=Attribute.objects.get_or_create(name=name, defaults=dict(unit=unit))
    return o

la_cap=goc_la("ظرفیت تولید","تن/ساعت")
la_len=goc_la("طول خط","متر")
la_stn=goc_la("تعداد ایستگاه","عدد")
la_nom=goc_la("ظرفیت اسمی","تن/روز")
la_hum=goc_la("رطوبت مجاز","درصد")
da_pow=goc_a("توان","کیلووات")
da_rpm=goc_a("دور","RPM")
da_cap=goc_a("ظرفیت","تن/ساعت")
da_w=goc_a("وزن","تن")
da_p=goc_a("فشار کاری","بار")
da_t=goc_a("دما","°C")

def tpl_line(name, attrs):
    t,_=ProductionLineTemplate.objects.get_or_create(name=name, defaults=dict(description=name))
    t.available_attributes.set(attrs)
    return t
def tpl_dev(name, attrs):
    t,_=DeviceTemplate.objects.get_or_create(name=name, defaults=dict(description=name))
    t.available_attributes.set(attrs)
    return t

lt_crush=tpl_line("الگوی جامع خردایش",[la_cap,la_len,la_stn,la_nom])
lt_proc=tpl_line("الگوی جامع فرآوری",[la_cap,la_len,la_stn,la_hum])
lt_conv=tpl_line("الگوی جامع انتقال",[la_len,la_cap])
lt_other=tpl_line("الگوی جامع سایر",[la_cap,la_nom])

dt_crusher=tpl_dev("سنگ‌شکن",[da_pow,da_cap,da_w])
dt_mill=tpl_dev("آسیای گلوله‌ای",[da_pow,da_rpm,da_w])
dt_screen=tpl_dev("سرند ارتعاشی",[da_pow,da_cap])
dt_mag=tpl_dev("سپراتور مغناطیسی",[da_pow,da_cap])
dt_conv=tpl_dev("نوار نقاله",[da_pow,da_len if 'da_len' in dir() else da_cap])
dt_filter=tpl_dev("فیلتر پرس",[da_pow,da_p])
dt_thick=tpl_dev("تیکنر",[da_pow,da_t])
dt_flot=tpl_dev("سلول فلوتاسیون",[da_pow,da_cap,da_t])
dt_cyclone=tpl_dev("هیدروسیکلون",[da_pow,da_p])
dt_dry=tpl_dev("خشک‌کن",[da_pow,da_t,da_cap])
dt_an=tpl_dev("آنالایزر پرتونگاری",[da_pow])

TPL_ICON={'سنگ‌شکن':'crusher','آسیای گلوله‌ای':'mill','سرند ارتعاشی':'screen','سپراتور مغناطیسی':'magnet','نوار نقاله':'conveyor','فیلتر پرس':'filter','تیکنر':'tank','سلول فلوتاسیون':'flotation','هیدروسیکلون':'cyclone','خشک‌کن':'dryer','آنالایزر پرتونگاری':'flask'}

line_specs=[
    ("خط خردایش ۱","crushing",lt_crush, {"ظرفیت تولید":180,"طول خط":320,"تعداد ایستگاه":4,"ظرفیت اسمی":4000}, [("سنگ‌شکن فکی",dt_crusher,{"توان":220,"ظرفیت":185,"وزن":12}),("آسیای مخروطی",dt_crusher,{"توان":315,"ظرفیت":200,"وزن":18}),("سرند اولیه",dt_screen,{"توان":30,"ظرفیت":180}),("نوار نقاله ورودی",dt_conv,{"توان":22,"ظرفیت":200})]),
    ("خط خردایش ۲","crushing",lt_crush, {"ظرفیت تولید":150,"طول خط":280,"تعداد ایستگاه":3,"ظرفیت اسمی":3500}, [("سنگ‌شکن ضربه‌ای",dt_crusher,{"توان":160,"ظرفیت":160,"وزن":10}),("سرند ثانویه",dt_screen,{"توان":28,"ظرفیت":150}),("نوار نقاله خروجی",dt_conv,{"توان":18,"ظرفیت":160})]),
    ("خط فرآوری اصلی","processing",lt_proc, {"ظرفیت تولید":165,"طول خط":410,"تعداد ایستگاه":5,"رطوبت مجاز":8}, [("آسیای گلوله‌ای",dt_mill,{"توان":3500,"دور":18.5,"وزن":45}),("سپراتور مغناطیسی",dt_mag,{"توان":95,"ظرفیت":160}),("تیکنر مرکزی",dt_thick,{"توان":45,"دما":65}),("فیلتر پرس",dt_filter,{"توان":37,"فشار کاری":6}),("آنالایزر پرتونگاری",dt_an,{"توان":5})]),
    ("خط انتقال","conveying",lt_conv, {"طول خط":520,"ظرفیت تولید":200}, [("نوار نقاله ۱",dt_conv,{"توان":30,"ظرفیت":220}),("نوار نقاله ۲",dt_conv,{"توان":28,"ظرفیت":210}),("هیدروسیکلون",dt_cyclone,{"توان":55,"فشار کاری":2.5})]),
    ("خط سایر - خشک‌کن","other",lt_other, {"ظرفیت تولید":110,"ظرفیت اسمی":2600}, [("خشک‌کن دوار",dt_dry,{"توان":70,"دما":180,"ظرفیت":110}),("سلول فلوتاسیون",dt_flot,{"توان":95,"ظرفیت":130,"دما":40}),("آنالایزر ثانویه",dt_an,{"توان":4})]),
    ("خط فرآوری ۲","processing",lt_proc, {"ظرفیت تولید":135,"طول خط":390,"تعداد ایستگاه":4,"رطوبت مجاز":6}, [("آسیای گلوله‌ای دوم",dt_mill,{"توان":3100,"دور":19,"وزن":42}),("سلول فلوتاسیون A",dt_flot,{"توان":98,"ظرفیت":135,"دما":38}),("تیکنر B",dt_thick,{"توان":42,"دما":60})]),
]

lines=[]
for name,ltype,tpl,vals,devs in line_specs:
    pl=ProductionLine.objects.create(name=name, factory=fac, line_type=ltype, template=tpl, description=f"{name} — {ltype} — کارخانه جامع فیک", attributes_values=vals)
    lines.append(pl)
    for idx,(dname,dtpl,dvals) in enumerate(devs, start=1):
        icon=TPL_ICON.get(dtpl.name,'gear')
        img=make_image(f"mega_{fac.id}_{pl.id}_{idx}.svg", dname, icon)
        code=f"MEGA-L{lines.__len__():02d}-D{idx:02d}"
        if idx==len(devs) and rng.random()<0.3:
            code=""
        Device.objects.create(name=dname, code=code, line=pl, template=dtpl, order=idx, attributes_values=dvals, image=img)
    if rng.random()<0.2:
        d=Device.objects.filter(line=pl).first()
        if d:
            d.image=None; d.save(); print(f"  ! image nulled for {d.name}")

print(f"  Lines {len(lines)} | Devices {Device.objects.filter(line__factory=fac).count()}")

shifts=[]
shifts_def=[("شیفت صبح","06:00","14:00",True),("شیفت عصر","14:00","22:00",True),("شیفت شب","22:00","06:00",True)]
for pl in lines:
    for n,s,e,act in shifts_def:
        shifts.append(Shift.objects.create(line=pl, name=n, start_time=s, end_time=e, is_active=act))
inactive_shift=Shift.objects.create(line=lines[0], name="شیفت آزمایشی غیرفعال", start_time="08:00", end_time="12:00", is_active=False)
shifts.append(inactive_shift)
print(f"  Shifts {len(shifts)} (incl 1 inactive)")

for t in ['برقی','مکانیکی','توقف تأمین مواد','تعمیرات برنامه‌ریزی شده','افت کیفیت محصول','قطعی آب','خرابی نوار','انسداد','توقف اپراتوری','سایر']:
    FailureReason.objects.get_or_create(title=t)
failures=list(FailureReason.objects.all())

contractors=[
    Contractor.objects.create(factory=fac, name="پیمانکار الف - فعال", contact_name="علی احمدی", phone="09123456789", is_active=True),
    Contractor.objects.create(factory=fac, name="پیمانکار ب - فعال", contact_name="حسین رضایی", phone="09129876543", is_active=True),
    Contractor.objects.create(factory=fac, name="پیمانکار ج - غیرفعال", contact_name="مهدی کریمی", phone="09120001122", is_active=False),
    Contractor.objects.create(factory=fac, name="پیمانکار د - بدون تماس", contact_name="", phone="", is_active=True),
]
print(f"  Contractors {len(contractors)} (incl inactive + empty contact)")

today=date.today()
log_n=0
for pl in lines:
    devs=list(pl.devices.all())
    pls=list(Shift.objects.filter(line=pl, is_active=True))
    down_until=None
    for i in range(92):
        d=today-timedelta(days=i)
        if down_until is None and rng.random()<0.04:
            down_until=d - timedelta(days=rng.randint(1,3))
        line_down=(down_until is not None and d <= down_until)
        if line_down and d < down_until:
            pass
        if down_until is not None and d < down_until:
            pass
        if down_until is not None and d == down_until:
            down_until=None
        for s in pls:
            if rng.random()<0.03:
                continue
            if line_down:
                fr=rng.choice(failures)
                DeviceLog.objects.create(line=pl, shift=s, date=d, device=None, failure_cause=fr, runtime_hours=0, downtime_hours=8, feed_tonnage=0, product_tonnage=0, tailing_tonnage=0, failure_description="توقف کامل خط جهت تعمیرات اساسی", repair_description="تعویض قطعه و راه‌اندازی")
                log_n+=1
            else:
                r=rng.random()
                if r<0.06:
                    # zero feed edge
                    DeviceLog.objects.create(line=pl, shift=s, date=d, device=rng.choice(devs) if rng.random()<0.3 else None, failure_cause=None, runtime_hours=0, downtime_hours=0, feed_tonnage=0, product_tonnage=0, tailing_tonnage=0, failure_description="", repair_description="")
                elif r<0.12:
                    feed=rng.randint(800,1400); tail=rng.randint(50,200); prod=feed-tail
                    DeviceLog.objects.create(line=pl, shift=s, date=d, device=rng.choice(devs), failure_cause=rng.choice(failures), runtime_hours=6, downtime_hours=2, feed_tonnage=feed, product_tonnage=prod, tailing_tonnage=tail, failure_description="توقف کوتاه", repair_description="رفع عیب")
                elif r<0.18:
                    # max efficiency ~95%
                    feed=rng.randint(1200,1800); prod=int(feed*0.92); tail=feed-prod
                    DeviceLog.objects.create(line=pl, shift=s, date=d, device=None, failure_cause=None, runtime_hours=8, downtime_hours=0, feed_tonnage=feed, product_tonnage=prod, tailing_tonnage=tail)
                else:
                    feed=rng.randint(1100,1900); ratio=rng.uniform(0.55,0.78); prod=int(feed*ratio); tail=feed-prod
                    rt=rng.choice([7.5,8.0]); dt=0
                    fr=None; fd=""; rd=""
                    if rng.random()<0.10:
                        dt=rng.choice([0.5,1,1.5]); fr=rng.choice(failures); fd="توقف کوتاه"; rd="تنظیم"
                    dev=rng.choice(devs) if rng.random()<0.35 else None
                    DeviceLog.objects.create(line=pl, shift=s, date=d, device=dev, failure_cause=fr, runtime_hours=rt, downtime_hours=dt, feed_tonnage=feed, product_tonnage=prod, tailing_tonnage=tail, failure_description=fd, repair_description=rd)
                log_n+=1
print(f"  DeviceLogs {log_n}")

# ── FactoryTabs ──
def make_tab(key,name,desc,record_type,require_line,contractor_required,inputs,outputs,order,icon,color,is_active=True):
    t=FactoryTab.objects.create(factory=fac, key=key, name=name, description=desc, record_type=record_type, require_line=require_line, contractor_required=contractor_required, order=order, is_active=is_active, icon=icon, color=color)
    for idx,s in enumerate(inputs):
        FactoryTabInput.objects.create(tab=t, key=s["key"], name=s["name"], input_type=s.get("input_type","number"), options=s.get("options",[]), unit=s.get("unit",""), required=s.get("required",True), order=idx)
    for idx,s in enumerate(outputs):
        FactoryTabOutput.objects.create(tab=t, key=s["key"], name=s["name"], unit=s.get("unit",""), formula=s["formula"], order=idx)
    return t

tab1=make_tab("mega-tonnage","تناژ تحویلی روزانه","تحویل روزانه ساعتی با همه انواع ورودی", "daily", True, True,
    inputs=[
        {"key":"tonnage","name":"تناژ تحویلی","unit":"تن","input_type":"number","required":True},
        {"key":"cars","name":"تعداد کامیون","unit":"دستگاه","input_type":"number","required":True},
        {"key":"moisture","name":"رطوبت","unit":"درصد","input_type":"number","required":False},
        {"key":"grade","name":"نام مواد","input_type":"text","required":False},
        {"key":"vehicle","name":"نوع خودرو","input_type":"select","options":["کفی","بونوس","تریلی","جرثقیل","کمپرسی"],"required":True},
        {"key":"shift_type","name":"شیفت تحویل","input_type":"select","options":["صبح","عصر","شب"],"required":False},
        {"key":"note_extra","name":"توضیح تکمیلی","input_type":"text","required":False},
    ],
    outputs=[
        {"key":"avg_per_car","name":"میانگین هر خودرو","unit":"تن","formula":"tonnage / cars"},
        {"key":"dry_tonnage","name":"تناژ خشک","unit":"تن","formula":"tonnage * (100 - moisture) / 100"},
        {"key":"eff_idx","name":"شاخص بهره‌وری","unit":"امتیاز","formula":"round(avg_per_car * 2 + dry_tonnage / 100, 2)"},
    ], order=0, icon="truck", color="emerald")

tab2=make_tab("mega-performance","عملکرد فرآوری","عملکرد بازه‌ای با فرمول زنجیره‌ای + ارجاع بین‌تبی", "range", True, False,
    inputs=[
        {"key":"feed_fe","name":"Fe خوراک","unit":"درصد","input_type":"number","required":True},
        {"key":"product_fe","name":"Fe محصول","unit":"درصد","input_type":"number","required":True},
        {"key":"feo","name":"FeO","unit":"درصد","input_type":"number","required":False},
        {"key":"sio2","name":"SiO2","unit":"درصد","input_type":"number","required":False},
        {"key":"grade","name":"گرید","input_type":"select","options":["گرید ۱","گرید ۲","گرید ۳","گرید ممتاز"],"required":False},
        {"key":"method","name":"روش فرآوری","input_type":"select","options":["مغناطیسی","فلوتاسیون","ثقلی"],"required":True},
        {"key":"desc","name":"توضیح","input_type":"text","required":False},
    ],
    outputs=[
        {"key":"recovery","name":"بازیابی","unit":"درصد","formula":"product_fe / feed_fe * 100"},
        {"key":"grade_gap","name":"اختلاف عیار","unit":"درصد","formula":"product_fe - feed_fe"},
        {"key":"adj_recovery","name":"بازیابی تعدیل‌شده","unit":"درصد","formula":"recovery * (1 - sio2 / 200)"},
        {"key":"score","name":"امتیاز کلی","unit":"امتیاز","formula":"round(adj_recovery + grade_gap, 2)"},
        {"key":"tonnage_ref","name":"ارجاع تناژ خشک","unit":"تن","formula":"mega_tonnage.dry_tonnage * 0.1 + recovery"},
    ], order=1, icon="gauge", color="amber")

tab3=make_tab("mega-shift","گزارش شیفت آزاد","بدون خط/پیمانکار الزامی — همه حالات select/text", "range", False, False,
    inputs=[
        {"key":"downtime_h","name":"ساعت توقف","unit":"ساعت","input_type":"number","required":True},
        {"key":"shift_name","name":"شیفت","input_type":"select","options":["صبح","عصر","شب"],"required":True},
        {"key":"status","name":"وضعیت","input_type":"select","options":["عادی","توقف برنامه‌ریزی‌شده","خرابی","کمبود مواد"],"required":True},
        {"key":"line_name","name":"نام خط (متنی)","input_type":"text","required":False},
        {"key":"note_text","name":"توضیح","input_type":"text","required":False},
        {"key":"overtime","name":"اضافه‌کار","unit":"ساعت","input_type":"number","required":False},
    ],
    outputs=[
        {"key":"downtime_ratio","name":"نسبت توقف","unit":"درصد","formula":"downtime_h / 8 * 100"},
        {"key":"total_lost","name":"کل هدررفت","unit":"ساعت","formula":"downtime_h + overtime"},
    ], order=2, icon="clock", color="violet")

tab4=make_tab("mega-lab","آنالیز آزمایشگاهی","روزانه با تابع و عملگرهای متنوع", "daily", False, False,
    inputs=[
        {"key":"sample_w","name":"وزن نمونه","unit":"گرم","input_type":"number","required":True},
        {"key":"fe","name":"Fe","unit":"درصد","input_type":"number","required":True},
        {"key":"s","name":"گوگرد","unit":"درصد","input_type":"number","required":False},
        {"key":"sample_type","name":"نوع نمونه","input_type":"select","options":["خوراک","کنسانتره","باطله","تیکنر"],"required":True},
        {"key":"lab","name":"آزمایشگاه","input_type":"select","options":["مرکزی","خط ۱","خط ۲"],"required":False},
        {"key":"comment","name":"توضیح","input_type":"text","required":False},
    ],
    outputs=[
        {"key":"fe_abs","name":"Fe قدرمطلق","unit":"درصد","formula":"abs(fe)"},
        {"key":"fe_sqrt","name":"Fe جذر","unit":"","formula":"sqrt(fe)"},
        {"key":"weighted","name":"وزنی","unit":"","formula":"sample_w * fe / 100"},
        {"key":"flag","name":"پرچم عیار بالا","unit":"","formula":"if(fe > 60, 1, 0)"},
        {"key":"combo","name":"ترکیبی","unit":"","formula":"round(min(fe_abs, 70) + max(s, 0) * 2, 2)"},
    ], order=3, icon="flask", color="sky")

tab5=make_tab("mega-empty","تب خالی غیرفعال","برای تست فیلتر active=0/1", "range", False, False, inputs=[], outputs=[], order=99, icon="layers", color="slate", is_active=False)

print(f"  Tabs 5 (4 active + 1 inactive)")

def add_widgets(report, widgets):
    for idx,(wtype,title,cfg) in enumerate(widgets):
        FactoryTabWidget.objects.create(report=report, widget_type=wtype, title=title, order=idx, is_active=True, config=cfg)

def make_report(tab,name,metrics,widgets,filters,is_default=False,order=0,description=""):
    r=FactoryTabReport.objects.create(tab=tab, name=name, description=description, is_default=is_default, order=order, is_active=True, filters=filters, metrics=metrics)
    add_widgets(r, widgets)
    return r

# Reports — هر تب فعال حداقل 2 گزارش با همه انواع ویجت
make_report(tab1,"گزارش تحویل روزانه — کامل",
    metrics=[{"key":"total_tonnage","label":"جمع تناژ","unit":"تن","formula":"in.tonnage__sum"},{"key":"avg_per_car_m","label":"میانگین هر خودرو","unit":"تن","formula":"in.tonnage__sum / in.cars__sum"},{"key":"dry_sum","label":"جمع خشک","unit":"تن","formula":"out.dry_tonnage__sum"}],
    widgets=[
        ("kpi","شاخص‌ها",{"cards":[{"kind":"count","label":"تعداد تحویل"},{"kind":"stat","field":"in.tonnage","stat":"sum","label":"جمع تناژ","sub_stats":["avg","min","max"]},{"kind":"stat","field":"out.avg_per_car","stat":"avg","label":"میانگین هر خودرو","sub_stats":["avg","min","max"]},{"kind":"metric","metric":"avg_per_car_m","label":"میانگین محاسباتی"}]}),
        ("stat_table","آمار فیلدها",{"sources":["out","in"],"fields":["in.tonnage","in.cars","out.avg_per_car","out.dry_tonnage"],"stats":["sum","avg","min","max","count"]}),
        ("group_table","تفکیک نوع خودرو",{"group_by":"field_value","field":"in.vehicle","fields":["in.tonnage","in.cars","out.avg_per_car"],"stats":["sum","avg","count"],"sort":"value_desc","sort_field":"in.tonnage","sort_stat":"sum","limit":20,"include_total":True}),
        ("group_table","توزیع ساعتی",{"group_by":"hour","fields":["in.tonnage"],"stats":["sum","count"],"sort":"label_asc","limit":24}),
        ("chart","سهم ساعتی",{"chart":"bar","group_by":"hour","value":"count","sort":"label_asc","limit":24}),
        ("chart","سهم خودرو",{"chart":"pie","group_by":"field_value","field":"in.vehicle","value":{"field":"in.tonnage","stat":"sum"},"sort":"value_desc","limit":10}),
        ("chart","روند روزانه",{"chart":"line","group_by":"date","value":{"field":"in.tonnage","stat":"sum"},"sort":"label_asc","limit":30}),
    ], filters=["line","contractor","date_from","date_to"], is_default=True, order=0)

make_report(tab1,"گزارش ماهانه تناژ",
    metrics=[{"key":"m_avg","label":"میانگین ماهانه","unit":"تن","formula":"in.tonnage__avg"}],
    widgets=[
        ("group_table","ماهانه",{"group_by":"month","fields":["in.tonnage","out.dry_tonnage"],"stats":["sum","avg"],"sort":"label_asc","limit":24}),
        ("chart","ماهانه",{"chart":"bar","group_by":"month","value":{"field":"in.tonnage","stat":"sum"},"sort":"label_asc","limit":24}),
    ], filters=["date_from","date_to"], order=1)

make_report(tab2,"گزارش عملکرد — کامل",
    metrics=[{"key":"rec_avg","label":"میانگین بازیابی","unit":"درصد","formula":"out.recovery__avg"},{"key":"gap_avg","label":"میانگین اختلاف","unit":"درصد","formula":"out.grade_gap__avg"},{"key":"score_avg","label":"میانگین امتیاز","unit":"امتیاز","formula":"out.score__avg"}],
    widgets=[
        ("kpi","شاخص‌ها",{"cards":[{"kind":"count","label":"تعداد"},{"kind":"stat","field":"out.recovery","stat":"avg","label":"میانگین بازیابی","sub_stats":["min","max"]},{"kind":"metric","metric":"score_avg","label":"امتیاز"}]}),
        ("stat_table","آمار",{"sources":["out","in"],"stats":["avg","min","max","count"]}),
        ("group_table","به تفکیک خط",{"group_by":"line","fields":["out.recovery","out.score","in.feed_fe"],"stats":["avg","count"],"sort":"count_desc"}),
        ("group_table","به تفکیک گرید",{"group_by":"field_value","field":"in.grade","fields":["out.recovery"],"stats":["avg","count"],"sort":"count_desc"}),
        ("group_table","هفتگی",{"group_by":"week","fields":["out.recovery"],"stats":["avg"],"sort":"label_asc","limit":20}),
        ("chart","روند روزانه",{"chart":"line","group_by":"date","value":{"field":"out.recovery","stat":"avg"},"sort":"label_asc","limit":30}),
        ("chart","سهم خط",{"chart":"pie","group_by":"line","value":{"field":"out.recovery","stat":"avg"},"sort":"value_desc","limit":10}),
        ("chart","ماهانه",{"chart":"bar","group_by":"month","value":{"field":"out.score","stat":"avg"},"sort":"label_asc","limit":12}),
    ], filters=["line","contractor","date_from","date_to"], is_default=True, order=0)

make_report(tab2,"گزارش پیمانکار",
    metrics=[{"key":"c_avg","label":"میانگین","unit":"درصد","formula":"out.recovery__avg"}],
    widgets=[
        ("group_table","پیمانکار",{"group_by":"contractor","fields":["out.recovery","out.grade_gap"],"stats":["avg","count"],"sort":"value_desc","sort_field":"out.recovery","sort_stat":"avg"}),
        ("chart","پیمانکار",{"chart":"bar","group_by":"contractor","value":{"field":"out.recovery","stat":"avg"},"sort":"value_desc","limit":10}),
    ], filters=["contractor","date_from","date_to"], order=1)

make_report(tab3,"گزارش شیفت — کامل",
    metrics=[{"key":"avg_down","label":"میانگین توقف","unit":"ساعت","formula":"in.downtime_h__avg"},{"key":"max_down","label":"بیشترین","unit":"ساعت","formula":"in.downtime_h__max"}],
    widgets=[
        ("kpi","شاخص‌ها",{"cards":[{"kind":"count","label":"تعداد"},{"kind":"stat","field":"in.downtime_h","stat":"sum","label":"جمع توقف","sub_stats":["avg","max"]},{"kind":"metric","metric":"avg_down","label":"میانگین"}]}),
        ("group_table","شیفت",{"group_by":"field_value","field":"in.shift_name","fields":["in.downtime_h","out.downtime_ratio"],"stats":["sum","avg","count"],"sort":"value_desc","sort_field":"in.downtime_h","sort_stat":"sum"}),
        ("group_table","وضعیت",{"group_by":"field_value","field":"in.status","fields":["in.downtime_h"],"stats":["count","sum"],"sort":"count_desc"}),
        ("chart","سهم شیفت",{"chart":"pie","group_by":"field_value","field":"in.shift_name","value":"count","sort":"value_desc"}),
        ("chart","روزانه",{"chart":"bar","group_by":"date","value":{"field":"in.downtime_h","stat":"sum"},"sort":"label_asc","limit":30}),
    ], filters=["date_from","date_to"], is_default=True, order=0)

make_report(tab4,"گزارش آزمایشگاه — کامل",
    metrics=[{"key":"fe_avg","label":"میانگین Fe","unit":"درصد","formula":"in.fe__avg"},{"key":"w_sum","label":"جمع وزنی","unit":"","formula":"out.weighted__sum"}],
    widgets=[
        ("kpi","شاخص‌ها",{"cards":[{"kind":"count","label":"تعداد"},{"kind":"stat","field":"in.fe","stat":"avg","label":"میانگین Fe","sub_stats":["min","max"]},{"kind":"metric","metric":"fe_avg","label":"Fe میانگین"}]}),
        ("stat_table","آمار",{"sources":["out","in"],"fields":["in.fe","out.weighted","out.fe_sqrt"],"stats":["avg","min","max","count"]}),
        ("group_table","نوع نمونه",{"group_by":"field_value","field":"in.sample_type","fields":["in.fe","out.weighted"],"stats":["avg","count"],"sort":"value_desc","sort_field":"in.fe","sort_stat":"avg"}),
        ("group_table","آزمایشگاه",{"group_by":"field_value","field":"in.lab","fields":["in.fe"],"stats":["avg","count"],"sort":"count_desc"}),
        ("group_table","ساعتی",{"group_by":"hour","fields":["in.fe"],"stats":["avg"],"sort":"label_asc","limit":24}),
        ("chart","روزانه Fe",{"chart":"line","group_by":"date","value":{"field":"in.fe","stat":"avg"},"sort":"label_asc","limit":30}),
        ("chart","سهم نوع نمونه",{"chart":"pie","group_by":"field_value","field":"in.sample_type","value":"count","sort":"value_desc"}),
    ], filters=["date_from","date_to"], is_default=True, order=0)

print(f"  Reports {FactoryTabReport.objects.filter(tab__factory=fac).count()} | Widgets {FactoryTabWidget.objects.filter(report__tab__factory=fac).count()}")

# ── Records ──
def compute(tab, payload):
    return validate_and_compute(tab, {"inputs": payload})

# ensure admin for created_by
admin = User.objects.filter(is_superuser=True).first()
if not admin:
    admin = User.objects.create_superuser('admin','admin@madan.ir','Madan@1404')

# users for mega
for uname, role, pwd in [('mega_manager','manager','Madan@1404'),('mega_operator','operator','Madan@1404'),('mega_viewer','viewer','Madan@1404'),('mega_operator2','operator','Madan@1404')]:
    u,_=User.objects.get_or_create(username=uname, defaults=dict(email=f"{uname}@madan.ir", first_name="کاربر", last_name=role))
    if _.get if False else True:
        u.set_password(pwd); u.save()
    UserProfile.objects.get_or_create(user=u, defaults=dict(factory=fac, role=role))
    try:
        p=u.profile; p.factory=fac; p.role=role; p.save()
    except: pass

all_lines=list(ProductionLine.objects.filter(factory=fac).order_by("id"))
active_lines=[l for l in all_lines]
ctrs=list(Contractor.objects.filter(factory=fac))

counts={}
for tab in FactoryTab.objects.filter(factory=fac, is_active=True):
    c=0
    for i in range(90):
        d=today - timedelta(days=i)
        if rng.random()<0.08:
            continue
        if tab.key=="mega-tonnage":
            n=rng.randint(1,3)
            for _ in range(n):
                hour=f"{rng.randint(6,20):02d}:{rng.choice(['00','15','30','45'])}"
                line=rng.choice(active_lines)
                ctr=rng.choice(ctrs[:2]) if rng.random()<0.9 else ctrs[3]
                payload={"tonnage":rng.randint(12,140),"cars":rng.randint(1,5),"vehicle":rng.choice(["کفی","بونوس","تریلی","جرثقیل","کمپرسی"]),"moisture":round(rng.uniform(0.5,9.5),2)}
                if rng.random()<0.25: payload["moisture"]=round(rng.uniform(0,2),2)
                if rng.random()<0.35: payload["grade"]=rng.choice(["سنگ آهن","کنسانتره","باطله"])
                if rng.random()<0.4: payload["shift_type"]=rng.choice(["صبح","عصر","شب"])
                if rng.random()<0.15: payload["note_extra"]=rng.choice(["نمونه","تحویل فوری",""])
                try:
                    inp,out=compute(tab,payload)
                    cross=build_cross_context(tab,d,d,line)
                    # recompute with cross for tab2-like outputs but tab1 has no cross needed
                    FactoryTabRecord.objects.create(tab=tab, line=line, contractor=ctr, date_from=d, date_to=d, hour=hour, inputs=inp, outputs=out, note=rng.choice(["","تحویل نمونه","سریع"]) if rng.random()<0.3 else "", created_by=admin)
                    c+=1
                except Exception as e:
                    print(f"  ! tonnage rec: {e}")
        elif tab.key=="mega-performance":
            for line in rng.sample(active_lines, k=rng.randint(1,2)):
                if rng.random()<0.15: continue
                ctr=rng.choice(ctrs) if rng.random()<0.7 else None
                # need date range 1-4 days
                d2=d + timedelta(days=rng.randint(0,3))
                payload={"feed_fe":round(rng.uniform(38,56),2),"product_fe":round(rng.uniform(58,68),2),"sio2":round(rng.uniform(2,12),2)}
                if rng.random()<0.5: payload["feo"]=round(rng.uniform(5,18),2)
                if rng.random()<0.4: payload["grade"]=rng.choice(["گرید ۱","گرید ۲","گرید ۳","گرید ممتاز"])
                if rng.random()<0.6: payload["method"]=rng.choice(["مغناطیسی","فلوتاسیون","ثقلی"])
                else: payload["method"]="مغناطیسی"
                if rng.random()<0.3: payload["desc"]=rng.choice(["تست",""])
                try:
                    cross=build_cross_context(tab,d,d2,line)
                    if "mega_tonnage.dry_tonnage" not in cross: cross["mega_tonnage.dry_tonnage"]=rng.uniform(90,130)
                    inp,out=validate_and_compute(tab, {"inputs":payload}, cross_ctx=cross)
                    FactoryTabRecord.objects.create(tab=tab, line=line, contractor=ctr, date_from=d, date_to=d2, inputs=inp, outputs=out, note="", created_by=admin)
                    c+=1
                except Exception as e:
                    print(f"  ! perf rec: {e} payload={payload}")
        elif tab.key=="mega-shift":
            payload={"downtime_h":round(rng.uniform(0,5),2),"shift_name":rng.choice(["صبح","عصر","شب"]),"status":rng.choice(["عادی","توقف برنامه‌ریزی‌شده","خرابی","کمبود مواد"]),"overtime":round(rng.uniform(0,2),2)}
            if rng.random()<0.4: payload["line_name"]=rng.choice([l.name for l in active_lines])
            if rng.random()<0.3: payload["note_text"]=rng.choice(["توضیح نمونه","","توقف جزئی"])
            try:
                inp,out=compute(tab,payload)
                # sometimes with line, sometimes without (require_line False)
                line_choice = rng.choice(active_lines) if rng.random()<0.4 else None
                ctr_choice = rng.choice(ctrs) if rng.random()<0.2 else None
                FactoryTabRecord.objects.create(tab=tab, line=line_choice, contractor=ctr_choice, date_from=d, date_to=d, inputs=inp, outputs=out, created_by=admin)
                c+=1
            except Exception as e:
                print(f"  ! shift rec: {e}")
        elif tab.key=="mega-lab":
            # daily with hour
            hour=f"{rng.randint(7,19):02d}:{rng.choice(['00','30'])}"
            line_choice = rng.choice(active_lines) if rng.random()<0.3 else None
            payload={"sample_w":rng.randint(80,400),"fe":round(rng.uniform(25,68),2),"s":round(rng.uniform(0.1,3.5),2),"sample_type":rng.choice(["خوراک","کنسانتره","باطله","تیکنر"])}
            if rng.random()<0.5: payload["lab"]=rng.choice(["مرکزی","خط ۱","خط ۲"])
            if rng.random()<0.2: payload["comment"]=rng.choice(["نمونه ویژه",""])
            try:
                inp,out=compute(tab,payload)
                FactoryTabRecord.objects.create(tab=tab, line=line_choice, contractor=None, date_from=d, date_to=d, hour=hour, inputs=inp, outputs=out, created_by=admin)
                c+=1
            except Exception as e:
                print(f"  ! lab rec: {e}")
    counts[tab.key]=c
print(f"  Records by tab: {counts} | total {FactoryTabRecord.objects.filter(tab__factory=fac).count()}")

# ── Verify reports ──
print("\n>> Verify reports run")
for r in FactoryTabReport.objects.filter(tab__factory=fac).select_related("tab"):
    try:
        out=run_report(r.tab, r, FactoryTabRecord.objects.all(), {})
        bad=[w for w in out["widgets"] if "error" in w]
        print(f"  OK {r.tab.key} / {r.name}: records={out['record_count']} widgets={len(out['widgets'])} errors={len(bad)}")
        for w in bad:
            print(f"    ! {w['type']} {w['title']}: {w['error']}")
    except Exception as e:
        print(f"  FAIL {r.tab.key} / {r.name}: {type(e).__name__}: {e}")

# ── API smoke via APIClient ──
print("\n>> API smoke")
from rest_framework.test import APIClient
c=APIClient()
c.force_authenticate(user=admin)
def hit(path, label):
    res=c.get(path)
    ok = 200 <= res.status_code < 300
    print(f"  {'OK' if ok else 'FAIL'} {label}: {res.status_code} {path}")
    if not ok:
        try: print("    ", str(res.data)[:600])
        except: print("    ", str(res.content)[:600])
    return ok

hit("/api/factory-setup/", "factory-setup")
hit(f"/api/factory-setup/{fac.id}/", "factory detail")
# paginated
hit("/api/device-logs/?page=1", "device-logs")
hit("/api/factory-tabs/?factory=%d"%fac.id, "factory-tabs")
for tab in FactoryTab.objects.filter(factory=fac, is_active=True):
    hit(f"/api/factory-tabs/{tab.id}/schema/", f"schema {tab.key}")
    hit(f"/api/factory-tab-records/?tab={tab.id}&page=1", f"records {tab.key}")
for r in FactoryTabReport.objects.filter(tab__factory=fac):
    hit(f"/api/factory-tab-reports/{r.id}/run/", f"run report {r.tab.key}/{r.name}")
hit("/api/contractors/?factory=%d"%fac.id, "contractors")
hit("/api/shifts/?line=%d"%all_lines[0].id, "shifts")
hit("/api/factory-tab-reports/types/", "report types")
# negative: validation
print("\n>> Negative checks")
res=c.post("/api/factory-tab-records/", {"tab": tab1.id, "line": 999999, "date_from": str(today), "date_to": str(today), "hour":"10:00", "inputs":{"tonnage":10,"cars":1,"vehicle":"کفی"}}, format="json")
print(f"  invalid line expect 400: {res.status_code} -> {str(res.data)[:400]}")
res=c.post("/api/factory-tab-records/", {"tab": tab1.id, "line": all_lines[0].id, "contractor": ctrs[0].id, "date_from": str(today), "date_to": str(today-timedelta(days=1)), "hour":"10:00", "inputs":{"tonnage":10,"cars":1,"vehicle":"کفی"}}, format="json")
print(f"  invalid date_to<date_from expect 400: {res.status_code} -> {str(res.data)[:400]}")

print("\n>> DONE")
print(f"Factory: {fac.id} {fac.name}")
print(f"Lines {ProductionLine.objects.filter(factory=fac).count()} | Devices {Device.objects.filter(line__factory=fac).count()} | Shifts {Shift.objects.filter(line__factory=fac).count()}")
print(f"Logs {DeviceLog.objects.filter(line__factory=fac).count()} | Contractors {Contractor.objects.filter(factory=fac).count()}")
print(f"Tabs {FactoryTab.objects.filter(factory=fac).count()} (active {FactoryTab.objects.filter(factory=fac,is_active=True).count()})")
print(f"Reports {FactoryTabReport.objects.filter(tab__factory=fac).count()} | Widgets {FactoryTabWidget.objects.filter(report__tab__factory=fac).count()} | Records {FactoryTabRecord.objects.filter(tab__factory=fac).count()}")
print("Users: mega_manager / mega_operator / mega_operator2 / mega_viewer (pass Madan@1404) + admin")
