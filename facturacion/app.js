/*
=========================================================
ESTADO DE LA APLICACIÓN
=========================================================
El estado representa la información actual de la
aplicación.
Nunca utilizamos el HTML como fuente de información.
Primero modificamos el estado y después volvemos
a renderizar.
*/
const estado = {
    productosDisponibles:
        [...productos],
    facturaActual:
        [],
    terminoBusqueda:
        ""
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
const trabajador =
    document.querySelector(
        "#trabajador"
    );
const metodoPago =
    document.querySelector(
        "#mtdpago"
    );

/*
=========================================================
FORMATO DE MONEDA
=========================================================
Permite transformar:
12900
en algo similar a:
$ 12.900
*/

const formatoMoneda =
    new Intl.NumberFormat(
        "es-CO",
        {
            style:
                "currency",
            currency:
                "COP",
            maximumFractionDigits:
                0
        }
    );

/*
=========================================================
VALIDAR CANTIDAD
=========================================================
Solo permite números enteros mayores o iguales a 1.
*/

const validarCantidad = (valor) => {
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
filter() crea un nuevo array solamente con los
productos cuyo nombre coincide con el texto escrito.
*/

const obtenerProductosFiltrados = () => {
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
                    .includes(termino)
        );
};

/*
=========================================================
RENDERIZAR PRODUCTOS
=========================================================
Esta función genera todas las tarjetas utilizando:
createElement()
appendChild()
innerHTML
Los productos NO existen manualmente en index.html.
*/

const renderProductos = () => {
    const lista =
        obtenerProductosFiltrados();
    catalogoProductos.innerHTML =
        "";
    contadorProductos.textContent =
        lista.length;
    /*
    Si la búsqueda no tiene resultados.
    */
    if (lista.length === 0) {
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
    Recorremos los productos.
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
                            <div
                                class="cantidad-control"
                            >
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
                            class="
                                btn-agregar
                            "
                            data-id="${id}"
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
    Después de crear las tarjetas obtenemos
    todos los botones mediante querySelectorAll().
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
    if (cantidad === null) {
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
    /*
    Regresamos la cantidad a 1 después
    de agregar.
    */
    inputCantidad.value =
        1;

};

/*
=========================================================
AGREGAR PRODUCTO
=========================================================
Si el producto ya existe:
NO crea una nueva fila.
Simplemente incrementa la cantidad.
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
    El estado cambió.
    Ahora actualizamos la interfaz.
    */
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
    if (nuevaCantidad === null) {
        mostrarToast(
            "La cantidad mínima es 1.",
            "error"
        );
        /*
        Se vuelve a renderizar para recuperar
        el último valor válido.
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
    /*
    El estado cambió.
    */
    renderFactura();
};
/*
=========================================================
CALCULAR TOTALES
=========================================================
reduce() recorre todos los productos de la factura.
Subtotal general:
suma de precio × cantidad.
IVA:
subtotal × 19%.
Total:
subtotal + IVA.
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
    } = calcularTotales();
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
    ESTADO VACÍO
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
    map() genera una versión más completa
    de cada producto de la factura.
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
                        cantidad: item.cantidad,
                        subtotal: producto.precio * item.cantidad
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
                <div
                    class="nombre-producto"
                >
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
                    class="
                        cantidad-factura
                    "
                    min="1"
                    step="1"
                    value="${cantidad}"
                    data-id="${id}"
                >
                <span
                    class="
                        subtotal-producto
                    "
                >
                    ${
                        formatoMoneda
                            .format(
                                subtotal
                            )
                    }
                </span>
                <button
                    class="
                        btn-eliminar
                    "
                    data-id="${id}"
                    title="
                        Eliminar producto
                    "
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
    EVENTOS DE CAMBIO DE CANTIDAD
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
FUNCIÓN BUSCADOR
=========================================================
*/
const buscarProductos = (
    texto
) => {
    /*
    Primero actualizamos el estado.
    */
    estado.terminoBusqueda =
        texto;
    /*
    Después actualizamos el DOM.
    */
    renderProductos();
};
/*
=========================================================
EVENTO DEL BUSCADOR
=========================================================
*/
buscador.addEventListener(
    "input",
    (evento) => {
        buscarProductos(
            evento.target.value
        );
    }
);

/* Guarda una venta terminada antes de vaciar la factura actual. */
botonGenerarFactura.addEventListener(
    "click",
    () => {
        if (estado.facturaActual.length === 0) {
            mostrarToast(
                "Agrega al menos un producto antes de generar la factura.",
                "error"
            );
            return;
        }

        const {
            subtotalGeneral,
            iva,
            total
        } = calcularTotales();
        const items = estado.facturaActual.reduce(
            (acumulador, item) => acumulador + item.cantidad,
            0
        );

        window.registrarVentaEnHistorial({
            persona: trabajador.value.trim() || "Cliente general",
            metodoPago: metodoPago.options[metodoPago.selectedIndex].text,
            subtotal: subtotalGeneral,
            iva,
            total,
            items
        });

        estado.facturaActual = [];
        renderFactura();
        mostrarToast("Factura generada y venta guardada en el historial.");
    }
);
/*
=========================================================
RENDER INICIAL
=========================================================
*/
renderProductos();
renderFactura();
