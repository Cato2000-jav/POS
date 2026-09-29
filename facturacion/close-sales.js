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
    if (ventasAbiertasEstado.ocupado) return;
    if (!ventasAbiertasEstado.cierrePendiente) {
        if (!comprobarDisponibilidadAbiertas() || !ventasAbiertasEstado.id) return;
        if (firmaVentaActual() !== ventasAbiertasEstado.firmaGuardada) {
            mensajeAbiertas.textContent = "Guarda la venta como abierta antes de cerrar para confirmar todos sus cambios.";
            mostrarToast(mensajeAbiertas.textContent, "error");
            return;
        }
        if (!validarVenta()) return;
        ventasAbiertasEstado.cierrePendiente = {id: ventasAbiertasEstado.id,
            actualizadoEn: ventasAbiertasEstado.actualizadoEn,
            valorRecibido: metodoPago.value === "efectivo" ? Number(dineroRecibido.value) : null};
    }
    bloquearAbiertas(true);
    mensajeAbiertas.textContent = "Confirmando cierre e inventario en Google Sheets…";
    let confirmado = false;
    try {
        const resultado = await api.guardar("ventas", "cerrar", {...ventasAbiertasEstado.cierrePendiente});
        if (resultado?.id !== ventasAbiertasEstado.cierrePendiente.id) throw new Error("La respuesta corresponde a otra venta.");
        const comprobante = adaptarVentaCerrada(resultado);
        confirmado = true;
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
            ventasAbiertasEstado.cierrePendiente = null;
            mensajeAbiertas.textContent = "No se cerró la venta: " + error.message;
        } else {
            mensajeAbiertas.textContent = confirmado ? "El cierre fue confirmado; revisa el comprobante antes de continuar. " + error.message
                : "No se conoce el resultado del cierre: " + error.message + ". Usa Reintentar cierre pendiente; se conserva el mismo ID y pago para evitar un doble descuento.";
        }
    } finally { bloquearAbiertas(false); }
}

document.querySelector("#reintentarCierre").addEventListener("click", cerrarVentaRemota);
