"""Smoke test ادمین تب‌ها/گزارش‌ها: فرم‌ها، لینک‌ها و inlineها باید بدون خطا رندر شوند."""
from django.contrib.auth.models import User
from django.test import Client, TestCase

from machines.models import (
    Factory,
    FactoryTab,
    FactoryTabReport,
)

from .test_analysis import FactoryFixtureMixin


class TabAdminSmokeTests(FactoryFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.client = Client()
        self.client.force_login(User.objects.get(username="admin"))
        self.tab = FactoryTab.objects.create(
            factory=self.fac1, key="smoke", name="تب اسموک", require_line=False
        )
        from machines.models import FactoryTabInput

        FactoryTabInput.objects.create(tab=self.tab, key="feed", name="خوراک", input_type="number")
        self.report = FactoryTabReport.objects.create(tab=self.tab, name="گزارش اسموک", filters=[])

    def test_tab_change_page_renders_with_report_inline(self):
        r = self.client.get(f"/admin/machines/factorytab/{self.tab.pk}/change/")
        self.assertEqual(r.status_code, 200, r.content[:500])
        body = r.content.decode()
        self.assertIn("گزارش‌ها", body)

    def test_report_add_with_tab_prefill_and_widget_form(self):
        r = self.client.get(f"/admin/machines/factorytabreport/add/?tab={self.tab.pk}")
        self.assertEqual(r.status_code, 200)
        r2 = self.client.get(f"/admin/machines/factorytabwidget/add/?report={self.report.pk}")
        self.assertEqual(r2.status_code, 200)
        body = r2.content.decode()
        self.assertIn("in.feed", body)

    def test_report_change_page_renders_run_link(self):
        r = self.client.get(f"/admin/machines/factorytabreport/{self.report.pk}/change/")
        self.assertEqual(r.status_code, 200)
        self.assertIn(f"/api/factory-tab-reports/{self.report.pk}/run/", r.content.decode())

    def test_madan_index_groups_tabs_separately(self):
        from core.admin import madan_site
        from django.test import RequestFactory

        rf = RequestFactory()
        req = rf.get("/admin/")
        req.user = User.objects.get(username="admin")
        groups = madan_site.get_madan_groups(req)
        tab_group = next(g for g in groups if "تب‌های کارخانه" in g["title"])
        names = [m["verbose_name_plural"] for m in tab_group["models"]]
        self.assertTrue(any("تب" in n for n in names))
