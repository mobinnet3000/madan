"""فیکسچر مشترک تست‌ها — بدون وابستگی به معماری قدیم."""

from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import (
    Contractor,
    Factory,
    ProductionLine,
    ProductionLineAttribute,
    ProductionLineTemplate,
)


def _make_client():
    user = User.objects.create_superuser("admin", "a@a.ir", "pass")
    client = APIClient()
    client.force_authenticate(user)
    return client


class FactoryFixtureMixin:
    def setUp(self):
        super().setUp()
        self.client = _make_client()

        self.fac1 = Factory.objects.create(name="کارخانه آهن ۱", address="")
        self.fac2 = Factory.objects.create(name="کارخانه مس ۲", address="")

        self.pla = ProductionLineAttribute.objects.create(name="ظرفیت", unit="تن")
        self.ltpl = ProductionLineTemplate.objects.create(name="الگو")
        self.ltpl.available_attributes.add(self.pla)

        self.line1 = ProductionLine.objects.create(
            name="خط ۱", factory=self.fac1, line_type="processing",
            template=self.ltpl, attributes_values={}, description="",
        )
        self.line2 = ProductionLine.objects.create(
            name="خط ۲", factory=self.fac1, line_type="crushing",
            template=self.ltpl, attributes_values={}, description="",
        )
        self.line3 = ProductionLine.objects.create(
            name="خط کارخانه ۲", factory=self.fac2, line_type="processing",
            template=self.ltpl, attributes_values={}, description="",
        )

        self.c1 = Contractor.objects.create(factory=self.fac1, name="پیمانکار A")
        self.c2 = Contractor.objects.create(factory=self.fac1, name="پیمانکار B")
        self.c3 = Contractor.objects.create(factory=self.fac2, name="پیمانکار کارخانه دیگر")
