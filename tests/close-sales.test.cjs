// Cierre frontend con API simulada. No modifica hojas ni historial local.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
const venta = {id: "v-1", estado: "cerrada", fecha: "2026-09-29T12:00:00.000Z",
    persona: "Vendedor", clienteId: "c-1", clienteNombre: "Ana", metodoPago: "Efectivo",
    subtotal: 200, iva: 38, total: 238, valorRecibido: 300, cambio: 62,
    itemsJson: [{id: "p-1", nombre: "Cuaderno", cantidad: 2, precio: 100, subtotal: 200}]};
function preparar(memoria = new Map()) {
    const remoto = {id: "v-1", actualizadoEn: "2026-09-29T12:00:00.000Z", registros: [venta], ocupado: false, cierrePendiente: null};
    const estado = {facturaActual: [{id: "p-1", cantidad: 2}], productosDisponibles: [{id: "p-1", nombre: "Cuaderno", precio: 100, stock: 5}]};
    const llamadas = [], comprobantes = [];
    const ctx = vm.createContext({ventasAbiertasEstado: remoto, estado,
        localStorage: {getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k)},
        trabajador: {value: "Vendedor"}, clienteVenta: {value: "c-1"}, metodoPago: {value: "efectivo"}, dineroRecibido: {value: "300"},
        document: {querySelector: () => ({addEventListener() {}})}, mensajeAbiertas: {textContent: ""},
        mostrarToast() {}, comprobarDisponibilidadAbiertas: () => !remoto.ocupado,
        validarVenta: () => true, bloquearAbiertas: ocupado => {remoto.ocupado = ocupado;},
        limpiarReferenciaAbierta() {remoto.id = null; remoto.actualizadoEn = null;},
        renderVentasAbiertas() {}, renderProductos() {}, normalizarProductos: productos => productos,
        mostrarFacturaConfirmada(v) {comprobantes.push(v); estado.facturaActual = [];},
        api: {guardar: async (recurso, accion, datos) => {llamadas.push({recurso, accion, datos}); return {...venta};},
            listar: async recurso => recurso === "productos" ? [{id: "p-1", nombre: "Cuaderno", precio: 100, stock: 3}] : []}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../sales-data.js"), "utf8"), ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../close-sales.js"), "utf8"), ctx);
    remoto.firmaGuardada = ctx.firmaVentaActual();
    return {ctx, remoto, estado, llamadas, comprobantes, memoria};
}
(async () => {
    let t = preparar();
    t.estado.facturaActual[0].cantidad = 3;
    await t.ctx.cerrarVentaRemota();
    assert.equal(t.llamadas.length, 0);
    assert.match(t.ctx.mensajeAbiertas.textContent, /Guarda la venta/);
    t = preparar();
    let resolver;
    t.ctx.api.guardar = async (r, a, d) => {
        t.llamadas.push(d); return new Promise(r => {resolver = r;});
    };
    const cierre = t.ctx.cerrarVentaRemota();
    await t.ctx.cerrarVentaRemota();
    assert.equal(t.llamadas.length, 1);
    assert.equal(t.estado.facturaActual.length, 1);
    assert.equal(t.estado.productosDisponibles[0].stock, 5);
    resolver(venta); await cierre;
    assert.equal(t.comprobantes.length, 1);
    assert.equal(t.comprobantes[0].dineroRecibido, 300);
    assert.equal(t.comprobantes[0].cambio, 62);
    assert.equal(t.estado.productosDisponibles[0].stock, 3);
    assert.equal(t.remoto.id, null);
    t = preparar();
    t.ctx.api.guardar = async () => {const e = new Error("Stock insuficiente: Cuaderno"); e.codigo = "RECHAZADO"; throw e;};
    await t.ctx.cerrarVentaRemota();
    assert.equal(t.remoto.cierrePendiente, null);
    assert.equal(t.estado.facturaActual.length, 1);
    assert.equal(t.estado.productosDisponibles[0].stock, 5);
    assert.match(t.ctx.mensajeAbiertas.textContent, /Stock insuficiente/);
    t = preparar();
    t.ctx.api.guardar = async () => {throw new Error("Respuesta perdida");};
    await t.ctx.cerrarVentaRemota();
    const pendiente = JSON.stringify(t.remoto.cierrePendiente);
    assert.equal(t.memoria.size, 1);
    const recargado = preparar(t.memoria);
    recargado.estado.facturaActual = [];
    assert.equal(recargado.ctx.recuperarCierrePendiente(), true);
    assert.equal(recargado.llamadas.length, 0); // no POST automático al recargar
    assert.equal(JSON.stringify(recargado.remoto.cierrePendiente), pendiente);
    await recargado.ctx.cerrarVentaRemota();
    assert.equal(recargado.comprobantes.length, 1);
    assert.equal(recargado.memoria.size, 0);
    assert.equal(t.comprobantes.length, 0);
    t.ctx.dineroRecibido.value = "500"; // el reintento debe conservar el pago original
    t.ctx.api.guardar = async (r, a, datos) => {assert.equal(JSON.stringify(datos), pendiente); return venta;};
    await t.ctx.cerrarVentaRemota();
    assert.equal(t.comprobantes.length, 1);
    t = preparar();
    t.ctx.api.listar = async () => {throw new Error("Fallo GET");};
    await t.ctx.cerrarVentaRemota();
    assert.equal(t.comprobantes.length, 1);
    assert.equal(t.remoto.cierrePendiente, null);
    assert.match(t.ctx.mensajeAbiertas.textContent, /SÍ quedó cerrada/);
    assert.equal(t.estado.productosDisponibles[0].stock, 5); // no resta inventada
    t = preparar();
    t.ctx.api.guardar = async () => ({...venta, id: "otra"});
    await t.ctx.cerrarVentaRemota();
    assert.ok(t.remoto.cierrePendiente);
    assert.equal(t.comprobantes.length, 0);
    assert.throws(() => t.ctx.adaptarVentaCerrada({...venta, itemsJson: []}));
    t = preparar();
    t.ctx.localStorage.setItem = () => {throw new Error("Sin espacio");};
    await t.ctx.cerrarVentaRemota(); assert.equal(t.llamadas.length, 0);
    assert.match(t.ctx.mensajeAbiertas.textContent, /No se envió/);
    t = preparar(new Map([["papelLuna.cierrePendiente.v1", "JSON roto"]]));
    assert.equal(t.ctx.recuperarCierrePendiente(), true);
    assert.equal(t.remoto.recuperacionBloqueada, true);
    await t.ctx.cerrarVentaRemota(); assert.equal(t.llamadas.length, 0);
    assert.equal(t.memoria.size, 1); // no se borra información para desbloquear
    t = preparar();
    t.ctx.localStorage.removeItem = () => {throw new Error("No se puede borrar");};
    await t.ctx.cerrarVentaRemota();
    assert.ok(t.remoto.cierrePendiente); assert.equal(t.memoria.size, 1);
    assert.match(t.ctx.mensajeAbiertas.textContent, /confirmado/);
    console.log("PASS: cierre confirmado, comprobante, stock remoto, errores, doble clic y reintento con pago inmutable.");
})().catch(e => {console.error(e); process.exitCode = 1;});
