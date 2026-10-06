// Migración individual. El historial original no se borra ni se modifica.
const claveImportacionPendiente = "papelLuna.importacionPendiente.v1";
const importacionEstado = {ocupado: false, pendiente: null, bloqueado: false};

function convertirFechaHistorica(fecha, hora) {
    const d = typeof fecha === "string" && fecha.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const h = typeof hora === "string" && hora.toLowerCase().replace(/[\s.]/g, "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(am|pm)?$/);
    if (!d || !h) throw new Error("Fecha/hora no reconocida: se requiere día/mes/año y hora de Bogotá.");
    const dia = Number(d[1]), mes = Number(d[2]), anio = Number(d[3]);
    let horas = Number(h[1]); const minutos = Number(h[2]), segundos = Number(h[3] || 0);
    // No aplicar UTC-5 a fechas antiguas con posibles cambios históricos de horario.
    if (anio < 1994 || mes < 1 || mes > 12 || dia < 1 || dia > 31 || minutos > 59 || segundos > 59 ||
        (h[4] ? horas < 1 || horas > 12 : horas > 23)) throw new Error("Fecha/hora fuera de rango; necesita revisión manual.");
    if (h[4]) horas = horas % 12 + (h[4] === "pm" ? 12 : 0);
    const calendario = new Date(Date.UTC(anio, mes - 1, dia));
    if (calendario.getUTCMonth() !== mes - 1 || calendario.getUTCDate() !== dia) throw new Error("La fecha antigua no existe en el calendario.");
    return new Date(Date.UTC(anio, mes - 1, dia, horas + 5, minutos, segundos)).toISOString();
}

function convertirVentaAnterior(anterior) {
    const revision = analizarHistorialAnterior([anterior], [])[0];
    if (revision.estado !== "Candidato a migración") throw new Error(revision.notas.join(" "));
    const clienteId = anterior.clienteId == null ? "" : String(anterior.clienteId);
    const clienteNombre = anterior.clienteNombre == null ? "" : anterior.clienteNombre;
    if (typeof clienteNombre !== "string" || (clienteId ? !clienteNombre.trim() : clienteNombre !== "")) throw new Error("Falta resolver la relación y el nombre histórico del cliente.");
    const ids = new Set();
    const itemsJson = anterior.productos.map(item => {
        if (!["string", "number"].includes(typeof item.id) || !String(item.id).trim() ||
            (typeof item.id === "number" && !Number.isFinite(item.id)) || ids.has(String(item.id))) throw new Error("Hay productos sin ID histórico válido o repetidos.");
        ids.add(String(item.id));
        const copia = {id: String(item.id), nombre: item.nombre, precio: item.precio, cantidad: item.cantidad, subtotal: item.subtotal};
        if (item.categoriaId != null) copia.categoriaId = String(item.categoriaId);
        return copia;
    });
    return {origenId: String(anterior.id).trim(), venta: {
        fecha: convertirFechaHistorica(anterior.fecha, anterior.hora), persona: anterior.persona,
        clienteId, clienteNombre, metodoPago: anterior.metodoPago, subtotal: anterior.subtotal,
        iva: anterior.iva, total: anterior.total,
        valorRecibido: anterior.metodoPago === "Efectivo" ? anterior.dineroRecibido : "",
        cambio: anterior.metodoPago === "Efectivo" ? anterior.cambio : "", itemsJson
    }};
}

function bloquearImportacion() {
    const bloqueado = importacionEstado.ocupado || !!importacionEstado.pendiente || importacionEstado.bloqueado;
    document.querySelectorAll(".importar-historica").forEach(b => {b.disabled = bloqueado;});
    const reintentar = document.querySelector("#reintentarImportacion");
    reintentar.hidden = !importacionEstado.pendiente;
    reintentar.disabled = importacionEstado.ocupado || importacionEstado.bloqueado;
}

function agregarBotonImportacion(elemento, anterior) {
    try {
        const datos = convertirVentaAnterior(anterior);
        const boton = document.createElement("button"); boton.type = "button"; boton.className = "importar-historica";
        boton.textContent = "Revisar e importar " + datos.origenId;
        boton.addEventListener("click", () => importarVentaAnterior(datos));
        elemento.appendChild(boton); bloquearImportacion();
    } catch (error) {
        const aviso = document.createElement("p"); aviso.textContent = "No habilitada para importar: " + error.message; elemento.appendChild(aviso);
    }
}

function recuperarImportacionPendiente() {
    try {
        const texto = localStorage.getItem(claveImportacionPendiente);
        if (!texto) return;
        const datos = JSON.parse(texto);
        if (!datos || typeof datos.origenId !== "string" || !datos.origenId.trim()) throw new Error("ID inválido");
        // Valida también la forma histórica usando los mismos controles del conversor.
        const v = datos.venta;
        if (!v || typeof v.fecha !== "string" || !Number.isFinite(Date.parse(v.fecha)) || new Date(v.fecha).toISOString() !== v.fecha) throw new Error("Fecha inválida");
        const local = new Date(Date.parse(v.fecha) - 5 * 3600000);
        const convertido = convertirVentaAnterior({...v, id: datos.origenId, productos: v.itemsJson, dineroRecibido: v.valorRecibido,
            fecha: `${local.getUTCDate()}/${local.getUTCMonth() + 1}/${local.getUTCFullYear()}`,
            hora: `${local.getUTCHours()}:${String(local.getUTCMinutes()).padStart(2, "0")}:${String(local.getUTCSeconds()).padStart(2, "0")}`});
        if (JSON.stringify(convertido) !== JSON.stringify(datos)) throw new Error("El borrador no coincide con el formato esperado");
        importacionEstado.pendiente = datos;
        document.querySelector("#estadoImportacion").textContent = "Hay una importación pendiente: " + datos.origenId + ". Reintenta el mismo registro; no se envía automáticamente.";
    } catch (error) {
        importacionEstado.bloqueado = true;
        document.querySelector("#estadoImportacion").textContent = "No se pudo recuperar el borrador. No se importarán registros hasta revisar el archivo y Sheets. " + error.message;
    }
    bloquearImportacion();
}

async function importarVentaAnterior(datos) {
    if (importacionEstado.ocupado || importacionEstado.bloqueado) return;
    const mensaje = document.querySelector("#estadoImportacion");
    if (!importacionEstado.pendiente) {
        if (!datos) return;
        const v = datos.venta;
        const fecha = new Date(v.fecha).toLocaleString("es-CO", {timeZone: "America/Bogota"});
        if (!window.confirm(`¿Importar la venta antigua ${datos.origenId}?\nFecha/hora Bogotá: ${fecha}\nTrabajador: ${v.persona}\nMétodo: ${v.metodoPago}\nTotal: ${v.total}\nNo modifica inventario. Conserva el archivo original.`)) return;
        try {
            if (localStorage.getItem(claveImportacionPendiente)) {recuperarImportacionPendiente(); return;}
            localStorage.setItem(claveImportacionPendiente, JSON.stringify(datos));
            importacionEstado.pendiente = JSON.parse(JSON.stringify(datos));
        } catch (error) {mensaje.textContent = "No se envió: no se pudo conservar el borrador. " + error.message; return;}
    }
    importacionEstado.ocupado = true; bloquearImportacion(); mensaje.textContent = "Importando registro histórico…";
    try {
        const pendiente = importacionEstado.pendiente;
        const resultado = await api.guardar("ventas", "importar", pendiente);
        const esperado = pendiente.venta;
        if (resultado?.id !== "mvp1-" + encodeURIComponent(pendiente.origenId) || resultado.estado !== "cerrada" ||
            Object.keys(esperado).some(campo => JSON.stringify(resultado[campo]) !== JSON.stringify(esperado[campo]))) throw new Error("La respuesta no confirma los mismos datos históricos.");
        localStorage.removeItem(claveImportacionPendiente);
        importacionEstado.pendiente = null;
        // Invalidar los botones de la revisión anterior para evitar operar sobre una lista obsoleta.
        document.querySelector("#listaMigracion").replaceChildren();
        mensaje.textContent = "Venta " + pendiente.origenId + " importada y confirmada. Actualiza el historial de Sheets o prepara otra vista previa. No se borró el original.";
    } catch (error) {
        if (error.codigo === "RECHAZADO") {
            try {localStorage.removeItem(claveImportacionPendiente); importacionEstado.pendiente = null;}
            catch {mensaje.textContent = "No se pudo retirar el borrador rechazado. Se conserva para revisión."; return;}
        }
        mensaje.textContent = error.message + (importacionEstado.pendiente ? " Resultado pendiente: reintenta con el mismo ID y datos." : " No se confirmó la importación; revisa los datos y la versión publicada de Code.gs.");
    } finally {importacionEstado.ocupado = false; bloquearImportacion();}
}

document.querySelector("#reintentarImportacion").addEventListener("click", () => importarVentaAnterior());
recuperarImportacionPendiente();
