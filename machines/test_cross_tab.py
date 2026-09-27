"""تست ارجاع بین‌تبی — فرمول خروجی یک تب می‌تواند به ورودی/خروجی تب‌های دیگر ارجاع دهد."""

from django.test import TestCase

from .factory_tabs import (
    build_cross_context,
    cross_tab_refs,
    formula_variables_for_tab,
    norm_tab_key,
    other_tabs,
    validate_and_compute,
    validate_formula_for_tab,
    validate_output_formula_for_tab,
)
from .tab_reports import _field_refs, _split_ref, run_report, validate_widget_config
from .test_analysis import FactoryFixtureMixin
from .models import FactoryTab, FactoryTabInput, FactoryTabOutput, FactoryTabRecord


def _make_tab(factory, key, name, inputs, outputs, **kw):
    tab = FactoryTab.objects.create(
        factory=factory, key=key, name=name,
        record_type=kw.get("record_type", "range"),
        require_line=kw.get("require_line", True),
        contractor_required=kw.get("contractor_required", False),
        order=kw.get("order", 0),
    )
    for i, (k, n, itype) in enumerate(inputs):
        FactoryTabInput.objects.create(
            tab=tab, key=k, name=n, input_type=itype,
            options=kw.get("options", {}).get(k, []), order=i,
        )
    for o in outputs:
        FactoryTabOutput.objects.create(
            tab=tab, key=o[0], name=o[1], formula=o[2],
        )
    return tab


class CrossTabRefTests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.src = _make_tab(
            self.fac1, "tonnage-delivery", "تناژ تحویلی",
            [("tonnage", "تناژ", "number"), ("cars", "کامیون", "number")],
            [("avg_per_car", "میانگین هر خودرو", "tonnage / cars")],
        )
        self.dst = _make_tab(
            self.fac1, "line-performance", "عملکرد خط",
            [("feed_t", "خوراک", "number")],
            [("recovery", "بازیابی", "product_t / feed_t * 100"),
             ("ratio", "نسبت", "tonnage_delivery.tonnage / feed_t")],
        )

    def test_norm_key_dash_to_underscore(self):
        self.assertEqual(norm_tab_key("tonnage-delivery"), "tonnage_delivery")
        self.assertEqual(norm_tab_key("plain"), "plain")

    def test_other_tabs_excludes_self(self):
        others = list(other_tabs(self.dst))
        self.assertEqual([t.id for t in others], [self.src.id])
        others_src = list(other_tabs(self.src))
        self.assertEqual([t.id for t in others_src], [self.dst.id])

    def test_other_tabs_empty_when_alone(self):
        from .models import FactoryTab as T
        lonely = T.objects.create(factory=self.fac2, key="lonely", name="تنها")
        self.assertEqual(list(other_tabs(lonely)), [])

    def test_formula_vars_include_other_tab_fields(self):
        vars_ = {v["var"] for v in formula_variables_for_tab(self.dst)}
        self.assertIn("feed_t", vars_)
        self.assertIn("recovery", vars_)
        self.assertIn("tonnage_delivery.tonnage", vars_)
        self.assertIn("tonnage_delivery.avg_per_car", vars_)
        groups = {v["group"] for v in formula_variables_for_tab(self.dst)}
        self.assertTrue(any("تناژ تحویلی" in g for g in groups))

    def test_formula_vars_exclude_non_numeric_inputs(self):
        cat_tab = _make_tab(
            self.fac1, "cat-tab", "دسته‌ای",
            [("txt", "متن", "text"), ("sel", "انتخابی", "select")],
            [],
        )
        vars_ = {v["var"] for v in formula_variables_for_tab(cat_tab)}
        self.assertNotIn("txt", vars_)
        self.assertNotIn("sel", vars_)

    def test_cross_tab_refs_labels(self):
        refs = cross_tab_refs(self.dst)
        self.assertIn("tonnage_delivery.tonnage", refs)
        self.assertIn("تناژ", refs["tonnage_delivery.tonnage"])
        self.assertNotIn("tonnage-delivery.tonnage", refs)

    def test_validate_formula_accepts_cross_ref(self):
        self.assertEqual(validate_formula_for_tab(self.dst, "tonnage_delivery.tonnage * 2"), [])

    def test_validate_formula_rejects_unknown_field_of_other_tab(self):
        errs = validate_formula_for_tab(self.dst, "tonnage_delivery.ghost * 2")
        self.assertTrue(errs)
        self.assertIn("ghost", " ".join(errs))

    def test_validate_formula_rejects_unknown_tab(self):
        errs = validate_formula_for_tab(self.dst, "ghost_tab.feed_t * 2")
        self.assertTrue(errs)

    def test_validate_formula_rejects_select_input(self):
        sel_tab = _make_tab(
            self.fac1, "sel-tab", "انتخابی",
            [("s", "وضعیت", "select")],
            [("x", "متریک", "s * 2")],
        )
        FactoryTabInput.objects.filter(tab=sel_tab, key="s").update(options=["الف", "ب"])
        with self.assertRaises(ValueError):
            validate_output_formula_for_tab(sel_tab)

    def test_split_ref_three_parts(self):
        self.assertEqual(_split_ref("out.feed"), ("out", "feed"))
        self.assertEqual(_split_ref("tonnage_delivery.in.tonnage"), ("in", "tonnage_delivery.tonnage"))
        self.assertEqual(_split_ref("shift_report.out.ratio"), ("out", "shift_report.ratio"))
        with self.assertRaises(ValueError):
            _split_ref("a.mid.c")
        with self.assertRaises(ValueError):
            _split_ref("a.b.c.d")

    def test_field_refs_include_cross(self):
        refs = _field_refs(self.dst)
        self.assertIn("tonnage_delivery.in.tonnage", refs)
        self.assertIn("tonnage_delivery.out.avg_per_car", refs)

    def test_widget_config_accepts_cross_ref_field(self):
        cfg = validate_widget_config(
            self.dst, "stat_table",
            {"sources": ["out", "in"], "fields": ["tonnage_delivery.in.tonnage"], "stats": ["sum"]},
        )
        self.assertEqual(cfg["fields"], ["tonnage_delivery.in.tonnage"])

    def test_widget_config_rejects_bad_cross_ref(self):
        with self.assertRaises(ValueError):
            validate_widget_config(
                self.dst, "kpi",
                {"cards": [{"kind": "stat", "field": "tonnage_delivery.ghost", "stat": "sum"}]},
            )


class CrossTabComputeTests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.src = _make_tab(
            self.fac1, "tonnage-delivery", "تناژ تحویلی",
            [("tonnage", "تناژ", "number")], [("t2", "دو برابر", "tonnage * 2")],
        )
        self.dst = _make_tab(
            self.fac1, "line-performance", "عملکرد خط",
            [("feed_t", "خوراک", "number")],
            [("ratio", "نسبت", "tonnage_delivery.tonnage / feed_t * 100")],
        )
        for d, t in (("2026-01-01", 100), ("2026-01-02", 300)):
            FactoryTabRecord.objects.create(
                tab=self.src, line=self.line1, date_from=d, date_to=d,
                inputs={"tonnage": t}, outputs={"t2": t * 2},
            )

    def test_cross_context_uses_window_average(self):
        ctx = build_cross_context(self.dst, date_from=None, date_to=None, line=self.line1)
        self.assertAlmostEqual(ctx["tonnage_delivery.tonnage"], 200.0)
        self.assertAlmostEqual(ctx["tonnage_delivery.t2"], 400.0)

    def test_cross_context_respects_line(self):
        ctx = build_cross_context(self.dst, line=self.line2)
        self.assertEqual(ctx, {})

    def test_compute_uses_cross_context(self):
        ctx = build_cross_context(self.dst, line=self.line1)
        _i, outputs = validate_and_compute(
            self.dst, {"inputs": {"feed_t": 50}}, cross_ctx=ctx,
        )
        self.assertAlmostEqual(outputs["ratio"], 200.0 / 50.0 * 100)

    def test_compute_without_cross_context_errors(self):
        with self.assertRaises(ValueError):
            validate_and_compute(self.dst, {"inputs": {"feed_t": 50}})

    def test_run_report_aggregates_cross_tab(self):
        from .models import FactoryTabReport, FactoryTabWidget

        report = FactoryTabReport.objects.create(
            tab=self.dst, name="گزارش", filters=["line"],
            metrics=[{"key": "tot", "label": "جمع خوراک", "formula": "tonnage_delivery.in.tonnage__sum"}],
        )
        FactoryTabWidget.objects.create(
            report=report, widget_type="kpi", title="K",
            config={"cards": [{"kind": "stat", "field": "tonnage_delivery.in.tonnage", "stat": "sum"}]},
        )
        out = run_report(self.dst, report, FactoryTabRecord.objects.filter(tab=self.dst), {})
        self.assertEqual(out["record_count"], 0)
        self.assertEqual(out["widgets"][0]["type"], "kpi")
        kpi = out["widgets"][0]["data"]["cards"][0]
        self.assertIsNone(kpi["value"])
