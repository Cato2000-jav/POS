# Verificación del MVP 3

Comprobaciones ejecutadas sobre bases temporales y usuarios ficticios; no se
modificaron los datos del Google Sheets original.

| Comprobación | Resultado |
|---|---|
| Pruebas automatizadas Django | 57 aprobadas |
| Archivos de pruebas JavaScript (`node --test`) | 26 aprobados |
| `manage.py check` | Sin incidencias |
| `makemigrations --check --dry-run` | Sin cambios pendientes |
| Gunicorn `--check-config` | Correcto |
| Sintaxis JS y conflictos Git | Sin marcadores de conflicto; scripts nuevos comprobados |
| Login y sesión en Chromium | Correcto |
| Descuento y venta con pago Debe | Correcto; cliente obligatorio probado en backend |
| Guardar abierta, recargar, retomar y cerrar | Correcto; stock solo cambia al cierre |
| Corrección y reembolso parcial desde interfaz | Correcto; importes y stock comprobados |
| Faltante, resolución, reporte y compra desde interfaz | Correcto |
| Historial y permisos de cajero | Correcto |
| Factura PDF | Generada con descuento, corrección y reembolso visibles |
| Interfaz de gestión e historial a 390 px | Sin desbordamiento horizontal de la página |
| Dos cierres simultáneos para una unidad en SQLite | Solo uno confirmado; stock final 0 |
| Importación de respaldo de prueba | Validación revierte; aplicación conserva stock; duplicado rechazado |

## Pendiente fuera del entorno local

- Crear alojamiento y PostgreSQL: el usuario confirmó que todavía no dispone de ellos.
- Configurar dominios, secretos privados, HTTPS y usuarios definitivos.
- Ejecutar las pruebas contra PostgreSQL y verificar concurrencia en el despliegue.
- Revisar/importar el respaldo real, si se desea conservar los datos anteriores.
- Agregar apellidos del equipo al nombre definitivo del ZIP y registrar sus commits.

No se ha declarado como completada la publicación en Internet.
