# Etapa: servicio de importación histórica

## ARCHIVO: google-apps-script/Controladores.gs y para-publicar/Code.gs
UBICACIÓN: switch de doPost.
PROBLEMA: crearRegistro solo acepta ventas abiertas; cerrarVenta descuenta inventario.
Ninguna operación existente sirve para importar ventas antiguas ya realizadas.

CÓDIGO ANTERIOR, inicio del switch:
```js
switch (body.action) {
    case "close":
```
CÓDIGO CORREGIDO:
```js
switch (body.action) {
    case "import":
        if (resource !== "ventas") throw new Error("Solo se importan ventas históricas.");
        return responder({ success: true, data: importarVentaHistorica(body.data) });
    case "close":
```
El bloqueo y el formato de respuesta siguen siendo los existentes. Importar no es una
alternativa al cierre de ventas nuevas; solo se utilizará con el archivo histórico.

## ARCHIVO NUEVO: google-apps-script/ImportarVentaHistorica.gs
Las dos funciones están también incluidas en el Code.gs unificado.

importarVentaHistorica(datos): recibe {origenId, venta}. origenId es el ID antiguo como
texto, no un UUID nuevo por intento. La venta contiene fecha ISO UTC, trabajador,
clienteId/clienteNombre, método, subtotal, IVA, total, recibido/cambio y itemsJson.
Devuelve el registro confirmado con id, estado cerrada y actualizadoEn del servicio.
Rechaza campos desconocidos, relaciones de cliente inexistentes y conflictos.

El ID remoto es "mvp1-" + encodeURIComponent(origenId). Reenviar la misma operación
devuelve la venta existente; otros datos con el mismo origenId se rechazan sin
sobrescribir. Si ya existe el ID original sin prefijo se detiene para revisar duplicados.
IDs originales coincidentes entre archivos distintos también necesitan revisión: no
se fusionan automáticamente. Las coincidencias por contenido requieren revisión humana
en la vista previa; dos ventas legítimas pueden tener el mismo detalle.

validarVentaHistorica(venta): recibe los once campos históricos requeridos, valida y
devuelve una copia con campos en orden estable para comparar reintentos. Lanza Error
si fecha, detalle, cantidades, nombres, totales o efectivo son inconsistentes.
La fecha debe ser ISO completa con milisegundos/Z; aún falta convertir fecha/hora del
MVP 1 en la interfaz. No se interpreta una fecha local ambiguamente en el servidor.
Conserva IVA e importes originales; admite un centavo de diferencia en comprobaciones,
sin redondear ni recalcular el registro histórico. No inventa valores faltantes.

Los detalles mantienen los IDs/nombres/precios antiguos; no se buscan productos actuales
ni se crean productos o categorías para hacerlos coincidir. Son snapshots históricos,
no líneas editables de una venta abierta. Un cliente referenciado sí debe existir;
Debe exige cliente. Si no había cliente, clienteId y clienteNombre son textos vacíos.
Para no efectivo, valorRecibido/cambio son textos vacíos; para efectivo son números.

La única escritura es appendCells de una fila en ventas mediante Sheets.batchUpdate.
No contiene solicitudes de stock/costo ni llamadas a cerrarVenta. El auxiliar existente
validarColumnasCompra se reutiliza para comprobar encabezados (no escribe y sirve para
cualquier lista de columnas). No se renombró ni se reorganizaron módulos existentes.
IMPORTACION_INCIERTA indica que el lote podría haberse aplicado antes de perderse la
respuesta; el futuro cliente debe reintentar con el mismo origenId y datos.

## Sustentación
¿Por qué separar importación y cierre? El cierre representa una nueva venta y descuenta
stock; importar recupera un hecho pasado sin volver a registrar ese movimiento.
¿Por qué un ID determinista? Permite reconocer reintentos tras perder conexión sin
insertar otra fila. No depende de la hora actual ni de un UUID diferente cada vez.
¿Por qué conservar el precio antiguo? El catálogo de hoy no debe alterar comprobantes
del pasado. También se conserva la fecha original; actualizadoEn registra la importación.

## Publicación, pruebas y alcance
Publicar para-publicar/Code.gs como nueva versión de la implementación existente.
No cambiar columnas, URL, permisos ni volver a pegar el fragmento por separado.
ImportarVentaHistorica.gs ya está incluido en Code.gs.

Pasan los 21 archivos de pruebas locales. import-sales-service.test.cjs verifica:
una única inserción, ninguna lectura/escritura de productos, reintento idéntico,
conflicto de contenido, colisión con ID original, error antes/después del lote,
validaciones, efectivo, Debe con cliente y restricción al recurso ventas.
No se publicaron cambios automáticamente ni se importaron registros reales.
api.js y el botón de vista previa siguen siendo solo lectura para migración: falta
conversión del formato antiguo, revisión/confirmación y conexión de la interfaz.
