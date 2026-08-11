#!/usr/bin/env python
"""Smoke check for Persian report generation (run directly: python reports_integration_check.py).

Kept out of test discovery (not named test_*) so `manage.py test` stays clean.
"""
import os
import sys
import io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

out = io.open(sys.stdout.fileno(), 'w', encoding='utf-8', closefd=False)
say = lambda s: (out.write(str(s) + "\n"), out.flush())


def ok(msg):
    say("[OK] " + msg)


def fail(msg):
    say("[FAIL] " + msg)


try:
    from openpyxl import Workbook  # noqa: F401
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import xhtml2pdf  # noqa: F401
    import arabic_reshaper  # noqa: F401
    import bidi  # noqa: F401
    ok("All Python packages imported")

    import django
    django.setup()
    ok("Django setup completed")

    from machines.reports import generate_performance_report
    from machines.models import Factory, DeviceLog
    ok("Reports module and models imported")

    factory_count = Factory.objects.count()
    log_count = DeviceLog.objects.count()
    say(f"[DATA] factories={factory_count} logs={log_count}")

    font_files = [
        'machines/fonts/Vazirmatn-FD-Regular.ttf',
        'machines/fonts/Vazirmatn-FD-Bold.ttf',
        'machines/fonts/Vazirmatn-FD-Medium.ttf',
    ]
    if not all(os.path.exists(f) for f in font_files):
        fail("Persian font files missing")
        sys.exit(1)
    ok("Persian font files exist")

    for font_file in font_files:
        if 'Bold' in font_file:
            pdfmetrics.registerFont(TTFont('VazirBold', font_file))
        elif 'Regular' in font_file:
            pdfmetrics.registerFont(TTFont('Vazir', font_file))
        elif 'Medium' in font_file:
            pdfmetrics.registerFont(TTFont('VazirMedium', font_file))
    ok("All Persian fonts registered")

    say("Testing PDF/Excel report generation (توقفات خط تولید):")
    cases = [
        ('performance', 'today'), ('performance', 'yesterday'),
        ('performance', 'this_week'), ('performance', 'this_month'),
        ('performance', 'this_year'), ('performance', '30days'), ('performance', 'all'),
        ('performance', 'all', 'excel'),
    ]
    all_ok = True
    for spec in cases:
        kind, range_key = spec[0], spec[1]
        fmt = spec[2] if len(spec) > 2 else 'pdf'
        try:
            buf, _ = generate_performance_report(None, range_key, fmt=fmt)
            ok(f"{kind}/{range_key} [{fmt}]: {len(buf.getvalue())} bytes")
        except Exception as e:  # noqa: BLE001
            all_ok = False
            fail(f"{kind}/{range_key} [{fmt}]: {e}")

    if all_ok:
        say("REPORT GENERATION INTEGRATION CHECK PASSED")
    else:
        sys.exit(1)
except Exception as e:  # noqa: BLE001
    fail(f"Critical error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
