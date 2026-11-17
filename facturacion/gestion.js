/* Módulos nuevos: formularios pequeños, API compartida y texto seguro en el DOM. */
const contenido=document.querySelector('#contenido'), aviso=document.querySelector('#aviso'), modulo=document.querySelector('#modulo');
let cargando=false;
const dinero=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
function elemento(tipo,texto){const e=document.createElement(tipo);if(texto!==undefined)e.textContent=texto;return e;}
function campo(form,nombre,titulo,tipo='text',valor=''){
    const label=elemento('label',titulo),input=elemento('input');input.name=nombre;input.type=tipo;input.value=valor;
    label.append(input);form.append(label);return input;
}
function selector(form,nombre,titulo,opciones,valor=''){
    const label=elemento('label',titulo),select=elemento('select');select.name=nombre;
    for(const [id,texto] of opciones)select.add(new Option(texto,id));select.value=valor;
    label.append(select);form.append(label);return select;
}
function boton(padre,texto,accion){const b=elemento('button',texto);b.type='button';b.onclick=accion;padre.append(b);return b;}
function mensaje(error){aviso.textContent=error.message||String(error);}
async function ejecutar(b,fn){if(b.disabled)return;b.disabled=true;try{await fn();}catch(e){mensaje(e);}finally{b.disabled=false;}}
function guardarForm(form,fn){const b=elemento('button','Guardar');b.type='submit';form.append(b);form.onsubmit=e=>{e.preventDefault();ejecutar(b,fn);};return b;}
function tabla(padre,filas,columnas){const envoltura=elemento('div');envoltura.className='mvp3-table';const t=elemento('table'),head=elemento('tr');for(const [titulo] of columnas)head.append(elemento('th',titulo));t.append(head);for(const fila of filas){const tr=elemento('tr');for(const [,obtener] of columnas)tr.append(elemento('td',obtener(fila)));t.append(tr);}envoltura.append(t);padre.append(envoltura);}

// Solo se guarda el borrador del envío incierto, nunca el catálogo ni el historial.
const clavePendiente=()=>`papelLuna.operacionMvp3.${api.usuario.id}`;
async function enviarOperacion(ruta,datos){
    if(localStorage.getItem(clavePendiente()))throw new Error('Resuelve primero la operación pendiente.');
    const pendiente={ruta,datos,clave:crypto.randomUUID()};
    localStorage.setItem(clavePendiente(),JSON.stringify(pendiente));
    return resolverPendiente(pendiente);
}
async function resolverPendiente(pendiente){
    try{
        const resultado=await api.peticion(pendiente.ruta,'POST',pendiente.datos,pendiente.clave);
        localStorage.removeItem(clavePendiente());return resultado;
    }catch(e){
        if(e.codigo==='RECHAZADO')localStorage.removeItem(clavePendiente());
        else mostrarPendiente();
        throw e;
    }
}
function mostrarPendiente(){
    const guardado=localStorage.getItem(clavePendiente());if(!guardado)return false;
    contenido.replaceChildren(elemento('h2','Operación pendiente de confirmación'));
    contenido.append(elemento('p','Reintenta el mismo envío. No se generará otro identificador ni se repetirá el movimiento confirmado.'));
    boton(contenido,'Reintentar',function(){ejecutar(this,async()=>{await resolverPendiente(JSON.parse(guardado));aviso.textContent='Operación confirmada.';await cargar();});});
    return true;
}

async function descuentos(){
    const registros=await api.listar('descuentos');
    contenido.append(elemento('h2','Catálogo de descuentos'));
    const form=elemento('form');contenido.append(form);
    const nombre=campo(form,'nombre','Nombre');nombre.required=true;nombre.maxLength=150;
    const tipo=selector(form,'tipo','Tipo',[['porcentaje','Porcentaje'],['fijo','Valor fijo']], 'porcentaje');
    const valor=campo(form,'valor','Valor','number');valor.min=1;valor.step=1;valor.required=true;
    let id=null;const nuevoId=crypto.randomUUID();
    guardarForm(form,async()=>{await api.guardar('descuentos',id?'actualizar':'crear',{id:id||nuevoId,nombre:nombre.value,tipo:tipo.value,valor:Number(valor.value)});aviso.textContent='Descuento guardado.';await cargar();});
    for(const d of registros){const fila=elemento('div',`${d.nombre} · ${d.valor}${d.tipo==='porcentaje'?'%':' pesos'}`);fila.className='fila';contenido.append(fila);
        boton(fila,'Editar',()=>{id=d.id;nombre.value=d.nombre;tipo.value=d.tipo;valor.value=d.valor;form.scrollIntoView({behavior:'smooth'});});
        boton(fila,'Eliminar',function(){ejecutar(this,async()=>{if(await confirmarAccion(`¿Eliminar ${d.nombre}? Las ventas conservan sus descuentos históricos.`)){await api.guardar('descuentos','eliminar',{id:d.id});await cargar();}});});
    }
}
async function faltantes(){
    const [productos,registros]=await Promise.all([api.listar('productos'),api.listar('faltantes')]);
    // Los cajeros no consultan datos privados de proveedores; pueden omitirlo.
    const proveedores=await api.peticion('faltantes/proveedores/');
    contenido.append(elemento('h2','Faltantes y demanda no atendida'));
    const form=elemento('form');contenido.append(form);
    const tipo=selector(form,'tipo','Tipo',[['no_registrado','Producto no registrado'],['agotado','Producto agotado']],'no_registrado');
    const nombre=campo(form,'nombre','Nombre solicitado');nombre.maxLength=150;
    const producto=selector(form,'productoId','Producto agotado',[['','Selecciona'],...productos.filter(p=>p.seguimientoInventario&&p.stock===0).map(p=>[p.id,p.nombre])]);
    const cantidad=campo(form,'cantidad','Cantidad','number','1');cantidad.min=1;cantidad.step=1;cantidad.required=true;
    const proveedor=selector(form,'proveedorId','Proveedor (opcional)',[['','Sin proveedor'],...proveedores.map(p=>[p.id,p.nombre])]);
    tipo.onchange=()=>{nombre.disabled=tipo.value==='agotado';producto.disabled=tipo.value!=='agotado';};tipo.onchange();
    guardarForm(form,async()=>{await api.guardar('faltantes','crear',{tipo:tipo.value,nombre:nombre.value,productoId:producto.disabled?null:producto.value||null,cantidad:Number(cantidad.value),proveedorId:proveedor.value||null});aviso.textContent='Faltante registrado.';await cargar();});
    const filtros=elemento('div');filtros.className='grid';contenido.append(filtros);
    const ft=selector(filtros,'ft','Filtrar tipo',[['','Todos'],['agotado','Agotado'],['no_registrado','No registrado']]);
    const fp=selector(filtros,'fp','Filtrar proveedor',[['','Todos'],...proveedores.map(p=>[p.id,p.nombre])]);
    const fe=selector(filtros,'fe','Estado',[['','Todos'],['pendiente','Pendiente'],['resuelto','Resuelto']]);
    const lista=elemento('div');contenido.append(lista);
    function pintar(){lista.replaceChildren();for(const f of registros.filter(f=>(!ft.value||f.tipo===ft.value)&&(!fp.value||f.proveedorId===fp.value)&&(!fe.value||f.estado===fe.value))){const fila=elemento('div',`${f.nombre} · ${f.cantidad} · ${new Date(f.fecha).toLocaleDateString('es-CO')} · ${f.estado}`);fila.className='fila';lista.append(fila);if(api.usuario.rol==='Administrador'&&f.estado==='pendiente')boton(fila,'Marcar resuelto',function(){ejecutar(this,async()=>{await api.guardar('faltantes','actualizar',{id:f.id,estado:'resuelto'});f.estado='resuelto';pintar();});});}}
    ft.onchange=fp.onchange=fe.onchange=pintar;pintar();
}
async function inventario(){
    const productos=await api.listar('productos');contenido.append(elemento('h2','Inventario'));
    contenido.append(elemento('p','Para registrar entradas de mercancía utiliza Compras. Los cambios directos son ajustes administrativos.'));
    const buscar=campo(contenido,'buscar','Buscar producto');const lista=elemento('div');contenido.append(lista);
    function pintar(){lista.replaceChildren();for(const p of productos.filter(p=>p.nombre.toLowerCase().includes(buscar.value.toLowerCase()))){const form=elemento('form');form.className='fila';form.append(elemento('h3',p.nombre));const stock=campo(form,'stock','Existencias','number',p.stock);stock.min=0;stock.step=1;stock.required=true;const seguir=campo(form,'seguir','Controlar inventario','checkbox');seguir.checked=p.seguimientoInventario;guardarForm(form,async()=>{await api.guardar('productos','actualizar',{id:p.id,stock:Number(stock.value),seguimientoInventario:seguir.checked});aviso.textContent='Inventario actualizado.';});lista.append(form);}}
    buscar.oninput=pintar;pintar();
}
async function seleccionarVenta(titulo,render){
    const ventas=(await api.listar('ventas')).filter(v=>v.estado==='cerrada');contenido.append(elemento('h2',titulo));
    const s=selector(contenido,'venta','Venta',[['','Selecciona una venta'],...ventas.map(v=>[v.id,`${v.id} · ${v.clienteNombre||'Sin cliente'} · ${dinero(v.total)}`])]);
    const detalle=elemento('div');contenido.append(detalle);
    s.onchange=()=>{detalle.replaceChildren();const venta=ventas.find(v=>v.id===s.value);if(venta)render(venta,detalle);};
}
async function correcciones(){
    const [productos,clientes,descuentos]=await Promise.all([api.listar('productos'),api.listar('clientes'),api.listar('descuentos')]);
    await seleccionarVenta('Corregir una venta cerrada',(venta,padre)=>{
        if(venta.reembolsoEstado!=='ninguno'){padre.append(elemento('p','Esta venta tiene reembolsos y no admite corrección.'));return;}
        const form=elemento('form');padre.append(form);
        const cliente=selector(form,'cliente','Cliente',[['','Sin cliente'],...clientes.map(c=>[c.id,c.nombre])],venta.clienteId);
        const pago=selector(form,'pago','Método de pago',['Efectivo','Nequi','Debe'].map(x=>[x,x]),venta.metodoPago);
        const descuento=selector(form,'descuento','Descuento',[['','Sin descuento'],...descuentos.map(d=>[d.id,d.nombre])],venta.descuentoId);
        const recibido=campo(form,'recibido','Valor recibido (efectivo)','number',venta.valorRecibido);recibido.min=0;recibido.step=1;
        let items=venta.itemsJson.map(i=>({id:i.id,cantidad:i.cantidad}));
        const nuevo=selector(form,'producto','Agregar producto',productos.map(p=>[p.id,p.nombre]),productos[0]?.id);
        const filas=elemento('div'),total=elemento('p');
        boton(form,'Agregar',()=>{if(!nuevo.value)return;const i=items.find(i=>i.id===nuevo.value);if(i)i.cantidad++;else items.push({id:nuevo.value,cantidad:1});pintar();});form.append(filas,total);
        function calcular(){const subtotal=items.reduce((s,i)=>s+(productos.find(p=>p.id===i.id)?.precio||0)*i.cantidad,0);const bruto=subtotal+Math.round(subtotal*.19),d=descuentos.find(d=>d.id===descuento.value);const monto=d?Math.min(bruto,d.tipo==='porcentaje'?Math.round(bruto*d.valor/100):d.valor):0;total.textContent=`Total calculado con precios actuales: ${dinero(bruto-monto)}`;}
        function pintar(){filas.replaceChildren();items.forEach(i=>{const fila=elemento('div');fila.className='fila';const p=productos.find(p=>p.id===i.id);const c=campo(fila,'cantidad',p?.nombre||`Producto eliminado: ${i.id}`,'number',i.cantidad);c.min=1;c.step=1;c.required=true;c.oninput=()=>{i.cantidad=Number(c.value);calcular();};boton(fila,'Quitar',()=>{items=items.filter(x=>x!==i);pintar();});filas.append(fila);});calcular();}
        descuento.onchange=calcular;pintar();
        guardarForm(form,async()=>{if(!await confirmarAccion('¿Confirmar la corrección y ajustar el inventario?'))return;
            const resultado=await enviarOperacion(`ventas/${encodeURIComponent(venta.id)}/corregir/`,{id:venta.id,actualizadoEn:venta.actualizadoEn,clienteId:cliente.value,metodoPago:pago.value,descuentoId:descuento.value,valorRecibido:Number(recibido.value),itemsJson:items});
            aviso.textContent=`Venta corregida. Total ${dinero(resultado.total)}.`;await cargar();});
    });
}
async function reembolsos(){
    await seleccionarVenta('Reembolsos parciales o totales',(venta,padre)=>{
        const form=elemento('form');padre.append(form);const entradas=[];
        form.append(elemento('p',`Ya reembolsado: ${dinero(venta.reembolsado)}. El servidor calcula la devolución proporcional al descuento e IVA.`));
        for(const item of venta.itemsJson){const fila=elemento('div');fila.className='fila';const restante=item.cantidad-item.devuelto;
            const cantidad=campo(fila,'cantidad',`${item.nombre} · pendientes ${restante}`,'number','0');cantidad.min=0;cantidad.max=restante;cantidad.step=1;cantidad.required=true;
            const retorna=campo(fila,'retorna','Retorna al inventario','checkbox');entradas.push({item,cantidad,retorna});form.append(fila);}
        boton(form,'Seleccionar todas las cantidades pendientes',()=>entradas.forEach(e=>e.cantidad.value=e.item.cantidad-e.item.devuelto));
        guardarForm(form,async()=>{const items=entradas.filter(e=>Number(e.cantidad.value)>0).map(e=>({detalleId:e.item.detalleId,cantidad:Number(e.cantidad.value),retornaInventario:e.retorna.checked}));
            if(!items.length)throw new Error('Selecciona al menos una cantidad.');if(!await confirmarAccion('¿Registrar el reembolso con las cantidades y retornos seleccionados?'))return;
            const resultado=await enviarOperacion('reembolsos/',{id:crypto.randomUUID(),ventaId:venta.id,items});aviso.textContent=`Reembolso registrado: ${dinero(resultado.total)}.`;await cargar();});
    });
}
async function reportes(){
    contenido.append(elemento('h2','Reportes básicos'));const form=elemento('form');form.className='grid';contenido.append(form);
    const hoy=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Bogota'});
    const desde=campo(form,'desde','Desde','date',hoy),hasta=campo(form,'hasta','Hasta','date',hoy);desde.required=hasta.required=true;
    const salida=elemento('div');contenido.append(salida);
    guardarForm(form,async()=>{const r=await api.peticion(`reportes/?desde=${encodeURIComponent(desde.value)}&hasta=${encodeURIComponent(hasta.value)}`);salida.replaceChildren();
        salida.append(elemento('p',`Ventas: ${dinero(r.ventasTotal)} · Reembolsos del período: ${dinero(r.reembolsosTotal)} · Neto del período: ${dinero(r.netoPeriodo)} · Compras: ${dinero(r.comprasTotal)}`));
        salida.append(elemento('h3','Productos más vendidos (cantidades antes de reembolsos)'));tabla(salida,r.productosMasVendidos,[['Producto',p=>p.nombre],['Cantidad',p=>p.cantidad],['Subtotal',p=>dinero(p.importe)]]);
        salida.append(elemento('h3','Compras registradas'));tabla(salida,r.compras,[['Fecha',p=>p.fecha],['Proveedor ID',p=>p.proveedorId],['Total',p=>dinero(p.total)]]);
        salida.append(elemento('h3','Faltantes frecuentes'));tabla(salida,r.faltantesFrecuentes,[['Nombre normalizado',p=>p.nombre],['Proveedor ID',p=>p.proveedorId||'Sin proveedor'],['Solicitudes',p=>p.solicitudes],['Cantidad',p=>p.cantidad],['Pendientes',p=>p.pendientes]]);
    });
}
async function cargar(){
    if(cargando)return;cargando=true;modulo.disabled=true;contenido.replaceChildren();
    try{if(!mostrarPendiente())await ({faltantes,descuentos,correcciones,reembolsos,reportes,productos:inventario}[modulo.value])();}
    catch(e){mensaje(e);}finally{cargando=false;modulo.disabled=false;}
}
modulo.onchange=cargar;
api.lista.then(()=>{if(api.usuario.rol!=='Administrador'){for(const o of [...modulo.options])if(o.value!=='faltantes')o.remove();}cargar();}).catch(mensaje);
