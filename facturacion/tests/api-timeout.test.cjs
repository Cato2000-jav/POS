const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
    let abortar,limpio=0;
    const ctx=vm.createContext({URL,AbortController,TextEncoder,crypto:require('node:crypto').webcrypto,
        location:{origin:'http://localhost',replace(){}},
        setTimeout:f=>{abortar=f;return 1;},clearTimeout:()=>limpio++,
        fetch:async url=>({ok:true,json:async()=>url.includes('csrf')?{csrfToken:'token'}:{usuario:{id:1,username:'admin'}}})});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../api.js'),'utf8'),ctx);
    await vm.runInContext('api.lista',ctx);
    limpio=0;
    ctx.fetch=(url,opciones)=>new Promise((resolve,reject)=>opciones.signal.addEventListener('abort',()=>{const e=new Error('Abortado');e.name='AbortError';reject(e);}));
    const solicitud=vm.runInContext('api.peticion("compras/","POST",{id:"c-1"},"clave")',ctx);
    abortar();await assert.rejects(solicitud,e=>!e.codigo&&/No se confirmó/.test(e.message));assert.equal(limpio,1);
    ctx.fetch=async()=>({ok:true,json:async()=>[]});
    await vm.runInContext('api.listar("compras")',ctx);assert.equal(limpio,2);
    let claves=[];
    ctx.fetch=async(url,opciones)=>{
        assert.equal(url,'/api/compras/');assert.equal(opciones.method,'POST');
        assert.equal(opciones.headers['X-CSRFToken'],'token');
        assert.equal(JSON.parse(opciones.body).id,'c-1');claves.push(opciones.headers['Idempotency-Key']);
        return {ok:true,json:async()=>({id:'c-1'})};
    };
    await vm.runInContext('api.guardar("compras","crear",{id:"c-1"})',ctx);
    await vm.runInContext('api.guardar("compras","crear",{id:"c-1"})',ctx);
    assert.equal(claves[0],claves[1]);
    ctx.fetch=async()=>({ok:false,status:409,json:async()=>({detail:'Stock insuficiente'})});
    await assert.rejects(vm.runInContext('api.peticion("ventas/v/cerrar/","POST",{})',ctx),e=>e.codigo==='RECHAZADO');
    console.log('PASS: REST, CSRF, timeout incierto y claves estables para reintentos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
