const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
class Elemento {
    constructor() {this.value = ""; this.children = []; this.disabled = false; this.hidden = false; this.textContent = ""; this.events = {};}
    append(...n) {this.children.push(...n);} replaceChildren(...n) {this.children = n;}
    setAttribute() {} addEventListener(nombre, f) {this.events[nombre] = f;}
}
const codigo = fs.readFileSync(path.join(__dirname, "../purchases.js"), "utf8");
function entorno(borrador) {
    const elementos = {}, memoria = new Map(); if (borrador) memoria.set("papelLuna.compraPendiente.v1", borrador);
    const e = id => elementos[id] ||= new Elemento();
    let enviados = 0, resolver, fallo, falloLectura = false;
    const ctx = vm.createContext({document: {getElementById: e, createElement: () => new Elemento()}, Intl, Date, crypto: {randomUUID: () => "c-1"},
        localStorage: {getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k)},
        api: {listar: async recurso => {
            if (falloLectura) throw new Error("Sin conexión");
            return recurso === "compras" ? [] : recurso === "productos" ? [{id: "p-1", nombre: "Cuaderno", costo: 4}] : [{id: "s-1", nombre: "Proveedor"}];
        }, guardar: async (recurso, accion, datos) => {
            enviados++; assert.equal(recurso, "compras"); assert.equal(accion, "crear");
            if (fallo) throw fallo;
            if (resolver === "esperar") await new Promise(r => {resolver = r;});
            return {...datos, itemsJson: datos.itemsJson.map(i => ({...i, nombre: "Cuaderno", subtotal: i.cantidad * i.costo}))};
        }}
    });
    vm.runInContext(codigo, ctx);
    return {ctx, e, memoria, ejecutar: s => vm.runInContext(s, ctx), enviados: () => enviados,
        fallar: error => {fallo = error;}, fallarLectura: () => {falloLectura = true;}, esperar: () => {resolver = "esperar";}, resolver: () => resolver()};
}
const tick = () => new Promise(r => setImmediate(r));
function preparar(t) {
    t.e("compraProveedor").value = "s-1"; t.e("compraFecha").value = "2026-10-01";
    t.ejecutar('comprasEstado.items = [{id:"p-1", nombre:"Cuaderno", cantidad:2, costo:4}]');
}
(async () => {
    let t = entorno(); await tick(); preparar(t);
    assert.equal(t.ejecutar("totalItemsCompra(comprasEstado.items)"), 8);
    t.esperar(); const primero = t.ctx.guardarCompraFormulario();
    assert.equal(t.e("camposCompra").disabled, true);
    await t.ctx.guardarCompraFormulario(); assert.equal(t.enviados(), 1);
    t.resolver(); await primero;
    assert.equal(t.memoria.size, 0); assert.equal(t.ejecutar("comprasEstado.registros.length"), 1);
    t.e("listaCompras").children[0].children[0].events.click();
    assert.equal(t.e("detalleCompra").hidden, false);
    assert.match(t.e("detalleCompra").children[1].textContent, /Cuaderno: 2/);
    assert.equal(t.ejecutar("comprasEstado.cargado"), false); // exige catálogo fresco
    t = entorno(); await tick(); preparar(t);
    t.fallar(new Error("Respuesta perdida")); await t.ctx.guardarCompraFormulario();
    assert.equal(t.memoria.size, 1); assert.equal(t.e("camposCompra").disabled, true);
    const pendiente = [...t.memoria.values()][0];
    const recuperado = entorno(pendiente); await tick();
    assert.equal(recuperado.ejecutar("comprasEstado.items[0].cantidad"), 2);
    assert.equal(recuperado.e("compraFecha").value, "2026-10-01");
    await recuperado.ctx.guardarCompraFormulario(); assert.equal(recuperado.memoria.size, 0);
    t.fallar(Object.assign(new Error("Proveedor no existe"), {codigo: "RECHAZADO"}));
    await t.ctx.guardarCompraFormulario(); assert.equal(t.memoria.size, 0); assert.equal(t.e("camposCompra").disabled, false);
    t = entorno(); await tick(); preparar(t); t.ejecutar("comprasEstado.items[0].cantidad = -1");
    await t.ctx.guardarCompraFormulario(); assert.equal(t.enviados(), 0);
    t.fallarLectura(); await t.ctx.cargarCompras(); assert.match(t.e("estadoCompras").textContent, /Sin conexión/);
    assert.equal(t.ejecutar("comprasEstado.productos.length"), 1);
    t = entorno(); await tick(); t.e("compraProducto").value = "p-1";
    t.e("agregarCompra").events.click(); t.e("agregarCompra").events.click();
    assert.equal(t.ejecutar("comprasEstado.items.length"), 1);
    t.e("compraBuscar").value = "inexistente"; t.e("compraBuscar").events.input();
    assert.equal(t.e("compraProducto").children.length, 0);
    t.e("itemsCompra").children[0].children[4].children[0].events.click();
    assert.equal(t.ejecutar("comprasEstado.items.length"), 0);
    t = entorno("JSON roto"); await tick(); assert.equal(t.ejecutar("comprasEstado.bloqueado"), true);
    await t.ctx.guardarCompraFormulario(); assert.equal(t.enviados(), 0);
    console.log("PASS: compras UI, total, doble envío, confirmación, rechazo, error de red y borrador recuperable.");
})().catch(error => {console.error(error); process.exitCode = 1;});
