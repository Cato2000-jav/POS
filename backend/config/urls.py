"""Rutas principales del backend de Papel y Luna."""

from django.contrib import admin
from django.urls import include, path
from pos.authors import authors


urlpatterns = [
    path("authors", authors, name="authors"),
    # Panel administrativo de Django; requiere un usuario con permisos.
    path("admin/", admin.site.urls),
    # Delega las rutas de negocio al módulo pos.urls.
    path("api/", include("pos.urls")),
]

from pos.frontend import pagina
urlpatterns += [path('', pagina), path('<path:ruta>', pagina)]
