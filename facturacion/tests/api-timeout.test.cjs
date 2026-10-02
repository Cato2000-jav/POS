const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path"), assert = require("node:assert/strict");
(async () => {
    let abortar, limpio = 0;
    const ctx = vm.createContext({URL, AbortController, setTimeout: f => {abortar = f; return 1;}, clearTimeout: () => {limpio++;},
        fetch: (url, opciones) => new Promise((resolve, reject) => opciones.signal.addEventListener("abort", () => reject(new Error("Abortado"))))});
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../api.js"), "utf8"), ctx);
    const solicitud = vm.runInContext('api.guardar("compras", "crear", {id:"c-1"})', ctx);
    abortar(); await assert.rejects(solicitud, error => !error.codigo && /No se pudo confirmar/.test(error.message));
    assert.equal(limpio, 1);
    ctx.fetch = async () => ({ok: true, json: async () => ({success: true, data: []})});
    await vm.runInContext('api.listar("compras")', ctx); assert.equal(limpio, 2);
    ctx.fetch = async (url, opciones) => {
        assert.equal(JSON.parse(opciones.body).action, "import");
        assert.match(url, /resource=ventas/);
        return {ok: true, json: async () => ({success: true, data: {id: "mvp1-1"}})};
    };
    await vm.runInContext('api.guardar("ventas", "importar", {origenId:"1",venta:{}})', ctx);
    await assert.rejects(vm.runInContext('api.guardar("compras", "importar", {})', ctx), /Solo se importan/);
    console.log("PASS: timeout de API mantiene POST incierto y libera temporizador.");
})().catch(error => {console.error(error); process.exitCode = 1;});
