/* Convierte un dato en texto seguro para plantillas HTML y atributos entre comillas.
   Se usa al mostrar datos, nunca al guardarlos ni para escapar una plantilla completa.
   No valida URLs, código JavaScript ni selectores CSS. */
const escaparHTML = (valor) => {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
};
