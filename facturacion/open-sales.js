// Borradores remotos. El cierre y su recuperación se coordinan en close-sales.js.
const ventasAbiertasEstado = { ocupado: false, id: null, nuevoId: null, actualizadoEn: null, registros: [], firmaGuardada: null, cierrePendiente: null, recuperacionBloqueada: false };
const mensajeAbiertas = document.querySelector("#estadoVentasAbiertas");

function limpiarReferenciaAbierta() {
    if (ventasAbiertasEstado.cierrePendiente) return;
    ventasAbiertasEstado.id = null;
    ventasAbiertasEstado.nuevoId = null;
    ventasAbiertasEstado.actualizadoEn = null;
    ventasAbiertasEstado.firmaGuardada = null;
    botonGenerarFactura.disabled = false;
    botonGenerarFactura.textContent = "Generar factura";
}

function comprobarDisponibilidadAbiertas() {
    if (ventasAbiertasEstado.ocupado || ventasAbiertasEstado.recuperacionBloqueada) return false;
    if (ventasAbiertasEstado.cierrePendiente) {
        mensajeAbiertas.textContent = "Resuelve el cierre pendiente antes de cambiar de venta.";
        return false;
    }
    if (!formProducto.hidden) {
        mensajeAbiertas.textContent = "Cierra el formulario de producto antes de trabajar con ventas abiertas.";
        return false;
    }
    if (productosCargando || productosEditor.ocupado || clientesVentaEstado.cargando ||
        clientesEstado.ocupado || proveedoresEstado.ocupado || categoriasEstado.cargando) {
        mensajeAbiertas.textContent = "Espera a que termine la operación en curso.";
        return false;
    }
    return true;
}

function bloquearAbiertas(ocupado) {
    ventasAbiertasEstado.ocupado = ocupado;
    const bloqueado = ocupado || Boolean(ventasAbiertasEstado.cierrePendiente) || ventasAbiertasEstado.recuperacionBloqueada;
    // Conserva los controles internos (por ejemplo, un selector aún no cargado).
    for (const selector of [".layout", "#panelClientes", "#panelCategorias", "#panelProveedores"]) {
        document.querySelector(selector).inert = bloqueado;
    }
    botonIniciarFactura.disabled = bloqueado;
    botonHistorial.disabled = bloqueado;
    for (const selector of ["#btnClientes", "#btnCategorias", "#btnProveedores"]) {
        document.querySelector(selector).disabled = bloqueado;
    }
    document.querySelector("#guardarVentaAbierta").disabled = bloqueado;
    document.querySelector("#panelVentasAbiertas").querySelectorAll("button").forEach(b => {b.disabled = bloqueado;});
    const reintentar = document.querySelector("#reintentarCierre");
    reintentar.hidden = !ventasAbiertasEstado.cierrePendiente;
    reintentar.disabled = ocupado;
    botonGenerarFactura.disabled = bloqueado || Boolean(ventasAbiertasEstado.nuevoId);
    botonGenerarFactura.textContent = ventasAbiertasEstado.id ? "Cerrar venta en Sheets" : "Generar factura";
}

function validarAbierta(venta) {
    if (!venta || typeof venta.id !== "string" || !venta.id || venta.estado !== "abierta" ||
        typeof venta.actualizadoEn !== "string" || !Number.isFinite(Date.parse(venta.actualizadoEn)) ||
        typeof venta.persona !== "string" || typeof venta.clienteId !== "string" ||
        !Array.isArray(venta.itemsJson) || !venta.itemsJson.length ||
        typeof venta.total !== "number" || !Number.isFinite(venta.total) || venta.total < 0) {
        throw new Error("La venta abierta recibida no tiene los datos esperados.");
    }
    const ids = new Set();
    venta.itemsJson.forEach(item => {
        if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) ||
            !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
            typeof item.nombre !== "string" || typeof item.precio !== "number" ||
            !Number.isFinite(item.precio) || item.precio < 0) throw new Error("Detalle de venta inválido.");
        ids.add(item.id);
    });
    return venta;
}

function renderVentasAbiertas() {
    const lista = document.querySelector("#listaVentasAbiertas");
    lista.replaceChildren();
    ventasAbiertasEstado.registros.forEach(venta => {
        const fila = document.createElement("li");
        const texto = document.createElement("span");
        texto.textContent = `${venta.id} · ${venta.persona} · ${formatoMoneda.format(venta.total)}`;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "Retomar";
        boton.addEventListener("click", () => retomarVentaAbierta(venta.id));
        fila.append(texto, boton);
        lista.appendChild(fila);
    });
}

async function cargarVentasAbiertas() {
    if (!comprobarDisponibilidadAbiertas()) return;
    bloquearAbiertas(true);
    mensajeAbiertas.textContent = "Consultando ventas abiertas…";
    try {
        ventasAbiertasEstado.registros = (await api.listar("ventas")).filter(v => v.estado === "abierta").map(validarAbierta);
        renderVentasAbiertas();
        mensajeAbiertas.textContent = `${ventasAbiertasEstado.registros.length} venta(s) abierta(s).`;
    } catch (error) { mensajeAbiertas.textContent = "No se pudo consultar: " + error.message; }
    finally { bloquearAbiertas(false); }
}

async function guardarVentaAbiertaFormulario() {
    if (!comprobarDisponibilidadAbiertas()) return;
    bloquearAbiertas(true);
    try {
        if (!estado.facturaIniciada || !estado.facturaActual.length) throw new Error("Inicia la venta y agrega productos.");
        if (!trabajador.value.trim()) throw new Error("Indica el nombre del trabajador.");
        const cliente = obtenerClienteVenta();
        const metodo = metodoPago.options[metodoPago.selectedIndex].text.trim();
        if (!ventasAbiertasEstado.id && !ventasAbiertasEstado.nuevoId) ventasAbiertasEstado.nuevoId = crypto.randomUUID();
        const datos = {
            id: ventasAbiertasEstado.id || ventasAbiertasEstado.nuevoId, estado: "abierta",
            persona: trabajador.value.trim(), clienteId: cliente.clienteId, metodoPago: metodo,
            itemsJson: estado.facturaActual.map(item => ({id: item.id, cantidad: item.cantidad}))
        };
        if (ventasAbiertasEstado.id) datos.actualizadoEn = ventasAbiertasEstado.actualizadoEn;
        mensajeAbiertas.textContent = "Guardando venta abierta…";
        const venta = validarAbierta(await api.guardar("ventas", ventasAbiertasEstado.id ? "actualizar" : "crear", datos));
        if (venta.id !== datos.id) throw new Error("El servicio devolvió otra venta.");
        if (venta.clienteId !== datos.clienteId || venta.persona !== datos.persona ||
            venta.metodoPago !== datos.metodoPago || venta.itemsJson.length !== datos.itemsJson.length ||
            datos.itemsJson.some(item => !venta.itemsJson.some(i => i.id === item.id && i.cantidad === item.cantidad))) {
            throw new Error("La respuesta no confirma el detalle enviado.");
        }
        ventasAbiertasEstado.id = venta.id;
        ventasAbiertasEstado.nuevoId = null;
        ventasAbiertasEstado.actualizadoEn = venta.actualizadoEn;
        // El servicio recalcula con el catálogo: reflejar sus precios sin tocar stock.
        estado.productosDisponibles = estado.productosDisponibles.map(producto => {
            const item = venta.itemsJson.find(i => i.id === producto.id);
            return item ? {...producto, nombre: item.nombre, precio: item.precio} : producto;
        });
        ventasAbiertasEstado.registros = ventasAbiertasEstado.registros.filter(v => v.id !== venta.id);
        ventasAbiertasEstado.registros.push(venta);
        renderVentasAbiertas();
        renderProductos();
        renderFactura();
        ventasAbiertasEstado.firmaGuardada = firmaVentaActual();
        mensajeAbiertas.textContent = "Venta guardada abierta en Sheets. No se descontó inventario. Puedes cerrarla con Generar factura.";
        return venta;
    } catch (error) {
        mensajeAbiertas.textContent = "No se confirmó el guardado: " + error.message + " Si el resultado es incierto, consulta la lista y retoma la venta antes de reintentar.";
    } finally { bloquearAbiertas(false); }
}

async function retomarVentaAbierta(id) {
    if (!comprobarDisponibilidadAbiertas()) return;
    if (estado.facturaActual.length && !await confirmarAccion("¿Reemplazar los cambios de la venta actual por la venta guardada?")) return;
    if (!comprobarDisponibilidadAbiertas()) return;
    bloquearAbiertas(true);
    mensajeAbiertas.textContent = "Recuperando venta y catálogo actual…";
    try {
        const [ventas, productos, categorias, clientes] = await Promise.all([
            api.listar("ventas"), api.listar("productos"), api.listar("categorias"), api.listar("clientes")
        ]);
        const venta = validarAbierta(ventas.find(v => v.id === id));
        const catalogo = normalizarProductos(productos, categorias);
        const contactos = clientes.map(normalizarCliente);
        const faltante = venta.itemsJson.find(item => !catalogo.some(p => p.id === item.id));
        if (faltante) throw new Error(`No está disponible el producto ${faltante.nombre}. No se reemplazó la venta actual.`);
        if (venta.clienteId && !contactos.some(c => c.id === venta.clienteId)) throw new Error("El cliente de la venta no está disponible.");
        const metodos = {Efectivo: "efectivo", Nequi: "nequi", Debe: "debe", "Tarjeta débito": "debito", "": "efectivo"};
        if (!Object.hasOwn(metodos, venta.metodoPago)) throw new Error("Método de pago desconocido.");
        clienteVenta.replaceChildren();
        for (const cliente of [{id: "", nombre: "Sin cliente"}, ...contactos]) {
            const opcion = document.createElement("option");
            opcion.value = cliente.id; opcion.textContent = cliente.nombre;
            clienteVenta.appendChild(opcion);
        }
        clientesVentaEstado.registros = contactos;
        clientesVentaEstado.disponibles = true;
        clienteVenta.disabled = false;
        clienteVenta.value = venta.clienteId;
        estado.productosDisponibles = catalogo;
        estado.facturaActual = venta.itemsJson.map(item => ({id: item.id, cantidad: item.cantidad}));
        estado.facturaIniciada = true;
        estado.ultimaVenta = null;
        trabajador.value = venta.persona;
        metodoPago.value = metodos[venta.metodoPago];
        dineroRecibido.value = "";
        ventasAbiertasEstado.id = venta.id;
        ventasAbiertasEstado.nuevoId = null;
        ventasAbiertasEstado.actualizadoEn = venta.actualizadoEn;
        ventasAbiertasEstado.firmaGuardada = null;
        panelFactura.hidden = false;
        contenidoPrincipal.classList.remove("factura-no-iniciada");
        actualizarMetodoPago(); mostrarVentaPendiente(); renderProductos(); renderFactura();
        mensajeAbiertas.textContent = "Venta retomada con precios actuales del catálogo. Guarda para confirmar cambios; no se ha cobrado ni descontado stock.";
    } catch (error) { mensajeAbiertas.textContent = "No se pudo retomar: " + error.message; }
    finally { bloquearAbiertas(false); }
}

document.querySelector("#guardarVentaAbierta").addEventListener("click", guardarVentaAbiertaFormulario);
document.querySelector("#recargarVentasAbiertas").addEventListener("click", cargarVentasAbiertas);
