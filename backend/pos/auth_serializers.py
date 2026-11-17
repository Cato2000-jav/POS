"""Validación de las credenciales para iniciar sesión en el POS."""

from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed


class LoginSerializer(serializers.Serializer):
    """Comprueba credenciales sin crear usuarios ni abrir una sesión."""

    username = serializers.CharField(max_length=150, write_only=True)
    # Los espacios pueden formar parte de la contraseña y deben conservarse.
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, datos):
        """Devuelve el usuario autenticado o un error genérico de credenciales."""
        usuario = authenticate(
            request=self.context.get("request"),
            username=datos["username"],
            password=datos["password"],
        )
        if usuario is None or not usuario.is_active:
            raise AuthenticationFailed("Usuario o contraseña incorrectos.")

        # La vista recibirá el usuario, sin conservar la contraseña en estos datos.
        return {"usuario": usuario}
