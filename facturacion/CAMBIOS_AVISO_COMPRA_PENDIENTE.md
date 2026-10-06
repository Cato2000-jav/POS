# Compras pendientes ya registradas — 6 de octubre de 2026

## Archivo y ubicación

`purchases.js`: nueva función `problemaCompraPendiente`; ajustes en
`bloquearCompra`, `cargarCompras` y `guardarCompraFormulario`.
`compras.html`: versión del enlace al script para actualizar la caché.

## Problema

El formulario recomendaba reintentar incluso cuando la lectura de Sheets ya
mostraba el mismo ID con detalle histórico incompleto. Ese reintento devolvía
el registro antiguo, que no supera la validación estricta de una confirmación
nueva. También faltaba avisar antes del POST si el ID tenía datos diferentes.

## Solución

Comparar el borrador con los registros cargados. En esos dos casos, mostrar el
ID y la causa, deshabilitar Reintentar y proteger también el manejador de envío.
No se elimina el borrador automáticamente ni se presume que el inventario antiguo
se actualizó. La revisión del registro sigue siendo necesaria para desbloquearlo.
Si no hay coincidencia o el registro moderno coincide completamente, se conserva
el reintento idempotente existente. Esta protección usa la última lectura válida;
no sustituye la validación del servidor ni constituye una consulta en tiempo real.

## Código anterior

```js
compraElemento("reintentarCompra").disabled = ocupado;
```

## Código corregido

```js
compraElemento("reintentarCompra").disabled = ocupado || !!problemaCompraPendiente();
```

Al principio del manejador, después de verificar que no esté ocupado o bloqueado:

```js
const problemaPendiente = problemaCompraPendiente();
if (problemaPendiente) {
    avisarCompra(problemaPendiente);
    bloquearCompra(false);
    return;
}
```

## Explicación para sustentación

1. Qué hace: identifica un borrador cuyo registro remoto cargado tiene contenido
   diferente o detalle histórico incompleto.
2. Por qué: evita recomendar una operación que no resuelve ese estado.
3. Entrada: no recibe argumentos; lee `comprasEstado.pendiente` y `registros`.
4. Salida: mensaje de revisión o cadena vacía si no detecta esos problemas.
5. Conexión: reutiliza `mismaCompra`; se consulta al cargar, habilitar botones y
   enviar. No hace fetch, no escribe localStorage y no toca Sheets.
6. Pregunta del profesor: ¿por qué bloquear el manejador además del botón?
   Porque una llamada al manejador no necesariamente proviene de un clic; la
   condición de protección también debe estar en el flujo de la operación.

## Pruebas

Los 23 archivos de pruebas locales pasan. Se agregaron casos de borrador antiguo
coincidente (cero POST y borrador intacto), mismo ID con contenido diferente
(cero POST) y registro moderno coincidente (reintento permitido). Se mantienen
las pruebas de doble envío, errores y recuperación. No se hicieron llamadas a
Sheets ni pruebas visuales en esta etapa. No hace falta publicar Apps Script.
