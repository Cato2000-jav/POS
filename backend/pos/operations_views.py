"""Controladores REST de operaciones y reportes; la lógica de stock vive en services."""
import unicodedata
from collections import defaultdict
from django.db import IntegrityError, OperationalError, transaction
from django.utils.dateparse import parse_date
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Compra, Descuento, Faltante, Producto, Proveedor, Venta, Reembolso
from .permissions import EsAdministrador, EsCajeroOAdministrador, EsAdministradorOLecturaCajero
from . import services


class OperacionVista(APIView):
    permission_classes = [EsCajeroOAdministrador]
    funcion = None

    def post(self, request, pk=None):
        if not isinstance(request.data, dict):
            raise ValidationError('Envía un objeto JSON.')
        datos = dict(request.data)
        if pk is not None:
            if datos.get('id', pk) != pk:
                raise ValidationError('El ID del cuerpo no coincide con la ruta.')
            datos['id'] = pk
        clave = request.headers.get('Idempotency-Key')
        if not clave:
            raise ValidationError('Falta Idempotency-Key para poder reintentar sin duplicar.')
        try:
            return Response(self.funcion(datos, request.user, clave))
        except IntegrityError:
            raise services.Conflicto('Conflicto de datos. Consulta el registro antes de reintentar.')
        except OperationalError:
            raise services.Conflicto('La base de datos está ocupada. Reintenta con los mismos datos e identificador.')


class VentasVista(OperacionVista):
    funcion = staticmethod(services.guardar_venta)

    def get(self, request):
        return Response([services.venta_json(v) for v in Venta.objects.all()])


class VentaVista(OperacionVista):
    funcion = staticmethod(services.guardar_venta)
    http_method_names = ['get', 'put', 'patch', 'options', 'head']

    def get(self, request, pk):
        try:
            return Response(services.venta_json(Venta.objects.get(pk=pk)))
        except Venta.DoesNotExist:
            raise NotFound('Venta inexistente.')

    def put(self, request, pk):
        if not Venta.objects.filter(pk=pk).exists():
            raise NotFound('Venta inexistente.')
        return super().post(request, pk)

    patch = put


class CierreVista(OperacionVista):
    funcion = staticmethod(services.cerrar_venta)


class CorreccionVista(OperacionVista):
    permission_classes = [EsAdministrador]
    funcion = staticmethod(services.corregir_venta)


class ComprasVista(OperacionVista):
    permission_classes = [EsAdministrador]
    funcion = staticmethod(services.registrar_compra)

    def get(self, request):
        return Response([services.compra_json(c) for c in Compra.objects.all()])


class CompraVista(APIView):
    permission_classes = [EsAdministrador]

    def get(self, request, pk):
        try:
            return Response(services.compra_json(Compra.objects.get(pk=pk)))
        except Compra.DoesNotExist:
            raise NotFound('Compra inexistente.')


class ReembolsosVista(OperacionVista):
    permission_classes = [EsAdministrador]
    funcion = staticmethod(services.registrar_reembolso)

    def get(self, request):
        return Response([dict(id=str(r.pk), ventaId=str(r.venta_id), total=r.total,
                             fecha=r.fecha.isoformat(), usuario=r.usuario.get_username(),
                             items=list(r.detalles.values('detalleVenta_id', 'cantidad', 'monto', 'retornaInventario')))
                         for r in Reembolso.objects.select_related('usuario')])


class FaltanteSerializer(serializers.ModelSerializer):
    productoId = serializers.PrimaryKeyRelatedField(source='producto', queryset=Producto.objects.all(), required=False, allow_null=True)
    proveedorId = serializers.PrimaryKeyRelatedField(source='proveedor', queryset=Proveedor.objects.all(), required=False, allow_null=True)
    nombre = serializers.CharField(max_length=150, required=False)

    class Meta:
        model = Faltante
        fields = ['id', 'productoId', 'nombre', 'cantidad', 'fecha', 'tipo', 'proveedorId', 'estado']
        read_only_fields = ['id', 'fecha']

    def validate(self, datos):
        tipo = datos.get('tipo', getattr(self.instance, 'tipo', None))
        producto = datos.get('producto', getattr(self.instance, 'producto', None))
        nombre = datos.get('nombre', getattr(self.instance, 'nombre', ''))
        if tipo == 'agotado':
            if not producto:
                raise ValidationError('Selecciona el producto agotado.')
            if not self.instance and (not producto.seguimientoInventario or producto.stock > 0):
                raise ValidationError('El producto seleccionado no está agotado.')
            datos['nombre'] = producto.nombre
            datos['productoIdHistorico'] = str(producto.pk)
        elif producto or not nombre.strip():
            raise ValidationError('Describe el producto no registrado, sin seleccionar un producto existente.')
        return datos


class FaltantesVista(generics.ListCreateAPIView):
    permission_classes = [EsCajeroOAdministrador]
    serializer_class = FaltanteSerializer

    def perform_create(self, serializer):
        serializer.save(estado="pendiente")

    def get_queryset(self):
        qs = Faltante.objects.all()
        for campo in ['tipo', 'estado', 'proveedor_id']:
            valor = self.request.query_params.get('proveedorId' if campo == 'proveedor_id' else campo)
            if valor:
                qs = qs.filter(**{campo: valor})
        return qs


class FaltanteVista(generics.RetrieveUpdateAPIView):
    permission_classes = [EsAdministradorOLecturaCajero]
    serializer_class = FaltanteSerializer
    queryset = Faltante.objects.all()

    def patch(self, request, *args, **kwargs):
        if set(request.data) - {'id', 'estado'} or 'estado' not in request.data:
            raise ValidationError('Solo se permite cambiar el estado del faltante.')
        return super().patch(request, *args, **kwargs)

    http_method_names = ['get', 'patch', 'head', 'options']


def normalizar_nombre(nombre):
    texto = ''.join(c for c in unicodedata.normalize('NFD', nombre.lower()) if not unicodedata.combining(c))
    palabras = texto.split()
    return ' '.join(p[:-3]+'z' if p.endswith('ces') else p[:-2] if p.endswith('es') and len(p)>4 else p[:-1] if p.endswith('s') and len(p)>3 else p for p in palabras)


class ReportesVista(APIView):
    permission_classes = [EsAdministrador]

    def get(self, request):
        try:
            desde = parse_date(request.query_params.get('desde', ''))
            hasta = parse_date(request.query_params.get('hasta', ''))
        except ValueError:
            raise ValidationError('Fechas inválidas.')
        if not desde or not hasta or hasta < desde:
            raise ValidationError('Indica desde y hasta; el rango debe incluir al menos un día.')
        ventas = Venta.objects.filter(estado='cerrada', fecha__date__range=(desde, hasta))
        compras = Compra.objects.filter(fecha__range=(desde, hasta))
        productos = defaultdict(lambda: {'cantidad': 0, 'importe': 0})
        for v in ventas:
            for d in v.detalles.all():
                fila = productos[d.productoIdHistorico]
                fila.update(id=d.productoIdHistorico, nombre=d.nombre)
                fila['cantidad'] += d.cantidad
                fila['importe'] += d.subtotal
        faltantes = defaultdict(lambda: {'solicitudes': 0, 'cantidad': 0, 'pendientes': 0})
        for f in Faltante.objects.filter(fecha__date__range=(desde, hasta)):
            clave = (normalizar_nombre(f.nombre), str(f.proveedor_id or ''))
            fila = faltantes[clave]
            fila.update(nombre=clave[0], proveedorId=clave[1])
            fila['solicitudes'] += 1
            fila['cantidad'] += f.cantidad
            if f.estado == 'pendiente': fila['pendientes'] += f.cantidad
        reembolsos = Reembolso.objects.filter(fecha__date__range=(desde, hasta))
        bruto = sum(v.total for v in ventas)
        devuelto = sum(r.total for r in reembolsos)
        return Response(dict(desde=str(desde), hasta=str(hasta), ventasTotal=bruto,
            reembolsosTotal=devuelto, netoPeriodo=bruto-devuelto,
            comprasTotal=sum(c.total for c in compras), compras=[services.compra_json(c) for c in compras],
            productosMasVendidos=sorted(productos.values(), key=lambda p: -p['cantidad']),
            faltantesFrecuentes=sorted(faltantes.values(), key=lambda p: -p['solicitudes'])))


class ProveedoresFaltantesVista(APIView):
    permission_classes = [EsCajeroOAdministrador]

    def get(self, request):
        return Response(list(Proveedor.objects.values('id', 'nombre')))
