/* Sesión y navegación compartidas; los permisos también se comprueban en el servidor. */
window.marcaVentaHTML = venta => {
    const escapar = valor => String(valor ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `${venta.corregida ? `<p>Corregida por ${escapar(venta.corregidaPor)} · ${escapar(new Date(venta.corregidaEn).toLocaleString("es-CO",{timeZone:"America/Bogota"}))}</p>` : ''}
        ${venta.descuentoMonto ? `<p>Descuento: ${escapar(venta.descuentoNombre)} · $${venta.descuentoMonto}</p>` : ''}
        ${venta.reembolsoEstado && venta.reembolsoEstado!=='ninguno' ? `<p>Reembolso ${escapar(venta.reembolsoEstado)} · $${venta.reembolsado}</p>` : ''}`;
};
window.descuentosDisponibles=[];
window.descuentoActualMonto=bruto=>{
    const descuento=window.descuentosDisponibles.find(d=>d.id===document.querySelector('#descuentoVenta')?.value);
    return descuento ? Math.min(bruto,descuento.tipo==='porcentaje'?Math.round(bruto*descuento.valor/100):descuento.valor) : 0;
};
api.lista.then(async usuario=>{
    const barra=document.createElement('nav');barra.className='mvp3-bar';barra.setAttribute('aria-label','Navegación del POS');
    const nombre=document.createElement('span');nombre.textContent=`${usuario.username} · ${usuario.rol || 'Sin rol'}`;barra.append(nombre);
    for(const [texto,url] of [['Ventas','index.html'],['Historial','Historial_de_ventas.html'],['Gestión MVP 3','gestion.html']]){
        const a=document.createElement('a');a.href=url;a.textContent=texto;barra.append(a);
    }
    const salir=document.createElement('button');salir.textContent='Cerrar sesión';barra.append(salir);
    salir.onclick=async()=>{salir.disabled=true;try{await api.peticion('auth/logout/','POST',{});location.replace('login.html');}catch(e){alert(e.message);salir.disabled=false;}};
    document.body.prepend(barra);
    const trabajadorInput=document.querySelector('#trabajador');
    if(trabajadorInput){trabajadorInput.value=usuario.username;trabajadorInput.readOnly=true;}
    if(usuario.rol!=='Administrador'){
        for(const selector of ['#btnCategorias','#btnProveedores','#nuevoProducto','a[href="compras.html"]'])document.querySelectorAll(selector).forEach(e=>e.hidden=true);
        const estilo=document.createElement('style');estilo.textContent='.btn-eliminar-producto{display:none!important}';document.head.append(estilo);
    }
    // El archivo del navegador ya no es una fuente de datos operativa.
    const fuente=document.querySelector('#fuenteHistorial');
    if(fuente){for(const opcion of [...fuente.options])if(opcion.value!=='sheets')opcion.remove();}
    document.querySelectorAll('details').forEach(d=>{if(d.querySelector('summary')?.textContent.includes('migrar'))d.hidden=true;});
    const pago=document.querySelector('#mtdpago');
    if(pago){
        const label=document.createElement('label');label.textContent='Descuento';const select=document.createElement('select');select.id='descuentoVenta';label.append(select);pago.after(label);
        select.add(new Option('Sin descuento',''));
        select.disabled=true;
        try{
            window.descuentosDisponibles=await api.listar('descuentos');
            for(const d of window.descuentosDisponibles)select.add(new Option(`${d.nombre} (${d.valor}${d.tipo==='porcentaje'?'%':' pesos'})`,d.id));
            select.disabled=false;select.onchange=()=>renderFactura();
        }catch(e){label.append(document.createTextNode('No se pudieron cargar descuentos: '+e.message));}
    }
}).catch(error=>{console.error('Sesión:',error.message);});
