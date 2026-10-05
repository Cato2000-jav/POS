// Pruebas locales, sin escrituras externas.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const nodos = new Map();
function nodo(id = "") {
    return {id, value: "", disabled: false, children: [], textContent: "", hidden: true,
        addEventListener() {}, setAttribute() {}, focus() {},
        replaceChildren() {this.children = [];}, appendChild(hijo) {this.children.push(hijo);},
        append(...hijos) {this.children.push(...hijos);},
        reset() {for (const nombre of ["Nombre", "Telefono", "Correo"]) obtener("#cliente" + nombre).value = "";},
        querySelectorAll() {return [...nodos.values()].filter(n => n.id !== "panelClientes");}};
}
function obtener(selector) {
    if (!nodos.has(selector)) nodos.set(selector, nodo(selector.slice(1)));
    return nodos.get(selector);
}
let llamadas = [], resolver, confirmar = true;
const ctx = vm.createContext({
    document: {querySelector: obtener, createElement: () => nodo()},
    crypto: {randomUUID: () => "p-1"}, window: {confirm: () => confirmar},
    api: {listar: async () => [], guardar: async (recurso, accion, datos) => {
        llamadas.push({recurso, accion, datos}); return datos;
    }}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../customers.js"), "utf8"), ctx);
const estado = () => vm.runInContext("clientesEstado", ctx);
const evento = {preventDefault() {}};
(async () => {
    await ctx.cargarClientes();
    assert.equal(estado().cargados, true);
    obtener("#clienteNombre").value = "<b>Papel</b>";
    obtener("#clienteTelefono").value = "001234";
    obtener("#clienteCorreo").value = "inválido";
    await ctx.guardarClienteFormulario(evento);
    assert.equal(llamadas.length, 0);
    obtener("#clienteCorreo").value = "papel@example.com";
    ctx.api.guardar = (recurso, accion, datos) => {
        llamadas.push({recurso, accion, datos}); return new Promise(r => {resolver = r;});
    };
    const guardado = ctx.guardarClienteFormulario(evento);
    await ctx.guardarClienteFormulario(evento);
    assert.equal(llamadas.length, 1);
    assert.equal(estado().registros.length, 0);
    resolver(llamadas[0].datos);
    await guardado;
    assert.equal(estado().registros[0].telefono, "001234");
    assert.match(obtener("#listaClientes").children[0].children[0].textContent, /<b>Papel<\/b>/);
    obtener("#buscarClientes").value = "example.com";
    ctx.renderClientes();
    assert.equal(obtener("#listaClientes").children.length, 1);
    ctx.editarCliente(estado().registros[0]);
    obtener("#clienteNombre").value = "Actualizado";
    ctx.api.guardar = async () => {throw new Error("Sin conexión");};
    await ctx.guardarClienteFormulario(evento);
    assert.equal(estado().registros[0].nombre, "<b>Papel</b>");
    assert.equal(obtener("#clienteNombre").value, "Actualizado");
    ctx.api.guardar = async (recurso, accion, datos) => datos;
    await ctx.guardarClienteFormulario(evento);
    assert.equal(estado().registros[0].nombre, "Actualizado");
    ctx.api.guardar = async () => {throw new Error("Tiene ventas asociadas");};
    await ctx.eliminarCliente(estado().registros[0]);
    assert.equal(estado().registros.length, 1);
    assert.match(obtener("#estadoClientes").textContent, /ventas asociadas/);
    confirmar = false;
    ctx.api.guardar = async () => {throw new Error("No debe llamarse");};
    await ctx.eliminarCliente(estado().registros[0]);
    confirmar = true;
    ctx.api.guardar = async (recurso, accion, datos) => datos;
    await ctx.eliminarCliente(estado().registros[0]);
    assert.equal(estado().registros.length, 0);
    ctx.api.listar = async () => {throw new Error("Fallo GET");};
    await ctx.cargarClientes();
    assert.match(obtener("#estadoClientes").textContent, /Fallo GET/);
    assert.equal(estado().ocupado, false);
    console.log("PASS: CRUD clientes, búsqueda, validación, texto seguro, errores, asociaciones y doble envío.");
})().catch(error => {console.error(error); process.exitCode = 1;});
