/*
=========================================================
FUNCIONES ADICIONALES DE FACTURACIÓN
=========================================================

Este bloque complementa el código original sin modificar
la lógica existente del catálogo y la factura.
*/


/*
=========================================================
ELEMENTOS ADICIONALES DEL DOM
=========================================================
*/

const botonIniciarFactura =
    document.querySelector("#inifactura");

const botonImprimirFactura =
    document.querySelector("#btnimprimirFactura");

const botonCancelarFactura =
    document.querySelector("#btncancelarFactura");

const inputDineroCliente =
    document.querySelector("#cambio");

const contenedorCambio =
    document.querySelector(".cambio");


/*
=========================================================
CREAR CAMPO VISUAL PARA MOSTRAR EL CAMBIO
=========================================================

No necesitamos modificar el HTML.

JavaScript crea automáticamente un elemento
donde aparecerá el dinero que debe devolverse.
*/

const resultadoCambio =
    document.createElement("div");

resultadoCambio.id =
    "resultadoCambio";

resultadoCambio.style.marginTop =
    "8px";

resultadoCambio.style.fontWeight =
    "bold";

resultadoCambio.style.color =
    "#5b3fc4";

resultadoCambio.textContent =
    formatoMoneda.format(0);


/*
Insertamos el resultado dentro del bloque .cambio.
*/

if (contenedorCambio) {

    contenedorCambio.appendChild(
        resultadoCambio
    );

}


/*
=========================================================
GUARDAR VENTA EN EL HISTORIAL
=========================================================

Tu código original ya ejecuta:

window.registrarVentaEnHistorial(...)

Por eso creamos aquí esa función.

La información se almacena en localStorage para que
permanezca incluso si el navegador se actualiza.
*/

window.registrarVentaEnHistorial =
    (datosVenta) => {


        /*
        Recuperamos las ventas anteriores.
        */

        const historialGuardado =
            JSON.parse(
                localStorage.getItem(
                    "papelYLunaHistorial"
                )
            ) || [];


        const ahora =
            new Date();


        /*
        Creamos el objeto completo de la venta.
        */

        const nuevaVenta = {

            id:
                Date.now(),

            fecha:
                ahora.toLocaleDateString(
                    "es-CO"
                ),

            hora:
                ahora.toLocaleTimeString(
                    "es-CO",
                    {
                        hour:
                            "2-digit",

                        minute:
                            "2-digit"
                    }
                ),

            persona:
                datosVenta.persona,

            metodoPago:
                datosVenta.metodoPago,

            subtotal:
                datosVenta.subtotal,

            iva:
                datosVenta.iva,

            total:
                datosVenta.total,

            items:
                datosVenta.items

        };


        /*
        Agregamos la nueva venta.
        */

        historialGuardado.push(
            nuevaVenta
        );


        /*
        Guardamos nuevamente el array completo.
        */

        localStorage.setItem(

            "papelYLunaHistorial",

            JSON.stringify(
                historialGuardado
            )

        );


        /*
        Guardamos también la última factura,
        útil para impresión.
        */

        localStorage.setItem(

            "papelYLunaUltimaFactura",

            JSON.stringify(
                nuevaVenta
            )

        );


        /*
        Dejamos la interfaz preparada para
        una nueva venta.
        */

        if (trabajador) {
            trabajador.value = "";
        }


        if (metodoPago) {
            metodoPago.value =
                "efectivo";
        }


        if (inputDineroCliente) {
            inputDineroCliente.value =
                "";
        }


        if (resultadoCambio) {
            resultadoCambio.textContent =
                formatoMoneda.format(0);
        }

};


/*
=========================================================
BOTÓN INICIAR FACTURA
=========================================================

Limpia la factura actual y prepara una venta nueva.
*/

if (botonIniciarFactura) {

    botonIniciarFactura.addEventListener(

        "click",

        () => {


            /*
            Si existe una factura actual preguntamos
            antes de borrarla.
            */

            if (
                estado.facturaActual.length > 0
            ) {

                const confirmar =
                    confirm(
                        "Hay productos en la factura actual. ¿Deseas iniciar una nueva factura?"
                    );


                if (!confirmar) {

                    return;

                }

            }


            /*
            Limpiamos el estado.
            */

            estado.facturaActual = [];


            /*
            Limpiamos los campos.
            */

            trabajador.value =
                "";

            metodoPago.value =
                "efectivo";

            inputDineroCliente.value =
                "";


            resultadoCambio.textContent =
                formatoMoneda.format(0);


            /*
            Volvemos a pintar la factura.
            */

            renderFactura();


            mostrarToast(

                "Nueva factura iniciada.",

                "success"

            );


            /*
            Lleva al usuario a la zona
            de la factura.
            */

            document
                .querySelector(".invoice")
                ?.scrollIntoView({

                    behavior:
                        "smooth",

                    block:
                        "start"

                });

        }

    );

}


/*
=========================================================
BOTÓN CANCELAR FACTURA
=========================================================
*/

if (botonCancelarFactura) {

    botonCancelarFactura.addEventListener(

        "click",

        () => {


            /*
            Si está vacía no hay nada que cancelar.
            */

            if (
                estado.facturaActual.length === 0
            ) {

                mostrarToast(

                    "No hay una factura activa para cancelar.",

                    "error"

                );

                return;

            }


            /*
            Pedimos confirmación.
            */

            const confirmar =
                confirm(
                    "¿Seguro que deseas cancelar esta factura?"
                );


            if (!confirmar) {

                return;

            }


            /*
            Limpiamos la factura.
            */

            estado.facturaActual = [];


            trabajador.value =
                "";

            metodoPago.value =
                "efectivo";

            inputDineroCliente.value =
                "";

            resultadoCambio.textContent =
                formatoMoneda.format(0);


            /*
            Refrescamos la interfaz.
            */

            renderFactura();


            mostrarToast(

                "Factura cancelada.",

                "success"

            );

        }

    );

}


/*
=========================================================
CALCULAR CAMBIO
=========================================================

Se calcula automáticamente mientras el trabajador
escribe el dinero recibido.
*/

if (inputDineroCliente) {

    inputDineroCliente.addEventListener(

        "input",

        () => {


            /*
            Obtenemos el total actual.
            */

            const {
                total
            } = calcularTotales();


            const dineroRecibido =
                Number(
                    inputDineroCliente.value
                );


            /*
            Si no hay un número válido.
            */

            if (

                !Number.isFinite(
                    dineroRecibido
                )

                ||

                dineroRecibido <= 0

            ) {

                resultadoCambio.textContent =
                    formatoMoneda.format(0);

                return;

            }


            /*
            Calculamos:
            dinero entregado - total factura
            */

            const cambio =
                dineroRecibido - total;


            /*
            Si falta dinero.
            */

            if (cambio < 0) {

                resultadoCambio.style.color =
                    "#c54868";


                resultadoCambio.textContent =
                    `Faltan ${formatoMoneda.format(
                        Math.abs(cambio)
                    )}`;

                return;

            }


            /*
            Si alcanza el dinero.
            */

            resultadoCambio.style.color =
                "#317c63";


            resultadoCambio.textContent =
                formatoMoneda.format(
                    cambio
                );

        }

    );

}


/*
=========================================================
BOTÓN IMPRIMIR FACTURA
=========================================================

Imprime únicamente la información relevante
de la factura y no toda la aplicación.
*/

if (botonImprimirFactura) {

    botonImprimirFactura.addEventListener(

        "click",

        () => {


            /*
            No permitimos imprimir factura vacía.
            */

            if (
                estado.facturaActual.length === 0
            ) {

                mostrarToast(

                    "No hay productos para imprimir.",

                    "error"

                );

                return;

            }


            /*
            Obtenemos los totales.
            */

            const {

                subtotalGeneral,

                iva,

                total

            } = calcularTotales();


            /*
            Convertimos los productos de la factura
            en información completa.
            */

            const productosFactura =
                estado.facturaActual.map(

                    (item) => {


                        const producto =
                            estado
                                .productosDisponibles
                                .find(

                                    (producto) =>
                                        producto.id
                                        ===
                                        item.id

                                );


                        return {

                            nombre:
                                producto.nombre,

                            precio:
                                producto.precio,

                            cantidad:
                                item.cantidad,

                            subtotal:
                                producto.precio
                                *
                                item.cantidad

                        };

                    }

                );


            /*
            Creamos las filas de impresión.
            */

            const filas =
                productosFactura.map(

                    (producto) => `

                        <tr>

                            <td>
                                ${producto.nombre}
                            </td>

                            <td>
                                ${producto.cantidad}
                            </td>

                            <td>
                                ${
                                    formatoMoneda.format(
                                        producto.precio
                                    )
                                }
                            </td>

                            <td>
                                ${
                                    formatoMoneda.format(
                                        producto.subtotal
                                    )
                                }
                            </td>

                        </tr>

                    `

                ).join("");


            /*
            Creamos una ventana independiente
            solamente para impresión.
            */

            const ventanaImpresion =
                window.open(
                    "",
                    "_blank",
                    "width=900,height=700"
                );


            /*
            Si el navegador bloquea popups.
            */

            if (!ventanaImpresion) {

                mostrarToast(

                    "El navegador bloqueó la ventana de impresión.",

                    "error"

                );

                return;

            }


            ventanaImpresion.document.write(`

                <!DOCTYPE html>

                <html lang="es">

                <head>

                    <meta charset="UTF-8">

                    <title>
                        Factura Papel y Luna
                    </title>


                    <style>

                        * {
                            box-sizing: border-box;
                        }

                        body {

                            font-family:
                                Arial,
                                sans-serif;

                            padding:
                                35px;

                            color:
                                #292536;

                        }


                        .encabezado {

                            text-align:
                                center;

                            margin-bottom:
                                30px;

                        }


                        h1 {

                            color:
                                #6544c5;

                            margin-bottom:
                                5px;

                        }


                        .datos {

                            margin-bottom:
                                25px;

                            line-height:
                                1.7;

                        }


                        table {

                            width:
                                100%;

                            border-collapse:
                                collapse;

                            margin-top:
                                20px;

                        }


                        th,
                        td {

                            border-bottom:
                                1px solid #ddd6eb;

                            padding:
                                12px;

                            text-align:
                                left;

                        }


                        th {

                            background:
                                #f3efff;

                            color:
                                #5135a7;

                        }


                        .totales {

                            width:
                                350px;

                            margin-left:
                                auto;

                            margin-top:
                                30px;

                        }


                        .linea-total {

                            display:
                                flex;

                            justify-content:
                                space-between;

                            padding:
                                7px 0;

                        }


                        .total-final {

                            margin-top:
                                8px;

                            padding-top:
                                12px;

                            border-top:
                                2px solid #6544c5;

                            font-size:
                                18px;

                            font-weight:
                                bold;

                        }


                        .gracias {

                            text-align:
                                center;

                            margin-top:
                                45px;

                            color:
                                #706a7b;

                        }

                    </style>

                </head>


                <body>


                    <div class="encabezado">

                        <h1>
                            Papel y Luna
                        </h1>

                        <p>
                            Generador de facturas
                        </p>

                    </div>


                    <div class="datos">

                        <strong>
                            Trabajador:
                        </strong>

                        ${
                            trabajador.value.trim()
                            ||
                            "No especificado"
                        }

                        <br>


                        <strong>
                            Método de pago:
                        </strong>

                        ${
                            metodoPago
                                .options[
                                    metodoPago.selectedIndex
                                ]
                                .text
                        }

                        <br>


                        <strong>
                            Fecha:
                        </strong>

                        ${
                            new Date()
                                .toLocaleDateString(
                                    "es-CO"
                                )
                        }

                    </div>


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


                        <div class="linea-total">

                            <span>
                                Subtotal
                            </span>

                            <strong>
                                ${
                                    formatoMoneda.format(
                                        subtotalGeneral
                                    )
                                }
                            </strong>

                        </div>


                        <div class="linea-total">

                            <span>
                                IVA 19%
                            </span>

                            <strong>
                                ${
                                    formatoMoneda.format(
                                        iva
                                    )
                                }
                            </strong>

                        </div>


                        <div
                            class="
                                linea-total
                                total-final
                            "
                        >

                            <span>
                                TOTAL
                            </span>

                            <span>
                                ${
                                    formatoMoneda.format(
                                        total
                                    )
                                }
                            </span>

                        </div>

                    </div>


                    <p class="gracias">

                        Gracias por comprar
                        en Papel y Luna.

                    </p>


                </body>

                </html>

            `);


            ventanaImpresion.document.close();


            /*
            Esperamos a que el contenido cargue
            y mostramos la ventana de impresión.
            */

            ventanaImpresion.onload =
                () => {

                    ventanaImpresion.focus();

                    ventanaImpresion.print();

                };

        }

    );

}