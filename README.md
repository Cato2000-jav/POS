# Papel y Luna · POS MVP 3

POS universitario con frontend HTML/CSS/JavaScript vanilla y API REST Django.
Los datos operativos se almacenan en la base del backend. Google Sheets ya no
es la fuente de datos de las pantallas activas.

## Ejecutar en tu computador

Requiere Python 3.12 o 3.13. Desde la carpeta del proyecto:

```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python iniciar_local.py
```

Abre **http://127.0.0.1:8000/login.html**. No abras los HTML con `file://` ni
con Live Server: la sesión y las peticiones REST necesitan el servidor Django.
El programa de arranque crea una clave privada local persistente, aplica
migraciones y prepara los usuarios y un catálogo ficticio sin sobrescribir
registros existentes. Detén el servidor con Control+C.

### Usuarios de demostración local

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | LunaDemo-Admin-2026! | Administrador |
| cajero | LunaDemo-Cajero-2026! | Cajero |

Estas credenciales son para pruebas académicas locales. Para un despliegue,
crea los usuarios con contraseñas propias mediante las variables indicadas en
`backend/.env.example` y `python manage.py inicializar` **sin `--demo`**.
El inicializador no cambia contraseñas de usuarios existentes; para cambiarlas
usa `python manage.py changepassword admin` y el equivalente para cajero.

## Funcionalidades

- Login, sesión persistente y cierre de sesión; permisos comprobados en el servidor.
- CRUD de productos, categorías, proveedores, clientes y descuentos.
- Venta abierta, consulta, retoma y cierre; pago Efectivo, Nequi o Debe.
- Cliente obligatorio para Debe; cálculo de recibido y cambio para efectivo.
- Inventario transaccional, compras y actualización del último costo.
- Edición de nombre, categoría, precio y costo desde ventas, sin editar stock allí.
- Historial, filtros, factura e impresión/Guardar como PDF.
- Correcciones con el mismo ID, responsable, fecha y ajuste de stock por diferencia.
- Reembolsos parciales/totales proporcionales al importe final, con retorno opcional.
- Faltantes y filtros; marcado como resuelto y agrupación de nombres normalizados.
- Reportes de ventas, productos vendidos, compras y faltantes por rango de fechas.

Las pantallas originales permanecen en `facturacion/`. Los módulos nuevos están
bajo **Gestión MVP 3**. Inventario y compras son administrativos; el cajero puede
registrar faltantes, gestionar clientes y vender.

## Decisiones de negocio

- Precios y costos en pesos enteros; IVA del 19 % heredado del proyecto, redondeado
  al peso. Esto describe el cálculo académico, no una implementación tributaria.
- Un descuento por venta, aplicado al total con IVA y limitado para no bajar de cero.
- Una corrección utiliza los precios actuales del catálogo, que se muestran antes
  de confirmar. Las ventas cerradas no cambian por editar el catálogo.
- No se corrigen ventas que ya tienen reembolsos. Evita invalidar cantidades e
  importes ya devueltos; el sistema informa esta restricción.
- Una venta histórica sin evidencia del movimiento de stock no permite corrección
  ni retorno de stock automático. Se puede consultar sin inventar información.
- No se eliminan ventas ni compras mediante la API.
- Los reportes muestran ventas brutas y reembolsos por su fecha de operación.
  El neto del período puede ser negativo si se reembolsan ventas de días anteriores.
  El ranking de productos usa cantidades vendidas antes de reembolsos.
- `localStorage` conserva únicamente borradores de solicitudes inciertas. Los
  registros operativos siempre se consultan en la API.

## Organización y explicación

- `backend/pos/models.py`: tablas y restricciones.
- `backend/pos/serializers.py`: validación del catálogo y los contactos.
- `backend/pos/views.py`: CRUD y permisos.
- `backend/pos/services.py`: reglas transaccionales de ventas, compras y reembolsos.
- `backend/pos/operations_views.py`: endpoints de operaciones, faltantes y reportes.
- `backend/pos/urls.py`: rutas REST bajo `/api/`.
- `facturacion/api.js`: transporte central, CSRF, sesión, errores y reintentos.
- `facturacion/session-ui.js`: navegación, rol y selección de descuento.
- `facturacion/gestion.js`: formularios de los módulos nuevos.

Consulta **CAMBIOS_MVP3.md** para la explicación de los cambios, entradas,
salidas, conexiones y preguntas de sustentación por módulo.

## Pruebas

Con el entorno virtual activado y `DJANGO_SECRET_KEY` configurada:

```bash
python manage.py test pos
python manage.py check
python manage.py makemigrations --check --dry-run
```

Desde la raíz, con Node.js instalado:

```bash
node --test facturacion/tests/*.test.cjs
```

Los tests `*-service.test.cjs` del MVP 2 verifican el servicio anterior como
referencia histórica; el backend actual se verifica con las pruebas de Django.
Las pruebas Django crean una base de prueba independiente.

## Migrar datos revisados del MVP 2

No se importaron ni se borraron datos reales durante el desarrollo. El comando
`importar_snapshot` recibe un JSON con seis listas: `categorias`, `proveedores`,
`clientes`, `productos`, `ventas` y `compras`. Las líneas históricas deben tener
nombre, cantidad, precio/costo y subtotal coherentes. `itemsJson` puede ser un
arreglo o un texto JSON; en la base se convierte en filas de detalle.

Utiliza una base de negocio vacía, sin el catálogo `--demo`:

```bash
python manage.py importar_snapshot /ruta/respaldo.json
python manage.py importar_snapshot /ruta/respaldo.json --aplicar
```

El primer comando valida y revierte todo. El segundo importa en una transacción.
Conserva IDs, stock y costo; **no repite cierres ni compras**. Si falta un nombre
histórico o hay totales inconsistentes, rechaza el respaldo completo y explica
el problema. Guarda una copia del respaldo original antes de revisarlo.

## Publicación pendiente

Todavía no hay URL pública: faltan contratar/configurar un alojamiento y una base
PostgreSQL. No se han creado cuentas ni servicios de pago.

El proyecto incluye configuración para PostgreSQL y Gunicorn. Publica backend y
frontend desde el mismo origen: Django entrega los recursos de `facturacion/`
y la API bajo `/api/`. El alojamiento debe incluir **ambas carpetas**.

1. Instalar `backend/requirements.txt` y configurar variables del ejemplo en el
   panel del alojamiento (no subir `.env` ni contraseñas al repositorio).
2. Establecer una `DJANGO_SECRET_KEY` estable, `DJANGO_DEBUG=false`, el dominio
   en `DJANGO_ALLOWED_HOSTS` y su URL HTTPS en `CSRF_TRUSTED_ORIGINS`.
3. Configurar PostgreSQL: nombre, host, usuario, contraseña, puerto y SSL.
4. Configurar HTTPS y `HTTPS_ONLY=true`. Usar `TRUST_PROXY=true` solo cuando el
   alojamiento controle y reescriba `X-Forwarded-Proto`.
5. Ejecutar desde `backend`: `python manage.py migrate`,
   `python manage.py inicializar` y `python manage.py collectstatic --noinput`.
6. Arrancar `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2`.
7. Probar login, venta/compra simultáneas y stock contra la PostgreSQL publicada.
   Esa concurrencia en PostgreSQL no se ha validado en el entorno local.

El panel `/admin/` es opcional; los usuarios del POS no son superusuarios.
El frontend utiliza `fetch`, cookies de sesión y CSRF del mismo origen: no necesita
CORS ni tokens guardados en el navegador.

## Entrega académica

Conserva este mismo repositorio y registra los cambios de cada integrante.
No se crearon commits en nombre de los integrantes.
Para el ZIP excluye `.git`, `.venv`, claves, bases locales, cachés y dependencias.
El nombre debe seguir `web-2026-2-mvp3-apellidoA-apellidoB-apellidoC.zip`,
reemplazando los apellidos por los del equipo. Las URLs públicas se agregan una
vez completado el despliegue.

### Prueba de navegador opcional

`facturacion/tests/e2e-mvp3.cjs` usa Playwright y solo admite localhost.
Ejecutarla únicamente sobre una base de demostración aislada; crea operaciones
ficticias. Requiere los usuarios y el producto `demo-cuaderno` del inicializador.
`POS_TEST_URL` permite indicar el servidor local (por defecto puerto 8013).
`PLAYWRIGHT_MODULE` permite indicar la ruta de la instalación de Playwright.
No es una dependencia de la aplicación en producción.
