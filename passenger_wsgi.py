import os
import sys

sys.path.insert(0, "/home/bataniir/mback.ba3tani.ir")

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "core.settings"
)

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
