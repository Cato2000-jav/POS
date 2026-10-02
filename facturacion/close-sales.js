// Solo conserva el borrador de una petición, nunca el historial ni el inventario.
const claveCierrePendiente = "papelLuna.cierrePendiente.v1";

function validarBorradorCierre(datos) {
    if (!datos || typeof datos.id !== "string" || !datos.id.trim() ||
        typeof datos.actualizadoEn !== "string" || !Number.isFinite(Date.parse(datos.actualizadoEn)) ||
        (datos.valorRecibido !== null && (typeof datos.valorRecibido !== "number" ||
            !Number.isFinite(datos.valorRecibido) || datos.valorRecibido < 0)) ||
        Object.keys(datos).some(c => !["id", "actualizadoEn", "valorRecibido"].includes(c))) {
        throw new Error("El borrador de cierre no tiene datos válidos.");
    }
    return datos;
}

// Se ejecuta al iniciar, después de crear los controles y antes de cargar el catálogo.
// No cierra automáticamente: el usuario debe pulsar Reintentar cierre pendiente.
function recuperarCierrePendiente() {
    try {
        const texto = localStorage.getItem(claveCierrePendiente);
        if (!texto) return false;
        const pendiente = validarBorradorCierre(JSON.parse(texto));
        ventasAbiertasEstado.cierrePendiente = pendiente;
        ventasAbiertasEstado.id = pendiente.id;
        ventasAbiertasEstado.actualizadoEn = pendiente.actualizadoEn;
        mensajeAbiertas.textContent = "Se recuperó un cierre pendiente de la venta " + pendiente.id +
            ". Pulsa Reintentar cierre pendiente: se consultará/aplicará el mismo cierre sin descontar dos veces.";
    } catch (error) {
        // No borrar un borrador ilegible: podría corresponder a una venta ya cerrada.
        ventasAbiertasEstado.recuperacionBloqueada = true;
        mensajeAbiertas.textContent = "No se pudo recuperar el cierre pendiente. No inicies otra venta hasta revisar este borrador y el historial de Sheets. " + error.message;
    }
    bloquearAbiertas(false);
    return true;
}

// El efectivo puede cambiar después de guardar el borrador; el resto debe coincidir.
function firmaVentaActual() {
    return JSON.stringify({persona: trabajador.value.trim(), clienteId: clienteVenta.value,
        metodoPago: metodoPago.value, items: estado.facturaActual.map(item => {
            const producto = estado.productosDisponibles.find(p => p.id === item.id);
            return {id: item.id, cantidad: item.cantidad, nombre: producto?.nombre,
                precio: producto?.precio, categoriaId: producto?.categoriaId, costo: producto?.costo};
        })});
}


async function cerrarVentaRemota() {
    if (ventasAbiertasEstado.ocupado || ventasAbiertasEstado.recuperacionBloqueada) return;
    if (!ventasAbiertasEstado.cierrePendiente) {
        if (!comprobarDisponibilidadAbiertas() || !ventasAbiertasEstado.id) return;
        if (firmaVentaActual() !== ventasAbiertasEstado.firmaGuardada) {
            mensajeAbiertas.textContent = "Guarda la venta como abierta antes de cerrar para confirmar todos sus cambios.";
            mostrarToast(mensajeAbiertas.textContent, "error");
            return;
        }
        if (!validarVenta()) return;
        const pendiente = {id: ventasAbiertasEstado.id,
            actualizadoEn: ventasAbiertasEstado.actualizadoEn,
            valorRecibido: metodoPago.value === "efectivo" ? Number(dineroRecibido.value) : null};
        try {
            validarBorradorCierre(pendiente);
            if (localStorage.getItem(claveCierrePendiente)) {
                recuperarCierrePendiente();
                return;
            }
            // Si falla la persistencia no enviamos un cierre irrecuperable tras recarga.
            localStorage.setItem(claveCierrePendiente, JSON.stringify(pendiente));
            ventasAbiertasEstado.cierrePendiente = pendiente;
        } catch (error) {
            mensajeAbiertas.textContent = "No se envió el cierre: no se pudo conservar su borrador. " + error.message;
            return;
        }
    }
    bloquearAbiertas(true);
    mensajeAbiertas.textContent = "Confirmando cierre e inventario en Google Sheets…";
    let confirmado = false;
    try {
        const resultado = await api.guardar("ventas", "cerrar", {...ventasAbiertasEstado.cierrePendiente});
        if (resultado?.id !== ventasAbiertasEstado.cierrePendiente.id) throw new Error("La respuesta corresponde a otra venta.");
        const comprobante = adaptarVentaCerrada(resultado);
        confirmado = true;
        localStorage.removeItem(claveCierrePendiente);
        ventasAbiertasEstado.cierrePendiente = null;
        ventasAbiertasEstado.registros = ventasAbiertasEstado.registros.filter(v => v.id !== resultado.id);
        limpiarReferenciaAbierta();
        renderVentasAbiertas();
        mostrarFacturaConfirmada(comprobante);
        mensajeAbiertas.textContent = "Venta cerrada en Sheets. Actualizando existencias del catálogo…";
        // No se resta stock en el navegador: se consulta el valor confirmado del servicio.
        try {
            const [productos, categorias] = await Promise.all([api.listar("productos"), api.listar("categorias")]);
            estado.productosDisponibles = normalizarProductos(productos, categorias);
            renderProductos();
            mensajeAbiertas.textContent = "Venta cerrada e inventario actualizado desde Sheets. El comprobante está disponible para imprimir.";
        } catch (error) {
            mensajeAbiertas.textContent = "La venta SÍ quedó cerrada. No se pudo actualizar el catálogo: " + error.message + ". Pulsa Actualizar catálogo; no repitas la venta.";
        }
    } catch (error) {
        if (!confirmado && error.codigo === "RECHAZADO") {
            try { localStorage.removeItem(claveCierrePendiente); }
            catch {
                mensajeAbiertas.textContent = "El servicio rechazó el cierre, pero no se pudo retirar el borrador local. Se conserva el mismo intento; no crees otra venta.";
                return;
            }
            ventasAbiertasEstado.cierrePendiente = null;
            mensajeAbiertas.textContent = "El servicio rechazó este intento: " + error.message +
                ". Si recargaste la página, consulta y retoma la venta abierta antes de corregirla.";
        } else {
            mensajeAbiertas.textContent = confirmado ? "El cierre fue confirmado; revisa el comprobante antes de continuar. " + error.message
                : "No se conoce el resultado del cierre: " + error.message + ". Usa Reintentar cierre pendiente; se conserva el mismo ID y pago para evitar un doble descuento.";
        }
    } finally { bloquearAbiertas(false); }
}

document.querySelector("#reintentarCierre").addEventListener("click", cerrarVentaRemota);
