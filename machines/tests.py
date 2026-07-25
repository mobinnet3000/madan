from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from .models import (
    Factory, Shift, FailureReason, ProductionLineAttribute,
    ProductionLineTemplate, ProductionLine, Attribute, DeviceTemplate,
    Device, DeviceLog, DeviceDailyAnalysis
)
from accounts.models import UserProfile


class TestDeviceLogEfficiency(TestCase):
    def setUp(self):
        fac = Factory.objects.create(name='Test Factory', address='...')
        pla = ProductionLineAttribute.objects.create(name='ظرفیت', unit='تن')
        tpl = ProductionLineTemplate.objects.create(name='الگو')
        tpl.available_attributes.add(pla)
        self.line = ProductionLine.objects.create(
            name='Test Line', factory=fac, template=tpl,
            attributes_values={'ظرفیت': 100}
        )
        shift = Shift.objects.create(factory=fac, name='صبح', start_time='06:00', end_time='14:00')

    def test_efficiency_calculation(self):
        shift = Shift.objects.first()
        log = DeviceLog(
            line=self.line, shift=shift, date='2025-01-01',
            feed_tonnage=100, product_tonnage=75, runtime_hours=8
        )
        log.save()
        self.assertEqual(log.efficiency, 75.0)

    def test_efficiency_none_when_zero_feed(self):
        shift = Shift.objects.first()
        log = DeviceLog(
            line=self.line, shift=shift, date='2025-01-02',
            feed_tonnage=0, product_tonnage=0, runtime_hours=8
        )
        log.save()
        self.assertIsNone(log.efficiency)

    def test_hours_cannot_exceed_24(self):
        shift = Shift.objects.first()
        log = DeviceLog(
            line=self.line, shift=shift, date='2025-01-03',
            runtime_hours=20, downtime_hours=10
        )
        with self.assertRaises(ValidationError):
            log.full_clean()

    def test_runtime_and_downtime_can_sum_to_24(self):
        shift = Shift.objects.first()
        log = DeviceLog(
            line=self.line, shift=shift, date='2025-01-04',
            runtime_hours=16, downtime_hours=8
        )
        try:
            log.full_clean()
        except ValidationError:
            self.fail("16+8=24 should be allowed")


class TestDeviceLogFactoryScope(TestCase):
    def test_operator_sees_only_own_factory(self):
        fac1 = Factory.objects.create(name='F1', address='')
        fac2 = Factory.objects.create(name='F2', address='')
        user = User.objects.create_user('op', 'op@test.com', 'pass')
        UserProfile.objects.create(user=user, role='operator', factory=fac1)
        self.assertEqual(user.profile.factory, fac1)
        self.assertNotEqual(user.profile.factory, fac2)


class TestDeviceClean(TestCase):
    def setUp(self):
        self.fac = Factory.objects.create(name='F', address='')
        self.attr = Attribute.objects.create(name='توان')
        self.tpl = DeviceTemplate.objects.create(name='T')
        self.tpl.available_attributes.add(self.attr)
        pla = ProductionLineAttribute.objects.create(name='ظرفیت')
        ptpl = ProductionLineTemplate.objects.create(name='PT')
        ptpl.available_attributes.add(pla)
        self.line = ProductionLine.objects.create(name='L', factory=self.fac, template=ptpl)

    def test_device_clean_rejects_invalid_attributes(self):
        d = Device(name='D', line=self.line, template=self.tpl)
        d.save()
        d.attributes_values = {'غیرمجاز': 123}
        d.save()
        d.refresh_from_db()
        self.assertNotIn('غیرمجاز', d.attributes_values)
        self.assertIn('توان', d.attributes_values)

    def test_analyzer_validation(self):
        shift = Shift.objects.create(factory=self.fac, name='صبح', start_time='06:00', end_time='14:00')
        d = Device(name='An', line=self.line, template=self.tpl, is_analyzer=False)
        d.save()
        analysis = DeviceDailyAnalysis(device=d, shift=shift, date='2025-01-01')
        with self.assertRaises(ValidationError):
            analysis.full_clean()
