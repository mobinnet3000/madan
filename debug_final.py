import os, sys, json
sys.path.insert(0, 'C:\\Users\\meck\\Documents\\madan')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.test import RequestFactory
from django.urls import resolve
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User

user = User.objects.filter(is_superuser=True).first()
token = Token.objects.get_or_create(user=user)[0]

rf = RequestFactory()
request = rf.get('/api/reports/performance/', {'range': '30days', 'format': 'pdf'},
    HTTP_AUTHORIZATION='Token ' + token.key)

match = resolve('/api/reports/performance/')
response = match.func(request, *match.args, **match.kwargs)

print('Status:', response.status_code)
response.render()
data = json.loads(response.content)
print('JSON:', json.dumps(data, ensure_ascii=True))
