// Reemplaza únicamente eliminarRegistro (el TODO) y añade comprobarSinAsociaciones.
// Invocar mediante doPost: su bloqueo cubre la comprobación y la eliminación.
function eliminarRegistro(nombre, datos) {
    if (["productos", "categorias", "proveedores", "clientes"].indexOf(nombre) === -1) {
        throw new Error("La eliminación de ventas y compras no está habilitada.");
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
    if (encabezados.filter(function (clave) { return clave === "id"; }).length !== 1) {
        throw new Error("La hoja '" + nombre + "' debe tener una única columna id.");
    }
    const numeroFila = encontrarFila(hoja, datos.id);
    if (numeroFila === -1) {
        throw new Error("No existe un registro con id " + datos.id);
    }

    // Son las relaciones del MVP 2. Si falta su columna, no se presupone que esté vacía.
    if (nombre === "categorias") {
        comprobarSinAsociaciones("productos", "categoriaId", datos.id,
            "No puedes eliminar la categoría: tiene productos asociados.");
    } else if (nombre === "proveedores") {
        comprobarSinAsociaciones("compras", "proveedorId", datos.id,
            "No puedes eliminar el proveedor: tiene compras asociadas.");
    } else if (nombre === "clientes") {
        comprobarSinAsociaciones("ventas", "clienteId", datos.id,
            "No puedes eliminar el cliente: tiene ventas asociadas.");
    }

    const columnaId = encabezados.indexOf("id") + 1;
    const idGuardado = hoja.getRange(numeroFila, columnaId, 1, 1).getValues()[0][0];
    hoja.deleteRow(numeroFila);
    return { id: idGuardado };
}

// No escribe datos. Lanza un error si la relación existe o no puede comprobarse.
function comprobarSinAsociaciones(recurso, campo, id, mensaje) {
    const hoja = obtenerHoja(recurso);
    const encabezados = leerEncabezados(hoja);
    if (encabezados.filter(function (clave) { return clave === campo; }).length !== 1) {
        throw new Error("No se puede comprobar la relación: la hoja '" + recurso +
            "' debe tener una única columna '" + campo + "'.");
    }

    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 2) return;

    const columna = encabezados.indexOf(campo) + 1;
    const referencias = hoja.getRange(2, columna, ultimaFila - 1, 1).getValues();
    const asociado = referencias.some(function (fila) {
        return fila[0] !== "" && fila[0] !== null && String(fila[0]) === String(id);
    });
    if (asociado) throw new Error(mensaje);
}
