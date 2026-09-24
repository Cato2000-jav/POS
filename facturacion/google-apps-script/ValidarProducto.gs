// Reglas del producto. doPost mantiene el bloqueo durante validación y escritura.
function validarProducto(datos) {
    if (typeof datos.nombre !== "string" || !datos.nombre.trim()) {
        throw new Error("El producto necesita un nombre.");
    }
    for (const campo of ["precio", "costo", "stock"]) {
        const valor = datos[campo];
        if (!["number", "string"].includes(typeof valor) || String(valor).trim() === "" ||
            !Number.isFinite(Number(valor)) || Number(valor) < 0) {
            throw new Error(campo + " debe ser un número no negativo.");
        }
    }
    if (!Number.isInteger(Number(datos.stock))) throw new Error("El stock debe ser entero.");
    if (!["true", "false"].includes(String(datos.seguimientoInventario).toLowerCase())) {
        throw new Error("seguimientoInventario debe ser TRUE o FALSE.");
    }
    if (!["string", "number"].includes(typeof datos.categoriaId) ||
        !String(datos.categoriaId).trim()) throw new Error("Selecciona una categoría.");
    const categorias = obtenerHoja("categorias");
    const encabezados = leerEncabezados(categorias);
    if (encabezados.filter(function (campo) { return campo === "id"; }).length !== 1 ||
        encontrarFila(categorias, datos.categoriaId) === -1) {
        throw new Error("La categoría seleccionada no existe.");
    }
}

// Las ventas cerradas conservan sus propios detalles; las abiertas necesitan el producto.
function comprobarProductoSinVentasAbiertas(id) {
    const encabezados = leerEncabezados(obtenerHoja("ventas"));
    if (!["estado", "itemsJson"].every(function (campo) {
        return encabezados.filter(function (clave) { return clave === campo; }).length === 1;
    })) throw new Error("No se pueden comprobar las ventas abiertas: revisa sus encabezados.");
    const ventas = leerHoja("ventas");
    ventas.forEach(function (venta) {
        if (!["abierta", "cerrada"].includes(venta.estado)) {
            throw new Error("Hay una venta con estado inválido. Revisa las ventas antes de eliminar.");
        }
        if (venta.estado !== "abierta") return;
        venta.itemsJson.forEach(function (item) {
            if (!item || !["string", "number"].includes(typeof item.id) || !String(item.id).trim()) {
                throw new Error("Hay una venta abierta con un detalle inválido.");
            }
            if (String(item.id) === String(id)) {
                throw new Error("No puedes eliminar el producto: está en una venta abierta.");
            }
        });
    });
}

