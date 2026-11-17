"""Punto de entrada para servir el POS con un servidor compatible con WSGI."""

import os

from django.core.wsgi import get_wsgi_application


# Usa la misma configuración que manage.py, salvo una elección explícita.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# El servidor utilizará este objeto para entregar las peticiones a Django.
application = get_wsgi_application()
