const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
const anterior = {id: 123, fecha: "22/09/2026", hora: "3:16 p. m.", persona: "Ana", metodoPago: "Nequi",
    subtotal: 100, iva: 19, total: 119, productos: [{id: 1, nombre: "Cuaderno", cantidad: 2, precio: 50, subtotal: 100}]};
function preparar(memoria = new Map()) {
    const nodos = new Map(); let llamadas = 0, aceptar = true, respuesta;
    const nodo = id => {if (!nodos.has(id)) nodos.set(id, {textContent: "", disabled: false, hidden: false, addEventListener() {}, replaceChildren() {}}); return nodos.get(id);};
    const ctx = vm.createContext({Date, document: {querySelector: nodo, querySelectorAll: () => []},
        window: {confirm: () => aceptar}, localStorage: {getItem: k => memoria.get(k) ?? null, setItem: (k,v) => memoria.set(k,v), removeItem: k => memoria.delete(k)},
        api: {guardar: async (recurso, accion, d) => {llamadas++; assert.equal(recurso, "ventas"); assert.equal(accion, "importar");
            if (respuesta) return respuesta(d);
            return {...d.venta, id: "mvp1-" + encodeURIComponent(d.origenId), estado: "cerrada"};}}
    });
    for (const archivo of ["migration-preview.js", "migration-import.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), ctx);
    return {ctx, memoria, nodo, llamadas: () => llamadas, aceptar: v => {aceptar = v;}, responder: f => {respuesta = f;}, estado: () => vm.runInContext("importacionEstado", ctx)};
}
(async () => {
    let t = preparar(); const convertir = t.ctx.convertirFechaHistorica;
    assert.equal(convertir("22/09/2026", "3:16 p. m."), "2026-09-22T20:16:00.000Z");
    assert.equal(convertir("22/09/2026", "12:00 a. m."), "2026-09-22T05:00:00.000Z");
    assert.equal(convertir("22/09/2026", "12:00 p. m."), "2026-09-22T17:00:00.000Z");
    assert.equal(convertir("29/02/2024", "23:59:30"), "2024-03-01T04:59:30.000Z");
    for (const [d,h] of [["29/02/2025","10:00"],["2026-09-22","10:00"],["22/09/2026","13:00pm"],["22/09/2026","24:00"],["22/09/1990","10:00"],["22/09/2026","10:90"]]) assert.throws(() => convertir(d,h));
    const original = JSON.stringify(anterior); const datos = t.ctx.convertirVentaAnterior(anterior);
    assert.equal(datos.venta.itemsJson[0].id, "1"); assert.equal(datos.venta.valorRecibido, ""); assert.equal(JSON.stringify(anterior), original);
    assert.throws(() => t.ctx.convertirVentaAnterior({...anterior, metodoPago: "Efectivo"}));
    assert.throws(() => t.ctx.convertirVentaAnterior({...anterior, productos: [{...anterior.productos[0], id: null}]}));
    t.aceptar(false); await t.ctx.importarVentaAnterior(datos); assert.equal(t.llamadas(), 0); assert.equal(t.memoria.size, 0);
    t.aceptar(true); let resolver;
    t.responder(d => new Promise(r => {resolver = () => r({...d.venta, id: "mvp1-123", estado: "cerrada"});}));
    const envio = t.ctx.importarVentaAnterior(datos); await t.ctx.importarVentaAnterior(datos);
    assert.equal(t.llamadas(), 1); assert.equal(t.memoria.size, 1); resolver(); await envio;
    assert.equal(t.memoria.size, 0); assert.match(t.nodo("#estadoImportacion").textContent, /confirmada/);
    t = preparar(); t.responder(() => {throw new Error("Respuesta perdida");});
    await t.ctx.importarVentaAnterior(datos); assert.equal(t.memoria.size, 1);
    const recarga = preparar(t.memoria); assert.equal(recarga.llamadas(), 0); assert.ok(recarga.estado().pendiente);
    await recarga.ctx.importarVentaAnterior(); assert.equal(recarga.llamadas(), 1); assert.equal(recarga.memoria.size, 0);
    t = preparar(); t.responder(() => {throw Object.assign(new Error("Datos inválidos"), {codigo: "RECHAZADO"});});
    await t.ctx.importarVentaAnterior(datos); assert.equal(t.memoria.size, 0); assert.equal(t.estado().pendiente, null);
    t = preparar(); t.ctx.localStorage.setItem = () => {throw new Error("Sin espacio");};
    await t.ctx.importarVentaAnterior(datos); assert.equal(t.llamadas(), 0);
    t = preparar(new Map([["papelLuna.importacionPendiente.v1", "roto"]])); assert.equal(t.estado().bloqueado, true);
    await t.ctx.importarVentaAnterior(datos); assert.equal(t.llamadas(), 0); assert.equal(t.memoria.size, 1);
    t = preparar(); t.responder(d => ({...d.venta, id: "mvp1-123", estado: "cerrada", total: 1}));
    await t.ctx.importarVentaAnterior(datos); assert.ok(t.estado().pendiente);
    console.log("PASS: conversión Bogotá, fechas inválidas, confirmación, importación, doble clic, reintento recuperable y datos originales intactos.");
})().catch(error => {console.error(error); process.exitCode = 1;});
