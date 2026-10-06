// Adapta los campos remotos a la presentación existente, sin escribir localStorage.
function adaptarVentaCerrada(venta) {
    if (!venta || venta.estado !== "cerrada") throw new Error("La venta no está cerrada.");
    return adaptarVentaHistorial(venta);
}

function adaptarVentaHistorial(venta) {
    if (venta && ["abierta", "cerrada"].includes(venta.estado)) {
        const problemas = [];
        if (typeof venta.fecha !== "string" || !venta.fecha.trim() || !Number.isFinite(Date.parse(venta.fecha))) problemas.push("fecha ausente o inválida");
        for (const campo of ["subtotal", "iva", "total"]) {
            if (typeof venta[campo] !== "number" || !Number.isFinite(venta[campo]) || venta[campo] < 0) problemas.push(`${campo} ausente o inválido`);
        }
        if (problemas.length) throw new Error(problemas.join("; "));
    }
    if (!venta || !["abierta", "cerrada"].includes(venta.estado) || typeof venta.id !== "string" || !venta.id.trim() ||
        !Number.isFinite(Date.parse(venta.fecha)) || !Array.isArray(venta.itemsJson) || !venta.itemsJson.length ||
        ![venta.subtotal, venta.iva, venta.total].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
        throw new Error("El servicio no devolvió un comprobante válido.");
    }
    if (venta.itemsJson.some(item => !item || typeof item.nombre !== "string" ||
        !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
        ![item.precio, item.subtotal].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0))) {
        throw new Error("El detalle del comprobante es inválido.");
    }
    const efectivoConfirmado = venta.estado === "cerrada" && venta.metodoPago === "Efectivo";
    if (efectivoConfirmado &&
        ![venta.valorRecibido, venta.cambio].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
        throw new Error("El comprobante no confirma el efectivo y el cambio.");
    }
    const fecha = new Date(venta.fecha);
    const zona = {timeZone: "America/Bogota"};
    return {...venta,
        fecha: fecha.toLocaleDateString("es-CO", zona),
        fechaFiltro: fecha.toLocaleDateString("sv-SE", zona),
        hora: fecha.toLocaleTimeString("es-CO", {...zona, hour: "numeric", minute: "2-digit", hour12: true}),
        productos: venta.itemsJson.map(item => ({...item})),
        items: venta.itemsJson.reduce((suma, item) => suma + item.cantidad, 0),
        dineroRecibido: efectivoConfirmado ? venta.valorRecibido : null,
        cambio: efectivoConfirmado ? venta.cambio : null
    };
}
