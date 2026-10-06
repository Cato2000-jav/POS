// Selección para la venta, separada del formulario CRUD de clientes.
const clientesVentaEstado = { registros: [], cargando: false, disponibles: false, revision: 0 };
const clienteVenta = document.querySelector("#clienteVenta");

function invalidarClientesVenta() {
    clientesVentaEstado.revision++;
    clientesVentaEstado.disponibles = false;
    clienteVenta.disabled = true;
    document.querySelector("#estadoClientesVenta").textContent = "Los clientes cambiaron. Pulsa Actualizar clientes antes de seleccionar uno.";
}

async function cargarClientesVenta() {
    if (clientesVentaEstado.cargando) return;
    const boton = document.querySelector("#recargarClientesVenta");
    const mensaje = document.querySelector("#estadoClientesVenta");
    const seleccionado = clienteVenta.value;
    const revision = clientesVentaEstado.revision;
    clientesVentaEstado.cargando = true;
    clientesVentaEstado.disponibles = false;
    clienteVenta.disabled = true;
    boton.disabled = true;
    mensaje.textContent = "Cargando clientes…";
    try {
        const registros = (await api.listar("clientes")).map(normalizarCliente);
        if (revision !== clientesVentaEstado.revision) throw new Error("Los clientes cambiaron durante la consulta");
        if (new Set(registros.map(c => c.id)).size !== registros.length) throw new Error("Hay IDs de clientes duplicados.");
        clientesVentaEstado.registros = registros;
        clienteVenta.replaceChildren();
        const sinCliente = document.createElement("option");
        sinCliente.value = "";
        sinCliente.textContent = "Sin cliente";
        clienteVenta.appendChild(sinCliente);
        registros.forEach(cliente => {
            const opcion = document.createElement("option");
            opcion.value = cliente.id;
            opcion.textContent = cliente.nombre;
            clienteVenta.appendChild(opcion);
        });
        clienteVenta.value = registros.some(c => c.id === seleccionado) ? seleccionado : "";
        clientesVentaEstado.disponibles = true;
        mensaje.textContent = seleccionado && !clienteVenta.value
            ? "El cliente seleccionado ya no está disponible. Selecciona otro antes de continuar."
            : (registros.length ? "Clientes cargados." : "No hay clientes. Regístralos en el panel Clientes y actualiza esta lista.");
    } catch (error) {
        mensaje.textContent = "No se pudieron cargar los clientes: " + error.message + ". Reintenta con Actualizar clientes.";
    } finally {
        clientesVentaEstado.cargando = false;
        clienteVenta.disabled = !clientesVentaEstado.disponibles;
        boton.disabled = false;
    }
}

// Devuelve una copia pequeña para la factura; nunca una referencia al CRUD.
function obtenerClienteVenta() {
    if (clientesVentaEstado.cargando) throw new Error("Espera a que termine la carga de clientes.");
    const obligatorio = metodoPago.value === "debe";
    if (!clienteVenta.value) {
        if (obligatorio) throw new Error("Para una venta con pago Debe debes seleccionar un cliente.");
        return {clienteId: "", clienteNombre: ""};
    }
    if (!clientesVentaEstado.disponibles) throw new Error("Actualiza los clientes antes de confirmar la venta.");
    const cliente = clientesVentaEstado.registros.find(c => c.id === clienteVenta.value);
    if (!cliente) throw new Error("El cliente seleccionado no está disponible.");
    return {clienteId: cliente.id, clienteNombre: cliente.nombre};
}

document.querySelector("#recargarClientesVenta").addEventListener("click", cargarClientesVenta);
