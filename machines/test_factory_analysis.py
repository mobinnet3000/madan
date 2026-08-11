"""Testهای سیستم آنالیز کارخانه (تعریف‌محور) — ورودی/خروجی/فرمول و ProductionReport."""

from django.test import TestCase

from .factory_analysis import build_schema, validate_and_compute
from .test_analysis import FactoryFixtureMixin


class FactoryAnalysisAdminFlowTests(FactoryFixtureMixin, TestCase):
    """جریان دو مرحله‌ای ادمین: افزودن = فقط ورودی‌ها، تغییر = ورودی‌ها + خروجی‌ها."""

    def test_add_shows_only_inputs_then_change_shows_outputs(self):
        from machines.admin import FactoryAnalysisDefinitionAdmin
        from machines.models import FactoryAnalysisDefinition

        ma = FactoryAnalysisDefinitionAdmin(FactoryAnalysisDefinition, None)
        add_inlines = ma.get_inlines(None, None)
        self.assertEqual(
            [i.model.__name__ for i in add_inlines], ["FactoryAnalysisInput"]
        )
        definition = FactoryAnalysisDefinition.objects.create(factory=self.fac1)
        change_inlines = ma.get_inlines(None, definition)
        self.assertEqual(
            [i.model.__name__ for i in change_inlines],
            ["FactoryAnalysisInput", "FactoryAnalysisOutput"],
        )


class FactoryAnalysisDefinitionTests(FactoryFixtureMixin, TestCase):
    def _upsert_def(self, factory_id, inputs=None, outputs=None):
        payload = {
            "description": "تعریف آنالیز کارخانه",
            "inputs": inputs
            or [
                {"key": "feed", "name": "خوراک", "input_type": "number", "required": True},
                {"key": "product", "name": "محصول", "input_type": "number", "required": True},
                {"key": "tail", "name": "باطله", "input_type": "number", "required": True},
            ],
            "outputs": outputs
            or [
                {"key": "recovery", "name": "بازیابی", "formula": "(feed - tail) / (product - tail) * 100"},
                {"key": "total", "name": "مجموع", "formula": "recovery + product"},
            ],
        }
        r = self.client.put(
            f"/api/factories/{factory_id}/analysis-definition/", payload, format="json"
        )
        return r

    def test_upsert_definition_syncs_inputs_outputs(self):
        r = self._upsert_def(self.fac1.id)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(len(r.data["inputs"]), 3)
        self.assertEqual(len(r.data["outputs"]), 2)
        self.assertEqual([i["key"] for i in r.data["inputs"]], ["feed", "product", "tail"])

    def test_invalid_formula_rejected(self):
        r = self._upsert_def(
            self.fac1.id,
            outputs=[
                {"key": "bad", "name": "Bad", "formula": "nope * 2"},
                {"key": "ok", "name": "OK", "formula": "feed * 2"},
            ],
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_circular_output_dependency_rejected(self):
        r = self._upsert_def(
            self.fac1.id,
            outputs=[
                {"key": "a", "name": "A", "formula": "b + 1"},
                {"key": "b", "name": "B", "formula": "a + 1"},
            ],
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("دایره", str(r.data))

    def test_definitions_isolated_per_factory(self):
        self._upsert_def(self.fac1.id)
        schema1 = self.client.get(
            f"/api/factory-analysis-definition/schema/?factory={self.fac1.id}"
        )
        schema2 = self.client.get(
            f"/api/factory-analysis-definition/schema/?factory={self.fac2.id}"
        )
        self.assertTrue(schema1.data["defined"])
        self.assertFalse(schema2.data["defined"])
        self.assertEqual(schema1.data["factory"]["id"], self.fac1.id)


class ProductionReportAPITests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        payload = {
            "description": "تعریف کارخانه",
            "inputs": [
                {"key": "feed", "name": "خوراک", "input_type": "number", "required": True},
                {"key": "product", "name": "محصول", "input_type": "number", "required": True},
                {"key": "tail", "name": "باطله", "input_type": "number", "required": True},
                {"key": "note", "name": "یادداشت", "input_type": "text", "required": False},
            ],
            "outputs": [
                {"key": "recovery", "name": "بازیابی", "formula": "(feed - tail) / (product - tail) * 100"},
                {"key": "total", "name": "مجموع", "formula": "recovery + product"},
            ],
        }
        r = self.client.put(
            f"/api/factories/{self.fac1.id}/analysis-definition/", payload, format="json"
        )
        self.assertEqual(r.status_code, 200, r.content)

        self.valid_payload = {
            "line_id": self.line1.id,
            "contractor_id": self.c1.id,
            "date_from": "2026-01-05",
            "date_to": "2026-01-05",
            "inputs": {"feed": 100, "product": 60, "tail": 5},
            "note": "تست",
        }

    def test_full_flow_computes_outputs(self):
        r = self.client.post("/api/production-reports/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        outs = r.data["outputs"]
        self.assertAlmostEqual(outs["recovery"], round((100 - 5) / (60 - 5) * 100, 6))
        self.assertAlmostEqual(outs["total"], round(outs["recovery"] + 60, 6))
        self.assertEqual(r.data["inputs"]["feed"], 100)

        rid = r.data["id"]
        r1 = self.client.get(f"/api/production-reports/{rid}/")
        self.assertEqual(r1.status_code, 200, r1.content)
        self.assertEqual(set(r1.data["outputs"].keys()), {"recovery", "total"})

    def test_missing_required_input(self):
        payload = {**self.valid_payload, "inputs": {"feed": 100, "product": 60}}
        r = self.client.post("/api/production-reports/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_unknown_input_rejected(self):
        payload = {**self.valid_payload, "inputs": {**self.valid_payload["inputs"], "ghost": 1}}
        r = self.client.post("/api/production-reports/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("ناشناخته", str(r.data))

    def test_wrong_type_rejected(self):
        payload = {**self.valid_payload, "inputs": {**self.valid_payload["inputs"], "feed": "not-a-number"}}
        r = self.client.post("/api/production-reports/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_cross_factory_contractor_rejected(self):
        payload = {**self.valid_payload, "contractor_id": self.c3.id}
        r = self.client.post("/api/production-reports/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_invalid_range_rejected(self):
        payload = {**self.valid_payload, "date_from": "2026-01-20", "date_to": "2026-01-10"}
        r = self.client.post("/api/production-reports/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_no_definition_returns_400(self):
        payload = {**self.valid_payload, "line_id": self.line3.id}
        r = self.client.post("/api/production-reports/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_update_recomputes(self):
        r = self.client.post("/api/production-reports/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        rid = r.data["id"]
        payload = {**self.valid_payload, "inputs": {"feed": 100, "product": 70, "tail": 10}}
        r2 = self.client.patch(f"/api/production-reports/{rid}/", payload, format="json")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertAlmostEqual(r2.data["outputs"]["recovery"], round((100 - 10) / (70 - 10) * 100, 6))

    def test_jalali_dates_in_serializer(self):
        r = self.client.post("/api/production-reports/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIn("date_from_jalali", r.data)
        self.assertIn("date_to_jalali", r.data)


class FactoryAnalysisServiceTests(FactoryFixtureMixin, TestCase):
    def test_build_schema_direct(self):
        payload = {
            "inputs": [
                {"key": "feed", "name": "خوراک", "input_type": "number", "required": True},
            ],
            "outputs": [
                {"key": "total", "name": "مجموع", "formula": "feed * 2"},
            ],
        }
        self.client.put(
            f"/api/factories/{self.fac1.id}/analysis-definition/", payload, format="json"
        )
        schema = build_schema(self.fac1)
        self.assertTrue(schema["defined"])
        self.assertEqual(schema["inputs"][0]["key"], "feed")
        self.assertEqual(schema["outputs"][0]["key"], "total")

    def test_validate_and_compute_direct(self):
        payload = {
            "inputs": [
                {"key": "feed", "name": "خوراک", "input_type": "number", "required": True},
                {"key": "product", "name": "محصول", "input_type": "number", "required": True},
            ],
            "outputs": [
                {"key": "ratio", "name": "نسبت", "formula": "feed / product * 100"},
            ],
        }
        self.client.put(
            f"/api/factories/{self.fac1.id}/analysis-definition/", payload, format="json"
        )
        inputs, outputs = validate_and_compute(
            self.line1, {"inputs": {"feed": 20, "product": 50}}
        )
        self.assertAlmostEqual(outputs["ratio"], round(20 / 50 * 100, 6))


class FactoryDetailDefinitionPayloadTests(FactoryFixtureMixin, TestCase):
    """کارخانه + خطوط: تعریفهای داینامیک جدید با تمام فیلدها فراخوانده شوند."""

    def _setup_definitions(self):
        self.client.put(
            f"/api/factories/{self.fac1.id}/analysis-definition/",
            {
                "description": "تعریف کارخانه",
                "inputs": [
                    {"key": "feed", "name": "خوراک", "input_type": "number", "required": True},
                ],
                "outputs": [
                    {"key": "total", "name": "مجموع", "formula": "feed * 2"},
                ],
            },
            format="json",
        )
        self.client.put(
            f"/api/production-lines/{self.line1.id}/tonnage-definition/",
            {
                "description": "تعریف تناژ",
                "inputs": [
                    {"key": "tonnage", "name": "تناژ", "input_type": "number", "required": True},
                ],
                "outputs": [
                    {"key": "double", "name": "دو برابر", "formula": "tonnage * 2"},
                ],
            },
            format="json",
        )

    def test_factory_detail_includes_new_definitions_with_fields(self):
        self._setup_definitions()
        r = self.client.get("/api/factory-setup/")
        self.assertEqual(r.status_code, 200, r.content)
        fac = next(f for f in r.data if f["id"] == self.fac1.id)
        fac_def = fac["factory_analysis_definition"]
        self.assertEqual(fac_def["description"], "تعریف کارخانه")
        self.assertEqual(fac_def["inputs"][0]["key"], "feed")
        self.assertEqual(fac_def["outputs"][0]["formula"], "feed * 2")

        line1 = next(l for l in fac["lines"] if l["id"] == self.line1.id)
        tdef = line1["tonnage_definition"]
        self.assertEqual(tdef["description"], "تعریف تناژ")
        self.assertEqual(tdef["inputs"][0]["key"], "tonnage")
        self.assertEqual(tdef["outputs"][0]["formula"], "tonnage * 2")

    def test_factory_detail_without_definitions_returns_null(self):
        r = self.client.get("/api/factory-setup/")
        self.assertEqual(r.status_code, 200, r.content)
        fac2 = next(f for f in r.data if f["id"] == self.fac2.id)
        self.assertIsNone(fac2["factory_analysis_definition"])
        line3 = next(l for l in fac2["lines"] if l["id"] == self.line3.id)
        self.assertIsNone(line3["tonnage_definition"])
