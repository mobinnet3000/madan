from django.db import migrations, models
import django.db.models.deletion

def forwards(apps, schema_editor):
    Shift = apps.get_model("machines", "Shift")
    ProductionLine = apps.get_model("machines", "ProductionLine")
    for shift in list(Shift.objects.all()):
        if shift.line_id:
            continue
        lines = list(ProductionLine.objects.filter(factory_id=shift.factory_id).order_by("id"))
        if not lines:
            continue
        shift.line_id = lines[0].id
        shift.save(update_fields=["line_id"])
        for line in lines[1:]:
            if Shift.objects.filter(line_id=line.id, name=shift.name).exists():
                continue
            Shift.objects.create(
                line_id=line.id,
                factory_id=shift.factory_id,
                name=shift.name,
                start_time=shift.start_time,
                end_time=shift.end_time,
                is_active=shift.is_active,
            )

class Migration(migrations.Migration):
    dependencies = [("machines", "0013_alter_actualanalysis_id_and_more")]
    operations = [
        migrations.RemoveConstraint(model_name="shift", name="uniq_shift_per_factory"),
        migrations.AddField(model_name="shift", name="line", field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="shifts", to="machines.productionline", verbose_name="خط تولید")),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.RemoveField(model_name="shift", name="factory"),
        migrations.AlterField(model_name="shift", name="line", field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="shifts", to="machines.productionline", verbose_name="خط تولید")),
        migrations.AddConstraint(model_name="shift", constraint=models.UniqueConstraint(fields=("line", "name"), name="uniq_shift_per_line")),
        migrations.AlterModelOptions(name="shift", options={"ordering": ["line", "start_time"], "verbose_name": "شیفت کاری", "verbose_name_plural": "شیفت‌های کاری"}),
    ]
