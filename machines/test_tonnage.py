"""Testهای سیستم تناژ تحویلی خطوط تولید (تعریف‌محور) — ورودی/خروجی/فرمول و ثبت رکورد."""

from django.test import TestCase

from .tonnage import build_schema, validate_and_compute
from .test_analysis import FactoryFixtureMixin


class DeliveredTonnageDefinitionTests(FactoryFixtureMixin, TestCase):
    def _upsert_def(self, line_id, inputs=None, outputs=None):
        payload = {
            "description": "تعریف تناژ تحویلی",
            "inputs": inputs
            or [
                {"key": "tonnage", "name": "تناژ تحویلی", "input_type": "number", "required": True},
                {"key": "cars", "name": "تعداد کامیون", "input_type": "number", "required": True},
                {"key": "grade", "name": "نام مواد", "input_type": "text", "required": False},
            ],
            "outputs": outputs
            or [
                {"key": "avg_per_car", "name": "میانگین هر کامیون", "formula": "tonnage / cars"},
                {"key": "total", "name": "جمع", "formula": "tonnage + avg_per_car"},
            ],
        }
        r = self.client.put(
            f"/api/production-lines/{line_id}/tonnage-definition/", payload, format="json"
        )
        return r

    def test_upsert_definition_syncs_inputs_outputs(self):
        r = self._upsert_def(self.line1.id)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(len(r.data["inputs"]), 3)
        self.assertEqual(len(r.data["outputs"]), 2)
        self.assertEqual([i["key"] for i in r.data["inputs"]], ["tonnage", "cars", "grade"])

    def test_invalid_formula_rejected(self):
        r = self._upsert_def(
            self.line1.id,
            outputs=[
                {"key": "bad", "name": "Bad", "formula": "nope * 2"},
                {"key": "ok", "name": "OK", "formula": "tonnage * 2"},
            ],
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_circular_output_dependency_rejected(self):
        r = self._upsert_def(
            self.line1.id,
            outputs=[
                {"key": "a", "name": "A", "formula": "b + 1"},
                {"key": "b", "name": "B", "formula": "a + 1"},
            ],
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("دایره", str(r.data))

    def test_definitions_isolated_per_line(self):
        self._upsert_def(self.line1.id)
        s1 = self.client.get(f"/api/tonnage/definition/schema/?line={self.line1.id}")
        s2 = self.client.get(f"/api/tonnage/definition/schema/?line={self.line2.id}")
        self.assertTrue(s1.data["defined"])
        self.assertFalse(s2.data["defined"])
        self.assertEqual(s1.data["line"]["id"], self.line1.id)


class DeliveredTonnageAPITests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        payload = {
            "description": "تعریف تناژ",
            "inputs": [
                {"key": "tonnage", "name": "تناژ تحویلی", "input_type": "number", "required": True},
                {"key": "cars", "name": "تعداد کامیون", "input_type": "number", "required": True},
                {"key": "grade", "name": "نام مواد", "input_type": "text", "required": False},
            ],
            "outputs": [
                {"key": "avg_per_car", "name": "میانگین هر کامیون", "formula": "tonnage / cars"},
            ],
        }
        r = self.client.put(
            f"/api/production-lines/{self.line1.id}/tonnage-definition/", payload, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)

        self.valid_payload = {
            "line_id": self.line1.id,
            "contractor_id": self.c1.id,
            "date": "2026-08-10",
            "hour": "09:30",
            "inputs": {"tonnage": 150, "cars": 5, "grade": "آهن"},
            "note": "تحویل صبح",
        }

    def test_full_flow_computes_outputs(self):
        r = self.client.post("/api/delivered-tonnages/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertAlmostEqual(r.data["outputs"]["avg_per_car"], 30.0)
        self.assertEqual(r.data["inputs"]["tonnage"], 150)
        self.assertEqual(r.data["inputs"]["grade"], "آهن")
        self.assertIn("date_jalali", r.data)

        rid = r.data["id"]
        r1 = self.client.get(f"/api/delivered-tonnages/{rid}/")
        self.assertEqual(r1.status_code, 200, r1.content)
        self.assertEqual(set(r1.data["outputs"].keys()), {"avg_per_car"})

    def test_multiple_records_per_day(self):
        r1 = self.client.post("/api/delivered-tonnages/", self.valid_payload, format="json")
        r2 = self.client.post(
            "/api/delivered-tonnages/",
            {**self.valid_payload, "hour": "14:00", "inputs": {"tonnage": 200, "cars": 8}},
            format="json",
        )
        self.assertEqual(r1.status_code, 201, r1.content)
        self.assertEqual(r2.status_code, 201, r2.content)
        rl = self.client.get("/api/delivered-tonnages/?date=2026-08-10")
        self.assertEqual(rl.status_code, 200)
        self.assertEqual(rl.data["count"], 2)

    def test_missing_required_input(self):
        payload = {**self.valid_payload, "inputs": {"tonnage": 150}}
        r = self.client.post("/api/delivered-tonnages/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_unknown_input_rejected(self):
        payload = {**self.valid_payload, "inputs": {**self.valid_payload["inputs"], "ghost": 1}}
        r = self.client.post("/api/delivered-tonnages/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_wrong_type_rejected(self):
        payload = {**self.valid_payload, "inputs": {**self.valid_payload["inputs"], "tonnage": "abc"}}
        r = self.client.post("/api/delivered-tonnages/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_cross_factory_contractor_rejected(self):
        payload = {**self.valid_payload, "contractor_id": self.c3.id}
        r = self.client.post("/api/delivered-tonnages/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_hour_required(self):
        payload = {k: v for k, v in self.valid_payload.items() if k != "hour"}
        r = self.client.post("/api/delivered-tonnages/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_bad_hour_rejected(self):
        payload = {**self.valid_payload, "hour": "25:99"}
        r = self.client.post("/api/delivered-tonnages/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_no_definition_returns_400(self):
        payload = {**self.valid_payload, "line_id": self.line2.id}
        r = self.client.post("/api/delivered-tonnages/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_update_recomputes(self):
        r = self.client.post("/api/delivered-tonnages/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        rid = r.data["id"]
        payload = {**self.valid_payload, "inputs": {"tonnage": 240, "cars": 8}}
        r2 = self.client.patch(f"/api/delivered-tonnages/{rid}/", payload, format="json")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertAlmostEqual(r2.data["outputs"]["avg_per_car"], 30.0)


class DeliveredTonnageServiceTests(FactoryFixtureMixin, TestCase):
    def test_build_schema_and_compute_direct(self):
        self.client.put(
            f"/api/production-lines/{self.line1.id}/tonnage-definition/",
            {
                "inputs": [
                    {"key": "tonnage", "name": "تناژ", "input_type": "number", "required": True},
                ],
                "outputs": [
                    {"key": "double", "name": "دو برابر", "formula": "tonnage * 2"},
                ],
            },
            format="json",
        )
        schema = build_schema(self.line1)
        self.assertTrue(schema["defined"])
        self.assertEqual(schema["inputs"][0]["key"], "tonnage")
        inputs, outputs = validate_and_compute(
            self.line1, {"inputs": {"tonnage": 90}}
        )
        self.assertAlmostEqual(outputs["double"], 180.0)


class DeliveredTonnageAdminFlowTests(FactoryFixtureMixin, TestCase):
    """جریان دو مرحله‌ای ادمین: افزودن = فقط ورودی‌ها، تغییر = ورودی‌ها + خروجی‌ها."""

    def test_add_shows_only_inputs_then_change_shows_outputs(self):
        from machines.admin import DeliveredTonnageDefinitionAdmin
        from machines.models import DeliveredTonnageDefinition

        ma = DeliveredTonnageDefinitionAdmin(DeliveredTonnageDefinition, None)
        add_inlines = ma.get_inlines(None, None)
        self.assertEqual(
            [i.model.__name__ for i in add_inlines], ["DeliveredTonnageInput"]
        )
        definition = DeliveredTonnageDefinition.objects.create(line=self.line1)
        change_inlines = ma.get_inlines(None, definition)
        self.assertEqual(
            [i.model.__name__ for i in change_inlines],
            ["DeliveredTonnageInput", "DeliveredTonnageOutput"],
        )