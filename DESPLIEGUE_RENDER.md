# Despliegue del POS en Render

Estado: configuración preparada; todavía no publicado. No hay una URL pública confirmada.

## Qué se cambió y cómo funciona

- `backend/requirements.txt`: agrega dj-database-url (convierte la dirección de PostgreSQL en configuración Django) y WhiteNoise (sirve estáticos). Se conserva psycopg 3; no hace falta instalar otro controlador.
- `backend/config/settings.py`: recibe DATABASE_URL y el dominio desde variables de Render. Mantiene SQLite para desarrollo local y la configuración POSTGRES anterior. En Render exige PostgreSQL y DEBUG desactivado. WhiteNoise usa STORAGES, compatible con Django 5.2.
- `backend/pos/authors.py`: recibe GET sin sesión y devuelve una lista JSON de integrantes. No consulta ni modifica datos del POS. Alicia figura sin apellido porque aún no se proporcionó.
- `backend/config/urls.py`: conecta /authors antes de la ruta general del frontend.
- `backend/build.sh`: instala dependencias, recopila estáticos, aplica migraciones y crea usuarios iniciales. Si falla un paso, termina con error. No importa datos locales ni carga productos de demostración.
- `render.yaml`: declara PostgreSQL y el servidor web. Render genera la clave Django y conecta la base. Gunicorn ejecuta config.wsgi. La raíz del servicio es la del repositorio, para conservar acceso a facturacion.
- `backend/pos/test_despliegue.py`: comprueba que /authors funciona sin sesión y no acepta POST.

Para sustentación: ¿por qué no usar runserver en producción? Gunicorn es el servidor WSGI de producción. ¿Por qué variables de entorno? Separan credenciales del código. ¿Qué hace migrate? Crea o actualiza las tablas; no copia la base SQLite local. ¿Qué devuelve /authors? JSON público de identificación, sin abrir el acceso a la API privada.

## Pasos de publicación

1. Crear una cuenta en https://dashboard.render.com y conectar GitHub. Autorizar el repositorio `Cato2000-jav/POS`.
2. Subir los cambios del proyecto a GitHub, revisando antes lo incluido. No subir `.env`, `.secret-local`, `.venv`, SQLite ni copias con datos privados. La versión del backend aún debe quedar incluida en el repositorio remoto.
3. En Render, elegir **New > Blueprint**, seleccionar el repositorio y la rama con estos cambios. Render leerá `render.yaml`.
4. Introducir dos contraseñas nuevas y diferentes en `POS_ADMIN_PASSWORD` y `POS_CAJERO_PASSWORD`. No utilizar las contraseñas demo. Guardarlas en un lugar privado; no escribirlas en el documento de entrega.
5. Revisar que ambos recursos usen el plan Free antes de crear el Blueprint. Esperar a que termine el despliegue.
6. Abrir la URL asignada por Render con `/authors`. Deben aparecer los tres integrantes sin iniciar sesión.
7. Abrir `/login.html` en el mismo dominio. Entrar con `admin` y la contraseña definida en Render. Probar catálogo, sesión y una operación controlada; comprobar que persiste tras reiniciar el servicio.
8. Guardar la URL real y capturas para el PDF de entrega. No usar localhost como evidencia de publicación.

No agregar un Root Directory `backend`: el frontend se encuentra en una carpeta hermana. La configuración del Blueprint ya usa las rutas necesarias.

El comando `inicializar` conserva contraseñas de usuarios existentes: editar estas variables después no cambia automáticamente la contraseña de una cuenta ya creada.

## Qué falta para la entrega

- Cuenta de Render conectada y cambios subidos a GitHub.
- Despliegue real y pruebas sobre PostgreSQL/HTTPS.
- Apellido de Alicia para la portada y /authors.
- URL pública y capturas reales para completar el PDF solicitado por la guía.
- Confirmar la visibilidad requerida del repositorio antes de entregar su enlace.

La base PostgreSQL gratuita de Render vence a los 30 días. El servidor web gratuito se suspende por inactividad. Es apropiado para esta demostración académica; planificar la fecha de entrega y la conservación de datos.

Referencias oficiales: https://render.com/docs/deploy-django , https://render.com/docs/free , https://whitenoise.readthedocs.io/en/stable/django.html
