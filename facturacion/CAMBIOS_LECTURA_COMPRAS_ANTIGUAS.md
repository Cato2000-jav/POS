# Compatibilidad de lectura de compras antiguas — 6 de octubre de 2026

## Evidencia
Se consultó GET resource=compras en la URL configurada, sin escrituras.
La respuesta contiene una compra del 2026-10-02, total 72, cuyo itemsJson es un
texto JSON con un producto, cantidad 9 y costo 8. No contiene nombre ni subtotal.
Esto confirma el origen del mensaje, no si su stock se incrementó cuando fue creada.
El GET desplegado no coincide con la lectura local actual que devuelve arrays para
itemsJson. Antes de nuevas compras, revisar la versión publicada; este ajuste no
certifica que el POST remoto tenga implementada la transacción de inventario.

## ARCHIVO: purchases.js
UBICACIÓN: cargarCompras y normalizarCompraHistorica (nueva).
PROBLEMA: validarCompraRecibida exige el formato completo usado para confirmar un POST.
Usarla directamente sobre el historial bloqueaba también los selectores de productos
y proveedores al encontrar una compra antigua. El texto "Agrega al menos un producto"
procedía de aplicar la validación del formulario a un itemsJson que todavía era texto.

CÓDIGO ANTERIOR:
```js
const [registros, productos, proveedores] = await Promise.all([
    api.listar("compras"), api.listar("productos"), api.listar("proveedores")
]);
registros.forEach(validarCompraRecibida);
```
CÓDIGO CORREGIDO:
```js
const [comprasRemotas, productos, proveedores] = await Promise.all([
    api.listar("compras"), api.listar("productos"), api.listar("proveedores")
]);
const registros = comprasRemotas.map(normalizarCompraHistorica);
```

SOLUCIÓN: normalizarCompraHistorica recibe una compra de GET y devuelve una copia para
consulta. Si itemsJson es texto, lo analiza con JSON.parse; si ya es array, lo conserva
como entrada para crear copias de sus líneas. Valida cantidades/costos/IDs y totales.
Si falta nombre, muestra "Producto [ID] (nombre histórico no registrado)"; no consulta
el catálogo para inventar un nombre antiguo. Si falta subtotal, calcula cantidad*costo
solo para mostrarlo y agrega subtotalCalculado=true. Un subtotal existente incorrecto
o un total inconsistente sigue siendo un error; no se corrige silenciosamente.
detalleHistoricoIncompleto informa a la vista de que debe mostrar una advertencia.
Los fallos incluyen el ID de la compra para ubicar el registro; JSON vacío/corrupto
sigue siendo un error y no se convierte en una lista vacía válida.

UBICACIÓN: renderListaCompras, botón Ver detalle.
Ahora muestra la advertencia en registros antiguos e identifica los subtotales calculados.
La advertencia aclara que la hoja no cambió y que no se verificó el movimiento de stock.
No hay nuevos fetch, POST ni operaciones de inventario. La fila original no se toca.

validarCompraRecibida sigue intacta para guardarCompraFormulario: una respuesta POST
sin snapshots o con itemsJson como texto NO confirma que la compra nueva sea correcta.
La compatibilidad se limita a lectura. No se reenvía la compra antigua.

## ARCHIVO: compras.html
UBICACIÓN: script purchases.js.
Se cambia ?v=1 por ?v=2-lectura-historica para recargar el JavaScript actualizado.
No requiere cambios de columnas ni una nueva revisión de Code.gs para esta lectura.

## Sustentación y pruebas
¿Por qué no hacer flexible la confirmación del POST? Un registro antiguo se puede
consultar con advertencias, pero eso no prueba que una operación nueva actualizó stock.
¿Por qué calcular subtotal y no nombre? El subtotal sale de datos almacenados (9*8=72);
el nombre histórico no puede deducirse del catálogo actual con certeza.
¿Qué devuelve la función? Una copia validada para mostrar, o Error con ID de compra.
¿Cómo se conecta? cargarCompras la aplica al GET; el listado consume su resultado.

Pasan los 23 archivos de pruebas locales. Se amplió purchases.test.cjs con JSON textual,
array antiguo, snapshots modernos, datos corruptos, subtotal/total inconsistente,
rechazo estricto de POST antiguo, selectores cargados, advertencia y cero envíos al
leer. Los originales permanecen inalterados. No se verificó visualmente esta revisión
en file:// ni se escribió en Sheets.
