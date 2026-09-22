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
Productos no tiene imagen ni descripcion: resolver su conservación antes de reemplazar
el catálogo actual. No se han modificado encabezados ni datos en Google Sheets.
