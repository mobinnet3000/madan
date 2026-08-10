"""Testهای سیستم آنالیز داینامیک (تعریف‌محور) — پیمانکار، موقعیت، تعریف‌ها، فرمول و Actual Analysis."""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import (
    Factory,
    ProductionLine,
    ProductionLineTemplate,
    ProductionLineAttribute,
    Contractor,
    AnalysisTypeDefinition,
    AnalysisPosition,
    ActualAnalysis,
    Attribute,
    DeviceTemplate,
    Device,
)
from .formula import FormulaError, evaluate, validate_expr, variables
from .analysis import build_schema, validate_and_compute


def _make_client():
    user = User.objects.create_superuser("admin", "a@a.ir", "pass")
    client = APIClient()
    client.force_authenticate(user)
    return client


class FactoryFixtureMixin:
    """ساخت صحنه‌ی کارخانه/خط/تعریف‌ها برای تست‌ها."""

    def setUp(self):
        super().setUp()
        self.client = _make_client()

        self.fac1 = Factory.objects.create(name="کارخانه آهن ۱", address="")
        self.fac2 = Factory.objects.create(name="کارخانه مس ۲", address="")

        self.fefeo = AnalysisTypeDefinition.objects.create(name="Fe/FeO")
        self.fefeo.inputs.create(
            key="fe", name="Fe", input_type="number", required=True
        )
        self.fefeo.inputs.create(
            key="feo", name="FeO", input_type="number", required=True
        )

        self.chem = AnalysisTypeDefinition.objects.create(name="Chemical")
        for k, n in [
            ("fe", "Fe"),
            ("feo", "FeO"),
            ("sio2", "SiO2"),
            ("al2o3", "Al2O3"),
        ]:
            self.chem.inputs.create(key=k, name=n, input_type="number", required=True)

        # الگوی خط (الزامی برای ProductionLine)
        self.pla = ProductionLineAttribute.objects.create(name="ظرفیت", unit="تن")
        self.ltpl = ProductionLineTemplate.objects.create(name="الگو")
        self.ltpl.available_attributes.add(self.pla)

        self.line1 = ProductionLine.objects.create(
            name="خط ۱",
            factory=self.fac1,
            line_type="processing",
            template=self.ltpl,
            attributes_values={},
            description="",
        )
        self.line2 = ProductionLine.objects.create(
            name="خط ۲",
            factory=self.fac1,
            line_type="crushing",
            template=self.ltpl,
            attributes_values={},
            description="",
        )
        self.line3 = ProductionLine.objects.create(
            name="خط کارخانه ۲",
            factory=self.fac2,
            line_type="processing",
            template=self.ltpl,
            attributes_values={},
            description="",
        )

        # خط ۱: ۳ موقعیت
        AnalysisPosition.objects.create(
            line=self.line1, name="خوراک", key="feed", definition=self.fefeo, order=1
        )
        AnalysisPosition.objects.create(
            line=self.line1, name="محصول", key="product", definition=self.fefeo, order=2
        )
        AnalysisPosition.objects.create(
            line=self.line1, name="باطله", key="tail", definition=self.fefeo, order=3
        )

        # خط ۲: ۵ موقعیت با تعریف‌های متفاوت
        AnalysisPosition.objects.create(
            line=self.line2, name="خوراک ۱", key="feed1", definition=self.fefeo, order=1
        )
        AnalysisPosition.objects.create(
            line=self.line2, name="خوراک ۲", key="feed2", definition=self.chem, order=2
        )
        AnalysisPosition.objects.create(
            line=self.line2, name="باطله ۱", key="tail1", definition=self.fefeo, order=3
        )
        AnalysisPosition.objects.create(
            line=self.line2, name="باطله ۲", key="tail2", definition=self.chem, order=4
        )
        AnalysisPosition.objects.create(
            line=self.line2, name="محصول", key="product", definition=self.fefeo, order=5
        )

        self.c1 = Contractor.objects.create(factory=self.fac1, name="پیمانکار A")
        self.c2 = Contractor.objects.create(factory=self.fac1, name="پیمانکار B")
        self.c3 = Contractor.objects.create(
            factory=self.fac2, name="پیمانکار کارخانه دیگر"
        )

        self.url_def1 = (
            f"/api/production-lines/{self.line1.id}/line-analysis-definition/upsert/"
        )
        self.url_def2 = (
            f"/api/production-lines/{self.line2.id}/line-analysis-definition/upsert/"
        )
        self.url_schema1 = f"/api/production-lines/{self.line1.id}/analysis-definition/"
        self.url_schema2 = f"/api/production-lines/{self.line2.id}/analysis-definition/"

        self.valid_payload = {
            "line_id": self.line1.id,
            "contractor_id": self.c1.id,
            "date": "2026-01-05",
            "positions": {
                "feed": {"fe": 52.3, "feo": 1.2},
                "product": {"fe": 64.8, "feo": 0.8},
                "tail": {"fe": 9.2, "feo": 2.1},
            },
            "additional_inputs": {"input_a": 20},
        }

    def _upsert_def(self, url, outputs, additional=None, contractor_required=True):
        payload = {
            "contractor_required": contractor_required,
            "notes": "",
            "additional_inputs": additional
            or [
                {
                    "key": "input_a",
                    "name": "Input A",
                    "input_type": "number",
                    "required": False,
                },
            ],
            "outputs": outputs,
        }
        r = self.client.put(url, payload, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r

    def _default_outputs(self):
        return [
            {
                "key": "recovery",
                "name": "بازیابی",
                "formula": "(feed.fe - tail.fe) / (product.fe - tail.fe) * 100",
            },
            {"key": "grade", "name": "عیار", "formula": "max(product.fe, tail.fe)"},
            {
                "key": "test_extra",
                "name": "مجموع",
                "formula": "(feed.fe + product.fe) / 2 + input_a",
            },
        ]

    def _line2_outputs(self):
        return [
            {
                "key": "recovery",
                "name": "بازیابی",
                "formula": "(product.fe - tail1.fe) / (feed1.fe - tail1.fe) * 100",
            },
            {"key": "grade", "name": "عیار", "formula": "max(product.fe, feed1.fe)"},
            {"key": "test_extra", "name": "مجموع", "formula": "feed1.fe + feed2.fe"},
        ]


class FormulaEngineTests(TestCase):
    def test_basic_arithmetic(self):
        self.assertAlmostEqual(evaluate("2 + 3 * 4", {}), 14.0)
        self.assertAlmostEqual(evaluate("(2 + 3) * 4", {}), 20.0)
        self.assertAlmostEqual(evaluate("10 / 4", {}), 2.5)
        self.assertAlmostEqual(evaluate("2 ^ 3", {}), 8.0)
        self.assertAlmostEqual(evaluate("-5 + 10", {}), 5.0)

    def test_variables_and_paths(self):
        env = {"feed.fe": 52.3, "input_a": 20}
        self.assertAlmostEqual(evaluate("feed.fe + input_a", env), 72.3)

    def test_functions(self):
        self.assertAlmostEqual(evaluate("max(3, 7)", {}), 7.0)
        self.assertAlmostEqual(evaluate("min(3, 7)", {}), 3.0)
        self.assertAlmostEqual(evaluate("abs(-4)", {}), 4.0)
        self.assertAlmostEqual(evaluate("round(2.567, 2)", {}), 2.57)
        self.assertAlmostEqual(evaluate("if(1 > 0, 10, 20)", {}), 10.0)

    def test_division_by_zero(self):
        with self.assertRaises(FormulaError):
            evaluate("10 / 0", {})

    def test_unknown_variable(self):
        with self.assertRaises(FormulaError):
            evaluate("feed.fe + 1", {})

    def test_bad_syntax(self):
        for bad in ["1 +", "()", "foo(", "1 2", "sin(", "sin(1"]:
            with self.assertRaises(FormulaError):
                validate_expr(bad)

    def test_variables_extraction(self):
        used = set(
            variables("(feed.fe - tail.fe) / (product.fe - tail.fe) * 100 + input_a")
        )
        self.assertEqual(used, {"feed.fe", "tail.fe", "product.fe", "input_a"})

    def test_no_eval_escape(self):
        # کد دلخواه نباید اجرا شود
        for evil in [
            '__import__("os").system("whoami")',
            "lambda: 1",
            "import os",
            'open("x")',
        ]:
            with self.assertRaises(FormulaError):
                evaluate(evil, {})


class AnalysisTypeDefinitionAPITests(TestCase):
    def setUp(self):
        self.client = _make_client()

    def test_create_with_inputs(self):
        payload = {
            "name": "Fe/FeO",
            "description": "عیار آهن",
            "inputs": [
                {
                    "key": "fe",
                    "name": "Fe",
                    "type": "number",
                    "required": True,
                },  # noqa: E501
                {"key": "feo", "name": "FeO", "unit": "%", "required": True},
            ],
        }
        r = self.client.post("/api/analysis-type-definitions/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        data = r.data
        self.assertEqual(data["name"], "Fe/FeO")
        self.assertEqual(len(data["inputs"]), 2)

    def test_update_inputs(self):
        payload = {
            "name": "Chem",
            "inputs": [{"key": "fe", "name": "Fe"}, {"key": "sio2", "name": "SiO2"}],
        }
        r = self.client.post("/api/analysis-type-definitions/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        def_id = r.data["id"]

        r2 = self.client.patch(
            f"/api/analysis-type-definitions/{def_id}/",
            {
                "inputs": [
                    {"key": "fe", "name": "Fe"},
                    {"key": "al2o3", "name": "Al2O3"},
                ]
            },
            format="json",
        )
        self.assertEqual(r2.status_code, 200, r2.content)
        keys = [i["key"] for i in r2.data["inputs"]]
        self.assertEqual(sorted(keys), ["al2o3", "fe"])


class ContractorAPITests(FactoryFixtureMixin, TestCase):
    def test_create_and_list(self):
        r = self.client.post(
            "/api/contractors/",
            {"factory": self.fac1.id, "name": "پیمانکار جدید", "phone": "0912"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        rl = self.client.get("/api/contractors/?factory=%d" % self.fac1.id)
        names = [c["name"] for c in rl.data]
        self.assertIn("پیمانکار جدید", names)

    def test_cross_factory_contractor_rejected(self):
        # تعریف خط ۱ را آماده کن
        self._upsert_def(self.url_def1, self._default_outputs())
        payload = {
            "line_id": self.line1.id,
            "contractor_id": self.c3.id,  # متعلق به کارخانه ۲
            "date": "2026-01-05",
            "positions": {
                "feed": {"fe": 52.3, "feo": 1.2},
                "product": {"fe": 64.8, "feo": 0.8},
                "tail": {"fe": 9.2, "feo": 2.1},
            },
            "additional_inputs": {"input_a": 20},
        }
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("پیمانکار", r.data["errors"]["detail"])


class SchemaAndPositionTests(FactoryFixtureMixin, TestCase):
    def _define_line2(self):
        self._upsert_def(self.url_def2, self._default_outputs())

    def test_schema_line1_has_3_positions(self):
        self._upsert_def(self.url_def1, self._default_outputs())
        r = self.client.get(self.url_schema1)
        self.assertEqual(r.status_code, 200, r.content)
        schema = r.data
        self.assertEqual(len(schema["positions"]), 3)
        keys = [p["key"] for p in schema["positions"]]
        self.assertEqual(keys, ["feed", "product", "tail"])
        inputs = schema["positions"][0]["inputs"]
        self.assertEqual([i["key"] for i in inputs], ["fe", "feo"])
        self.assertEqual(schema["contractor"]["options"][0]["id"], self.c1.id)
        self.assertTrue(schema["defined"])

    def test_schema_line2_has_5_positions_with_different_defs(self):
        self._upsert_def(self.url_def2, self._line2_outputs())
        r = self.client.get(self.url_schema2)
        schema = r.data
        self.assertEqual(len(schema["positions"]), 5)
        by_key = {p["key"]: p for p in schema["positions"]}
        self.assertEqual(by_key["feed2"]["definition"]["name"], "Chemical")
        self.assertEqual(len(by_key["feed2"]["inputs"]), 4)
        self.assertEqual(len(by_key["feed1"]["inputs"]), 2)
        self.assertEqual(len(schema["outputs"]), 3)

    def test_schemas_differ_between_lines(self):
        self._upsert_def(self.url_def1, self._default_outputs())
        self._upsert_def(self.url_def2, self._line2_outputs())
        s1 = self.client.get(self.url_schema1).data
        s2 = self.client.get(self.url_schema2).data
        self.assertNotEqual(len(s1["positions"]), len(s2["positions"]))
        self.assertEqual(len(s1["positions"]), 3)
        self.assertEqual(len(s2["positions"]), 5)

    def test_line_without_definition_returns_defined_false(self):
        r = self.client.get(self.url_schema1)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(r.data["defined"])
        self.assertEqual(len(r.data["positions"]), 3)


class LineAnalysisDefinitionTests(FactoryFixtureMixin, TestCase):
    def test_upsert_and_formula_compute(self):
        r = self._upsert_def(self.url_def1, self._default_outputs())
        self.assertEqual(len(r.data["outputs"]), 3)
        self.assertEqual(len(r.data["additional_inputs"]), 1)

    def test_invalid_formula_rejected(self):
        r = self.client.put(
            self.url_def1,
            {
                "contractor_required": True,
                "additional_inputs": [],
                "outputs": [
                    {"key": "bad", "name": "Bad", "formula": "nope.fe * 2"},
                    {"key": "ok", "name": "OK", "formula": "feed.fe * 2"},
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_circular_output_dependency_rejected(self):
        r = self.client.put(
            self.url_def1,
            {
                "contractor_required": True,
                "additional_inputs": [],
                "outputs": [
                    {"key": "a", "name": "A", "formula": "b + 1"},
                    {"key": "b", "name": "B", "formula": "a + 1"},
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("دایره", str(r.data))

    def test_output_referencing_other_output(self):
        outs = [
            {
                "key": "recovery",
                "name": "بازیابی",
                "formula": "(feed.fe - tail.fe) / (product.fe - tail.fe) * 100",
            },
            {"key": "grade", "name": "عیار", "formula": "max(product.fe, tail.fe)"},
            {"key": "total", "name": "جمع", "formula": "recovery + grade"},
        ]
        r = self._upsert_def(self.url_def1, outs)
        self.assertEqual(r.status_code, 200, r.content)


class ActualAnalysisAPITests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self._upsert_def(self.url_def1, self._default_outputs())

    def test_full_flow_computes_outputs(self):
        r = self.client.post("/api/actual-analyses/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        outs = r.data["outputs"]
        self.assertAlmostEqual(
            outs["recovery"], round((52.3 - 9.2) / (64.8 - 9.2) * 100, 6)
        )
        self.assertAlmostEqual(outs["grade"], 64.8)
        self.assertAlmostEqual(outs["test_extra"], round((52.3 + 64.8) / 2 + 20, 6))

        # retrieve
        rid = r.data["id"]
        r1 = self.client.get(f"/api/actual-analyses/{rid}/")
        self.assertEqual(r1.status_code, 200, r1.content)
        self.assertEqual(r1.data["inputs"]["positions"]["feed"]["fe"], 52.3)
        self.assertEqual(
            set(r1.data["outputs"].keys()), {"recovery", "grade", "test_extra"}
        )

    def test_missing_required_input(self):
        payload = {
            **self.valid_payload,
            "positions": {
                "feed": {"fe": 52.3},
                "product": {"fe": 64.8, "feo": 0.8},
                "tail": {"fe": 9.2, "feo": 2.1},
            },
        }
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_unknown_input_rejected(self):
        payload = {
            **self.valid_payload,
            "positions": {
                "feed": {"fe": 52.3, "feo": 1.2, "garbage": 1},
                "product": {"fe": 64.8, "feo": 0.8},
                "tail": {"fe": 9.2, "feo": 2.1},
            },
        }
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("ناشناخته", r.data["errors"]["detail"])

    def test_unknown_position_rejected(self):
        payload = {
            **self.valid_payload,
            "positions": {
                "feed": {"fe": 52.3, "feo": 1.2},
                "product": {"fe": 64.8, "feo": 0.8},
                "tail": {"fe": 9.2, "feo": 2.1},
                "ghost": {"fe": 1, "feo": 1},
            },
        }
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_wrong_type_rejected(self):
        payload = {
            **self.valid_payload,
            "positions": {
                "feed": {"fe": "not-a-number", "feo": 1.2},
                "product": {"fe": 64.8, "feo": 0.8},
                "tail": {"fe": 9.2, "feo": 2.1},
            },
        }
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_missing_contractor_when_required(self):
        payload = {k: v for k, v in self.valid_payload.items() if k != "contractor_id"}
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("پیمانکار", r.data["errors"]["detail"])

    def test_contractor_optional(self):
        self._upsert_def(
            self.url_def1, self._default_outputs(), contractor_required=False
        )
        payload = {k: v for k, v in self.valid_payload.items() if k != "contractor_id"}
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsNone(r.data["contractor"])

    def test_list_and_filter(self):
        r = self.client.post("/api/actual-analyses/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        rl = self.client.get(f"/api/actual-analyses/?line={self.line1.id}")
        self.assertEqual(rl.status_code, 200)
        self.assertEqual(rl.data["count"], 1)

    def test_update_recomputes(self):
        r = self.client.post("/api/actual-analyses/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        rid = r.data["id"]
        payload = {
            **self.valid_payload,
            "positions": {
                "feed": {"fe": 50.0, "feo": 1.0},
                "product": {"fe": 65.0, "feo": 0.9},
                "tail": {"fe": 10.0, "feo": 2.0},
            },
        }
        r2 = self.client.put(f"/api/actual-analyses/{rid}/", payload, format="json")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertAlmostEqual(r2.data["outputs"]["grade"], 65.0)

    def test_no_definition_returns_400(self):
        payload = {
            k: v for k, v in self.valid_payload.items() if k not in ("contractor_id",)
        }
        payload["line_id"] = self.line3.id
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("تعریف", r.data["errors"]["detail"])


class FactoryPayloadTests(FactoryFixtureMixin, TestCase):
    def test_factory_returns_contractors_lines_machines_positions(self):
        self._upsert_def(self.url_def1, self._default_outputs())
        r = self.client.get("/api/factory-setup/")
        self.assertEqual(r.status_code, 200, r.content)
        factories = [f for f in r.data if f["id"] == self.fac1.id]
        self.assertEqual(len(factories), 1)
        fac = factories[0]
        self.assertEqual(len(fac["contractors"]), 2)
        line1 = next(l for l in fac["lines"] if l["id"] == self.line1.id)
        self.assertEqual(len(line1["analysis_positions"]), 3)
        self.assertTrue("devices" in line1)
        line2 = next(l for l in fac["lines"] if l["id"] == self.line2.id)
        self.assertEqual(len(line2["analysis_positions"]), 5)


class ServiceDirectTests(FactoryFixtureMixin, TestCase):
    def test_build_schema_direct(self):
        self._upsert_def(self.url_def1, self._default_outputs())
        schema = build_schema(self.line1)
        self.assertEqual(len(schema["positions"]), 3)
        self.assertEqual(len(schema["outputs"]), 3)

    def test_validate_and_compute_direct(self):
        self._upsert_def(self.url_def1, self._default_outputs())
        inputs, outputs = validate_and_compute(self.line1, self.valid_payload)
        self.assertEqual(outputs["grade"], 64.8)
        self.assertAlmostEqual(
            outputs["recovery"], round((52.3 - 9.2) / (64.8 - 9.2) * 100, 6)
        )


class AdminActualAnalysisFormTests(FactoryFixtureMixin, TestCase):
    """تست فرم داینامیک ادمین: ساخت فیلد بر اساس خط + محاسبه‌ی خودکار خروجی هنگام ذخیره."""

    def test_admin_form_builds_fields_and_computes_outputs(self):
        from types import SimpleNamespace

        from machines.admin import ActualAnalysisAdmin

        self._upsert_def(self.url_def1, self._default_outputs())
        user = User.objects.get(username="admin")
        fake = SimpleNamespace(
            GET={"line": str(self.line1.id)}, POST=None, method="GET", user=user
        )
        ma = ActualAnalysisAdmin(ActualAnalysis, None)
        form_cls = ma.get_form(fake, obj=None, change=False)

        f = form_cls()
        dynamic = [k for k in f.fields if k.startswith(("pos_", "add_"))]
        self.assertEqual(len(dynamic), 7)  # 3 موقعیت × 2 ورودی + 1 ورودی اضافه

        pos = {p.key: p.id for p in self.line1.analysis_positions.all()}
        data = {
            "line": str(self.line1.id),
            "date_from": "2026-01-05",
            "date_to": "2026-01-05",
            "shift": "",
            "contractor": str(self.c1.id),
        }
        for pid in pos.values():
            data[f"pos_{pid}_fe"] = "52.3"
            data[f"pos_{pid}_feo"] = "1.2"
        data[f'pos_{pos["product"]}_fe'] = "64.8"
        data[f'pos_{pos["tail"]}_fe'] = "9.2"
        data["add_input_a"] = "20"

        form = form_cls(data=data)
        self.assertTrue(form.is_valid(), form.errors)
        analysis = form.save()
        self.assertEqual(analysis.outputs["grade"], 64.8)
        self.assertAlmostEqual(
            analysis.outputs["recovery"], round((52.3 - 9.2) / (64.8 - 9.2) * 100, 6)
        )
        self.assertEqual(analysis.created_by_id, user.id)


class DateRangeAndDetailTests(FactoryFixtureMixin, TestCase):
    """بازه تاریخی، جزئیات خط (دستگاه‌ها + ورودی‌ها) و اعتبارسنجی فرمول."""

    def setUp(self):
        super().setUp()
        self._upsert_def(self.url_def1, self._default_outputs())
        attr = Attribute.objects.create(name="توان")
        dtpl = DeviceTemplate.objects.create(name="الگو")
        dtpl.available_attributes.add(attr)
        Device.objects.create(
            name="سنگ‌شکن", code="M-01", line=self.line1, template=dtpl, order=1
        )

    def test_single_date_gives_equal_range(self):
        payload = {**self.valid_payload}
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["date_from"], r.data["date_to"])

    def test_date_range_accepted(self):
        payload = {
            **self.valid_payload,
            "date_from": "2026-01-01",
            "date_to": "2026-01-10",
        }
        payload.pop("date", None)
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["date_from"], "2026-01-01")
        self.assertEqual(r.data["date_to"], "2026-01-10")
        self.assertIn("date_from_jalali", r.data)

    def test_invalid_range_rejected(self):
        payload = {
            **self.valid_payload,
            "date_from": "2026-01-20",
            "date_to": "2026-01-10",
        }
        payload.pop("date", None)
        r = self.client.post("/api/actual-analyses/", payload, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_overlap_filter(self):
        self.client.post(
            "/api/actual-analyses/",
            {**self.valid_payload, "date_from": "2026-01-05", "date_to": "2026-01-07"},
            format="json",
        )
        r = self.client.get(
            "/api/actual-analyses/?date_from=2026-01-06&date_to=2026-01-06"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)
        r2 = self.client.get(
            "/api/actual-analyses/?date_from=2026-02-01&date_to=2026-02-10"
        )
        self.assertEqual(r2.data["count"], 0)

    def test_line_detail_includes_devices_and_inputs(self):
        r = self.client.get(f"/api/production-lines/{self.line1.id}/")
        self.assertEqual(r.status_code, 200, r.content)
        data = r.data
        self.assertEqual(len(data["devices"]), 1)
        self.assertEqual(data["devices"][0]["code"], "M-01")
        self.assertEqual(len(data["positions"]), 3)
        self.assertEqual(len(data["outputs"]), 3)
        self.assertEqual(data["contractor"]["options"][0]["id"], self.c1.id)

    def test_actual_analysis_returns_line_devices(self):
        r = self.client.post("/api/actual-analyses/", self.valid_payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(len(r.data["line_devices"]), 1)

    def test_formula_validate_endpoint(self):
        ok = self.client.post(
            "/api/formula/validate/",
            {
                "line_id": self.line1.id,
                "expression": "(feed.fe - tail.fe) / (product.fe - tail.fe) * 100",
            },
            format="json",
        )
        self.assertEqual(ok.status_code, 200, ok.content)
        self.assertTrue(ok.data["ok"])

        bad = self.client.post(
            "/api/formula/validate/",
            {"line_id": self.line1.id, "expression": "nope.fe * 2"},
            format="json",
        )
        self.assertEqual(bad.status_code, 200)
        self.assertFalse(bad.data["ok"])
        self.assertTrue(any("nope" in e for e in bad.data["errors"]))
