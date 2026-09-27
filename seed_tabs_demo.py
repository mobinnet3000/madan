"""سید تب‌ها و گزارش‌ها — همه حالات (تناژ روزانه/عملکرد بازه‌ای/شیفت انتخابی/تب خالی)."""
import argparse
import os
import random
from datetime import date, timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from machines.models import (  # noqa: E402
    Contractor,
    Factory,
    FactoryTab,
    FactoryTabInput,
    FactoryTabOutput,
    FactoryTabRecord,
    FactoryTabReport,
    FactoryTabWidget,
)
from machines.tab_reports import run_report  # noqa: E402
from machines.factory_tabs import validate_and_compute  # noqa: E402

SEED = 20260926


def compute(tab, payload):
    return validate_and_compute(tab, {"inputs": payload})


def make_tab(factory, key, name, description, record_type, require_line,
             contractor_required, inputs, outputs, order=0, is_active=True,
             icon="layers", color="slate"):
    tab, created = FactoryTab.objects.get_or_create(
        factory=factory, key=key,
        defaults=dict(
            name=name, description=description, record_type=record_type,
            require_line=require_line, contractor_required=contractor_required,
            order=order, is_active=is_active, icon=icon, color=color,
        ),
    )
    if not created:
        tab.icon, tab.color = icon, color
        tab.save(update_fields=["icon", "color"])
    for idx, spec in enumerate(inputs):
        FactoryTabInput.objects.create(
            tab=tab, key=spec["key"], name=spec["name"],
            input_type=spec.get("input_type", "number"),
            options=spec.get("options", []),
            unit=spec.get("unit", ""), required=spec.get("required", True),
            order=idx,
        )
    for idx, spec in enumerate(outputs):
        FactoryTabOutput.objects.create(
            tab=tab, key=spec["key"], name=spec["name"],
            unit=spec.get("unit", ""), formula=spec["formula"], order=idx,
        )
    return tab


def add_widgets(report, widgets):
    for idx, (wtype, title, config) in enumerate(widgets):
        FactoryTabWidget.objects.create(
            report=report, widget_type=wtype, title=title,
            order=idx, is_active=True, config=config,
        )


def make_report(tab, name, metrics, widgets, filters, is_default=False, order=0, description=""):
    report = FactoryTabReport.objects.create(
        tab=tab, name=name, description=description, is_default=is_default,
        order=order, is_active=True, filters=filters, metrics=metrics,
    )
    add_widgets(report, widgets)
    return report


def seed_tonnage_tab(factory, order=0):
    tab = make_tab(
        factory, "factory-tonnage", "تناژ تحویلی (جایگزین تب قدیم)",
        "تحویل روزانه با ساعت و نوع خودرو — جایگزین DeliveredTonnage.", "daily", True, True,
        inputs=[
            {"key": "tonnage", "name": "تناژ تحویلی", "unit": "تن"},
            {"key": "cars", "name": "تعداد کامیون", "unit": "دستگاه"},
            {"key": "grade", "name": "نام مواد", "input_type": "text", "required": False},
            {"key": "vehicle", "name": "نوع خودرو", "input_type": "select",
             "options": ["کفی", "بونوس", "تریلی", "جرثقیل"], "required": True},
            {"key": "moisture", "name": "رطوبت", "unit": "درصد", "required": False},
        ],
        outputs=[
            {"key": "avg_per_car", "name": "میانگین هر خودرو", "unit": "تن", "formula": "tonnage / cars"},
        ],
        order=order, icon="truck", color="emerald",
    )
    make_report(
        tab, "گزارش تحویل روزانه",
        metrics=[
            {"key": "total_tonnage_sum", "label": "جمع تناژ کل", "unit": "تن", "formula": "in.tonnage__sum"},
            {"key": "avg_per_car", "label": "میانگین هر خودرو", "unit": "تن", "formula": "in.tonnage__sum / in.cars__sum"},
        ],
        widgets=[
            ("kpi", "شاخص‌های تحویل", {"cards": [
                {"kind": "count", "label": "تعداد تحویل"},
                {"kind": "stat", "field": "in.tonnage", "stat": "sum", "label": "جمع تناژ", "sub_stats": ["avg", "min", "max"]},
                {"kind": "metric", "metric": "avg_per_car", "label": "میانگین هر خودرو"},
            ]}),
            ("chart", "توزیع ساعتی تحویل", {"chart": "bar", "group_by": "hour", "value": "count", "sort": "label_asc", "limit": 24}),
            ("chart", "سهم تناژ هر ساعت", {"chart": "pie", "group_by": "hour", "value": {"field": "in.tonnage", "stat": "sum"}, "sort": "value_desc", "limit": 12}),
            ("group_table", "توزیع ساعتی رکوردها", {"group_by": "hour", "fields": ["in.tonnage"], "stats": ["sum", "count"], "sort": "label_asc"}),
            ("group_table", "تفکیک نوع خودرو", {"group_by": "field_value", "field": "in.vehicle", "fields": ["in.tonnage", "in.cars"], "stats": ["sum", "avg"], "sort": "value_desc", "sort_field": "in.tonnage", "sort_stat": "sum"}),
            ("group_table", "ماهانه", {"group_by": "month", "fields": ["in.tonnage"], "stats": ["sum"], "sort": "label_asc"}),
        ],
        filters=["line", "contractor", "date_from", "date_to"], is_default=True,
    )
    return tab

def seed_performance_tab(factory, order=1):
    tab = make_tab(
        factory, "factory-performance", "عملکرد بخش تولید (جایگزین تب قدیم)",
        "عملکرد بخش تولید — جایگزین ActualAnalysis.", "range", True, True,
        inputs=[
            {"key": "feed_fe", "name": "Fe خوراک", "unit": "درصد"},
            {"key": "product_fe", "name": "Fe محصول", "unit": "درصد"},
            {"key": "feo", "name": "FeO", "unit": "درصد", "required": False},
            {"key": "sio2", "name": "SiO₂", "unit": "درصد", "required": False},
        ],
        outputs=[
            {"key": "recovery", "name": "بازیابی", "unit": "درصد", "formula": "product_fe / feed_fe * 100"},
            {"key": "grade_gap", "name": "اختلاف عیار", "unit": "درصد", "formula": "product_fe - feed_fe"},
        ],
        order=order, icon="gauge", color="amber",
    )
    make_report(
        tab, "گزارش عملکرد",
        metrics=[
            {"key": "recovery_avg", "label": "میانگین بازیابی", "unit": "درصد", "formula": "out.recovery__avg"},
            {"key": "gap_avg", "label": "میانگین اختلاف عیار", "unit": "درصد", "formula": "out.grade_gap__avg"},
        ],
        widgets=[
            ("kpi", "شاخص‌ها", {"cards": [
                {"kind": "count", "label": "تعداد رکورد"},
                {"kind": "stat", "field": "out.recovery", "stat": "avg", "label": "میانگین بازیابی", "sub_stats": ["min", "max"]},
                {"kind": "metric", "metric": "gap_avg", "label": "اختلاف عیار"},
            ]}),
            ("stat_table", "آمار پارامترها", {"sources": ["out", "in"], "stats": ["sum", "avg", "min", "max", "count"]}),
            ("group_table", "به تفکیک خط", {"group_by": "line", "fields": ["out.recovery", "in.feed_fe"], "stats": ["avg"], "sort": "count_desc"}),
            ("group_table", "هفتگی", {"group_by": "week", "fields": ["out.recovery"], "stats": ["avg"], "sort": "label_asc", "limit": 12}),
            ("chart", "روند روزانه بازیابی", {"chart": "line", "group_by": "date", "value": {"field": "out.recovery", "stat": "avg"}, "sort": "label_asc", "limit": 30}),
            ("chart", "ماهانه", {"chart": "bar", "group_by": "month", "value": {"field": "out.recovery", "stat": "avg"}, "sort": "label_asc", "limit": 12}),
            ("chart", "سهم خط‌ها", {"chart": "pie", "group_by": "line", "value": {"field": "out.recovery", "stat": "avg"}, "sort": "value_desc", "limit": 10}),
        ],
        filters=["line", "contractor", "date_from", "date_to"], is_default=True,
    )
    return tab

def seed_tonnage_tab_alias(factory, order):
    return seed_tonnage_tab(factory, order)

def seed_performance_tab_alias(factory, order):
    return seed_performance_tab(factory, order)


def seed_shift_tab(factory, order=2):
    tab = make_tab(
        factory, "shift-report", "گزارش شیفت‌ها",
        "رکورد ساده با انتخاب نوع شیفت و وضعیت.", "range", False, False,
        inputs=[
            {"key": "downtime_h", "name": "ساعت توقف", "unit": "ساعت"},
            {"key": "shift_name", "name": "شیفت", "input_type": "select", "options": ["صبح", "عصر", "شب"], "required": True},
            {"key": "status", "name": "وضعیت", "input_type": "select", "options": ["عادی", "توقف برنامه‌ریزی‌شده", "خرابی"], "required": True},
            {"key": "note_text", "name": "توضیح", "input_type": "text", "required": False},
        ],
        outputs=[
            {"key": "downtime_ratio", "name": "نسبت توقف", "formula": "downtime_h / 8 * 100"},
        ],
        order=order, icon="clock", color="amber",
    )
    make_report(
        tab, "گزارش توقف شیفت‌ها",
        metrics=[
            {"key": "avg_downtime", "label": "میانگین توقف", "unit": "ساعت", "formula": "in.downtime_h__avg"},
            {"key": "max_downtime", "label": "بیشترین توقف", "unit": "ساعت", "formula": "in.downtime_h__max"},
        ],
        widgets=[
            ("kpi", "شاخص‌ها", {"cards": [
                {"kind": "count", "label": "تعداد رکورد"},
                {"kind": "stat", "field": "in.downtime_h", "stat": "sum", "label": "جمع توقف", "sub_stats": ["avg", "max"]},
                {"kind": "metric", "metric": "avg_downtime", "label": "میانگین توقف"},
            ]}),
            ("group_table", "به تفکیک شیفت", {"group_by": "field_value", "field": "in.shift_name", "fields": ["in.downtime_h"], "stats": ["sum", "avg", "count"], "sort": "value_desc", "sort_field": "in.downtime_h", "sort_stat": "sum"}),
            ("group_table", "به تفکیک وضعیت", {"group_by": "field_value", "field": "in.status", "fields": ["in.downtime_h"], "stats": ["count", "sum"], "sort": "count_desc"}),
            ("chart", "سهم شیفت‌ها", {"chart": "pie", "group_by": "field_value", "field": "in.shift_name", "value": "count", "sort": "value_desc"}),
            ("chart", "توقف روزانه", {"chart": "bar", "group_by": "date", "value": {"field": "in.downtime_h", "stat": "sum"}, "sort": "label_asc", "limit": 20}),
        ],
        filters=["date_from", "date_to"],
    )
    return tab


def seed_empty_tab(factory, order=3):
    return make_tab(factory, "empty-scratch", "تب خالی (پیش‌نویس)", "بدون ورودی/خروجی.", "range", False, False, inputs=[], outputs=[], order=order, is_active=False)


def seed_records(factory, days=90):
    lines = list(factory.lines.order_by("id")[:2])
    contractors = list(Contractor.objects.filter(factory=factory))
    if not contractors:
        contractors = [Contractor.objects.create(factory=factory, name="پیمانکار نمونه")]
    if len(contractors) < 2:
        contractors.append(Contractor.objects.get_or_create(factory=factory, name="پیمانکار دوم")[0])
    rng = random.Random(SEED)
    today = date.today()
    counts = {}
    for tab in FactoryTab.objects.filter(factory=factory):
        key = tab.key
        created = 0
        for i in range(days):
            d = today - timedelta(days=i)
            if rng.random() < 0.08:
                continue
            if key == "tonnage-delivery":
                n = rng.randint(1, 3)
                for _ in range(n):
                    hour = f"{rng.randint(6, 20):02d}:{rng.choice(['00', '30'])}"
                    line = rng.choice(lines) if rng.random() < 0.85 else None
                    contractor = rng.choice(contractors) if rng.random() < 0.85 else None
                    # خط/پیمانکار الزامی است ولی گاهی None می‌گذاریم تا رفع باگ validation را تست کنیم — فقط یکی را شانسی None می‌کنیم
                    if line is None:
                        line = lines[0]
                    if contractor is None:
                        contractor = contractors[0]
                    payload = {"tonnage": rng.randint(15, 120), "cars": rng.randint(1, 4), "vehicle": rng.choice(["کفی", "بونوس", "تریلی", "جرثقیل"])}
                    if rng.random() < 0.4:
                        payload["grade"] = rng.choice(["سنگ آهن", "کنسانتره"])
                    if rng.random() < 0.3:
                        payload["moisture"] = round(rng.uniform(1, 9), 2)
                    # یک رکورد عمدا بدون grade/moisture می‌ماند
                    try:
                        inputs, outputs = compute(tab, payload)
                    except Exception as e:  # noqa: BLE001
                        print(f"  ! tonnage compute: {e}")
                        continue
                    FactoryTabRecord.objects.create(tab=tab, line=line, contractor=contractor, date_from=d, date_to=d, hour=hour, inputs=inputs, outputs=outputs, note="تحویل نمونه")
                    created += 1
            elif key == "line-performance":
                for line in lines:
                    if rng.random() < 0.12:
                        continue
                    contractor = rng.choice(contractors) if rng.random() < 0.9 else contractors[0]
                    payload = {
                        "feed_t": rng.randint(800, 2200), "product_t": rng.randint(350, 1700),
                        "feed_fe": round(rng.uniform(42, 55), 2), "product_fe": round(rng.uniform(58, 66), 2),
                    }
                    payload["waste_t"] = payload["feed_t"] - payload["product_t"]
                    if rng.random() < 0.5:
                        payload["grade"] = rng.choice(["گرید ۱", "گرید ۲", "گرید ۳"])
                    try:
                        inputs, outputs = compute(tab, payload)
                    except Exception as e:  # noqa: BLE001
                        print(f"  ! perf compute: {e}")
                        continue
                    FactoryTabRecord.objects.create(tab=tab, line=line, contractor=contractor, date_from=d, date_to=d, inputs=inputs, outputs=outputs, note="عملکرد نمونه")
                    created += 1
            elif key == "shift-report":
                # بدون خط/پیمانکار مجاز؛ یک رکورد در روز
                payload = {
                    "downtime_h": round(rng.uniform(0, 4), 2),
                    "shift_name": rng.choice(["صبح", "عصر", "شب"]),
                    "status": rng.choice(["عادی", "توقف برنامه‌ریزی‌شده", "خرابی"]),
                }
                if rng.random() < 0.4:
                    payload["note_text"] = rng.choice(["توضیح نمونه", ""])
                try:
                    inputs, outputs = compute(tab, payload)
                except Exception as e:  # noqa: BLE001
                    print(f"  ! shift compute: {e}")
                    continue
                FactoryTabRecord.objects.create(tab=tab, line=None, contractor=None, date_from=d, date_to=d, inputs=inputs, outputs=outputs)
                created += 1
            else:
                # empty-scratch: بدون رکورد
                pass
        counts[key] = created
    return counts


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="حذف تب‌ها/گزارش‌ها/رکوردهای قبلی")
    args = parser.parse_args()
    if args.reset:
        FactoryTabWidget.objects.all().delete()
        FactoryTabReport.objects.all().delete()
        FactoryTabRecord.objects.all().delete()
        FactoryTabInput.objects.all().delete()
        FactoryTabOutput.objects.all().delete()
        FactoryTab.objects.all().delete()
        print("reset done")
    factory = Factory.objects.order_by("id").first()
    if factory is None:
        print("No factory. Run: python seed_demo.py")
        return
    random.seed(SEED)
    tonnage = seed_tonnage_tab(factory, order=0)
    performance = seed_performance_tab(factory, order=1)
    shift = seed_shift_tab(factory, order=2)
    seed_empty_tab(factory, order=3)
    print(f"Tabs seeded for {factory.name}")
    counts = seed_records(factory, days=90)
    print(f"Tabs: {FactoryTab.objects.filter(factory=factory).count()} | reports: {FactoryTabReport.objects.filter(tab__factory=factory).count()} | widgets: {FactoryTabWidget.objects.filter(report__tab__factory=factory).count()}")
    print(f"Records by tab: {counts} | total: {FactoryTabRecord.objects.filter(tab__factory=factory).count()}")
    for report in FactoryTabReport.objects.filter(tab__factory=factory).select_related("tab"):
        try:
            out = run_report(report.tab, report, FactoryTabRecord.objects.all(), {})
        except Exception as e:  # noqa: BLE001
            print(f"  ! report '{report.name}': {type(e).__name__}: {e}")
            continue
        bad = [w for w in out["widgets"] if "error" in w]
        print(f"  report '{report.name}': records={out['record_count']} widgets={len(out['widgets'])} errors={len(bad)}")
        for w in bad:
            print(f"    ! {w['type']} {w['title']}: {w['error']}")


if __name__ == "__main__":
    main()
