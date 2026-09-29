// Copia corregida de los controladores compartidos por el usuario.
// Sustituir únicamente doGet y doPost en Apps Script; conservar sus auxiliares.
// No es un servicio completo ni ha sido publicado desde este proyecto.
function doGet(e) {
    try {
        const resource = validarResource(e);
        return responder({ success: true, data: leerHoja(resource) });
    } catch (error) {
        return responder({ success: false, message: error.message });
    }
}

// Debe estar al nivel superior, fuera de doGet y de su catch.
function doPost(e) {
    const lock = LockService.getScriptLock();
    let bloqueado = false;
    try {
        const resource = validarResource(e);
        const body = JSON.parse(e.postData.contents);
        if (!body || !body.action || !body.data ||
            typeof body.data !== "object" || Array.isArray(body.data)) {
            throw new Error('El cuerpo debe ser { "action": "create|update|delete", "data": {...} }');
        }

        lock.waitLock(10000);
        bloqueado = true;
        switch (body.action) {
            case "close":
                if (resource !== "ventas") throw new Error("El cierre solo está disponible para ventas.");
                return responder({ success: true, data: cerrarVenta(body.data) });
            case "create":
                return responder({ success: true, data: crearRegistro(resource, body.data) });
            case "update":
                return responder({ success: true, data: actualizarRegistro(resource, body.data) });
            case "delete":
                return responder({ success: true, data: eliminarRegistro(resource, body.data) });
            default:
                throw new Error("Acción no soportada: " + body.action);
        }
    } catch (error) {
        return responder({ success: false, message: error.message, codigo: error.codigo || "RECHAZADO" });
    } finally {
        if (bloqueado) lock.releaseLock();
    }
}
