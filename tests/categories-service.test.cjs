// Code.gs con hojas simuladas: no escribe en Google Sheets.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
let escrituras = 0;
function hoja(encabezados) {
    return {encabezados, filas: [],
        getLastRow() {return this.filas.length + 1;},
        getDataRange() {return {getValues: () => [this.encabezados, ...this.filas]};},
        deleteRow(n) {escrituras++; this.filas.splice(n - 2, 1);},
        getRange(n, c, alto, ancho) {return {
            getValues: () => Array.from({length: alto}, (_, i) =>
                Array.from({length: ancho}, (_, j) => this.filas[n - 2 + i]?.[c - 1 + j] ?? "")),
            getFormulas: () => [encabezados.map(() => "")],
            getCell: () => ({setNumberFormat() {}}),
            setValues: datos => {escrituras++; this.filas[n - 2] = [...datos[0]];}
        };}
    };
}

const categorias = hoja(["id", "nombre"]);
const productos = hoja(["id", "categoriaId"]);
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../google-apps-script/para-publicar/Code.gs"), "utf8"), ctx);
ctx.obtenerHoja = nombre => nombre === "categorias" ? categorias : productos;
ctx.leerEncabezados = h => h.encabezados;
ctx.encontrarFila = (h, id) => {
    const indice = h.filas.findIndex(f => String(f[0]) === String(id));
    return indice === -1 ? -1 : indice + 2;
};
for (const nombre of ["", "  ", null, 12, {}, []]) {
    assert.throws(() => ctx.crearRegistro("categorias", {id: "c-1", nombre}), /nombre no vacío/);
    assert.equal(escrituras, 0);
}
assert.throws(() => ctx.crearRegistro("categorias", {id: "c-1"}), /nombre no vacío/);
ctx.crearRegistro("categorias", {id: "c-1", nombre: "Cuadernos"});
for (const nombre of ["", " ", null, 12, {}, []]) {
    assert.throws(() => ctx.actualizarRegistro("categorias", {id: "c-1", nombre}), /nombre no vacío/);
    assert.equal(escrituras, 1);
}
assert.equal(ctx.actualizarRegistro("categorias", {id: "c-1"}).nombre, "Cuadernos");
assert.equal(escrituras, 1);
assert.equal(ctx.actualizarRegistro("categorias", {id: "c-1", nombre: "Papeles"}).nombre, "Papeles");
productos.filas.push(["p-1", "c-1"]);
assert.throws(() => ctx.eliminarRegistro("categorias", {id: "c-1"}), /productos asociados/);
assert.equal(categorias.filas.length, 1);
productos.filas = [];
ctx.eliminarRegistro("categorias", {id: "c-1"});
assert.equal(categorias.filas.length, 0);
console.log("PASS: categorías con nombre obligatorio en API, edición parcial y eliminación con relaciones.");
