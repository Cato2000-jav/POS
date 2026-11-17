#!/usr/bin/env bash
# Si un paso falla, se cancela el despliegue para no publicar una versión incompleta.
set -euo pipefail
cd "$(dirname "$0")"
python -m pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
# Crea los usuarios iniciales sin datos ficticios ni cambiar usuarios existentes.
python manage.py inicializar
