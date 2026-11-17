const formulario=document.querySelector('#loginForm');
formulario.addEventListener('submit',async event=>{
    event.preventDefault(); const boton=formulario.querySelector('button');
    if(boton.disabled)return; boton.disabled=true;
    const mensaje=document.querySelector('#mensaje'); mensaje.textContent='Iniciando sesión…';
    try{
        const csrf=await fetch('/api/auth/csrf/',{credentials:'same-origin'});
        const {csrfToken}=await csrf.json();
        const respuesta=await fetch('/api/auth/login/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrfToken},body:JSON.stringify(Object.fromEntries(new FormData(formulario)))});
        const datos=await respuesta.json(); if(!respuesta.ok)throw new Error(datos.detail||'Revisa usuario y contraseña.');
        location.replace('index.html');
    }catch(error){mensaje.textContent=error.message;}finally{boton.disabled=false;}
});
