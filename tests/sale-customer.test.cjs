const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const nodos = new Map();
const obtener = id => {
    if (!nodos.has(id)) nodos.set(id, {value: "", disabled: false, children: [],
        addEventListener() {}, replaceChildren() {this.children = [];}, appendChild(n) {this.children.push(n);}});
    return nodos.get(id);
};
let resolver, llamadas = 0;
const cliente = {id: "c-1", nombre: "Ana", telefono: "001", correo: ""};
const ctx = vm.createContext({document: {querySelector: obtener, createElement: () => ({})},
    metodoPago: {value: "efectivo"}, api: {listar: async () => [cliente]}});
for (const file of ["customers.js", "sale-customer.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), ctx);
}
(async () => {
    await ctx.cargarClientesVenta();
    assert.equal(ctx.obtenerClienteVenta().clienteId, "");
    ctx.metodoPago.value = "nequi";
    assert.equal(ctx.obtenerClienteVenta().clienteId, "");
    ctx.metodoPago.value = "debe";
    assert.throws(() => ctx.obtenerClienteVenta(), /seleccionar un cliente/);
    obtener("#clienteVenta").value = "c-1";
    const copia = ctx.obtenerClienteVenta();
    assert.equal(copia.clienteNombre, "Ana");
    cliente.nombre = "Otro nombre";
    assert.equal(copia.clienteNombre, "Ana");
    ctx.api.listar = async () => {throw new Error("Sin conexión");};
    await ctx.cargarClientesVenta();
    assert.throws(() => ctx.obtenerClienteVenta(), /Actualiza/);
    assert.equal(obtener("#recargarClientesVenta").disabled, false);
    ctx.api.listar = () => {llamadas++; return new Promise(r => {resolver = r;});};
    const carga = ctx.cargarClientesVenta();
    await ctx.cargarClientesVenta();
    assert.equal(llamadas, 1);
    assert.throws(() => ctx.obtenerClienteVenta(), /Espera/);
    ctx.invalidarClientesVenta();
    resolver([cliente]);
    await carga;
    assert.throws(() => ctx.obtenerClienteVenta(), /Actualiza/);
    ctx.api.listar = async () => [cliente];
    await ctx.cargarClientesVenta();
    assert.equal(ctx.obtenerClienteVenta().clienteId, "c-1");
    ctx.api.listar = async () => [];
    await ctx.cargarClientesVenta();
    assert.equal(obtener("#clienteVenta").value, "");
    assert.throws(() => ctx.obtenerClienteVenta(), /seleccionar/);
    // Ejecutar la función real del MVP, no una copia de su lógica.
    const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
    ctx.estado = {facturaActual: [{id: "p-1", cantidad: 1}], facturaIniciada: true};
    ctx.trabajador = {value: "Vendedor", focus() {}};
    ctx.dineroRecibido = {value: "100", focus() {}};
    ctx.calcularTotales = () => ({total: 100});
    ctx.mostrarToast = () => {};
    obtener("#clienteVenta").focus = () => {};
    vm.runInContext(app.slice(app.indexOf("const validarVenta ="), app.indexOf("const generarFactura =")), ctx);
    assert.equal(vm.runInContext("validarVenta()", ctx), false);
    ctx.api.listar = async () => [cliente];
    await ctx.cargarClientesVenta();
    obtener("#clienteVenta").value = "c-1";
    assert.equal(vm.runInContext("validarVenta()", ctx), true);
    ctx.metodoPago.value = "efectivo";
    obtener("#clienteVenta").value = "";
    assert.equal(vm.runInContext("validarVenta()", ctx), true);
    ctx.dineroRecibido.value = "99";
    assert.equal(vm.runInContext("validarVenta()", ctx), false);
    console.log("PASS: cliente opcional, Debe obligatorio, copia histórica, errores, doble carga y datos obsoletos.");
})().catch(error => {console.error(error); process.exitCode = 1;});
