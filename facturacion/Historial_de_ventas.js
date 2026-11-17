/*
=========================================================
HISTORIAL DE VENTAS
PAPEL Y LUNA
=========================================================
*/

const CLAVE_HISTORIAL =
    "papelYLunaHistorial";


const tableBody =
    document.querySelector(
        "#sales-table-body"
    );


const salesCount =
    document.querySelector(
        "#sales-count"
    );


const clearHistoryButton =
    document.querySelector(
        "#clear-history-button"
    );


/*
=========================================================
OBTENER HISTORIAL
=========================================================
*/

const obtenerHistorial = () => historialConsulta.fuente === "anterior"
    ? leerHistorialAnterior() : historialConsulta.registros;

const leerHistorialAnterior = () => {
    try {
        const historialGuardado = localStorage.getItem(CLAVE_HISTORIAL);

        // Solo una clave inexistente representa un historial nuevo.
        if (historialGuardado === null) {
            return [];
        }

        const historial =
            JSON.parse(
                historialGuardado
            );


        if (!Array.isArray(historial) || historial.some(
            (venta) => venta === null || typeof venta !== "object" || Array.isArray(venta)
        )) {
            throw new Error("El historial no contiene una lista válida de ventas.");
        }

        return historial;

    } catch (error) {

        console.error(
            "No fue posible leer el historial:",
            error
        );

        // null indica fallo: los consumidores deben detenerse, no sobrescribir.
        return null;
    }
};


/*
=========================================================
GUARDAR HISTORIAL
=========================================================
*/

// Compatibilidad: el archivo anterior es solo lectura; no se permiten escrituras locales.
const guardarHistorial = () => false;


/*
=========================================================
FECHA Y HORA
=========================================================
*/

const obtenerHoraActual = () => {

    return new Intl.DateTimeFormat(
        "es-CO",
        {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    ).format(
        new Date()
    );
};


const obtenerFechaActual = () => {

    return new Intl.DateTimeFormat(
        "es-CO",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(
        new Date()
    );
};


/*
=========================================================
MONEDA
=========================================================
*/

const formatearMoneda = (
    valor
) => {

    return new Intl.NumberFormat(
        "es-CO",
        {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }
    ).format(
        Number(valor)
        ||
        0
    );
};


/*
=========================================================
REGISTRAR VENTA
=========================================================
*/

// Se conserva el nombre por compatibilidad, pero ya no registra ventas locales.
const registrarVenta = () => {
    mostrarNotificacion("Las ventas se registran desde facturación mediante el servidor.");
    return null;
};


/*
=========================================================
RENDER HISTORIAL
=========================================================
*/

const renderHistorial = () => {

    if (
        !tableBody
        ||
        !salesCount
    ) {

        return;

    }


    let historial =
        obtenerHistorial();


    tableBody.innerHTML =
        "";

    if (historial === null) {
        salesCount.textContent = historialConsulta.cargando ? "Cargando…" : "Historial no disponible";
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 6;
        celda.className = "empty-state";
        celda.textContent = historialConsulta.cargando ? "Cargando ventas desde el servidor…"
            : "No se pudo leer el historial. Los datos guardados no se han modificado.";
        fila.appendChild(celda);
        tableBody.appendChild(fila);
        return;
    }

    const filtros = leerFiltrosHistorial("filtrosVentas");
    const totalSinFiltrar = historial.length;
    historial = filtrarHistorial(historial, filtros);
    document.getElementById("resultadoFiltrosVentas").textContent = filtros.desde && filtros.hasta && filtros.desde > filtros.hasta
        ? "La fecha Desde no puede ser posterior a Hasta."
        : `${historial.length} de ${totalSinFiltrar} ventas. El cliente se busca por nombre guardado o ID.`;
    salesCount.textContent =
        `${historial.length} ${
            historial.length
            ===
            1
                ?
                "venta"
                :
                "ventas"
        }`;


    if (
        historial.length
        ===
        0
    ) {

        const fila = document.createElement("tr"), celda = document.createElement("td");
        celda.colSpan = 6;
        celda.className = "empty-state";
        celda.textContent = totalSinFiltrar ? "No hay ventas que coincidan con los filtros." : "No hay ventas registradas en esta fuente.";
        fila.appendChild(celda); tableBody.appendChild(fila);

        return;
    }


    historial.forEach(
        (venta) => {

            const fila =
                crearFilaVenta(
                    venta
                );


            tableBody.appendChild(
                fila
            );

        }
    );
};


/*
=========================================================
CREAR FILA
=========================================================
*/

const crearFilaVenta = (
    venta
) => {

    const fila =
        document.createElement(
            "tr"
        );


    fila.innerHTML = `

        <td>

            <span>
                ${escaparHTML(venta.hora)}
            </span>

            <small class="date-cell">
                ${escaparHTML(venta.fecha)}
            </small>

        </td>


        <td class="person-cell">
            ${escaparHTML(venta.persona)}
${window.marcaVentaHTML ? window.marcaVentaHTML(venta) : ""}
            <small class="date-cell">Cliente: ${escaparHTML(venta.clienteNombre || venta.clienteId || "Sin cliente registrado")}</small>
            <small class="date-cell">${venta.estado === "abierta" ? "Abierta · sin factura definitiva" : "Cerrada"}</small>
        </td>


        <td>
            ${escaparHTML(venta.metodoPago)}
        </td>


        <td class="total-cell">
            ${
                formatearMoneda(
                    venta.total
                )
            }
        </td>


        <td class="items-cell">

            ${escaparHTML(venta.items)}

            ${
                Number(
                    venta.items
                )
                ===
                1
                    ?
                    "item"
                    :
                    "items"
            }

        </td>


        <td class="acciones-cell">

            <button
                class="btn-ver-detalle"
                data-id="${escaparHTML(venta.id)}"
                type="button"
            >
                Ver detalle
            </button>

            <button
                class="btn-imprimir-historial"
                data-id="${escaparHTML(venta.id)}"
                type="button"
            >
                Imprimir
            </button>

            <button
                class="btn-eliminar-venta"
                hidden disabled
                data-id="${escaparHTML(venta.id)}"
                type="button"
            >
                Borrar
            </button>

        </td>
    `;


    /*
    VER DETALLE
    */

    const botonDetalle =
        fila.querySelector(
            ".btn-ver-detalle"
        );


    botonDetalle.addEventListener(
        "click",
        () => {

            verDetalleVenta(
                venta.id
            );

        }
    );


    /*
    IMPRIMIR
    */

    const botonImprimir =
        fila.querySelector(
            ".btn-imprimir-historial"
        );


    botonImprimir.addEventListener(
        "click",
        () => {

            imprimirVentaHistorica(
                venta.id
            );

        }
    );
    botonImprimir.hidden = venta.estado === "abierta";
    botonImprimir.disabled = venta.estado === "abierta";


    const botonEliminar =
        fila.querySelector(
            ".btn-eliminar-venta"
        );


    botonEliminar.addEventListener(
        "click",
        () => {

            eliminarVentaHistorica(
                venta.id
            );

        }
    );


    return fila;
};


/*
=========================================================
ESTADO VACÍO
=========================================================
*/

const mostrarEstadoVacio = () => {

    const fila =
        document.createElement(
            "tr"
        );


    fila.innerHTML = `

        <td
            colspan="6"
            class="empty-state"
        >

            <span class="empty-state-icon">
                🧾
            </span>


            <p class="empty-state-title">
                Aún no hay ventas registradas
            </p>


            <p class="empty-state-text">
                Las ventas finalizadas aparecerán
                aquí automáticamente.
            </p>

        </td>
    `;


    tableBody.appendChild(
        fila
    );
};


/*
=========================================================
VER DETALLE
=========================================================
*/

const verDetalleVenta = (
    idVenta
) => {

    const historial =
        obtenerHistorial();

    if (historial === null) {
        mostrarNotificacion("No se pudo leer el historial. No se realizó la operación.");
        return;
    }


    const venta =
        historial.find(
            (venta) =>
                String(
                    venta.id
                )
                ===
                String(
                    idVenta
                )
        );


    if (!venta) {

        mostrarNotificacion(
            "No se encontró la venta."
        );

        return;
    }


    const productosVenta =
        Array.isArray(
            venta.productos
        )
            ?
            venta.productos
            :
            [];


    let productosTexto =
        "";


    if (
        productosVenta.length
        ===
        0
    ) {

        productosTexto =
            "Esta venta fue registrada antes de guardar el detalle de productos.";

    } else {

        productosTexto =
            productosVenta
                .map(
                    (producto) => {

                        return (
                            `${producto.nombre} x ${producto.cantidad}`
                            +
                            ` = ${formatearMoneda(producto.subtotal)}`
                        );

                    }
                )
                .join("\n");
    }


    confirmarAccion(
        `${venta.estado === "abierta" ? "VENTA ABIERTA — NO ES FACTURA" : "FACTURA"} #${venta.id}

Fecha: ${venta.fecha}
Hora: ${venta.hora}
Trabajador: ${venta.persona}
Cliente: ${venta.clienteNombre || "Sin cliente"}
Método: ${venta.metodoPago}

PRODUCTOS
${productosTexto}

Subtotal: ${formatearMoneda(venta.subtotal)}
IVA 19%: ${formatearMoneda(venta.iva)}
TOTAL: ${formatearMoneda(venta.total)}`, {titulo: venta.estado === "abierta" ? "Detalle de venta abierta" : "Detalle de la factura", aceptar: "Cerrar", soloLectura: true}
    );
};


/*
=========================================================
IMPRIMIR VENTA HISTÓRICA
=========================================================
*/

const imprimirVentaHistorica = (
    idVenta
) => {

    const historial =
        obtenerHistorial();

    if (historial === null) {
        mostrarNotificacion("No se pudo leer el historial. No se realizó la operación.");
        return;
    }


    const venta =
        historial.find(
            (venta) =>
                String(
                    venta.id
                )
                ===
                String(
                    idVenta
                )
        );


    if (!venta) {

        mostrarNotificacion(
            "No se encontró la venta."
        );

        return;
    }


    if (venta.estado === "abierta") {
        mostrarNotificacion("La venta está abierta. Ciérrala desde Facturación antes de imprimir una factura.");
        return;
    }

    const productos =
        Array.isArray(
            venta.productos
        )
            ?
            venta.productos
            :
            [];


    const filas =
        productos
            .map(
                (producto) => `

                    <tr>

                        <td>
                            ${escaparHTML(producto.nombre)}
                        </td>

                        <td>
                            ${escaparHTML(producto.cantidad)}
                        </td>

                        <td>
                            ${
                                formatearMoneda(
                                    producto.precio
                                )
                            }
                        </td>

                        <td>
                            ${
                                formatearMoneda(
                                    producto.subtotal
                                )
                            }
                        </td>

                    </tr>
                `
            )
            .join("");


    const ventana =
        window.open(
            "",
            "_blank",
            "width=800,height=900"
        );


    if (!ventana) {

        mostrarNotificacion(
            "El navegador bloqueó la ventana de impresión."
        );

        return;
    }


    ventana.document.write(`

        <!DOCTYPE html>

        <html lang="es">

        <head>

            <meta charset="UTF-8">

            <title>
                Factura ${escaparHTML(venta.id)}
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    margin: 35px;
                    color: #2d2838;
                }

                h1 {
                    color: #5237b4;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 25px;
                }

                th,
                td {
                    padding: 10px;
                    border-bottom: 1px solid #ded8e8;
                    text-align: left;
                }

                th {
                    background: #f4efff;
                }

                .totales {
                    width: 300px;
                    margin-left: auto;
                    margin-top: 25px;
                }

                .linea {
                    display: flex;
                    justify-content: space-between;
                    padding: 7px 0;
                }

                .total {
                    border-top: 2px solid #5237b4;
                    margin-top: 8px;
                    padding-top: 12px;
                    font-size: 18px;
                }

                .acciones-impresion {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-bottom: 24px;
                }

                .acciones-impresion button {
                    padding: 9px 13px;
                    border: 0;
                    border-radius: 8px;
                    background: #5237b4;
                    color: #fff;
                    cursor: pointer;
                    font: inherit;
                    font-weight: 700;
                }

                .acciones-impresion .cerrar {
                    background: #eeeaf5;
                    color: #3d3650;
                }

                @media print {
                    .acciones-impresion {
                        display: none;
                    }
                }

            </style>

        </head>


        <body>

            <div class="acciones-impresion">
                <button type="button" onclick="window.print()">
                    Imprimir
                </button>

                <button class="cerrar" type="button" onclick="window.close()">
                    Cerrar
                </button>
            </div>

            <h1>
                PAPEL Y LUNA
            </h1>

            <h2>
                Factura #${escaparHTML(venta.id)}
            </h2>


            <p>
                Fecha:
                ${escaparHTML(venta.fecha)}
            </p>

            <p>
                Hora:
                ${escaparHTML(venta.hora)}
            </p>

            <p>
                Trabajador:
                ${escaparHTML(venta.persona)}
${window.marcaVentaHTML ? window.marcaVentaHTML(venta) : ""}
            </p>
            <p>Cliente: ${escaparHTML(venta.clienteNombre || "Sin cliente")}</p>

            <p>
                Método:
                ${escaparHTML(venta.metodoPago)}
            </p>


            <table>

                <thead>

                    <tr>

                        <th>
                            Producto
                        </th>

                        <th>
                            Cantidad
                        </th>

                        <th>
                            Precio
                        </th>

                        <th>
                            Subtotal
                        </th>

                    </tr>

                </thead>

                <tbody>
                    ${filas}
                </tbody>

            </table>


            <div class="totales">

                <div class="linea">

                    <span>
                        Subtotal
                    </span>

                    <strong>
                        ${
                            formatearMoneda(
                                venta.subtotal
                            )
                        }
                    </strong>

                </div>


                <div class="linea">

                    <span>
                        IVA
                    </span>

                    <strong>
                        ${
                            formatearMoneda(
                                venta.iva
                            )
                        }
                    </strong>

                </div>


                <div class="linea total">

                    <span>
                        TOTAL
                    </span>

                    <strong>
                        ${
                            formatearMoneda(
                                venta.total
                            )
                        }
                    </strong>

                </div>

            </div>

        </body>

        </html>
    `);


    ventana.document.close();

    ventana.focus();
};


/*
=========================================================
NOTIFICACIÓN
=========================================================
*/

const mostrarNotificacion = mensaje => notificarUI(mensaje, "info");


/*
=========================================================
ELIMINAR UNA VENTA
=========================================================
*/

const eliminarVentaHistorica = () => {
    mostrarNotificacion("Las ventas cerradas y el archivo anterior son de solo lectura.");
};


/*
=========================================================
LIMPIAR HISTORIAL
=========================================================
*/

const limpiarHistorial = () => {
    mostrarNotificacion("No se permite borrar el historial desde esta vista.");
};


/*
=========================================================
EVENTO LIMPIAR
=========================================================
*/

if (
    clearHistoryButton
) {

    clearHistoryButton.addEventListener(
        "click",
        limpiarHistorial
    );
}


/*
=========================================================
SINCRONIZAR HISTORIAL ENTRE PESTAÑAS
=========================================================
*/

window.addEventListener(
    "storage",
    (evento) => {

        if (
            evento.key
            ===
            CLAVE_HISTORIAL
            ||
            evento.key
            ===
            null
        ) {

            renderHistorial();

        }
    }
);


/*
=========================================================
EXPONER FUNCIÓN PARA APP.JS
=========================================================
*/

window.registrarVentaEnHistorial =
    registrarVenta;


/*
=========================================================
RENDER INICIAL
=========================================================
*/

if (tableBody) {
    prepararFiltrosHistorial("filtrosVentas", renderHistorial);
    cargarHistorialRemoto();
}
renderHistorial();
