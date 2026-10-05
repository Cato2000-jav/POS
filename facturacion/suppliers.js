// CRUD de proveedores. Solo la API confirma los cambios; no usa localStorage.
const proveedoresEstado = { registros: [], ocupado: false, cargados: false, editandoId: null, nuevoId: null };
const panelProveedores = document.querySelector("#panelProveedores");
const mensajeProveedores = document.querySelector("#estadoProveedores");
const formProveedor = document.querySelector("#formProveedor");
const buscarProveedores = document.querySelector("#buscarProveedores");
const campoProveedor = nombre => document.querySelector("#proveedor" + nombre);

function normalizarProveedor(registro) {
    if (!registro || !["string", "number"].includes(typeof registro.id) ||
        !String(registro.id).trim() || (typeof registro.id === "number" && !Number.isFinite(registro.id)) ||
        typeof registro.nombre !== "string" || !registro.nombre.trim() ||
        !["string", "number"].includes(typeof registro.telefono) || typeof registro.correo !== "string") {
        throw new Error("El proveedor recibido no tiene los campos esperados.");
    }
    return { id: String(registro.id), nombre: registro.nombre,
        telefono: String(registro.telefono), correo: registro.correo };
}

function bloquearProveedores(ocupado) {
    proveedoresEstado.ocupado = ocupado;
    panelProveedores.setAttribute("aria-busy", String(ocupado));
    panelProveedores.querySelectorAll("input, button").forEach(control => {
        control.disabled = ocupado || (!proveedoresEstado.cargados && control.id !== "recargarProveedores");
    });
}

function limpiarProveedor() {
    proveedoresEstado.editandoId = null;
    proveedoresEstado.nuevoId = null;
    formProveedor.reset();
    document.querySelector("#etiquetaProveedor").textContent = "Nuevo proveedor";
}

function editarProveedor(proveedor) {
    if (proveedoresEstado.ocupado) return;
    proveedoresEstado.editandoId = proveedor.id;
    proveedoresEstado.nuevoId = null;
    for (const nombre of ["Nombre", "Telefono", "Correo"]) {
        campoProveedor(nombre).value = proveedor[nombre.toLowerCase()];
    }
    document.querySelector("#etiquetaProveedor").textContent = "Editar proveedor";
    campoProveedor("Nombre").focus();
}

function renderProveedores() {
    const lista = document.querySelector("#listaProveedores");
    lista.replaceChildren();
    const termino = buscarProveedores.value.trim().toLocaleLowerCase("es");
    const visibles = proveedoresEstado.registros.filter(p =>
        [p.nombre, p.telefono, p.correo].some(valor => valor.toLocaleLowerCase("es").includes(termino)));
    visibles.forEach(proveedor => {
        const fila = document.createElement("li");
        const texto = document.createElement("span");
        texto.textContent = `${proveedor.nombre} · ${proveedor.telefono || "Sin teléfono"} · ${proveedor.correo || "Sin correo"}`;
        const acciones = document.createElement("div");
        acciones.className = "categorias-acciones";
        for (const accion of ["Editar", "Eliminar"]) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = accion;
            boton.setAttribute("aria-label", accion + " " + proveedor.nombre);
            boton.addEventListener("click", () => accion === "Editar" ? editarProveedor(proveedor) : eliminarProveedor(proveedor));
            acciones.appendChild(boton);
        }
        fila.append(texto, acciones);
        lista.appendChild(fila);
    });
    mensajeProveedores.textContent = visibles.length ? `${visibles.length} proveedor(es).` :
        (proveedoresEstado.registros.length ? "No hay coincidencias." : "No hay proveedores registrados.");
}

async function cargarProveedores() {
    if (proveedoresEstado.ocupado) return;
    bloquearProveedores(true);
    mensajeProveedores.textContent = "Cargando proveedores…";
    try {
        const registros = (await api.listar("proveedores")).map(normalizarProveedor);
        if (new Set(registros.map(p => p.id)).size !== registros.length) throw new Error("Hay IDs duplicados.");
        proveedoresEstado.registros = registros;
        proveedoresEstado.cargados = true;
        renderProveedores();
    } catch (error) {
        mensajeProveedores.textContent = "No se pudo actualizar la lista: " + error.message + " Se conserva la última carga, si existe.";
    } finally { bloquearProveedores(false); }
}

async function guardarProveedorFormulario(evento) {
    evento.preventDefault();
    if (proveedoresEstado.ocupado || !proveedoresEstado.cargados) return;
    const nombre = campoProveedor("Nombre").value.trim();
    const telefono = campoProveedor("Telefono").value.trim();
    const correo = campoProveedor("Correo").value.trim();
    if (!nombre || (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))) {
        mensajeProveedores.textContent = "Escribe un nombre y, si incluyes correo, una dirección válida.";
        return;
    }
    bloquearProveedores(true);
    mensajeProveedores.textContent = "Guardando proveedor…";
    try {
        const editando = proveedoresEstado.editandoId !== null;
        if (!editando && !proveedoresEstado.nuevoId) proveedoresEstado.nuevoId = crypto.randomUUID();
        const datos = { id: editando ? proveedoresEstado.editandoId : proveedoresEstado.nuevoId, nombre, telefono, correo };
        const resultado = normalizarProveedor(await api.guardar("proveedores", editando ? "actualizar" : "crear", datos));
        if (Object.keys(datos).some(clave => resultado[clave] !== datos[clave])) {
            throw new Error("La respuesta no confirma los datos. Actualiza la lista antes de reintentar.");
        }
        proveedoresEstado.registros = proveedoresEstado.registros.filter(p => p.id !== resultado.id);
        proveedoresEstado.registros.push(resultado);
        buscarProveedores.value = "";
        limpiarProveedor();
        renderProveedores();
        mensajeProveedores.textContent = "Proveedor guardado en Google Sheets.";
    } catch (error) {
        mensajeProveedores.textContent = "No se confirmó el guardado: " + error.message;
    } finally { bloquearProveedores(false); }
}

async function eliminarProveedor(proveedor) {
    if (proveedoresEstado.ocupado || !proveedoresEstado.cargados) return;
    if (!window.confirm(`¿Eliminar el proveedor «${proveedor.nombre}»?`)) return;
    bloquearProveedores(true);
    mensajeProveedores.textContent = "Eliminando proveedor…";
    try {
        // El servicio verifica compras.proveedorId dentro del bloqueo de doPost.
        const resultado = await api.guardar("proveedores", "eliminar", {id: proveedor.id});
        if (!resultado || String(resultado.id) !== proveedor.id) throw new Error("Respuesta no confirmada. Actualiza la lista.");
        proveedoresEstado.registros = proveedoresEstado.registros.filter(p => p.id !== proveedor.id);
        if (proveedoresEstado.editandoId === proveedor.id) limpiarProveedor();
        renderProveedores();
        mensajeProveedores.textContent = "Proveedor eliminado.";
    } catch (error) {
        mensajeProveedores.textContent = "No se confirmó la eliminación: " + error.message;
    } finally { bloquearProveedores(false); }
}

document.querySelector("#btnProveedores").addEventListener("click", () => {
    panelProveedores.hidden = !panelProveedores.hidden;
    document.querySelector("#btnProveedores").setAttribute("aria-expanded", String(!panelProveedores.hidden));
    if (!panelProveedores.hidden) cargarProveedores();
});
document.querySelector("#recargarProveedores").addEventListener("click", cargarProveedores);
document.querySelector("#cancelarProveedor").addEventListener("click", () => {
    if (!proveedoresEstado.ocupado) limpiarProveedor();
});
formProveedor.addEventListener("submit", guardarProveedorFormulario);
buscarProveedores.addEventListener("input", () => {
    if (!proveedoresEstado.ocupado && proveedoresEstado.cargados) renderProveedores();
});
