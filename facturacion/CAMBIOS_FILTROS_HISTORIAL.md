# Filtros de ventas y compras

## Alcance

Ventas: desde/hasta inclusivos, método de pago, cliente por nombre guardado o ID
(búsqueda parcial sin distinguir mayúsculas ni tildes) y estado. Se mantienen las
cerradas como selección inicial; Limpiar filtros muestra todos los estados.
Compras: desde/hasta y proveedor seleccionado del catálogo remoto, con ID como
alternativa si ya no aparece en el catálogo. Los filtros se combinan con AND.
No se agregó proveedor a ventas: ese dato pertenece a compras.

## Archivos y cambios

- `history-filters.js`: funciones pequeñas de comparación y enlace con formularios.
- `history-filters.css`: distribución responsive y campos acordes a la paleta actual.
- `Historial_de_ventas.html` y `compras.html`: controles etiquetados y contador accesible.
- `remote-history.js`: carga abiertas y cerradas, conservando la última lista válida
  si falla la API. Detecta duplicados entre ambos estados.
- `sales-data.js`: comparte la adaptación de presentación, conserva el estado y añade
  fecha de comparación de Bogotá; `adaptarVentaCerrada` sigue rechazando abiertas.
- `Historial_de_ventas.js`: filtra sin alterar la fuente, muestra cliente/estado y
  distingue detalle abierto de factura. Oculta Imprimir para abiertas y también
  bloquea una llamada directa al manejador de impresión.
- `purchases.js`: filtra la lista, conserva la selección de proveedor al actualizar y
  oculta el detalle anterior al cambiar los resultados para evitar confusión.

## Antes y después: consulta de ventas

Antes (`remote-history.js`):
```js
const cerradas = ventas.filter(v => v.estado === "cerrada");
const registros = cerradas.sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).map(adaptarVentaCerrada);
```
Ahora:
```js
const registros = [...ventas].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).map(adaptarVentaHistorial);
```
Motivo: el filtro de estado necesita que ambas clases de ventas estén disponibles.
La selección inicial de cerradas conserva la vista habitual, pero no limita la carga.

## Antes y después: renderizado

Antes se recorría directamente la lista completa. Ahora se filtra una copia:
```js
const filtros = leerFiltrosHistorial("filtrosCompras");
const registros = filtrarHistorial(comprasEstado.registros, filtros);
```
Se aplica el mismo patrón en ventas. Los detalles siguen consultando la fuente
completa por ID. Cambiar filtros no llama a fetch ni escribe localStorage o Sheets.

## Funciones nuevas y sustentación

| Función | Recibe | Devuelve | Conexión y necesidad |
| --- | --- | --- | --- |
| fechaParaFiltro | Registro | Fecha YYYY-MM-DD o vacío | Compara fechas sin ordenar textos como día/mes/año; contempla archivo antiguo |
| filtrarHistorial | Registros y filtros | Nueva lista filtrada | Reutilizada por ventas y compras; no altera los registros originales |
| leerFiltrosHistorial | Prefijo de IDs | Objeto con valores de controles | Separa lectura de interfaz de las comparaciones |
| prepararFiltrosHistorial | Prefijo y función de renderizado | undefined | Escucha cambios y limpieza; evita navegación por submit |
| adaptarVentaHistorial | Venta remota | Registro adaptado o error | Presenta abiertas sin exigir efectivo cobrado ni afirmar que están cerradas |

Preguntas posibles:
- ¿Por qué combinar con AND? Cada resultado debe satisfacer todos los filtros activos.
- ¿Por qué Bogotá? Un instante UTC puede pertenecer al día anterior en Colombia.
- ¿Por qué no se busca el nombre actual para sustituir el histórico? La venta debe
  conservar los datos guardados; un cambio posterior del cliente no los reescribe.
- ¿Por qué proteger Imprimir además de ocultar el botón? La regla también debe
  cumplirse al invocar directamente el manejador.
- ¿Por qué esperar al reset? El navegador restaura controles al completar el evento;
  después se vacían los filtros y se vuelve a renderizar.

## Casos especiales y pruebas

Rango invertido: mensaje claro y cero resultados. Campos vacíos: sin esa restricción.
Sin coincidencias: mensaje distinto de una fuente vacía. Archivo MVP1 sin estado:
se trata como cerrado; sin cliente guardado no coincide con búsquedas de cliente.
Abiertas: etiqueta explícita de que no es factura, sin imprimir/PDF definitivo.
El filtro no transforma ni corrige los registros históricos.

Pruebas automatizadas: combinaciones, límites inclusivos, zona Bogotá cerca de
medianoche, acentos, IDs, proveedor, resultados vacíos, reset, conservación de listas,
errores de API y bloqueo de impresión de abiertas. Son pruebas locales simuladas;
queda por verificar visualmente en el navegador del usuario y a distintos anchos.
No se modificó Apps Script ni se hicieron escrituras en Sheets.

## Corrección: registros incompletos no bloquean toda la tabla

Archivo: `remote-history.js`, carga y nueva función `revisarVentasHistorial`.
Problema: una excepción dentro de `map(adaptarVentaHistorial)` impedía mostrar
también las ventas válidas del mismo lote.

Antes:
```js
const registros = [...ventas].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).map(adaptarVentaHistorial);
```
Ahora:
```js
const {registros, incidencias} = revisarVentasHistorial(ventas);
historialConsulta.registros = registros;
historialConsulta.incidencias = incidencias;
```

La nueva función recibe la lista remota y devuelve dos listas: ventas válidas
adaptadas e incidencias con referencia y motivo. Valida cada registro por separado.
Excluye todas las coincidencias de un ID duplicado, no elige arbitrariamente una.
Conserva el orden cronológico descendente por fecha/hora original. No escribe datos.
`mostrarIncidenciasHistorial` no recibe argumentos ni devuelve datos: lee ese estado
y presenta mensajes con `textContent` dentro de «Registros por revisar».

`sales-data.js` ahora explica si falta fecha, subtotal, IVA o total, manteniendo
la validación estricta de comprobantes. El HTML añade un panel plegable. Los
registros excluidos no participan en filtros, contadores, detalles ni impresión.
Si todos son inválidos se muestra una tabla vacía con aviso de incidencias, no un
error de conexión. Si falla la API se conserva la última carga y sus incidencias.

Pregunta de sustentación: ¿por qué separar el fallo de un registro del fallo de red?
La red fallida impide conocer el lote actual; un registro inválido dentro de una
respuesta recibida no invalida los otros registros que sí superan las comprobaciones.

Prueba de regresión: cinco abiertas sin fecha/importes más dos cerradas válidas
producen dos filas utilizables y cinco incidencias. También se comprueban duplicados,
registros nulos, lote totalmente inválido, cambio de fuente, limpieza de avisos y
conservación ante errores de API. Pasan los 25 archivos de pruebas locales.

## Ajuste visual posterior

Archivo: `history-filters.css`, controles del formulario y panel de incidencias.
Problema observado en captura: Limpiar filtros conservaba el estilo nativo porque
las reglas compartidas no incluían ese botón en la página de ventas.
Antes no tenía regla específica; ahora:

```css
.historial-filtros button[type="reset"] {
    min-height: 44px;
    padding: 11px 16px;
    border: 1px solid var(--ui-borde, #e3deef);
    border-radius: 11px;
    background: #f6f3ff;
    color: #4d319f;
    font-weight: 650;
    cursor: pointer;
    white-space: normal;
}
```

Se añaden hover y foco visible, altura mínima para campos y ajuste de línea para
IDs largos en las incidencias. Se conserva la media query de una columna en móvil.
Las dos páginas incrementan la versión del enlace CSS para evitar estilos antiguos.
No hay funciones nuevas, entradas ni retornos: los selectores limitan el cambio a
los filtros y sus avisos. Pregunta de sustentación: ¿por qué una regla específica?
Para estilizar estos controles sin alterar los otros botones del POS.
Pendiente comprobación visual mediante captura del navegador del usuario.
