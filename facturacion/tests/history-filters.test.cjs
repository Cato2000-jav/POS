const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
const nodos = new Map();
const nodo = id => { if (!nodos.has(id)) nodos.set(id, {value: "", eventos: {}, addEventListener(n, f) {this.eventos[n] = f;}}); return nodos.get(id); };
let aviso = "", temporizador, renders = 0;
const ctx = vm.createContext({document: {getElementById: nodo}, setTimeout: f => {temporizador = f;},
    mostrarNotificacion: texto => {aviso = texto;}, obtenerHistorial: () => [{id:"a",estado:"abierta"}]});
for (const archivo of ["history-filters.js", "sales-data.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", archivo), "utf8"), ctx);
const registros = [
    {id:"a",fechaFiltro:"2026-10-06",metodoPago:"Debe",clienteNombre:"María López",clienteId:"c1",estado:"abierta"},
    {id:"b",fechaFiltro:"2026-10-07",metodoPago:"Nequi",clienteNombre:"María López",clienteId:"c2",estado:"cerrada"},
    {id:"c",fecha:"6/10/2026",metodoPago:"Efectivo"}
];
const original = JSON.stringify(registros);
const ids = filtros => Array.from(ctx.filtrarHistorial(registros, filtros), v => v.id);
assert.deepEqual(ids({}), ["a","b","c"]);
assert.deepEqual(ids({desde:"2026-10-06",hasta:"2026-10-06",pago:"Debe",cliente:"maria lopez",estado:"abierta"}), ["a"]);
assert.deepEqual(ids({cliente:"c2"}), ["b"]);
assert.deepEqual(ids({estado:"cerrada"}), ["b","c"]);
assert.deepEqual(ids({desde:"2026-10-08",hasta:"2026-10-06"}), []);
assert.deepEqual(ids({cliente:"inexistente"}), []);
assert.equal(JSON.stringify(registros), original);
assert.equal(ctx.filtrarHistorial([{fecha:"2026-10-06",proveedorId:"s1"}], {proveedor:"s1",hasta:"2026-10-06"}).length, 1);
assert.equal(ctx.filtrarHistorial([{fecha:"2026-10-06",proveedorId:"s1"}], {proveedor:"s2"}).length, 0);
const base = {id:"v",estado:"abierta",fecha:"2026-10-07T02:00:00Z",subtotal:100,iva:19,total:119,metodoPago:"Efectivo",
    itemsJson:[{nombre:"Cuaderno",cantidad:1,precio:100,subtotal:100}]};
assert.equal(ctx.adaptarVentaHistorial(base).fechaFiltro, "2026-10-06");
assert.equal(ctx.adaptarVentaHistorial(base).dineroRecibido, null);
assert.throws(() => ctx.adaptarVentaCerrada(base));
ctx.prepararFiltrosHistorial("filtrosVentas", () => renders++);
nodo("filtrosVentas-cliente").value = "María";
nodo("filtrosVentas").eventos.input(); assert.equal(renders, 1);
assert.equal(ctx.leerFiltrosHistorial("filtrosVentas").cliente, "María");
nodo("filtrosVentas").eventos.reset(); temporizador();
assert.equal(nodo("filtrosVentas-cliente").value, ""); assert.equal(renders, 2);
// La protección de impresión funciona incluso con una llamada directa al manejador.
const historial = fs.readFileSync(path.join(__dirname, "../Historial_de_ventas.js"), "utf8");
vm.runInContext(historial.slice(historial.indexOf("const imprimirVentaHistorica ="), historial.indexOf("const mostrarNotificacion =")), ctx);
vm.runInContext('imprimirVentaHistorica("a")', ctx);
assert.match(aviso, /está abierta/);
console.log("PASS: filtros combinados, fechas inclusivas/Bogotá, cliente, estado, proveedor, reset e impresión bloqueada para abiertas.");
