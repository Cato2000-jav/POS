// Diagnóstico de solo lectura. No utiliza guardar ni crea cierres de ventas.
let migracionRevisando = false;

// Recibe ventas locales y remotas; devuelve un informe, sin alterar los originales.
function analizarHistorialAnterior(locales, remotas) {
    if (!Array.isArray(locales) || !Array.isArray(remotas)) throw new Error("Se necesitan dos listas de ventas válidas.");
    if (remotas.some(v => !v || typeof v.id !== "string" || !v.id || !["abierta", "cerrada"].includes(v.estado))) {
        throw new Error("La lista remota contiene registros inválidos; no se pueden descartar duplicados.");
    }
    const contar = (lista, id) => lista.filter(v => v && String(v.id ?? "") === id).length;
    return locales.map((venta, indice) => {
        const problemas = [];
        const id = venta && ["string", "number"].includes(typeof venta.id) ? String(venta.id).trim() : "";
        if (!id || (typeof venta?.id === "number" && !Number.isFinite(venta.id))) problemas.push("Falta un ID válido.");
        if (id && contar(locales, id) > 1) problemas.push("ID repetido en el historial anterior.");
        for (const campo of ["fecha", "hora", "persona"]) {
            if (typeof venta?.[campo] !== "string" || !venta[campo].trim()) problemas.push("Falta " + campo + ".");
        }
        if (!["Efectivo", "Nequi", "Debe", "Tarjeta débito"].includes(venta?.metodoPago)) problemas.push("Método de pago no reconocido.");
        if (venta?.metodoPago === "Debe" && !venta.clienteId) problemas.push("Debe sin cliente identificado.");
        const numero = n => typeof n === "number" && Number.isFinite(n) && n >= 0;
        const igual = (a, b) => Math.abs(a - b) <= 0.01;
        if (![venta?.subtotal, venta?.iva, venta?.total].every(numero)) problemas.push("Totales ausentes o inválidos.");
        else if (!igual(venta.subtotal + venta.iva, venta.total)) problemas.push("Subtotal más IVA no coincide con el total.");
        const items = venta?.productos;
        if (!Array.isArray(items) || !items.length) problemas.push("No tiene detalle de productos.");
        else if (items.some(i => !i || typeof i.nombre !== "string" || !i.nombre.trim() ||
            !Number.isSafeInteger(i.cantidad) || i.cantidad <= 0 || !numero(i.precio) || !numero(i.subtotal) ||
            !igual(i.precio * i.cantidad, i.subtotal))) problemas.push("Detalle incompleto o con cantidades/importes inconsistentes.");
        else if (!igual(items.reduce((s, i) => s + i.subtotal, 0), venta.subtotal)) problemas.push("La suma del detalle no coincide con el subtotal.");
        if (venta?.metodoPago === "Efectivo" && (!numero(venta.dineroRecibido) || !numero(venta.cambio) ||
            venta.dineroRecibido < venta.total || !igual(venta.dineroRecibido - venta.total, venta.cambio))) {
            problemas.push("Efectivo/cambio incompleto o inconsistente; no se inventarán esos valores.");
        }
        const coincidenciaId = id && contar(remotas, id) > 0;
        // Es solo una alerta: dos ventas legítimas pueden tener exactamente el mismo detalle.
        const firma = detalle => JSON.stringify(detalle.map(i => [i?.nombre, i?.cantidad, i?.precio, i?.subtotal]));
        const coincidenciaContenido = Array.isArray(items) && remotas.some(v => v.estado === "cerrada" &&
            Array.isArray(v.itemsJson) && v.total === venta.total && v.persona === venta.persona &&
            v.metodoPago === venta.metodoPago && firma(v.itemsJson) === firma(items));
        const estado = problemas.length ? "Requiere corrección" : coincidenciaId || coincidenciaContenido ? "Posible duplicado" : "Candidato a migración";
        const notas = [...problemas];
        if (coincidenciaId) notas.push("El ID ya existe en Sheets; revisar antes de importar.");
        if (coincidenciaContenido) notas.push("Coincide el contenido con una venta remota; no demuestra que sea la misma operación.");
        if (!problemas.length) notas.push("Pendiente validar y convertir fecha/hora, resolver relaciones y confirmar importación sin movimientos de stock.");
        return {fila: indice + 1, id: id || "Sin ID", estado, notas};
    });
}

async function prepararVistaMigracion() {
    if (migracionRevisando) return;
    const boton = document.querySelector("#revisarMigracion");
    const mensaje = document.querySelector("#estadoMigracion");
    const lista = document.querySelector("#listaMigracion");
    migracionRevisando = true; boton.disabled = true;
    lista.replaceChildren(); mensaje.textContent = "Leyendo archivo anterior y consultando ventas en Sheets…";
    try {
        const anteriores = leerHistorialAnterior();
        if (anteriores === null) throw new Error("El archivo local no se pudo leer; no se ha modificado.");
        if (!anteriores.length) {
            mensaje.textContent = "No hay ventas en el archivo de este navegador/origen. Esto no demuestra que no existan en otro navegador o al abrir con file://.";
            return;
        }
        const remotas = await api.listar("ventas");
        const informe = analizarHistorialAnterior(anteriores, remotas);
        for (const fila of informe) {
            const item = document.createElement("li");
            item.textContent = `Registro ${fila.fila} · ${fila.id} · ${fila.estado}. ${fila.notas.join(" ")}`;
            lista.appendChild(item);
        }
        mensaje.textContent = `${informe.length} registro(s) revisado(s): ${informe.filter(f => f.estado === "Candidato a migración").length} candidato(s), ${informe.filter(f => f.estado === "Posible duplicado").length} posible(s) duplicado(s), ${informe.filter(f => f.estado === "Requiere corrección").length} con problemas. No se importó ningún registro.`;
    } catch (error) { mensaje.textContent = "No se pudo preparar la revisión: " + error.message; }
    finally { migracionRevisando = false; boton.disabled = false; }
}

document.querySelector("#revisarMigracion").addEventListener("click", prepararVistaMigracion);
