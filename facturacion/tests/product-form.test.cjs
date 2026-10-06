const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const nodos = new Map();
function nodo() {
    return { value: "", checked: false, hidden: true, disabled: false,
        textContent: "", children: [], addEventListener() {}, setAttribute() {}, reset() {},
        querySelectorAll() { return []; }, replaceChildren() { this.children = []; },
        appendChild(hijo) { this.children.push(hijo); } };
}
function obtener(id) { if (!nodos.has(id)) nodos.set(id, nodo()); return nodos.get(id); }
const categoria = {id: "cat-1", nombre: "Cuadernos"};
const producto = {id: "prod-1", codigo: "01", nombre: "Cuaderno", categoriaId: "cat-1",
    precio: 2000, costo: 1000, stock: 10, seguimientoInventario: true};
const estado = {productosDisponibles: [{...producto}], facturaActual: [{id: "prod-1", cantidad: 2}],
    ultimaVenta: {total: 123, productos: [{nombre: "Anterior", precio: 123}]}};
let enviados = [];
let resolver;
const contexto = vm.createContext({estado, crypto: {randomUUID: () => "nuevo-id"},
    window: {confirm: () => true}, confirmarAccion: async () => true, document: {querySelector: obtener, createElement: nodo},
    buscador: nodo(), botonIniciarFactura: nodo(), catalogoProductos: nodo(), panelFactura: nodo(),
    renderProductos() {}, renderFactura() {},
    api: {listar: async () => [categoria], guardar: async (recurso, accion, datos) => {
        enviados.push({recurso, accion, datos}); return {...producto, ...datos};
    }}
});
for (const archivo of ["products.js", "product-form.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), contexto);
}
const evento = {preventDefault() {}};
(async () => {
    const cerrada = JSON.stringify(estado.ultimaVenta);
    await contexto.abrirProducto("prod-1");
    assert.equal(obtener("#productoStock").disabled, true);
    obtener("#productoPrecio").value = "2500";
    obtener("#productoStock").value = "900";
    contexto.api.guardar = (recurso, accion, datos) => {
        enviados.push({recurso, accion, datos});
        return new Promise(r => {resolver = r;});
    };
    const pendiente = contexto.guardarProductoFormulario(evento);
    assert.equal(estado.productosDisponibles[0].precio, 2500); // vista provisional
    assert.equal(contexto.panelFactura.inert, true);
    await contexto.guardarProductoFormulario(evento);
    assert.equal(enviados.length, 1);
    assert.equal(Object.hasOwn(enviados[0].datos, "stock"), false);
    assert.equal(Object.hasOwn(enviados[0].datos, "seguimientoInventario"), false);
    resolver({...producto, ...enviados[0].datos});
    await pendiente;
    assert.equal(estado.productosDisponibles[0].stock, 10);
    assert.equal(contexto.panelFactura.inert, false);
    await contexto.abrirProducto("prod-1");
    obtener("#productoPrecio").value = "3000";
    contexto.api.guardar = async () => {throw new Error("Error de red");};
    await contexto.guardarProductoFormulario(evento);
    assert.equal(estado.productosDisponibles[0].precio, 2500);
    assert.equal(obtener("#productoPrecio").value, "3000");
    assert.match(obtener("#mensajeProducto").textContent, /Error de red/);
    assert.equal(JSON.stringify(estado.ultimaVenta), cerrada);
    await contexto.abrirProducto();
    obtener("#productoNombre").value = "Nuevo";
    obtener("#productoCategoria").value = "cat-1";
    obtener("#productoPrecio").value = "20";
    obtener("#productoCosto").value = "10";
    await contexto.guardarProductoFormulario(evento); // error conserva ID
    contexto.api.guardar = async (recurso, accion, datos) => {
        enviados.push({recurso, accion, datos}); return datos;
    };
    await contexto.guardarProductoFormulario(evento);
    assert.equal(enviados.at(-1).accion, "crear");
    assert.equal(enviados.at(-1).datos.id, "nuevo-id");
    assert.equal(estado.productosDisponibles.length, 2);
    assert.equal(estado.productosDisponibles[1].stock, 0);
    const llamadasAntes = enviados.length;
    await contexto.eliminarProductoCatalogo("prod-1");
    assert.equal(enviados.length, llamadasAntes); // producto en la venta actual
    assert.match(obtener("#estadoProductos").textContent, /venta actual/);
    contexto.api.guardar = async () => {throw new Error("Tiene una venta abierta");};
    await contexto.eliminarProductoCatalogo("nuevo-id");
    assert.equal(estado.productosDisponibles.length, 2);
    contexto.api.guardar = (recurso, accion, datos) => {
        enviados.push({recurso, accion, datos});
        return new Promise(r => {resolver = r;});
    };
    const borrado = contexto.eliminarProductoCatalogo("nuevo-id");
    await contexto.eliminarProductoCatalogo("nuevo-id");
    assert.equal(enviados.length, llamadasAntes + 1);
    assert.equal(estado.productosDisponibles.length, 2); // aún sin confirmación
    resolver({id: "nuevo-id"});
    await borrado;
    assert.equal(estado.productosDisponibles.length, 1);
    assert.equal(obtener("#recargarProductos").disabled, false);
    assert.equal(JSON.stringify(estado.ultimaVenta), cerrada);
    console.log("PASS: crear, editar, revertir, eliminar, asociaciones, doble envío y protección del historial/stock.");
})().catch(error => {console.error(error); process.exitCode = 1;});
