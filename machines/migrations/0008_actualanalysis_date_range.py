from django.db import migrations, models


def copy_date_to_range(apps, schema_editor):
    ActualAnalysis = apps.get_model("machines", "ActualAnalysis")
    for obj in ActualAnalysis.objects.all():
        obj.date_from = obj.date
        obj.date_to = obj.date
        obj.save(update_fields=["date_from", "date_to"])


class Migration(migrations.Migration):

    dependencies = [
        ("machines", "0007_analysistypedefinition_contractor_actualanalysis_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="actualanalysis",
            name="date_from",
            field=models.DateField(null=True, verbose_name="تاریخ شروع بازه"),
        ),
        migrations.AddField(
            model_name="actualanalysis",
            name="date_to",
            field=models.DateField(null=True, verbose_name="تاریخ پایان بازه"),
        ),
        migrations.RunPython(copy_date_to_range, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="actualanalysis",
            name="date_from",
            field=models.DateField(db_index=True, verbose_name="تاریخ شروع بازه"),
        ),
        migrations.AlterField(
            model_name="actualanalysis",
            name="date_to",
            field=models.DateField(verbose_name="تاریخ پایان بازه"),
        ),
        # ایندکس ترکیبی قدیمی (line, date) قبل از حذف ستون حذف می‌شود
        migrations.RemoveIndex(
            model_name="actualanalysis",
            name="machines_ac_line_id_25e4c7_idx",
        ),
        migrations.RemoveField(
            model_name="actualanalysis",
            name="date",
        ),
        migrations.AlterModelOptions(
            name="actualanalysis",
            options={
                "ordering": ["-date_from", "-created_at"],
                "verbose_name": "آنالیز واقعی",
                "verbose_name_plural": "آنالیزهای واقعی",
            },
        ),
        migrations.AddIndex(
            model_name="actualanalysis",
            index=models.Index(
                fields=["line", "date_from"], name="machines_ac_line_id_ee3b60_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="actualanalysis",
            index=models.Index(
                fields=["line", "date_to"], name="machines_ac_line_id_327cfd_idx"
            ),
        ),
    ]
