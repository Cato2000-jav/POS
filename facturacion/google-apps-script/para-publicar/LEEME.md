# Actualizar la implementación existente

Code.gs reúne el código original y las correcciones revisadas. Es una copia lista
para publicar, no otro servicio ni otra hoja. No se ha publicado automáticamente.

1. Abre la hoja y entra a Extensiones > Apps Script.
2. Guarda una copia del código actual fuera de ese proyecto por si necesitas restaurarlo.
3. Si el proyecto sigue teniendo el código original que compartiste, sustituye su
   contenido por Code.gs de esta carpeta. Si añadiste otras funciones después,
   consérvalas y reemplaza solamente las funciones coincidentes.
4. No pegues también los archivos .gs de la carpeta superior: son los fragmentos
   anteriores y producirían definiciones duplicadas. Cada función debe existir una vez.
5. Guarda. Ejecuta probarLectura para comprobar productos; esta prueba solo lee.
   No ejecutes probarCreacion salvo que quieras añadir una categoría de prueba.
6. Implementar > Gestionar implementaciones > selecciona la aplicación web existente
   > Editar (lápiz) > Versión: Nueva versión > Implementar.
7. Conserva la URL /exec y las opciones de acceso existentes. Guardar código sin
   actualizar la versión no actualiza el servicio publicado.
8. Abre Categorías en el POS y pulsa Actualizar lista. Esto comprueba GET, no demuestra
   por sí solo que las nuevas operaciones POST estén publicadas.

Esta versión añade actualización y eliminación de entidades maestras y valida
detalle JSON en ventas.itemsJson y compras.itemsJson. Las restricciones de eliminación
usan productos.categoriaId, compras.proveedorId y ventas.clienteId.
También valida nombre, precio, costo, stock inicial, seguimiento y categoría existente
al crear productos. La edición parcial valida el registro completo y rechaza cambios
de stock/seguimiento. La eliminación de productos revisa ventas abiertas con itemsJson;
un detalle abierto identifica cada producto mediante id. Las ventas cerradas no se editan.
Estas comprobaciones se ejecutan dentro del bloqueo de doPost.
Todavía faltan validaciones de las otras entidades, ventas abiertas/cierre, inventario y compras
coordinadas. No conectar el cierre de ventas ni compras a create genérico.

Al publicar, no se ejecutan automáticamente las funciones de prueba ni se migran datos.
Para restaurar el servicio anterior, selecciona su versión anterior en esa misma
implementación. Esto restaura código, no revierte registros que ya hayan sido escritos.

Referencia: https://developers.google.com/apps-script/concepts/deployments

## Actualización de productos pendiente de publicar
Si ya publicaste la versión anterior, vuelve a actualizar la implementación existente
con este Code.gs. Las funciones cambiadas son crearRegistro, actualizarRegistro y
eliminarRegistro; las nuevas son validarProducto y comprobarProductoSinVentasAbiertas.
No basta con actualizar los archivos HTML/JS locales. No se ha publicado esta revisión
automáticamente ni se han creado o eliminado registros reales para probarla.
