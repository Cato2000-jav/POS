const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const funciones = source.slice(source.indexOf("const iniciarFactura ="), source.indexOf("const validarVenta ="));
function entorno() {
    let resolver, confirmaciones = 0, limpiezas = 0;
    const estado = {facturaActual: [{id: "p-1", cantidad: 1}], facturaIniciada: true, ultimaVenta: null};
    const remoto = {ocupado: false, cierrePendiente: null, recuperacionBloqueada: false, id: "v-1"};
    const ctx = vm.createContext({estado, ventasAbiertasEstado: remoto,
        confirmarAccion: () => {confirmaciones++; return new Promise(r => {resolver = r;});},
        limpiarReferenciaAbierta: () => {limpiezas++; remoto.id = null;},
        panelFactura: {}, contenidoPrincipal: {classList: {remove() {}}}, buscador: {},
        limpiarFormularioFactura() {}, mostrarVentaPendiente() {}, renderProductos() {}, renderFactura() {}, mostrarToast() {}
    });
    vm.runInContext(funciones, ctx);
    return {estado, remoto, ejecutar: nombre => vm.runInContext(nombre + "()", ctx),
        responder: valor => resolver(valor), confirmaciones: () => confirmaciones, limpiezas: () => limpiezas};
}
(async () => {
    for (const nombre of ["iniciarFactura", "cancelarFactura"]) {
        for (const campo of ["ocupado", "cierrePendiente", "recuperacionBloqueada"]) {
            const t = entorno(), original = JSON.stringify(t.estado);
            const operacion = t.ejecutar(nombre);
            t.remoto[campo] = campo === "cierrePendiente" ? {id: "v-1"} : true;
            t.responder(true); await operacion;
            assert.equal(JSON.stringify(t.estado), original);
            assert.equal(t.remoto.id, "v-1"); assert.equal(t.limpiezas(), 0);
            await t.ejecutar(nombre); assert.equal(t.confirmaciones(), 1);
        }
        let t = entorno(), operacion = t.ejecutar(nombre);
        t.responder(false); await operacion;
        assert.equal(t.estado.facturaActual.length, 1); assert.equal(t.limpiezas(), 0);
        t = entorno(); operacion = t.ejecutar(nombre);
        t.responder(true); await operacion;
        assert.equal(t.estado.facturaActual.length, 0); assert.equal(t.limpiezas(), 1);
    }
    console.log("PASS: nueva/cancelar factura revalidan bloqueos después del diálogo sin perder carrito ni referencia.");
})().catch(error => {console.error(error); process.exitCode = 1;});
