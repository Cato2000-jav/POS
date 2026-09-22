# Contrato del servicio de Google Sheets

## Estado
api.js está configurado con la URL /exec proporcionada por el usuario.
Las pantallas todavía no cargan este archivo ni consultan el servicio.
Se verificaron consultas GET reales; las escrituras solo se prueban con simulaciones.
No se ha migrado el historial local ni publicado código en Apps Script.

## Contrato confirmado
- GET: ?resource=productos (también ventas, compras, categorias, proveedores, clientes).
- POST: el mismo parámetro resource en la URL y cuerpo JSON con action y data.
- El módulo conserva sus nombres listar/guardar y traduce crear, actualizar y eliminar
  a create, update y delete.
- Content-Type: text/plain;charset=UTF-8; Apps Script interpreta e.postData.contents.
- Respuesta correcta: {"success":true,"data":[]} para listados.
- Error: {"success":false,"message":"Descripción del error"}.
- No usar mode: "no-cors": necesitamos leer la respuesta.
- No existe acción cerrar ni solicitudId en los controladores recibidos.
  Se retiraron esas suposiciones del módulo; no hay protección de duplicados en servidor
  demostrada. LockService serializa escrituras, pero no deduplica solicitudes.

Ejemplo de cuerpo POST, solo ilustrativo:

```json
{"action":"create","data":{"nombre":"Papel"}}
```

## Controladores recibidos
El archivo completo confirma que doGet y doPost ya están separados correctamente.
El anidamiento aparente provenía del fragmento inicial. Controladores.gs es una
copia opcional con validación adicional de data, no una corrección necesaria de llaves.
Los auxiliares completos ya se revisaron: actualizarRegistro y eliminarRegistro
eran TODO. crearRegistro exige IDs del frontend y serializa objetos como JSON;
leerHoja devuelve esos campos como texto. Falta confirmar los encabezados.

## Actualización parcial preparada localmente
google-apps-script/ActualizarRegistro.gs sustituye únicamente el TODO de esa función.
No agregar una segunda definición en Apps Script. No se ha publicado el cambio.
Permite actualizar productos, categorias, proveedores y clientes por id; rechaza
campos sin columna y encabezados inválidos. Conserva campos omitidos, el id y las
fórmulas de celdas no editadas; null vacía una celda. Devuelve los valores guardados,
con JSON todavía en texto, igual que leerHoja. Reutiliza el bloqueo de doPost.
No habilita actualización genérica de ventas ni compras: sus reglas siguen pendientes.
Las validaciones por campo y las relaciones se incorporarán al confirmar el esquema.

## Eliminación preparada localmente
google-apps-script/EliminarRegistro.gs sustituye el TODO de eliminarRegistro y añade
comprobarSinAsociaciones. No se ha publicado ni ejecutado contra registros reales.
Usa las relaciones definidas en el MVP 2: productos.categoriaId,
compras.proveedorId y ventas.clienteId. Si la columna falta o está repetida, rechaza
la eliminación, incluso cuando la hoja dependiente no contiene registros.
Clientes asociados a cualquier venta, abierta o cerrada, quedan protegidos.
La comprobación y deleteRow se ejecutan dentro del bloqueo existente de doPost.
Permite eliminar productos, categorias, proveedores y clientes; ventas y compras
continúan bloqueadas. Una segunda eliminación del mismo ID devuelve un error y
no elimina otra fila. No actualiza inventario ni implementa reembolsos.
Pendiente verificar los encabezados reales antes de publicar y conectar la interfaz.

## Pendiente antes de conectar ventas e inventario
- Revisar auxiliares y encabezados de las seis hojas, tipos de IDs y números.
- Confirmar modelos: producto con categoriaId, precioVenta, costo, stock y
  seguimientoInventario; preservar imagen/descripcion y los detalles históricos.
- Verificar las restricciones de eliminación preparadas contra los encabezados reales.
  Validar relaciones también al crear/actualizar; acordar el borrado de ventas del MVP 1.
- Implementar ventas abiertas sin movimiento de stock; cierre con cliente para Debe,
  validación de existencias y conservación de precios históricos.
- Confirmar compra y stock/último costo de forma coordinada. Solo modificar stock
  para productos con seguimiento. Devolver registro y productos actualizados.
- Gestionar fallos parciales y duplicados en el servicio. Un bloqueo no vuelve
  transaccionales varias escrituras de Sheets ni revierte cambios anteriores.
- No reintentar POST automáticamente: una respuesta perdida no demuestra que no
  se haya guardado. Verificar el estado antes de repetir.
- En cada formulario, bloquear doble envío, deshabilitar botón, mostrar carga y usar
  try/catch/finally. Aplicar cambios locales solo tras confirmación.
- No usar localStorage ni productos hardcodeados como respaldo silencioso al activar
  la migración. La importación de registros existentes será una etapa separada.

Referencia: https://developers.google.com/apps-script/guides/web
