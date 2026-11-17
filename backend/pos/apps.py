"""Identificación de la aplicación de negocio del POS dentro de Django."""

from django.apps import AppConfig


class PosConfig(AppConfig):
    """Agrupa los modelos y las operaciones de Papel y Luna."""

    # Se aplica solo a modelos que no declaren su propia clave primaria.
    default_auto_field = "django.db.models.BigAutoField"
    name = "pos"
    verbose_name = "Papel y Luna"
