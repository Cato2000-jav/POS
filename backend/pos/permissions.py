"""Permisos del backend basados en los usuarios y grupos de Django."""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class EsAdministrador(BasePermission):
    """Permite acceso a administradores activos, incluidos los superusuarios."""

    message = "Esta operación requiere permisos de administrador."

    def has_permission(self, request, view):
        """Comprueba el usuario autenticado por el servidor, no datos del formulario."""
        usuario = request.user
        if not usuario or not usuario.is_authenticated or not usuario.is_active:
            return False

        # is_staff por sí solo no concede el rol de administrador del POS.
        return usuario.is_superuser or usuario.groups.filter(name="Administrador").exists()


class EsAdministradorOLecturaCajero(EsAdministrador):
    """Permite gestionar al administrador y consultar al cajero."""

    message = "Solo el administrador puede modificar el catálogo; el cajero puede consultarlo."

    def has_permission(self, request, view):
        """Autoriza al cajero únicamente en métodos de consulta HTTP."""
        if super().has_permission(request, view):
            return True

        usuario = request.user
        if not usuario or not usuario.is_authenticated or not usuario.is_active:
            return False

        # SAFE_METHODS incluye GET, HEAD y OPTIONS; no permite escrituras.
        return (
            request.method in SAFE_METHODS
            and usuario.groups.filter(name="Cajero").exists()
        )


class EsCajeroOAdministrador(EsAdministrador):
    """Autoriza operaciones compartidas por los dos roles del POS."""

    message = "Esta operación requiere un usuario con rol Cajero o Administrador."

    def has_permission(self, request, view):
        """Permite el acceso solo a usuarios activos de un rol autorizado."""
        if super().has_permission(request, view):
            return True

        usuario = request.user
        if not usuario or not usuario.is_authenticated or not usuario.is_active:
            return False

        return usuario.groups.filter(name="Cajero").exists()
