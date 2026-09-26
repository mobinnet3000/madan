"""Testهای تب‌های داینامیک کارخانه — ساخت/ویرایش تب، ورودی/خروجی/فرمول و ثبت رکورد."""

from django.test import TestCase

from .factory_tabs import build_schema, validate_and_compute
from .test_analysis import FactoryFixtureMixin


def _tab_payload(**over):
    payload = {
        "key": "custom-tab",
        "name": "تب سفارشی",
        "description": "",
        "record_type": "range",
        "require_line": True,
        "contractor_required": False,
        "order": 0,
        "is_active": True,
        "inputs": [
            {"key": "feed", "name": "خوراک", "input_type": "number", "required": True},
            {"key": "product", "name": "محصول", "input_type": "number", "required": True},
        ],
        "outputs": [
            {"key": "recovery", "name": "بازیابی", "formula": "product / feed * 100"},
            {"key": "double", "name": "دو برابر", "formula": "recovery * 2"},
        ],
    }
    payload.update(over)
    return payload


class FactoryTabAPITests(FactoryFixtureMixin, TestCase):
    def _create_tab(self, factory_id=None, **over):
        fid = factory_id or self.fac1.id
        payload = _tab_payload(**over)
        payload["factory"] = fid
        return self.client.post("/api/factory-tabs/", payload, format="json")

    def test_create_tab_syncs_inputs_outputs(self):
        r = self._create_tab()
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(len(r.data["inputs"]), 2)
        self.assertEqual(len(r.data["outputs"]), 2)
        self.assertEqual([i["key"] for i in r.data["inputs"]], ["feed", "product"])

    def test_list_filter_by_factory(self):
        self._create_tab()
        r1 = self.client.get(f"/api/factory-tabs/?factory={self.fac1.id}")
        r2 = self.client.get(f"/api/factory-tabs/?factory={self.fac2.id}")
        self.assertEqual(len(r1.data), 1)
        self.assertEqual(len(r2.data), 0)

    def test_duplicate_key_rejected_per_factory(self):
        self.assertEqual(self._create_tab().status_code, 201)
        r = self._create_tab()
        self.assertEqual(r.status_code, 400, r.content)

    def test_invalid_formula_rejected(self):
        r = self._create_tab(outputs=[{"key": "bad", "name": "Bad", "formula": "nope * 2"}])
        self.assertEqual(r.status_code, 400, r.content)

    def test_circular_output_dependency_rejected(self):
        r = self._create_tab(outputs=[
            {"key": "a", "name": "A", "formula": "b + 1"},
            {"key": "b", "name": "B", "formula": "a + 1"},
        ])
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("دایره", str(r.data))

    def test_update_tab_resyncs(self):
        r = self._create_tab()
        tid = r.data["id"]
        payload = _tab_payload(name="تب ویرایش‌شده")
        payload["factory"] = self.fac1.id
        payload["inputs"] = payload["inputs"][:1]
        payload["outputs"] = [{"key": "twice", "name": "دو برابر", "formula": "feed * 2"}]
        r2 = self.client.put(f"/api/factory-tabs/{tid}/", payload, format="json")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.data["name"], "تب ویرایش‌شده")
        self.assertEqual(len(r2.data["inputs"]), 1)

    def test_schema_endpoint(self):
        tid = self._create_tab().data["id"]
        r = self.client.get(f"/api/factory-tabs/{tid}/schema/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.data["defined"] if "defined" in r.data else True)
        self.assertEqual(len(r.data["inputs"]), 2)
        self.assertEqual(r.data["tab"]["id"], tid)

    def test_formula_validate_endpoint(self):
        tid = self._create_tab().data["id"]
        ok = self.client.post(
            "/api/formula/validate-tab/",
            {"tab_id": tid, "expression": "feed * 2"},
            format="json",
        )
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertTrue(ok.data["ok"])
        bad = self.client.post(
            "/api/formula/validate-tab/",
            {"tab_id": tid, "expression": "ghost * 2"},
            format="json",
        )
        self.assertFalse(bad.data["ok"])


class FactoryTabInputOutputAPITests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        r = self.client.post(
            "/api/factory-tabs/",
            {**_tab_payload(), "factory": self.fac1.id},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.tab_id = r.data["id"]

    def test_add_and_edit_input(self):
        r = self.client.post(
            f"/api/factory-tabs/{self.tab_id}/inputs/",
            {"key": "extra", "name": "اضافه", "input_type": "number", "required": False},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        r2 = self.client.patch(
            f"/api/factory-tabs/{self.tab_id}/inputs/{r.data['id']}/",
            {"name": "اضافه ۲"},
            format="json",
        )
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.data["name"], "اضافه ۲")

    def test_add_output_with_bad_formula_rejected(self):
        r = self.client.post(
            f"/api/factory-tabs/{self.tab_id}/outputs/",
            {"key": "bad", "name": "Bad", "formula": "ghost + 1"},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)


class FactoryTabRecordAPITests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        r = self.client.post(
            "/api/factory-tabs/",
            {**_tab_payload(), "factory": self.fac1.id},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.tab_id = r.data["id"]
        self.valid_payload = {
            "tab": self.tab_id,
            "line_id": self.line1.id,
            "contractor_id": self.c1.id,
            "date_from": "2026-01-05",
            "date_to": "2026-01-05",
            "inputs": {"feed": 100, "product": 60},
            "note": "تست",
        }

    def test_full_flow_computes_outputs(self):
        r = self.client.post("/api/factory-tab-records/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertAlmostEqual(r.data["outputs"]["recovery"], 60.0)
        self.assertAlmostEqual(r.data["outputs"]["double"], 120.0)
        self.assertIn("date_from_jalali", r.data)

        rid = r.data["id"]
        r1 = self.client.get(f"/api/factory-tab-records/{rid}/")
        self.assertEqual(r1.status_code, 200, r1.content)
        self.assertEqual(set(r1.data["outputs"].keys()), {"recovery", "double"})

    def test_missing_required_input(self):
        payload = {**self.valid_payload, "inputs": {"feed": 100}}
        r = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_unknown_input_rejected(self):
        payload = {**self.valid_payload, "inputs": {**self.valid_payload["inputs"], "ghost": 1}}
        r = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_cross_factory_line_rejected(self):
        payload = {**self.valid_payload, "line_id": self.line3.id}
        r = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_cross_factory_contractor_rejected(self):
        payload = {**self.valid_payload, "contractor_id": self.c3.id}
        r = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_invalid_range_rejected(self):
        payload = {**self.valid_payload, "date_from": "2026-01-20", "date_to": "2026-01-10"}
        r = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_require_line_enforced(self):
        payload = {k: v for k, v in self.valid_payload.items() if k != "line_id"}
        r = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_filter_by_tab_and_line(self):
        self.client.post("/api/factory-tab-records/", self.valid_payload, format="json")
        rl = self.client.get(f"/api/factory-tab-records/?tab={self.tab_id}")
        self.assertEqual(rl.status_code, 200)
        self.assertEqual(rl.data["count"], 1)
        rl2 = self.client.get(f"/api/factory-tab-records/?line={self.line1.id}")
        self.assertEqual(rl2.data["count"], 1)

    def test_update_recomputes(self):
        r = self.client.post("/api/factory-tab-records/", self.valid_payload, format="json")
        rid = r.data["id"]
        payload = {**self.valid_payload, "inputs": {"feed": 100, "product": 70}}
        r2 = self.client.patch(f"/api/factory-tab-records/{rid}/", payload, format="json")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertAlmostEqual(r2.data["outputs"]["recovery"], 70.0)

    def test_daily_tab_requires_hour(self):
        rd = self.client.post(
            "/api/factory-tabs/",
            {**_tab_payload(key="daily-tab", name="تب روزانه"), "factory": self.fac1.id,
             "record_type": "daily"},
            format="json",
        )
        tid = rd.data["id"]
        payload = {
            "tab": tid, "line_id": self.line1.id,
            "date_from": "2026-08-10", "date_to": "2026-08-10",
            "inputs": {"feed": 150, "product": 90},
        }
        r = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        payload["hour"] = "09:30"
        r2 = self.client.post("/api/factory-tab-records/", payload, format="json")
        self.assertEqual(r2.status_code, 201, r2.content)
        r3 = self.client.post(
            "/api/factory-tab-records/",
            {**payload, "hour": "14:00", "inputs": {"feed": 200, "product": 120}},
            format="json",
        )
        self.assertEqual(r3.status_code, 201, r3.content)


class FactoryTabServiceTests(FactoryFixtureMixin, TestCase):
    def test_build_schema_and_compute_direct(self):
        from machines.models import FactoryTab

        r = self.client.post(
            "/api/factory-tabs/",
            {**_tab_payload(), "factory": self.fac1.id},
            format="json",
        )
        tab = FactoryTab.objects.get(pk=r.data["id"])
        schema = build_schema(tab)
        self.assertEqual(schema["tab"]["key"], "custom-tab")
        self.assertEqual(len(schema["inputs"]), 2)
        inputs, outputs = validate_and_compute(tab, {"inputs": {"feed": 50, "product": 25}})
        self.assertAlmostEqual(outputs["recovery"], 50.0)


class FactoryTabAdminFlowTests(FactoryFixtureMixin, TestCase):
    def test_add_shows_only_inputs_then_change_shows_outputs(self):
        from machines.admin import FactoryTabAdmin
        from machines.models import FactoryTab

        ma = FactoryTabAdmin(FactoryTab, None)
        self.assertEqual([i.model.__name__ for i in ma.get_inlines(None, None)], ["FactoryTabInput"])
        tab = FactoryTab.objects.create(factory=self.fac1, key="t1", name="تب ۱")
        self.assertEqual(
            [i.model.__name__ for i in ma.get_inlines(None, tab)],
            ["FactoryTabInput", "FactoryTabOutput"],
        )


class FactoryDetailTabsPayloadTests(FactoryFixtureMixin, TestCase):
    def test_factory_detail_includes_report_tabs(self):
        self.client.post(
            "/api/factory-tabs/",
            {**_tab_payload(), "factory": self.fac1.id},
            format="json",
        )
        r = self.client.get("/api/factory-setup/")
        self.assertEqual(r.status_code, 200, r.content)
        fac = next(f for f in r.data if f["id"] == self.fac1.id)
        self.assertEqual(len(fac["report_tabs"]), 1)
        self.assertEqual(fac["report_tabs"][0]["key"], "custom-tab")
        self.assertEqual(fac["report_tabs"][0]["inputs"][0]["key"], "feed")
        fac2 = next(f for f in r.data if f["id"] == self.fac2.id)
        self.assertEqual(fac2["report_tabs"], [])


class FactoryTabSelectInputTests(FactoryFixtureMixin, TestCase):
    """ورودی انتخابی (کشویی) فقط برای تب کارخانه."""

    def _create_select_tab(self, inputs=None, outputs=None):
        payload = _tab_payload(
            key="select-tab",
            name="تب انتخابی",
            inputs=inputs
            or [
                {"key": "feed", "name": "خوراک", "input_type": "number", "required": True},
                {
                    "key": "shift_name",
                    "name": "نام شیفت",
                    "input_type": "select",
                    "options": ["صبح", "عصر", "شب"],
                    "required": True,
                },
            ],
            outputs=outputs or [{"key": "double", "name": "دو برابر", "formula": "feed * 2"}],
        )
        payload["factory"] = self.fac1.id
        return self.client.post("/api/factory-tabs/", payload, format="json")

    def test_create_tab_with_select_and_schema_options(self):
        r = self._create_select_tab()
        self.assertEqual(r.status_code, 201, r.content)
        sel = next(i for i in r.data["inputs"] if i["key"] == "shift_name")
        self.assertEqual(sel["input_type"], "select")
        self.assertEqual(sel["options"], ["صبح", "عصر", "شب"])

        tid = r.data["id"]
        s = self.client.get(f"/api/factory-tabs/{tid}/schema/")
        self.assertEqual(s.status_code, 200, s.content)
        sel_schema = next(i for i in s.data["inputs"] if i["key"] == "shift_name")
        self.assertEqual(sel_schema["options"], ["صبح", "عصر", "شب"])

    def test_record_accepts_valid_option_rejects_other(self):
        tid = self._create_select_tab().data["id"]
        base = {
            "tab": tid,
            "line_id": self.line1.id,
            "date_from": "2026-01-05",
            "date_to": "2026-01-05",
        }
        ok = self.client.post(
            "/api/factory-tab-records/",
            {**base, "inputs": {"feed": 100, "shift_name": "عصر"}},
            format="json",
        )
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(ok.data["inputs"]["shift_name"], "عصر")
        self.assertAlmostEqual(ok.data["outputs"]["double"], 200.0)

        bad = self.client.post(
            "/api/factory-tab-records/",
            {**base, "inputs": {"feed": 100, "shift_name": "نیمه‌شب"}},
            format="json",
        )
        self.assertEqual(bad.status_code, 400, bad.content)

    def test_select_requires_options(self):
        r = self._create_select_tab(
            inputs=[{"key": "s", "name": "S", "input_type": "select", "options": []}]
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_select_not_allowed_in_formula(self):
        r = self._create_select_tab(
            outputs=[{"key": "o", "name": "O", "formula": "shift_name + feed"}]
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_duplicate_options_rejected(self):
        r = self._create_select_tab(
            inputs=[
                {
                    "key": "s",
                    "name": "S",
                    "input_type": "select",
                    "options": ["الف", "الف"],
                }
            ]
        )
        self.assertEqual(r.status_code, 400, r.content)
