"""Pruebas de clientes y proveedores mediante sus rutas de la API."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Cliente, Compra, Proveedor, Venta


class ContactosApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        usuarios = get_user_model()
        cls.admin = usuarios.objects.create_user(username="admin_contactos")
        cls.admin.groups.add(Group.objects.create(name="Administrador"))
        cls.cajero = usuarios.objects.create_user(username="cajero_contactos")
        cls.cajero.groups.add(Group.objects.create(name="Cajero"))
        cls.sin_rol = usuarios.objects.create_user(username="sin_rol_contactos")
        cls.cliente = Cliente.objects.create(id="cliente-prueba", nombre="Alicia")
        cls.proveedor = Proveedor.objects.create(id="proveedor-prueba", nombre="Luna")

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True, HTTP_HOST="localhost")

    def abrir_sesion(self, usuario):
        # La contraseña se prueba en test_auth.py; aquí conservamos sesión y CSRF.
        self.client.force_login(usuario)
        respuesta = self.client.get(reverse("pos:auth-csrf"))
        self.assertEqual(respuesta.status_code, 200)
        self.client.credentials(HTTP_X_CSRFTOKEN=respuesta.json()["csrfToken"])

    def test_visitante_y_usuario_sin_rol_no_acceden(self):
        for recurso in ("clientes", "proveedores"):
            self.assertEqual(self.client.get(reverse(f"pos:{recurso}-lista")).status_code, 403)
        self.abrir_sesion(self.sin_rol)
        for recurso in ("clientes", "proveedores"):
            url = reverse(f"pos:{recurso}-lista")
            self.assertEqual(self.client.get(url).status_code, 403)
            self.assertEqual(self.client.post(url, {"nombre": "No"}, format="json").status_code, 403)

    def test_cajero_no_gestiona_proveedores(self):
        self.abrir_sesion(self.cajero)
        lista = reverse("pos:proveedores-lista")
        detalle = reverse("pos:proveedores-detalle", args=[self.proveedor.pk])
        self.assertEqual(self.client.get(lista).status_code, 403)
        self.assertEqual(self.client.get(detalle).status_code, 403)
        self.assertEqual(self.client.post(lista, {"nombre": "No"}, format="json").status_code, 403)
        self.assertEqual(self.client.patch(detalle, {"nombre": "No"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete(detalle).status_code, 403)
        self.proveedor.refresh_from_db()
        self.assertEqual(self.proveedor.nombre, "Luna")

    def test_crud_para_los_roles_autorizados(self):
        casos = (
            (self.admin, "proveedores", Proveedor),
            (self.admin, "clientes", Cliente),
            (self.cajero, "clientes", Cliente),
        )
        for usuario, recurso, modelo in casos:
            with self.subTest(rol=usuario.username, recurso=recurso):
                self.abrir_sesion(usuario)
                lista = reverse(f"pos:{recurso}-lista")
                respuesta = self.client.post(lista, {
                    "id": "contacto-nuevo", "nombre": "  Contacto  ", "telefono": "+57 00123",
                }, format="json")
                self.assertEqual(respuesta.status_code, 201)
                self.assertEqual(respuesta.json()["nombre"], "Contacto")
                detalle = reverse(f"pos:{recurso}-detalle", args=["contacto-nuevo"])
                self.assertEqual(self.client.get(detalle).status_code, 200)
                listado = self.client.get(lista)
                self.assertEqual(listado.status_code, 200)
                self.assertIn("contacto-nuevo", [fila["id"] for fila in listado.json()])
                self.assertEqual(self.client.patch(
                    detalle, {"nombre": "Actualizado"}, format="json",
                ).status_code, 200)
                guardado = modelo.objects.get(pk="contacto-nuevo")
                self.assertEqual((guardado.nombre, guardado.telefono), ("Actualizado", "+57 00123"))
                respuesta = self.client.delete(detalle)
                self.assertEqual(respuesta.status_code, 200)
                self.assertEqual(respuesta.json(), {"id": "contacto-nuevo"})
                self.assertFalse(modelo.objects.filter(pk="contacto-nuevo").exists())

    def test_datos_invalidos_no_modifican_contactos(self):
        self.abrir_sesion(self.admin)
        for recurso, contacto in (("clientes", self.cliente), ("proveedores", self.proveedor)):
            detalle = reverse(f"pos:{recurso}-detalle", args=[contacto.pk])
            for datos in ({"nombre": " "}, {"correo": "invalido"}, {"id": "otro-id"}):
                with self.subTest(recurso=recurso, datos=datos):
                    self.assertEqual(self.client.patch(detalle, datos, format="json").status_code, 400)
            respuesta = self.client.post(reverse(f"pos:{recurso}-lista"), {
                "id": contacto.pk, "nombre": "Duplicado",
            }, format="json")
            self.assertEqual(respuesta.status_code, 400)
            nombre_original = contacto.nombre
            contacto.refresh_from_db()
            self.assertEqual(contacto.nombre, nombre_original)
            self.assertEqual(contacto.correo, "")

    def test_escrituras_sin_csrf_no_modifican_datos(self):
        self.abrir_sesion(self.admin)
        self.client.credentials()  # Mantiene la sesión, pero quita la cabecera CSRF.
        for recurso, contacto in (("clientes", self.cliente), ("proveedores", self.proveedor)):
            lista = reverse(f"pos:{recurso}-lista")
            detalle = reverse(f"pos:{recurso}-detalle", args=[contacto.pk])
            self.assertEqual(self.client.post(lista, {"nombre": "No"}, format="json").status_code, 403)
            self.assertEqual(self.client.patch(detalle, {"nombre": "No"}, format="json").status_code, 403)
            self.assertEqual(self.client.delete(detalle).status_code, 403)
            nombre_original = contacto.nombre
            contacto.refresh_from_db()
            self.assertEqual(contacto.nombre, nombre_original)

    def test_proveedor_con_compra_no_se_elimina(self):
        compra = Compra.objects.create(proveedor=self.proveedor, fecha="2026-11-16", total=0)
        self.abrir_sesion(self.admin)
        respuesta = self.client.delete(reverse("pos:proveedores-detalle", args=[self.proveedor.pk]))
        self.assertEqual(respuesta.status_code, 409)
        self.assertTrue(Proveedor.objects.filter(pk=self.proveedor.pk).exists())
        compra.refresh_from_db()
        self.assertEqual(compra.proveedor_id, self.proveedor.pk)

    def test_cliente_con_venta_abierta_o_cerrada_no_se_elimina(self):
        for estado in ("abierta", "cerrada"):
            cliente = Cliente.objects.create(nombre="Cliente con venta")
            venta = Venta.objects.create(cliente=cliente, estado=estado, metodoPago="Debe")
            for usuario in (self.admin, self.cajero):
                with self.subTest(estado=estado, usuario=usuario.username):
                    self.abrir_sesion(usuario)
                    respuesta = self.client.delete(reverse("pos:clientes-detalle", args=[str(cliente.pk)]))
                    self.assertEqual(respuesta.status_code, 409)
                    self.assertTrue(Cliente.objects.filter(pk=cliente.pk).exists())
                    venta.refresh_from_db()
                    self.assertEqual(venta.cliente_id, str(cliente.pk))

    def test_editar_cliente_no_cambia_nombre_historico(self):
        venta = Venta.objects.create(
            cliente=self.cliente, clienteNombre="Alicia", estado="cerrada", metodoPago="Debe",
        )
        self.abrir_sesion(self.cajero)
        respuesta = self.client.patch(
            reverse("pos:clientes-detalle", args=[self.cliente.pk]),
            {"nombre": "Nombre nuevo"}, format="json",
        )
        self.assertEqual(respuesta.status_code, 200)
        self.cliente.refresh_from_db()
        venta.refresh_from_db()
        self.assertEqual(self.cliente.nombre, "Nombre nuevo")
        self.assertEqual(venta.clienteNombre, "Alicia")
        self.assertEqual(venta.cliente_id, self.cliente.pk)

    def test_contacto_inexistente_devuelve_404(self):
        self.abrir_sesion(self.admin)
        for recurso in ("clientes", "proveedores"):
            url = reverse(f"pos:{recurso}-detalle", args=["no-existe"])
            self.assertEqual(self.client.get(url).status_code, 404)
            self.assertEqual(self.client.patch(url, {"nombre": "No"}, format="json").status_code, 404)
            self.assertEqual(self.client.delete(url).status_code, 404)
