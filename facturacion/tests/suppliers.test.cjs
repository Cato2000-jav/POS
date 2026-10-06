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
        reset() {for (const nombre of ["Nombre", "Telefono", "Correo"]) obtener("#proveedor" + nombre).value = "";},
        querySelectorAll() {return [...nodos.values()].filter(n => n.id !== "panelProveedores");}};
}
function obtener(selector) {
    if (!nodos.has(selector)) nodos.set(selector, nodo(selector.slice(1)));
    return nodos.get(selector);
}
let llamadas = [], resolver, confirmar = true;
const ctx = vm.createContext({
    document: {querySelector: obtener, createElement: () => nodo()},
    crypto: {randomUUID: () => "p-1"}, window: {confirm: () => confirmar}, confirmarAccion: async () => confirmar,
    api: {listar: async () => [], guardar: async (recurso, accion, datos) => {
        llamadas.push({recurso, accion, datos}); return datos;
    }}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../suppliers.js"), "utf8"), ctx);
const estado = () => vm.runInContext("proveedoresEstado", ctx);
const evento = {preventDefault() {}};
(async () => {
    await ctx.cargarProveedores();
    assert.equal(estado().cargados, true);
    obtener("#proveedorNombre").value = "<b>Papel</b>";
    obtener("#proveedorTelefono").value = "001234";
    obtener("#proveedorCorreo").value = "inválido";
    await ctx.guardarProveedorFormulario(evento);
    assert.equal(llamadas.length, 0);
    obtener("#proveedorCorreo").value = "papel@example.com";
    ctx.api.guardar = (recurso, accion, datos) => {
        llamadas.push({recurso, accion, datos}); return new Promise(r => {resolver = r;});
    };
    const guardado = ctx.guardarProveedorFormulario(evento);
    await ctx.guardarProveedorFormulario(evento);
    assert.equal(llamadas.length, 1);
    assert.equal(estado().registros.length, 0);
    resolver(llamadas[0].datos);
    await guardado;
    assert.equal(estado().registros[0].telefono, "001234");
    assert.match(obtener("#listaProveedores").children[0].children[0].textContent, /<b>Papel<\/b>/);
    obtener("#buscarProveedores").value = "example.com";
    ctx.renderProveedores();
    assert.equal(obtener("#listaProveedores").children.length, 1);
    ctx.editarProveedor(estado().registros[0]);
    obtener("#proveedorNombre").value = "Actualizado";
    ctx.api.guardar = async () => {throw new Error("Sin conexión");};
    await ctx.guardarProveedorFormulario(evento);
    assert.equal(estado().registros[0].nombre, "<b>Papel</b>");
    assert.equal(obtener("#proveedorNombre").value, "Actualizado");
    ctx.api.guardar = async (recurso, accion, datos) => datos;
    await ctx.guardarProveedorFormulario(evento);
    assert.equal(estado().registros[0].nombre, "Actualizado");
    ctx.api.guardar = async () => {throw new Error("Tiene compras asociadas");};
    await ctx.eliminarProveedor(estado().registros[0]);
    assert.equal(estado().registros.length, 1);
    assert.match(obtener("#estadoProveedores").textContent, /compras asociadas/);
    confirmar = false;
    ctx.api.guardar = async () => {throw new Error("No debe llamarse");};
    await ctx.eliminarProveedor(estado().registros[0]);
    confirmar = true;
    ctx.api.guardar = async (recurso, accion, datos) => datos;
    await ctx.eliminarProveedor(estado().registros[0]);
    assert.equal(estado().registros.length, 0);
    ctx.api.listar = async () => {throw new Error("Fallo GET");};
    await ctx.cargarProveedores();
    assert.match(obtener("#estadoProveedores").textContent, /Fallo GET/);
    assert.equal(estado().ocupado, false);
    console.log("PASS: CRUD proveedores, búsqueda, validación, texto seguro, errores, asociaciones y doble envío.");
})().catch(error => {console.error(error); process.exitCode = 1;});
