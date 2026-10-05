// Reemplaza únicamente la función actualizarRegistro que contiene el TODO.
// Reutiliza los auxiliares existentes y el bloqueo de doPost.
function actualizarRegistro(nombre, datos) {
    if (nombre === "ventas") return guardarVentaAbierta(datos, true);
    // Ventas y compras necesitan reglas de inventario antes de poder editarse.
    if (["productos", "categorias", "proveedores", "clientes"].indexOf(nombre) === -1) {
        throw new Error("La actualización de ventas y compras todavía no está habilitada.");
    }
    if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
        !Object.prototype.hasOwnProperty.call(datos, "id") ||
        !["string", "number"].includes(typeof datos.id) ||
        String(datos.id).trim() === "" ||
        (typeof datos.id === "number" && !Number.isFinite(datos.id))) {
        throw new Error("Debes enviar un objeto con un id válido.");
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

    const numeroFila = encontrarFila(hoja, datos.id);
    if (numeroFila === -1) {
        throw new Error("No existe un registro con id " + datos.id);
    }
    const rango = hoja.getRange(numeroFila, 1, 1, encabezados.length);
    const actuales = rango.getValues()[0];
    if (nombre === "categorias") {
        const completo = {};
        encabezados.forEach(function (clave, i) { completo[clave] = actuales[i]; });
        validarCategoria(Object.assign(completo, datos));
    }
    if (nombre === "clientes") {
        const completo = {};
        encabezados.forEach(function (clave, i) { completo[clave] = actuales[i]; });
        validarCliente(Object.assign(completo, datos));
    }
    if (nombre === "proveedores") {
        const completo = {};
        encabezados.forEach(function (clave, i) { completo[clave] = actuales[i]; });
        validarProveedor(Object.assign(completo, datos));
    }
    if (nombre === "productos") {
        if (Object.prototype.hasOwnProperty.call(datos, "stock") ||
            Object.prototype.hasOwnProperty.call(datos, "seguimientoInventario")) {
            throw new Error("Esta edición no permite cambiar stock ni seguimiento de inventario.");
        }
        const completo = {};
        encabezados.forEach(function (clave, i) { completo[clave] = actuales[i]; });
        validarProducto(Object.assign(completo, datos));
    }
    const formulas = rango.getFormulas()[0];
    const cambios = encabezados.map(function (clave) {
        return clave !== "id" && Object.prototype.hasOwnProperty.call(datos, clave);
    });
    const fila = encabezados.map(function (clave, i) {
        // El id identifica el registro; no cambia su valor ni su tipo almacenado.
        if (!cambios[i]) return formulas[i] || actuales[i];
        const valor = datos[clave];
        if (valor === undefined) throw new Error("Valor indefinido para: " + clave);
        if (valor === null) return "";
        if (typeof valor === "number" && !Number.isFinite(valor)) {
            throw new Error("Número inválido para: " + clave);
        }
        const celda = typeof valor === "object" ? JSON.stringify(valor) : valor;
        // setValues interpreta los textos que comienzan con = como fórmulas.
        if (typeof celda === "string" && celda.startsWith("=")) {
            throw new Error("No se permiten fórmulas en el campo: " + clave);
        }
        return celda;
    });

    if (cambios.some(Boolean)) {
        fila.forEach(function (valor, i) {
            if (cambios[i] && typeof valor === "string") {
                rango.getCell(1, i + 1).setNumberFormat("@");
            }
        });
        rango.setValues([fila]);
    }

    // Devuelve los valores leídos de la hoja, no campos que no se hayan guardado.
    const guardados = rango.getValues()[0];
    const registro = {};
    encabezados.forEach(function (clave, i) {
        const valor = guardados[i];
        Object.defineProperty(registro, clave, {
            value: valor instanceof Date ? valor.toISOString() : valor,
            enumerable: true
        });
    });
    return registro;
}
