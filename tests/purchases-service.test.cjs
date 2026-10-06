// Pruebas aisladas: no realizan peticiones ni cambian la hoja real.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
let compras, productos, proveedores, lotes, bloqueado, fallo, columnasCompra;
const camposProductos = ["id", "nombre", "costo", "stock", "seguimientoInventario"];
const hojaCompras = {getSheetId: () => 10, getParent: () => ({getId: () => "prueba"})};
const hojaProductos = {getSheetId: () => 20};
const clonar = x => JSON.parse(JSON.stringify(x));
function reiniciar() {
    compras = []; proveedores = [{id: "proveedor-1"}];
    productos = [{id: "p-1", nombre: "Cuaderno", costo: 5, stock: 4, seguimientoInventario: true},
        {id: "p-2", nombre: "Servicio", costo: 2, stock: 7, seguimientoInventario: false}];
    columnasCompra = ["id", "fecha", "proveedorId", "total", "itemsJson"];
    lotes = 0; bloqueado = false; fallo = "";
}
const servicio = {Spreadsheets: {batchUpdate(cuerpo, id) {
    assert.equal(bloqueado, true); assert.equal(id, "prueba");
    // Simula aplicar todo o nada: solo confirma las copias al terminar las solicitudes.
    const nuevasCompras = clonar(compras), nuevosProductos = clonar(productos);
    for (const solicitud of cuerpo.requests) {
        if (solicitud.updateCells) {
            const {range, rows, fields} = solicitud.updateCells;
            assert.equal(fields, "userEnteredValue"); assert.equal(range.sheetId, 20);
            const valor = rows[0].values[0].userEnteredValue;
            nuevosProductos[range.startRowIndex - 1][camposProductos[range.startColumnIndex]] = valor.numberValue ?? valor.stringValue;
        } else {
            const {sheetId, rows, fields} = solicitud.appendCells;
            assert.equal(sheetId, 10); assert.equal(fields, "userEnteredValue");
            const registro = {};
            rows[0].values.forEach((c, i) => {registro[columnasCompra[i]] = c.userEnteredValue.numberValue ?? c.userEnteredValue.stringValue;});
            registro.itemsJson = JSON.parse(registro.itemsJson);
            nuevasCompras.push(registro);
        }
    }
    if (fallo === "antes") throw new Error("Lote rechazado");
    compras = nuevasCompras; productos = nuevosProductos; lotes++;
    if (fallo === "despues") throw new Error("Respuesta perdida");
    return {replies: cuerpo.requests.map(() => ({}))};
}}};
const ctx = vm.createContext({Sheets: servicio, LockService: {getScriptLock: () => ({
    waitLock() {bloqueado = true;}, releaseLock() {bloqueado = false;}
})}});
const integrado = fs.readFileSync(path.join(__dirname, "../google-apps-script/para-publicar/Code.gs"), "utf8");
assert.ok(integrado.includes(fs.readFileSync(path.join(__dirname, "../google-apps-script/Compras.gs"), "utf8").trim()));
vm.runInContext(integrado, ctx);
ctx.validarResource = () => "compras"; ctx.responder = x => x;
ctx.leerHoja = r => clonar(r === "compras" ? compras : r === "productos" ? productos : proveedores);
ctx.obtenerHoja = r => r === "compras" ? hojaCompras : hojaProductos;
ctx.leerEncabezados = h => h === hojaCompras ? columnasCompra : camposProductos;
ctx.encontrarFila = (h, id) => productos.findIndex(p => p.id === id) + 2;
const datos = () => ({id: "compra-1", fecha: "2026-09-29", proveedorId: "proveedor-1", total: 29,
    itemsJson: [{id: "p-1", cantidad: 2, costo: 10}, {id: "p-2", cantidad: 3, costo: 3}]});
const enviar = (d = datos(), action = "create") => ctx.doPost({postData: {contents: JSON.stringify({action, data: d})}});
reiniciar();
assert.equal(enviar().success, true);
assert.equal(compras.length, 1); assert.equal(compras[0].total, 29);
assert.equal(compras[0].itemsJson[0].nombre, "Cuaderno");
assert.equal(productos[0].stock, 6); assert.equal(productos[0].costo, 10);
assert.equal(productos[1].stock, 7); assert.equal(productos[1].costo, 3);
assert.equal(bloqueado, false); assert.equal(lotes, 1);
assert.equal(enviar().success, true); assert.equal(lotes, 1); // doble envío
assert.equal(enviar({...datos(), fecha: "2026-09-28"}).success, false);
productos = []; proveedores = []; // reintento después de cambios en catálogo
assert.equal(enviar().success, true); assert.equal(lotes, 1);
reiniciar(); fallo = "despues";
assert.equal(enviar().codigo, "COMPRA_INCIERTA"); assert.equal(productos[0].stock, 6);
fallo = ""; assert.equal(enviar().success, true); assert.equal(lotes, 1);
reiniciar(); fallo = "antes";
assert.equal(enviar().codigo, "COMPRA_INCIERTA"); assert.equal(compras.length, 0);
assert.equal(productos[0].stock, 4); assert.equal(productos[0].costo, 5); assert.equal(lotes, 0);
assert.equal(bloqueado, false);
const invalidos = [
    d => {d.fecha = "2026-02-30";}, d => {d.proveedorId = "ausente";},
    d => {d.itemsJson = [];}, d => {d.itemsJson[0].id = "ausente";},
    d => {d.itemsJson[0].cantidad = 0;}, d => {d.itemsJson[0].cantidad = 1.5;},
    d => {d.itemsJson[0].costo = -1;}, d => {d.itemsJson[0].costo = "10";},
    d => {d.itemsJson[0].costo = 1e308;}, d => {d.total = 1;},
    d => {d.itemsJson[1].id = "p-1";}, d => {d.stock = 100;}
];
for (const modificar of invalidos) {
    reiniciar(); const d = datos(); modificar(d);
    const respuesta = enviar(d);
    assert.equal(respuesta.success, false, JSON.stringify(d)); assert.equal(respuesta.codigo, "RECHAZADO");
    assert.equal(lotes, 0); assert.equal(compras.length, 0); assert.equal(bloqueado, false);
}
reiniciar(); productos[0].stock = Number.MAX_SAFE_INTEGER;
assert.match(enviar().message, /Stock inválido/); assert.equal(lotes, 0);
reiniciar(); productos[0].seguimientoInventario = "quizás";
assert.match(enviar().message, /Seguimiento inválido/); assert.equal(lotes, 0);
reiniciar(); columnasCompra.push("id");
assert.match(enviar().message, /encabezados/); assert.equal(lotes, 0);
reiniciar(); assert.equal(enviar(datos(), "update").success, false);
assert.equal(enviar(datos(), "delete").success, false); assert.equal(lotes, 0);
reiniciar(); enviar();
const segunda = datos(); segunda.id = "compra-2"; segunda.fecha = "2026-09-01";
segunda.itemsJson[0].costo = 0; segunda.total = 9;
assert.equal(enviar(segunda).success, true);
assert.equal(productos[0].stock, 8); assert.equal(productos[0].costo, 0);
assert.equal(compras[0].itemsJson[0].costo, 10); // snapshot histórico inalterado
reiniciar(); delete ctx.Sheets;
assert.match(enviar().message, /Activa Google Sheets API/); assert.equal(lotes, 0);
console.log("PASS: compras atómicas, proveedor/fecha/detalle, stock/costo, snapshots y reintentos sin duplicación.");
