# Generated manually for tab field modes and input/output line conditions

from django.db import migrations, models


def backfill_tab_modes(apps, schema_editor):
    FactoryTab = apps.get_model('machines', 'FactoryTab')
    for tab in FactoryTab.objects.all():
        tab.line_mode = 'required' if getattr(tab, 'require_line', True) else 'optional'
        tab.contractor_mode = 'required' if getattr(tab, 'contractor_required', False) else 'optional'
        tab.hour_mode = 'required' if getattr(tab, 'record_type', 'range') == 'daily' else 'disabled'
        tab.save(update_fields=['line_mode', 'contractor_mode', 'hour_mode'])


class Migration(migrations.Migration):

    dependencies = [
        ('machines', '0020_factorytabrecord_linked_records'),
    ]

    operations = [
        migrations.AddField(
            model_name='factorytab',
            name='line_mode',
            field=models.CharField(
                choices=[
                    ('required', 'الزامی'),
                    ('optional', 'اختیاری'),
                    ('disabled', 'غیرفعال (حذف از تب)'),
                ],
                default='required',
                max_length=20,
                verbose_name='وضعیت خط تولید',
            ),
        ),
        migrations.AddField(
            model_name='factorytab',
            name='contractor_mode',
            field=models.CharField(
                choices=[
                    ('required', 'الزامی'),
                    ('optional', 'اختیاری'),
                    ('disabled', 'غیرفعال (حذف از تب)'),
                ],
                default='optional',
                max_length=20,
                verbose_name='وضعیت پیمانکار',
            ),
        ),
        migrations.AddField(
            model_name='factorytab',
            name='hour_mode',
            field=models.CharField(
                choices=[
                    ('required', 'الزامی'),
                    ('optional', 'اختیاری'),
                    ('disabled', 'غیرفعال (حذف از تب)'),
                ],
                default='optional',
                max_length=20,
                verbose_name='وضعیت ساعت ورود',
            ),
        ),
        migrations.AddField(
            model_name='factorytabinput',
            name='conditions',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='مثال: {"lines": [1, 2]}',
                verbose_name='شرط‌های نمایش',
            ),
        ),
        migrations.AddField(
            model_name='factorytaboutput',
            name='conditions',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='مثال: {"lines": [1, 2]}',
                verbose_name='شرط‌های نمایش',
            ),
        ),
        migrations.RunPython(backfill_tab_modes, reverse_code=migrations.RunPython.noop),
    ]
