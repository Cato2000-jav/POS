// Copia temporal en memoria; la fuente del catálogo es Google Sheets.
let productosCargando = false;

function normalizarProductos(productosRemotos, categoriasRemotas) {
    const categoriasPorId = new Map(categoriasRemotas.map(categoria =>
        [String(categoria.id), String(categoria.nombre)]));
    const ids = new Set();
    return productosRemotos.map(producto => {
        const id = String(producto.id ?? "").trim();
        const nombre = String(producto.nombre ?? "").trim();
        const categoriaId = String(producto.categoriaId ?? "").trim();
        if (!id || !nombre || ids.has(id)) {
            throw new Error("Hay productos sin ID/nombre o con ID duplicado.");
        }
        ids.add(id);
        if (!categoriasPorId.has(categoriaId)) {
            throw new Error(`El producto ${nombre} no tiene una categoría válida.`);
        }
        const numeros = {};
        for (const campo of ["precio", "costo", "stock"]) {
            const valor = producto[campo];
            if (!["number", "string"].includes(typeof valor) ||
                String(valor).trim() === "" || !Number.isFinite(Number(valor)) ||
                Number(valor) < 0) {
                throw new Error(`${nombre}: ${campo} debe ser un número no negativo.`);
            }
            numeros[campo] = Number(valor);
        }
        if (!Number.isInteger(numeros.stock)) {
            throw new Error(`${nombre}: stock debe ser entero.`);
        }
        const seguimiento = String(producto.seguimientoInventario).toLowerCase();
        if (seguimiento !== "true" && seguimiento !== "false") {
            throw new Error(`${nombre}: seguimientoInventario debe ser TRUE o FALSE.`);
        }
        return {
            id, nombre, categoriaId, ...numeros,
            codigo: String(producto.codigo ?? ""),
            categoria: categoriasPorId.get(categoriaId),
            seguimientoInventario: seguimiento === "true",
            // La hoja actual no contiene estos campos. No asociar fotos por IDs antiguos.
            imagen: "", descripcion: ""
        };
    });
}

async function cargarProductos() {
    if (productosCargando) return;
    if (typeof productosEditor !== "undefined" && productosEditor.ocupado) return;
    if (typeof productosEditor !== "undefined" && !formProducto.hidden) {
        document.querySelector("#estadoProductos").textContent = "Cierra el formulario antes de actualizar el catálogo.";
        return;
    }
    const mensaje = document.querySelector("#estadoProductos");
    const boton = document.querySelector("#recargarProductos");
    // Recargar precios durante una venta cambiaría sus totales silenciosamente.
    if (estado.facturaActual.length) {
        mensaje.textContent = "Finaliza o cancela la venta antes de actualizar el catálogo.";
        return;
    }
    productosCargando = true;
    boton.disabled = true;
    buscador.disabled = true;
    botonIniciarFactura.disabled = true;
    catalogoProductos.inert = true;
    mensaje.textContent = "Cargando productos y categorías…";
    try {
        const [productosRemotos, categoriasRemotas] = await Promise.all([
            api.listar("productos"), api.listar("categorias")
        ]);
        const productosValidados = normalizarProductos(productosRemotos, categoriasRemotas);
        estado.productosDisponibles = productosValidados;
        renderProductos();
        mensaje.textContent = productosValidados.length
            ? `${productosValidados.length} productos cargados desde Google Sheets.`
            : "La hoja productos está vacía. No se utilizan productos de ejemplo.";
    } catch (error) {
        mensaje.textContent = `No se pudo actualizar el catálogo: ${error.message}. ` +
            "Puedes reintentar con Actualizar catálogo. Se conserva la última carga, si existe.";
    } finally {
        productosCargando = false;
        boton.disabled = false;
        buscador.disabled = false;
        botonIniciarFactura.disabled = false;
        catalogoProductos.inert = false;
    }
}

document.querySelector("#recargarProductos").addEventListener("click", cargarProductos);
