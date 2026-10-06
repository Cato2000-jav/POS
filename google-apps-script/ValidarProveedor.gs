// Se ejecuta antes de escribir y bajo el bloqueo de doPost.
function validarProveedor(datos) {
    if (typeof datos.nombre !== "string" || !datos.nombre.trim()) {
        throw new Error("El proveedor necesita un nombre.");
    }
    // Se admiten teléfonos numéricos antiguos; el formulario nuevo envía texto.
    if (datos.telefono !== undefined &&
        typeof datos.telefono !== "string" &&
        !(typeof datos.telefono === "number" && Number.isFinite(datos.telefono))) {
        throw new Error("El teléfono del proveedor no es válido.");
    }
    if (datos.correo !== undefined && (typeof datos.correo !== "string" ||
        (datos.correo !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)))) {
        throw new Error("El correo del proveedor no es válido.");
    }
}
