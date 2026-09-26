"""تست end-to-end سید: گزارش‌های تولیدشده باید روی API سالم اجرا شوند."""
from django.test import TestCase

from .models import FactoryTab, FactoryTabRecord, FactoryTabReport
from .tab_reports import run_report
from .test_analysis import FactoryFixtureMixin


class SeededReportsRunTests(FactoryFixtureMixin, TestCase):
    def _make_report(self, tab, name, metrics, widgets, filters):
        r = self.client.post(
            "/api/factory-tab-reports/",
            {"tab": tab.id, "name": name, "filters": filters, "metrics": metrics},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        for i, (wtype, title, config) in enumerate(widgets):
            w = self.client.post(
                f"/api/factory-tab-reports/{r.data['id']}/widgets/",
                {"widget_type": wtype, "title": title, "order": i, "config": config},
                format="json",
            )
            self.assertEqual(w.status_code, 201, w.content)
        return r.data["id"]

    def test_all_four_widget_types_on_one_report(self):
        tab = FactoryTab.objects.create(
            factory=self.fac1, key="all-widgets", name="تب همه ویجت‌ها",
            require_line=True, contractor_required=False,
        )
        from .models import FactoryTabInput, FactoryTabOutput

        FactoryTabInput.objects.create(tab=tab, key="feed", name="خوراک", input_type="number", unit="تن")
        FactoryTabInput.objects.create(tab=tab, key="grade", name="گرید", input_type="text", required=False)
        FactoryTabInput.objects.create(tab=tab, key="sh", name="شیفت", input_type="select", options=["صبح", "شب"])
        FactoryTabOutput.objects.create(tab=tab, key="ratio", name="نسبت", formula="feed / 100")

        for i, (line, d, feed) in enumerate([
            (self.line1, "2026-03-01", 100), (self.line1, "2026-03-01", 200),
            (self.line2, "2026-03-08", 50), (self.line2, "2026-03-15", 300),
        ]):
            rec = self.client.post(
                "/api/factory-tab-records/",
                {"tab": tab.id, "line_id": line.id, "date_from": d, "date_to": d,
                 "contractor_id": self.c1.id,
                 "inputs": {"feed": feed, "sh": "صبح" if i % 2 else "شب", "grade": "الف"}},
                format="json",
            )
            self.assertEqual(rec.status_code, 201, rec.content)

        rid = self._make_report(
            tab, "همه ویجت‌ها",
            [{"key": "avg_feed", "label": "میانگین خوراک", "formula": "in.feed__avg"}],
            [
                ("kpi", "KPI", {"cards": [
                    {"kind": "count"},
                    {"kind": "stat", "field": "in.feed", "stat": "sum", "sub_stats": ["avg", "min", "max"]},
                    {"kind": "metric", "metric": "avg_feed"},
                ]}),
                ("stat_table", "آمار", {"sources": ["out", "in"], "stats": ["sum", "avg", "min", "max", "count"]}),
                ("group_table", "خط", {"group_by": "line", "fields": ["in.feed"], "stats": ["sum", "avg"]}),
                ("group_table", "شیفت", {"group_by": "field_value", "field": "in.sh", "fields": ["in.feed"], "stats": ["count"]}),
                ("chart", "روز", {"chart": "bar", "group_by": "date", "value": {"field": "in.feed", "stat": "sum"}}),
                ("chart", "پیمانکار", {"chart": "pie", "group_by": "contractor", "value": "count"}),
                ("chart", "هفته", {"chart": "line", "group_by": "week", "value": {"field": "in.feed", "stat": "avg"}}),
                ("chart", "ماه", {"chart": "bar", "group_by": "month", "value": "count"}),
            ],
            ["line", "contractor", "date_from", "date_to"],
        )
        r = self.client.get(f"/api/factory-tab-reports/{rid}/run/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["record_count"], 4)
        self.assertEqual(len(r.data["widgets"]), 8)
        for w in r.data["widgets"]:
            self.assertNotIn("error", w, msg=f"{w['type']} {w['title']}: {w.get('error')}")
        kpi = next(w for w in r.data["widgets"] if w["type"] == "kpi")
        cards = {c["label"]: c["value"] for c in kpi["data"]["cards"]}
        self.assertEqual(cards["تعداد رکورد"], 4)
        self.assertEqual(cards["خوراک"], 650.0)
        self.assertEqual(cards["avg_feed"], 162.5)

    def test_manual_config_without_validate_still_runs(self):
        """کانفیگ دستی/قدیمی که از validate عبور نکرده نباید ۵۰۰ بدهد."""
        tab = FactoryTab.objects.create(factory=self.fac1, key="raw-cfg", name="کانفیگ خام")
        from .models import FactoryTabInput

        FactoryTabInput.objects.create(tab=tab, key="feed", name="خوراک", input_type="number")
        FactoryTabRecord.objects.create(tab=tab, line=self.line1, date_from="2026-03-01",
                                        date_to="2026-03-01", inputs={"feed": 10}, outputs={})
        report = FactoryTabReport.objects.create(tab=tab, name="خام", filters=[])
        # کانفیگ ناقص: بدون limit و بدون sort که فقط validate آن‌ها را پر می‌کند
        from .models import FactoryTabWidget

        FactoryTabWidget.objects.create(report=report, widget_type="chart", title="خام",
                                        config={"group_by": "date", "value": "count"})
        FactoryTabWidget.objects.create(report=report, widget_type="kpi", title="ناقص",
                                        config={"cards": [{"kind": "count"}]})
        out = run_report(tab, report, FactoryTabRecord.objects.all(), {})
        self.assertEqual(len(out["widgets"]), 2)
        for w in out["widgets"]:
            self.assertNotIn("error", w, msg=f"{w['title']}: {w.get('error')}")

    def test_legacy_config_kept_in_db(self):
        """کانفیگ قدیمی در DB نباید هنگام اجرا بازنویسی/حذف شود."""
        tab = FactoryTab.objects.create(factory=self.fac1, key="legacy", name="قدیمی")
        from .models import FactoryTabInput, FactoryTabWidget

        FactoryTabInput.objects.create(tab=tab, key="feed", name="خوراک", input_type="number")
        FactoryTabRecord.objects.create(tab=tab, line=self.line1, date_from="2026-03-01",
                                        date_to="2026-03-01", inputs={"feed": 10}, outputs={})
        report = FactoryTabReport.objects.create(tab=tab, name="قدیمی", filters=[])
        w = FactoryTabWidget.objects.create(report=report, widget_type="chart", title="خام",
                                            config={"group_by": "date", "value": "count"})
        run_report(tab, report, FactoryTabRecord.objects.all(), {})
        w.refresh_from_db()
        self.assertEqual(w.config, {"group_by": "date", "value": "count"})

    def test_select_text_not_in_numeric_aggregations(self):
        tab = FactoryTab.objects.create(factory=self.fac1, key="mixed", name="مختلط")
        from .models import FactoryTabInput

        FactoryTabInput.objects.create(tab=tab, key="feed", name="خوراک", input_type="number")
        FactoryTabInput.objects.create(tab=tab, key="sh", name="شیفت", input_type="select",
                                       options=["صبح", "شب"])
        FactoryTabRecord.objects.create(tab=tab, line=self.line1, date_from="2026-03-01",
                                        date_to="2026-03-01",
                                        inputs={"feed": 10, "sh": "صبح"}, outputs={})
        report = FactoryTabReport.objects.create(tab=tab, name="مختلط", filters=[])
        from .models import FactoryTabWidget

        FactoryTabWidget.objects.create(
            report=report, widget_type="stat_table", title="آمار",
            config={"sources": ["in"], "stats": ["sum", "count"]},
        )
        out = run_report(tab, report, FactoryTabRecord.objects.all(), {})
        w = out["widgets"][0]
        self.assertNotIn("error", w, msg=w.get("error"))
        rows = {r["field"]: r for r in w["data"]["rows"]}
        self.assertIn("in.feed", rows)
        self.assertNotIn("in.sh", rows)

    def test_metric_divide_by_zero_returns_null_with_error(self):
        tab = FactoryTab.objects.create(factory=self.fac1, key="zero", name="صفر")
        from .models import FactoryTabInput

        FactoryTabInput.objects.create(tab=tab, key="feed", name="خوراک", input_type="number")
        FactoryTabRecord.objects.create(tab=tab, line=self.line1, date_from="2026-03-01",
                                        date_to="2026-03-01", inputs={"feed": 0}, outputs={})
        report = FactoryTabReport.objects.create(
            tab=tab, name="صفر", filters=[],
            metrics=[{"key": "r", "label": "نسبت", "formula": "in.feed__sum / record_count * 2"}],
        )
        out = run_report(tab, report, FactoryTabRecord.objects.all(), {})
        self.assertEqual(out["metrics"][0]["value"], 0.0)
        self.assertIsNone(out["metrics"][0]["error"])

    def test_metric_true_division_by_zero_null(self):
        tab = FactoryTab.objects.create(factory=self.fac1, key="divzero", name="تقسیم صفر")
        report = FactoryTabReport.objects.create(
            tab=tab, name="تقسیم صفر", filters=[],
            metrics=[{"key": "bad", "label": "بد", "formula": "1 / 0"}],
        )
        out = run_report(tab, report, FactoryTabRecord.objects.all(), {})
        self.assertIsNone(out["metrics"][0]["value"])
        self.assertTrue(out["metrics"][0]["error"])
