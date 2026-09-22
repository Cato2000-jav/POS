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

const obtenerHistorial = () => {
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

const guardarHistorial = (
    historial
) => {

    try {

        localStorage.setItem(
            CLAVE_HISTORIAL,
            JSON.stringify(
                historial
            )
        );

        return true;

    } catch (error) {

        console.error(
            "No fue posible guardar el historial:",
            error
        );

        return false;
    }
};


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

const registrarVenta = (
    {
        persona = "Cliente general",
        metodoPago = "No especificado",
        subtotal = 0,
        iva = 0,
        total = 0,
        items = 0,
        productos = [],
        dineroRecibido = null,
        cambio = null
    }
) => {

    const historialActual =
        obtenerHistorial();

    if (historialActual === null) {
        return null;
    }

    const nuevaVenta = {

        id:
            `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,

        fecha:
            obtenerFechaActual(),

        hora:
            obtenerHoraActual(),

        persona,

        metodoPago,

        subtotal:
            Number(
                subtotal
            ),

        iva:
            Number(
                iva
            ),

        total:
            Number(
                total
            ),

        items:
            Number(
                items
            ),

        productos:
            Array.isArray(
                productos
            )
                ?
                productos
                :
                [],

        dineroRecibido:
            dineroRecibido
            ===
            null
                ?
                null
                :
                Number(
                    dineroRecibido
                ),

        cambio:
            cambio
            ===
            null
                ?
                null
                :
                Number(
                    cambio
                )
    };

    

    historialActual.unshift(
        nuevaVenta
    );


    if (!guardarHistorial(historialActual)) {

        return null;

    }


    /*
    Si estamos en la página
    del historial, renderizamos.
    */

    if (
        tableBody
        &&
        salesCount
    ) {

        renderHistorial();

    }


    return nuevaVenta;
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


    const historial =
        obtenerHistorial();


    tableBody.innerHTML =
        "";

    if (historial === null) {
        salesCount.textContent = "Historial no disponible";
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 6;
        celda.className = "empty-state";
        celda.textContent = "No se pudo leer el historial. Los datos guardados no se han modificado.";
        fila.appendChild(celda);
        tableBody.appendChild(fila);
        return;
    }

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

        mostrarEstadoVacio();

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


    window.alert(
        `FACTURA #${venta.id}

Fecha: ${venta.fecha}
Hora: ${venta.hora}
Trabajador: ${venta.persona}
Método: ${venta.metodoPago}

PRODUCTOS
${productosTexto}

Subtotal: ${formatearMoneda(venta.subtotal)}
IVA 19%: ${formatearMoneda(venta.iva)}
TOTAL: ${formatearMoneda(venta.total)}`
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
            </p>

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

const mostrarNotificacion = (
    mensaje
) => {

    const anterior =
        document.querySelector(
            ".notification"
        );


    if (anterior) {

        anterior.remove();

    }


    const notificacion =
        document.createElement(
            "div"
        );


    notificacion.className =
        "notification";


    notificacion.textContent =
        mensaje;


    document.body.appendChild(
        notificacion
    );


    window.setTimeout(
        () => {

            notificacion.classList.add(
                "notification-hide"
            );


            window.setTimeout(
                () => {

                    notificacion.remove();

                },
                200
            );

        },
        1800
    );
};


/*
=========================================================
ELIMINAR UNA VENTA
=========================================================
*/

const eliminarVentaHistorica = (
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
            (registro) =>
                String(
                    registro.id
                )
                ===
                String(
                    idVenta
                )
        );


    if (!venta) {

        mostrarNotificacion(
            "No se encontró la factura que deseas borrar."
        );

        return;

    }


    const confirmar =
        window.confirm(
            `¿Deseas borrar la factura #${venta.id}?`
        );


    if (!confirmar) {

        return;

    }


    const historialActualizado =
        historial.filter(
            (registro) =>
                String(
                    registro.id
                )
                !==
                String(
                    idVenta
                )
        );


    if (!guardarHistorial(historialActualizado)) {

        mostrarNotificacion(
            "No fue posible borrar la factura."
        );

        return;

    }


    renderHistorial();

    mostrarNotificacion(
        "Factura eliminada correctamente."
    );
};


/*
=========================================================
LIMPIAR HISTORIAL
=========================================================
*/

const limpiarHistorial = () => {

    const historial =
        obtenerHistorial();

    if (historial === null) {
        mostrarNotificacion("No se pudo leer el historial. No se realizó la operación.");
        return;
    }


    if (
        historial.length
        ===
        0
    ) {

        mostrarNotificacion(
            "No hay ventas para eliminar."
        );

        return;
    }


    const confirmar =
        window.confirm(
            "¿Seguro que deseas eliminar todo el historial de ventas?"
        );


    if (!confirmar) {

        return;
    }


    try {
        localStorage.removeItem(CLAVE_HISTORIAL);
    } catch (error) {
        console.error("No fue posible limpiar el historial:", error);
        mostrarNotificacion("No fue posible eliminar el historial. Intenta nuevamente.");
        return;
    }


    renderHistorial();


    mostrarNotificacion(
        "Historial eliminado correctamente."
    );
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

renderHistorial();
