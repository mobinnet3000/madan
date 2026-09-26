"""Testهای گزارش تب کارخانه — ساخت گزارش/ویجت، اعتبارسنجی config و اجرای گزارش."""

from django.test import TestCase

from .tab_reports import (
    AGG_STATS,
    GROUP_BYS,
    WIDGET_TYPES,
    run_report,
    validate_widget_config,
)
from .test_analysis import FactoryFixtureMixin
from .test_factory_tabs import _tab_payload


def _report_payload(**over):
    payload = {
        "name": "گزارش جامع",
        "description": "",
        "is_default": True,
        "order": 0,
        "is_active": True,
        "filters": ["line", "contractor", "date_from", "date_to"],
        "metrics": [
            {
                "key": "recovery",
                "label": "بازیابی وزنی",
                "formula": "in.product__sum / in.feed__sum * 100",
            },
        ],
    }
    payload.update(over)
    return payload


def _seed_report(test, **over):
    """یک تب با دو خروجی + ۴ رکورد روی دو خط/دو پیمانکار می‌سازد و گزارش نمونه برمی‌گرداند."""
    tab_r = test.client.post(
        "/api/factory-tabs/", {**_tab_payload(), "factory": test.fac1.id}, format="json"
    )
    test.assertEqual(tab_r.status_code, 201, tab_r.content)
    tab_id = tab_r.data["id"]
    payload = _report_payload(tab=tab_id, **over)
    r = test.client.post("/api/factory-tab-reports/", payload, format="json")
    test.assertEqual(r.status_code, 201, r.content)
    report_id = r.data["id"]

    records = [
        ("2026-01-05", test.line1.id, test.c1.id, 100, 60),
        ("2026-01-06", test.line1.id, test.c1.id, 200, 100),
        ("2026-01-07", test.line2.id, test.c2.id, 50, 40),
        ("2026-01-08", test.line2.id, test.c2.id, 150, 60),
    ]
    for date, line, contractor, feed, product in records:
        rr = test.client.post(
            "/api/factory-tab-records/",
            {
                "tab": tab_id,
                "line_id": line,
                "contractor_id": contractor,
                "date_from": date,
                "date_to": date,
                "inputs": {"feed": feed, "product": product},
            },
            format="json",
        )
        test.assertEqual(rr.status_code, 201, rr.content)
    return tab_id, report_id


def _add_widget(test, report_id, **over):
    payload = {"widget_type": "kpi", "title": "شاخص‌ها", "order": 0, "is_active": True,
               "config": {"cards": [{"kind": "count"}]}}
    payload.update(over)
    r = test.client.post(f"/api/factory-tab-reports/{report_id}/widgets/", payload, format="json")
    test.assertEqual(r.status_code, 201, r.content)
    return r.data["id"]


class FactoryTabReportAPITests(FactoryFixtureMixin, TestCase):
    def test_create_report_and_list_by_tab(self):
        tab_r = self.client.post(
            "/api/factory-tabs/", {**_tab_payload(), "factory": self.fac1.id}, format="json"
        )
        tab_id = tab_r.data["id"]
        r = self.client.post(
            "/api/factory-tab-reports/", _report_payload(tab=tab_id), format="json"
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["metrics"][0]["key"], "recovery")
        rl = self.client.get(f"/api/factory-tab-reports/?tab={tab_id}")
        self.assertEqual(rl.status_code, 200, rl.content)
        self.assertEqual(len(rl.data), 1)
        rl2 = self.client.get("/api/factory-tab-reports/?tab=999999")
        self.assertEqual(rl2.data, [])

    def test_bad_metric_formula_rejected(self):
        tab_r = self.client.post(
            "/api/factory-tabs/", {**_tab_payload(), "factory": self.fac1.id}, format="json"
        )
        r = self.client.post(
            "/api/factory-tab-reports/",
            _report_payload(tab=tab_r.data["id"], metrics=[
                {"key": "bad", "label": "Bad", "formula": "ghost__sum * 2"}
            ]),
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_bad_filters_rejected(self):
        tab_r = self.client.post(
            "/api/factory-tabs/", {**_tab_payload(), "factory": self.fac1.id}, format="json"
        )
        r = self.client.post(
            "/api/factory-tab-reports/",
            _report_payload(tab=tab_r.data["id"], filters=["line", "nope"]),
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_cross_factory_tab_rejected(self):
        # ایزولاسیون: رکورد کارخانه دیگر نباید در گزارش این کارخانه بیاید
        _, report_id = _seed_report(self)
        tab_payload = {**_tab_payload(key="other-tab", name="تب دیگر"), "factory": self.fac2.id}
        tab_r = self.client.post("/api/factory-tabs/", tab_payload, format="json")
        self.assertEqual(tab_r.status_code, 201, tab_r.content)
        rec = self.client.post(
            "/api/factory-tab-records/",
            {
                "tab": tab_r.data["id"],
                "line_id": self.line3.id,
                "date_from": "2026-01-05",
                "date_to": "2026-01-05",
                "inputs": {"feed": 10, "product": 5},
            },
            format="json",
        )
        self.assertEqual(rec.status_code, 201, rec.content)
        r = self.client.get(f"/api/factory-tab-reports/{report_id}/run/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["record_count"], 4)

    def test_types_endpoint(self):
        r = self.client.get("/api/factory-tab-reports/types/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(set(r.data["widget_types"]), set(WIDGET_TYPES))
        self.assertEqual(set(r.data["aggregations"]), set(AGG_STATS))
        self.assertEqual(set(r.data["group_bys"]), set(GROUP_BYS))


class FactoryTabWidgetAPITests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        _, self.report_id = _seed_report(self, metrics=[])

    def test_add_kpi_widget(self):
        r = self.client.post(
            f"/api/factory-tab-reports/{self.report_id}/widgets/",
            {
                "widget_type": "kpi",
                "title": "شاخص‌ها",
                "order": 0,
                "config": {
                    "cards": [
                        {"kind": "count"},
                        {"kind": "stat", "field": "in.feed", "stat": "sum"},
                        {"kind": "metric", "metric": "x"} if False else {"kind": "stat", "field": "in.product", "stat": "avg"},
                    ]
                },
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["config"]["cards"][1]["sub_stats"], ["avg", "min", "max"])

    def test_bad_widget_type_rejected(self):
        r = self.client.post(
            f"/api/factory-tab-reports/{self.report_id}/widgets/",
            {"widget_type": "nope", "title": "X", "config": {}},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_bad_config_rejected(self):
        r = self.client.post(
            f"/api/factory-tab-reports/{self.report_id}/widgets/",
            {"widget_type": "chart", "title": "X",
             "config": {"chart": "bar", "group_by": "nope", "value": "count"}},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_patch_and_delete_widget(self):
        wid = _add_widget(self, self.report_id)
        r = self.client.patch(
            f"/api/factory-tab-reports/{self.report_id}/widgets/{wid}/",
            {"title": "شاخص‌های اصلی"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["title"], "شاخص‌های اصلی")
        d = self.client.delete(f"/api/factory-tab-reports/{self.report_id}/widgets/{wid}/")
        self.assertEqual(d.status_code, 200, d.content)


class FactoryTabReportRunTests(FactoryFixtureMixin, TestCase):
    def test_full_sample_report(self):
        _, report_id = _seed_report(self)
        _add_widget(
            self, report_id,
            widget_type="kpi", title="شاخص‌ها", order=0,
            config={"cards": [
                {"kind": "count"},
                {"kind": "stat", "field": "in.feed", "stat": "sum", "label": "جمع خوراک"},
                {"kind": "metric", "metric": "recovery", "label": "بازیابی وزنی"},
            ]},
        )
        _add_widget(
            self, report_id,
            widget_type="stat_table", title="آمار فیلدها", order=1,
            config={"sources": ["out", "in"], "stats": ["sum", "avg", "min", "max", "count"]},
        )
        _add_widget(
            self, report_id,
            widget_type="group_table", title="به تفکیک خط", order=2,
            config={"group_by": "line", "fields": ["in.feed"], "stats": ["sum", "avg"]},
        )
        _add_widget(
            self, report_id,
            widget_type="chart", title="روند روزانه", order=3,
            config={"chart": "line", "group_by": "date",
                    "value": {"field": "in.feed", "stat": "sum"}},
        )
        r = self.client.get(f"/api/factory-tab-reports/{report_id}/run/")
        self.assertEqual(r.status_code, 200, r.content)
        data = r.data
        self.assertEqual(data["record_count"], 4)

        kpi = next(w for w in data["widgets"] if w["type"] == "kpi")
        cards = {c["label"]: c["value"] for c in kpi["data"]["cards"]}
        self.assertEqual(cards["تعداد رکورد"], 4)
        self.assertAlmostEqual(cards["جمع خوراک"], 500.0)
        self.assertAlmostEqual(cards["بازیابی وزنی"], 52.0)

        stat = next(w for w in data["widgets"] if w["type"] == "stat_table")
        by_field = {row["field"]: row for row in stat["data"]["rows"]}
        self.assertAlmostEqual(by_field["in.feed"]["sum"], 500.0)
        self.assertAlmostEqual(by_field["in.feed"]["avg"], 125.0)
        self.assertEqual(by_field["in.feed"]["count"], 4)
        self.assertAlmostEqual(by_field["out.recovery"]["max"], 80.0)

        grp = next(w for w in data["widgets"] if w["type"] == "group_table")
        self.assertEqual(len(grp["data"]["rows"]), 2)
        row1 = next(x for x in grp["data"]["rows"] if x["label"] == "خط ۱")
        self.assertEqual(row1["count"], 2)
        self.assertAlmostEqual(row1["in.feed__sum"], 300.0)
        self.assertEqual(grp["data"]["total"]["count"], 4)

        chart = next(w for w in data["widgets"] if w["type"] == "chart")
        self.assertEqual(chart["data"]["chart"], "line")
        self.assertEqual(len(chart["data"]["points"]), 4)
        self.assertEqual(chart["data"]["points"][0]["value"], 100.0)

    def test_run_with_filters(self):
        _, report_id = _seed_report(self)
        _add_widget(self, report_id)
        r = self.client.get(
            f"/api/factory-tab-reports/{report_id}/run/?line={self.line1.id}"
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["record_count"], 2)
        self.assertEqual(r.data["filters_applied"], {"line": str(self.line1.id)})

        r2 = self.client.get(
            f"/api/factory-tab-reports/{report_id}/run/?date_from=2026-01-07&date_to=2026-01-08"
        )
        self.assertEqual(r2.data["record_count"], 2)

        r3 = self.client.get(
            f"/api/factory-tab-reports/{report_id}/run/?date_from=2026-02-01"
        )
        self.assertEqual(r3.data["record_count"], 0)

    def test_empty_records_widgets_still_render(self):
        _, report_id = _seed_report(self)
        _add_widget(self, report_id)
        r = self.client.get(
            f"/api/factory-tab-reports/{report_id}/run/?date_from=2030-01-01"
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["record_count"], 0)
        kpi = next(w for w in r.data["widgets"] if w["type"] == "kpi")
        self.assertEqual(kpi["data"]["cards"][0]["value"], 0)
        for m in r.data["metrics"]:
            self.assertIsNone(m["value"])

    def test_contractor_pie_and_month_group(self):
        _, report_id = _seed_report(self)
        _add_widget(
            self, report_id,
            widget_type="chart", title="سهم پیمانکار", order=0,
            config={"chart": "pie", "group_by": "contractor", "value": "count"},
        )
        _add_widget(
            self, report_id,
            widget_type="group_table", title="ماهانه", order=1,
            config={"group_by": "month",
                    "fields": ["in.feed"], "stats": ["sum"]},
        )
        r = self.client.get(f"/api/factory-tab-reports/{report_id}/run/")
        pie = next(w for w in r.data["widgets"] if w["title"] == "سهم پیمانکار")
        self.assertEqual(pie["data"]["chart"], "pie")
        by_label = {p["label"]: p["value"] for p in pie["data"]["points"]}
        self.assertEqual(by_label["پیمانکار A"], 2)
        self.assertEqual(by_label["پیمانکار B"], 2)
        month = next(w for w in r.data["widgets"] if w["title"] == "ماهانه")
        self.assertEqual(len(month["data"]["rows"]), 1)
        self.assertEqual(month["data"]["rows"][0]["label"], "2026-01")

    def test_direct_run_report_service(self):
        from machines.models import FactoryTabRecord, FactoryTabReport

        tab_id, report_id = _seed_report(self)
        from machines.models import FactoryTab

        tab = FactoryTab.objects.get(pk=tab_id)
        report = FactoryTabReport.objects.get(pk=report_id)
        out = run_report(tab, report, FactoryTabRecord.objects.all(), {})
        self.assertEqual(out["record_count"], 4)
        self.assertEqual(out["metrics"][0]["key"], "recovery")
