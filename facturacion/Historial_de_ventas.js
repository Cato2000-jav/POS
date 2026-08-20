/*Historial de ventas de Papel y Luna.*/
const CLAVE_HISTORIAL = "papelYLunaHistorial";
const tableBody = document.querySelector("#sales-table-body");
const salesCount = document.querySelector("#sales-count");
const clearHistoryButton = document.querySelector("#clear-history-button");

/*Obtiene el historial guardado en localStorage. localStorage solo almacena textos, por eso usamos JSON.parse() para convertir nuevamente el texto en un array de objetos.*/
const obtenerHistorial = () => {
    const historialGuardado = localStorage.getItem(CLAVE_HISTORIAL);

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

/*Guarda el array completo del historial en localStorage. JSON.stringify() convierte el array de objetos en texto.*/
const guardarHistorial = (historial) => {
    localStorage.setItem(
        CLAVE_HISTORIAL,
        JSON.stringify(historial)
    );
};

/*Obtiene la hora actual con formato colombiano.*/
const obtenerHoraActual = () => {
    return new Intl.DateTimeFormat("es-CO", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(new Date());
};

/*Obtiene la fecha actual con formato día/mes/año.*/
const obtenerFechaActual = () => {
    return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(new Date());
};

/*Formatea un valor como moneda colombiana.*/
const formatearMoneda = (valor) => {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(Number(valor) || 0);
};

/*Registra una nueva venta en el historial. La función recibe los datos principales de una venta y agrega automáticamente id, fecha y hora. */
const registrarVenta = ({
    persona = "Cliente general",
    metodoPago = "No especificado",
    subtotal = 0,
    iva = 0,
    total = 0,
    items = 0
}) => {
    const historialActual = obtenerHistorial();

    const nuevaVenta = {
        id: Date.now(),
        fecha: obtenerFechaActual(),
        hora: obtenerHoraActual(),
        persona,
        metodoPago,
        subtotal: Number(subtotal),
        iva: Number(iva),
        total: Number(total),
        items: Number(items)
    };

    historialActual.unshift(nuevaVenta);
    guardarHistorial(historialActual);
    renderHistorial();

    return nuevaVenta;
};

/*Renderiza todo el historial en la tabla.*/
const renderHistorial = () => {
    const historial = obtenerHistorial();

    tableBody.innerHTML = "";

    salesCount.textContent = `${historial.length} ${
        historial.length === 1 ? "venta" : "ventas"
    }`;

    if (historial.length === 0) {
        mostrarEstadoVacio();
        return;
    }

    historial.forEach((venta) => {
        const fila = crearFilaVenta(venta);
        tableBody.appendChild(fila);
    });
};

/*Crea una fila de tabla a partir de una venta.*/
const crearFilaVenta = (venta) => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
        <td>
            <span>${venta.hora}</span>
            <small class="date-cell">${venta.fecha}</small>
        </td>

        <td class="person-cell">
            ${venta.persona}
        </td>

        <td>
            ${venta.metodoPago}
        </td>

        <td class="total-cell">
            ${formatearMoneda(venta.total)}
        </td>

        <td class="items-cell">
            ${venta.items}
            ${Number(venta.items) === 1 ? "item" : "items"}
        </td>
    `;

    return fila;
};

/*Muestra el estado visual cuando no hay ventas.*/
const mostrarEstadoVacio = () => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
        <td colspan="5" class="empty-state">
            <span class="empty-state-icon">🧾</span>

            <p class="empty-state-title">
                Aún no hay ventas registradas
            </p>

            <p class="empty-state-text">
                Las ventas finalizadas aparecerán aquí automáticamente.
            </p>
        </td>
    `;

    tableBody.appendChild(fila);
};

/*Muestra una notificación temporal.*/
const mostrarNotificacion = (mensaje) => {
    const notificacionAnterior = document.querySelector(".notification");

    if (notificacionAnterior) {
        notificacionAnterior.remove();
    }

    const notificacion = document.createElement("div");

    notificacion.className = "notification";
    notificacion.textContent = mensaje;

    document.body.appendChild(notificacion);

    window.setTimeout(() => {
        notificacion.classList.add("notification-hide");

        window.setTimeout(() => {
            notificacion.remove();
        }, 200);
    }, 1800);
};

/*Elimina todo el historial guardado.*/
const limpiarHistorial = () => {
    const historial = obtenerHistorial();

    if (historial.length === 0) {
        mostrarNotificacion("No hay ventas para eliminar.");
        return;
    }

    const confirmar = window.confirm(
        "¿Seguro que deseas eliminar todo el historial de ventas?"
    );
    if (!confirmar) {
        return;
    }
    localStorage.removeItem(CLAVE_HISTORIAL);
    renderHistorial();
    mostrarNotificacion("Historial eliminado correctamente.");
};

/*Evento para limpiar el historial.*/
clearHistoryButton.addEventListener("click", limpiarHistorial);

/* Permite que app.js pueda registrar ventas. Al estar disponible en window, puede utilizarse desde otro archivo.*/
window.registrarVentaEnHistorial = registrarVenta;

/*Renderizado inicial. */
renderHistorial();