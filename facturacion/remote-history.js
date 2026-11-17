// Fuente principal remota. El historial anterior se consulta explícitamente, sin migrarlo ni borrarlo.
const historialConsulta = { fuente: "sheets", registros: null, cargando: false, incidencias: [] };

// Separa registros utilizables de registros que necesitan revisión. No escribe datos.
function revisarVentasHistorial(ventas) {
    if (!Array.isArray(ventas)) throw new Error("La respuesta no contiene una lista de ventas.");
    const frecuencias = new Map();
    for (const venta of ventas) {
        if (venta && typeof venta.id === "string") frecuencias.set(venta.id, (frecuencias.get(venta.id) || 0) + 1);
    }
    const registros = [], incidencias = [], fechas = new Map();
    ventas.forEach((venta, indice) => {
        const referencia = venta && typeof venta.id === "string" && venta.id.trim() ? venta.id : `Registro ${indice + 1} sin ID`;
        try {
            if (venta && frecuencias.get(venta.id) > 1) throw new Error("ID duplicado: se excluyen todas sus coincidencias para evitar ambigüedad.");
            registros.push(adaptarVentaHistorial(venta));
            fechas.set(venta.id, Date.parse(venta.fecha));
        } catch (error) { incidencias.push(`${referencia}: ${error.message}`); }
    });
    registros.sort((a, b) => fechas.get(b.id) - fechas.get(a.id));
    return {registros, incidencias};
}

function mostrarIncidenciasHistorial() {
    const panel = document.querySelector("#incidenciasHistorial");
    const lista = document.querySelector("#listaIncidenciasHistorial");
    lista.replaceChildren();
    panel.hidden = historialConsulta.fuente !== "sheets" || !historialConsulta.incidencias.length;
    for (const mensaje of historialConsulta.incidencias) {
        const elemento = document.createElement("li");
        elemento.textContent = mensaje;
        lista.appendChild(elemento);
    }
}

async function cargarHistorialRemoto() {
    if (historialConsulta.cargando) return;
    const mensaje = document.querySelector("#estadoHistorial");
    const boton = document.querySelector("#recargarHistorial");
    const selector = document.querySelector("#fuenteHistorial");
    historialConsulta.fuente = selector.value;
    mostrarIncidenciasHistorial();
    if (historialConsulta.fuente === "anterior") {
        const anteriores = leerHistorialAnterior();
        mensaje.dataset.tipoMensaje = anteriores === null ? "error" : "info";
        mensaje.textContent = anteriores === null ? "No se pudo leer el historial anterior; no se modificó ningún dato."
            : "Archivo del navegador, solo lectura. No se ha importado a Sheets ni se ha modificado inventario.";
        renderHistorial();
        return;
    }
    historialConsulta.cargando = true;
    boton.disabled = true;
    selector.disabled = true;
    mensaje.dataset.tipoMensaje = "loading";
    mensaje.textContent = "Cargando ventas desde el servidor…";
    renderHistorial(); // Al cambiar de fuente no dejar filas del archivo local bajo el título de Sheets.
    try {
        const ventas = await api.listar("ventas");
        const {registros, incidencias} = revisarVentasHistorial(ventas);
        historialConsulta.registros = registros;
        historialConsulta.incidencias = incidencias;
        mensaje.dataset.tipoMensaje = incidencias.length ? "warning" : "success";
        mensaje.textContent = `${registros.length} venta(s) válida(s) de ${ventas.length} registro(s) recibidos. ` +
            (incidencias.length ? `Atención: ${incidencias.length} registro(s) excluido(s) de la tabla por datos incompletos o inválidos; consulta Registros por revisar. No se modificó Sheets ni inventario.` : "Las abiertas no permiten imprimir factura.");
    } catch (error) {
        mensaje.dataset.tipoMensaje = "error";
        mensaje.textContent = "No se pudo actualizar el historial: " + error.message +
            (historialConsulta.registros === null ? " Pulsa Actualizar historial para reintentar." : " Se muestra la última carga confirmada.");
    } finally {
        historialConsulta.cargando = false;
        boton.disabled = false;
        selector.disabled = false;
        mostrarIncidenciasHistorial();
        renderHistorial();
    }
}

document.querySelector("#fuenteHistorial").addEventListener("change", cargarHistorialRemoto);
document.querySelector("#recargarHistorial").addEventListener("click", cargarHistorialRemoto);
