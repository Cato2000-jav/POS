const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
const nodos = new Map();
const nodo = id => {if (!nodos.has(id)) nodos.set(id, {textContent: "", disabled: false, hijos: [], addEventListener() {}, replaceChildren() {this.hijos = [];}, appendChild(n) {this.hijos.push(n);}}); return nodos.get(id);};
const venta = {id: 123, fecha: "22/09/2026", hora: "3:16 p. m.", persona: "Ana", metodoPago: "Nequi",
    subtotal: 100, iva: 19, total: 119, productos: [{id: 1, nombre: "Cuaderno", cantidad: 2, precio: 50, subtotal: 100}]};
const ctx = vm.createContext({document: {querySelector: nodo, createElement: () => ({})},
    leerHistorialAnterior: () => [venta], api: {listar: async () => []}});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../migration-preview.js"), "utf8"), ctx);
const analizar = ctx.analizarHistorialAnterior;
const original = JSON.stringify(venta);
assert.equal(analizar([venta], [])[0].estado, "Candidato a migración");
assert.equal(analizar([venta], [{id: "123", estado: "abierta"}])[0].estado, "Posible duplicado");
assert.equal(analizar([venta], [{id: "mvp1-123", estado: "cerrada"}])[0].estado, "Posible duplicado");
assert.equal(analizar([venta], [{...venta, id: "otro", estado: "cerrada", itemsJson: venta.productos}])[0].estado, "Posible duplicado");
assert.equal(analizar([venta, venta], [])[0].estado, "Requiere corrección");
for (const cambio of [{productos: []}, {total: 999}, {hora: ""}, {metodoPago: "Debe"}, {metodoPago: "Efectivo"}]) {
    assert.equal(analizar([{...venta, ...cambio}], [])[0].estado, "Requiere corrección");
}
assert.equal(analizar([{...venta, metodoPago: "Efectivo", dineroRecibido: 120, cambio: 1}], [])[0].estado, "Candidato a migración");
assert.equal(analizar([null], [])[0].estado, "Requiere corrección");
assert.throws(() => analizar([venta], [{id: "x", estado: "extraño"}]));
assert.equal(JSON.stringify(venta), original);
(async () => {
    let lecturas = 0, resolver;
    ctx.api.listar = () => {lecturas++; return new Promise(r => {resolver = r;});};
    const primera = ctx.prepararVistaMigracion(); await ctx.prepararVistaMigracion();
    assert.equal(lecturas, 1); assert.equal(nodo("#revisarMigracion").disabled, true);
    resolver([]); await primera;
    assert.equal(nodo("#listaMigracion").hijos.length, 1);
    assert.equal(nodo("#revisarMigracion").disabled, false);
    ctx.api.listar = async () => {throw new Error("Sin conexión");};
    await ctx.prepararVistaMigracion(); assert.match(nodo("#estadoMigracion").textContent, /Sin conexión/);
    assert.equal(nodo("#listaMigracion").hijos.length, 0);
    ctx.leerHistorialAnterior = () => [];
    await ctx.prepararVistaMigracion(); assert.match(nodo("#estadoMigracion").textContent, /otro navegador/);
    ctx.leerHistorialAnterior = () => null;
    await ctx.prepararVistaMigracion(); assert.match(nodo("#estadoMigracion").textContent, /no se pudo leer/);
    console.log("PASS: revisión sin escrituras, candidatos, errores, posibles duplicados, doble clic y archivo ausente/corrupto.");
})().catch(error => {console.error(error); process.exitCode = 1;});
