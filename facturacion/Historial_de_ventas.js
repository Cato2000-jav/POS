const CLAVE_HISTORIAL = "papelYLunaHistorial";

const tableBody = document.querySelector("#sales-table-body");
const salesCount = document.querySelector("#sales-count");
const clearHistoryButton = document.querySelector("#clear-history-button");
/*Obtiene el historial guardado en localstorage. solo almacena testo por eso se usa JSON para convertir nuevamente el texto en un array */
const obtenerHistorial = () => {
    const historialGuardado =
    localStorage.getItem(CLAVE_HISTORIAL);

    if (!historialGuardado) {
        return [];
    }

    try {
        const historial = JSON.parse(historialGuardado);
        return Array.isArray(historial) ? historial : [];
    } catch (error) {
        console.error("No fue posible leer el historial:", error);
        return [];
    }
};
/*guarda el array completo del historial en localstorage*/
const guardarHistorial = (historial) => {
    localStorage.setItem(
        CLAVE_HISTORIAL,
        JSON.stringify(historial)
    );
};

/*obtiene la hora local con formato colombiano*/

const obtenerHoraActual = () => {
    return new Intl.DateTimeFormat("es-CO",{
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(new Date());
};

/*obtiene la fecha actual con formato dia/mes/años*/
const obtenerFechaActual = () => {
    return new Intl
}