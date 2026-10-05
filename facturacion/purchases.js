// La hoja es la fuente de compras. Solo un borrador de envío pendiente se guarda localmente.
const comprasEstado = {ocupado: false, cargado: false, productos: [], proveedores: [], registros: [], items: [], pendiente: null, bloqueado: false};
const claveCompraPendiente = "papelLuna.compraPendiente.v1";
const compraElemento = id => document.getElementById(id);
const dineroCompra = valor => new Intl.NumberFormat("es-CO", {style: "currency", currency: "COP", maximumFractionDigits: 2}).format(valor);
function avisarCompra(texto) { compraElemento("estadoCompras").textContent = texto; }
function bloquearCompra(ocupado) {
    comprasEstado.ocupado = ocupado;
    compraElemento("camposCompra").disabled = ocupado || !comprasEstado.cargado || !!comprasEstado.pendiente || comprasEstado.bloqueado;
    compraElemento("recargarCompras").disabled = ocupado;
    compraElemento("reintentarCompra").hidden = !comprasEstado.pendiente;
    compraElemento("reintentarCompra").disabled = ocupado;
    compraElemento("formCompra").setAttribute("aria-busy", String(ocupado));
}
// Recibe el detalle y devuelve su total; rechaza valores que el servicio tampoco admite.
function totalItemsCompra(items) {
    if (!Array.isArray(items) || !items.length) throw new Error("Agrega al menos un producto.");
    const ids = new Set();
    const total = items.reduce((suma, item) => {
        if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) ||
            !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0 ||
            typeof item.costo !== "number" || !Number.isFinite(item.costo) || item.costo < 0) {
            throw new Error("Revisa cantidades enteras positivas y costos no negativos.");
        }
        ids.add(item.id);
        return suma + item.cantidad * item.costo;
    }, 0);
    if (!Number.isFinite(total)) throw new Error("Total fuera de rango.");
    return total;
}
function validarCompraRecibida(compra) {
    if (!compra || typeof compra.id !== "string" || !compra.id || typeof compra.proveedorId !== "string" ||
        !compra.proveedorId || typeof compra.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(compra.fecha) ||
        !Number.isFinite(Date.parse(compra.fecha)) || new Date(compra.fecha).toISOString().slice(0, 10) !== compra.fecha ||
        totalItemsCompra(compra.itemsJson) !== compra.total ||
        compra.itemsJson.some(i => typeof i.nombre !== "string" || !i.nombre || i.subtotal !== i.cantidad * i.costo)) {
        throw new Error("La compra recibida tiene datos inconsistentes.");
    }
    return compra;
}
function mismaCompra(compra, intento) {
    return compra.id === intento.id && compra.fecha === intento.fecha && compra.proveedorId === intento.proveedorId &&
        compra.total === intento.total && JSON.stringify(compra.itemsJson.map(({id, cantidad, costo}) => ({id, cantidad, costo}))) === JSON.stringify(intento.itemsJson);
}
function opcionCompra(valor, texto) {
    const opcion = document.createElement("option"); opcion.value = valor; opcion.textContent = texto; return opcion;
}
function renderProductosCompra() {
    const texto = compraElemento("compraBuscar").value.trim().toLocaleLowerCase("es");
    const selector = compraElemento("compraProducto"); selector.replaceChildren();
    comprasEstado.productos.filter(p => (p.nombre + " " + (p.codigo || "")).toLocaleLowerCase("es").includes(texto))
        .forEach(p => selector.append(opcionCompra(p.id, p.nombre)));
}
function actualizarTotalCompra() {
    try { compraElemento("totalCompra").textContent = dineroCompra(totalItemsCompra(comprasEstado.items)); }
    catch { compraElemento("totalCompra").textContent = comprasEstado.items.length ? "Revisa cantidades/costos" : dineroCompra(0); }
}
function renderItemsCompra() {
    const lista = compraElemento("itemsCompra"); lista.replaceChildren();
    comprasEstado.items.forEach(item => {
        const fila = document.createElement("tr"), nombre = document.createElement("td");
        nombre.textContent = item.nombre; fila.append(nombre);
        const subtotal = document.createElement("td");
        const mostrarSubtotal = () => { subtotal.textContent = Number.isFinite(item.cantidad * item.costo) ? dineroCompra(item.cantidad * item.costo) : "—"; };
        for (const campo of ["cantidad", "costo"]) {
            const celda = document.createElement("td"), input = document.createElement("input");
            input.type = "number"; input.min = campo === "cantidad" ? "1" : "0"; input.step = campo === "cantidad" ? "1" : "any";
            input.required = true; input.value = item[campo]; input.setAttribute("aria-label", campo + " de " + item.nombre);
            input.addEventListener("input", () => {item[campo] = input.value === "" ? NaN : Number(input.value); mostrarSubtotal(); actualizarTotalCompra();});
            celda.append(input); fila.append(celda);
        }
        mostrarSubtotal(); fila.append(subtotal);
        const accion = document.createElement("td"), boton = document.createElement("button");
        boton.type = "button"; boton.textContent = "Quitar"; boton.setAttribute("aria-label", "Quitar " + item.nombre);
        boton.addEventListener("click", () => {comprasEstado.items = comprasEstado.items.filter(i => i.id !== item.id); renderItemsCompra();});
        accion.append(boton); fila.append(accion); lista.append(fila);
    });
    actualizarTotalCompra();
}
function renderListaCompras() {
    const lista = compraElemento("listaCompras"); lista.replaceChildren();
    if (!comprasEstado.registros.length) { const li = document.createElement("li"); li.textContent = "No hay compras registradas."; lista.append(li); }
    [...comprasEstado.registros].sort((a, b) => b.fecha.localeCompare(a.fecha)).forEach(compra => {
        const li = document.createElement("li"), boton = document.createElement("button");
        const proveedor = comprasEstado.proveedores.find(p => p.id === compra.proveedorId);
        li.textContent = `${compra.fecha} · ${proveedor?.nombre || compra.proveedorId} · ${dineroCompra(compra.total)} `;
        boton.textContent = "Ver detalle"; boton.type = "button";
        boton.addEventListener("click", () => {
            const detalle = compraElemento("detalleCompra"); detalle.replaceChildren(); detalle.hidden = false;
            const titulo = document.createElement("h3"); titulo.textContent = "Compra " + compra.id; detalle.append(titulo);
            for (const item of compra.itemsJson) { const p = document.createElement("p"); p.textContent = `${item.nombre}: ${item.cantidad} × ${dineroCompra(item.costo)} = ${dineroCompra(item.subtotal)}`; detalle.append(p); }
        });
        li.append(boton); lista.append(li);
    });
}
async function cargarCompras() {
    if (comprasEstado.ocupado) return;
    bloquearCompra(true); avisarCompra("Cargando compras, productos y proveedores…");
    try {
        const [registros, productos, proveedores] = await Promise.all([api.listar("compras"), api.listar("productos"), api.listar("proveedores")]);
        registros.forEach(validarCompraRecibida);
        for (const lista of [registros, productos, proveedores]) {
            if (lista.some(r => !r || typeof r.id !== "string" || !r.id) || new Set(lista.map(r => r.id)).size !== lista.length) throw new Error("Hay IDs ausentes o duplicados.");
        }
        if (productos.some(p => typeof p.nombre !== "string" || !p.nombre || typeof p.costo !== "number" || !Number.isFinite(p.costo) || p.costo < 0) ||
            proveedores.some(p => typeof p.nombre !== "string" || !p.nombre)) throw new Error("Catálogo o proveedores inválidos.");
        Object.assign(comprasEstado, {registros, productos, proveedores, cargado: true});
        const selector = compraElemento("compraProveedor"), anterior = selector.value;
        selector.replaceChildren(opcionCompra("", "Selecciona proveedor")); proveedores.forEach(p => selector.append(opcionCompra(p.id, p.nombre))); selector.value = anterior;
        if (comprasEstado.pendiente) {
            selector.value = comprasEstado.pendiente.proveedorId;
            compraElemento("compraFecha").value = comprasEstado.pendiente.fecha;
            comprasEstado.items = comprasEstado.pendiente.itemsJson.map(item => ({...item,
                nombre: productos.find(p => p.id === item.id)?.nombre || item.id}));
            renderItemsCompra();
        }
        renderProductosCompra(); renderListaCompras();
        avisarCompra(comprasEstado.pendiente ? "Hay un envío pendiente. Reintenta la misma compra; no crees otra." : "Datos actualizados desde Google Sheets.");
    } catch (error) { avisarCompra("No se pudo actualizar: " + error.message + " Se conserva la última carga válida."); }
    finally { bloquearCompra(false); }
}
async function guardarCompraFormulario(evento) {
    evento?.preventDefault();
    if (comprasEstado.ocupado || comprasEstado.bloqueado) return;
    if (!comprasEstado.pendiente && !comprasEstado.cargado) return;
    bloquearCompra(true);
    let enviado = false;
    try {
        if (!comprasEstado.pendiente) {
            if (localStorage.getItem(claveCompraPendiente)) throw new Error("Existe otro envío pendiente. Actualiza esta página para recuperarlo antes de crear una compra.");
            const proveedorId = compraElemento("compraProveedor").value, fecha = compraElemento("compraFecha").value;
            if (!fecha || !comprasEstado.proveedores.some(p => p.id === proveedorId)) throw new Error("Selecciona proveedor y fecha.");
            const intento = {id: crypto.randomUUID(), fecha, proveedorId, total: totalItemsCompra(comprasEstado.items),
                itemsJson: comprasEstado.items.map(({id, cantidad, costo}) => ({id, cantidad, costo}))};
            // Si no podemos conservar el ID, no enviamos una operación que podría duplicarse al recargar.
            localStorage.setItem(claveCompraPendiente, JSON.stringify(intento));
            comprasEstado.pendiente = intento;
        }
        avisarCompra("Guardando compra en Google Sheets…");
        enviado = true;
        const compra = validarCompraRecibida(await api.guardar("compras", "crear", comprasEstado.pendiente));
        if (!mismaCompra(compra, comprasEstado.pendiente)) throw new Error("La confirmación no corresponde al envío pendiente.");
        // Si borrar el borrador falla, conservarlo permite repetir el mismo ID sin duplicar stock.
        localStorage.removeItem(claveCompraPendiente);
        comprasEstado.pendiente = null; comprasEstado.items = [];
        comprasEstado.registros = comprasEstado.registros.filter(c => c.id !== compra.id).concat(compra);
        renderItemsCompra(); renderListaCompras();
        avisarCompra("Compra confirmada. Stock y costos actualizados en Sheets. Actualiza los datos antes de preparar otra compra.");
        comprasEstado.cargado = false;
    } catch (error) {
        if (enviado && error.codigo === "RECHAZADO") {
            try {localStorage.removeItem(claveCompraPendiente); comprasEstado.pendiente = null;}
            catch { avisarCompra("No se pudo retirar el borrador pendiente. Conserva esta pestaña y reintenta con el mismo ID."); return; }
        }
        avisarCompra(error.message + (comprasEstado.pendiente ? " El envío sigue pendiente: reintenta sin cambiar sus datos ni su ID." : " No se confirmó una compra."));
    } finally { bloquearCompra(false); }
}
function iniciarCompras() {
    const ahora = new Date(); compraElemento("compraFecha").value = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    try {
        const texto = localStorage.getItem(claveCompraPendiente);
        if (texto) {
            const intento = JSON.parse(texto);
            if (!intento || typeof intento.id !== "string" || !intento.id || typeof intento.fecha !== "string" || typeof intento.proveedorId !== "string" || totalItemsCompra(intento.itemsJson) !== intento.total) throw new Error("Borrador inválido");
            comprasEstado.pendiente = intento;
        }
    } catch { comprasEstado.bloqueado = true; avisarCompra("No se pudo recuperar el borrador pendiente. No se enviarán compras; revisa el almacenamiento antes de continuar."); bloquearCompra(false); return; }
    cargarCompras();
}
compraElemento("compraBuscar").addEventListener("input", renderProductosCompra);
compraElemento("agregarCompra").addEventListener("click", () => {
    if (comprasEstado.ocupado || comprasEstado.pendiente) return;
    const producto = comprasEstado.productos.find(p => p.id === compraElemento("compraProducto").value);
    if (!producto) return;
    if (comprasEstado.items.some(i => i.id === producto.id)) {avisarCompra("Ese producto ya está agregado; cambia su cantidad."); return;}
    comprasEstado.items.push({id: producto.id, nombre: producto.nombre, cantidad: 1, costo: producto.costo}); renderItemsCompra();
});
compraElemento("formCompra").addEventListener("submit", guardarCompraFormulario);
compraElemento("reintentarCompra").addEventListener("click", () => guardarCompraFormulario());
compraElemento("recargarCompras").addEventListener("click", cargarCompras);
iniciarCompras();
