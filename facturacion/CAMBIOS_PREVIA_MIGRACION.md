# Etapa: revisión previa del archivo MVP 1 (solo lectura)

ARCHIVO: Historial_de_ventas.html. UBICACIÓN: controles del historial.
PROBLEMA: se podía consultar el archivo anterior, pero no revisar su aptitud para migrar.
SOLUCIÓN: sección desplegable Revisar historial anterior antes de migrarlo.
CÓDIGO ANTERIOR: no existía este control.
CÓDIGO AÑADIDO, fragmento:
```html
<button id="revisarMigracion" type="button">Preparar vista previa</button>
<p id="estadoMigracion" role="status" aria-live="polite"></p>
<ul id="listaMigracion"></ul>
```
El script nuevo se carga después de Historial_de_ventas.js y reutiliza
leerHistorialAnterior, que lee papelYLunaHistorial sin sobrescribirlo.

ARCHIVO: migration-preview.js (nuevo).
UBICACIÓN: analizarHistorialAnterior(locales, remotas).
PROBLEMA: una importación indiscriminada podría duplicar registros o inventar datos.
SOLUCIÓN: función pura que recibe las dos listas y devuelve un informe por registro:
{fila, id, estado, notas}. No modifica entradas ni realiza llamadas al servicio.
Comprueba nombre del trabajador, fecha/hora presentes, método de pago, detalle,
cantidades, importes, subtotal/IVA/total y efectivo/cambio cuando corresponda.
Compara IDs y alerta también si coincide contenido con una venta cerrada remota.
La comparación de importes admite un centavo de diferencia para la revisión, sin
redondear ni modificar los valores originales. No es la validación final de importación.

CÓDIGO NUEVO, uso central:
```js
const anteriores = leerHistorialAnterior();
const remotas = await api.listar("ventas");
const informe = analizarHistorialAnterior(anteriores, remotas);
```
No convierte fechas locales todavía ni resuelve IDs antiguos de productos/clientes.
Un candidato significa que pasó esta revisión básica, no que ya esté listo para importar.
Coincidencia de contenido no demuestra duplicación: ventas distintas pueden ser iguales.
Si hay problemas y coincidencias, el estado prioriza corrección y las notas muestran ambos.

UBICACIÓN: prepararVistaMigracion().
No recibe datos; devuelve Promise<void>. Lee el archivo y hace GET de ventas con api.js;
renderiza el informe con textContent. Deshabilita el botón durante la consulta y usa
try/catch/finally para informar errores y habilitarlo de nuevo. No tiene POST ni DELETE.
Sin archivo local evita incluso la consulta y explica que otro origen puede tener datos.
Si falla la API, no afirma que no haya duplicados ni conserva una vista previa obsoleta.

ARCHIVO: historial.css.
Regla nueva #listaMigracion li aplica ajuste de palabras largas y margen. No modifica
las reglas de las tablas ni el diseño de facturación. Se incrementó la versión de CSS.

## Preguntas para sustentación
¿Por qué no usar cerrarVenta para importar? Una venta histórica ya ocurrió y cerrar
de nuevo descontaría inventario. La importación necesitará una operación independiente
que conserve sus snapshots sin movimientos de stock.
¿Por qué comparar también con Sheets? Para señalar registros que podrían haberse
importado antes. La futura escritura también deberá comprobarlo en el servidor.
¿Por qué un archivo vacío no prueba ausencia de ventas? El almacenamiento pertenece al
navegador/origen; abrir el proyecto como archivo y por HTTP puede acceder a datos distintos.
¿Se inventa el efectivo faltante? No; se marca el registro para revisión.

## Pruebas y pendientes
Pasan 20 archivos de pruebas locales. migration-preview.test.cjs cubre candidatos,
IDs duplicados, coincidencia de contenido, datos inválidos, efectivo, doble consulta,
fallo de API, archivo vacío/corrupto e inmutabilidad de entradas. Solo APIs simuladas.
No se realizó verificación visual de este desplegable ni importación real en esta etapa.
No hay cambios en Code.gs. La migración sigue pendiente: falta definir conversión de
fecha/hora, relaciones históricas, operación de importación idempotente y confirmación.
