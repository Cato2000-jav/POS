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
