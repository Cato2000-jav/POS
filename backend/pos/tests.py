"""Pruebas de integridad de modelos con una base de datos de prueba."""

from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase

from .models import Categoria, Cliente, Descuento, DetalleVenta, Producto, Venta


class ModelosPosTests(TestCase):
    def setUp(self):
        """Prepara datos nuevos para cada prueba, sin consultar Google Sheets."""
        self.categoria = Categoria.objects.create(nombre="Cuadernos")
        self.producto = Producto.objects.create(
            nombre="Cuaderno", categoria=self.categoria,
            precio=5000, costo=3000, seguimientoInventario=True, stock=10,
        )

    def crear_detalle(self, venta):
        """Guarda los datos históricos que proporcionará el servicio de ventas."""
        return DetalleVenta.objects.create(
            venta=venta, producto=self.producto,
            productoIdHistorico=str(self.producto.pk), nombre=self.producto.nombre,
            cantidad=2, precio=5000, costo=3000, subtotal=10000,
        )

    def test_categoria_con_productos_no_se_elimina(self):
        with self.assertRaises(ProtectedError):
            self.categoria.delete()
        self.assertTrue(Categoria.objects.filter(pk=self.categoria.pk).exists())

    def test_venta_debe_sin_cliente_es_rechazada(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Venta.objects.create(metodoPago="Debe")

    def test_cliente_con_venta_no_se_elimina(self):
        cliente = Cliente.objects.create(nombre="Cliente de prueba")
        Venta.objects.create(cliente=cliente, metodoPago="Debe")
        with self.assertRaises(ProtectedError):
            cliente.delete()

    def test_venta_cerrada_sin_metodo_es_rechazada(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Venta.objects.create(estado="cerrada")

    def test_editar_catalogo_no_altera_detalle_historico(self):
        venta = Venta.objects.create(estado="cerrada", metodoPago="Efectivo")
        detalle = self.crear_detalle(venta)
        self.producto.nombre = "Nombre nuevo"
        self.producto.precio = 6000
        self.producto.save()
        detalle.refresh_from_db()
        self.assertEqual(detalle.nombre, "Cuaderno")
        self.assertEqual(detalle.precio, 5000)
        self.assertEqual(detalle.subtotal, 10000)

    def test_eliminar_producto_conserva_detalle_cerrado(self):
        venta = Venta.objects.create(estado="cerrada", metodoPago="Efectivo")
        detalle = self.crear_detalle(venta)
        producto_id = str(self.producto.pk)
        self.producto.delete()
        detalle.refresh_from_db()
        self.assertIsNone(detalle.producto_id)
        self.assertEqual(detalle.productoIdHistorico, producto_id)
        self.assertEqual(detalle.nombre, "Cuaderno")

    def test_subtotal_incorrecto_es_rechazado(self):
        venta = Venta.objects.create()
        detalle = self.crear_detalle(venta)
        with self.assertRaises(IntegrityError), transaction.atomic():
            DetalleVenta.objects.filter(pk=detalle.pk).update(subtotal=9999)

    def test_porcentaje_superior_a_cien_es_rechazado(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Descuento.objects.create(nombre="Inválido", tipo="porcentaje", valor=101)

    def test_eliminar_descuento_conserva_datos_aplicados(self):
        descuento = Descuento.objects.create(nombre="Escolar", tipo="porcentaje", valor=10)
        descuento_id = str(descuento.pk)
        venta = Venta.objects.create(
            estado="cerrada", metodoPago="Efectivo", descuento=descuento,
            descuentoIdHistorico=descuento_id, descuentoNombre="Escolar",
            descuentoTipo="porcentaje", descuentoValor=10, descuentoMonto=1000,
        )
        descuento.delete()
        venta.refresh_from_db()
        self.assertIsNone(venta.descuento_id)
        self.assertEqual(venta.descuentoIdHistorico, descuento_id)
        self.assertEqual(venta.descuentoValor, 10)
        self.assertEqual(venta.descuentoMonto, 1000)

    def test_correccion_sin_responsable_y_fecha_es_rechazada(self):
        venta = Venta.objects.create(estado="cerrada", metodoPago="Efectivo")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Venta.objects.filter(pk=venta.pk).update(corregida=True)

    def test_guardar_venta_abierta_no_modifica_stock(self):
        venta = Venta.objects.create()
        self.crear_detalle(venta)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 10)
