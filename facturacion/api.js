/* Único transporte REST del POS. Cookies de sesión y CSRF del mismo origen. */
const api = {
    url: '/api/', usuario: null, token: '',
    configurar(url) {
        const destino = new URL(url, location.origin);
        if (destino.origin !== location.origin || destino.pathname !== '/api/') throw new Error('Usa /api/ del mismo servidor.');
        this.url = destino.pathname;
    },
    async peticion(ruta, metodo='GET', datos=null, clave=null) {
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), 30000);
        try {
            const headers = {'Accept':'application/json'};
            if (metodo !== 'GET') {
                headers['Content-Type'] = 'application/json';
                headers['X-CSRFToken'] = this.token;
            }
            if (clave) headers['Idempotency-Key'] = clave;
            const respuesta = await fetch(this.url + ruta, {method:metodo, credentials:'same-origin', headers,
                body: datos === null ? undefined : JSON.stringify(datos), signal:controlador.signal});
            let resultado;
            try { resultado = await respuesta.json(); }
            catch { throw new Error(`Respuesta no válida (HTTP ${respuesta.status}). Actualiza la sesión.`); }
            if (!respuesta.ok) {
                const mensaje = resultado.detail || Object.entries(resultado).map(([k,v]) => `${k}: ${v}`).join('; ');
                const error = new Error(mensaje || `Error HTTP ${respuesta.status}`);
                error.status = respuesta.status;
                if ([400,403,404,409].includes(respuesta.status)) error.codigo = "RECHAZADO";
                throw error;
            }
            return resultado;
        } catch (error) {
            if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('No se confirmó la operación. Reintenta con el mismo identificador y datos.');
            throw error;
        } finally { clearTimeout(temporizador); }
    },
    async sesion() {
        this.token = (await this.peticion('auth/csrf/')).csrfToken;
        this.usuario = (await this.peticion('auth/sesion/')).usuario;
        return this.usuario;
    },
    async solicitar(recurso, accion, datos=null) {
        await this.lista;
        const recursos=['productos','categorias','clientes','proveedores','ventas','compras','descuentos','faltantes','reembolsos'];
        if (!recursos.includes(recurso)) throw new Error('Recurso no reconocido.');
        if (accion==='listar') return this.peticion(`${recurso}/`);
        if (accion==='importar') throw new Error('La migración se realiza con el comando del backend, sin repetir movimientos de inventario.');
        const metodos={crear:'POST',actualizar:'PATCH',eliminar:'DELETE',cerrar:'POST',corregir:'POST'};
        if (!metodos[accion] || !datos || typeof datos!=='object') throw new Error('Operación no válida.');
        let ruta=`${recurso}/`;
        if (accion!=='crear') ruta+=`${encodeURIComponent(datos.id)}/`;
        if (accion==='cerrar' || accion==='corregir') ruta+=`${accion}/`;
        let cuerpo={...datos};
        // La edición dentro de la venta usa la ruta restringida para ambos roles.
        if (recurso==='productos' && accion==='actualizar' && typeof productosEditor!=='undefined' && !Object.hasOwn(datos,'stock')) {
            ruta+='desde-venta/';
            cuerpo=Object.fromEntries(['nombre','categoriaId','precio','costo'].map(k=>[k,datos[k]]));
        }
        let clave=null;
        if (['ventas','compras','reembolsos'].includes(recurso)) {
            // Huella estable: un reintento del mismo borrador conserva la clave.
            const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(cuerpo)));
            clave=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
        }
        return this.peticion(ruta,metodos[accion],accion==='eliminar'?null:cuerpo,clave);
    },
    listar(recurso) { return this.solicitar(recurso,'listar'); },
    guardar(recurso,accion,datos) { return this.solicitar(recurso,accion,datos); }
};
api.lista = api.sesion().catch(error => {
    if (error.status===403) location.replace('login.html');
    throw error;
});
// Evita rechazos sin manejar si una página solo contiene enlaces.
api.lista.catch(()=>{});
