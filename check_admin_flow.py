import os, django, io, traceback
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from machines.models import Factory, ProductionLineAttribute, ProductionLineTemplate, ProductionLine
from django_jsonform.forms.fields import JSONFormField

fac, _ = Factory.objects.get_or_create(name="TestFac")
pla, _ = ProductionLineAttribute.objects.get_or_create(name="capacity", unit="t/h")
ptpl, _ = ProductionLineTemplate.objects.get_or_create(name="TPL")
ptpl.available_attributes.add(pla)
line, _ = ProductionLine.objects.get_or_create(name="Line1", factory=fac, template=ptpl)

buf = io.StringIO()
try:
    template = getattr(line, "template", None)
    buf.write("template: %r\n" % template)
    schema = {
        a.name: {"type": "number", "default": 0, "title": f"{a.name} ({a.unit or 'واحد ندارد'})"}
        for a in template.available_attributes.all()
    }
    buf.write("schema: %r\n" % schema)
    f = JSONFormField(schema={"type": "object", "properties": schema}, label="x", required=False)
    buf.write("built OK widget=%r\n" % type(f.widget).__name__)
except Exception:
    buf.write("EXC:\n")
    buf.write(traceback.format_exc())

io.open("enc_out.txt", "w", encoding="utf-8").write(buf.getvalue())
print("done")
