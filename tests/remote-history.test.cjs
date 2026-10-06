const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
const nodos = new Map();
function obtener(id) {if (!nodos.has(id)) nodos.set(id, {value: "sheets", disabled: false, addEventListener() {}}); return nodos.get(id);}
const cerrada = {id: "v-1", estado: "cerrada", fecha: "2026-09-29T12:00:00Z", persona: "Ana",
    subtotal: 100, iva: 19, total: 119, metodoPago: "Nequi", valorRecibido: "", cambio: "",
    itemsJson: [{id: "p-1", nombre: "Cuaderno", cantidad: 1, precio: 100, subtotal: 100}]};
let lecturasLocales = 0, peticiones = 0, resolver;
const ctx = vm.createContext({document: {querySelector: obtener}, renderHistorial() {},
    leerHistorialAnterior: () => {lecturasLocales++; return [{id: "vieja"}];},
    api: {listar: async () => {peticiones++; return [cerrada, {estado: "abierta", id: "borrador"}];}}});
for (const archivo of ["sales-data.js", "remote-history.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), ctx);
const datos = () => vm.runInContext("historialConsulta", ctx);
(async () => {
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros.length, 1);
    assert.equal(datos().registros[0].productos[0].nombre, "Cuaderno");
    assert.equal(datos().registros[0].dineroRecibido, null);
    assert.equal(lecturasLocales, 0);
    const anterior = datos().registros;
    ctx.api.listar = async () => {throw new Error("Sin conexión");};
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros, anterior);
    assert.match(obtener("#estadoHistorial").textContent, /última carga/);
    ctx.api.listar = async () => [{...cerrada, itemsJson: []}];
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros, anterior);
    obtener("#fuenteHistorial").value = "anterior";
    await ctx.cargarHistorialRemoto();
    assert.equal(lecturasLocales, 1);
    obtener("#fuenteHistorial").value = "sheets";
    ctx.api.listar = () => {peticiones++; return new Promise(r => {resolver = r;});};
    const antes = peticiones;
    const carga = ctx.cargarHistorialRemoto();
    await ctx.cargarHistorialRemoto();
    assert.equal(peticiones, antes + 1);
    resolver([]); await carga;
    assert.equal(datos().registros.length, 0);
    assert.equal(obtener("#recargarHistorial").disabled, false);
    console.log("PASS: historial remoto, solo cerradas, adaptación, errores, archivo separado y doble consulta.");
})().catch(e => {console.error(e); process.exitCode = 1;});
