"""Pruebas de sesión con cookies y protección CSRF activada."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Venta


class AutenticacionTests(TestCase):
    # Credencial exclusiva de la base temporal de pruebas, no de producción.
    clave = "Clave-solo-pruebas-2026"

    @classmethod
    def setUpTestData(cls):
        usuarios = get_user_model()
        cls.admin = usuarios.objects.create_user(username="admin_prueba", password=cls.clave)
        cls.admin.groups.add(Group.objects.create(name="Administrador"))
        cls.cajero = usuarios.objects.create_user(username="cajero_prueba", password=cls.clave)
        cls.cajero.groups.add(Group.objects.create(name="Cajero"))

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True, HTTP_HOST="localhost")
        self.csrf_url = reverse("pos:auth-csrf")
        self.login_url = reverse("pos:auth-login")
        self.sesion_url = reverse("pos:auth-sesion")
        self.logout_url = reverse("pos:auth-logout")
        self.categorias_url = reverse("pos:categorias-lista")

    def obtener_csrf(self):
        respuesta = self.client.get(self.csrf_url)
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("csrftoken", self.client.cookies)
        return respuesta.json()["csrfToken"]

    def iniciar_sesion(self, username):
        token = self.obtener_csrf()
        respuesta = self.client.post(
            self.login_url, {"username": username, "password": self.clave},
            format="json", HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(respuesta.status_code, 200)
        return respuesta.json()["csrfToken"]

    def test_visitante_no_puede_consultar_sesion(self):
        self.assertEqual(self.client.get(self.sesion_url).status_code, 403)

    def test_login_sin_csrf_es_rechazado(self):
        respuesta = self.client.post(
            self.login_url,
            {"username": self.admin.username, "password": self.clave}, format="json",
        )
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(self.client.get(self.sesion_url).status_code, 403)

    def test_credenciales_invalidas_no_abren_sesion(self):
        token = self.obtener_csrf()
        respuesta = self.client.post(
            self.login_url, {"username": self.admin.username, "password": "incorrecta"},
            format="json", HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.json()["detail"], "Usuario o contraseña incorrectos.")
        self.assertEqual(self.client.get(self.sesion_url).status_code, 403)

    def test_sesion_conserva_identidad_sin_exponer_clave(self):
        self.iniciar_sesion(self.admin.username)
        respuesta = self.client.get(self.sesion_url)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json(), {"usuario": {
            "id": self.admin.pk, "username": self.admin.username, "rol": "Administrador",
        }})
        self.assertIn("no-store", respuesta["Cache-Control"])

    def test_cajero_no_puede_gestionar_categorias(self):
        token = self.iniciar_sesion(self.cajero.username)
        respuesta = self.client.post(
            self.categorias_url, {"nombre": "No permitida"},
            format="json", HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(respuesta.status_code, 403)

    def test_administrador_puede_crear_categoria(self):
        token = self.iniciar_sesion(self.admin.username)
        respuesta = self.client.post(
            self.categorias_url, {"id": "cat-auth", "nombre": "Cuadernos"},
            format="json", HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.json(), {"id": "cat-auth", "nombre": "Cuadernos"})

    def test_usuario_inactivo_no_puede_iniciar_sesion(self):
        self.admin.is_active = False
        self.admin.save(update_fields=["is_active"])
        token = self.obtener_csrf()
        respuesta = self.client.post(
            self.login_url, {"username": self.admin.username, "password": self.clave},
            format="json", HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(respuesta.status_code, 403)

    def test_login_invalida_token_csrf_anterior(self):
        token_anterior = self.obtener_csrf()
        respuesta = self.client.post(
            self.login_url, {"username": self.admin.username, "password": self.clave},
            format="json", HTTP_X_CSRFTOKEN=token_anterior,
        )
        self.assertEqual(respuesta.status_code, 200)
        token_nuevo = respuesta.json()["csrfToken"]
        self.assertEqual(self.client.post(
            self.logout_url, HTTP_X_CSRFTOKEN=token_anterior,
        ).status_code, 403)
        self.assertEqual(self.client.post(
            self.logout_url, HTTP_X_CSRFTOKEN=token_nuevo,
        ).status_code, 200)

    def test_logout_exige_post_y_csrf_y_conserva_venta_abierta(self):
        venta = Venta.objects.create(usuario=self.admin)
        token = self.iniciar_sesion(self.admin.username)
        self.assertEqual(self.client.get(self.logout_url).status_code, 405)
        self.assertEqual(self.client.post(self.logout_url).status_code, 403)
        self.assertEqual(self.client.get(self.sesion_url).status_code, 200)
        self.assertEqual(self.client.post(
            self.logout_url, HTTP_X_CSRFTOKEN=token,
        ).status_code, 200)
        self.assertEqual(self.client.get(self.sesion_url).status_code, 403)
        self.assertEqual(self.client.get(self.categorias_url).status_code, 403)
        self.assertTrue(Venta.objects.filter(pk=venta.pk, estado="abierta").exists())
