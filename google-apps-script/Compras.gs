// doPost mantiene el bloqueo durante validación y escritura. No invocar sin él.
function guardarCompra(datos) {
    const campos = ["id", "fecha", "proveedorId", "total", "itemsJson"];
    if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
        Object.keys(datos).some(function (campo) { return campos.indexOf(campo) === -1; })) {
        throw new Error("La compra contiene campos no permitidos.");
    }
    const firma = firmaCompra(datos); // Valida datos y calcula el total antes de escribir.
    const existentes = leerHoja("compras").filter(function (c) { return String(c.id) === datos.id; });
    if (existentes.length > 1) throw new Error("Hay compras con ID duplicado. Revisa la hoja.");
    if (existentes.length === 1) {
        // Resolver un reintento antes de consultar el catálogo: este pudo cambiar después.
        if (firmaCompra(existentes[0]) !== firma) {
            throw new Error("Ese ID ya pertenece a otra compra. No se modificó el inventario.");
        }
        return existentes[0];
    }
    const proveedores = leerHoja("proveedores").filter(function (p) { return String(p.id) === datos.proveedorId; });
    if (proveedores.length !== 1) throw new Error("Selecciona un proveedor existente y sin ID duplicado.");
    const hojaCompras = obtenerHoja("compras");
    const hojaProductos = obtenerHoja("productos");
    const columnasCompras = leerEncabezados(hojaCompras);
    const columnasProductos = leerEncabezados(hojaProductos);
    validarColumnasCompra(columnasCompras, campos);
    validarColumnasCompra(columnasProductos, ["id", "nombre", "costo", "stock", "seguimientoInventario"]);
    const productos = leerHoja("productos");
    const solicitudes = [];
    let total = 0;
    const detalle = datos.itemsJson.map(function (item) {
        const encontrados = productos.filter(function (p) { return String(p.id) === item.id; });
        if (encontrados.length !== 1) throw new Error("Producto inexistente o duplicado: " + item.id);
        const producto = encontrados[0];
        if (typeof producto.nombre !== "string" || !producto.nombre.trim()) throw new Error("Producto sin nombre: " + item.id);
        const seguimiento = String(producto.seguimientoInventario).toLowerCase();
        if (seguimiento !== "true" && seguimiento !== "false") throw new Error("Seguimiento inválido: " + producto.nombre);
        const fila = encontrarFila(hojaProductos, producto.id);
        if (fila < 2) throw new Error("No se encontró la fila de " + producto.nombre);
        if (seguimiento === "true") {
            const nuevoStock = producto.stock + item.cantidad;
            if (!Number.isSafeInteger(producto.stock) || producto.stock < 0 || !Number.isSafeInteger(nuevoStock)) {
                throw new Error("Stock inválido o fuera de rango: " + producto.nombre);
            }
            solicitudes.push(actualizarCeldaCierre(hojaProductos.getSheetId(), fila,
                columnasProductos.indexOf("stock") + 1, nuevoStock));
        }
        // El costo cambia también para productos sin seguimiento; su stock queda intacto.
        solicitudes.push(actualizarCeldaCierre(hojaProductos.getSheetId(), fila,
            columnasProductos.indexOf("costo") + 1, item.costo));
        const subtotal = item.cantidad * item.costo;
        total += subtotal;
        return {id: item.id, nombre: producto.nombre, cantidad: item.cantidad, costo: item.costo, subtotal: subtotal};
    });
    const compra = {id: datos.id, fecha: datos.fecha, proveedorId: datos.proveedorId, total: total, itemsJson: detalle};
    const celdas = columnasCompras.map(function (campo) {
        const valor = campo === "itemsJson" ? JSON.stringify(detalle) :
            Object.prototype.hasOwnProperty.call(compra, campo) ? compra[campo] : "";
        // stringValue guarda texto literal, nunca interpreta una fórmula del usuario.
        return {userEnteredValue: typeof valor === "number" ? {numberValue: valor} : {stringValue: valor}};
    });
    // appendCells agrega al final y amplía la hoja si hace falta, dentro del mismo lote.
    solicitudes.push({appendCells: {sheetId: hojaCompras.getSheetId(),
        rows: [{values: celdas}], fields: "userEnteredValue"}});
    if (typeof Sheets === "undefined") throw new Error("Activa Google Sheets API en Servicios de Apps Script para guardar compras.");
    try {
        Sheets.Spreadsheets.batchUpdate({requests: solicitudes}, hojaCompras.getParent().getId());
    } catch (error) {
        const incierto = new Error("No se pudo confirmar la compra. Consulta o reintenta con el mismo ID y datos: " + error.message);
        incierto.codigo = "COMPRA_INCIERTA";
        throw incierto;
    }
    return compra;
}

// Recibe una compra y devuelve su identidad/contenido comparable. No escribe.
// Ignora nombres históricos, pero compara fecha, proveedor, cantidades y costos.
function firmaCompra(compra) {
    if (!compra || typeof compra.id !== "string" || !compra.id.trim() || compra.id !== compra.id.trim() ||
        typeof compra.proveedorId !== "string" || !compra.proveedorId.trim() ||
        typeof compra.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(compra.fecha)) {
        throw new Error("La compra necesita ID, proveedor y fecha YYYY-MM-DD.");
    }
    const fecha = new Date(compra.fecha + "T00:00:00.000Z");
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== compra.fecha) {
        throw new Error("La fecha de compra no es válida.");
    }
    if (!Array.isArray(compra.itemsJson) || !compra.itemsJson.length) throw new Error("Agrega productos a la compra.");
    const ids = new Set();
    let total = 0;
    const items = compra.itemsJson.map(function (item) {
        if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) ||
            !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
            typeof item.costo !== "number" || !Number.isFinite(item.costo) || item.costo < 0) {
            throw new Error("Detalle de compra inválido: revisa productos únicos, cantidades y costos.");
        }
        ids.add(item.id);
        total += item.cantidad * item.costo;
        return {id: item.id, cantidad: item.cantidad, costo: item.costo};
    });
    if (!Number.isFinite(total) || (compra.total !== undefined && compra.total !== total)) {
        throw new Error("El total de la compra es inválido o no coincide con sus productos.");
    }
    // Conserva el orden: un reintento debe enviar exactamente el borrador original.
    return JSON.stringify({id: compra.id, fecha: compra.fecha, proveedorId: compra.proveedorId, items: items});
}

function validarColumnasCompra(columnas, requeridas) {
    if (!requeridas.every(function (c) { return columnas.indexOf(c) !== -1; }) ||
        columnas.some(function (c, i) { return typeof c !== "string" || !c.trim() || c !== c.trim() || columnas.indexOf(c) !== i; })) {
        throw new Error("Revisa los encabezados de compras/productos: faltantes, vacíos o duplicados.");
    }
}
