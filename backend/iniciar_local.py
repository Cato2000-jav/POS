"""Arranque local: clave privada persistente, migraciones y usuarios de demostración."""
import os
from pathlib import Path
import secrets
import subprocess
import sys

RAIZ = Path(__file__).resolve().parent
clave = RAIZ / '.secret-local'
if not clave.exists():
    # El modo exclusivo evita reemplazar una clave existente.
    with clave.open('x') as archivo:
        archivo.write(secrets.token_urlsafe(64))
    clave.chmod(0o600)
os.environ.setdefault('DJANGO_SECRET_KEY', clave.read_text().strip())
os.environ.setdefault('DJANGO_DEBUG', 'true')
for argumentos in [('migrate',), ('inicializar', '--demo'), ('runserver', '127.0.0.1:8000')]:
    subprocess.run([sys.executable, str(RAIZ / 'manage.py'), *argumentos], cwd=RAIZ, check=True)
