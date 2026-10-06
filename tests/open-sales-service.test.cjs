// Pruebas del servicio completo con hojas simuladas; no escriben en Google Sheets.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const campos = ["id", "fecha", "estado", "clienteId", "metodoPago", "subtotal", "total",
    "valorRecibido", "cambio", "itemsJson", "actualizadoEn", "persona", "iva", "clienteNombre"];
let encabezados = [...campos], filas = [], escrituras = 0, lock = false;
const productos = [{id: "p-1", nombre: "Cuaderno", precio: 100, costo: 50, categoriaId: "cat-1", stock: 0, seguimientoInventario: true}];
const clientes = [{id: "c-1", nombre: "Ana"}];
const hoja = {
    getLastRow: () => filas.length + 1,
    getRange(n, c, alto, ancho) { return {
        getValues: () => [Array.from({length: ancho}, (_, i) => filas[n - 2]?.[c - 1 + i] ?? "")],
        getFormulas: () => [encabezados.map(() => "")],
        getCell: () => ({setNumberFormat() {assert.equal(lock, true);}}),
        setValues(datos) {assert.equal(lock, true); escrituras++; filas[n - 2] = [...datos[0]];}
    };}
};
const ctx = vm.createContext({LockService: {getScriptLock: () => ({
    waitLock() {lock = true;}, releaseLock() {lock = false;}
})}});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../google-apps-script/para-publicar/Code.gs"), "utf8"), ctx);
ctx.validarResource = () => "ventas";
ctx.responder = datos => datos;
ctx.obtenerHoja = recurso => {assert.equal(recurso, "ventas"); return hoja;};
ctx.leerEncabezados = () => encabezados;
ctx.encontrarFila = (h, id) => {
    const indice = filas.findIndex(f => f[0] === id);
    return indice === -1 ? -1 : indice + 2;
};
ctx.leerHoja = recurso => recurso === "productos" ? productos : clientes;
const enviar = (action, data) => ctx.doPost({postData: {contents: JSON.stringify({action, data})}});
const venta = {id: "v-1", estado: "abierta", persona: "Vendedor", metodoPago: "Debe", clienteId: "c-1",
    itemsJson: [{id: "p-1", cantidad: 2, precio: 1}], total: 1, iva: 0, clienteNombre: "Falso"};
const inventarioAntes = JSON.stringify(productos);
for (const cambio of [{estado: "cerrada"}, {persona: " "}, {clienteId: ""}, {clienteId: "no-existe"},
    {itemsJson: []}, {itemsJson: [{id: "p-1", cantidad: -1}]},
    {itemsJson: [{id: "p-1", cantidad: 1}, {id: "p-1", cantidad: 2}]},
    {itemsJson: [{id: "no-existe", cantidad: 1}]}]) {
    assert.equal(enviar("create", {...venta, ...cambio}).success, false);
    assert.equal(escrituras, 0);
    assert.equal(lock, false);
}
encabezados = campos.filter(c => c !== "persona");
assert.equal(enviar("create", venta).success, false);
encabezados = [...campos];
const creada = enviar("create", venta);
assert.equal(creada.success, true);
assert.equal(creada.data.total, 238);
assert.equal(creada.data.iva, 38);
assert.equal(creada.data.clienteNombre, "Ana");
assert.equal(creada.data.itemsJson[0].precio, 100);
assert.equal(creada.data.valorRecibido, "");
assert.equal(JSON.stringify(productos), inventarioAntes); // permite abierta aun sin stock
assert.equal(enviar("create", venta).success, false);
assert.equal(filas.length, 1);
assert.equal(enviar("update", venta).success, false); // falta versión leída
const actualizada = enviar("update", {...venta, actualizadoEn: creada.data.actualizadoEn,
    itemsJson: [{id: "p-1", cantidad: 3}]});
assert.equal(actualizada.success, true);
assert.equal(actualizada.data.total, 357);
assert.equal(actualizada.data.fecha, creada.data.fecha);
assert.notEqual(actualizada.data.actualizadoEn, creada.data.actualizadoEn);
assert.equal(enviar("update", {...venta, actualizadoEn: creada.data.actualizadoEn}).success, false);
const antesDeCerrar = escrituras;
filas[0][campos.indexOf("estado")] = "cerrada"; // simula un cierre hecho por otro flujo
assert.equal(enviar("update", {...venta, actualizadoEn: actualizada.data.actualizadoEn}).success, false);
assert.equal(escrituras, antesDeCerrar);
assert.equal(JSON.stringify(productos), inventarioAntes);
assert.equal(enviar("create", {...venta, id: "v-2", clienteId: "", metodoPago: "Efectivo"}).success, true);
assert.equal(lock, false);
console.log("PASS: ventas abiertas, precios del servidor, Debe, duplicados, conflictos, cerradas protegidas e inventario intacto.");
