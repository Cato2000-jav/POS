# Presentación compartida de Papel y Luna

Se conserva el morado #6847c7, los fondos claros, las esquinas redondeadas y los
archivos CSS existentes. No se reorganiza la aplicación ni se modifica Code.gs.

## ARCHIVO NUEVO: ui-theme.css
UBICACIÓN: estilos compartidos cargados al final del head en index.html, compras.html
y Historial_de_ventas.html. No existía esta capa antes.
PROBLEMA: los módulos nuevos tenían botones/formularios y avisos con estilos distintos.
SOLUCIÓN: ajustes acotados a paneles, formularios, compras y controles del historial;
botones primarios morados, secundarios suaves y eliminación en rojo. Campos y estados
con foco visible, contraste y ajuste de palabras largas. Se conserva el scroll de tablas.
Incluye diálogos, avisos flotantes, animación de entrada/salida y carga. En móvil los
botones se adaptan y los diálogos no superan el alto/ancho disponible. La preferencia
prefers-reduced-motion desactiva animaciones. Avisos/diálogos no se incluyen al imprimir.

## ARCHIVO NUEVO: ui-feedback.js
UBICACIÓN: notificarUI(mensaje, tipo).
Recibe texto y tipo success/error/warning/info. No devuelve datos; crea un aviso
seguro con textContent, icono, botón de cierre, rol accesible y temporizador propio.
Conserva como máximo tres avisos visibles. El temporizador se pausa con foco o ratón
encima. Los errores duran más. Los colores no son la única señal: hay iconos y texto.
No llama a la API ni escribe almacenamiento.

UBICACIÓN: confirmarAccion(mensaje, opciones).
Recibe texto y opciones {titulo, aceptar, peligro, soloLectura}; devuelve Promise<boolean>.
Usa dialog.showModal para bloquear el fondo y gestionar el foco del diálogo nativo.
Cancelar y Escape devuelven false; aceptar devuelve true. El foco inicial va a Cancelar
en acciones mutables y regresa al control anterior al cerrar. Solo permite un diálogo
a la vez. Si no puede abrirlo, devuelve false y no ejecuta la acción.
soloLectura permite mostrar el detalle de factura con un botón Cerrar, sin alert nativo.

UBICACIÓN: prepararMensajesUI().
Se ejecuta con DOMContentLoaded; no recibe ni devuelve datos. Observa cambios de texto
en los mensajes de estado existentes y les asigna un tipo visual. No modifica sus textos,
validaciones ni resultados. La clasificación es visual (según palabras), no determina
si una operación fue confirmada por la API. Los mensajes siguen junto a cada formulario.

## ARCHIVOS: app.js y Historial_de_ventas.js
PROBLEMA: avisos temporales distintos y detalle con alert sin CSS.
SOLUCIÓN: mantener los nombres públicos y delegar presentación.
CÓDIGO ANTERIOR, fragmento:
```js
toast.textContent = mensaje;
toast.className = `toast visible ${tipo}`;
```
CÓDIGO CORREGIDO:
```js
const mostrarToast = (mensaje, tipo = "success") => notificarUI(mensaje, tipo);
const mostrarNotificacion = mensaje => notificarUI(mensaje, "info");
```
El detalle antes llamaba window.alert(texto); ahora llama confirmarAccion(texto,
{titulo:"Detalle de la factura", aceptar:"Cerrar", soloLectura:true}). No cambia la factura.

## ARCHIVOS: categories.js, suppliers.js, customers.js y product-form.js
UBICACIÓN: funciones eliminar existentes.
PROBLEMA: confirm nativo no admite CSS.
CÓDIGO ANTERIOR, ejemplo de proveedor:
```js
if (!window.confirm(`¿Eliminar el proveedor «${proveedor.nombre}»?`)) return;
```
CÓDIGO CORREGIDO:
```js
if (!await confirmarAccion(
    `¿Eliminar el proveedor «${proveedor.nombre}»? No se eliminará si tiene compras asociadas.`,
    {peligro: true}
)) return;
if (proveedoresEstado.ocupado) return;
```
Las otras eliminaciones usan el mismo patrón y conservan el nombre del registro.
Se repite la comprobación de ocupado después del await para impedir dos escrituras
concurrentes. Las restricciones de categoría/productos, proveedor/compras y cliente/
ventas siguen en el servicio; el diálogo no las sustituye ni promete eliminar algo asociado.

## Confirmaciones de descarte y migración
abrirProducto y retomarVentaAbierta esperan confirmarAccion en lugar de window.confirm.
iniciarFactura y cancelarFactura pasan a async para esperar la elección del usuario.
importarVentaAnterior también espera el diálogo, conserva los datos mostrados y vuelve
a comprobar ocupado/pendiente después del await. Sus reglas de importación no cambian.
Los scripts modificados tienen nueva versión de caché en las páginas que los cargan.

## Preguntas para sustentación
¿Por qué cambiar JavaScript si pedimos CSS? alert/confirm son ventanas del navegador;
para aplicar CSS se necesita un diálogo dentro de la página.
¿Por qué await? El diálogo personalizado no bloquea JavaScript; la promesa permite
esperar la respuesta antes de enviar una eliminación.
¿Cómo se protege contra doble clic? Un único diálogo activo y comprobaciones de ocupado
antes y después de la confirmación, además de los bloqueos de petición existentes.
¿Por qué textContent? Nombres de productos/clientes se muestran como texto, no HTML.
¿Qué recibe/devuelve el CSS? No procesa datos de negocio: aplica estilos según clases
y atributos de los elementos creados por ui-feedback.js.

## Verificación
Pasan los 23 archivos de pruebas locales, incluido ui-feedback.test.cjs para diálogo
único, Escape/cancelación, aceptación, foco, detalle de lectura, texto seguro y avisos
cerrables. Las pruebas CRUD/migración se adaptaron al contrato asíncrono del diálogo.
git diff --check sin errores. No se eliminaron ni importaron registros reales.
La revisión visual en el navegador del usuario sigue pendiente: el acceso automatizado
a file:// está bloqueado. No se intentó eludir esa restricción. Solicitar capturas del
resultado para ajustar detalles visuales que las pruebas DOM simuladas no verifican.
