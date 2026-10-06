// Code.gs integrado, servicio simulado: ninguna petición ni escritura real.
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
const columnas = ["id", "fecha", "estado", "clienteId", "metodoPago", "subtotal", "total", "valorRecibido", "cambio", "itemsJson", "actualizadoEn", "persona", "iva", "clienteNombre"];
let ventas, clientes, lotes, fallo, bloqueado, recurso;
const clonar = x => JSON.parse(JSON.stringify(x));
const hoja = {getSheetId: () => 10, getParent: () => ({getId: () => "prueba"})};
function reiniciar() {ventas = []; clientes = [{id: "c-1"}]; lotes = 0; fallo = ""; bloqueado = false; recurso = "ventas";}
const ctx = vm.createContext({LockService: {getScriptLock: () => ({waitLock() {bloqueado = true;}, releaseLock() {bloqueado = false;}})},
    Sheets: {Spreadsheets: {batchUpdate(cuerpo, id) {
        assert.equal(bloqueado, true); assert.equal(id, "prueba");
        assert.equal(cuerpo.requests.length, 1); // ninguna petición a inventario
        const append = cuerpo.requests[0].appendCells; assert.equal(append.sheetId, 10);
        assert.equal(append.fields, "userEnteredValue");
        if (fallo === "antes") throw new Error("No aplicado");
        const registro = {};
        append.rows[0].values.forEach((v, i) => {registro[columnas[i]] = v.userEnteredValue.numberValue ?? v.userEnteredValue.stringValue;});
        registro.itemsJson = JSON.parse(registro.itemsJson); ventas.push(registro); lotes++;
        if (fallo === "despues") throw new Error("Respuesta perdida");
        return {};
    }}}});
const integrado = fs.readFileSync(path.join(__dirname, "../google-apps-script/para-publicar/Code.gs"), "utf8");
assert.ok(integrado.includes(fs.readFileSync(path.join(__dirname, "../google-apps-script/ImportarVentaHistorica.gs"), "utf8").trim()));
vm.runInContext(integrado, ctx);
ctx.responder = v => v; ctx.validarResource = () => recurso;
ctx.leerHoja = nombre => {
    assert.ok(["ventas", "clientes"].includes(nombre), "No debe leer el catálogo actual");
    return clonar(nombre === "ventas" ? ventas : clientes);
};
ctx.obtenerHoja = nombre => {assert.equal(nombre, "ventas"); return hoja;};
ctx.leerEncabezados = () => columnas;
const datos = () => ({origenId: "123", venta: {fecha: "2026-09-22T20:16:00.000Z", persona: "Ana", clienteId: "", clienteNombre: "",
    metodoPago: "Nequi", subtotal: 100, iva: 19, total: 119, valorRecibido: "", cambio: "",
    itemsJson: [{id: "producto-antiguo", nombre: "Nombre de antes", precio: 50, cantidad: 2, subtotal: 100}]}});
const enviar = (d = datos()) => ctx.doPost({postData: {contents: JSON.stringify({action: "import", data: d})}});
reiniciar(); const original = JSON.stringify(datos());
assert.equal(enviar().success, true); assert.equal(lotes, 1); assert.equal(ventas[0].id, "mvp1-123");
assert.equal(ventas[0].estado, "cerrada"); assert.equal(ventas[0].fecha, datos().venta.fecha);
assert.equal(ventas[0].itemsJson[0].nombre, "Nombre de antes");
assert.equal(enviar().success, true); assert.equal(lotes, 1); assert.equal(bloqueado, false);
const alterado = datos(); alterado.venta.persona = "Otra";
assert.equal(enviar(alterado).success, false); assert.equal(lotes, 1);
assert.equal(JSON.stringify(datos()), original);
reiniciar(); fallo = "antes"; assert.equal(enviar().codigo, "IMPORTACION_INCIERTA"); assert.equal(lotes, 0);
reiniciar(); fallo = "despues"; assert.equal(enviar().codigo, "IMPORTACION_INCIERTA"); assert.equal(lotes, 1);
fallo = ""; assert.equal(enviar().success, true); assert.equal(lotes, 1);
reiniciar(); ventas = [{id: "123", estado: "cerrada"}]; assert.match(enviar().message, /ID original/); assert.equal(lotes, 0);
for (const modificar of [d => {d.venta.fecha = "22/09/2026";}, d => {d.venta.total = 0;}, d => {d.venta.persona = "";},
    d => {d.venta.metodoPago = "Debe";}, d => {d.venta.metodoPago = "Efectivo";}, d => {d.venta.itemsJson = [];},
    d => {d.venta.itemsJson[0].cantidad = -1;}, d => {d.venta.itemsJson[0].subtotal = 5;},
    d => {d.venta.itemsJson[0].precio = "50";}, d => {d.venta.itemsJson.push(d.venta.itemsJson[0]);},
    d => {d.venta.stock = 40;}, d => {d.venta.estado = "abierta";}, d => {d.origenId = " ";}]) {
    reiniciar(); const d = datos(); modificar(d); assert.equal(enviar(d).codigo, "RECHAZADO"); assert.equal(lotes, 0); assert.equal(bloqueado, false);
}
reiniciar(); const debe = datos(); Object.assign(debe.venta, {metodoPago: "Debe", clienteId: "c-1", clienteNombre: "Nombre histórico"});
assert.equal(enviar(debe).success, true); clientes = []; assert.equal(enviar(debe).success, true); assert.equal(lotes, 1);
reiniciar(); clientes = []; assert.equal(enviar(debe).success, false); assert.equal(lotes, 0);
reiniciar(); const efectivo = datos(); Object.assign(efectivo.venta, {metodoPago: "Efectivo", valorRecibido: 120, cambio: 1});
assert.equal(enviar(efectivo).success, true);
reiniciar(); recurso = "compras"; assert.equal(enviar().success, false); assert.equal(lotes, 0);
reiniciar(); delete ctx.Sheets; assert.match(enviar().message, /Activa Google Sheets API/);
console.log("PASS: importación histórica, snapshots, validación, reintentos y cero operaciones sobre inventario.");
