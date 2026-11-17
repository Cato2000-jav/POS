"""Pruebas de productos por HTTP: permisos, inventario e historial."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Categoria, DetalleVenta, Producto, Venta


class ProductosApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        usuarios = get_user_model()
        cls.admin = usuarios.objects.create_user(username="admin_productos")
        cls.admin.groups.add(Group.objects.create(name="Administrador"))
        cls.cajero = usuarios.objects.create_user(username="cajero_productos")
        cls.cajero.groups.add(Group.objects.create(name="Cajero"))
        cls.sin_rol = usuarios.objects.create_user(username="sin_rol")
        cls.categoria = Categoria.objects.create(id="cat-prueba", nombre="Cuadernos")
        cls.producto = Producto.objects.create(
            id="producto-prueba", nombre="Cuaderno", categoria=cls.categoria,
            precio=5000, costo=3000, seguimientoInventario=True, stock=10,
        )

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True, HTTP_HOST="localhost")
        self.lista_url = reverse("pos:productos-lista")
        self.detalle_url = reverse("pos:productos-detalle", args=[self.producto.pk])
        self.venta_url = reverse("pos:productos-desde-venta", args=[self.producto.pk])

    def abrir_sesion(self, usuario):
        # El login con contraseña se prueba en test_auth.py. Aquí usamos una
        # sesión de Django y conservamos la comprobación real de CSRF.
        self.client.force_login(usuario)
        respuesta = self.client.get(reverse("pos:auth-csrf"))
        self.assertEqual(respuesta.status_code, 200)
        self.client.credentials(HTTP_X_CSRFTOKEN=respuesta.json()["csrfToken"])

    def crear_detalle(self, estado):
        venta = Venta.objects.create(
            estado=estado, metodoPago="Efectivo", subtotal=10000, total=10000,
        )
        return DetalleVenta.objects.create(
            venta=venta, producto=self.producto,
            productoIdHistorico=self.producto.pk, nombre="Cuaderno",
            cantidad=2, precio=5000, costo=3000, subtotal=10000,
        )

    def test_visitante_y_usuario_sin_rol_no_consultan_catalogo(self):
        self.assertEqual(self.client.get(self.lista_url).status_code, 403)
        self.abrir_sesion(self.sin_rol)
        self.assertEqual(self.client.get(self.lista_url).status_code, 403)
        self.assertEqual(self.client.patch(
            self.venta_url, {"nombre": "No permitido"}, format="json",
        ).status_code, 403)

    def test_cajero_consulta_pero_no_realiza_crud_general(self):
        self.abrir_sesion(self.cajero)
        self.assertEqual(self.client.get(self.lista_url).status_code, 200)
        respuesta = self.client.get(self.detalle_url)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["categoriaId"], self.categoria.pk)
        self.assertEqual(self.client.post(self.lista_url, {}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(
            self.detalle_url, {"stock": 99}, format="json",
        ).status_code, 403)
        self.assertEqual(self.client.delete(self.detalle_url).status_code, 403)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 10)

    def test_administrador_crea_edita_y_elimina_producto(self):
        self.abrir_sesion(self.admin)
        respuesta = self.client.post(self.lista_url, {
            "id": "nuevo", "nombre": "Lápiz", "categoriaId": self.categoria.pk,
            "precio": 1000, "costo": 500, "seguimientoInventario": True, "stock": 4,
        }, format="json")
        self.assertEqual(respuesta.status_code, 201)
        url = reverse("pos:productos-detalle", args=["nuevo"])
        self.assertEqual(self.client.patch(url, {"precio": 1200}, format="json").status_code, 200)
        self.assertEqual(Producto.objects.get(pk="nuevo").precio, 1200)
        respuesta = self.client.delete(url)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), {"id": "nuevo"})
        self.assertFalse(Producto.objects.filter(pk="nuevo").exists())

    def test_valores_invalidos_no_alteran_producto(self):
        self.abrir_sesion(self.admin)
        for datos in ({"precio": -1}, {"costo": 1.5}, {"stock": -1},
                      {"categoriaId": "no-existe"}, {"id": "otro-id"}):
            with self.subTest(datos=datos):
                respuesta = self.client.patch(self.detalle_url, datos, format="json")
                self.assertEqual(respuesta.status_code, 400)
        self.producto.refresh_from_db()
        self.assertEqual((self.producto.precio, self.producto.costo, self.producto.stock),
                         (5000, 3000, 10))
        self.assertEqual(self.producto.categoria_id, self.categoria.pk)
        self.assertEqual(Producto.objects.count(), 1)

    def test_edicion_desde_venta_conserva_stock_e_historial(self):
        detalle = self.crear_detalle("cerrada")
        otra_categoria = Categoria.objects.create(nombre="Escolares")
        self.abrir_sesion(self.cajero)
        respuesta = self.client.patch(self.venta_url, {
            "nombre": "Cuaderno nuevo", "categoriaId": str(otra_categoria.pk),
            "precio": 6000, "costo": 3500,
        }, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["stock"], 10)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, "Cuaderno nuevo")
        self.assertEqual(self.producto.categoria_id, str(otra_categoria.pk))
        self.assertEqual((self.producto.precio, self.producto.costo), (6000, 3500))
        detalle.refresh_from_db()
        self.assertEqual((detalle.nombre, detalle.precio, detalle.costo, detalle.subtotal),
                         ("Cuaderno", 5000, 3000, 10000))

    def test_campos_prohibidos_rechazan_toda_la_edicion_desde_venta(self):
        self.abrir_sesion(self.cajero)
        for campo, valor in (("stock", 99), ("codigo", "X"), ("id", "otro"),
                             ("seguimientoInventario", False)):
            with self.subTest(campo=campo):
                respuesta = self.client.patch(
                    self.venta_url, {"nombre": "No guardar", campo: valor}, format="json",
                )
                self.assertEqual(respuesta.status_code, 400)
                self.assertIn(campo, respuesta.json())
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, "Cuaderno")
        self.assertEqual(self.producto.stock, 10)

    def test_edicion_desde_venta_exige_csrf_y_solo_admite_patch(self):
        self.abrir_sesion(self.cajero)
        self.assertEqual(self.client.delete(self.venta_url).status_code, 405)
        self.client.credentials()  # Quita la cabecera CSRF, conserva la sesión.
        self.assertEqual(self.client.patch(
            self.venta_url, {"nombre": "No guardar"}, format="json",
        ).status_code, 403)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, "Cuaderno")

    def test_producto_en_venta_abierta_no_se_elimina(self):
        detalle = self.crear_detalle("abierta")
        self.abrir_sesion(self.admin)
        self.assertEqual(self.client.delete(self.detalle_url).status_code, 409)
        # También se protege el ID histórico si falta el vínculo directo.
        detalle.producto = None
        detalle.save(update_fields=["producto"])
        self.assertEqual(self.client.delete(self.detalle_url).status_code, 409)
        self.assertTrue(Producto.objects.filter(pk=self.producto.pk).exists())

    def test_eliminar_producto_conserva_venta_cerrada(self):
        detalle = self.crear_detalle("cerrada")
        self.abrir_sesion(self.admin)
        self.assertEqual(self.client.delete(self.detalle_url).status_code, 200)
        detalle.refresh_from_db()
        self.assertIsNone(detalle.producto_id)
        self.assertEqual(detalle.productoIdHistorico, self.producto.pk)
        self.assertEqual((detalle.nombre, detalle.precio, detalle.subtotal),
                         ("Cuaderno", 5000, 10000))
        self.assertTrue(Venta.objects.filter(pk=detalle.venta_id).exists())
