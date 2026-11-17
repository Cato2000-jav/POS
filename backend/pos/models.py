"""Modelos de datos del POS. Las tablas se crearán mediante migraciones."""

import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Categoria(models.Model):
    """Clasifica los productos mediante un nombre y un identificador estable."""

    # Texto para conservar los IDs existentes al migrar desde Google Sheets.
    # Los registros nuevos reciben un UUID si no se proporciona un ID.
    id = models.CharField(
        max_length=255,
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    nombre = models.CharField(max_length=150)

    class Meta:
        db_table = "categorias"
        ordering = ["nombre", "id"]
        verbose_name = "categoría"
        verbose_name_plural = "categorías"

    def __str__(self):
        """Devuelve el nombre legible para el administrador y la consola."""
        return self.nombre


class Producto(models.Model):
    """Producto del catálogo con categoría, importes y control de stock."""

    id = models.CharField(
        max_length=255,
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    codigo = models.CharField(max_length=100, blank=True, default="")
    nombre = models.CharField(max_length=150)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name="productos",
        db_column="categoriaId",
    )

    # La guía P2.2 define los importes en pesos enteros, sin decimales.
    precio = models.PositiveBigIntegerField()
    costo = models.PositiveBigIntegerField()
    seguimientoInventario = models.BooleanField()
    stock = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "productos"
        ordering = ["nombre", "id"]
        verbose_name = "producto"
        verbose_name_plural = "productos"

    def __str__(self):
        """Devuelve el nombre del producto para mostrarlo de forma legible."""
        return self.nombre


class Proveedor(models.Model):
    """Proveedor de mercancía y sus datos de contacto."""

    id = models.CharField(
        max_length=255,
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    nombre = models.CharField(max_length=150)
    # Texto para conservar prefijos, signos y ceros iniciales del teléfono.
    telefono = models.CharField(max_length=50, blank=True, default="")
    correo = models.EmailField(max_length=254, blank=True, default="")

    class Meta:
        db_table = "proveedores"
        ordering = ["nombre", "id"]
        verbose_name = "proveedor"
        verbose_name_plural = "proveedores"

    def __str__(self):
        """Devuelve el nombre del proveedor para el administrador y la consola."""
        return self.nombre


class Cliente(models.Model):
    """Cliente que puede asociarse a una venta; no es un usuario del sistema."""

    id = models.CharField(
        max_length=255,
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    nombre = models.CharField(max_length=150)
    # Los datos de contacto son opcionales, como en el formulario actual.
    telefono = models.CharField(max_length=50, blank=True, default="")
    correo = models.EmailField(max_length=254, blank=True, default="")

    class Meta:
        db_table = "clientes"
        ordering = ["nombre", "id"]
        verbose_name = "cliente"
        verbose_name_plural = "clientes"

    def __str__(self):
        """Devuelve el nombre del cliente para el administrador y la consola."""
        return self.nombre


class Compra(models.Model):
    """Datos generales de una compra; sus productos tendrán un detalle separado."""

    id = models.CharField(
        max_length=255,
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name="compras",
        db_column="proveedorId",
    )
    # Conserva el día seleccionado en el formulario, sin inventar una hora.
    fecha = models.DateField()
    # El servicio de compras calculará este importe desde sus detalles.
    total = models.PositiveBigIntegerField()

    class Meta:
        db_table = "compras"
        ordering = ["-fecha", "id"]
        verbose_name = "compra"
        verbose_name_plural = "compras"

    def __str__(self):
        """Identifica la compra sin consultar los datos de su proveedor."""
        return f"Compra {self.id}"


class DetalleCompra(models.Model):
    """Artículo comprado con los datos históricos de esa operación."""

    compra = models.ForeignKey(
        Compra,
        on_delete=models.PROTECT,
        related_name="detalles",
        db_column="compraId",
    )
    # Si el producto se elimina del catálogo, el detalle histórico permanece.
    producto = models.ForeignKey(
        Producto,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="detalles_compra",
        db_column="productoId",
    )
    # Copias históricas: el servicio de compras las completará al guardar.
    productoIdHistorico = models.CharField(max_length=255)
    nombre = models.CharField(max_length=150)
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    costo = models.PositiveBigIntegerField()
    subtotal = models.PositiveBigIntegerField()

    class Meta:
        db_table = "detalles_compra"
        ordering = ["id"]
        verbose_name = "detalle de compra"
        verbose_name_plural = "detalles de compra"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cantidad__gte=1),
                name="detalle_compra_cantidad_positiva",
            ),
            models.CheckConstraint(
                condition=models.Q(subtotal=models.F("cantidad") * models.F("costo")),
                name="detalle_compra_subtotal_correcto",
            ),
        ]

    def __str__(self):
        """Describe el artículo sin depender del nombre actual del catálogo."""
        return f"{self.nombre}: {self.cantidad} × {self.costo}"


class Venta(models.Model):
    """Datos generales de una venta abierta o cerrada, sin modificar stock."""

    ESTADOS = [("abierta", "Abierta"), ("cerrada", "Cerrada")]

    id = models.CharField(
        max_length=255, primary_key=True, default=uuid.uuid4, editable=False,
    )
    fecha = models.DateTimeField(default=timezone.now)
    estado = models.CharField(max_length=10, choices=ESTADOS, default="abierta")
    cliente = models.ForeignKey(
        Cliente, on_delete=models.PROTECT, null=True, blank=True,
        related_name="ventas", db_column="clienteId",
    )
    clienteNombre = models.CharField(max_length=150, blank=True, default="")
    # Los registros antiguos pueden no tener un usuario autenticado asociado.
    # En ventas nuevas, el servicio asignará el usuario desde la sesión.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        null=True, blank=True, related_name="ventas_pos", db_column="usuarioId",
    )
    persona = models.CharField(max_length=150, blank=True, default="")

    # Una venta admite una sola promoción del catálogo, o ninguna.
    descuento = models.ForeignKey(
        "Descuento", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ventas", db_column="descuentoId",
    )
    # El servicio copiará estos datos al aplicar el descuento. No se recalculan
    # desde el catálogo al consultar una venta cerrada.
    descuentoIdHistorico = models.CharField(max_length=255, blank=True, default="")
    descuentoNombre = models.CharField(max_length=150, blank=True, default="")
    descuentoTipo = models.CharField(max_length=10, blank=True, default="")
    descuentoValor = models.PositiveBigIntegerField(default=0)
    descuentoMonto = models.PositiveBigIntegerField(default=0)

    # Se conserva como texto para leer métodos históricos como Tarjeta débito.
    # La API validará Efectivo, Nequi o Debe para las nuevas operaciones.
    metodoPago = models.CharField(max_length=30, blank=True, default="")
    subtotal = models.PositiveBigIntegerField(default=0)
    iva = models.PositiveBigIntegerField(default=0)
    total = models.PositiveBigIntegerField(default=0)
    valorRecibido = models.PositiveBigIntegerField(default=0)
    cambio = models.PositiveBigIntegerField(default=0)
    actualizadoEn = models.DateTimeField(default=timezone.now)

    # Identifica la última corrección de una venta cerrada, conservando su ID.
    corregida = models.BooleanField(default=False)
    corregidaEn = models.DateTimeField(null=True, blank=True)
    corregidaPor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ventas_corregidas",
        db_column="corregidaPorId",
    )

    class Meta:
        db_table = "ventas"
        ordering = ["-fecha", "id"]
        verbose_name = "venta"
        verbose_name_plural = "ventas"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(estado__in=["abierta", "cerrada"]),
                name="venta_estado_valido",
            ),
            models.CheckConstraint(
                condition=~models.Q(metodoPago="Debe") | models.Q(cliente__isnull=False),
                name="venta_debe_requiere_cliente",
            ),
            models.CheckConstraint(
                condition=~models.Q(estado="cerrada") | ~models.Q(metodoPago=""),
                name="venta_cerrada_requiere_pago",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        corregida=False,
                        corregidaEn__isnull=True,
                        corregidaPor__isnull=True,
                    )
                    | models.Q(
                        corregida=True,
                        estado="cerrada",
                        corregidaEn__isnull=False,
                        corregidaPor__isnull=False,
                    )
                ),
                name="venta_correccion_coherente",
            ),
        ]

    def __str__(self):
        """Identifica la venta y su estado sin consultar otras tablas."""
        return f"Venta {self.id} ({self.estado})"


class DetalleVenta(models.Model):
    """Artículo de una venta con nombre e importes propios de la operación."""

    venta = models.ForeignKey(
        Venta,
        on_delete=models.PROTECT,
        related_name="detalles",
        db_column="ventaId",
    )
    # Conserva el historial si se elimina un producto del catálogo.
    # El servicio impedirá eliminar productos presentes en ventas abiertas.
    producto = models.ForeignKey(
        Producto,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="detalles_venta",
        db_column="productoId",
    )
    productoIdHistorico = models.CharField(max_length=255)
    nombre = models.CharField(max_length=150)
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    precio = models.PositiveBigIntegerField()
    # No inventar costos para ventas antiguas que no guardaron este dato.
    costo = models.PositiveBigIntegerField(null=True, blank=True)
    subtotal = models.PositiveBigIntegerField()
    # Copia del movimiento real al cerrar; None indica un histórico sin evidencia.
    inventarioAplicado = models.BooleanField(default=False, null=True, blank=True)

    class Meta:
        db_table = "detalles_venta"
        ordering = ["id"]
        verbose_name = "detalle de venta"
        verbose_name_plural = "detalles de venta"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cantidad__gte=1),
                name="detalle_venta_cantidad_positiva",
            ),
            models.CheckConstraint(
                condition=models.Q(subtotal=models.F("cantidad") * models.F("precio")),
                name="detalle_venta_subtotal_correcto",
            ),
        ]

    def __str__(self):
        """Describe el artículo usando el precio guardado en la venta."""
        return f"{self.nombre}: {self.cantidad} × {self.precio}"


class Descuento(models.Model):
    """Promoción reutilizable que se aplicará al total de una venta."""

    TIPOS = [("porcentaje", "Porcentaje"), ("fijo", "Valor fijo")]

    id = models.CharField(
        max_length=255, primary_key=True, default=uuid.uuid4, editable=False,
    )
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=10, choices=TIPOS)
    # Porcentajes enteros (por ejemplo, 10) o pesos enteros (por ejemplo, 2000).
    valor = models.PositiveBigIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        db_table = "descuentos"
        ordering = ["nombre", "id"]
        verbose_name = "descuento"
        verbose_name_plural = "descuentos"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(tipo__in=["porcentaje", "fijo"]),
                name="descuento_tipo_valido",
            ),
            models.CheckConstraint(
                condition=models.Q(valor__gte=1),
                name="descuento_valor_positivo",
            ),
            models.CheckConstraint(
                condition=~models.Q(tipo="porcentaje") | models.Q(valor__lte=100),
                name="descuento_porcentaje_maximo",
            ),
        ]

    def __str__(self):
        """Muestra el nombre y distingue porcentajes de importes fijos."""
        unidad = "%" if self.tipo == "porcentaje" else "pesos"
        return f"{self.nombre}: {self.valor} {unidad}"


class Faltante(models.Model):
    """Solicitud de mercancía no disponible; no genera movimientos de stock."""

    TIPOS = [("agotado", "Agotado"), ("no_registrado", "No registrado")]
    ESTADOS = [("pendiente", "Pendiente"), ("resuelto", "Resuelto")]

    id = models.CharField(
        max_length=255, primary_key=True, default=uuid.uuid4, editable=False,
    )
    producto = models.ForeignKey(
        Producto, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="faltantes", db_column="productoId",
    )
    # Conserva la referencia original si luego se elimina el producto.
    productoIdHistorico = models.CharField(max_length=255, blank=True, default="")
    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=15, choices=TIPOS)
    cantidad = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    fecha = models.DateTimeField(default=timezone.now)
    estado = models.CharField(max_length=10, choices=ESTADOS, default="pendiente")
    proveedor = models.ForeignKey(
        Proveedor, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="faltantes", db_column="proveedorId",
    )

    class Meta:
        db_table = "faltantes"
        ordering = ["-fecha", "id"]
        verbose_name = "faltante"
        verbose_name_plural = "faltantes"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(tipo__in=["agotado", "no_registrado"]),
                name="faltante_tipo_valido",
            ),
            models.CheckConstraint(
                condition=models.Q(estado__in=["pendiente", "resuelto"]),
                name="faltante_estado_valido",
            ),
            models.CheckConstraint(
                condition=models.Q(cantidad__gte=1),
                name="faltante_cantidad_positiva",
            ),
        ]

    def __str__(self):
        """Describe la solicitud con su nombre y estado de gestión."""
        return f"{self.nombre} ({self.estado})"


class Reembolso(models.Model):
    """Datos generales de una devolución vinculada a una venta."""

    id = models.CharField(
        max_length=255, primary_key=True, default=uuid.uuid4, editable=False,
    )
    venta = models.ForeignKey(
        Venta,
        on_delete=models.PROTECT,
        related_name="reembolsos",
        db_column="ventaId",
    )
    fecha = models.DateTimeField(default=timezone.now)
    # El servicio tomará el responsable de la sesión, no del formulario.
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reembolsos_pos",
        db_column="usuarioId",
    )
    # Se calculará desde los detalles, considerando el descuento de la venta.
    # Cero es válido si los artículos fueron vendidos con descuento del 100 %.
    total = models.PositiveBigIntegerField()

    class Meta:
        db_table = "reembolsos"
        ordering = ["-fecha", "id"]
        verbose_name = "reembolso"
        verbose_name_plural = "reembolsos"

    def __str__(self):
        """Identifica el reembolso sin cargar la venta relacionada."""
        return f"Reembolso {self.id} de venta {self.venta_id}"


class DetalleReembolso(models.Model):
    """Cantidad e importe devueltos de un artículo de la venta original."""

    reembolso = models.ForeignKey(
        Reembolso,
        on_delete=models.PROTECT,
        related_name="detalles",
        db_column="reembolsoId",
    )
    detalleVenta = models.ForeignKey(
        DetalleVenta,
        on_delete=models.PROTECT,
        related_name="detalles_reembolso",
        db_column="detalleVentaId",
    )
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    # Importe final calculado por el servicio con el descuento proporcional.
    monto = models.PositiveBigIntegerField()
    # Debe elegirse explícitamente. Guardar este valor no mueve inventario.
    retornaInventario = models.BooleanField()

    class Meta:
        db_table = "detalles_reembolso"
        ordering = ["id"]
        verbose_name = "detalle de reembolso"
        verbose_name_plural = "detalles de reembolso"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(cantidad__gte=1),
                name="detalle_reembolso_cantidad_positiva",
            ),
            models.UniqueConstraint(
                fields=["reembolso", "detalleVenta"],
                name="reembolso_articulo_unico",
            ),
        ]

    def __str__(self):
        """Describe la devolución sin consultar otras tablas."""
        return f"Detalle de venta {self.detalleVenta_id}: {self.cantidad} devuelto(s)"


class ControlInventario(models.Model):
    """Fila única para ordenar operaciones que afectan existencias."""
    id = models.PositiveSmallIntegerField(primary_key=True, default=1)


class Operacion(models.Model):
    """Recibo de reintento; los detalles de negocio siguen en tablas relacionales."""
    id = models.CharField(max_length=320, primary_key=True)
    huella = models.CharField(max_length=64)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    respuesta = models.JSONField()
    fecha = models.DateTimeField(default=timezone.now)
