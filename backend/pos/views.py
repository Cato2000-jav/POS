"""Vistas de la API del POS: validan permisos y coordinan cada petición."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.db.models.deletion import ProtectedError
from rest_framework import generics, status
from rest_framework.response import Response

from .models import Categoria, Cliente, Descuento, DetalleVenta, Producto, Proveedor
from .permissions import EsAdministrador, EsAdministradorOLecturaCajero, EsCajeroOAdministrador
from .serializers import (
    CategoriaSerializer, ClienteSerializer, DescuentoSerializer, ProductoEnVentaSerializer,
    ProductoSerializer, ProveedorSerializer,
)


class CategoriaListaVista(generics.ListCreateAPIView):
    """GET lista categorías y POST crea una categoría validada."""

    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [EsAdministradorOLecturaCajero]

    def create(self, request, *args, **kwargs):
        """También controla un ID duplicado por dos solicitudes simultáneas."""
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo crear la categoría por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )


class CategoriaDetalleVista(generics.RetrieveUpdateDestroyAPIView):
    """GET consulta, PUT/PATCH edita y DELETE elimina una categoría por ID."""

    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [EsAdministrador]

    def destroy(self, request, *args, **kwargs):
        """Confirma el ID eliminado y explica si existen productos asociados."""
        try:
            with transaction.atomic():
                categoria = self.get_object()
                categoria_id = str(categoria.pk)
                categoria.delete()
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar la categoría porque tiene productos asociados."},
                status=status.HTTP_409_CONFLICT,
            )
        except IntegrityError:
            return Response(
                {"detail": "No se pudo eliminar la categoría por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"id": categoria_id}, status=status.HTTP_200_OK)


class ProductoListaVista(generics.ListCreateAPIView):
    """Lista el catálogo y permite crear productos al administrador."""

    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [EsAdministradorOLecturaCajero]

    def create(self, request, *args, **kwargs):
        """Controla conflictos de ID o categoría durante el guardado."""
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo crear el producto por un conflicto de datos. Actualiza el catálogo."},
                status=status.HTTP_409_CONFLICT,
            )


class ProductoDetalleVista(generics.RetrieveUpdateDestroyAPIView):
    """Consulta productos y reserva su edición general y eliminación al administrador."""

    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [EsAdministradorOLecturaCajero]

    def get_queryset(self):
        """Solicita bloqueo de la fila durante escrituras dentro de la transacción."""
        consulta = super().get_queryset()
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return consulta.select_for_update()
        return consulta

    def update(self, request, *args, **kwargs):
        """Actualiza el producto dentro de una transacción; también atiende PATCH."""
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo actualizar el producto por un conflicto de datos. Actualiza el catálogo."},
                status=status.HTTP_409_CONFLICT,
            )

    def destroy(self, request, *args, **kwargs):
        """Conserva productos usados en ventas abiertas y los detalles históricos."""
        try:
            with transaction.atomic():
                producto = self.get_object()
                producto_id = str(producto.pk)
                en_venta_abierta = DetalleVenta.objects.filter(
                    venta__estado="abierta",
                ).filter(
                    Q(producto=producto) | Q(productoIdHistorico=producto_id),
                ).exists()
                if en_venta_abierta:
                    return Response(
                        {"detail": "No se puede eliminar el producto porque está en una venta abierta."},
                        status=status.HTTP_409_CONFLICT,
                    )
                producto.delete()
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar el producto porque tiene registros asociados protegidos."},
                status=status.HTTP_409_CONFLICT,
            )
        except IntegrityError:
            return Response(
                {"detail": "No se pudo eliminar el producto por un conflicto de datos. Actualiza el catálogo."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"id": producto_id}, status=status.HTTP_200_OK)


class ProductoEnVentaVista(generics.UpdateAPIView):
    """Edición limitada del catálogo desde el flujo de venta, sin cambiar stock."""

    queryset = Producto.objects.all()
    serializer_class = ProductoEnVentaSerializer
    permission_classes = [EsCajeroOAdministrador]
    http_method_names = ["patch", "options"]

    def get_queryset(self):
        """Solicita bloqueo del producto durante su actualización."""
        return super().get_queryset().select_for_update()

    def update(self, request, *args, **kwargs):
        """Valida los campos permitidos y devuelve el producto completo guardado."""
        try:
            with transaction.atomic():
                producto = self.get_object()
                serializer = self.get_serializer(
                    producto, data=request.data, partial=True,
                )
                serializer.is_valid(raise_exception=True)
                producto = serializer.save()
                datos = ProductoSerializer(producto).data
        except IntegrityError:
            return Response(
                {"detail": "No se pudo actualizar el producto por un conflicto de datos. Actualiza el catálogo."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(datos, status=status.HTTP_200_OK)


class ProveedorListaVista(generics.ListCreateAPIView):
    """Permite al administrador listar y crear proveedores."""

    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [EsAdministrador]

    def create(self, request, *args, **kwargs):
        """Controla conflictos de datos durante el guardado."""
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo crear el proveedor por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )


class ProveedorDetalleVista(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, edita y elimina proveedores con permisos de administrador."""

    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    permission_classes = [EsAdministrador]

    def get_queryset(self):
        """Solicita bloqueo de la fila durante las operaciones de escritura."""
        consulta = super().get_queryset()
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return consulta.select_for_update()
        return consulta

    def update(self, request, *args, **kwargs):
        """Guarda los cambios validados dentro de una transacción."""
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo actualizar el proveedor por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )

    def destroy(self, request, *args, **kwargs):
        """Impide eliminar proveedores asociados a compras y confirma el ID eliminado."""
        try:
            with transaction.atomic():
                proveedor = self.get_object()
                proveedor_id = str(proveedor.pk)
                proveedor.delete()
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar el proveedor porque tiene compras asociadas."},
                status=status.HTTP_409_CONFLICT,
            )
        except IntegrityError:
            return Response(
                {"detail": "No se pudo eliminar el proveedor por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"id": proveedor_id}, status=status.HTTP_200_OK)


class ClienteListaVista(generics.ListCreateAPIView):
    """Permite a administradores y cajeros listar y crear clientes."""

    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [EsCajeroOAdministrador]

    def create(self, request, *args, **kwargs):
        """Controla conflictos de datos durante el guardado."""
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo crear el cliente por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )


class ClienteDetalleVista(generics.RetrieveUpdateDestroyAPIView):
    """Consulta, edita y elimina clientes para los dos roles autorizados."""

    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [EsCajeroOAdministrador]

    def get_queryset(self):
        """Solicita bloqueo de la fila durante las operaciones de escritura."""
        consulta = super().get_queryset()
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return consulta.select_for_update()
        return consulta

    def update(self, request, *args, **kwargs):
        """Guarda la ficha del cliente sin modificar los datos históricos de ventas."""
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo actualizar el cliente por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )

    def destroy(self, request, *args, **kwargs):
        """Conserva clientes con ventas asociadas y confirma el ID eliminado."""
        try:
            with transaction.atomic():
                cliente = self.get_object()
                cliente_id = str(cliente.pk)
                cliente.delete()
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar el cliente porque tiene ventas asociadas."},
                status=status.HTTP_409_CONFLICT,
            )
        except IntegrityError:
            return Response(
                {"detail": "No se pudo eliminar el cliente por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"id": cliente_id}, status=status.HTTP_200_OK)


class DescuentoListaVista(generics.ListCreateAPIView):
    """Ambos roles consultan descuentos; solo el administrador los crea."""

    queryset = Descuento.objects.all()
    serializer_class = DescuentoSerializer
    permission_classes = [EsAdministradorOLecturaCajero]

    def create(self, request, *args, **kwargs):
        """Controla conflictos de datos durante el guardado."""
        try:
            with transaction.atomic():
                return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo crear el descuento por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )


class DescuentoDetalleVista(generics.RetrieveUpdateDestroyAPIView):
    """Consulta descuentos y reserva su edición y eliminación al administrador."""

    queryset = Descuento.objects.all()
    serializer_class = DescuentoSerializer
    permission_classes = [EsAdministradorOLecturaCajero]

    def get_queryset(self):
        """Solicita bloqueo de la fila durante las operaciones de escritura."""
        consulta = super().get_queryset()
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return consulta.select_for_update()
        return consulta

    def update(self, request, *args, **kwargs):
        """Actualiza el catálogo sin recalcular descuentos históricos de ventas."""
        try:
            with transaction.atomic():
                return super().update(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "No se pudo actualizar el descuento por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )

    def destroy(self, request, *args, **kwargs):
        """Elimina del catálogo; las ventas conservan sus campos históricos."""
        try:
            with transaction.atomic():
                descuento = self.get_object()
                descuento_id = str(descuento.pk)
                descuento.delete()
        except IntegrityError:
            return Response(
                {"detail": "No se pudo eliminar el descuento por un conflicto de datos. Actualiza la lista."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"id": descuento_id}, status=status.HTTP_200_OK)
