# Backend de Papel y Luna

Consulta el [README principal](../README.md) para instalación, usuarios de
prueba, migración, reglas de negocio y despliegue.

El backend utiliza Django 5.2, Django REST Framework, sesiones y CSRF.
SQLite con transacciones IMMEDIATE permite la demostración local; PostgreSQL
se configura por variables de entorno para el despliegue.

## Contrato REST

- `/api/auth/csrf/`: GET token de CSRF.
- `/api/auth/login/`: POST usuario y contraseña; devuelve usuario y token renovado.
- `/api/auth/sesion/`: GET identidad de la sesión.
- `/api/auth/logout/`: POST cierre de sesión.
- `/api/productos/`, `/api/categorias/`, `/api/proveedores/`, `/api/clientes/`,
  `/api/descuentos/`: GET lista, POST creación. Rutas `/<id>/`: GET, PUT, PATCH, DELETE.
- `/api/productos/<id>/desde-venta/`: PATCH de nombre, categoría, precio y costo.
- `/api/ventas/`: GET y POST de venta abierta.
- `/api/ventas/<id>/`: GET y PUT/PATCH de venta abierta con `actualizadoEn`.
- `/api/ventas/<id>/cerrar/`: POST con versión y `valorRecibido`.
- `/api/ventas/<id>/corregir/`: POST administrativo con versión, productos y pago.
- `/api/compras/`: GET y POST; `/api/compras/<id>/`: GET detalle.
- `/api/reembolsos/`: GET y POST administrativo.
- `/api/faltantes/`: GET y POST; `/api/faltantes/<id>/`: GET y PATCH estado.
- `/api/faltantes/proveedores/`: GET únicamente ID/nombre para el selector.
- `/api/reportes/?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`: GET administrativo.

Todas las escrituras necesitan sesión y la cabecera `X-CSRFToken`. Las
operaciones transaccionales necesitan `Idempotency-Key`: conservarla junto
con el mismo cuerpo al reintentar. Un ID reutilizado con datos diferentes
produce 409. Los registros de operaciones guardan recibos de respuesta; las
líneas de venta y compra se almacenan en tablas relacionales.

Los permisos se comprueban antes de las operaciones. Los cálculos y el usuario
responsable se determinan en el servidor, no se confía en los totales ni en
`persona` enviados desde el formulario.

## Operaciones atómicas

`services.py` bloquea la fila de coordinación, consulta y valida los productos,
guarda cabecera/detalles y aplica inventario dentro de una transacción. Un error
revierte todos los cambios. PostgreSQL permite bloquear filas; SQLite utiliza
transacciones IMMEDIATE para serializar escritores. Las pruebas locales no
sustituyen una validación de concurrencia en el alojamiento PostgreSQL final.

No hay un borrado de ventas/compras. El modelo protege sus relaciones y conserva
copias históricas de nombres, precios y descuentos.
