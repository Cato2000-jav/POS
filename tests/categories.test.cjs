// Pruebas locales: no realizan peticiones ni modifican Google Sheets.
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");

function preparar() {
    const elementos = new Map();
    const controles = [];
    function elemento() {
        const nodo = {
            value: "", textContent: "", disabled: false, children: [], eventos: {},
            classList: { add() {}, remove() {} },
            replaceChildren() { this.children = []; },
            appendChild(hijo) { this.children.push(hijo); },
            append(...hijos) { this.children.push(...hijos); },
            setAttribute() {}, focus() {},
            addEventListener(tipo, fn) { this.eventos[tipo] = fn; },
            querySelectorAll() {
                return controles.filter(control => control !== elementos.get("#recargarCategorias"));
            }
        };
        controles.push(nodo);
        return nodo;
    }
    const llamadas = [];
    const servicio = {
        listar: async () => [],
        guardar: async (recurso, accion, datos) => ({ ...datos })
    };
    const contexto = vm.createContext({
        document: {
            querySelector(selector) {
                if (!elementos.has(selector)) elementos.set(selector, elemento());
                return elementos.get(selector);
            },
            createElement: elemento
        },
        crypto: { randomUUID: () => "id-prueba" },
        window: { confirm: () => true },
        api: {
            listar: (...args) => servicio.listar(...args),
            guardar: (...args) => { llamadas.push(args); return servicio.guardar(...args); }
        }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../categories.js"), "utf8"), contexto);
    return {
        contexto, servicio, llamadas, elementos,
        guardar: () => contexto.guardarCategoriaFormulario({ preventDefault() {} }),
        estado: () => vm.runInContext("categoriasEstado", contexto)
    };
}

(async function probar() {
    const prueba = preparar();
    const { contexto, servicio, llamadas, elementos } = prueba;
    await contexto.cargarCategorias();
    elementos.get("#nombreCategoria").value = "   ";
    await prueba.guardar();
    assert.equal(llamadas.length, 0);

    elementos.get("#nombreCategoria").value = " Papel ";
    let resolver;
    servicio.guardar = () => new Promise(resolve => { resolver = resolve; });
    const pendiente = prueba.guardar();
    await prueba.guardar();
    assert.equal(llamadas.length, 1, "doble envío bloqueado");
    assert.equal(elementos.get("#guardarCategoria").disabled, true);
    assert.equal(prueba.estado().registros.length, 0, "no hay creación optimista");
    resolver({ id: "id-prueba", nombre: "Papel" });
    await pendiente;
    assert.equal(prueba.estado().registros.length, 1);
    assert.equal(elementos.get("#nombreCategoria").value, "");
    assert.equal(elementos.get("#guardarCategoria").disabled, false);

    contexto.editarCategoria(prueba.estado().registros[0]);
    elementos.get("#nombreCategoria").value = "Papeles";
    servicio.guardar = async () => { throw new Error("Sin conexión"); };
    await prueba.guardar();
    assert.equal(prueba.estado().registros[0].nombre, "Papel");
    assert.equal(elementos.get("#nombreCategoria").value, "Papeles");
    servicio.guardar = async (recurso, accion, datos) => ({ ...datos });
    await prueba.guardar();
    assert.equal(llamadas.at(-1)[1], "actualizar");
    assert.equal(prueba.estado().registros[0].nombre, "Papeles");

    const categoria = prueba.estado().registros[0];
    servicio.guardar = async () => { throw new Error("Tiene productos asociados"); };
    await contexto.eliminarCategoria(categoria);
    assert.equal(prueba.estado().registros.length, 1);
    assert.match(elementos.get("#estadoCategorias").textContent, /productos asociados/);
    contexto.window.confirm = () => false;
    const antes = llamadas.length;
    await contexto.eliminarCategoria(categoria);
    assert.equal(llamadas.length, antes);
    contexto.window.confirm = () => true;
    servicio.guardar = async () => ({ id: "otra" });
    await contexto.eliminarCategoria(categoria);
    assert.equal(prueba.estado().registros.length, 1, "respuesta incorrecta no elimina");
    servicio.guardar = async () => ({ id: categoria.id });
    await contexto.eliminarCategoria(categoria);
    assert.equal(prueba.estado().registros.length, 0);

    elementos.get("#nombreCategoria").value = "Arte";
    servicio.guardar = async () => { throw new Error("Respuesta perdida"); };
    await prueba.guardar();
    await prueba.guardar();
    assert.equal(llamadas.at(-1)[2].id, llamadas.at(-2)[2].id, "reintento conserva ID");
    assert.equal(elementos.get("#nombreCategoria").value, "Arte");
    servicio.listar = async () => [{ id: "1", nombre: "<b>Arte</b>" }, { id: "2", nombre: "Papel" }];
    await contexto.cargarCategorias();
    assert.equal(elementos.get("#listaCategorias").children[0].children[0].textContent, "<b>Arte</b>");
    elementos.get("#buscarCategorias").value = " PAPEL ";
    contexto.renderCategorias();
    assert.equal(elementos.get("#listaCategorias").children.length, 1);
    servicio.listar = async () => { throw new Error("Sin conexión"); };
    await contexto.cargarCategorias();
    assert.equal(elementos.get("#guardarCategoria").disabled, true);
    assert.equal(elementos.get("#recargarCategorias").disabled, false);
    console.log("PASS: CRUD confirmado, búsqueda, errores, asociaciones, cancelación, doble envío y reintento con el mismo ID.");
})().catch(error => { console.error(error); process.exitCode = 1; });
