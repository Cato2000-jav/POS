# Etapa: interfaz de compras

## Archivo: index.html. Ubicación: encabezado
Problema: no había acceso a compras.
Solución: añadir un enlace a compras.html en otra pestaña, sin cambiar IDs ni
interrumpir el carrito de ventas. Antes no existía un enlace de compras.
Código añadido:
```html
<a href="compras.html" target="_blank" rel="noopener">Compras ↗</a>
```

## Archivos nuevos: compras.html, purchases.css, purchases.js
No reemplazan código anterior. La página reutiliza styles.css y el transporte api.js.
El CSS nuevo queda acotado a compras, con campos en una columna en celular y tabla
con desplazamiento horizontal. No cambia las media queries de la facturación.

Funciones principales (entradas, salidas y conexión):
- cargarCompras(): sin argumentos, devuelve Promise<void>. Obtiene compras, productos
  y proveedores con api.listar; valida primero y solo entonces reemplaza las copias
  en memoria. Conserva la última carga si la consulta falla.
- totalItemsCompra(items): recibe detalles {id,cantidad,costo}; devuelve total numérico
  o lanza error. Es compartida por formulario, confirmaciones y recuperación del borrador.
- validarCompraRecibida(compra): recibe una compra remota, verifica fecha, total y
  snapshots y devuelve ese registro; una respuesta incompleta no confirma el guardado.
- mismaCompra(compra,intento): recibe confirmación e intento; devuelve booleano al
  comparar ID, fecha, proveedor, total y detalle. No compara nombres actuales.
- guardarCompraFormulario(evento?): recibe el submit opcional; devuelve Promise<void>.
  Valida, fija un UUID y conserva el borrador antes del POST. Deshabilita el formulario
  mientras procesa y espera confirmación. No calcula ni aplica stock localmente.
- bloquearCompra(ocupado): recibe booleano; no devuelve datos. Controla botones,
  fieldset y aria-busy. Evita doble envío desde el mismo formulario.
- iniciarCompras(): restaura un posible borrador pendiente y carga la API. Si el
  almacenamiento está ilegible, bloquea nuevas compras sin borrar el posible intento.
- renderProductosCompra(), renderItemsCompra(), actualizarTotalCompra() y
  renderListaCompras(): leen el estado en memoria y actualizan el DOM; no retornan datos
  ni escriben en Sheets. Los nombres se muestran con textContent, no como HTML.
- opcionCompra(valor,texto): devuelve una opción segura para los selectores.
- avisarCompra(texto): muestra carga, error o confirmación en la región de estado.

La nueva llamada de escritura es:
```js
const compra = validarCompraRecibida(
    await api.guardar("compras", "crear", comprasEstado.pendiente)
);
```
El servidor usa guardarCompra del Code.gs preparado en la etapa anterior. Debe estar
publicado antes de guardar desde esta pantalla. No se han publicado cambios automáticamente.

localStorage solo contiene papelLuna.compraPendiente.v1: un borrador de petición, no
un catálogo, inventario ni historial. Si se pierde la respuesta, queda bloqueada la
edición y se permite reenviar los mismos datos/ID. Sobrevive a recargar la página.
RECHAZADO permite corregir; una respuesta desconocida conserva el intento. Si el
servicio ya había aplicado el lote, devuelve esa compra sin sumar stock nuevamente.
No abrir varias pestañas para registrar la misma compra; la comprobación local de
otro pendiente ayuda a detectarlo, pero no es un bloqueo transaccional entre pestañas.
Tras éxito se exige Actualizar datos antes de preparar otra compra, para traer costos
actualizados. El listado agrega solamente el comprobante confirmado y se vuelve a
consultar en Sheets al actualizar. Las ventas de otras pestañas no cambian sus precios.

## Archivo: api.js. Ubicación: solicitar
Problema observado: una consulta real permaneció esperando y mantuvo la pantalla
deshabilitada. No había límite de espera.
Código anterior relevante:
```js
respuesta = await fetch(destino.href, opciones);
```
Solución añadida alrededor del transporte existente:
```js
const controlador = new AbortController();
opciones.signal = controlador.signal;
const temporizador = setTimeout(() => controlador.abort(), 30000);
try {
    // fetch, lectura JSON y validación existentes
} finally {
    clearTimeout(temporizador);
}
```
AbortController proporciona una señal al fetch; el temporizador dispara cancelación
tras 30 segundos y finally lo retira al terminar. No devuelve datos adicionales ni
convierte un POST cancelado en RECHAZADO: el servidor podría haberlo aplicado.
Se actualizó la versión de api.js en index e historial para evitar caché anterior.

## Sustentación
¿Por qué el botón está deshabilitado y además se comprueba ocupado en JavaScript?
La deshabilitación informa al usuario; la comprobación evita una segunda ejecución.
¿Por qué conservar el ID cuando falla Internet? Un ID nuevo representa otra compra y
podría repetir inventario. El mismo ID permite que el servidor reconozca el reintento.
¿Por qué no sumar stock en el navegador? Solo Sheets confirma la transacción y es la
fuente compartida por todos los equipos.
¿Por qué usar localStorage aquí? Es únicamente un borrador de interfaz pendiente,
permitido por el alcance; no sustituye el servicio como fuente de registros.

## Pruebas
18 archivos de pruebas locales: validaciones, alta, detalle, búsqueda, quitar producto,
doble envío, respuesta perdida, recuperación tras recarga, rechazo, errores de carga
y timeout. No se registraron compras reales. La UI se revisó a 375, 768 y 1280 px sin
desbordamiento horizontal del documento; la tabla tiene scroll propio.
GET real confirmado: cinco productos, dos proveedores y cero compras. En navegador
se agregó un producto al borrador, se cambió a cantidad 2 y costo 10, se comprobó total
20 y se quitó, regresando a total 0. No se pulsó Guardar compra ni se escribió en Sheets.
El funcionamiento del nuevo POST desplegado sigue pendiente de una prueba autorizada.
