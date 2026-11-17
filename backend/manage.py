"""Punto de entrada para los comandos administrativos de Django."""

import os
import sys


def main():
    """Carga la configuración del proyecto y ejecuta el comando solicitado."""
    # Django buscará la configuración en backend/config/settings.py.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

    try:
        from django.core.management import execute_from_command_line
    except ImportError as error:
        raise ImportError(
            "No se pudo importar Django. Activa el entorno virtual e instala "
            "las dependencias de backend/requirements.txt."
        ) from error

    # Pasa a Django los argumentos, por ejemplo: check, migrate o runserver.
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
