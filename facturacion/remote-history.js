// Fuente principal remota. El historial anterior se consulta explícitamente, sin migrarlo ni borrarlo.
const historialConsulta = { fuente: "sheets", registros: null, cargando: false };

async function cargarHistorialRemoto() {
    if (historialConsulta.cargando) return;
    const mensaje = document.querySelector("#estadoHistorial");
    const boton = document.querySelector("#recargarHistorial");
    const selector = document.querySelector("#fuenteHistorial");
    historialConsulta.fuente = selector.value;
    if (historialConsulta.fuente === "anterior") {
        const anteriores = leerHistorialAnterior();
        mensaje.textContent = anteriores === null ? "No se pudo leer el historial anterior; no se modificó ningún dato."
            : "Archivo del navegador, solo lectura. No se ha importado a Sheets ni se ha modificado inventario.";
        renderHistorial();
        return;
    }
    historialConsulta.cargando = true;
    boton.disabled = true;
    selector.disabled = true;
    mensaje.textContent = "Cargando ventas cerradas desde Google Sheets…";
    renderHistorial(); // Al cambiar de fuente no dejar filas del archivo local bajo el título de Sheets.
    try {
        const ventas = await api.listar("ventas");
        if (ventas.some(v => !v || !["abierta", "cerrada"].includes(v.estado))) {
            throw new Error("Hay ventas con estado inválido.");
        }
        const cerradas = ventas.filter(v => v.estado === "cerrada");
        if (new Set(cerradas.map(v => v.id)).size !== cerradas.length) throw new Error("Hay IDs de ventas duplicados.");
        const registros = cerradas.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).map(adaptarVentaCerrada);
        historialConsulta.registros = registros;
        mensaje.textContent = `${registros.length} venta(s) cerrada(s) cargada(s) desde Google Sheets.`;
    } catch (error) {
        mensaje.textContent = "No se pudo actualizar el historial: " + error.message +
            (historialConsulta.registros === null ? " Pulsa Actualizar historial para reintentar." : " Se muestra la última carga confirmada.");
    } finally {
        historialConsulta.cargando = false;
        boton.disabled = false;
        selector.disabled = false;
        renderHistorial();
    }
}

document.querySelector("#fuenteHistorial").addEventListener("change", cargarHistorialRemoto);
document.querySelector("#recargarHistorial").addEventListener("click", cargarHistorialRemoto);
