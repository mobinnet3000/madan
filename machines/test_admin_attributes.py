"""Testهای جریان دو مرحله‌ای ویژگی‌ها در ادمین (خط تولید و دستگاه)."""

from django.test import TestCase

from .models import (
    Factory,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
    Attribute,
    DeviceTemplate,
    Device,
)


class AdminAttributeFlowTests(TestCase):
    def setUp(self):
        self.factory = Factory.objects.create(name="کارخانه تست", address="")
        self.capacity = ProductionLineAttribute.objects.create(name="ظرفیت", unit="تن")
        self.length = ProductionLineAttribute.objects.create(name="طول", unit="متر")
        self.line_template = ProductionLineTemplate.objects.create(name="الگوی خط")
        self.line_template.available_attributes.add(self.capacity, self.length)

        self.power = Attribute.objects.create(name="توان", unit="کیلووات")
        self.device_template = DeviceTemplate.objects.create(name="الگوی دستگاه")
        self.device_template.available_attributes.add(self.power)

        self.line = ProductionLine.objects.create(
            name="خط ۱",
            factory=self.factory,
            line_type="processing",
            template=self.line_template,
            attributes_values={"ظرفیت": 1500},
            description="",
        )
        self.device = Device.objects.create(
            name="دستگاه ۱", code="M-01", line=self.line, template=self.device_template, order=1
        )

    def test_fieldsets_two_step_line(self):
        from machines.admin import ProductionLineAdmin

        ma = ProductionLineAdmin(ProductionLine, None)
        add_fs = ma.get_fieldsets(SimpleRequest(), None)
        self.assertEqual(len(add_fs), 1)
        self.assertIn("مرحله ۱", add_fs[0][0])

        change_fs = ma.get_fieldsets(SimpleRequest(), self.line)
        titles = [f[0] for f in change_fs]
        self.assertEqual(len(change_fs), 2)
        self.assertTrue(any("مرحله ۲" in t for t in titles))
        step2_fields = change_fs[1][1]["fields"]
        self.assertIn(f"attr_{self.capacity.id}", step2_fields)
        self.assertIn(f"attr_{self.length.id}", step2_fields)

    def test_fieldsets_two_step_device(self):
        from machines.admin import DeviceAdmin

        ma = DeviceAdmin(Device, None)
        add_fs = ma.get_fieldsets(SimpleRequest(), None)
        self.assertEqual(len(add_fs), 1)
        change_fs = ma.get_fieldsets(SimpleRequest(), self.device)
        self.assertEqual(len(change_fs), 2)
        self.assertIn(f"attr_{self.power.id}", change_fs[1][1]["fields"])

    def test_line_form_saves_attribute_values(self):
        from machines.admin import ProductionLineForm

        form = ProductionLineForm(
            data={
                "factory": str(self.factory.id),
                "template": str(self.line_template.id),
                "name": "خط جدید",
                "description": "",
                f"attr_{self.capacity.id}": "2000",
                f"attr_{self.length.id}": "75",
                "line_type": "processing",
            },
            instance=ProductionLine(factory_id=self.factory.id, template_id=self.line_template.id),
        )
        self.assertTrue(form.is_valid(), form.errors)
        obj = form.save()
        self.assertEqual(obj.attributes_values["ظرفیت"], 2000.0)
        self.assertEqual(obj.attributes_values["طول"], 75.0)

    def test_device_form_saves_attribute_values(self):
        from machines.admin import DeviceForm

        form = DeviceForm(
            data={
                "line": str(self.line.id),
                "template": str(self.device_template.id),
                "name": "دستگاه جدید",
                "code": "M-02",
                "order": "2",
                f"attr_{self.power.id}": "550",
            },
            instance=Device(line_id=self.line.id, template_id=self.device_template.id),
        )
        self.assertTrue(form.is_valid(), form.errors)
        obj = form.save()
        self.assertEqual(obj.attributes_values["توان"], 550.0)

    def test_change_form_preserves_existing_values(self):
        from machines.admin import ProductionLineForm

        form = ProductionLineForm(
            data={
                "factory": str(self.factory.id),
                "template": str(self.line_template.id),
                "name": self.line.name,
                "description": "",
                "line_type": self.line.line_type,
                f"attr_{self.capacity.id}": "1800",
                f"attr_{self.length.id}": "",
            },
            instance=self.line,
        )
        self.assertTrue(form.is_valid(), form.errors)
        obj = form.save()
        # طول خالی -> 0؛ ظرفیت از فرم
        self.assertEqual(obj.attributes_values["ظرفیت"], 1800.0)
        self.assertEqual(obj.attributes_values["طول"], 0)


class SimpleRequest:
    """شیء سبک برای متدهای get_fieldsets که فقط GET/POST خالی می‌خواهند."""

    POST = {}
    GET = {}
