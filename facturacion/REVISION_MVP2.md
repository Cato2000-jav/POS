# Revisión del código disponible — 1 de octubre de 2026

Estado del código local, no certificación de la versión publicada. Las pruebas son
simuladas salvo las comprobaciones visuales/GET documentadas en etapas anteriores.

| Requisito | Estado | Archivo | Problema | Acción necesaria |
| --- | --- | --- | --- | --- |
| API central, fetch, async/await, JSON | ✅ Cumple | api.js | Sin llamadas fetch dispersas | Conservar |
| Productos remotos y CRUD/búsqueda | ✅ Cumple | products.js, product-form.js | Usa precio existente, equivalente a precioVenta | Conservar nombres actuales |
| Categoría seleccionada | ✅ Cumple | product-form.js | No permite texto libre | Conservar |
| Categorías CRUD y nombre obligatorio | ⚠️ Parcial | CrearRegistro.gs, ActualizarRegistro.gs, Code.gs | Faltaba validación de nombre en servidor; corregida localmente | Publicar revisión |
| Proveedores/clientes y relaciones | ✅ Cumple | suppliers.js, customers.js, EliminarRegistro.gs | Restricciones implementadas y pruebas locales pasan | Verificar despliegue con prueba controlada |
| Cliente obligatorio para Debe | ✅ Cumple | sale-customer.js, VentasAbiertas.gs, CerrarVenta.gs | Validación en navegador y servidor | Conservar |
| Abiertas, retomar y cierre | ✅ Cumple | open-sales.js, close-sales.js | Cierre incierto solo se conserva en memoria; recargar pierde ese contexto | Mejorar recuperación del borrador de cierre; consultar Sheets antes de recrear |
| Stock y costo con confirmación | ✅ Cumple | CerrarVenta.gs, Compras.gs | Implementación atómica y reintentos probados en simulación | Prueba real autorizada aún pendiente |
| Compras: alta, lista y detalle | ✅ Cumple | purchases.js, compras.html | GET y formulario comprobados; no POST real | Verificar versión publicada y prueba controlada |
| Editar producto desde venta sin stock | ✅ Cumple | product-form.js | Cambios provisionales y reversión; snapshots cerrados independientes | Conservar |
| Historial nuevo desde Sheets | ✅ Cumple | remote-history.js | Fuente principal remota | Conservar |
| Migración del historial antiguo | ❌ Falta | Historial_de_ventas.js | Sigue como archivo local de solo lectura | Diseñar importación sin descontar stock otra vez; no borrar originales |
| Factura, impresión y PDF | ⚠️ Parcial | Historial_de_ventas.js, app.js | Impresión implementada, PDF mediante diálogo del navegador; PDF real no verificado | Prueba manual de impresión y Guardar como PDF |
| Responsive | ⚠️ Parcial | styles.css, historial.css, purchases.css | Compras revisada en tres anchos; falta recorrer todos los formularios/estados en cada tamaño | Completar matriz visual |
| Datos principales no hardcodeados | ✅ Cumple | index.html, products.js | productos.js antiguo no se carga; no es fuente activa | No borrarlo solo por limpieza |
| Separación sin reestructuración masiva | ✅ Cumple | api.js y módulos por responsabilidad | Se conserva app.js original | No reorganizar por estética |

## Prioridades
1. Errores críticos: proteger recuperación de resultados inciertos tras recarga en
   ventas; no volver a crear una venta antes de consultar si ya cerró. El error de
   categorías vacías se corrigió en esta etapa, pendiente de publicar.
2. MVP 2 faltante: importación del archivo histórico anterior. No usar el cierre
   normal para migrarlo, porque descontaría inventario otra vez.
3. Google Sheets: confirmar versión publicada, conservar servicio avanzado Sheets y
   hacer una prueba de escritura acordada. GET exitoso no demuestra las reglas de POST.
4. Inventario: verificar sobre datos de prueba autorizados compra, cierre, stock
   insuficiente y reintento. No cambiar manualmente hojas mientras escribe el POS.
5. Interfaz: PDF real y recorrido móvil/tablet de CRUD, abiertas, detalle e impresión.
6. Opcionales: limpieza de comentarios antiguos. No es necesaria una reorganización.

## Corrección de esta etapa: categorías
ARCHIVOS: CrearRegistro.gs, ActualizarRegistro.gs, ValidarCategoria.gs y la copia
unificada para-publicar/Code.gs. No se modificó HTML ni CSS.

PROBLEMA: el servicio aceptaba una categoría sin nombre aunque el formulario lo
impedía. Una solicitud directa podía guardar un registro que el catálogo luego rechaza.

SOLUCIÓN: validar antes de escribir, conservando el nombre en ediciones parciales.
CrearRegistro, fragmento anterior:
```js
if (nombre === "clientes") validarCliente(datos);
```
Fragmento corregido:
```js
if (nombre === "clientes") validarCliente(datos);
if (nombre === "categorias") validarCategoria(datos);
```
ActualizarRegistro, fragmento anterior:
```js
const actuales = rango.getValues()[0];
```
Fragmento corregido:
```js
const actuales = rango.getValues()[0];
if (nombre === "categorias") {
    const completo = {};
    encabezados.forEach(function (clave, i) { completo[clave] = actuales[i]; });
    validarCategoria(Object.assign(completo, datos));
}
```
Función nueva:
```js
function validarCategoria(datos) {
    if (!datos || typeof datos.nombre !== "string" || !datos.nombre.trim()) {
        throw new Error("La categoría debe tener un nombre no vacío.");
    }
}
```
Recibe el objeto de categoría, comprueba nombre de texto no vacío y no devuelve datos
(undefined); si es inválido lanza Error. No modifica ni recorta el nombre guardado.
CrearRegistro y ActualizarRegistro la invocan bajo el bloqueo existente de doPost,
antes de setValues. No necesita otro servicio ni nuevas columnas.

Pregunta de sustentación: ¿por qué validar dos veces, navegador y servidor?
El navegador informa de inmediato, pero puede omitirse al llamar directamente la API.
El servidor debe proteger la integridad del registro independientemente del cliente.

Prueba nueva categories-service.test.cjs: creación sin nombre/vacío/tipo incorrecto,
edición inválida sin escrituras, edición parcial que conserva nombre, edición válida
y eliminación bloqueada por productos. Pasan los 19 archivos de pruebas locales.
No se hicieron escrituras reales ni se publicó automáticamente.

## Avance posterior: recuperación de cierre
Corregida localmente la pérdida del intento al recargar: se conserva únicamente un
borrador de petición y se recupera con reintento explícito. Incluye pruebas de recarga,
almacenamiento fallido y borrador corrupto. Ver CAMBIOS_RECUPERACION_CIERRE.md.
La importación del archivo histórico y las verificaciones reales/visuales pendientes
de esta revisión no se consideran completadas por este cambio.

## Avance posterior: vista previa de migración
El historial ofrece revisión de solo lectura del archivo anterior contra ventas de
Sheets. Clasifica candidatos, problemas y posibles duplicados. No importa todavía,
no borra datos y no mueve stock. Ver CAMBIOS_PREVIA_MIGRACION.md. Pasan 20 pruebas locales.

## Avance posterior: servicio de importación
Implementada y probada en simulación la acción import de ventas históricas, sin
movimientos de inventario. Sigue pendiente publicar y conectar la confirmación desde
la vista previa, incluida conversión de fechas antiguas. No considerar la migración
terminada. Ver CAMBIOS_IMPORTACION_SERVICIO.md. Pasan 21 pruebas locales.
