// Solo ventas abiertas. doPost mantiene el bloqueo durante toda esta operación.
// No escribe en productos y no permite cerrar ni modificar ventas cerradas.
function guardarVentaAbierta(datos, actualizar) {
    if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
        typeof datos.id !== "string" || !datos.id.trim()) {
        throw new Error("La venta necesita un ID de texto.");
    }
    if (datos.estado !== "abierta") throw new Error("Esta operación solo guarda ventas abiertas.");
    const campos = ["id", "fecha", "estado", "clienteId", "metodoPago", "subtotal",
        "total", "valorRecibido", "cambio", "itemsJson", "actualizadoEn", "persona", "iva", "clienteNombre"];
    if (Object.keys(datos).some(function (campo) { return campos.indexOf(campo) === -1; })) {
        throw new Error("La venta contiene campos desconocidos.");
    }
    const hoja = obtenerHoja("ventas");
    const encabezados = leerEncabezados(hoja);
    if (encabezados.some(function (campo, i) {
        return typeof campo !== "string" || !campo.trim() || campo !== campo.trim() || encabezados.indexOf(campo) !== i;
    }) || campos.some(function (campo) { return encabezados.indexOf(campo) === -1; })) {
        throw new Error("Revisa los encabezados de ventas, incluidos persona, iva y clienteNombre.");
    }
    const numeroExistente = encontrarFila(hoja, datos.id);
    if (!actualizar && numeroExistente !== -1) {
        throw new Error("La venta ya existe. Consulta su estado antes de reintentar.");
    }
    if (actualizar && numeroExistente === -1) throw new Error("La venta abierta no existe.");
    let anterior = null;
    let valores = encabezados.map(function () { return ""; });
    if (actualizar) {
        const rangoAnterior = hoja.getRange(numeroExistente, 1, 1, encabezados.length);
        const guardados = rangoAnterior.getValues()[0];
        const formulas = rangoAnterior.getFormulas()[0];
        anterior = {};
        encabezados.forEach(function (campo, i) {
            anterior[campo] = guardados[i] instanceof Date ? guardados[i].toISOString() : guardados[i];
            valores[i] = formulas[i] || guardados[i];
        });
        if (anterior.estado !== "abierta") throw new Error("No puedes modificar una venta cerrada.");
        if (!datos.actualizadoEn || datos.actualizadoEn !== anterior.actualizadoEn) {
            throw new Error("La venta cambió. Vuelve a cargarla antes de guardar.");
        }
    }
    if (typeof datos.persona !== "string" || !datos.persona.trim()) {
        throw new Error("Indica el nombre del trabajador.");
    }
    const metodo = datos.metodoPago;
    if (["", "Efectivo", "Nequi", "Debe", "Tarjeta débito"].indexOf(metodo) === -1) {
        throw new Error("Método de pago no válido.");
    }
    if (typeof datos.clienteId !== "string") throw new Error("clienteId debe ser texto, o vacío.");
    let clienteNombre = "";
    if (datos.clienteId) {
        const cliente = leerHoja("clientes").find(function (c) { return String(c.id) === datos.clienteId; });
        if (!cliente || typeof cliente.nombre !== "string" || !cliente.nombre.trim()) {
            throw new Error("El cliente seleccionado no existe o no tiene nombre.");
        }
        clienteNombre = cliente.nombre;
    } else if (metodo === "Debe") {
        throw new Error("Para el pago Debe debes seleccionar un cliente.");
    }
    if (!Array.isArray(datos.itemsJson) || datos.itemsJson.length === 0) {
        throw new Error("Agrega productos antes de guardar la venta abierta.");
    }
    const productos = leerHoja("productos");
    const ids = new Set();
    const detalle = datos.itemsJson.map(function (item) {
        if (!item || typeof item.id !== "string" || !item.id ||
            !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 || ids.has(item.id)) {
            throw new Error("El detalle contiene un ID/cantidad inválido o un producto repetido.");
        }
        ids.add(item.id);
        const producto = productos.find(function (p) { return String(p.id) === item.id; });
        if (!producto) throw new Error("Ya no existe el producto " + item.id + ".");
        if (typeof producto.nombre !== "string" || !producto.nombre.trim() ||
            typeof producto.precio !== "number" || !Number.isFinite(producto.precio) || producto.precio < 0) {
            throw new Error("Revisa el nombre/precio del producto " + item.id + ".");
        }
        const subtotal = producto.precio * item.cantidad;
        if (!Number.isFinite(subtotal)) throw new Error("El importe del producto es demasiado grande.");
        return {id: item.id, nombre: producto.nombre, categoriaId: producto.categoriaId,
            precio: producto.precio, cantidad: item.cantidad, subtotal: subtotal};
    });
    const subtotal = detalle.reduce(function (suma, item) { return suma + item.subtotal; }, 0);
    const iva = subtotal * 0.19; // Conserva el cálculo del MVP 1.
    const total = subtotal + iva;
    if (!Number.isFinite(total)) throw new Error("El total es demasiado grande.");
    const previo = anterior ? Date.parse(anterior.actualizadoEn) : 0;
    const ahora = new Date(Math.max(Date.now(), Number.isFinite(previo) ? previo + 1 : 0)).toISOString();
    const registro = {
        id: datos.id, fecha: anterior ? anterior.fecha : ahora, estado: "abierta",
        clienteId: datos.clienteId, clienteNombre: clienteNombre, persona: datos.persona.trim(),
        metodoPago: metodo, subtotal: subtotal, iva: iva, total: total,
        // Una venta abierta todavía no registra cobro ni cambio.
        valorRecibido: "", cambio: "", itemsJson: detalle, actualizadoEn: ahora
    };
    encabezados.forEach(function (campo, i) {
        if (Object.prototype.hasOwnProperty.call(registro, campo)) {
            valores[i] = campo === "itemsJson" ? JSON.stringify(registro[campo]) : registro[campo];
            if (typeof valores[i] === "string" && valores[i].startsWith("=")) {
                throw new Error("No se permiten fórmulas en " + campo + ".");
            }
        }
    });
    const fila = actualizar ? numeroExistente : hoja.getLastRow() + 1;
    const rango = hoja.getRange(fila, 1, 1, encabezados.length);
    encabezados.forEach(function (campo, i) {
        if (Object.prototype.hasOwnProperty.call(registro, campo) && typeof valores[i] === "string") {
            rango.getCell(1, i + 1).setNumberFormat("@");
        }
    });
    rango.setValues([valores]);
    const confirmados = rango.getValues()[0];
    const respuesta = {};
    campos.forEach(function (campo) {
        const valor = confirmados[encabezados.indexOf(campo)];
        respuesta[campo] = campo === "itemsJson" ? leerDetalleJson(valor, "ventas", fila, campo)
            : (valor instanceof Date ? valor.toISOString() : valor);
    });
    return respuesta;
}
