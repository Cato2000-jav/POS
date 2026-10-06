/* Transporte compartido. No cambia el carrito, el inventario ni localStorage.
   El contrato del servicio se describe en API_GOOGLE_SHEETS.md. */
const api = {
    url: "",

    configurar(url) {
        const destino = new URL(url);
        if (destino.protocol !== "https:" || destino.hostname !== "script.google.com" ||
            !/^\/macros\/s\/[^/]+\/exec$/.test(destino.pathname) ||
            destino.search || destino.hash || destino.username || destino.password) {
            throw new Error("Usa la URL HTTPS de la implementación de Google Apps Script terminada en /exec.");
        }
        this.url = destino.href;
    },

    async solicitar(recurso, accion, datos = null) {
        const recursos = ["productos", "ventas", "compras", "categorias", "proveedores", "clientes"];
        const acciones = ["listar", "crear", "actualizar", "eliminar", "cerrar", "importar"];
        if (!this.url) {
            throw new Error("Falta configurar la URL del servicio de Google Sheets.");
        }
        if (!recursos.includes(recurso) || !acciones.includes(accion)) {
            throw new Error("Recurso u operación no reconocidos.");
        }

        const esLectura = accion === "listar";
        if (accion === "cerrar" && recurso !== "ventas") {
            throw new Error("Solo se pueden cerrar ventas.");
        }
        if (accion === "importar" && recurso !== "ventas") throw new Error("Solo se importan ventas históricas.");
        if (!esLectura && (!datos || typeof datos !== "object" || Array.isArray(datos))) {
            throw new Error("La escritura necesita un objeto con los datos del registro.");
        }

        const destino = new URL(this.url);
        destino.searchParams.set("resource", recurso);
        const opciones = { method: esLectura ? "GET" : "POST", redirect: "follow" };
        if (!esLectura) {
            const accionesServicio = { crear: "create", actualizar: "update", eliminar: "delete", cerrar: "close", importar: "import" };
            // El cuerpo sigue siendo JSON; Apps Script lo lee con e.postData.contents.
            opciones.headers = { "Content-Type": "text/plain;charset=UTF-8" };
            opciones.body = JSON.stringify({ action: accionesServicio[accion], data: datos });
        }

        // Limita también la espera del cuerpo JSON. Un POST cancelado puede haber sido aplicado.
        const controlador = new AbortController();
        opciones.signal = controlador.signal;
        const temporizador = setTimeout(() => controlador.abort(), 30000);
        try {
            let respuesta;
            try {
                respuesta = await fetch(destino.href, opciones);
            } catch (error) {
                throw new Error(esLectura
                    ? "No se pudo conectar con Google Sheets. Revisa la conexión y el acceso al servicio."
                    : "No se pudo confirmar el guardado. Consulta el estado antes de reintentar para evitar duplicados.",
                { cause: error });
            }

            if (!respuesta.ok) {
                throw new Error(`El servicio respondió con HTTP ${respuesta.status}. No se confirmó la operación.`);
            }

            let resultado;
            try {
                resultado = await respuesta.json();
            } catch (error) {
                throw new Error("El servicio no devolvió JSON válido. No se confirmó la operación.", { cause: error });
            }

            if (!resultado || typeof resultado.success !== "boolean") {
                throw new Error("Respuesta del servicio no reconocida. No se confirmó la operación.");
            }
            if (!resultado.success) {
                const error = new Error(typeof resultado.message === "string"
                    ? resultado.message : "El servicio rechazó la operación.");
                error.codigo = resultado.codigo;
                throw error;
            }
            if (!Object.hasOwn(resultado, "data") || (esLectura && !Array.isArray(resultado.data))) {
                throw new Error("La respuesta del servicio no contiene los datos esperados.");
            }
            return resultado.data;
        } finally {
            clearTimeout(temporizador);
        }
    },

    listar(recurso) {
        return this.solicitar(recurso, "listar");
    },

    guardar(recurso, accion, datos) {
        if (accion === "listar") {
            return Promise.reject(new Error("Para consultar datos utiliza api.listar()."));
        }
        return this.solicitar(recurso, accion, datos);
    }
};

api.configurar("https://script.google.com/macros/s/AKfycbyMd6jokif6uShRw33KHkabccTaWgCAnf6nbtsZUmx9CFUEbx1NxpPDgY5zab2gciin/exec");
