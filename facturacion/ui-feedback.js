// Presentación compartida. No conoce la API ni modifica registros.
const uiFeedback = {dialogo: null};

function notificarUI(mensaje, tipo = "success") {
    let region = document.querySelector("#avisosUI");
    if (!region) {
        region = document.createElement("div"); region.id = "avisosUI";
        region.className = "ui-avisos"; region.setAttribute("aria-label", "Notificaciones");
        document.body.appendChild(region);
    }
    // Mantener pocos avisos visibles; cada uno conserva su propio temporizador.
    if (region.children.length >= 3) region.firstElementChild.remove();
    const aviso = document.createElement("div");
    aviso.className = "ui-aviso";
    aviso.dataset.tipo = ["error", "warning", "success"].includes(tipo) ? tipo : "info";
    aviso.setAttribute("role", tipo === "error" ? "alert" : "status");
    const icono = document.createElement("span"); icono.className = "ui-aviso-icono";
    icono.textContent = tipo === "error" ? "!" : tipo === "warning" ? "!" : tipo === "success" ? "✓" : "i";
    icono.setAttribute("aria-hidden", "true");
    const texto = document.createElement("span"); texto.textContent = mensaje;
    const cerrar = document.createElement("button"); cerrar.type = "button"; cerrar.textContent = "×";
    cerrar.setAttribute("aria-label", "Cerrar notificación");
    let temporizador;
    const retirar = () => {
        clearTimeout(temporizador); aviso.classList.add("ui-saliendo");
        setTimeout(() => aviso.remove(), 180);
    };
    const programar = () => {clearTimeout(temporizador); temporizador = setTimeout(retirar, tipo === "error" ? 10000 : 6500);};
    cerrar.addEventListener("click", retirar);
    aviso.addEventListener("mouseenter", () => clearTimeout(temporizador));
    aviso.addEventListener("mouseleave", programar);
    aviso.addEventListener("focusin", () => clearTimeout(temporizador));
    aviso.addEventListener("focusout", programar);
    aviso.append(icono, texto, cerrar); region.appendChild(aviso); programar();
}

// Devuelve Promise<boolean>. Cancelar, Escape y solicitudes simultáneas devuelven false.
function confirmarAccion(mensaje, opciones = {}) {
    if (uiFeedback.dialogo) return Promise.resolve(false);
    return new Promise(resolve => {
        const anterior = document.activeElement;
        const dialogo = document.createElement("dialog"); dialogo.className = "ui-dialogo";
        dialogo.dataset.peligro = String(Boolean(opciones.peligro));
        dialogo.setAttribute("aria-labelledby", "ui-dialogo-titulo");
        dialogo.setAttribute("aria-describedby", "ui-dialogo-mensaje");
        const marca = document.createElement("div"); marca.className = "ui-dialogo-marca";
        marca.textContent = opciones.peligro ? "!" : "☾"; marca.setAttribute("aria-hidden", "true");
        const titulo = document.createElement("h2"); titulo.id = "ui-dialogo-titulo";
        titulo.textContent = opciones.titulo || (opciones.peligro ? "Confirmar eliminación" : "Antes de continuar");
        const texto = document.createElement("p"); texto.id = "ui-dialogo-mensaje"; texto.textContent = mensaje;
        const acciones = document.createElement("div"); acciones.className = "ui-dialogo-acciones";
        const cancelar = document.createElement("button"); cancelar.type = "button"; cancelar.className = "ui-secundario";
        cancelar.textContent = "Cancelar";
        const aceptar = document.createElement("button"); aceptar.type = "button"; aceptar.className = "ui-aceptar";
        aceptar.textContent = opciones.aceptar || (opciones.peligro ? "Sí, eliminar" : "Continuar");
        if (opciones.soloLectura) cancelar.hidden = true;
        let resuelto = false, resultado = false;
        const terminar = valor => {
            if (resuelto) return; resuelto = true; resultado = valor;
            aceptar.disabled = true; cancelar.disabled = true;
            dialogo.classList.add("ui-saliendo");
            setTimeout(() => dialogo.close(), 140);
        };
        cancelar.addEventListener("click", () => terminar(false));
        aceptar.addEventListener("click", () => terminar(true));
        dialogo.addEventListener("cancel", e => {e.preventDefault(); terminar(false);});
        dialogo.addEventListener("close", () => {
            dialogo.remove(); uiFeedback.dialogo = null;
            if (anterior?.isConnected) anterior.focus();
            resolve(resultado);
        }, {once: true});
        acciones.append(cancelar, aceptar); dialogo.append(marca, titulo, texto, acciones);
        uiFeedback.dialogo = dialogo; document.body.appendChild(dialogo);
        try {dialogo.showModal(); (opciones.soloLectura ? aceptar : cancelar).focus();}
        catch {dialogo.remove(); uiFeedback.dialogo = null; resolve(false); notificarUI("No se pudo abrir la confirmación. La acción no se ejecutó.", "error");}
    });
}

// Mantiene los mensajes existentes junto a sus formularios, con estados visuales.
function prepararMensajesUI() {
    const selectores = "#estadoProductos,#mensajeProducto,#estadoCategorias,#estadoProveedores,#estadoClientes,#estadoVentasAbiertas,#estadoCompras,#estadoHistorial,#estadoMigracion,#estadoImportacion";
    document.querySelectorAll(selectores).forEach(elemento => {
        elemento.classList.add("ui-estado");
        const actualizar = () => {
            const texto = elemento.textContent.trim();
            // Los módulos pueden indicar el estado real sin depender de palabras del mensaje.
            if (["error", "warning", "loading", "success", "info"].includes(elemento.dataset.tipoMensaje)) {
                elemento.dataset.tipo = elemento.dataset.tipoMensaje;
                return;
            }
            elemento.dataset.tipo = /no se pudo|no se confirmó|error|inválid|insuficiente|rechaz|no puedes/i.test(texto) ? "error" :
                /pendiente|revisa|espera|no se conoce/i.test(texto) ? "warning" :
                /cargando|guardando|eliminando|consultando|importando|confirmando/i.test(texto) ? "loading" :
                /correctamente|confirmad|eliminad|guardad|cread|actualizad/i.test(texto) ? "success" : "info";
        };
        new MutationObserver(actualizar).observe(elemento, {childList: true, characterData: true, subtree: true});
        actualizar();
    });
}
document.addEventListener("DOMContentLoaded", prepararMensajesUI);
