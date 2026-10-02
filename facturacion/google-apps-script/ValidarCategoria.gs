// Se ejecuta bajo el bloqueo de doPost, antes de escribir una categoría.
function validarCategoria(datos) {
    if (!datos || typeof datos.nombre !== "string" || !datos.nombre.trim()) {
        throw new Error("La categoría debe tener un nombre no vacío.");
    }
}
