import os
import sys

BASE_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.dirname(BASE_DIR)
for p in (BASE_DIR, ROOT_DIR, "/home/bataniir/mback.ba3tani.ir/backend", "/home/bataniir/mback.ba3tani.ir"):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "core.settings"
)

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
