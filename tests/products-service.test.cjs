// Ejecuta el Code.gs listo para publicar con hojas simuladas, sin acceso a Google.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const headers = ["id", "codigo", "nombre", "categoriaId", "precio", "costo", "seguimientoInventario", "stock"];
const producto = {id: "p-1", codigo: "01", nombre: "Cuaderno", categoriaId: "c-1", precio: 20,
    costo: 10, seguimientoInventario: true, stock: 5};
let filas, ventas, escrituras;
function reiniciar() {filas = []; ventas = []; escrituras = 0;}
const hoja = {
    getLastRow: () => filas.length + 1,
    deleteRow(n) {escrituras++; filas.splice(n - 2, 1);},
    getRange(n, c, alto, ancho) {return {
        getValues: () => [Array.from({length: ancho}, (_, i) => filas[n - 2]?.[c - 1 + i] ?? "")],
        getFormulas: () => [headers.map(() => "")],
        getCell: () => ({setNumberFormat() {}}),
        setValues(datos) {escrituras++; filas[n - 2] = [...datos[0]];}
    };}
};
const categorias = {}, hojaVentas = {};
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../google-apps-script/para-publicar/Code.gs"), "utf8"), ctx);
ctx.obtenerHoja = nombre => nombre === "productos" ? hoja : nombre === "categorias" ? categorias : hojaVentas;
ctx.leerEncabezados = h => h === hoja ? headers : h === categorias ? ["id", "nombre"] : ["id", "estado", "itemsJson"];
ctx.encontrarFila = (h, id) => h === categorias ? (id === "c-1" ? 2 : -1) :
    (filas.findIndex(f => String(f[0]) === String(id)) === -1 ? -1 : filas.findIndex(f => String(f[0]) === String(id)) + 2);
ctx.leerHoja = () => ventas;
reiniciar();
for (const cambio of [{nombre: ""}, {precio: -1}, {costo: ""}, {stock: 1.5},
    {seguimientoInventario: "no"}, {categoriaId: "eliminada"}]) {
    assert.throws(() => ctx.crearRegistro("productos", {...producto, ...cambio}));
    assert.equal(escrituras, 0);
}
ctx.crearRegistro("productos", producto);
assert.equal(escrituras, 1);
assert.throws(() => ctx.crearRegistro("productos", producto), /Ya existe/);
assert.throws(() => ctx.actualizarRegistro("productos", {id: "p-1", precio: -1}));
assert.throws(() => ctx.actualizarRegistro("productos", {id: "p-1", categoriaId: "borrada"}));
assert.throws(() => ctx.actualizarRegistro("productos", {id: "p-1", stock: 100}), /stock/);
assert.equal(escrituras, 1);
const actualizado = ctx.actualizarRegistro("productos", {id: "p-1", nombre: "Otro", precio: 30});
assert.equal(actualizado.stock, 5);
assert.equal(actualizado.nombre, "Otro");
assert.equal(actualizado.precio, 30);
ventas = [{estado: "abierta", itemsJson: [{id: "p-1", cantidad: 1}]}];
assert.throws(() => ctx.eliminarRegistro("productos", {id: "p-1"}), /venta abierta/);
assert.equal(filas.length, 1);
ventas = [{estado: "abierta", itemsJson: [{cantidad: 1}]}];
assert.throws(() => ctx.eliminarRegistro("productos", {id: "p-1"}), /inválido/);
ventas = [{estado: "cerrada", itemsJson: [{id: "p-1", precio: 20, nombre: "Cuaderno"}]}];
const historial = JSON.stringify(ventas);
ctx.eliminarRegistro("productos", {id: "p-1"});
assert.equal(filas.length, 0);
assert.equal(JSON.stringify(ventas), historial);
console.log("PASS: validación antes de escribir, actualización parcial, stock protegido y eliminación con relaciones.");
