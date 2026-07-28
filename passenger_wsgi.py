"""
Passenger WSGI entry point for cPanel Python App.
Place this in the backend root directory.
"""
import os, sys

# Point to the project root
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
