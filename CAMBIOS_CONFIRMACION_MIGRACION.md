# Etapa: confirmar importación desde el historial

## ARCHIVO: migration-import.js (nuevo)
UBICACIÓN: convertirFechaHistorica(fecha, hora).
PROBLEMA: el MVP 1 conserva fecha/hora como textos para mostrar, no como fecha ISO.
SOLUCIÓN: interpretar explícitamente día/mes/año y hora de Bogotá UTC-5. Acepta hora
de 24 horas o am/pm con puntos/espacios, segundos opcionales. Valida calendario real,
incluidos años bisiestos; rechaza formatos no reconocidos y años anteriores a 1994.
No usa Date.parse sobre fecha ambigua del tipo 01/02/2026.
Recibe dos textos; devuelve ISO UTC completo o lanza Error. Ejemplo probado:
```js
convertirFechaHistorica("22/09/2026", "3:16 p. m.");
// "2026-09-22T20:16:00.000Z"
```
Esta interpretación se informa en el panel y se vuelve a mostrar en la confirmación.
Si los archivos se registraron en otra zona, no confirmar su importación con este conversor.

UBICACIÓN: convertirVentaAnterior(anterior).
Recibe un registro local, ejecuta la revisión previa y devuelve {origenId,venta}.
Convierte IDs numéricos a texto; mantiene nombre/precio/cantidad/subtotal de cada detalle.
No inventa productos ni efectivo ni identifica clientes por coincidencia de nombres.
Si falta ID de producto, cliente/nombre requerido o importe, bloquea ese registro.
No toma nombres/precios actuales del catálogo. No modifica el objeto original.

UBICACIÓN: agregarBotonImportacion(elemento, anterior).
Recibe el elemento de lista y el registro original. Agrega un botón solo si la conversión
es válida; en caso contrario muestra el motivo. No devuelve datos ni escribe en Sheets.

UBICACIÓN: importarVentaAnterior(datos).
Recibe el objeto convertido (o ninguno al reintentar); devuelve Promise<void>.
Pide confirmación mostrando ID, fecha/hora Bogotá, trabajador, método y total. Conserva
un borrador de petición antes de enviar y bloquea doble clic. La llamada nueva es:
```js
const resultado = await api.guardar("ventas", "importar", pendiente);
```
Valida que la respuesta sea cerrada, tenga el ID esperado y los mismos datos históricos.
Solo entonces retira el borrador e invalida los botones de la revisión anterior.
Se debe actualizar el historial remoto o preparar otra vista previa después del éxito.
No borra ni marca el archivo MVP 1; no modifica catálogo ni inventario.

UBICACIÓN: recuperarImportacionPendiente() y bloquearImportacion().
No reciben argumentos ni devuelven datos. La primera restaura el borrador de petición
papelLuna.importacionPendiente.v1 tras recarga; no envía automáticamente. La segunda
actualiza botones según pendiente/ocupado/bloqueado. Un borrador corrupto se conserva
y bloquea nuevas importaciones hasta revisión. Si falla guardar el borrador no hay POST.
Si la respuesta es incierta se repiten exactamente ID/datos; RECHAZADO permite corregir.
localStorage no es fuente del historial nuevo: solo archivo anterior y borrador de envío.
Evitar importar desde varias pestañas a la vez; no hay bloqueo transaccional entre ellas.

## ARCHIVO: api.js
UBICACIÓN: acciones y accionesServicio.
PROBLEMA: el transporte no exponía la nueva acción del servidor.
CÓDIGO ANTERIOR, fragmento del mapa:
```js
cerrar: "close"
```
CÓDIGO CORREGIDO, fragmento:
```js
cerrar: "close", importar: "import"
```
Se añade importar a la lista de acciones válidas y se restringe al recurso ventas.
Se conserva fetch centralizado, JSON, timeout y clasificación de errores existentes.

## ARCHIVOS: migration-preview.js y Historial_de_ventas.html
La revisión sigue siendo GET: no importa al pulsar Preparar vista previa. Los candidatos
reciben el botón individual Revisar e importar. Los posibles duplicados no tienen botón.
La comparación de ID ahora comprueba tanto el ID original como el prefijo mvp1- usado
por el servidor; evita volver a ofrecer registros ya importados.
Antes: contar(remotas, id) > 0.
Ahora: contar(remotas, id) > 0 || contar(remotas, "mvp1-" + encodeURIComponent(id)) > 0.
Se añadieron aviso de zona/versión publicada, mensaje de importación y botón de reintento.
Se versionaron los scripts de esta página para evitar mezclar caché vieja.

## Sustentación
¿Por qué confirmar fecha/hora? El formato día/mes/año no debe interpretarse como
mes/día/año ni con la zona horaria de cualquier equipo.
¿Por qué no eliminar el registro local al importar? Se conserva como respaldo y
permite verificar el original; Sheets pasa a ser la fuente del historial principal.
¿Qué impide duplicar al reintentar? origenId estable y comprobación idempotente del
servidor; el bloqueo del botón solo evita doble envío desde este formulario.
¿Se puede importar un posible duplicado automáticamente? No: necesita revisión humana.

## Pruebas y alcance
Pasan los 22 archivos de pruebas locales. Se probaron medianoche, mediodía, am/pm,
cambio de día UTC, bisiestos, fechas inválidas, rechazo de datos incompletos, cancelación,
doble clic, respuesta perdida, recarga, almacenamiento fallido, confirmación incorrecta,
prefijo de duplicados y mapeo importar→import de la API.
No se hicieron importaciones reales ni comprobación visual de esta nueva confirmación.
No cambia Code.gs en esta etapa: debe estar publicada la versión de importación de la
etapa anterior. La migración de datos reales no se considera completada por añadir UI.
