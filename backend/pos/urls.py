"""Rutas de la API del POS, que se incluirán bajo el prefijo /api/."""

from django.urls import path

from .auth_views import CsrfVista, LoginVista, LogoutVista, SesionVista
from .views import (
    CategoriaDetalleVista,
    CategoriaListaVista,
    ClienteDetalleVista,
    ClienteListaVista,
    ProductoDetalleVista,
    ProductoEnVentaVista,
    ProductoListaVista,
    ProveedorDetalleVista,
    ProveedorListaVista,
)


app_name = "pos"

urlpatterns = [
    path("auth/csrf/", CsrfVista.as_view(), name="auth-csrf"),
    path("auth/login/", LoginVista.as_view(), name="auth-login"),
    path("auth/sesion/", SesionVista.as_view(), name="auth-sesion"),
    path("auth/logout/", LogoutVista.as_view(), name="auth-logout"),
    path("categorias/", CategoriaListaVista.as_view(), name="categorias-lista"),
    path(
        "categorias/<str:pk>/",
        CategoriaDetalleVista.as_view(),
        name="categorias-detalle",
    ),
    path("productos/", ProductoListaVista.as_view(), name="productos-lista"),
    path(
        "productos/<str:pk>/desde-venta/",
        ProductoEnVentaVista.as_view(),
        name="productos-desde-venta",
    ),
    path(
        "productos/<str:pk>/",
        ProductoDetalleVista.as_view(),
        name="productos-detalle",
    ),
    path("proveedores/", ProveedorListaVista.as_view(), name="proveedores-lista"),
    path(
        "proveedores/<str:pk>/",
        ProveedorDetalleVista.as_view(),
        name="proveedores-detalle",
    ),
    path("clientes/", ClienteListaVista.as_view(), name="clientes-lista"),
    path(
        "clientes/<str:pk>/",
        ClienteDetalleVista.as_view(),
        name="clientes-detalle",
    ),
]

from .views import DescuentoListaVista, DescuentoDetalleVista
from .operations_views import (VentasVista, VentaVista, CierreVista, CorreccionVista,
    ComprasVista, CompraVista, ReembolsosVista, FaltantesVista, FaltanteVista, ReportesVista, ProveedoresFaltantesVista)

urlpatterns += [
    path('descuentos/', DescuentoListaVista.as_view(), name='descuentos-lista'),
    path('descuentos/<str:pk>/', DescuentoDetalleVista.as_view(), name='descuentos-detalle'),
    path('ventas/', VentasVista.as_view(), name='ventas-lista'),
    path('ventas/<str:pk>/', VentaVista.as_view(), name='ventas-detalle'),
    path('ventas/<str:pk>/cerrar/', CierreVista.as_view(), name='ventas-cerrar'),
    path('ventas/<str:pk>/corregir/', CorreccionVista.as_view(), name='ventas-corregir'),
    path('compras/', ComprasVista.as_view(), name='compras-lista'),
    path('compras/<str:pk>/', CompraVista.as_view(), name='compras-detalle'),
    path('reembolsos/', ReembolsosVista.as_view(), name='reembolsos-lista'),
    path('faltantes/', FaltantesVista.as_view(), name='faltantes-lista'),
    path('faltantes/proveedores/', ProveedoresFaltantesVista.as_view()),
    path('faltantes/<str:pk>/', FaltanteVista.as_view(), name='faltantes-detalle'),
    path('reportes/', ReportesVista.as_view(), name='reportes'),
]
