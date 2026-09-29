// Sustituye solo crearRegistro. Requiere leerDetalleJson de LeerHoja.gs.
// La validación del recurso y el bloqueo siguen en doPost.
function crearRegistro(nombre, datos) {
    if (nombre === "ventas") return guardarVentaAbierta(datos, false);
    if (nombre === "compras") return guardarCompra(datos);
    if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
        !Object.prototype.hasOwnProperty.call(datos, "id") ||
        !["string", "number"].includes(typeof datos.id) ||
        String(datos.id).trim() === "" ||
        (typeof datos.id === "number" && !Number.isFinite(datos.id))) {
        throw new Error("El registro debe incluir un id válido generado en el frontend.");
    }

    const hoja = obtenerHoja(nombre);
    const encabezados = leerEncabezados(hoja);
    if (encabezados.indexOf("id") === -1 ||
        encabezados.some(function (clave, i) {
            return typeof clave !== "string" || clave.trim() === "" ||
                clave !== clave.trim() || encabezados.indexOf(clave) !== i;
        })) {
        throw new Error("Revisa los encabezados: deben ser únicos, sin espacios exteriores e incluir id.");
    }

    Object.keys(datos).forEach(function (clave) {
        if (encabezados.indexOf(clave) === -1) {
            throw new Error("No existe una columna para el campo: " + clave);
        }
    });
    if (encontrarFila(hoja, datos.id) !== -1) {
        throw new Error("Ya existe un registro con id " + datos.id);
    }

    if (nombre === "productos") validarProducto(datos);
    if (nombre === "proveedores") validarProveedor(datos);
    if (nombre === "clientes") validarCliente(datos);

    // Prepara y valida toda la fila antes de modificar la hoja.
    const fila = encabezados.map(function (clave) {
        if (!Object.prototype.hasOwnProperty.call(datos, clave)) return "";
        const valor = datos[clave];
        if (valor === undefined || valor === null) return "";
        if (typeof valor === "number" && !Number.isFinite(valor)) {
            throw new Error("Número inválido para: " + clave);
        }
        if (!["string", "number", "boolean", "object"].includes(typeof valor)) {
            throw new Error("Tipo de dato no válido para: " + clave);
        }
        const celda = typeof valor === "object" ? JSON.stringify(valor) : valor;
        if (typeof celda === "string" && celda.startsWith("=")) {
            throw new Error("No se permiten fórmulas en el campo: " + clave);
        }
        return celda;
    });

    const numeroFila = hoja.getLastRow() + 1;
    // Valida detalles antes de cambiar valores o formatos; admite el nombre antiguo.
    encabezados.forEach(function (clave, i) {
        if (((nombre === "ventas" || nombre === "compras") && clave === "itemsJson") ||
            (nombre === "ventas" && clave === "productos")) {
            leerDetalleJson(fila[i], nombre, numeroFila, clave);
        }
    });
    const rango = hoja.getRange(numeroFila, 1, 1, encabezados.length);
    fila.forEach(function (valor, i) {
        if (typeof valor === "string") {
            rango.getCell(1, i + 1).setNumberFormat("@");
        }
    });
    rango.setValues([fila]);

    // La respuesta refleja lo almacenado y entrega el detalle como el GET.
    const guardados = rango.getValues()[0];
    const registro = {};
    encabezados.forEach(function (clave, i) {
        let valor = guardados[i];
        if (((nombre === "ventas" || nombre === "compras") && clave === "itemsJson") ||
            (nombre === "ventas" && clave === "productos")) {
            valor = leerDetalleJson(valor, nombre, numeroFila, clave);
        }
        Object.defineProperty(registro, clave, {
            value: valor instanceof Date ? valor.toISOString() : valor,
            enumerable: true
        });
    });
    return registro;
}
