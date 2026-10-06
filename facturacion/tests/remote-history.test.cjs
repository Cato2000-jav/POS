const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
const nodos = new Map();
function nodo() { return {value: "sheets", disabled: false, dataset: {}, children: [], addEventListener() {}, replaceChildren() {this.children = [];}, appendChild(hijo) {this.children.push(hijo);}}; }
function obtener(id) {if (!nodos.has(id)) nodos.set(id, nodo()); return nodos.get(id);}
const cerrada = {id: "v-1", estado: "cerrada", fecha: "2026-09-29T12:00:00Z", persona: "Ana",
    subtotal: 100, iva: 19, total: 119, metodoPago: "Nequi", valorRecibido: "", cambio: "",
    itemsJson: [{id: "p-1", nombre: "Cuaderno", cantidad: 1, precio: 100, subtotal: 100}]};
let lecturasLocales = 0, peticiones = 0, resolver;
const ctx = vm.createContext({document: {querySelector: obtener, createElement: nodo}, renderHistorial() {},
    leerHistorialAnterior: () => {lecturasLocales++; return [{id: "vieja"}];},
    api: {listar: async () => {peticiones++; return [cerrada, {...cerrada, estado: "abierta", id: "borrador", metodoPago: "Efectivo"}];}}});
for (const archivo of ["sales-data.js", "remote-history.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), ctx);
const datos = () => vm.runInContext("historialConsulta", ctx);
(async () => {
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros.length, 2);
    assert.equal(obtener("#estadoHistorial").dataset.tipoMensaje, "success");
    assert.equal(datos().registros[1].estado, "abierta");
    assert.equal(datos().registros[1].dineroRecibido, null);
    assert.throws(() => ctx.adaptarVentaCerrada({...cerrada, estado:"abierta"}));
    assert.equal(datos().registros[0].productos[0].nombre, "Cuaderno");
    assert.equal(datos().registros[0].dineroRecibido, null);
    assert.equal(lecturasLocales, 0);
    const anterior = datos().registros;
    ctx.api.listar = async () => {throw new Error("Sin conexión");};
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros, anterior);
    assert.match(obtener("#estadoHistorial").textContent, /última carga/);
    assert.equal(obtener("#estadoHistorial").dataset.tipoMensaje, "error");
    ctx.api.listar = async () => [{...cerrada, itemsJson: []}];
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros.length, 0);
    assert.equal(datos().incidencias.length, 1);
    assert.equal(obtener("#incidenciasHistorial").hidden, false);
    // Reproduce los cinco borradores antiguos incompletos sin bloquear dos cerradas válidas.
    const incompletas = Array.from({length:5}, (_, i) => ({id:`vieja-${i}`,estado:"abierta",fecha:"",subtotal:"",iva:"",total:"",itemsJson:[{id:"p-1",cantidad:1}]}));
    const lote = [...incompletas, cerrada, {...cerrada,id:"v-2",fecha:"2026-09-29T13:00:00Z"}];
    const original = JSON.stringify(lote);
    ctx.api.listar = async () => lote;
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros.length, 2); assert.equal(datos().registros[0].id, "v-2");
    assert.equal(datos().incidencias.length, 5);
    assert.equal(obtener("#estadoHistorial").dataset.tipoMensaje, "warning");
    assert.match(datos().incidencias[0], /vieja-0: fecha ausente.*subtotal.*iva.*total/);
    assert.equal(JSON.stringify(lote), original);
    assert.equal(obtener("#listaIncidenciasHistorial").children.length, 5);
    const mezcla = ctx.revisarVentasHistorial([cerrada,{...cerrada},null,{...cerrada,id:"segura"}]);
    assert.equal(mezcla.registros.length, 1); assert.equal(mezcla.registros[0].id,"segura");
    assert.equal(mezcla.incidencias.length, 3);
    assert.match(mezcla.incidencias[0], /duplicado/);
    ctx.api.listar = async () => {throw new Error("Sin conexión");};
    const ultimaLista = datos().registros;
    await ctx.cargarHistorialRemoto();
    assert.equal(datos().registros, ultimaLista); assert.equal(datos().incidencias.length, 5);
    obtener("#fuenteHistorial").value = "anterior";
    await ctx.cargarHistorialRemoto();
    assert.equal(lecturasLocales, 1);
    assert.equal(obtener("#estadoHistorial").dataset.tipoMensaje, "info");
    assert.equal(obtener("#incidenciasHistorial").hidden, true);
    obtener("#fuenteHistorial").value = "sheets";
    ctx.api.listar = () => {peticiones++; return new Promise(r => {resolver = r;});};
    const antes = peticiones;
    const carga = ctx.cargarHistorialRemoto();
    assert.equal(obtener("#estadoHistorial").dataset.tipoMensaje, "loading");
    await ctx.cargarHistorialRemoto();
    assert.equal(peticiones, antes + 1);
    resolver([]); await carga;
    assert.equal(datos().registros.length, 0);
    assert.equal(datos().incidencias.length, 0);
    assert.equal(obtener("#incidenciasHistorial").hidden, true);
    assert.equal(obtener("#recargarHistorial").disabled, false);
    console.log("PASS: historial remoto, abiertas y cerradas, adaptación, errores, archivo separado y doble consulta.");
})().catch(e => {console.error(e); process.exitCode = 1;});
