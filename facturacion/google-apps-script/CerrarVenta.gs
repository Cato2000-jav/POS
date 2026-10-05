// Invocar desde doPost, con el bloqueo adquirido. Requiere el servicio avanzado Sheets.
function cerrarVenta(datos) {
    if (!datos || typeof datos.id !== "string" || !datos.id ||
        Object.keys(datos).some(function (clave) { return ["id", "actualizadoEn", "valorRecibido"].indexOf(clave) === -1; })) {
        throw new Error("El cierre necesita id, actualizadoEn y valorRecibido.");
    }
    const ventas = leerHoja("ventas");
    const coincidencias = ventas.filter(function (v) { return String(v.id) === datos.id; });
    if (coincidencias.length !== 1) throw new Error("La venta no existe o tiene un ID duplicado.");
    const venta = coincidencias[0];
    // Reintento de un cierre confirmado: devolver el comprobante, nunca descontar otra vez.
    if (venta.estado === "cerrada") return venta;
    if (venta.estado !== "abierta") throw new Error("La venta no está abierta.");
    if (!datos.actualizadoEn || datos.actualizadoEn !== venta.actualizadoEn) {
        throw new Error("La venta cambió. Consulta su versión actual antes de cerrar.");
    }
    if (typeof venta.persona !== "string" || !venta.persona.trim()) throw new Error("Falta el trabajador.");
    if (["Efectivo", "Nequi", "Debe", "Tarjeta débito"].indexOf(venta.metodoPago) === -1) {
        throw new Error("Selecciona un método de pago antes de cerrar.");
    }
    if (venta.metodoPago === "Debe" && !venta.clienteId) throw new Error("Debe requiere cliente.");
    if (venta.clienteId && !leerHoja("clientes").some(function (c) { return String(c.id) === String(venta.clienteId); })) {
        throw new Error("El cliente de la venta no existe.");
    }
    if (!Array.isArray(venta.itemsJson) || !venta.itemsJson.length) throw new Error("La venta no tiene productos.");
    const productos = leerHoja("productos");
    const hojaProductos = obtenerHoja("productos");
    const hojaVentas = obtenerHoja("ventas");
    const columnasProductos = leerEncabezados(hojaProductos);
    const columnasVentas = leerEncabezados(hojaVentas);
    if (columnasProductos.filter(function (c) { return c === "stock"; }).length !== 1 ||
        !["estado", "valorRecibido", "cambio", "actualizadoEn", "iva", "subtotal", "total"].every(function (campo) {
            return columnasVentas.filter(function (c) { return c === campo; }).length === 1;
        })) throw new Error("Revisa los encabezados de ventas/productos antes de cerrar.");
    const solicitudes = [];
    const ids = new Set();
    let subtotal = 0;
    venta.itemsJson.forEach(function (item) {
        if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) ||
            !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
            typeof item.precio !== "number" || !Number.isFinite(item.precio) || item.precio < 0) {
            throw new Error("Hay un detalle de venta inválido.");
        }
        ids.add(item.id);
        const importe = item.precio * item.cantidad;
        if (!Number.isFinite(importe) || item.subtotal !== importe) throw new Error("Subtotal de producto inconsistente.");
        subtotal += importe;
        const coincidenciasProducto = productos.filter(function (p) { return String(p.id) === item.id; });
        if (coincidenciasProducto.length !== 1) throw new Error("Producto inexistente o duplicado: " + item.id);
        const producto = coincidenciasProducto[0];
        const seguimiento = String(producto.seguimientoInventario).toLowerCase();
        if (seguimiento !== "true" && seguimiento !== "false") throw new Error("Seguimiento inválido: " + producto.nombre);
        if (seguimiento === "false") return;
        if (typeof producto.stock !== "number" || !Number.isSafeInteger(producto.stock) || producto.stock < 0) {
            throw new Error("Stock inválido: " + producto.nombre);
        }
        if (producto.stock < item.cantidad) {
            throw new Error("Stock insuficiente para " + producto.nombre + ": disponible " +
                producto.stock + ", solicitado " + item.cantidad + ".");
        }
        const fila = encontrarFila(hojaProductos, producto.id);
        if (fila < 2) throw new Error("No se encontró la fila de " + producto.nombre);
        solicitudes.push(actualizarCeldaCierre(hojaProductos.getSheetId(), fila,
            columnasProductos.indexOf("stock") + 1, producto.stock - item.cantidad));
    });
    const iva = subtotal * 0.19;
    const total = subtotal + iva;
    if (!Number.isFinite(total) || venta.subtotal !== subtotal || venta.iva !== iva || venta.total !== total) {
        throw new Error("Los totales guardados son inconsistentes. Revisa la venta antes de cerrar.");
    }
    let recibido = "", cambio = "";
    if (venta.metodoPago === "Efectivo") {
        if (typeof datos.valorRecibido !== "number" || !Number.isFinite(datos.valorRecibido) || datos.valorRecibido < total) {
            throw new Error("El dinero recibido es insuficiente o inválido.");
        }
        recibido = datos.valorRecibido;
        cambio = recibido - total;
    } else if (datos.valorRecibido !== undefined && datos.valorRecibido !== null && datos.valorRecibido !== "") {
        throw new Error("No envíes dinero recibido para este método de pago.");
    }
    const anterior = Date.parse(venta.actualizadoEn);
    const ahora = new Date(Math.max(Date.now(), Number.isFinite(anterior) ? anterior + 1 : 0)).toISOString();
    const cambios = {estado: "cerrada", valorRecibido: recibido, cambio: cambio, actualizadoEn: ahora};
    const filaVenta = encontrarFila(hojaVentas, venta.id);
    if (filaVenta < 2) throw new Error("No se encontró la fila de la venta.");
    Object.keys(cambios).forEach(function (campo) {
        solicitudes.push(actualizarCeldaCierre(hojaVentas.getSheetId(), filaVenta,
            columnasVentas.indexOf(campo) + 1, cambios[campo]));
    });
    if (typeof Sheets === "undefined") {
        throw new Error("Activa Google Sheets API en Servicios de Apps Script para cerrar ventas.");
    }
    // Una sola escritura atómica. No usar setValues separados para venta e inventario.
    try {
        Sheets.Spreadsheets.batchUpdate({requests: solicitudes}, hojaVentas.getParent().getId());
    } catch (error) {
        // Un error de transporte puede llegar después de que Sheets aplicó el lote.
        const incierto = new Error("No se pudo confirmar el lote de cierre: " + error.message);
        incierto.codigo = "CIERRE_INCIERTO";
        throw incierto;
    }
    // batchUpdate confirmó todo el lote. No se recalculan precios con el catálogo actual:
    // se conservan los datos de la última versión abierta que se guardó.
    return Object.assign({}, venta, cambios);
}

// Construye una petición; no escribe. Fila/columna llegan numeradas desde 1.
function actualizarCeldaCierre(sheetId, fila, columna, valor) {
    const valorCelda = typeof valor === "number" ? {numberValue: valor} : {stringValue: String(valor)};
    return {updateCells: {
        range: {sheetId: sheetId, startRowIndex: fila - 1, endRowIndex: fila,
            startColumnIndex: columna - 1, endColumnIndex: columna},
        rows: [{values: [{userEnteredValue: valorCelda}]}], fields: "userEnteredValue"
    }};
}
