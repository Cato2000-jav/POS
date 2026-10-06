const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
class Elemento {
    constructor() {this.value = ""; this.children = []; this.disabled = false; this.hidden = false; this.textContent = ""; this.events = {}; this.dataset = {};}
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
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../history-filters.js"), "utf8"), ctx);
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
    // GET antiguo: texto JSON y sin snapshot. No escribir ni consultar nombres actuales para rellenarlo.
    t = entorno(); await tick();
    const antigua = {id: "antigua-1", fecha: "2026-10-02", proveedorId: "s-1", total: 72,
        itemsJson: JSON.stringify([{id: "p-1", cantidad: 9, costo: 8}])};
    const original = JSON.stringify(antigua);
    const normalizada = t.ctx.normalizarCompraHistorica(antigua);
    assert.equal(normalizada.itemsJson[0].subtotal, 72);
    assert.equal(normalizada.itemsJson[0].subtotalCalculado, true);
    assert.match(normalizada.itemsJson[0].nombre, /nombre histórico no registrado/);
    assert.equal(JSON.stringify(antigua), original);
    assert.equal(t.ctx.normalizarCompraHistorica({...antigua, itemsJson: JSON.parse(antigua.itemsJson)}).total, 72);
    assert.throws(() => t.ctx.validarCompraRecibida(antigua)); // POST no se flexibiliza
    assert.throws(() => t.ctx.validarCompraRecibida({...antigua, itemsJson: JSON.parse(antigua.itemsJson)}));
    for (const itemsJson of ["JSON roto", "[]", "null", "{}", [], [{id:"p-1",cantidad:9,costo:8,subtotal:1}], [{id:"p-1",cantidad:-9,costo:8}]]) {
        assert.throws(() => t.ctx.normalizarCompraHistorica({...antigua, itemsJson}), /Compra antigua-1:/);
    }
    assert.throws(() => t.ctx.normalizarCompraHistorica({...antigua, total: 71}), /Compra antigua-1:/);
    const moderna = {...antigua, itemsJson: [{id:"p-1", cantidad:9, costo:8, nombre:"Nombre al comprar", subtotal:72}]};
    assert.equal(t.ctx.normalizarCompraHistorica(moderna).detalleHistoricoIncompleto, false);
    assert.equal(t.ctx.normalizarCompraHistorica(moderna).itemsJson[0].nombre, "Nombre al comprar");
    const listarOriginal = t.ctx.api.listar;
    t.ctx.api.listar = async recurso => recurso === "compras" ? [antigua] : listarOriginal(recurso);
    await t.ctx.cargarCompras();
    assert.equal(t.ejecutar("comprasEstado.cargado"), true);
    assert.equal(t.e("compraProducto").children.length, 1);
    assert.equal(t.e("compraProveedor").children.length, 2);
    assert.equal(t.e("camposCompra").disabled, false);
    assert.equal(t.enviados(), 0);
    t.e("listaCompras").children[0].children[0].events.click();
    assert.match(t.e("detalleCompra").children[1].textContent, /No se modificó la hoja/);
    assert.match(t.e("detalleCompra").children[2].textContent, /subtotal calculado/);
    t.e("filtrosCompras-proveedor").value = "otro";
    t.ctx.renderListaCompras();
    assert.match(t.e("listaCompras").children[0].textContent, /coincidan/);
    assert.equal(t.e("detalleCompra").hidden, true);
    assert.equal(t.ejecutar("comprasEstado.registros.length"), 1);
    t.e("filtrosCompras-proveedor").value = "s-1";
    t.e("filtrosCompras-desde").value = "2026-10-02";
    t.e("filtrosCompras-hasta").value = "2026-10-02";
    t.ctx.renderListaCompras();
    assert.match(t.e("resultadoFiltrosCompras").textContent, /1 de 1/);
    assert.equal(t.enviados(), 0);
    // Un borrador antiguo ya registrado no debe recomendar ni permitir otro POST.
    const borradorAntiguo = {...antigua, itemsJson: JSON.parse(antigua.itemsJson)};
    t = entorno(JSON.stringify(borradorAntiguo)); await tick();
    const listarPendiente = t.ctx.api.listar;
    t.ctx.api.listar = async recurso => recurso === "compras" ? [antigua] : listarPendiente(recurso);
    await t.ctx.cargarCompras();
    assert.match(t.e("estadoCompras").textContent, /ya existe en Sheets.*histórico está incompleto/);
    assert.equal(t.e("reintentarCompra").disabled, true);
    await t.ctx.guardarCompraFormulario();
    assert.equal(t.enviados(), 0);
    assert.equal(t.memoria.get("papelLuna.compraPendiente.v1"), JSON.stringify(borradorAntiguo));
    // Mismo ID con contenido distinto: tampoco reenviar ni retirar el borrador.
    t.ctx.api.listar = async recurso => recurso === "compras" ? [{...moderna, total: 80,
        itemsJson: [{id:"p-1",cantidad:10,costo:8,nombre:"Cuaderno",subtotal:80}]}] : listarPendiente(recurso);
    await t.ctx.cargarCompras();
    assert.match(t.e("estadoCompras").textContent, /datos diferentes/);
    await t.ctx.guardarCompraFormulario(); assert.equal(t.enviados(), 0);
    assert.equal(t.memoria.size, 1);
    // Un registro moderno coincidente mantiene el reintento idempotente existente.
    t.ctx.api.listar = async recurso => recurso === "compras" ? [moderna] : listarPendiente(recurso);
    await t.ctx.cargarCompras();
    assert.equal(t.e("reintentarCompra").disabled, false);
    await t.ctx.guardarCompraFormulario();
    assert.equal(t.enviados(), 1); assert.equal(t.memoria.size, 0);
    t = entorno("JSON roto"); await tick(); assert.equal(t.ejecutar("comprasEstado.bloqueado"), true);
    await t.ctx.guardarCompraFormulario(); assert.equal(t.enviados(), 0);
    console.log("PASS: compras UI, total, doble envío, confirmación, rechazo, error de red y borrador recuperable.");
})().catch(error => {console.error(error); process.exitCode = 1;});
