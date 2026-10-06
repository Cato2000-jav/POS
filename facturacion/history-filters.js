// Filtra copias de listas ya cargadas. No hace peticiones ni modifica registros.
function fechaParaFiltro(registro) {
    if (registro.fechaFiltro) return registro.fechaFiltro;
    if (/^\d{4}-\d{2}-\d{2}$/.test(registro.fecha)) return registro.fecha;
    const partes = String(registro.fecha || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return partes ? `${partes[3]}-${partes[2].padStart(2, "0")}-${partes[1].padStart(2, "0")}` : "";
}
function filtrarHistorial(registros, filtros) {
    const texto = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
    return registros.filter(registro => {
        const fecha = fechaParaFiltro(registro);
        return (!filtros.desde || fecha && fecha >= filtros.desde) &&
            (!filtros.hasta || fecha && fecha <= filtros.hasta) &&
            (!filtros.pago || registro.metodoPago === filtros.pago) &&
            (!filtros.estado || (registro.estado || "cerrada") === filtros.estado) &&
            (!filtros.cliente || texto(`${registro.clienteNombre || ""} ${registro.clienteId || ""}`).includes(texto(filtros.cliente))) &&
            (!filtros.proveedor || registro.proveedorId === filtros.proveedor);
    });
}
function leerFiltrosHistorial(prefijo) {
    const filtros = {};
    for (const campo of ["desde", "hasta", "pago", "estado", "cliente", "proveedor"]) {
        filtros[campo] = document.getElementById(`${prefijo}-${campo}`)?.value || "";
    }
    return filtros;
}
function prepararFiltrosHistorial(prefijo, renderizar) {
    const formulario = document.getElementById(prefijo);
    formulario.addEventListener("submit", evento => evento.preventDefault());
    formulario.addEventListener("input", renderizar);
    formulario.addEventListener("change", renderizar);
    formulario.addEventListener("reset", () => setTimeout(() => {
        for (const campo of ["desde", "hasta", "pago", "estado", "cliente", "proveedor"]) {
            const control = document.getElementById(`${prefijo}-${campo}`);
            if (control) control.value = "";
        }
        renderizar();
    }, 0));
}
