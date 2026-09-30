import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
_extra = os.environ.get("MADAN_EXTRA_PATH", "")
candidates = [str(BASE_DIR), str(ROOT_DIR)]
if _extra:
    candidates.append(_extra)
candidates += ["/home/bataniir/mback.ba3tani.ir/backend", "/home/bataniir/mback.ba3tani.ir"]
for p in candidates:
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "core.settings"
)

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()
