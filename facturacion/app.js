/*
=========================================================
ESTADO DE LA APLICACIÓN
=========================================================
*/

const estado = {

    productosDisponibles: [
        ...productos
    ],

    facturaActual: [],

    terminoBusqueda: "",

    ultimaVenta: null
};


/*
=========================================================
ELEMENTOS DEL DOM
=========================================================
*/

const catalogoProductos =
    document.querySelector(
        "#catalogoProductos"
    );

const facturaItems =
    document.querySelector(
        "#facturaItems"
    );

const totalesFactura =
    document.querySelector(
        "#totalesFactura"
    );

const buscador =
    document.querySelector(
        "#buscador"
    );

const contadorProductos =
    document.querySelector(
        "#contadorProductos"
    );

const contadorFactura =
    document.querySelector(
        "#contadorFactura"
    );

const toast =
    document.querySelector(
        "#toast"
    );

const botonGenerarFactura =
    document.querySelector(
        "#btnGenerarFactura"
    );

const botonCancelarFactura =
    document.querySelector(
        "#btncancelarFactura"
    );

const botonImprimirFactura =
    document.querySelector(
        "#btnimprimirFactura"
    );

const botonIniciarFactura =
    document.querySelector(
        "#inifactura"
    );

const botonHistorial =
    document.querySelector(
        "#historial"
    );

const trabajador =
    document.querySelector(
        "#trabajador"
    );

const metodoPago =
    document.querySelector(
        "#mtdpago"
    );

const dineroRecibido =
    document.querySelector(
        "#cambio"
    );

const seccionCambio =
    document.querySelector(
        "#seccionCambio"
    );

const resultadoCambio =
    document.querySelector(
        "#resultadoCambio"
    );

const ventaConfirmada =
    document.querySelector(
        "#ventaConfirmada"
    );


/*
=========================================================
FORMATO DE MONEDA
=========================================================
*/

const formatoMoneda =
    new Intl.NumberFormat(
        "es-CO",
        {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }
    );


/*
=========================================================
VALIDAR CANTIDAD
=========================================================
*/

const validarCantidad = (
    valor
) => {

    const cantidad =
        Number(valor);

    if (
        !Number.isInteger(cantidad)
        ||
        cantidad < 1
    ) {

        return null;

    }

    return cantidad;
};


/*
=========================================================
NOTIFICACIONES
=========================================================
*/

let temporizadorToast;

const mostrarToast = (
    mensaje,
    tipo = "success"
) => {

    clearTimeout(
        temporizadorToast
    );

    toast.textContent =
        mensaje;

    toast.className =
        `toast visible ${tipo}`;

    temporizadorToast =
        setTimeout(
            () => {

                toast.className =
                    "toast";

            },
            2200
        );
};


/*
=========================================================
BUSCAR PRODUCTOS
=========================================================
*/

const obtenerProductosFiltrados =
    () => {

        const termino =
            estado
                .terminoBusqueda
                .trim()
                .toLowerCase();

        if (!termino) {

            return estado
                .productosDisponibles;

        }

        return estado
            .productosDisponibles
            .filter(
                (producto) =>
                    producto
                        .nombre
                        .toLowerCase()
                        .includes(
                            termino
                        )
            );
    };


/*
=========================================================
RENDERIZAR PRODUCTOS
=========================================================
*/

const renderProductos = () => {

    const lista =
        obtenerProductosFiltrados();

    catalogoProductos.innerHTML =
        "";

    contadorProductos.textContent =
        lista.length;


    /*
    SIN RESULTADOS
    */

    if (
        lista.length === 0
    ) {

        const mensaje =
            document.createElement(
                "div"
            );

        mensaje.className =
            "no-results";

        mensaje.innerHTML = `
            <span>
                🔎
            </span>

            <h3>
                No encontramos productos
            </h3>

            <p>
                Intenta buscar utilizando
                otro nombre.
            </p>
        `;

        catalogoProductos
            .appendChild(
                mensaje
            );

        return;
    }


    /*
    CREAR TARJETAS
    */

    lista.forEach(
        (
            {
                id,
                nombre,
                categoria,
                precio,
                imagen,
                descripcion
            }
        ) => {

            const tarjeta =
                document.createElement(
                    "article"
                );

            tarjeta.className =
                "product-card";

            tarjeta.innerHTML = `

                <div class="product-image">

                    <img
                        src="${imagen}"
                        alt="${nombre}"
                    >

                    <span class="categoria">
                        ${categoria}
                    </span>

                </div>


                <div class="product-body">

                    <h3>
                        ${nombre}
                    </h3>

                    <p class="descripcion">
                        ${descripcion}
                    </p>


                    <div class="product-bottom">

                        <div>

                            <span class="precio">

                                ${
                                    formatoMoneda
                                        .format(
                                            precio
                                        )
                                }

                            </span>


                            <div class="cantidad-control">

                                <label
                                    for="cantidad-${id}"
                                >
                                    Cantidad
                                </label>

                                <input
                                    id="cantidad-${id}"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value="1"
                                >

                            </div>

                        </div>


                        <button
                            class="btn-agregar"
                            data-id="${id}"
                            type="button"
                        >
                            + Agregar
                        </button>

                    </div>

                </div>
            `;

            catalogoProductos
                .appendChild(
                    tarjeta
                );
        }
    );


    /*
    EVENTOS BOTONES AGREGAR
    */

    const botonesAgregar =
        document.querySelectorAll(
            ".btn-agregar"
        );

    botonesAgregar.forEach(
        (boton) => {

            boton.addEventListener(
                "click",
                manejarAgregarProducto
            );

        }
    );
};


/*
=========================================================
MANEJAR BOTÓN AGREGAR
=========================================================
*/

const manejarAgregarProducto = (
    evento
) => {

    const idProducto =
        Number(
            evento
                .currentTarget
                .dataset
                .id
        );

    const inputCantidad =
        document.querySelector(
            `#cantidad-${idProducto}`
        );

    const cantidad =
        validarCantidad(
            inputCantidad.value
        );


    if (
        cantidad === null
    ) {

        inputCantidad.value =
            1;

        mostrarToast(
            "La cantidad debe ser mayor o igual a 1.",
            "error"
        );

        return;
    }


    agregarProducto(
        idProducto,
        cantidad
    );


    inputCantidad.value =
        1;
};


/*
=========================================================
AGREGAR PRODUCTO
=========================================================
*/

const agregarProducto = (
    idProducto,
    cantidad
) => {

    const producto =
        estado
            .productosDisponibles
            .find(
                (producto) =>
                    producto.id
                    ===
                    idProducto
            );


    if (!producto) {

        return;

    }


    const productoEnFactura =
        estado
            .facturaActual
            .find(
                (item) =>
                    item.id
                    ===
                    idProducto
            );


    if (productoEnFactura) {

        productoEnFactura.cantidad +=
            cantidad;

    } else {

        estado
            .facturaActual
            .push(
                {
                    id:
                        idProducto,

                    cantidad:
                        cantidad
                }
            );
    }


    /*
    Si agregamos algo nuevo,
    la confirmación anterior deja
    de representar la factura actual.
    */

    estado.ultimaVenta =
        null;

    mostrarVentaPendiente();


    renderFactura();


    mostrarToast(
        `${producto.nombre} agregado.`,
        "success"
    );
};


/*
=========================================================
ELIMINAR PRODUCTO
=========================================================
*/

const eliminarProducto = (
    idProducto
) => {

    estado.facturaActual =
        estado
            .facturaActual
            .filter(
                (item) =>
                    item.id
                    !==
                    idProducto
            );


    estado.ultimaVenta =
        null;

    mostrarVentaPendiente();

    renderFactura();


    mostrarToast(
        "Producto eliminado.",
        "success"
    );
};


/*
=========================================================
ACTUALIZAR CANTIDAD
=========================================================
*/

const actualizarCantidad = (
    idProducto,
    nuevoValor
) => {

    const nuevaCantidad =
        validarCantidad(
            nuevoValor
        );


    if (
        nuevaCantidad === null
    ) {

        mostrarToast(
            "La cantidad mínima es 1.",
            "error"
        );

        /*
        Recuperamos el último
        valor válido.
        */

        renderFactura();

        return;
    }


    const producto =
        estado
            .facturaActual
            .find(
                (item) =>
                    item.id
                    ===
                    idProducto
            );


    if (!producto) {

        return;

    }


    producto.cantidad =
        nuevaCantidad;


    estado.ultimaVenta =
        null;

    mostrarVentaPendiente();

    renderFactura();
};


/*
=========================================================
CALCULAR TOTALES
=========================================================
*/

const calcularTotales = () => {

    const subtotalGeneral =
        estado
            .facturaActual
            .reduce(
                (
                    acumulador,
                    item
                ) => {

                    const producto =
                        estado
                            .productosDisponibles
                            .find(
                                (producto) =>
                                    producto.id
                                    ===
                                    item.id
                            );


                    if (!producto) {

                        return acumulador;

                    }


                    const subtotalProducto =
                        producto.precio
                        *
                        item.cantidad;


                    return (
                        acumulador
                        +
                        subtotalProducto
                    );

                },

                /*
                IMPORTANTE:
                reduce comienza en cero.
                */

                0
            );


    const iva =
        subtotalGeneral
        *
        0.19;


    const total =
        subtotalGeneral
        +
        iva;


    return {
        subtotalGeneral,
        iva,
        total
    };
};


/*
=========================================================
RENDERIZAR TOTALES
=========================================================
*/

const renderTotales = () => {

    const {
        subtotalGeneral,
        iva,
        total
    } =
        calcularTotales();


    totalesFactura.innerHTML = `

        <div class="total-linea">

            <span>
                Subtotal
            </span>

            <strong>
                ${
                    formatoMoneda
                        .format(
                            subtotalGeneral
                        )
                }
            </strong>

        </div>


        <div class="total-linea">

            <span>
                IVA (19%)
            </span>

            <strong>
                ${
                    formatoMoneda
                        .format(
                            iva
                        )
                }
            </strong>

        </div>


        <div
            class="
                total-linea
                total-final
            "
        >

            <span>
                TOTAL
            </span>

            <strong>
                ${
                    formatoMoneda
                        .format(
                            total
                        )
                }
            </strong>

        </div>
    `;


    calcularCambio();
};


/*
=========================================================
RENDERIZAR FACTURA
=========================================================
*/

const renderFactura = () => {

    facturaItems.innerHTML =
        "";


    contadorFactura.textContent =
        estado
            .facturaActual
            .length;


    /*
    FACTURA VACÍA
    */

    if (
        estado
            .facturaActual
            .length
        ===
        0
    ) {

        const emptyState =
            document.createElement(
                "div"
            );

        emptyState.className =
            "empty-state";

        emptyState.innerHTML = `

            <div>

                <div class="empty-icon">
                    🧾
                </div>

                <h3>
                    No hay productos
                    en la factura
                </h3>

                <p>
                    Selecciona un producto
                    del catálogo para comenzar.
                </p>

            </div>
        `;


        facturaItems
            .appendChild(
                emptyState
            );


        renderTotales();

        return;
    }


    /*
    CREAR DETALLE
    */

    const detalleFactura =
        estado
            .facturaActual
            .map(
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

                        ...producto,

                        cantidad:
                            item.cantidad,

                        subtotal:
                            producto.precio
                            *
                            item.cantidad
                    };
                }
            );


    detalleFactura.forEach(
        (
            {
                id,
                nombre,
                precio,
                cantidad,
                subtotal
            }
        ) => {

            const fila =
                document.createElement(
                    "div"
                );

            fila.className =
                "factura-fila";


            fila.innerHTML = `

                <div class="nombre-producto">

                    <strong>
                        ${nombre}
                    </strong>

                    <small>
                        ${
                            formatoMoneda
                                .format(
                                    precio
                                )
                        }
                        c/u
                    </small>

                </div>


                <input
                    type="number"
                    class="cantidad-factura"
                    min="1"
                    step="1"
                    value="${cantidad}"
                    data-id="${id}"
                >


                <span class="subtotal-producto">

                    ${
                        formatoMoneda
                            .format(
                                subtotal
                            )
                    }

                </span>


                <button
                    class="btn-eliminar"
                    data-id="${id}"
                    title="Eliminar producto"
                    type="button"
                >
                    ×
                </button>
            `;


            facturaItems
                .appendChild(
                    fila
                );
        }
    );


    /*
    EVENTOS CAMBIO DE CANTIDAD
    */

    const inputsCantidad =
        document.querySelectorAll(
            ".cantidad-factura"
        );


    inputsCantidad.forEach(
        (input) => {

            input.addEventListener(
                "change",
                (evento) => {

                    const idProducto =
                        Number(
                            evento
                                .currentTarget
                                .dataset
                                .id
                        );


                    actualizarCantidad(
                        idProducto,
                        evento
                            .currentTarget
                            .value
                    );
                }
            );

        }
    );


    /*
    EVENTOS ELIMINAR
    */

    const botonesEliminar =
        document.querySelectorAll(
            ".btn-eliminar"
        );


    botonesEliminar.forEach(
        (boton) => {

            boton.addEventListener(
                "click",
                (evento) => {

                    const idProducto =
                        Number(
                            evento
                                .currentTarget
                                .dataset
                                .id
                        );


                    eliminarProducto(
                        idProducto
                    );

                }
            );

        }
    );


    renderTotales();
};


/*
=========================================================
BUSCAR PRODUCTOS
=========================================================
*/

const buscarProductos = (
    texto
) => {

    estado.terminoBusqueda =
        texto;

    renderProductos();
};


/*
=========================================================
DETALLE COMPLETO DE PRODUCTOS
=========================================================
Se utiliza al cerrar la venta para que
el historial conserve exactamente lo vendido.
=========================================================
*/

const obtenerDetalleFactura = () => {

    return estado
        .facturaActual
        .map(
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

                    id:
                        producto.id,

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
};


/*
=========================================================
MOSTRAR / OCULTAR EFECTIVO
=========================================================
*/

const actualizarMetodoPago = () => {

    const esEfectivo =
        metodoPago.value
        ===
        "efectivo";


    if (esEfectivo) {

        seccionCambio.classList
            .remove(
                "oculto"
            );

    } else {

        seccionCambio.classList
            .add(
                "oculto"
            );

        dineroRecibido.value =
            "";

        resultadoCambio.innerHTML = `
            No se requiere cálculo
            de cambio para este método.
        `;
    }
};


/*
=========================================================
CALCULAR CAMBIO
=========================================================
*/

const calcularCambio = () => {

    if (
        metodoPago.value
        !==
        "efectivo"
    ) {

        return;

    }


    const {
        total
    } =
        calcularTotales();


    const recibido =
        Number(
            dineroRecibido.value
        );


    /*
    Sin dinero ingresado.
    */

    if (
        dineroRecibido.value === ""
    ) {

        resultadoCambio.className =
            "resultado-cambio";

        resultadoCambio.innerHTML = `
            El cambio que se le debe dar
            al cliente es:
            <strong>
                ${formatoMoneda.format(0)}
            </strong>
        `;

        return;
    }


    /*
    Valor inválido.
    */

    if (
        !Number.isFinite(recibido)
        ||
        recibido < 0
    ) {

        resultadoCambio.className =
            "resultado-cambio resultado-error";

        resultadoCambio.innerHTML = `
            Introduzca un valor válido.
        `;

        return;
    }


    const diferencia =
        recibido
        -
        total;


    /*
    DINERO INSUFICIENTE
    */

    if (
        diferencia < 0
    ) {

        resultadoCambio.className =
            "resultado-cambio resultado-error";

        resultadoCambio.innerHTML = `
            Faltan:
            <strong>
                ${
                    formatoMoneda
                        .format(
                            Math.abs(
                                diferencia
                            )
                        )
                }
            </strong>
        `;

        return;
    }


    /*
    CAMBIO CORRECTO
    */

    resultadoCambio.className =
        "resultado-cambio resultado-correcto";

    resultadoCambio.innerHTML = `
        El cambio que se le debe dar
        al cliente es:
        <strong>
            ${
                formatoMoneda
                    .format(
                        diferencia
                    )
            }
        </strong>
    `;
};


/*
=========================================================
LIMPIAR FORMULARIO
=========================================================
*/

const limpiarFormularioFactura =
    () => {

        trabajador.value =
            "";

        metodoPago.value =
            "efectivo";

        dineroRecibido.value =
            "";

        actualizarMetodoPago();

        calcularCambio();
    };


/*
=========================================================
VENTA PENDIENTE
=========================================================
*/

const mostrarVentaPendiente =
    () => {

        ventaConfirmada.className =
            "venta-confirmada";

        ventaConfirmada.innerHTML = `
            <p>
                Venta pendiente
            </p>
        `;
    };


/*
=========================================================
INICIAR NUEVA FACTURA
=========================================================
*/

const iniciarFactura = () => {

    if (
        estado.facturaActual.length
        >
        0
    ) {

        const confirmar =
            window.confirm(
                "Hay una factura en curso. ¿Deseas iniciar una nueva?"
            );


        if (!confirmar) {

            return;

        }
    }


    estado.facturaActual =
        [];

    estado.ultimaVenta =
        null;

    estado.terminoBusqueda =
        "";


    buscador.value =
        "";


    limpiarFormularioFactura();

    mostrarVentaPendiente();

    renderProductos();

    renderFactura();


    mostrarToast(
        "Nueva factura iniciada.",
        "success"
    );
};


/*
=========================================================
CANCELAR FACTURA
=========================================================
*/

const cancelarFactura = () => {

    if (
        estado.facturaActual.length
        ===
        0
    ) {

        mostrarToast(
            "No hay una factura para cancelar.",
            "error"
        );

        return;
    }


    const confirmar =
        window.confirm(
            "¿Seguro que deseas cancelar la factura actual?"
        );


    if (!confirmar) {

        return;

    }


    estado.facturaActual =
        [];

    estado.ultimaVenta =
        null;


    limpiarFormularioFactura();

    mostrarVentaPendiente();

    renderFactura();


    mostrarToast(
        "Factura cancelada.",
        "success"
    );
};


/*
=========================================================
VALIDAR VENTA
=========================================================
*/

const validarVenta = () => {

    /*
    1. FACTURA
    */

    if (
        estado.facturaActual.length
        ===
        0
    ) {

        mostrarToast(
            "Agrega al menos un producto antes de generar la factura.",
            "error"
        );

        return false;
    }


    /*
    2. TRABAJADOR
    */

    if (
        !trabajador
            .value
            .trim()
    ) {

        mostrarToast(
            "Ingresa el nombre del trabajador.",
            "error"
        );

        trabajador.focus();

        return false;
    }


    /*
    3. MÉTODO DE PAGO
    */

    if (
        !metodoPago.value
    ) {

        mostrarToast(
            "Selecciona un método de pago.",
            "error"
        );

        return false;
    }


    /*
    4. EFECTIVO
    */

    if (
        metodoPago.value
        ===
        "efectivo"
    ) {

        const {
            total
        } =
            calcularTotales();


        const recibido =
            Number(
                dineroRecibido.value
            );


        if (
            dineroRecibido.value === ""
        ) {

            mostrarToast(
                "Ingresa el dinero recibido.",
                "error"
            );

            dineroRecibido.focus();

            return false;
        }


        if (
            !Number.isFinite(
                recibido
            )
            ||
            recibido < total
        ) {

            mostrarToast(
                "El dinero recibido es insuficiente.",
                "error"
            );

            dineroRecibido.focus();

            return false;
        }
    }


    return true;
};


/*
=========================================================
GENERAR FACTURA
=========================================================
*/

const generarFactura = () => {

    if (
        !validarVenta()
    ) {

        return;

    }


    const {
        subtotalGeneral,
        iva,
        total
    } =
        calcularTotales();


    const detalleProductos =
        obtenerDetalleFactura();


    const items =
        estado
            .facturaActual
            .reduce(
                (
                    acumulador,
                    item
                ) =>
                    acumulador
                    +
                    item.cantidad,

                0
            );


    const textoMetodoPago =
        metodoPago
            .options[
                metodoPago.selectedIndex
            ]
            .text;


    let valorRecibido =
        null;

    let valorCambio =
        null;


    if (
        metodoPago.value
        ===
        "efectivo"
    ) {

        valorRecibido =
            Number(
                dineroRecibido.value
            );

        valorCambio =
            valorRecibido
            -
            total;
    }


    /*
    REGISTRAR EN HISTORIAL
    */

    const nuevaVenta =
        window
            .registrarVentaEnHistorial(
                {

                    persona:
                        trabajador
                            .value
                            .trim(),

                    metodoPago:
                        textoMetodoPago,

                    subtotal:
                        subtotalGeneral,

                    iva:
                        iva,

                    total:
                        total,

                    items:
                        items,

                    productos:
                        detalleProductos,

                    dineroRecibido:
                        valorRecibido,

                    cambio:
                        valorCambio
                }
            );


    /*
    Guardamos la última venta para
    poder imprimirla.
    */

    estado.ultimaVenta =
        nuevaVenta;


    /*
    MOSTRAR CONFIRMACIÓN
    */

    ventaConfirmada.className =
        "venta-confirmada confirmada";


    ventaConfirmada.innerHTML = `

        <div>

            <strong>
                ✓ Venta confirmada
            </strong>

            <span>
                Factura #${nuevaVenta.id}
            </span>

            <span>
                Trabajador:
                ${nuevaVenta.persona}
            </span>

            <span>
                Método:
                ${nuevaVenta.metodoPago}
            </span>

            <span>
                Total:
                ${
                    formatoMoneda
                        .format(
                            nuevaVenta.total
                        )
                }
            </span>

        </div>
    `;


    /*
    La venta ya quedó almacenada.
    Ahora vaciamos la factura abierta,
    pero conservamos ultimaVenta.
    */

    estado.facturaActual =
        [];


    renderFactura();


    mostrarToast(
        "Factura generada y venta guardada en el historial.",
        "success"
    );
};


/*
=========================================================
IMPRIMIR FACTURA
=========================================================
*/

const imprimirFactura = () => {

    const venta =
        estado.ultimaVenta;


    if (!venta) {

        mostrarToast(
            "Primero genera una factura para imprimir.",
            "error"
        );

        return;
    }


    const filasProductos =
        venta.productos
            .map(
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
                                formatoMoneda
                                    .format(
                                        producto.precio
                                    )
                            }
                        </td>

                        <td>
                            ${
                                formatoMoneda
                                    .format(
                                        producto.subtotal
                                    )
                            }
                        </td>

                    </tr>
                `
            )
            .join("");


    const datosEfectivo =
        venta.metodoPago
        ===
        "Efectivo"

            ? `

                <div class="linea">

                    <span>
                        Dinero recibido
                    </span>

                    <strong>
                        ${
                            formatoMoneda
                                .format(
                                    venta.dineroRecibido
                                )
                        }
                    </strong>

                </div>


                <div class="linea">

                    <span>
                        Cambio
                    </span>

                    <strong>
                        ${
                            formatoMoneda
                                .format(
                                    venta.cambio
                                )
                        }
                    </strong>

                </div>
            `

            :

            "";


    const ventanaImpresion =
        window.open(
            "",
            "_blank",
            "width=800,height=900"
        );


    if (!ventanaImpresion) {

        mostrarToast(
            "El navegador bloqueó la ventana de impresión.",
            "error"
        );

        return;
    }


    ventanaImpresion
        .document
        .write(`

        <!DOCTYPE html>

        <html lang="es">

        <head>

            <meta charset="UTF-8">

            <title>
                Factura ${venta.id}
            </title>

            <style>

                body {
                    font-family: Arial, sans-serif;
                    color: #2d2838;
                    margin: 35px;
                }

                h1 {
                    margin-bottom: 5px;
                    color: #5237b4;
                }

                .subtitulo {
                    color: #746f80;
                    margin-bottom: 25px;
                }

                .datos {
                    margin-bottom: 25px;
                }

                .datos p {
                    margin: 5px 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
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
                    width: 320px;
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

                .gracias {
                    margin-top: 35px;
                    text-align: center;
                    color: #746f80;
                }

                @media print {

                    body {
                        margin: 15px;
                    }

                }

            </style>

        </head>


        <body>

            <h1>
                PAPEL Y LUNA
            </h1>

            <p class="subtitulo">
                Factura de venta
            </p>


            <div class="datos">

                <p>
                    <strong>
                        Factura:
                    </strong>

                    #${venta.id}
                </p>


                <p>
                    <strong>
                        Fecha:
                    </strong>

                    ${venta.fecha}
                </p>


                <p>
                    <strong>
                        Hora:
                    </strong>

                    ${venta.hora}
                </p>


                <p>
                    <strong>
                        Trabajador:
                    </strong>

                    ${venta.persona}
                </p>


                <p>
                    <strong>
                        Método de pago:
                    </strong>

                    ${venta.metodoPago}
                </p>

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

                    ${filasProductos}

                </tbody>

            </table>


            <div class="totales">

                <div class="linea">

                    <span>
                        Subtotal
                    </span>

                    <strong>
                        ${
                            formatoMoneda
                                .format(
                                    venta.subtotal
                                )
                        }
                    </strong>

                </div>


                <div class="linea">

                    <span>
                        IVA 19%
                    </span>

                    <strong>
                        ${
                            formatoMoneda
                                .format(
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
                            formatoMoneda
                                .format(
                                    venta.total
                                )
                        }
                    </strong>

                </div>


                ${datosEfectivo}

            </div>


            <p class="gracias">
                Gracias por su compra.
            </p>

        </body>

        </html>
    `);


    ventanaImpresion
        .document
        .close();


    ventanaImpresion
        .focus();


    ventanaImpresion
        .print();
};


/*
=========================================================
EVENTOS
=========================================================
*/


/*
BUSCADOR
*/

buscador.addEventListener(
    "input",
    (evento) => {

        buscarProductos(
            evento.target.value
        );

    }
);


/*
MÉTODO DE PAGO
*/

metodoPago.addEventListener(
    "change",
    () => {

        actualizarMetodoPago();

        calcularCambio();

    }
);


/*
DINERO RECIBIDO
*/

dineroRecibido.addEventListener(
    "input",
    calcularCambio
);


/*
GENERAR
*/

botonGenerarFactura.addEventListener(
    "click",
    generarFactura
);


/*
CANCELAR
*/

botonCancelarFactura.addEventListener(
    "click",
    cancelarFactura
);


/*
INICIAR
*/

botonIniciarFactura.addEventListener(
    "click",
    iniciarFactura
);


/*
IMPRIMIR
*/

botonImprimirFactura.addEventListener(
    "click",
    imprimirFactura
);


/*
HISTORIAL
*/

botonHistorial.addEventListener(
    "click",
    () => {

        window.location.href =
            "Historial_de_ventas.html";

    }
);


/*
=========================================================
RENDER INICIAL
=========================================================
*/

actualizarMetodoPago();

mostrarVentaPendiente();

renderProductos();

renderFactura();