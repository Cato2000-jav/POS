"""Identificación pública del equipo solicitada por la guía de despliegue."""
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def authors(request):
    """Recibe una petición GET y devuelve los integrantes en formato JSON."""
    return JsonResponse([
        {"nombre": "Alicia", "codigo": "368580"},
        {"nombre": "Santiago Rengifo", "codigo": "387002"},
        {"nombre": "Gabriel Romero", "codigo": "324277"},
    ], safe=False)
