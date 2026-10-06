const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
let guardados = 0, cierres = 0, fallo = false, cambioPrecio = false;
const estado = {ocupado: false, id: null, nuevoId: null, firmaGuardada: null, cierrePendiente: null};
const ctx = vm.createContext({ventasAbiertasEstado: estado, comprobarDisponibilidadAbiertas: () => true,
    validarVenta: () => true, firmaVentaActual: () => "firma", calcularTotales: () => ({total: 119}), mostrarToast() {},
    guardarVentaAbiertaFormulario: async () => {
        guardados++;
        if (fallo) return;
        estado.id = "v-1"; estado.firmaGuardada = "firma";
        return {total: cambioPrecio ? 238 : 119};
    }, cerrarVentaRemota: async () => {cierres++;}
});
vm.runInContext(source.slice(source.indexOf("const generarFactura ="), source.indexOf("// Comparte presentación")), ctx);
const generar = () => vm.runInContext("generarFactura()", ctx);
(async () => {
    await generar(); assert.equal(guardados, 1); assert.equal(cierres, 1);
    await generar(); assert.equal(guardados, 1); assert.equal(cierres, 2);
    estado.id = null; fallo = true;
    await generar(); assert.equal(cierres, 2);
    fallo = false; cambioPrecio = true;
    await generar(); assert.equal(cierres, 2);
    estado.ocupado = true;
    await generar(); assert.equal(cierres, 2);
    estado.ocupado = false; estado.cierrePendiente = {id: "v-1"};
    await generar(); assert.equal(cierres, 3);
    assert.equal(source.slice(source.indexOf("const generarFactura ="), source.indexOf("// Comparte presentación")).includes("registrarVentaEnHistorial"), false);
    console.log("PASS: venta normal remota, abierta, fallo de guardado, cambio de total y recuperación del cierre.");
})().catch(e => {console.error(e); process.exitCode = 1;});
