// Simula la operación atómica de Sheets; no escribe en el servicio real.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
let ventas, productos, clientes, lotes, bloqueado, fallo;
const columnasVentas = ["id", "estado", "valorRecibido", "cambio", "actualizadoEn", "iva", "subtotal", "total"];
const columnasProductos = ["id", "stock"];
const hojaVentas = {getSheetId: () => 10, getParent: () => ({getId: () => "hoja-prueba"})};
const hojaProductos = {getSheetId: () => 20};
function reiniciar() {
    productos = [{id: "p-1", nombre: "Cuaderno", stock: 5, seguimientoInventario: true},
        {id: "p-2", nombre: "Servicio", stock: 0, seguimientoInventario: false}];
    clientes = [{id: "c-1"}];
    ventas = [{id: "v-1", estado: "abierta", persona: "Vendedor", clienteId: "c-1", metodoPago: "Efectivo",
        subtotal: 210, iva: 39.9, total: 249.9, actualizadoEn: "2026-09-29T12:00:00.000Z",
        itemsJson: [{id: "p-1", cantidad: 2, precio: 100, subtotal: 200},
            {id: "p-2", cantidad: 1, precio: 10, subtotal: 10}]}];
    lotes = 0; bloqueado = false; fallo = "";
}
const ctx = vm.createContext({LockService: {getScriptLock: () => ({
    waitLock() {bloqueado = true;}, releaseLock() {bloqueado = false;}
})}, Sheets: {Spreadsheets: {batchUpdate(cuerpo, id) {
    assert.equal(bloqueado, true);
    assert.equal(id, "hoja-prueba");
    if (fallo === "antes") throw new Error("Lote rechazado");
    lotes++;
    for (const solicitud of cuerpo.requests) {
        const {range, rows} = solicitud.updateCells;
        const esVenta = range.sheetId === 10;
        const registro = (esVenta ? ventas : productos)[range.startRowIndex - 1];
        const campo = (esVenta ? columnasVentas : columnasProductos)[range.startColumnIndex];
        const valor = rows[0].values[0].userEnteredValue;
        registro[campo] = valor.numberValue ?? valor.stringValue;
    }
    if (fallo === "despues") throw new Error("Respuesta perdida tras aplicar el lote");
    return {replies: cuerpo.requests.map(() => ({}))};
}}}});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../google-apps-script/para-publicar/Code.gs"), "utf8"), ctx);
ctx.validarResource = () => "ventas";
ctx.responder = x => x;
ctx.leerHoja = r => JSON.parse(JSON.stringify(r === "ventas" ? ventas : r === "productos" ? productos : clientes));
ctx.obtenerHoja = r => r === "ventas" ? hojaVentas : hojaProductos;
ctx.leerEncabezados = h => h === hojaVentas ? columnasVentas : columnasProductos;
ctx.encontrarFila = (h, id) => {
    const i = (h === hojaVentas ? ventas : productos).findIndex(r => r.id === id);
    return i < 0 ? -1 : i + 2;
};
const solicitud = () => ({id: "v-1", actualizadoEn: "2026-09-29T12:00:00.000Z", valorRecibido: 300});
const cerrar = datos => ctx.doPost({postData: {contents: JSON.stringify({action: "close", data: datos || solicitud()})}});
reiniciar();
const respuesta = cerrar();
assert.equal(respuesta.success, true);
assert.equal(ventas[0].estado, "cerrada");
assert.equal(productos[0].stock, 3);
assert.equal(productos[1].stock, 0);
assert.equal(lotes, 1);
assert.equal(cerrar().success, true); // reintento no duplica stock
assert.equal(lotes, 1);
assert.equal(bloqueado, false);
reiniciar(); productos[0].stock = 1;
assert.match(cerrar().message, /Stock insuficiente para Cuaderno/);
assert.equal(cerrar().codigo, "RECHAZADO");
assert.equal(lotes, 0); assert.equal(ventas[0].estado, "abierta");
reiniciar(); assert.equal(cerrar({...solicitud(), valorRecibido: 200}).success, false);
assert.equal(lotes, 0);
reiniciar(); assert.equal(cerrar({...solicitud(), actualizadoEn: "antigua"}).success, false);
assert.equal(lotes, 0);
reiniciar(); ventas[0].metodoPago = "Debe"; ventas[0].clienteId = "";
assert.match(cerrar({...solicitud(), valorRecibido: null}).message, /requiere cliente/);
reiniciar(); ventas[0].metodoPago = "Debe";
assert.equal(cerrar({...solicitud(), valorRecibido: null}).success, true);
assert.equal(ventas[0].cambio, "");
reiniciar(); fallo = "antes";
assert.equal(cerrar().success, false); assert.equal(lotes, 0);
assert.equal(cerrar().codigo, "CIERRE_INCIERTO");
assert.equal(productos[0].stock, 5); assert.equal(ventas[0].estado, "abierta");
reiniciar(); fallo = "despues";
assert.equal(cerrar().success, false); assert.equal(productos[0].stock, 3);
fallo = ""; assert.equal(cerrar().success, true); assert.equal(lotes, 1);
reiniciar(); ventas[0].total = 1;
assert.equal(cerrar().success, false); assert.equal(lotes, 0);
reiniciar(); productos[0].seguimientoInventario = "FALSE";
assert.equal(cerrar().success, true); assert.equal(productos[0].stock, 5);
reiniciar(); delete ctx.Sheets;
assert.match(cerrar().message, /Activa Google Sheets API/);
assert.equal(lotes, 0);
console.log("PASS: cierre atómico, stock, Debe, efectivo, conflictos, errores y reintento sin doble descuento.");
