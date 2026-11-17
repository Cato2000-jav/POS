"""Validación de entradas y representación de los datos de la API del POS."""

from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Categoria, Cliente, Descuento, Producto, Proveedor


class CategoriaSerializer(serializers.ModelSerializer):
    """Conserva los campos id y nombre utilizados por el frontend."""

    # Permite conservar el ID enviado por el frontend al crear una categoría.
    # Si se omite, el modelo genera uno. Una categoría existente no cambia de ID.
    id = serializers.CharField(
        max_length=255,
        required=False,
        validators=[UniqueValidator(
            queryset=Categoria.objects.all(),
            message="Ya existe una categoría con este ID.",
        )],
    )
    nombre = serializers.CharField(
        max_length=150,
        trim_whitespace=True,
        error_messages={
            "blank": "Escribe el nombre de la categoría.",
            "required": "El nombre de la categoría es obligatorio.",
        },
    )

    class Meta:
        model = Categoria
        fields = ["id", "nombre"]

    def validate_id(self, valor):
        """Impide cambiar el identificador durante una actualización."""
        if self.instance is not None and valor != str(self.instance.pk):
            raise serializers.ValidationError("No se puede cambiar el ID de la categoría.")
        return valor


class ProductoSerializer(serializers.ModelSerializer):
    """Valida el catálogo manteniendo los nombres de campos del frontend."""

    id = serializers.CharField(
        max_length=255,
        required=False,
        validators=[UniqueValidator(
            queryset=Producto.objects.all(),
            message="Ya existe un producto con este ID.",
        )],
    )
    nombre = serializers.CharField(max_length=150, trim_whitespace=True)
    categoriaId = serializers.PrimaryKeyRelatedField(
        source="categoria",
        queryset=Categoria.objects.all(),
        pk_field=serializers.CharField(max_length=255),
        error_messages={
            "does_not_exist": "Selecciona una categoría existente.",
            "required": "Selecciona la categoría del producto.",
            "null": "La categoría del producto es obligatoria.",
        },
    )
    # Límite de enteros exactos en JavaScript, que consumirá estos importes.
    precio = serializers.IntegerField(min_value=0, max_value=9007199254740991)
    costo = serializers.IntegerField(min_value=0, max_value=9007199254740991)
    stock = serializers.IntegerField(min_value=0, max_value=2147483647, required=False)
    seguimientoInventario = serializers.BooleanField(required=True)

    class Meta:
        model = Producto
        fields = [
            "id", "codigo", "nombre", "categoriaId",
            "precio", "costo", "seguimientoInventario", "stock",
        ]

    def validate_id(self, valor):
        """Conserva el identificador original al editar un producto."""
        if self.instance is not None and valor != str(self.instance.pk):
            raise serializers.ValidationError("No se puede cambiar el ID del producto.")
        return valor


class ProductoEnVentaSerializer(ProductoSerializer):
    """Limita la edición desde una venta a los cuatro campos autorizados."""

    class Meta:
        model = Producto
        fields = ["nombre", "categoriaId", "precio", "costo"]

    def to_internal_value(self, datos):
        """Rechaza campos adicionales en lugar de ignorarlos silenciosamente."""
        if isinstance(datos, dict):
            no_permitidos = set(datos) - set(self.fields)
            if no_permitidos:
                raise serializers.ValidationError({
                    campo: "Este campo no puede modificarse desde una venta."
                    for campo in sorted(no_permitidos)
                })
        return super().to_internal_value(datos)


class ProveedorSerializer(serializers.ModelSerializer):
    """Valida proveedores conservando los campos usados por el frontend."""

    id = serializers.CharField(
        max_length=255,
        required=False,
        validators=[UniqueValidator(
            queryset=Proveedor.objects.all(),
            message="Ya existe un proveedor con este ID.",
        )],
    )
    nombre = serializers.CharField(
        max_length=150,
        trim_whitespace=True,
        error_messages={
            "blank": "Escribe el nombre del proveedor.",
            "required": "El nombre del proveedor es obligatorio.",
        },
    )
    # Es texto para conservar prefijos y ceros iniciales; ambos contactos son opcionales.
    telefono = serializers.CharField(max_length=50, required=False, allow_blank=True)
    correo = serializers.EmailField(
        max_length=254, required=False, allow_blank=True,
        error_messages={"invalid": "Escribe un correo electrónico válido."},
    )

    class Meta:
        model = Proveedor
        fields = ["id", "nombre", "telefono", "correo"]

    def validate_id(self, valor):
        """Conserva el ID al editar para mantener las asociaciones con compras."""
        if self.instance is not None and valor != str(self.instance.pk):
            raise serializers.ValidationError("No se puede cambiar el ID del proveedor.")
        return valor


class ClienteSerializer(serializers.ModelSerializer):
    """Valida clientes conservando los campos del formulario existente."""

    id = serializers.CharField(
        max_length=255,
        required=False,
        validators=[UniqueValidator(
            queryset=Cliente.objects.all(),
            message="Ya existe un cliente con este ID.",
        )],
    )
    nombre = serializers.CharField(
        max_length=150,
        trim_whitespace=True,
        error_messages={
            "blank": "Escribe el nombre del cliente.",
            "required": "El nombre del cliente es obligatorio.",
        },
    )
    # El teléfono es texto; los contactos pueden omitirse o dejarse vacíos.
    telefono = serializers.CharField(max_length=50, required=False, allow_blank=True)
    correo = serializers.EmailField(
        max_length=254, required=False, allow_blank=True,
        error_messages={"invalid": "Escribe un correo electrónico válido."},
    )

    class Meta:
        model = Cliente
        fields = ["id", "nombre", "telefono", "correo"]

    def validate_id(self, valor):
        """Impide cambiar el identificador asociado a las ventas del cliente."""
        if self.instance is not None and valor != str(self.instance.pk):
            raise serializers.ValidationError("No se puede cambiar el ID del cliente.")
        return valor


class DescuentoSerializer(serializers.ModelSerializer):
    """Valida descuentos del catálogo; no los aplica todavía a una venta."""

    id = serializers.CharField(
        max_length=255,
        required=False,
        validators=[UniqueValidator(
            queryset=Descuento.objects.all(),
            message="Ya existe un descuento con este ID.",
        )],
    )
    nombre = serializers.CharField(max_length=150, trim_whitespace=True)
    tipo = serializers.ChoiceField(
        choices=Descuento.TIPOS,
        error_messages={"invalid_choice": "Selecciona porcentaje o fijo."},
    )
    # Mantiene los enteros exactos que puede representar el frontend JavaScript.
    valor = serializers.IntegerField(min_value=1, max_value=9007199254740991)

    class Meta:
        model = Descuento
        fields = ["id", "nombre", "tipo", "valor"]

    def validate_id(self, valor):
        """Conserva el identificador original durante una edición."""
        if self.instance is not None and valor != str(self.instance.pk):
            raise serializers.ValidationError("No se puede cambiar el ID del descuento.")
        return valor

    def validate(self, datos):
        """Comprueba tipo y valor juntos, incluso en una edición parcial."""
        tipo = datos.get("tipo", getattr(self.instance, "tipo", None))
        valor = datos.get("valor", getattr(self.instance, "valor", None))
        if tipo == "porcentaje" and valor is not None and valor > 100:
            raise serializers.ValidationError({
                "valor": "El descuento por porcentaje no puede superar 100.",
            })
        return datos
