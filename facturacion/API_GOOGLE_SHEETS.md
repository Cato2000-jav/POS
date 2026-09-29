# Contrato del servicio de Google Sheets

## Estado
api.js está configurado con la URL /exec proporcionada por el usuario.
index.html carga api.js y categories.js. El panel Categorías consulta el servicio
para listar, buscar, crear, editar y eliminar. Los demás módulos siguen pendientes.
Se verificaron consultas GET reales; las escrituras solo se prueban con simulaciones.
No se ha migrado el historial local ni publicado código en Apps Script.
El usuario confirmó posteriormente que publicó una nueva versión con Code.gs.
Las escrituras de la interfaz se verificaron con respuestas simuladas; no se crearon
ni eliminaron categorías reales durante las pruebas.
Se preparó google-apps-script/para-publicar/Code.gs con todas las correcciones y
los auxiliares originales, sin definiciones duplicadas. LEEME.md en esa carpeta
explica cómo actualizar la versión de la implementación conservando la URL.
El editor compartido redirigió a la página pública en el navegador disponible;
no se accedió ni se cambió el código remoto desde Codex. La publicación fue confirmada
por el usuario desde su navegador.

## Contrato confirmado
- GET: ?resource=productos (también ventas, compras, categorias, proveedores, clientes).
- POST: el mismo parámetro resource en la URL y cuerpo JSON con action y data.
- El módulo conserva sus nombres listar/guardar y traduce crear, actualizar y eliminar
  a create, update y delete.
- Content-Type: text/plain;charset=UTF-8; Apps Script interpreta e.postData.contents.
- Respuesta correcta: {"success":true,"data":[]} para listados.
- Error: {"success":false,"message":"Descripción del error"}.
- No usar mode: "no-cors": necesitamos leer la respuesta.
- No existe acción cerrar ni solicitudId en los controladores recibidos.
  Se retiraron esas suposiciones del módulo; no hay protección de duplicados en servidor
  demostrada. LockService serializa escrituras, pero no deduplica solicitudes.

Ejemplo de cuerpo POST, solo ilustrativo:

```json
{"action":"create","data":{"nombre":"Papel"}}
```

## Controladores recibidos
El archivo completo confirma que doGet y doPost ya están separados correctamente.
El anidamiento aparente provenía del fragmento inicial. Controladores.gs es una
copia opcional con validación adicional de data, no una corrección necesaria de llaves.
Los auxiliares completos ya se revisaron: actualizarRegistro y eliminarRegistro
eran TODO. crearRegistro exige IDs del frontend y serializa objetos como JSON;
la lectura original devuelve esos campos como texto. El usuario proporcionó los encabezados.

## Actualización parcial preparada localmente
google-apps-script/ActualizarRegistro.gs sustituye únicamente el TODO de esa función.
No agregar una segunda definición en Apps Script. No se ha publicado el cambio.
Permite actualizar productos, categorias, proveedores y clientes por id; rechaza
campos sin columna y encabezados inválidos. Conserva campos omitidos, el id y las
fórmulas de celdas no editadas; null vacía una celda. Devuelve los valores guardados,
con JSON todavía en texto. Reutiliza el bloqueo de doPost.
No habilita actualización genérica de ventas ni compras: sus reglas siguen pendientes.
Las validaciones por campo y las relaciones se incorporarán al confirmar el esquema.

## Creación corregida localmente
google-apps-script/CrearRegistro.gs reemplaza solo crearRegistro; no está publicado.
Requiere también leerDetalleJson, incluida en LeerHoja.gs.
Conserva los IDs del frontend y la serialización JSON de objetos y arreglos.
Valida objeto e ID, encabezados únicos con id, campos desconocidos, duplicados,
números no finitos y textos que iniciarían fórmulas. Prepara toda la fila antes
de escribir. Campos omitidos o null se guardan vacíos; 0 y false se conservan.
Devuelve los valores leídos después de guardar, no el objeto recibido sin verificar.
Para ventas.itemsJson y compras.itemsJson valida el JSON antes de cambiar valores o formatos
y devuelve una lista de objetos, igual que GET. Acepta detalle como lista o texto JSON.
Una celda vacía conserva la compatibilidad anterior y devuelve []; esto no autoriza
cerrar una venta vacía: la validación de cierre sigue pendiente.
Un segundo create con el mismo ID se rechaza; esto no evita duplicados con otro ID.
Si la escritura termina y falla la lectura de confirmación, puede haber un registro
guardado sin respuesta exitosa. No reintentar con un nuevo ID sin comprobar el estado.
No añade reglas de stock ni cierre de ventas. Conserva el alcance genérico del create
existente; las pantallas de ventas/compras deben seguir sin conectarse hasta implementar
sus reglas. También faltan campos obligatorios y validación de relaciones por entidad.

## Eliminación preparada localmente
google-apps-script/EliminarRegistro.gs sustituye el TODO de eliminarRegistro y añade
comprobarSinAsociaciones. No se ha publicado ni ejecutado contra registros reales.
Usa las relaciones definidas en el MVP 2: productos.categoriaId,
compras.proveedorId y ventas.clienteId. Si la columna falta o está repetida, rechaza
la eliminación, incluso cuando la hoja dependiente no contiene registros.
Clientes asociados a cualquier venta, abierta o cerrada, quedan protegidos.
La comprobación y deleteRow se ejecutan dentro del bloqueo existente de doPost.
Permite eliminar productos, categorias, proveedores y clientes; ventas y compras
continúan bloqueadas. Una segunda eliminación del mismo ID devuelve un error y
no elimina otra fila. No actualiza inventario ni implementa reembolsos.
Los encabezados compartidos confirman las tres columnas de relación. Pendiente probar el despliegue.

## Lectura de detalles preparada localmente
google-apps-script/LeerHoja.gs reemplaza leerHoja y añade leerDetalleJson.
Convierte ventas.itemsJson y compras.itemsJson a listas de objetos. Conserva
leerProductosVenta como auxiliar compatible con ventas.productos si esa columna existe.
No interpreta automáticamente otros textos como JSON.
Una celda vacía representa el detalle ausente de una venta antigua y se devuelve [];
una columna de detalle ausente se conserva ausente por compatibilidad; los flujos de
cierre y compra deberán exigir sus campos al implementarse.
JSON mal formado, null, objetos en lugar de listas y elementos que no son objetos
provocan una respuesta de error con fila y columna. No se ocultan como listas vacías.
La lectura completa falla ante un detalle corrupto: no se devuelve un historial parcial.
La función conserva el orden, las filas vacías omitidas y las fechas ISO; valida encabezados.
No modifica hojas. No se ha publicado. CrearRegistro.gs reutiliza leerDetalleJson
para devolver itemsJson como lista y rechazar JSON inválido antes de escribir.
Los demás campos JSON siguen como texto.
La validación de cantidades, precios y totales dentro de cada detalle queda pendiente.

## Pendiente antes de conectar ventas e inventario
- El usuario confirmó la corrección de categorias; GET respondió lista vacía.
  Confirmar los tipos reales de IDs, números y booleanos.
- Conservar precio como precio de venta; adaptar el frontend a itemsJson y valorRecibido.
- Resolver persistencia de trabajador, IVA e imágenes/descripciones que usaba el MVP 1.
- Verificar las restricciones de eliminación preparadas contra los encabezados reales.
  Validar relaciones también al crear/actualizar; acordar el borrado de ventas del MVP 1.
- Implementar ventas abiertas sin movimiento de stock; cierre con cliente para Debe,
  validación de existencias y conservación de precios históricos.
- Confirmar compra y stock/último costo de forma coordinada. Solo modificar stock
  para productos con seguimiento. Devolver registro y productos actualizados.
- Gestionar fallos parciales y duplicados en el servicio. Un bloqueo no vuelve
  transaccionales varias escrituras de Sheets ni revierte cambios anteriores.
- No reintentar POST automáticamente: una respuesta perdida no demuestra que no
  se haya guardado. Verificar el estado antes de repetir.
- En cada formulario, bloquear doble envío, deshabilitar botón, mostrar carga y usar
  try/catch/finally. Aplicar cambios locales solo tras confirmación.
- No usar localStorage ni productos hardcodeados como respaldo silencioso al activar
  la migración. La importación de registros existentes será una etapa separada.

Referencia: https://developers.google.com/apps-script/guides/web

## Encabezados proporcionados por el usuario
- productos: id, codigo, nombre, categoriaId, precio, costo, seguimientoInventario, stock.
- ventas: id, fecha, estado, clienteId, metodoPago, subtotal, total, valorRecibido,
  cambio, itemsJson, actualizadoEn.
- compras: id, fecha, proveedorId, total, itemsJson.
- proveedores y clientes: id, nombre, telefono, correo.
- categorias: id, nombre. El usuario confirmó que corrigió la fila de encabezados.
  La consulta posterior devolvió data: []; no se crearon ni borraron registros desde Codex.

## Panel de categorías conectado
categories.js mantiene solo una copia en memoria de los resultados de GET.
El botón Categorías abre/cierra un panel independiente; al abrir consulta nuevamente.
Actualizar lista permite reintentar una carga fallida. La búsqueda filtra por nombre.
Durante la carga, bandera y controles deshabilitados evitan peticiones simultáneas.
try/catch/finally restaura controles; fallos no se presentan como una lista vacía válida.
Se verificó GET real desde navegador, estado vacío y tamaños 375/768/1280 sin
desbordamiento horizontal en la vista con el panel de categorías y catálogo.
Búsqueda, errores y doble carga se probaron con datos simulados. El formulario permite
crear/editar y cada fila ofrece editar/eliminar con confirmación. Las escrituras usan
api.guardar; no hay actualizaciones optimistas. Fallos conservan formulario y lista.
El ID de creación se conserva ante un fallo para no generar otro ID al reintentar.
Actualizar lista permite comprobar el estado cuando se pierde una respuesta.
La restricción por productos asociados depende del servicio publicado.
Pruebas locales repetibles: node facturacion/tests/categories.test.cjs.

No renombrar precio a precioVenta en la hoja: es el precio de venta del sistema.
itemsJson es texto JSON en la celda y lista en la respuesta del servicio corregido.
El frontend del MVP 1 usa productos y dineroRecibido: requiere adaptación explícita
a itemsJson y valorRecibido antes de migrar. No enviar campos desconocidos.
Ventas no tiene persona, hora ni iva; hay que preservar esos datos del MVP 1 durante
la migración (no confundir clienteId con trabajador ni descartar datos históricos).
Productos no tiene imagen ni descripcion: los archivos originales y las imágenes se
conservan, pero no se asignan automáticamente a los IDs remotos. Las tarjetas remotas
muestran un indicador sin imagen. No se modificaron encabezados ni datos en Sheets.

## Carga del catálogo
products.js consulta productos y categorias mediante api.listar y valida la respuesta
antes de sustituir la copia en memoria. index.html ya no carga el catálogo de ejemplo
productos.js; ese archivo se conserva como referencia para una futura migración explícita.
Los IDs se usan como texto en el catálogo y el carrito. TRUE/FALSE se convierten sin
tratar la cadena FALSE como verdadera. Una recarga fallida conserva la última lista y
muestra el error; una hoja vacía no activa datos de ejemplo. No se permite recargar
con artículos en la venta para evitar que cambien sus precios silenciosamente.
Pruebas: node facturacion/tests/products.test.cjs.
Ventas e inventario todavía no están migrados. Esta carga no implica que el cierre
de ventas actual actualice Sheets.

## Creación y edición de productos
product-form.js agrega un formulario al catálogo sin reemplazar su estructura.
abrirProducto recibe un ID para editar o null para crear; consulta categorías al abrir
y llena un select mediante textContent. No permite escribir una categoría libre.
guardarProductoFormulario recibe el evento submit, valida usando normalizarProductos
y llama a api.guardar. Ambas funciones son async y actualizan la interfaz; no devuelven
un registro al llamador. El registro confirmado lo devuelve api.guardar.
Al editar, se reflejan nombre, categoría, precio y costo provisionalmente en el catálogo
y en la factura actual. Se bloquea la interacción con la venta durante la petición.
Un fallo restaura el producto anterior, recalcula la factura y conserva el formulario.
No se modifica ultimaVenta ni los registros del historial. La creación se incorpora
al catálogo únicamente tras confirmación y conserva su ID al reintentar un fallo.
Al editar se omiten stock y seguimientoInventario en el POST; ambos controles están
deshabilitados. Se admite stock inicial al crear. No hay ajustes de inventario aquí.
Si se pierde una respuesta, revertir la vista no deshace una escritura que pudo llegar
a Sheets: comprobar el catálogo antes de repetir una operación de resultado incierto.

Pruebas simuladas: node facturacion/tests/product-form.test.cjs.
Comprobación en navegador: formulario visible, categoría cuadernos obtenida del servicio,
sin errores de consola y sin desbordamiento horizontal a 375, 768 y 1280 píxeles.
No se efectuaron escrituras reales de prueba. La hoja productos estaba vacía.
La migración de ventas/compras sigue pendiente. Las validaciones del formulario no
sustituyen las validaciones del servicio.

## Eliminación y reglas del producto (requiere nueva publicación)
eliminarProductoCatalogo recibe un ID y elimina mediante api.guardar solo tras una
confirmación del usuario. No es eliminarProducto de app.js: esa función sigue quitando
artículos del carrito. Bloquea productos de la venta actual y formularios abiertos.
Mientras se procesa, impide recargas y operaciones concurrentes desde esta interfaz.
No retira el producto de memoria hasta confirmar el ID en la respuesta. Si falla,
conserva el catálogo y muestra el error. No cambia historial ni ultimaVenta.

Code.gs ahora valida productos antes de escribir y comprueba que categoriaId existe.
actualizarRegistro combina los datos actuales con los cambios para validar una edición
parcial; rechaza stock y seguimientoInventario en esa operación. eliminarRegistro
comprueba ventas abiertas e impide eliminar productos que necesiten esas ventas.
Los detalles de ventas abiertas usan itemsJson con id por artículo. Estados o detalles
inválidos bloquean la eliminación; las ventas cerradas conservan sus propios datos.
El bloqueo de doPost abarca la comprobación y la escritura, no las ediciones manuales
que se hagan directamente en la hoja.

Pruebas locales: tests/products-service.test.cjs (Code.gs con hojas simuladas) y
tests/product-form.test.cjs (CRUD de interfaz con API simulada). Pasan también las
pruebas previas de catálogo y categorías. No se hicieron escrituras remotas de prueba.
Es necesario publicar la revisión actual de google-apps-script/para-publicar/Code.gs
en la misma implementación para activar las nuevas reglas del servicio.

## Proveedores
suppliers.js agrega listado, búsqueda por nombre/teléfono/correo, creación, edición
y eliminación mediante api.js. Reutiliza las clases visuales del panel de categorías.
Nombre obligatorio; teléfono y correo opcionales. El teléfono se envía como texto.
Los registros se incorporan a la copia en memoria solo tras confirmación de la API.
Errores conservan formulario y registros; una bandera bloquea solicitudes simultáneas.
El ID de creación se conserva ante errores para no generar otro registro al reintentar.
Actualizar lista permite comprobar una operación cuya respuesta se haya perdido.
La eliminación requiere confirmación y depende de la restricción existente del servicio
para compras.proveedorId. No se modificó Apps Script en esta etapa: no requiere otra
publicación si la versión anterior ya está publicada. Las validaciones de nombre/correo
de esta etapa son de interfaz; aún falta reforzarlas en el servicio.
Pruebas: node facturacion/tests/suppliers.test.cjs, con API y DOM simulados.
También pasan las pruebas previas de categorías, catálogo y productos. No se escribieron
datos reales ni se comprobó visualmente el nuevo panel en móvil en esa primera etapa.

### Validación del servicio y verificación del panel
La revisión siguiente agrega validarProveedor a Code.gs y a ValidarProveedor.gs.
crearRegistro valida antes de escribir; actualizarRegistro combina los campos actuales
con los cambios y valida el resultado sin borrar los campos omitidos. Nombre requerido,
correo opcional con formato básico y teléfono opcional de tipo texto o número finito
para compatibilidad con registros antiguos. No comprueba que la dirección exista.
El bloqueo de doPost y la comprobación de compras.proveedorId permanecen sin cambios.
Esta revisión requiere publicar una nueva versión de la misma implementación.

Pruebas: tests/suppliers-service.test.cjs verifica rechazo sin escritura, edición
parcial, contacto opcional y eliminación bloqueada por compras o encabezados faltantes.
En navegador se comprobó GET real, abrir/cancelar edición y búsqueda sin coincidencias.
Panel sin desbordamiento horizontal a 375, 768 y 1280 píxeles; consola sin errores.
No se hicieron escrituras remotas de prueba. No fue necesario cambiar CSS.

## Clientes
customers.js incorpora CRUD y búsqueda por nombre/teléfono/correo con el mismo patrón
de proveedores, sin cambiar las funciones existentes ni añadir un gestor genérico.
Usa api.listar y api.guardar; mantiene una copia en memoria, no localStorage.
Nombre requerido, teléfono/correo opcionales. Incorpora registros solo tras confirmar
la respuesta; conserva formulario e ID de creación ante fallos y bloquea doble envío.
La eliminación pide confirmación y usa la restricción existente ventas.clienteId.
El panel reutiliza las clases de categorías; no necesita nuevos estilos.

Code.gs agrega validarCliente y la invoca en crearRegistro y actualizarRegistro antes
de escribir. En edición valida la combinación de campos actuales y recibidos sin borrar
los omitidos. Esta revisión requiere nueva publicación en la misma implementación.
No se ha conectado aún el cliente a la venta ni implementado su obligatoriedad para Debe.
Tampoco cambia el historial ni el inventario.

Pruebas simuladas: tests/customers.test.cjs y tests/customers-service.test.cjs.
Comprueban CRUD, búsqueda, errores, doble envío, validación de contacto, actualización
parcial y bloqueo de eliminación por ventas o por encabezados faltantes.
GET real en navegador devolvió lista vacía. Panel sin desbordamiento a 375/768/1280,
sin errores de consola. No se realizaron escrituras ni eliminaciones remotas de prueba.

## Cliente en el flujo de venta (transición del MVP 1)
sale-customer.js consulta clientes mediante api.listar y llena clienteVenta con opciones
seguras mediante textContent. Efectivo/Nequi admiten cliente vacío; Debe exige uno.
Se conserva Tarjeta débito del MVP 1 y se agrega Debe sin cambiar valores anteriores.
validarVenta llama a obtenerClienteVenta antes de continuar. Una carga en curso o una
selección obsoleta impiden confirmar; un fallo permite reintentar. Las modificaciones
del CRUD invalidan el selector, incluso si ocurren mientras se consulta la lista.

obtenerClienteVenta devuelve {clienteId, clienteNombre}. El nombre es una copia para
la factura histórica, independiente del nombre que tenga después el cliente. Se muestra
en confirmación, detalle e impresión. Los registros anteriores usan Sin cliente.
limpiarFormularioFactura borra la selección al iniciar/cancelar/finalizar una venta.

IMPORTANTE: esta etapa conserva registrarVenta del MVP 1 y su historial local. Todavía
no guarda ventas en Sheets ni descuenta inventario. La regla Debe de esta etapa es de
interfaz; deberá repetirse en el servicio al migrar el cierre. No afirmar que las ventas
locales activan la restricción ventas.clienteId en Sheets. No se modifican encabezados
ni se envía clienteNombre a la hoja actual, que no dispone de esa columna.
Esta revisión de frontend no requiere otra publicación de Apps Script.
Pruebas: tests/sale-customer.test.cjs incluye la función validarVenta real, efectivo
suficiente/insuficiente, Debe con/sin cliente, fallos, doble carga y copia del nombre.
La verificación visual de estos nuevos controles queda pendiente; no se guardaron
ventas reales de prueba ni se probaron todavía ventas abiertas o inventario.

## Servicio de ventas abiertas
Se agregó guardarVentaAbierta(datos, actualizar), invocada por create/update de ventas
dentro del bloqueo de doPost. La interfaz aún no la llama. No realiza ninguna escritura
en productos: una abierta se admite incluso si sus cantidades superan el stock actual.
El cierre con inventario sigue pendiente y no puede hacerse mediante create genérico.

Entrada: id de texto, estado abierta, persona, clienteId (texto vacío si no hay cliente),
metodoPago y itemsJson como arreglo de {id, cantidad}. Cada producto aparece una vez,
con cantidad entera positiva. Al actualizar también se envía actualizadoEn, exactamente
como se recibió al consultar. La edición es un reemplazo del borrador, no un parche parcial.
Métodos admitidos: vacío, Efectivo, Nequi, Debe y Tarjeta débito (compatibilidad MVP 1).
Debe requiere cliente existente. Precios/nombres se consultan en el catálogo; el nombre
del cliente se toma de clientes. Importes enviados por el navegador no son autoridad.

Salida: registro confirmado con itemsJson como arreglo, subtotal, iva y total calculados
por el servicio. Se conserva IVA 19% y el cálculo sin redondeo del MVP 1. fecha se asigna
al crear y se conserva al editar; actualizadoEn cambia en cada guardado. Ambos son ISO.
valorRecibido/cambio permanecen vacíos porque no se ha cobrado. No se edita una cerrada.
ID repetido en create se rechaza: consultar el existente antes de repetir un envío incierto.
actualizadoEn evita sobrescribir cambios de otra sesión; una versión antigua se rechaza.
Las columnas originales se conservan junto con persona, iva y clienteNombre. No se
migran ni eliminan ventas antiguas automáticamente.

Pruebas: node facturacion/tests/open-sales-service.test.cjs. Ejecuta doPost y las reglas
del Code.gs unificado con hojas simuladas, comprueba bloqueo/liberación, errores antes
de escribir, Debe, totales, stock intacto, creación duplicada, edición y conflictos.
No se han hecho escrituras reales ni se ha publicado esta revisión automáticamente.

## Interfaz de ventas abiertas
open-sales.js usa api.listar/guardar: botones Guardar como abierta, Consultar ventas
abiertas y Retomar. Mantiene ID y actualizadoEn en memoria. No utiliza localStorage.
Crear conserva el ID ante un error; para un resultado incierto se consulta y retoma la
venta existente antes de reintentar. Actualizar envía la versión recibida del servidor.
El servicio rechaza versiones antiguas y la interfaz conserva el carrito ante errores.

Retomar pide confirmación si hay artículos en curso y consulta nuevamente ventas,
productos, categorías y clientes antes de reemplazar el carrito. Usa precios actuales
y lo indica al usuario. Si faltan productos/clientes o la venta ya no está abierta,
no sustituye la venta en pantalla. No recupera efectivo como cobro confirmado.
Guardar muestra los precios confirmados por el servicio sin modificar el stock local.
La consulta a productos al retomar actualiza la copia local, no escribe existencias.

Iniciar otra factura o cancelar descarta los cambios locales y desvincula la venta;
no elimina la abierta en Sheets. El cierre local está bloqueado cuando existe ID remoto
o un intento de guardado incierto: el cierre remoto con inventario sigue pendiente.
Las ventas nuevas que no se han guardado como abiertas conservan el flujo MVP 1.
No afirmar todavía que todo el historial está migrado a Sheets.

Prueba: node facturacion/tests/open-sales.test.cjs. Cubre creación, actualización,
doble envío, conflictos, retomar/cancelar recuperación, error conservando carrito,
stock sin cambios y bloqueo del cierre local. No se guardaron ventas reales de prueba.
La revisión visual móvil de los nuevos controles sigue pendiente. Esta etapa solo
modifica frontend y requiere la versión de guardarVentaAbierta ya publicada por el usuario.

## Servicio de cierre (pendiente de publicación e integración visual)
api.guardar("ventas", "cerrar", datos) envía action close a doPost. Otros recursos
no admiten cerrar. datos contiene id, actualizadoEn y valorRecibido (número para
Efectivo, null/vacío/omitido para otros métodos). Primero debe existir una venta abierta.
No se crean ventas cerradas directamente mediante create.

cerrarVenta revisa la versión, cliente, método, importes del detalle guardado y stock
actual. No cambia precios históricos con el catálogo actual. Recalcula los totales
con IVA 19% y exige que coincidan con los guardados. Ante stock insuficiente identifica
el producto y sus cantidades. Los productos sin seguimiento no generan escritura de stock.
El cierre normal valida efectivo y calcula cambio; Debe exige un cliente existente.

Una sola petición Sheets.Spreadsheets.batchUpdate modifica las existencias necesarias
y estado/valorRecibido/cambio/actualizadoEn. Requiere habilitar Google Sheets API como
servicio avanzado dentro del mismo Apps Script. No añade otro servicio externo ni backend.
Tras confirmar el lote se devuelve el comprobante. Si se pierde la respuesta, consultar
o reintentar el mismo ID: una venta ya cerrada devuelve su comprobante sin volver a
descontar ni modificar el pago. Esto no implementa correcciones de ventas cerradas.
El bloqueo coordina operaciones de este Apps Script, no cambios manuales ni otros scripts.

Pruebas: tests/close-sales-service.test.cjs simula doPost, bloqueo y lote atómico; cubre
stock insuficiente, efectivo insuficiente, Debe, versión antigua, stock sin seguimiento,
fallo antes de escribir y respuesta perdida después del lote con reintento sin duplicar.
No se ha cerrado una venta real. El botón remoto permanece bloqueado en esta etapa;
se conectará después de activar el servicio y publicar la implementación.

## Cierre remoto conectado para ventas abiertas
close-sales.js conecta Cerrar venta en Sheets al servicio publicado. Requiere que la
venta haya sido guardada como abierta, con todos sus cambios confirmados. Una firma
en memoria compara trabajador, cliente, método y artículos/precios antes de cerrar.
Retomar exige volver a guardar para confirmar precios actuales antes de cobrar.
La firma no incluye efectivo: se introduce para el cierre, no para guardar el borrador.

Los datos de cierre se congelan en cierrePendiente. Un doble clic no envía otra petición.
Un error RECHAZADO conserva carrito y permite corregirlo. Una respuesta incierta bloquea
edición/cambio de venta y muestra Reintentar cierre pendiente, que reutiliza el mismo ID,
versión y pago. No se marca éxito ni se borra el carrito antes de validar el comprobante.
doPost y cerrarVenta agregan códigos de error; requiere nueva publicación. No hace
falta volver a activar Google Sheets API. Sin código se asume resultado incierto.

adaptarVentaCerrada convierte itemsJson a productos y valorRecibido a dineroRecibido,
mantiene los datos históricos y presenta fecha/hora en America/Bogota. La confirmación
y la impresión reutilizan mostrarFacturaConfirmada extraída de generarFactura; no se
escribe el comprobante remoto en localStorage. Tras confirmar se consulta el catálogo.
Si falla esa consulta, se advierte que la venta SÍ se cerró, sin inventar stock ni reabrirla.

TRANSICIÓN: las ventas no guardadas como abiertas aún usan el cierre local original,
ahora identificado como Generar factura (MVP 1 local). El historial remoto aún no está
integrado: el comprobante remoto actual se puede imprimir, pero no aparece todavía en
la página de historial local. La siguiente etapa debe migrar ese historial y unificar
el cierre normal; no considerar finalizada la migración MVP 2.
No cerrar la pestaña durante un cierre incierto. La operación pendiente es solo memoria;
tras recargar, consultar ventas en Sheets antes de recrear una venta cuyo resultado se desconoce.

Prueba nueva: tests/close-sales.test.cjs. Verifica confirmación, adaptación, petición
duplicada, stock remoto, rechazo, respuesta perdida, datos de reintento inmutables y
fallo de recarga después de un cierre confirmado. No se cerraron ventas reales ni se
verificó visualmente el nuevo botón en esta etapa.

## Historial remoto y cierre unificado (revisión posterior)
generarFactura ya no llama a registrarVentaEnHistorial. Para una venta nueva guarda
primero un borrador remoto y luego solicita cerrar; si hay cambios en una abierta,
los guarda antes de cerrar. Un fallo de guardado detiene el cierre. Si el total del
servicio difiere del mostrado, exige revisar y confirmar de nuevo. El cierre conserva
las reglas anteriores de stock, cobro, versión y recuperación del resultado incierto.
index.html ya no carga Historial_de_ventas.js; no hay escrituras locales de ventas.

sales-data.js contiene el adaptador compartido de comprobantes que antes estaba en
close-sales.js, para que historial y factura muestren exactamente el mismo formato.
remote-history.js consulta ventas mediante api.listar, filtra cerradas, valida/adapta
registros y mantiene una copia en memoria. obtenerHistorial consume esa copia por defecto.
Una consulta fallida conserva la última carga remota y explica el error, sin recurrir
silenciosamente al historial del navegador.

La opción Historial anterior consulta explícitamente la clave local del MVP 1 en modo
solo lectura. No importa, mezcla, borra ni modifica esos registros ni su inventario.
guardarHistorial/registrarVenta ya no escriben; las acciones de borrado quedan inhabilitadas.
Se conservan detalle, factura e impresión usando los registros de la fuente elegida.
PDF se obtiene mediante Imprimir > Guardar como PDF; no se agregó una librería externa.
La importación del archivo antiguo a Sheets queda pendiente como migración separada.

Las páginas versionan los scripts para evitar mezclar el historial viejo almacenado
en caché con HTML nuevo. Se verificó GET real: cero ventas cerradas; la vista anterior
mantiene su factura local. Historial móvil a 375 px sin desbordamiento del documento;
la tabla conserva su desplazamiento horizontal. No hay errores de consola en historial
ni facturación. No se verificó un cierre real ni se generó un PDF real en esta etapa.
Pruebas nuevas: tests/remote-history.test.cjs y tests/generate-remote.test.cjs.
Pasan las quince pruebas locales. Esta etapa no agrega cambios de Apps Script; sigue
siendo necesaria la revisión anterior con RECHAZADO/CIERRE_INCIERTO para distinguir errores.

## Compras: servicio atómico (interfaz pendiente)
POST resource=compras, action=create deriva ahora a guardarCompra, no al alta genérica.
Entrada: {id, fecha: "YYYY-MM-DD", proveedorId, itemsJson: [{id, cantidad, costo}], total?}.
El ID de texto debe generarse una vez por compra y conservarse en reintentos.
Cantidad es entero positivo seguro; costo es número finito no negativo; no se repiten
productos. El total se calcula en el servidor; si se envía debe coincidir exactamente.
Salida: {id, fecha, proveedorId, total, itemsJson}, donde cada detalle conserva además
nombre y subtotal de esa compra. No se añade IVA a compras ni se cambia el IVA de ventas.
Fecha es texto de calendario, no un instante UTC, para evitar desplazar el día elegido.

Funciones nuevas:
- guardarCompra(datos): valida relaciones, construye snapshots y solicitudes, confirma
  un único lote y devuelve el registro. Se llama desde crearRegistro bajo el lock de doPost.
- firmaCompra(compra): valida identidad/fecha/detalle/total y devuelve texto comparable;
  permite reconocer el mismo intento sin depender de nombres actuales del catálogo.
- validarColumnasCompra(columnas, requeridas): devuelve undefined cuando son válidas
  o lanza Error si faltan columnas o hay encabezados vacíos/duplicados. No escribe.
Se reutiliza actualizarCeldaCierre: pese a su nombre, solo construye una petición de
celda y sirve también para stock/costo de compras. No se renombró para evitar cambios
innecesarios en el cierre ya probado.

El lote suma stock únicamente con seguimientoInventario true. Actualiza costo en
todos los productos, incluidos los sin seguimiento. Última compra significa última
registrada/confirmada, aunque su fecha elegida sea anterior; no recalcula cronología.
appendCells añade la compra y expande filas si hace falta dentro del mismo lote.
Un ID ya registrado con idénticos datos devuelve su snapshot sin volver a escribir;
otro contenido con ese ID se rechaza. Mantener exactamente orden y datos al reintentar.
No se admiten edición ni eliminación de compras confirmadas. No se reproduce ni se
migra inventario de compras antiguas. Evitar editar manualmente Sheets mientras opera
el POS: LockService no bloquea al usuario de la hoja ni a otros proyectos.

Si batchUpdate lanza error, codigo=COMPRA_INCIERTA: puede haber aplicado el lote antes
de perderse la respuesta. Consultar o reintentar el mismo ID/datos, nunca crear otro ID.
La futura interfaz deberá bloquear doble envío y conservar el intento incierto; no
se implementó todavía esa pantalla ni se modificó HTML/CSS en esta etapa.
Publicar Code.gs unificado como nueva versión, sin cambiar encabezados ni URL.

Prueba nueva: tests/purchases-service.test.cjs, ejecuta el Code.gs integrado con Sheets
simulado. Cubre compra, proveedor/fecha/cantidades/costos inválidos, stock fuera de
rango, costo sin seguimiento, histórico, doble envío, rechazo atómico y respuesta
perdida seguida de reintento. Pasan las 16 pruebas locales. No se hicieron escrituras
en la hoja real; la publicación y prueba real quedan pendientes.

Para sustentación: ¿por qué no guardar primero la compra y después el stock?
Porque la segunda escritura podría fallar. Un único lote atómico aplica todos los
cambios o ninguno; además, el ID estable evita repetirlos al reintentar la petición.
Referencia: https://developers.google.com/workspace/sheets/api/guides/batch
appendCells: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#AppendCellsRequest
