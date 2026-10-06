// Prueba los manejadores reales con API simulada: no elimina registros en Sheets.
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
const casos = [
    ["categories.js", "eliminarCategoria", "categoriasEstado", "mensajeCategorias", "bloquearCategorias", "renderCategorias", "limpiarCategoria", "cargando", "cargadas", "categorias"],
    ["suppliers.js", "eliminarProveedor", "proveedoresEstado", "mensajeProveedores", "bloquearProveedores", "renderProveedores", "limpiarProveedor", "ocupado", "cargados", "proveedores"],
    ["customers.js", "eliminarCliente", "clientesEstado", "mensajeClientes", "bloquearClientes", "renderClientes", "limpiarCliente", "ocupado", "cargados", "clientes"]
];
const tick = () => new Promise(resolve => setImmediate(resolve));
const limite = setTimeout(() => {console.error("FAIL: eliminación individual no terminó."); process.exit(1);}, 3000);
(async () => {
    for (const [archivo, funcion, variable, mensaje, bloquear, render, limpiar, ocupado, cargado, recurso] of casos) {
        const registro = {id:"r-1",nombre:"Prueba"};
        const estado = {registros:[registro], [ocupado]:false, [cargado]:true, editandoId:null};
        let resolverConfirmacion, resolverApi, peticiones = 0;
        const ctx = vm.createContext({[variable]:estado,
            [mensaje]:{textContent:"",classList:{add(){},remove(){}}},
            [bloquear]:valor => {estado[ocupado] = valor;}, [render](){}, [limpiar](){},
            confirmarAccion: () => new Promise(r => {resolverConfirmacion = r;}),
            api:{guardar:async (r,a,d) => {peticiones++; assert.equal(r,recurso); assert.equal(a,"eliminar"); assert.equal(d.id,"r-1"); return new Promise(resolve => {resolverApi = resolve;});}}
        });
        const fuente = fs.readFileSync(path.join(__dirname,"..",archivo),"utf8");
        const inicio = fuente.indexOf(`async function ${funcion}(`);
        vm.runInContext(fuente.slice(inicio,fuente.indexOf("\n}",inicio)+2),ctx);
        let operacion = ctx[funcion](registro);
        resolverConfirmacion(false); await operacion; assert.equal(peticiones,0);
        operacion = ctx[funcion](registro);
        estado.registros = []; resolverConfirmacion(true); await operacion;
        assert.equal(peticiones,0); assert.match(ctx[mensaje].textContent,/ya no está/);
        estado.registros = [registro];
        operacion = ctx[funcion](registro);
        estado[cargado] = false; resolverConfirmacion(true); await operacion; assert.equal(peticiones,0);
        estado[cargado] = true;
        operacion = ctx[funcion](registro); resolverConfirmacion(true);
        await tick();
        await ctx[funcion](registro); assert.equal(peticiones,1);
        assert.equal(estado.registros.length,1); assert.equal(estado[ocupado],true);
        resolverApi({id:"otro"}); await operacion;
        assert.equal(estado.registros.length,1); assert.equal(estado[ocupado],false);
        assert.match(ctx[mensaje].textContent,/Actualiza/);
        operacion = ctx[funcion](registro); resolverConfirmacion(true); await tick();
        resolverApi({id:"r-1"}); await operacion;
        assert.equal(estado.registros.length,0); assert.equal(estado[ocupado],false);
    }
    console.log("PASS: eliminación individual en categorías/proveedores/clientes, cancelar, lista cambiada, doble clic y confirmación por ID.");
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => clearTimeout(limite));
