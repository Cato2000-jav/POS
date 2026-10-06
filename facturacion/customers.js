// CRUD de clientes. Solo la API confirma los cambios; no usa localStorage.
const clientesEstado = { registros: [], ocupado: false, cargados: false, editandoId: null, nuevoId: null };
const panelClientes = document.querySelector("#panelClientes");
const mensajeClientes = document.querySelector("#estadoClientes");
const formCliente = document.querySelector("#formCliente");
const buscarClientes = document.querySelector("#buscarClientes");
const campoCliente = nombre => document.querySelector("#cliente" + nombre);

function normalizarCliente(registro) {
    if (!registro || !["string", "number"].includes(typeof registro.id) ||
        !String(registro.id).trim() || (typeof registro.id === "number" && !Number.isFinite(registro.id)) ||
        typeof registro.nombre !== "string" || !registro.nombre.trim() ||
        !["string", "number"].includes(typeof registro.telefono) || typeof registro.correo !== "string") {
        throw new Error("El cliente recibido no tiene los campos esperados.");
    }
    return { id: String(registro.id), nombre: registro.nombre,
        telefono: String(registro.telefono), correo: registro.correo };
}

function bloquearClientes(ocupado) {
    clientesEstado.ocupado = ocupado;
    panelClientes.setAttribute("aria-busy", String(ocupado));
    panelClientes.querySelectorAll("input, button").forEach(control => {
        control.disabled = ocupado || (!clientesEstado.cargados && control.id !== "recargarClientes");
    });
}

function limpiarCliente() {
    clientesEstado.editandoId = null;
    clientesEstado.nuevoId = null;
    formCliente.reset();
    document.querySelector("#etiquetaCliente").textContent = "Nuevo cliente";
}

function editarCliente(cliente) {
    if (clientesEstado.ocupado) return;
    clientesEstado.editandoId = cliente.id;
    clientesEstado.nuevoId = null;
    for (const nombre of ["Nombre", "Telefono", "Correo"]) {
        campoCliente(nombre).value = cliente[nombre.toLowerCase()];
    }
    document.querySelector("#etiquetaCliente").textContent = "Editar cliente";
    campoCliente("Nombre").focus();
}

function renderClientes() {
    const lista = document.querySelector("#listaClientes");
    lista.replaceChildren();
    const termino = buscarClientes.value.trim().toLocaleLowerCase("es");
    const visibles = clientesEstado.registros.filter(p =>
        [p.nombre, p.telefono, p.correo].some(valor => valor.toLocaleLowerCase("es").includes(termino)));
    visibles.forEach(cliente => {
        const fila = document.createElement("li");
        const texto = document.createElement("span");
        texto.textContent = `${cliente.nombre} · ${cliente.telefono || "Sin teléfono"} · ${cliente.correo || "Sin correo"}`;
        const acciones = document.createElement("div");
        acciones.className = "categorias-acciones";
        for (const accion of ["Editar", "Eliminar"]) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = accion;
            boton.setAttribute("aria-label", accion + " " + cliente.nombre);
            boton.addEventListener("click", () => accion === "Editar" ? editarCliente(cliente) : eliminarCliente(cliente));
            acciones.appendChild(boton);
        }
        fila.append(texto, acciones);
        lista.appendChild(fila);
    });
    mensajeClientes.textContent = visibles.length ? `${visibles.length} cliente(es).` :
        (clientesEstado.registros.length ? "No hay coincidencias." : "No hay clientes registrados.");
}

async function cargarClientes() {
    if (clientesEstado.ocupado) return;
    bloquearClientes(true);
    mensajeClientes.textContent = "Cargando clientes…";
    try {
        const registros = (await api.listar("clientes")).map(normalizarCliente);
        if (new Set(registros.map(p => p.id)).size !== registros.length) throw new Error("Hay IDs duplicados.");
        clientesEstado.registros = registros;
        clientesEstado.cargados = true;
        renderClientes();
    } catch (error) {
        mensajeClientes.textContent = "No se pudo actualizar la lista: " + error.message + " Se conserva la última carga, si existe.";
    } finally { bloquearClientes(false); }
}

async function guardarClienteFormulario(evento) {
    evento.preventDefault();
    if (clientesEstado.ocupado || !clientesEstado.cargados) return;
    const nombre = campoCliente("Nombre").value.trim();
    const telefono = campoCliente("Telefono").value.trim();
    const correo = campoCliente("Correo").value.trim();
    if (!nombre || (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))) {
        mensajeClientes.textContent = "Escribe un nombre y, si incluyes correo, una dirección válida.";
        return;
    }
    bloquearClientes(true);
    mensajeClientes.textContent = "Guardando cliente…";
    try {
        const editando = clientesEstado.editandoId !== null;
        if (!editando && !clientesEstado.nuevoId) clientesEstado.nuevoId = crypto.randomUUID();
        const datos = { id: editando ? clientesEstado.editandoId : clientesEstado.nuevoId, nombre, telefono, correo };
        const resultado = normalizarCliente(await api.guardar("clientes", editando ? "actualizar" : "crear", datos));
        if (Object.keys(datos).some(clave => resultado[clave] !== datos[clave])) {
            throw new Error("La respuesta no confirma los datos. Actualiza la lista antes de reintentar.");
        }
        clientesEstado.registros = clientesEstado.registros.filter(p => p.id !== resultado.id);
        clientesEstado.registros.push(resultado);
        buscarClientes.value = "";
        limpiarCliente();
        renderClientes();
        mensajeClientes.textContent = "Cliente guardado en Google Sheets.";
        if (typeof invalidarClientesVenta === "function") invalidarClientesVenta();
    } catch (error) {
        mensajeClientes.textContent = "No se confirmó el guardado: " + error.message;
    } finally { bloquearClientes(false); }
}

async function eliminarCliente(cliente) {
    if (clientesEstado.ocupado || !clientesEstado.cargados) return;
    if (!await confirmarAccion(`¿Eliminar el cliente «${cliente.nombre}»? No se eliminará si tiene ventas asociadas.`, {peligro: true})) return;
    if (clientesEstado.ocupado) return;
    bloquearClientes(true);
    mensajeClientes.textContent = "Eliminando cliente…";
    try {
        // El servicio verifica ventas.clienteId dentro del bloqueo de doPost.
        const resultado = await api.guardar("clientes", "eliminar", {id: cliente.id});
        if (!resultado || String(resultado.id) !== cliente.id) throw new Error("Respuesta no confirmada. Actualiza la lista.");
        clientesEstado.registros = clientesEstado.registros.filter(p => p.id !== cliente.id);
        if (clientesEstado.editandoId === cliente.id) limpiarCliente();
        renderClientes();
        mensajeClientes.textContent = "Cliente eliminado.";
        if (typeof invalidarClientesVenta === "function") invalidarClientesVenta();
    } catch (error) {
        mensajeClientes.textContent = "No se confirmó la eliminación: " + error.message;
    } finally { bloquearClientes(false); }
}

document.querySelector("#btnClientes").addEventListener("click", () => {
    panelClientes.hidden = !panelClientes.hidden;
    document.querySelector("#btnClientes").setAttribute("aria-expanded", String(!panelClientes.hidden));
    if (!panelClientes.hidden) cargarClientes();
});
document.querySelector("#recargarClientes").addEventListener("click", cargarClientes);
document.querySelector("#cancelarCliente").addEventListener("click", () => {
    if (!clientesEstado.ocupado) limpiarCliente();
});
formCliente.addEventListener("submit", guardarClienteFormulario);
buscarClientes.addEventListener("input", () => {
    if (!clientesEstado.ocupado && clientesEstado.cargados) renderClientes();
});
