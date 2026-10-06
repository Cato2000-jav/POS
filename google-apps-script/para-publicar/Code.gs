// Versión integrada de las correcciones revisadas del servicio existente.
// Copiar este archivo en el proyecto vinculado a la hoja, sin duplicar funciones.
// Ventas abiertas, cierre y compras con inventario atómico (servicio avanzado Sheets).

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
            case "import":
                if (resource !== "ventas") throw new Error("Solo se importan ventas históricas.");
                return responder({ success: true, data: importarVentaHistorica(body.data) });
            case "close":
                if (resource !== "ventas") throw new Error("El cierre solo está disponible para ventas.");
                return responder({ success: true, data: cerrarVenta(body.data) });
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
        return responder({ success: false, message: error.message, codigo: error.codigo || "RECHAZADO" });
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
    if (nombre === "categorias") validarCategoria(datos);

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

// Se ejecuta antes de escribir y bajo el bloqueo de doPost.
function validarProveedor(datos) {
    if (typeof datos.nombre !== "string" || !datos.nombre.trim()) {
        throw new Error("El proveedor necesita un nombre.");
    }
    // Se admiten teléfonos numéricos antiguos; el formulario nuevo envía texto.
    if (datos.telefono !== undefined &&
        typeof datos.telefono !== "string" &&
        !(typeof datos.telefono === "number" && Number.isFinite(datos.telefono))) {
        throw new Error("El teléfono del proveedor no es válido.");
    }
    if (datos.correo !== undefined && (typeof datos.correo !== "string" ||
        (datos.correo !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)))) {
        throw new Error("El correo del proveedor no es válido.");
    }
}

// Se ejecuta antes de escribir y bajo el bloqueo de doPost.
function validarCliente(datos) {
    if (typeof datos.nombre !== "string" || !datos.nombre.trim()) {
        throw new Error("El cliente necesita un nombre.");
    }
    // Se admiten teléfonos numéricos antiguos; el formulario nuevo envía texto.
    if (datos.telefono !== undefined &&
        typeof datos.telefono !== "string" &&
        !(typeof datos.telefono === "number" && Number.isFinite(datos.telefono))) {
        throw new Error("El teléfono del cliente no es válido.");
    }
    if (datos.correo !== undefined && (typeof datos.correo !== "string" ||
        (datos.correo !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)))) {
        throw new Error("El correo del cliente no es válido.");
    }
}

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

// Se ejecuta bajo el bloqueo de doPost, antes de escribir una categoría.
function validarCategoria(datos) {
    if (!datos || typeof datos.nombre !== "string" || !datos.nombre.trim()) {
        throw new Error("La categoría debe tener un nombre no vacío.");
    }
}

// Solo migración del archivo MVP 1. doPost debe mantener su bloqueo.
// No llama a cerrarVenta ni lee/escribe productos: nunca mueve inventario.
function importarVentaHistorica(datos) {
    if (!datos || Object.keys(datos).some(function (c) { return ["origenId", "venta"].indexOf(c) === -1; }) ||
        typeof datos.origenId !== "string" || !datos.origenId.trim() || datos.origenId !== datos.origenId.trim()) {
        throw new Error("La importación necesita origenId estable y venta histórica.");
    }
    const historica = validarVentaHistorica(datos.venta);
    // El mismo ID antiguo produce siempre el mismo ID importado, incluso tras recargar.
    const id = "mvp1-" + encodeURIComponent(datos.origenId);
    const ventas = leerHoja("ventas");
    const existentes = ventas.filter(function (v) { return String(v.id) === id; });
    if (existentes.length > 1) throw new Error("Hay IDs duplicados en Sheets. Revisa la importación.");
    if (existentes.length === 1) {
        const anterior = existentes[0];
        const contenido = {};
        Object.keys(historica).forEach(function (campo) { contenido[campo] = anterior[campo]; });
        if (anterior.estado !== "cerrada" || JSON.stringify(validarVentaHistorica(contenido)) !== JSON.stringify(historica)) {
            throw new Error("Ese origenId ya tiene una importación con otros datos. No se sobrescribió.");
        }
        return anterior; // respuesta perdida/reintento: no vuelve a insertar
    }
    if (ventas.some(function (v) { return String(v.id) === datos.origenId; })) {
        throw new Error("El ID original ya existe en Sheets. Revisa la posible duplicación antes de importar.");
    }
    if (historica.clienteId) {
        const clientes = leerHoja("clientes").filter(function (c) { return String(c.id) === historica.clienteId; });
        if (clientes.length !== 1) throw new Error("El cliente histórico debe asociarse a un cliente existente y único.");
    }
    const hoja = obtenerHoja("ventas");
    const columnas = leerEncabezados(hoja);
    const registro = Object.assign({id: id, estado: "cerrada"}, historica, {actualizadoEn: new Date().toISOString()});
    validarColumnasCompra(columnas, Object.keys(registro)); // auxiliar existente de validación de encabezados
    const celdas = columnas.map(function (campo) {
        const valor = campo === "itemsJson" ? JSON.stringify(registro.itemsJson) :
            Object.prototype.hasOwnProperty.call(registro, campo) ? registro[campo] : "";
        return {userEnteredValue: typeof valor === "number" ? {numberValue: valor} : {stringValue: String(valor)}};
    });
    if (typeof Sheets === "undefined") throw new Error("Activa Google Sheets API antes de importar.");
    try {
        Sheets.Spreadsheets.batchUpdate({requests: [{appendCells: {
            sheetId: hoja.getSheetId(), rows: [{values: celdas}], fields: "userEnteredValue"
        }}]}, hoja.getParent().getId());
    } catch (error) {
        const incierto = new Error("No se confirmó la importación. Reintenta con el mismo origenId y contenido: " + error.message);
        incierto.codigo = "IMPORTACION_INCIERTA";
        throw incierto;
    }
    return registro;
}

// Recibe los datos históricos ya convertidos, devuelve una copia validada y ordenada.
// No toma precios/nombres del catálogo actual ni inventa fecha, efectivo o cliente.
function validarVentaHistorica(venta) {
    const campos = ["fecha", "persona", "clienteId", "clienteNombre", "metodoPago", "subtotal", "iva", "total", "valorRecibido", "cambio", "itemsJson"];
    if (!venta || typeof venta !== "object" || Array.isArray(venta) ||
        Object.keys(venta).some(function (c) { return campos.indexOf(c) === -1; }) ||
        campos.some(function (c) { return !Object.prototype.hasOwnProperty.call(venta, c); })) {
        throw new Error("La venta histórica tiene campos faltantes o desconocidos.");
    }
    if (typeof venta.fecha !== "string" || !Number.isFinite(Date.parse(venta.fecha)) ||
        new Date(venta.fecha).toISOString() !== venta.fecha) throw new Error("La fecha histórica debe ser ISO UTC completa y válida.");
    if (typeof venta.persona !== "string" || !venta.persona.trim() ||
        typeof venta.clienteId !== "string" || typeof venta.clienteNombre !== "string" ||
        (venta.clienteId && !venta.clienteNombre.trim()) || (!venta.clienteId && venta.clienteNombre !== "")) {
        throw new Error("Revisa trabajador y datos históricos del cliente.");
    }
    if (["Efectivo", "Nequi", "Debe", "Tarjeta débito"].indexOf(venta.metodoPago) === -1 ||
        (venta.metodoPago === "Debe" && !venta.clienteId.trim())) throw new Error("Método inválido o venta Debe sin cliente.");
    const numero = function (n) { return typeof n === "number" && Number.isFinite(n) && n >= 0; };
    const igual = function (a, b) { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.01; };
    if (![venta.subtotal, venta.iva, venta.total].every(numero) || !igual(venta.subtotal + venta.iva, venta.total)) {
        throw new Error("Totales históricos inconsistentes.");
    }
    if (!Array.isArray(venta.itemsJson) || !venta.itemsJson.length) throw new Error("Falta el detalle histórico.");
    const ids = new Set();
    const detalle = venta.itemsJson.map(function (item) {
        if (!item || Object.keys(item).some(function (c) { return ["id", "nombre", "categoriaId", "precio", "cantidad", "subtotal"].indexOf(c) === -1; }) ||
            typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) ||
            typeof item.nombre !== "string" || !item.nombre.trim() ||
            !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
            !numero(item.precio) || !numero(item.subtotal) || !igual(item.precio * item.cantidad, item.subtotal) ||
            (item.categoriaId !== undefined && typeof item.categoriaId !== "string")) {
            throw new Error("Detalle histórico inválido o productos repetidos.");
        }
        ids.add(item.id);
        const copia = {id: item.id, nombre: item.nombre, precio: item.precio, cantidad: item.cantidad, subtotal: item.subtotal};
        if (item.categoriaId !== undefined) copia.categoriaId = item.categoriaId;
        return copia;
    });
    if (!igual(detalle.reduce(function (s, i) { return s + i.subtotal; }, 0), venta.subtotal)) throw new Error("Detalle y subtotal histórico no coinciden.");
    if (venta.metodoPago === "Efectivo") {
        if (!numero(venta.valorRecibido) || !numero(venta.cambio) || venta.valorRecibido < venta.total ||
            !igual(venta.valorRecibido - venta.total, venta.cambio)) throw new Error("Efectivo/cambio histórico incompleto o inconsistente.");
    } else if (venta.valorRecibido !== "" || venta.cambio !== "") throw new Error("Un pago no efectivo debe tener recibido/cambio vacíos.");
    const copia = {};
    campos.forEach(function (c) { copia[c] = c === "itemsJson" ? detalle : venta[c]; });
    return copia;
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
