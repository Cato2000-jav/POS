// Sustituye leerHoja y añade leerDetalleJson y leerProductosVenta. No modifica celdas.
function leerHoja(nombre) {
    const hoja = obtenerHoja(nombre);
    const valores = hoja.getDataRange().getValues();
    const encabezados = valores[0];
    const registros = [];

    if (!encabezados || encabezados.indexOf("id") === -1 ||
        encabezados.some(function (clave, i) {
            return typeof clave !== "string" || clave.trim() === "" ||
                clave !== clave.trim() || encabezados.indexOf(clave) !== i;
        })) {
        throw new Error("La hoja '" + nombre + "' necesita encabezados únicos, sin espacios exteriores y con id.");
    }

    for (let i = 1; i < valores.length; i++) {
        const fila = valores[i];
        if (fila.every(function (celda) { return celda === ""; })) continue;

        const registro = {};
        encabezados.forEach(function (clave, j) {
            let valor = fila[j];
            // itemsJson es la columna real de detalle de ventas y compras.
            if ((nombre === "ventas" || nombre === "compras") && clave === "itemsJson") {
                valor = leerDetalleJson(valor, nombre, i + 1, clave);
            } else if (nombre === "ventas" && clave === "productos") {
                // Compatibilidad con el nombre del MVP 1, si existe esa columna.
                valor = leerProductosVenta(valor, i + 1);
            } else if (valor instanceof Date) {
                valor = valor.toISOString();
            }
            Object.defineProperty(registro, clave, { value: valor, enumerable: true });
        });
        registros.push(registro);
    }
    return registros;
}

function leerProductosVenta(valor, numeroFila) {
    return leerDetalleJson(valor, "ventas", numeroFila, "productos");
}

function leerDetalleJson(valor, nombre, numeroFila, campo) {
    // Un detalle vacío no autoriza cerrar una venta ni confirmar una compra.
    if (valor === "") return [];

    let productos;
    try {
        productos = typeof valor === "string" ? JSON.parse(valor) : valor;
    } catch (error) {
        throw new Error("JSON inválido en " + nombre + ", fila " + numeroFila + ", columna " + campo + ".");
    }
    if (!Array.isArray(productos) || productos.some(function (producto) {
        return producto === null || typeof producto !== "object" || Array.isArray(producto);
    })) {
        throw new Error("El detalle en " + nombre + ", fila " + numeroFila +
            ", columna " + campo + " debe ser una lista de objetos.");
    }
    return productos;
}
