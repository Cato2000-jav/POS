# Cambios y guía para sustentar el MVP 3

Se conservó el frontend vanilla y sus IDs. Los cambios reemplazan el transporte
Google Sheets y agregan las operaciones del MVP 3 sobre el backend Django.
No se importaron registros reales, no se publicaron servicios y no se hicieron
commits en nombre de integrantes del equipo.

## Backend

| Archivo | Qué cambió y por qué | Recibe → devuelve | Conexión |
|---|---|---|---|
| `backend/pos/models.py` | Modelos relacionales, restricciones y copia histórica del inventario aplicado. Se agregaron una fila de coordinación y recibos de reintentos. | Campos de negocio → registros persistidos | ORM, migraciones y servicios |
| `backend/pos/migrations/0001_initial.py` | Crea las tablas originales del backend. | Esquema anterior → tablas | `manage.py migrate` |
| `backend/pos/migrations/0002_controlinventario_operacion.py` | Crea las tablas de coordinación y recibos. | Esquema → tablas nuevas | Operaciones transaccionales |
| `backend/pos/migrations/0003_control_inicial.py` | Inicializa la fila única de coordinación. | Base migrada → fila 1 | Bloqueo entre operaciones |
| `backend/pos/migrations/0004_detalleventa_inventarioaplicado.py` | Guarda si el detalle descontó inventario. | Detalle → evidencia del movimiento | Correcciones y retornos |
| `backend/pos/serializers.py` | Valida categorías, productos, clientes, proveedores y descuentos. La edición desde venta admite solo cuatro campos. | Diccionario → datos válidos o errores | Vistas CRUD y modelos |
| `backend/pos/views.py` | CRUD, roles, transacciones y eliminación protegida. La lectura de categorías permite llenar el selector del cajero. | Petición HTTP → JSON/estado HTTP | Serializadores y permisos |
| `backend/pos/services.py` | Guarda abiertas, cierra, compra, corrige y reembolsa de forma atómica. Recalcula importes en el servidor. | Datos + usuario + clave de reintento → resultado confirmado | Modelos y `operations_views.py` |
| `backend/pos/operations_views.py` | Controladores REST, faltantes, selector de proveedores y reportes. | JSON/query params → JSON | Rutas, permisos y servicios |
| `backend/pos/urls.py` | Registra rutas por recurso y operaciones sobre ventas. | URL/método → vista | Prefijo `/api/` |
| `backend/pos/frontend.py` | Entrega solo HTML/JS/CSS e imágenes permitidas desde la carpeta pública. Bloquea recorridos fuera de esa carpeta. | Ruta → archivo público o 404 | Mismo origen para cookies y CSRF |
| `backend/config/urls.py` | Une API y frontend en un servidor. | URL → API o página | Sesión del mismo origen |
| `backend/config/settings.py` | SQLite local con IMMEDIATE, PostgreSQL por entorno y opciones HTTPS. | Variables de entorno → configuración | No incluye secretos |
| `backend/pos/management/commands/inicializar.py` | Crea roles y usuarios; `--demo` agrega catálogo ficticio. No sobrescribe usuarios existentes. | Opciones/variables → usuarios y datos iniciales | Instalación local o producción |
| `backend/pos/management/commands/importar_snapshot.py` | Valida/importa respaldo en base vacía sin repetir stock. Por defecto revierte. | JSON de seis recursos → validación o importación atómica | Migración del MVP 2 |
| `backend/iniciar_local.py` | Facilita arranque local: clave persistente, migraciones, demo y servidor. | Entorno local → servidor | No se usa para producción |
| `backend/requirements.txt` | Añade Gunicorn y psycopg a Django/DRF. | Instalación pip → dependencias | PostgreSQL y WSGI |
| `backend/Procfile`, `backend/.env.example` | Describen arranque y variables para el alojamiento. | Configuración del proveedor → aplicación | Publicación pendiente |
| `.gitignore` | Excluye claves, bases, dependencias y empaquetados. | Rutas → exclusiones de Git | Protege archivos locales |

Los archivos `__init__.py` en `management/` y `management/commands/` identifican
paquetes de Python para que Django encuentre los comandos.

### Reglas y funciones relevantes

- `operacion_unica`: recibe una función de negocio y la envuelve con una
  transacción. Compara la huella del cuerpo y el usuario del reintento; devuelve
  el recibo anterior solo si coincide. No guarda las líneas principales como JSON:
  estas siguen en tablas relacionales.
- `preparar_venta`: recibe venta, productos e items; valida cliente/pago/descuento
  y actualiza los importes de la venta. `guardar_detalles` copia nombres/precios.
- `mover_stock`: recibe productos y cantidades positivas/negativas; rechaza stock
  negativo nombrando el producto. Las excepciones revierten toda la operación.
- `registrar_reembolso`: distribuye el total neto por líneas y por cantidades
  acumuladas. El redondeo acumulado evita devolver pesos de más o perderlos en
  varios reembolsos. Registra usuario, fecha y retorno por artículo.
- `normalizar_nombre`: minúsculas, sin tildes y plurales simples; no pretende ser
  un analizador lingüístico completo.

Preguntas posibles del profesor:

1. **¿Por qué recalcular en el servidor?** Porque el navegador puede manipularse;
   un total enviado por el usuario no es una prueba de lo que debe cobrarse.
2. **¿Qué evita un doble descuento de stock?** La clave de operación, su recibo y
   la transacción; el botón deshabilitado mejora la interfaz, pero no es suficiente.
3. **¿Qué pasa si falla el segundo producto?** Se revierte también el movimiento
   del primero y la venta conserva su estado anterior.
4. **¿Por qué guardar el movimiento histórico?** Si cambia el seguimiento del
   producto, un retorno debe respetar la operación original, no inventar stock.
5. **¿Por qué una venta tiene un detalle separado?** Cada producto y cantidad es
   una fila relacionada, consultable y validable por la base de datos.
6. **¿Por qué se bloquean correcciones después de reembolsar?** Para no invalidar
   líneas que ya respaldan devoluciones registradas; es una restricción explícita.

## Frontend

| Archivo | Qué cambió y cómo | Recibe → devuelve/conexión |
|---|---|---|
| `facturacion/api.js` | Transporte REST central con sesión, CSRF, timeout y claves estables. Se eliminó la URL activa de Apps Script. | Recurso/acción/datos → respuesta o error |
| `facturacion/login.html`, `login.js` | Formulario accesible, validación de sesión y botón bloqueado durante envío. | Usuario/contraseña → sesión; no guarda contraseña |
| `facturacion/session-ui.js` | Navegación, logout, controles por rol, descuentos y marca histórica. | Usuario/catálogos → controles y texto |
| `facturacion/gestion.html`, `gestion.js` | Formularios para descuentos, inventario, faltantes, correcciones, reembolsos y reportes. | Entrada del usuario → API; respuesta → DOM con texto seguro |
| `facturacion/mvp3.css` | Estilo violeta existente, formularios, navegación, tablas y ajustes móviles. | Clases → presentación responsive |
| `facturacion/app.js` | Resolvió 25 bloques de conflicto Git conservando la rama con escape HTML, IDs de texto y cálculo de cambio. Redondea IVA, aplica descuento visual y conserva usuario de sesión. | Carrito/catálogo → totales y factura |
| `facturacion/open-sales.js` | Envía descuento, valida redondeo y permite que el servidor asigne responsable. Retoma el descuento seleccionado. | Formulario → venta abierta confirmada |
| `facturacion/close-sales.js` | Incluye descuento en la firma del formulario e invalida esa firma tras rechazo. | Borrador persistido → cierre/reintento |
| `facturacion/product-form.js` | Bloquea código en edición desde venta; la API restringida guarda solo nombre, categoría, precio y costo. | Formulario → catálogo y carrito actualizados |
| `facturacion/index.html` | Elimina Tarjeta débito para nuevas ventas; agrega recursos compartidos. | HTML → flujo original de facturación |
| `facturacion/compras.html`, `Historial_de_ventas.html` | Incorporan sesión/navegación y estilos; `defer` respeta el orden de scripts. | HTML → módulos existentes |
| `facturacion/Historial_de_ventas.js` | Muestra corrección, responsable, fecha, descuento y estado de reembolso en historial/factura. | Venta histórica → presentación/impresión |
| `facturacion/products.js`, `customers.js`, `suppliers.js`, `purchases.js`, `remote-history.js` | Ajusta mensajes de origen: ahora es el servidor. Se conservaron sus flujos. | API → estados/listados existentes |

Los archivos antiguos de Apps Script y migración del navegador se conservan
como referencia académica; el transporte activo no los utiliza. La opción de
archivo local queda fuera de las fuentes operativas del historial.

Preguntas posibles:

- **¿Por qué ocultar botones no es seguridad?** El backend debe rechazar la
  petición aunque alguien la envíe manualmente.
- **¿Dónde vive el estado real?** En la base. El carrito y los borradores de
  solicitudes pendientes son estado de interfaz, no un historial alterno.
- **¿Por qué la API y el HTML comparten origen?** Para usar cookies y CSRF sin
  añadir una configuración CORS innecesaria.
- **¿Qué devuelve async/await?** Permite esperar la promesa de la petición y
  manejar su resultado/error antes de habilitar nuevamente los controles.

## Pruebas y límites

- Pruebas de modelos, autenticación, productos y contactos ya existentes.
- `backend/pos/test_operaciones.py`: inventario, descuento, corrección, reembolsos,
  reintentos, rollback, versiones y permisos.
- `facturacion/tests/api-timeout.test.cjs`: actualizado al contrato REST; verifica
  CSRF, timeout incierto, claves estables y rechazos definitivos.
- `facturacion/tests/open-sales.test.cjs`: usa el redondeo de IVA del nuevo contrato.
- `facturacion/tests/purchases.test.cjs`: actualiza el texto del origen de datos.
- Prueba en Chromium contra base SQLite temporal: login, descuento, venta Debe,
  guardar/retomar/cerrar, corrección, reembolso, faltante/resolver, reporte, compra,
  historial y permisos del cajero. Se revisó también ancho móvil de 390 píxeles.

No se ha publicado el sitio ni probado contra una PostgreSQL real. Tampoco se
ha migrado el respaldo real del usuario. Los históricos incompletos deben
revisarse; el importador los rechaza en lugar de rellenarlos con datos inventados.
