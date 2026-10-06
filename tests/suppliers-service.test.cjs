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
const proveedores = hoja(["id", "nombre", "telefono", "correo"]);
const compras = hoja(["id", "proveedorId"]);
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../google-apps-script/para-publicar/Code.gs"), "utf8"), ctx);
ctx.obtenerHoja = nombre => nombre === "proveedores" ? proveedores : compras;
ctx.leerEncabezados = h => h.encabezados;
ctx.encontrarFila = (h, id) => {
    const indice = h.filas.findIndex(f => String(f[0]) === String(id));
    return indice === -1 ? -1 : indice + 2;
};
const valido = {id: "p-1", nombre: "Papel", telefono: "001234", correo: "papel@example.com"};
for (const cambio of [{nombre: " "}, {nombre: null}, {correo: "incorrecto"},
    {correo: "a@b.c\n"}, {correo: {}}, {telefono: {}}, {telefono: Infinity}]) {
    assert.throws(() => ctx.crearRegistro("proveedores", {...valido, ...cambio}));
    assert.equal(escrituras, 0);
}
const creado = ctx.crearRegistro("proveedores", valido);
assert.equal(creado.telefono, "001234");
assert.throws(() => ctx.crearRegistro("proveedores", valido), /Ya existe/);
assert.throws(() => ctx.actualizarRegistro("proveedores", {id: "p-1", nombre: ""}));
assert.throws(() => ctx.actualizarRegistro("proveedores", {id: "p-1", correo: "mal"}));
assert.equal(escrituras, 1);
const editado = ctx.actualizarRegistro("proveedores", {id: "p-1", nombre: "Papel nuevo"});
assert.equal(editado.telefono, "001234");
assert.equal(editado.correo, valido.correo);
compras.filas.push(["compra-1", "p-1"]);
assert.throws(() => ctx.eliminarRegistro("proveedores", {id: "p-1"}), /compras asociadas/);
assert.equal(proveedores.filas.length, 1);
compras.encabezados = ["id", "campoIncorrecto"];
assert.throws(() => ctx.eliminarRegistro("proveedores", {id: "p-1"}), /comprobar la relación/);
compras.encabezados = ["id", "proveedorId"];
compras.filas = [];
ctx.eliminarRegistro("proveedores", {id: "p-1"});
assert.equal(proveedores.filas.length, 0);
const opcionales = ctx.crearRegistro("proveedores", {id: "p-2", nombre: "Sin contacto"});
assert.equal(opcionales.telefono, "");
assert.equal(opcionales.correo, "");
console.log("PASS: validación servidor, edición parcial, opcionales, teléfono y bloqueo por compras/encabezados.");
