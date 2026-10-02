# Recuperación del cierre pendiente

## ARCHIVO: close-sales.js
UBICACIÓN: cerrarVentaRemota, antes del POST y después de confirmación/rechazo.

PROBLEMA: el intento existía solo en memoria. Recargar tras una respuesta perdida
eliminaba su ID/versión/pago de la interfaz, aunque Sheets podía haber cerrado la venta.

SOLUCIÓN: conservar únicamente el borrador de petición en localStorage, antes del POST.
No guardar ventas confirmadas, catálogo ni inventario local. El servidor sigue siendo
la fuente de datos y su cierre idempotente evita repetir el descuento para el mismo ID.

CÓDIGO ANTERIOR, fragmento:
```js
ventasAbiertasEstado.cierrePendiente = {id: ventasAbiertasEstado.id,
    actualizadoEn: ventasAbiertasEstado.actualizadoEn,
    valorRecibido: metodoPago.value === "efectivo" ? Number(dineroRecibido.value) : null};
```
CÓDIGO CORREGIDO, fragmento dentro de try/catch:
```js
validarBorradorCierre(pendiente);
if (localStorage.getItem(claveCierrePendiente)) {
    recuperarCierrePendiente();
    return;
}
localStorage.setItem(claveCierrePendiente, JSON.stringify(pendiente));
ventasAbiertasEstado.cierrePendiente = pendiente;
```
Después de validar la respuesta cerrada se retira el borrador. Si falla su retirada,
se mantiene el intento: reenviarlo obtiene el mismo comprobante sin otro descuento.
Un RECHAZADO permite corregir; si se recargó y no hay carrito, se indica consultar y
retomar la venta abierta. Un fallo de conexión mantiene datos y botón de reintento.

Funciones nuevas:
- validarBorradorCierre(datos): recibe {id, actualizadoEn, valorRecibido}; comprueba ID,
  fecha de versión y pago numérico no negativo o null. Devuelve el mismo objeto o lanza
  Error. Rechaza campos extra y no escribe. Se usa al guardar y recuperar el borrador.
- recuperarCierrePendiente(): no recibe argumentos. Lee papelLuna.cierrePendiente.v1,
  valida y restaura la referencia; devuelve false sin pendiente, true si recuperó o
  bloqueó por error. No ejecuta POST. Reutiliza mensajeAbiertas y bloquearAbiertas.

## ARCHIVO: app.js
UBICACIÓN: render inicial, iniciar/cancelar factura.
PROBLEMA: el arranque no buscaba peticiones pendientes.
CÓDIGO ANTERIOR:
```js
cargarProductos();
cargarClientesVenta();
```
CÓDIGO CORREGIDO:
```js
if (!recuperarCierrePendiente()) cargarProductos();
cargarClientesVenta();
```
Se evita cargar un catálogo inicial que compita con el GET posterior al cierre.
Tras confirmación, cerrarVentaRemota ya consulta el stock real. Tras rechazo recuperado,
el usuario puede consultar/retomar una abierta, que carga su catálogo, o actualizarlo.
Iniciar/cancelar también respetan recuperacionBloqueada para no ocultar un error.

## ARCHIVO: open-sales.js
UBICACIÓN: estado, comprobarDisponibilidadAbiertas y bloquearAbiertas.
PROBLEMA: un borrador corrupto no proporciona un cierre válido, pero tampoco demuestra
que sea seguro comenzar otra venta.
SOLUCIÓN: recuperacionBloqueada inicia en false y pasa a true si la lectura/validación
falla. Las comprobaciones y los controles consideran este flag además del pendiente.
No se elimina información automáticamente para desbloquear. Hay que revisar el
borrador y las ventas remotas; no usar borrar almacenamiento como solución automática.

## ARCHIVO: index.html
UBICACIÓN: versiones de scripts open-sales.js, close-sales.js y app.js.
Se cambió la etiqueta de caché a mvp2-cierre-3. No se cambiaron IDs, diseño ni CSS.

## Sustentación
¿Qué se guarda localmente? Solo el borrador de la petición (ID, versión y pago), no la
venta histórica ni el stock. Sigue dentro de la excepción de borradores de interfaz.
¿Por qué conservar el mismo ID? El servidor reconoce una venta ya cerrada y devuelve
su comprobante sin descontar de nuevo.
¿Por qué no reintentar automáticamente? La recuperación informa al usuario y espera
su acción explícita; no inicia otra escritura al abrir la página.
¿Dónde está el stock definitivo? En Sheets; el navegador lo vuelve a consultar.

## Pruebas y límites
Se extendió tests/close-sales.test.cjs: recarga simulada comparte almacenamiento,
recupera ID/versión/pago, no envía automáticamente y reintenta correctamente; borrador
corrupto se conserva, almacenamiento lleno impide POST y fallo al borrar tras éxito
mantiene el intento. Siguen pasando los 19 archivos de pruebas locales.
No se cerraron ventas reales ni se verificó visualmente una recarga con venta real.
Esta etapa no modifica Code.gs ni requiere publicar otra versión del servidor.
Depende del cierre idempotente ya implementado y de la clasificación de errores.
La clave es por navegador/origen; no sincroniza borradores entre dispositivos ni
ofrece un bloqueo transaccional entre pestañas. Evitar operar la misma venta en varias.
