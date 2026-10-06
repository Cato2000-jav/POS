// CRUD de categorías; los cambios se aplican solo tras confirmación de la API.
const categoriasEstado = { registros: [], cargando: false, cargadas: false, editandoId: null, nuevoId: null };
const panelCategorias = document.querySelector("#panelCategorias");
const botonCategorias = document.querySelector("#btnCategorias");
const recargarCategorias = document.querySelector("#recargarCategorias");
const buscarCategorias = document.querySelector("#buscarCategorias");
const listaCategorias = document.querySelector("#listaCategorias");
const mensajeCategorias = document.querySelector("#estadoCategorias");
const formCategoria = document.querySelector("#formCategoria");
const nombreCategoria = document.querySelector("#nombreCategoria");
const guardarCategoria = document.querySelector("#guardarCategoria");
const cancelarCategoria = document.querySelector("#cancelarCategoria");
const etiquetaCategoria = document.querySelector("#etiquetaCategoria");

function bloquearCategorias(ocupado) {
    categoriasEstado.cargando = ocupado;
    panelCategorias.setAttribute("aria-busy", String(ocupado));
    recargarCategorias.disabled = ocupado;
    panelCategorias.querySelectorAll("input, form button, li button").forEach(function (control) {
        control.disabled = ocupado || !categoriasEstado.cargadas;
    });
}

function limpiarCategoria() {
    categoriasEstado.editandoId = null;
    categoriasEstado.nuevoId = null;
    nombreCategoria.value = "";
    etiquetaCategoria.textContent = "Nueva categoría";
    guardarCategoria.textContent = "Crear categoría";
}

function editarCategoria(categoria) {
    if (categoriasEstado.cargando) return;
    categoriasEstado.editandoId = categoria.id;
    categoriasEstado.nuevoId = null;
    nombreCategoria.value = categoria.nombre;
    etiquetaCategoria.textContent = "Editar categoría";
    guardarCategoria.textContent = "Guardar cambios";
    nombreCategoria.focus();
}

function renderCategorias() {
    listaCategorias.replaceChildren();
    const termino = buscarCategorias.value.trim().toLocaleLowerCase("es");
    const visibles = categoriasEstado.registros.filter(function (categoria) {
        return categoria.nombre.toLocaleLowerCase("es").includes(termino);
    });
    visibles.forEach(function (categoria) {
        const fila = document.createElement("li");
        const nombre = document.createElement("span");
        nombre.textContent = categoria.nombre;
        const acciones = document.createElement("div");
        acciones.className = "categorias-acciones";
        const editar = document.createElement("button");
        editar.type = "button";
        editar.textContent = "Editar";
        editar.setAttribute("aria-label", "Editar " + categoria.nombre);
        editar.addEventListener("click", function () { editarCategoria(categoria); });
        const eliminar = document.createElement("button");
        eliminar.type = "button";
        eliminar.textContent = "Eliminar";
        eliminar.setAttribute("aria-label", "Eliminar " + categoria.nombre);
        eliminar.addEventListener("click", function () { eliminarCategoria(categoria); });
        acciones.append(editar, eliminar);
        fila.append(nombre, acciones);
        listaCategorias.appendChild(fila);
    });
    if (categoriasEstado.registros.length === 0) {
        mensajeCategorias.textContent = "No hay categorías registradas.";
    } else if (visibles.length === 0) {
        mensajeCategorias.textContent = "No hay categorías que coincidan con la búsqueda.";
    } else {
        mensajeCategorias.textContent = visibles.length + " categoría(s) encontrada(s).";
    }
}

async function cargarCategorias() {
    if (categoriasEstado.cargando) return;
    categoriasEstado.cargando = true;
    categoriasEstado.cargadas = false;
    bloquearCategorias(true);
    mensajeCategorias.textContent = "Cargando categorías…";
    mensajeCategorias.classList.remove("categorias-error");
    listaCategorias.replaceChildren();

    try {
        const registros = await api.listar("categorias");
        if (!Array.isArray(registros) || registros.some(function (categoria) {
            return !categoria || typeof categoria !== "object" ||
                !["string", "number"].includes(typeof categoria.id) ||
                String(categoria.id).trim() === "" ||
                (typeof categoria.id === "number" && !Number.isFinite(categoria.id)) ||
                typeof categoria.nombre !== "string" || categoria.nombre.trim() === "";
        })) {
            throw new Error("Las categorías recibidas no tienen un id y un nombre válidos.");
        }
        categoriasEstado.registros = registros;
        categoriasEstado.cargadas = true;
        renderCategorias();
    } catch (error) {
        categoriasEstado.registros = [];
        mensajeCategorias.classList.add("categorias-error");
        mensajeCategorias.textContent = "No se pudieron cargar las categorías. " + error.message;
    } finally {
        bloquearCategorias(false);
    }
}

async function guardarCategoriaFormulario(evento) {
    evento.preventDefault();
    if (categoriasEstado.cargando || !categoriasEstado.cargadas) return;
    const nombre = nombreCategoria.value.trim();
    if (!nombre) {
        mensajeCategorias.textContent = "Escribe el nombre de la categoría.";
        nombreCategoria.focus();
        return;
    }
    bloquearCategorias(true);
    mensajeCategorias.classList.remove("categorias-error");
    mensajeCategorias.textContent = "Guardando categoría…";
    try {
        const editando = categoriasEstado.editandoId !== null;
        // Se conserva el ID tras un error: reintentar no crea un registro con otro ID.
        if (!editando && categoriasEstado.nuevoId === null) {
            categoriasEstado.nuevoId = crypto.randomUUID();
        }
        const id = editando ? categoriasEstado.editandoId : categoriasEstado.nuevoId;
        const resultado = await api.guardar("categorias", editando ? "actualizar" : "crear", { id, nombre });
        if (!resultado || String(resultado.id) !== String(id) || resultado.nombre !== nombre) {
            throw new Error("La respuesta no confirma los datos enviados. Actualiza la lista antes de reintentar.");
        }
        categoriasEstado.registros = categoriasEstado.registros.filter(function (categoria) {
            return String(categoria.id) !== String(id);
        });
        categoriasEstado.registros.push(resultado);
        buscarCategorias.value = "";
        limpiarCategoria();
        renderCategorias();
        mensajeCategorias.textContent = "Categoría guardada correctamente.";
    } catch (error) {
        mensajeCategorias.classList.add("categorias-error");
        mensajeCategorias.textContent = "No se confirmó el guardado. " + error.message;
    } finally {
        bloquearCategorias(false);
    }
}

async function eliminarCategoria(categoria) {
    if (categoriasEstado.cargando || !categoriasEstado.cargadas) return;
    if (!window.confirm('¿Eliminar la categoría "' + categoria.nombre + '"?')) return;
    bloquearCategorias(true);
    mensajeCategorias.classList.remove("categorias-error");
    mensajeCategorias.textContent = "Eliminando categoría…";
    try {
        // El servicio comprueba los productos asociados dentro de su bloqueo.
        const resultado = await api.guardar("categorias", "eliminar", { id: categoria.id });
        if (!resultado || String(resultado.id) !== String(categoria.id)) {
            throw new Error("La respuesta no confirma la eliminación. Actualiza la lista.");
        }
        categoriasEstado.registros = categoriasEstado.registros.filter(function (registro) {
            return String(registro.id) !== String(categoria.id);
        });
        if (String(categoriasEstado.editandoId) === String(categoria.id)) limpiarCategoria();
        renderCategorias();
        mensajeCategorias.textContent = "Categoría eliminada correctamente.";
    } catch (error) {
        mensajeCategorias.classList.add("categorias-error");
        mensajeCategorias.textContent = "No se confirmó la eliminación. " + error.message;
    } finally {
        bloquearCategorias(false);
    }
}

formCategoria.addEventListener("submit", guardarCategoriaFormulario);
cancelarCategoria.addEventListener("click", function () {
    if (!categoriasEstado.cargando) limpiarCategoria();
});

botonCategorias.addEventListener("click", function () {
    panelCategorias.hidden = !panelCategorias.hidden;
    botonCategorias.setAttribute("aria-expanded", String(!panelCategorias.hidden));
    if (!panelCategorias.hidden) cargarCategorias();
});
recargarCategorias.addEventListener("click", cargarCategorias);
buscarCategorias.addEventListener("input", function () {
    if (categoriasEstado.cargadas && !categoriasEstado.cargando) renderCategorias();
});
