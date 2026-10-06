// Adapta los campos remotos a la presentación existente, sin escribir localStorage.
function adaptarVentaCerrada(venta) {
    if (!venta || venta.estado !== "cerrada" || typeof venta.id !== "string" ||
        !Number.isFinite(Date.parse(venta.fecha)) || !Array.isArray(venta.itemsJson) || !venta.itemsJson.length ||
        ![venta.subtotal, venta.iva, venta.total].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
        throw new Error("El servicio no devolvió un comprobante válido.");
    }
    if (venta.itemsJson.some(item => !item || typeof item.nombre !== "string" ||
        !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
        ![item.precio, item.subtotal].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0))) {
        throw new Error("El detalle del comprobante es inválido.");
    }
    if (venta.metodoPago === "Efectivo" &&
        ![venta.valorRecibido, venta.cambio].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
        throw new Error("El comprobante no confirma el efectivo y el cambio.");
    }
    const fecha = new Date(venta.fecha);
    const zona = {timeZone: "America/Bogota"};
    return {...venta,
        fecha: fecha.toLocaleDateString("es-CO", zona),
        hora: fecha.toLocaleTimeString("es-CO", {...zona, hour: "numeric", minute: "2-digit", hour12: true}),
        productos: venta.itemsJson.map(item => ({...item})),
        items: venta.itemsJson.reduce((suma, item) => suma + item.cantidad, 0),
        dineroRecibido: venta.metodoPago === "Efectivo" ? venta.valorRecibido : null,
        cambio: venta.metodoPago === "Efectivo" ? venta.cambio : null
    };
}
