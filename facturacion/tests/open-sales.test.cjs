// API y DOM simulados: no crea ventas reales.
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
const nodos = new Map();
function nodo() { return {value: "", disabled: false, hidden: true, children: [],
    addEventListener() {}, querySelectorAll() {return [];}, replaceChildren() {this.children = [];},
    append(...hijos) {this.children.push(...hijos);}, appendChild(hijo) {this.children.push(hijo);},
    classList: {remove() {}}}; }
function obtener(id) {if (!nodos.has(id)) nodos.set(id, nodo()); return nodos.get(id);}
const producto = {id: "p-1", nombre: "Cuaderno", precio: 100, stock: 5};
const venta = {id: "v-1", estado: "abierta", actualizadoEn: "2026-09-29T12:00:00.000Z",
    persona: "Vendedor", clienteId: "", metodoPago: "Efectivo", subtotal: 200, iva: 38, total: 238,
    itemsJson: [{id: "p-1", nombre: "Cuaderno", cantidad: 2, precio: 100, subtotal: 200}]};
const estado = {facturaIniciada: true, facturaActual: [{id: "p-1", cantidad: 2}], productosDisponibles: [producto]};
let llamadas = [], resolver, aceptar = true;
const ctx = vm.createContext({estado, document: {querySelector: obtener, createElement: nodo},
    api: {listar: async recurso => recurso === "ventas" ? [venta] : recurso === "productos" ? [producto] : [],
        guardar: async (r, accion, datos) => {llamadas.push({accion, datos}); return {...venta, id: datos.id};}},
    crypto: {randomUUID: () => "v-1"}, window: {confirm: () => aceptar}, confirmarAccion: async () => aceptar,
    productosCargando: false, productosEditor: {ocupado: false}, formProducto: nodo(),
    clientesVentaEstado: {cargando: false}, clientesEstado: {ocupado: false},
    proveedoresEstado: {ocupado: false}, categoriasEstado: {cargando: false},
    botonGenerarFactura: nodo(), botonIniciarFactura: nodo(), botonHistorial: nodo(),
    trabajador: {value: "Vendedor"}, metodoPago: {selectedIndex: 0, options: [{text: " Efectivo "}]},
    clienteVenta: nodo(), dineroRecibido: nodo(), panelFactura: nodo(), contenidoPrincipal: nodo(),
    formatoMoneda: {format: n => String(n)}, obtenerClienteVenta: () => ({clienteId: "", clienteNombre: ""}),
    normalizarProductos: p => p, normalizarCliente: c => c,
    renderProductos() {}, renderFactura() {}, actualizarMetodoPago() {}, mostrarVentaPendiente() {}
    ,firmaVentaActual: () => "firma"
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../open-sales.js"), "utf8"), ctx);
const remoto = () => vm.runInContext("ventasAbiertasEstado", ctx);
(async () => {
    assert.equal(ctx.validarAbierta(venta), venta);
    for (const cambio of [{subtotal: 1}, {iva: 0}, {total: 1}, {subtotal: undefined},
        {persona: " "}, {metodoPago: "Desconocido"}, {metodoPago: "Debe"}]) {
        assert.throws(() => ctx.validarAbierta({...venta, ...cambio}));
    }
    for (const cambio of [{nombre: " "}, {subtotal: undefined}, {subtotal: 1}, {precio: Number.MAX_VALUE}]) {
        assert.throws(() => ctx.validarAbierta({...venta, itemsJson: [{...venta.itemsJson[0], ...cambio}]}));
    }
    assert.equal(ctx.validarAbierta({...venta, metodoPago: "Debe", clienteId: "c-1"}).clienteId, "c-1");
    const decimal = 0.1 * 3, impuesto = Math.round(decimal * 0.19);
    ctx.validarAbierta({...venta, subtotal: decimal, iva: impuesto, total: decimal + impuesto,
        itemsJson: [{id:"p-1",nombre:"Cuaderno",cantidad:3,precio:0.1,subtotal:decimal}]});
    await ctx.guardarVentaAbiertaFormulario();
    assert.equal(llamadas[0].accion, "crear");
    assert.equal(remoto().id, "v-1");
    assert.equal(ctx.botonGenerarFactura.disabled, false);
    assert.equal(estado.productosDisponibles[0].stock, 5);
    ctx.api.guardar = (r, accion, datos) => {llamadas.push({accion, datos}); return new Promise(r => {resolver = r;});};
    const pendiente = ctx.guardarVentaAbiertaFormulario();
    await ctx.guardarVentaAbiertaFormulario();
    assert.equal(llamadas.length, 2);
    assert.equal(llamadas[1].accion, "actualizar");
    assert.equal(llamadas[1].datos.actualizadoEn, venta.actualizadoEn);
    resolver({...venta, actualizadoEn: "2026-09-29T12:01:00.000Z"});
    await pendiente;
    ctx.api.guardar = async () => {throw new Error("La venta cambió");};
    const version = remoto().actualizadoEn;
    await ctx.guardarVentaAbiertaFormulario();
    assert.equal(remoto().actualizadoEn, version);
    assert.equal(estado.facturaActual.length, 1);
    assert.equal(remoto().ocupado, false);
    await ctx.cargarVentasAbiertas();
    assert.equal(remoto().registros.length, 1);
    const listarValido = ctx.api.listar;
    const registrosValidos = remoto().registros;
    assert.equal(ctx.validarIdsVentas([]).length, 0);
    assert.throws(() => ctx.validarIdsVentas({}), /lista de ventas/);
    for (const ventasInvalidas of [[venta, {...venta}], [venta, {...venta, estado: "cerrada"}],
        [null], [{id: " "}], [{id: 123}]]) {
        const carritoAntes = estado.facturaActual;
        ctx.api.listar = async recurso => recurso === "ventas" ? ventasInvalidas : listarValido(recurso);
        await ctx.cargarVentasAbiertas();
        assert.equal(remoto().registros, registrosValidos);
        assert.match(obtener("#estadoVentasAbiertas").textContent, /duplicado|ID válido/);
        await ctx.retomarVentaAbierta("v-1");
        assert.equal(estado.facturaActual, carritoAntes);
        assert.equal(remoto().actualizadoEn, version);
        assert.equal(remoto().ocupado, false);
    }
    ctx.api.listar = async () => [{...venta, total: 1}];
    await ctx.cargarVentasAbiertas();
    assert.equal(remoto().registros, registrosValidos);
    const carritoValido = estado.facturaActual;
    await ctx.retomarVentaAbierta("v-1");
    assert.equal(estado.facturaActual, carritoValido);
    assert.equal(remoto().actualizadoEn, version);
    ctx.api.listar = listarValido;
    aceptar = false;
    await ctx.retomarVentaAbierta("v-1");
    assert.equal(remoto().actualizadoEn, version);
    aceptar = true;
    await ctx.retomarVentaAbierta("v-1");
    assert.equal(remoto().actualizadoEn, venta.actualizadoEn);
    assert.equal(estado.facturaActual[0].cantidad, 2);
    assert.equal(ctx.dineroRecibido.value, "");
    const anterior = estado.facturaActual;
    ctx.api.listar = async recurso => recurso === "ventas" ? [venta] : [];
    await ctx.retomarVentaAbierta("v-1");
    assert.equal(estado.facturaActual, anterior); // error no destruye el carrito
    ctx.limpiarReferenciaAbierta();
    assert.equal(remoto().id, null);
    assert.equal(ctx.botonGenerarFactura.disabled, false);
    await ctx.guardarVentaAbiertaFormulario(); // error conserva ID de intento
    assert.equal(remoto().nuevoId, "v-1");
    assert.equal(ctx.botonGenerarFactura.disabled, true);
    console.log("PASS: guardar/actualizar/retomar abiertas, doble envío, conflictos, errores e inventario sin cambios.");
})().catch(e => {console.error(e); process.exitCode = 1;});
