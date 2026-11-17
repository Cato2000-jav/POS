"""Inicio, consulta y cierre de sesión mediante las sesiones de Django."""

from django.contrib.auth import login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_serializers import LoginSerializer


def datos_usuario(usuario):
    """Devuelve solo los datos de identidad que necesita la interfaz."""
    if usuario.is_superuser or usuario.groups.filter(name="Administrador").exists():
        rol = "Administrador"
    elif usuario.groups.filter(name="Cajero").exists():
        rol = "Cajero"
    else:
        rol = None
    return {"id": usuario.pk, "username": usuario.get_username(), "rol": rol}


@method_decorator(never_cache, name="dispatch")
class CsrfVista(APIView):
    """Entrega el token para proteger las peticiones que modifican datos."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(never_cache, name="dispatch")
@method_decorator(csrf_protect, name="dispatch")
class LoginVista(APIView):
    """Verifica credenciales y crea la sesión sin devolver contraseñas."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data["usuario"]
        login(request, usuario)
        # Django rota el token CSRF al iniciar sesión; entregar el nuevo valor.
        return Response({
            "usuario": datos_usuario(usuario),
            "csrfToken": get_token(request),
        })


@method_decorator(never_cache, name="dispatch")
class SesionVista(APIView):
    """Permite recuperar la identidad del usuario después de recargar la página."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"usuario": datos_usuario(request.user)})


@method_decorator(never_cache, name="dispatch")
class LogoutVista(APIView):
    """Invalida la sesión actual sin modificar ventas ni borradores del POS."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # SessionAuthentication exige CSRF para este POST autenticado.
        logout(request)
        return Response({"detail": "Sesión cerrada."})
