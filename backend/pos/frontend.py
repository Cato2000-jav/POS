"""Sirve únicamente los recursos públicos del frontend, desde el mismo origen."""
from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404

RAIZ = settings.BASE_DIR.parent / 'facturacion'


def pagina(request, ruta='index.html'):
    archivo = (RAIZ / ruta).resolve()
    if not archivo.is_relative_to(RAIZ.resolve()) or archivo.suffix.lower() not in {'.html', '.js', '.css', '.png', '.jpg', '.svg', '.ico'}:
        raise Http404
    if any(parte in {'tests', 'respaldos', 'google-apps-script'} for parte in Path(ruta).parts) or not archivo.is_file():
        raise Http404
    respuesta = FileResponse(archivo.open('rb'))
    respuesta['Cache-Control'] = 'no-cache'
    return respuesta
