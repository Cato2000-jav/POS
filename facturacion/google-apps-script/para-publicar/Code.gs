// Versión integrada de las correcciones revisadas del servicio existente.
// Copiar este archivo en el proyecto vinculado a la hoja, sin duplicar funciones.
// No implementa todavía cierre de ventas ni movimientos de inventario.

const RECURSOS_PERMITIDOS = [
    "productos", "ventas", "compras", "clientes", "proveedores", "categorias"
];

function doGet(e) {
    try {
        const resource = validarResource(e);
        return responder({ success: true, data: leerHoja(resource) });
    } catch (error) {
        return responder({ success: false, message: error.message });
    }
}

// Debe estar al nivel superior, fuera de doGet y de su catch.
function doPost(e) {
    const lock = LockService.getScriptLock();
    let bloqueado = false;
    try {
        const resource = validarResource(e);
        const body = JSON.parse(e.postData.contents);
        if (!body || !body.action || !body.data ||
            typeof body.data !== "object" || Array.isArray(body.data)) {
            throw new Error('El cuerpo debe ser { "action": "create|update|delete", "data": {...} }');
        }

        lock.waitLock(10000);
        bloqueado = true;
        switch (body.action) {
            case "create":
                return responder({ success: true, data: crearRegistro(resource, body.data) });
            case "update":
                return responder({ success: true, data: actualizarRegistro(resource, body.data) });
            case "delete":
                return responder({ success: true, data: eliminarRegistro(resource, body.data) });
            default:
                throw new Error("Acción no soportada: " + body.action);
        }
    } catch (error) {
        return responder({ success: false, message: error.message });
    } finally {
        if (bloqueado) lock.releaseLock();
    }
}


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


function crearRegistro(nombre, datos) {
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


function actualizarRegistro(nombre, datos) {
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
    if (nombre === "productos") {
        comprobarProductoSinVentasAbiertas(datos.id);
    } else if (nombre === "categorias") {
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


// Auxiliares y pruebas originales del usuario.
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

function validarResource(e) {

const resource = e && e.parameter ? e.parameter.resource : null;

if (!resource) throw new Error("Falta el parámetro resource");

if (RECURSOS_PERMITIDOS.indexOf(resource) === -1) {

throw new Error("Recurso no permitido: " + resource);

}

return resource;

}


function obtenerHoja(nombre) {

const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);

if (!hoja) {

throw new Error("No existe la hoja '" + nombre +

"'. Revisa que el nombre de la pestaña sea idéntico.");

}

return hoja;

}


function leerEncabezados(hoja) {

return hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];

}


// Devuelve el número de fila (1 = encabezados) del registro con ese id, o -1

function encontrarFila(hoja, id) {

const columnaId = leerEncabezados(hoja).indexOf("id");

if (columnaId === -1) {

throw new Error("La hoja '" + hoja.getName() + "' necesita una columna llamada id");

}

const ultimaFila = hoja.getLastRow();

if (ultimaFila < 2) return -1;


const ids = hoja.getRange(2, columnaId + 1, ultimaFila - 1, 1).getValues();

for (let i = 0; i < ids.length; i++) {

// +2: el arreglo empieza en 0 y la fila 1 son los encabezados

if (String(ids[i][0]) === String(id)) return i + 2;

}

return -1;
}
function responder(objeto) {

return ContentService

.createTextOutput(JSON.stringify(objeto))

.setMimeType(ContentService.MimeType.JSON);

}


// ------------------------------ Pruebas desde el editor ------------------------------

// Selecciona la función en el menú superior y pulsa "Ejecutar".

// El resultado aparece en el registro de ejecución.


function probarLectura() {

Logger.log(doGet({ parameter: { resource: "productos" } }).getContent());

}


function probarCreacion() {

const e = {

parameter: { resource: "categorias" },

postData: {

contents: JSON.stringify({

action: "create",

data: { id: "prueba-" + Date.now(), nombre: "Categoría de prueba" }

})

}

};

Logger.log(doPost(e).getContent());

}
