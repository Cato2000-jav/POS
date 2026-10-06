// Pruebas simuladas: no escriben datos en Google Sheets.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const elementos = new Map();
const nodo = () => ({disabled: false, textContent: "", addEventListener() {}});
const estado = {productosDisponibles: [], facturaActual: []};
let peticiones = 0;
let resolver;
const contexto = vm.createContext({
    estado, buscador: nodo(), botonIniciarFactura: nodo(), catalogoProductos: nodo(),
    renderProductos() {},
    document: {querySelector(selector) {
        if (!elementos.has(selector)) elementos.set(selector, nodo());
        return elementos.get(selector);
    }},
    api: {listar: async () => {peticiones++; return [];}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../products.js"), "utf8"), contexto);
const producto = {id: "uuid:1", nombre: "Cuaderno", categoriaId: "cat-1",
    precio: "2000", costo: 1000, stock: 3, seguimientoInventario: "FALSE"};
const categorias = [{id: "cat-1", nombre: "Cuadernos"}];
const normalizar = contexto.normalizarProductos;
const resultado = normalizar([producto], categorias)[0];
assert.equal(resultado.id, "uuid:1");
assert.equal(resultado.precio, 2000);
assert.equal(resultado.seguimientoInventario, false);
assert.equal(resultado.categoria, "Cuadernos");
for (const cambio of [{stock: -1}, {stock: 1.5}, {precio: ""}, {costo: true},
    {seguimientoInventario: "no"}, {categoriaId: "inexistente"}]) {
    assert.throws(() => normalizar([{...producto, ...cambio}], categorias));
}
assert.throws(() => normalizar([producto, producto], categorias));
(async () => {
    await contexto.cargarProductos();
    assert.equal(estado.productosDisponibles.length, 0);
    assert.match(elementos.get("#estadoProductos").textContent, /vacía/);
    contexto.api.listar = async recurso => recurso === "productos" ? [producto] : categorias;
    await contexto.cargarProductos();
    assert.equal(estado.productosDisponibles[0].id, "uuid:1");
    const anterior = estado.productosDisponibles;
    contexto.api.listar = async () => { throw new Error("Sin conexión"); };
    await contexto.cargarProductos();
    assert.equal(estado.productosDisponibles, anterior);
    assert.match(elementos.get("#estadoProductos").textContent, /Sin conexión/);
    assert.equal(elementos.get("#recargarProductos").disabled, false);
    contexto.api.listar = () => {peticiones++; return new Promise(r => {resolver = r;});};
    // Una única promesa compartida deja comprobar la bandera sin temporizadores.
    const pendiente = new Promise(r => {resolver = r;});
    contexto.api.listar = () => {peticiones++; return pendiente;};
    const antes = peticiones;
    const carga = contexto.cargarProductos();
    await contexto.cargarProductos();
    assert.equal(peticiones, antes + 2);
    assert.equal(contexto.catalogoProductos.inert, true);
    resolver([]);
    await carga;
    assert.equal(contexto.catalogoProductos.inert, false);
    estado.facturaActual = [{id: "uuid:1", cantidad: 1}];
    await contexto.cargarProductos();
    assert.equal(peticiones, antes + 2);
    console.log("PASS: normalización, IDs de texto, vacío, errores, conservación, doble carga y venta activa.");
})().catch(error => {console.error(error); process.exitCode = 1;});
