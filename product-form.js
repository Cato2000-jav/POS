// Formulario independiente: usa la API central y el estado del catálogo existente.
const productosEditor = { ocupado: false, id: null, nuevoId: null, categorias: [] };
const formProducto = document.querySelector("#formProducto");
const mensajeProducto = document.querySelector("#mensajeProducto");
const campoProducto = nombre => document.querySelector("#producto" + nombre);

function bloquearProducto(ocupado) {
    productosEditor.ocupado = ocupado;
    formProducto.setAttribute("aria-busy", String(ocupado));
    formProducto.querySelectorAll("input, select, button").forEach(control => {
        control.disabled = ocupado;
    });
    // No enviar existencias antiguas ni cambiar el seguimiento al editar.
    campoProducto("Stock").disabled = ocupado || productosEditor.id !== null;
    campoProducto("Seguimiento").disabled = ocupado || productosEditor.id !== null;
    catalogoProductos.inert = ocupado;
    panelFactura.inert = ocupado;
    botonIniciarFactura.disabled = ocupado;
    document.querySelector("#nuevoProducto").disabled = ocupado;
}

async function abrirProducto(id = null) {
    if (productosEditor.ocupado || productosCargando) return;
    if (!formProducto.hidden && !window.confirm("¿Descartar el formulario actual?")) return;
    const producto = id === null ? null : estado.productosDisponibles.find(p => p.id === id);
    if (id !== null && !producto) return;
    productosEditor.id = id;
    productosEditor.nuevoId = null;
    productosEditor.categorias = [];
    formProducto.hidden = false;
    formProducto.reset();
    document.querySelector("#tituloProducto").textContent = producto ? "Editar producto" : "Nuevo producto";
    for (const nombre of ["Nombre", "Codigo", "Precio", "Costo", "Stock"]) {
        const clave = nombre.toLowerCase();
        campoProducto(nombre).value = producto ? producto[clave] : (nombre === "Stock" ? "0" : "");
    }
    campoProducto("Seguimiento").checked = producto ? producto.seguimientoInventario : true;
    const selector = campoProducto("Categoria");
    selector.replaceChildren();
    mensajeProducto.textContent = "Cargando categorías…";
    bloquearProducto(true);
    try {
        const categorias = await api.listar("categorias");
        const ids = new Set();
        for (const categoria of categorias) {
            if (!categoria || !String(categoria.id ?? "").trim() ||
                typeof categoria.nombre !== "string" || !categoria.nombre.trim() ||
                ids.has(String(categoria.id))) throw new Error("Categorías inválidas o duplicadas.");
            ids.add(String(categoria.id));
        }
        productosEditor.categorias = categorias;
        const vacia = document.createElement("option");
        vacia.value = "";
        vacia.textContent = "Selecciona una categoría";
        selector.appendChild(vacia);
        categorias.forEach(categoria => {
            const opcion = document.createElement("option");
            opcion.value = String(categoria.id);
            opcion.textContent = categoria.nombre;
            selector.appendChild(opcion);
        });
        selector.value = producto ? producto.categoriaId : "";
        mensajeProducto.textContent = categorias.length ? "" : "Crea primero una categoría. Luego vuelve a abrir este formulario.";
    } catch (error) {
        mensajeProducto.textContent = "No se cargaron las categorías: " + error.message + ". Cierra y vuelve a abrir para reintentar.";
    } finally {
        bloquearProducto(false);
    }
}

async function guardarProductoFormulario(evento) {
    evento.preventDefault();
    if (productosEditor.ocupado || productosCargando) return;
    const editando = productosEditor.id !== null;
    const anterior = estado.productosDisponibles.find(p => p.id === productosEditor.id);
    let provisional = false;
    bloquearProducto(true);
    try {
        if (editando && !anterior) throw new Error("El producto ya no está en el catálogo.");
        if (!editando && !productosEditor.nuevoId) productosEditor.nuevoId = crypto.randomUUID();
        const datos = {
            id: editando ? productosEditor.id : productosEditor.nuevoId,
            nombre: campoProducto("Nombre").value.trim(),
            codigo: campoProducto("Codigo").value.trim(),
            categoriaId: campoProducto("Categoria").value,
            precio: campoProducto("Precio").value,
            costo: campoProducto("Costo").value
        };
        const candidato = normalizarProductos([{
            ...datos,
            stock: editando ? anterior.stock : campoProducto("Stock").value,
            seguimientoInventario: editando ? anterior.seguimientoInventario : campoProducto("Seguimiento").checked
        }], productosEditor.categorias)[0];
        datos.precio = candidato.precio;
        datos.costo = candidato.costo;
        if (!editando) {
            datos.stock = candidato.stock;
            datos.seguimientoInventario = candidato.seguimientoInventario;
        } else {
            estado.productosDisponibles = estado.productosDisponibles.map(p => p.id === datos.id ? candidato : p);
            provisional = true;
            renderProductos();
            if (estado.facturaActual.length) renderFactura();
        }
        mensajeProducto.textContent = "Guardando producto… Los cambios de edición son provisionales.";
        const respuesta = await api.guardar("productos", editando ? "actualizar" : "crear", datos);
        const guardado = normalizarProductos([respuesta], productosEditor.categorias)[0];
        if (Object.keys(datos).some(clave => guardado[clave] !== datos[clave])) {
            throw new Error("La respuesta no confirma los datos enviados. Revisa el catálogo antes de reintentar.");
        }
        estado.productosDisponibles = estado.productosDisponibles.filter(p => p.id !== guardado.id);
        estado.productosDisponibles.push(guardado);
        renderProductos();
        if (estado.facturaActual.length) renderFactura();
        formProducto.hidden = true;
        productosEditor.nuevoId = null;
        document.querySelector("#estadoProductos").textContent = "Producto guardado en Google Sheets.";
    } catch (error) {
        if (provisional) {
            estado.productosDisponibles = estado.productosDisponibles.map(p => p.id === anterior.id ? anterior : p);
            renderProductos();
            if (estado.facturaActual.length) renderFactura();
        }
        mensajeProducto.textContent = "No se confirmó el guardado: " + error.message + " Se conserva el formulario.";
    } finally {
        bloquearProducto(false);
    }
}

document.querySelector("#nuevoProducto").addEventListener("click", () => abrirProducto());
document.querySelector("#cancelarProducto").addEventListener("click", () => {
    if (!productosEditor.ocupado) formProducto.hidden = true;
});
formProducto.addEventListener("submit", guardarProductoFormulario);

// No confundir con eliminarProducto de app.js, que solo quita un artículo del carrito.
async function eliminarProductoCatalogo(id) {
    if (productosEditor.ocupado || productosCargando) return;
    const mensaje = document.querySelector("#estadoProductos");
    if (!formProducto.hidden) {
        mensaje.textContent = "Cierra el formulario antes de eliminar un producto.";
        return;
    }
    const producto = estado.productosDisponibles.find(p => p.id === id);
    if (!producto) return;
    if (estado.facturaActual.some(item => item.id === id)) {
        mensaje.textContent = "No puedes eliminar el producto: está en la venta actual.";
        return;
    }
    if (!window.confirm(`¿Eliminar del catálogo el producto «${producto.nombre}»?`)) return;
    bloquearProducto(true);
    // También impide que una recarga concurrente vuelva a incorporar el producto.
    document.querySelector("#recargarProductos").disabled = true;
    mensaje.textContent = "Eliminando producto…";
    try {
        const respuesta = await api.guardar("productos", "eliminar", {id});
        if (!respuesta || String(respuesta.id) !== id) {
            throw new Error("La respuesta no confirma la eliminación. Actualiza el catálogo para comprobarlo.");
        }
        estado.productosDisponibles = estado.productosDisponibles.filter(p => p.id !== id);
        renderProductos();
        mensaje.textContent = "Producto eliminado de Google Sheets.";
    } catch (error) {
        mensaje.textContent = "No se confirmó la eliminación: " + error.message;
    } finally {
        bloquearProducto(false);
        document.querySelector("#recargarProductos").disabled = false;
    }
}
