# Eliminación individual de productos, categorías, proveedores y clientes

## Revisión y alcance

Los cuatro módulos ya tenían botón Eliminar, confirmación con diálogo y envío
centralizado por `api.guardar(recurso, "eliminar", {id})`. El servicio traduce la
acción a `delete` mediante POST y comprueba asociaciones bajo el bloqueo de doPost.
Se conservó esa implementación; no se añadió borrado masivo ni se modificó Apps Script.

## Archivos, ubicación y motivo

| Archivo | Función | Ajuste |
| --- | --- | --- |
| product-form.js | eliminarProductoCatalogo | Tras confirmar, comprobar nuevamente formulario, existencia del producto y carrito |
| categories.js | eliminarCategoria | Tras confirmar, comprobar que la lista esté cargada y que la categoría siga en ella |
| suppliers.js | eliminarProveedor | Misma protección para proveedor |
| customers.js | eliminarCliente | Misma protección para cliente |
| index.html | Enlaces a scripts | Versiones actualizadas para cargar estos cambios |

Las cuatro funciones conservan el registro local ante fallo o respuesta con otro ID.
El mensaje de fallo indica actualizar la lista antes de repetir: un error de conexión
no demuestra que la eliminación haya fallado en el servidor.

## Fragmentos antes y después

En categorías, antes:
```js
if (categoriasEstado.cargando) return;
```
Ahora, después de la confirmación:
```js
if (categoriasEstado.cargando || !categoriasEstado.cargadas) return;
if (!categoriasEstado.registros.some(registro => String(registro.id) === String(categoria.id))) {
    mensajeCategorias.textContent = "La categoría ya no está en la lista. Actualiza antes de eliminar.";
    return;
}
```
Proveedores y clientes aplican la misma comprobación con sus variables actuales.

En productos, antes solo se repetía el bloqueo por operación/carga. Ahora también:
```js
if (!formProducto.hidden || !estado.productosDisponibles.some(p => p.id === id)) {
    mensaje.textContent = "El catálogo o el formulario cambió. Revisa el producto antes de eliminarlo.";
    return;
}
if (estado.facturaActual.some(item => item.id === id)) {
    mensaje.textContent = "No puedes eliminar el producto: está en la venta actual.";
    return;
}
```

## Cómo funciona y sustentación

1. Qué hace: borra un único registro elegido por el usuario después de confirmar.
2. Por qué se necesita la revisión: durante `await confirmarAccion(...)` puede
   cambiar el estado; la comprobación inicial ya no basta.
3. Qué recibe: productos recibe un ID; las otras tres funciones reciben el objeto
   seleccionado y envían únicamente su ID a la API.
4. Qué devuelve: una promesa que termina sin devolver datos; informa en pantalla y
   actualiza la lista solo tras confirmar la respuesta. Cancelar no envía POST.
5. Conexión: botón del módulo → manejador → confirmarAccion → api.guardar → doPost
   → eliminarRegistro; luego se actualiza el estado y se renderiza la lista.
6. Preguntas posibles: ¿por qué no borrar primero de pantalla? La API puede rechazar
   asociaciones. ¿Por qué validar también en el servidor? Otro usuario o cliente de
   API podría omitir los controles del navegador.

## Restricciones conservadas

- Producto en el carrito actual: bloqueo local. Producto en venta abierta guardada:
  bloqueo en servidor. Los datos históricos de ventas cerradas no se reescriben.
- Categoría con productos: no se elimina.
- Proveedor con compras: no se elimina.
- Cliente con ventas: no se elimina.
- Ventas y compras: esta operación no permite eliminarlas.

Eliminar producto retira su registro del catálogo, incluido el stock almacenado en
esa fila; no constituye una venta/compra ni recalcula los movimientos históricos.

## Verificación

Pruebas locales: cancelación, registro que desaparece durante la confirmación,
lista que deja de estar cargada, doble envío, respuesta con ID incorrecto, eliminación
confirmada y producto agregado al carrito durante la confirmación. Se mantienen las
pruebas de asociaciones en el servicio. No se ejecutaron eliminaciones reales ni
se verificó una escritura de borrado en la implementación publicada en esta etapa.

## Uso

Recargar Facturación. En cada producto usar Eliminar del catálogo (no confundir con
Quitar del carrito). Para los otros módulos, abrir Categorías, Proveedores o Clientes,
buscar el registro y pulsar Eliminar. Cancelar/Escape no elimina. Si el servidor
rechaza una relación, conservar los registros relacionados; no borrarlos para forzar
esta prueba. Ante error de conexión, actualizar antes de volver a intentar.
