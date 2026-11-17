"""Reglas de ventas e inventario. Cada operación se confirma completa o se revierte."""
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from functools import wraps

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.exceptions import APIException

from .models import (Cliente, Compra, Descuento, DetalleCompra, DetalleReembolso,
                     DetalleVenta, Producto, Proveedor, Reembolso, Venta,
                     ControlInventario, Operacion)


class Conflicto(APIException):
    status_code = 409
    default_detail = "Los datos cambiaron. Actualiza antes de continuar."
    default_code = "conflicto"


def entero(valor, nombre, minimo=0, maximo=9007199254740991):
    if isinstance(valor, bool) or not isinstance(valor, int) or not minimo <= valor <= maximo:
        raise ValidationError({nombre: f"Debe ser un entero entre {minimo} y {maximo}."})
    return valor


def identificador(valor):
    if not isinstance(valor, str) or not valor.strip() or len(valor) > 255:
        raise ValidationError("Indica un ID de texto válido.")
    return valor


def obtener(modelo, pk):
    try:
        return modelo.objects.get(pk=pk)
    except (modelo.DoesNotExist, ValueError, TypeError):
        raise ValidationError(f"No existe {modelo._meta.verbose_name}: {pk}.")


def redondear(valor):
    return int(Decimal(valor).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def operacion_unica(funcion):
    """Serializa operaciones y guarda su respuesta para reintentos idénticos."""
    @wraps(funcion)
    def ejecutar(datos, usuario, clave):
        if not isinstance(datos, dict):
            raise ValidationError("Envía un objeto JSON.")
        identificador(clave)
        huella = hashlib.sha256(json.dumps(datos, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        llave = f"{funcion.__name__}:{clave}"
        with transaction.atomic():
            # La migración crea esta fila. PostgreSQL la bloquea; SQLite usa IMMEDIATE.
            ControlInventario.objects.select_for_update().get(pk=1)
            anterior = Operacion.objects.filter(pk=llave).first()
            if anterior:
                if anterior.huella != huella or anterior.usuario_id != usuario.pk:
                    raise Conflicto("El identificador de operación ya fue utilizado con otros datos o usuario.")
                return anterior.respuesta
            resultado = funcion(datos, usuario)
            Operacion.objects.create(id=llave, huella=huella, usuario=usuario, respuesta=resultado)
            return resultado
    return ejecutar


def detalles_entrada(datos, compra=False):
    items = datos.get('itemsJson', datos.get('items'))
    if not isinstance(items, list) or not items or len(items) > 500:
        raise ValidationError("Agrega entre 1 y 500 productos.")
    resultado, ids = [], set()
    for item in items:
        if not isinstance(item, dict):
            raise ValidationError("Detalle inválido.")
        pk = identificador(item.get('id', item.get('productoId')))
        if pk in ids:
            raise ValidationError("No repitas productos: modifica su cantidad.")
        ids.add(pk)
        linea = {'id': pk, 'cantidad': entero(item.get('cantidad'), 'cantidad', 1, 2147483647)}
        if compra:
            linea['costo'] = entero(item.get('costo'), 'costo')
        resultado.append(linea)
    return resultado


def productos_bloqueados(ids):
    productos = {str(p.pk): p for p in Producto.objects.select_for_update().filter(pk__in=ids).order_by('pk')}
    faltan = set(ids) - set(productos)
    if faltan:
        raise ValidationError(f"Productos inexistentes: {', '.join(sorted(faltan))}.")
    return productos


def mover_stock(productos, movimientos, respetar_seguimiento=True):
    for pk, cantidad in movimientos.items():
        producto = productos[pk]
        if producto.seguimientoInventario or not respetar_seguimiento:
            nuevo = producto.stock + cantidad
            if nuevo < 0:
                raise Conflicto(f"Stock insuficiente para {producto.nombre}: disponibles {producto.stock}.")
            entero(nuevo, f'stock de {producto.nombre}', 0, 2147483647)
            producto.stock = nuevo
            producto.save(update_fields=['stock'])


def venta_json(venta):
    detalles = list(venta.detalles.all())
    reembolsado = venta.reembolsos.aggregate(total=Sum('total'))['total'] or 0
    devueltos = DetalleReembolso.objects.filter(reembolso__venta=venta).aggregate(n=Sum('cantidad'))['n'] or 0
    return {
        'id': str(venta.pk), 'fecha': venta.fecha.isoformat(), 'estado': venta.estado,
        'clienteId': str(venta.cliente_id or ''), 'clienteNombre': venta.clienteNombre,
        'persona': venta.persona, 'metodoPago': venta.metodoPago,
        'subtotal': venta.subtotal, 'iva': venta.iva, 'total': venta.total,
        'valorRecibido': venta.valorRecibido, 'cambio': venta.cambio,
        'actualizadoEn': venta.actualizadoEn.isoformat(),
        'descuentoId': str(venta.descuento_id or ''), 'descuentoNombre': venta.descuentoNombre,
        'descuentoMonto': venta.descuentoMonto, 'descuentoTipo': venta.descuentoTipo,
        'descuentoValor': venta.descuentoValor,
        'corregida': venta.corregida, 'corregidaEn': venta.corregidaEn.isoformat() if venta.corregidaEn else None,
        'corregidaPor': venta.corregidaPor.get_username() if venta.corregidaPor else '',
        'reembolsoEstado': ('total' if devueltos == sum(d.cantidad for d in detalles) else 'parcial') if devueltos else 'ninguno',
        'reembolsado': reembolsado,
        'itemsJson': [dict(id=d.productoIdHistorico, detalleId=d.pk, nombre=d.nombre,
                           cantidad=d.cantidad, precio=d.precio, costo=d.costo, subtotal=d.subtotal,
                           devuelto=d.detalles_reembolso.aggregate(n=Sum('cantidad'))['n'] or 0) for d in detalles],
    }


def compra_json(compra):
    return dict(id=str(compra.pk), fecha=compra.fecha.isoformat(), proveedorId=str(compra.proveedor_id),
                total=compra.total, itemsJson=[dict(id=d.productoIdHistorico, nombre=d.nombre,
                cantidad=d.cantidad, costo=d.costo, subtotal=d.subtotal) for d in compra.detalles.all()])


def version_correcta(venta, datos):
    version = datos.get('actualizadoEn')
    try:
        valida = isinstance(version, str) and parse_datetime(version) == venta.actualizadoEn
    except ValueError:
        valida = False
    if not valida:
        raise Conflicto("La venta cambió. Consulta y retoma la versión actual.")


def preparar_venta(venta, datos, productos, items):
    metodo = datos.get('metodoPago', '')
    if metodo not in ('Efectivo', 'Nequi', 'Debe'):
        raise ValidationError("Selecciona Efectivo, Nequi o Debe.")
    cliente_id = datos.get('clienteId')
    cliente = obtener(Cliente, cliente_id) if cliente_id else None
    if metodo == 'Debe' and cliente is None:
        raise ValidationError("Selecciona un cliente para el pago Debe.")
    descuento_id = datos.get('descuentoId')
    descuento = obtener(Descuento, descuento_id) if descuento_id else None
    subtotal = sum(productos[i['id']].precio * i['cantidad'] for i in items)
    entero(subtotal, 'subtotal')
    iva = redondear(Decimal(subtotal) * Decimal('0.19'))
    bruto = entero(subtotal + iva, 'total antes de descuento')
    monto = 0
    if descuento:
        monto = min(bruto, redondear(Decimal(bruto) * descuento.valor / 100) if descuento.tipo == 'porcentaje' else descuento.valor)
    venta.cliente = cliente
    venta.clienteNombre = cliente.nombre if cliente else ''
    venta.metodoPago = metodo
    venta.subtotal, venta.iva, venta.total = subtotal, iva, bruto - monto
    venta.descuento = descuento
    venta.descuentoIdHistorico = str(descuento.pk) if descuento else ''
    venta.descuentoNombre = descuento.nombre if descuento else ''
    venta.descuentoTipo = descuento.tipo if descuento else ''
    venta.descuentoValor = descuento.valor if descuento else 0
    venta.descuentoMonto = monto
    venta.actualizadoEn = timezone.now()


def guardar_detalles(venta, items, productos):
    venta.detalles.all().delete()
    for i in items:
        p = productos[i['id']]
        DetalleVenta.objects.create(venta=venta, producto=p, productoIdHistorico=str(p.pk), nombre=p.nombre,
                                   cantidad=i['cantidad'], precio=p.precio, costo=p.costo, subtotal=p.precio*i['cantidad'])


def cobrar(venta, datos):
    recibido = entero(datos.get('valorRecibido', 0), 'valorRecibido') if venta.metodoPago == 'Efectivo' else 0
    if venta.metodoPago == 'Efectivo' and recibido < venta.total:
        raise ValidationError("El efectivo recibido es insuficiente.")
    venta.valorRecibido = recibido if venta.metodoPago == 'Efectivo' else 0
    venta.cambio = recibido - venta.total if venta.metodoPago == 'Efectivo' else 0


@operacion_unica
def guardar_venta(datos, usuario):
    pk = identificador(datos.get('id'))
    venta = Venta.objects.select_for_update().filter(pk=pk).first()
    if venta:
        if venta.estado != 'abierta':
            raise Conflicto("La venta ya está cerrada.")
        version_correcta(venta, datos)
    else:
        if datos.get('actualizadoEn'):
            raise NotFound("La venta no existe.")
        venta = Venta(id=pk, usuario=usuario, persona=usuario.get_username())
    items = detalles_entrada(datos)
    productos = productos_bloqueados([i['id'] for i in items])
    preparar_venta(venta, datos, productos, items)
    venta.save()
    guardar_detalles(venta, items, productos)
    return venta_json(venta)


@operacion_unica
def cerrar_venta(datos, usuario):
    venta = obtener(Venta, identificador(datos.get('id')))
    if venta.estado != 'abierta':
        raise Conflicto("La venta ya está cerrada. Consulta su comprobante.")
    version_correcta(venta, datos)
    detalles = list(venta.detalles.all())
    if not detalles:
        raise ValidationError("La venta no tiene productos.")
    productos = productos_bloqueados([d.productoIdHistorico for d in detalles])
    cobrar(venta, datos)
    mover_stock(productos, {d.productoIdHistorico: -d.cantidad for d in detalles})
    for d in detalles:
        d.inventarioAplicado = productos[d.productoIdHistorico].seguimientoInventario
        d.save(update_fields=['inventarioAplicado'])
    venta.estado = 'cerrada'
    venta.actualizadoEn = timezone.now()
    venta.save()
    return venta_json(venta)


@operacion_unica
def registrar_compra(datos, usuario):
    pk = identificador(datos.get('id'))
    if Compra.objects.filter(pk=pk).exists():
        raise Conflicto("Ya existe una compra con ese ID.")
    proveedor = obtener(Proveedor, datos.get('proveedorId'))
    try:
        fecha = parse_date(datos.get('fecha', ''))
    except (ValueError, TypeError):
        fecha = None
    if fecha is None:
        raise ValidationError("Indica una fecha válida (AAAA-MM-DD).")
    items = detalles_entrada(datos, compra=True)
    productos = productos_bloqueados([i['id'] for i in items])
    total = entero(sum(i['cantidad']*i['costo'] for i in items), 'total')
    compra = Compra.objects.create(id=pk, proveedor=proveedor, fecha=fecha, total=total)
    mover_stock(productos, {i['id']: i['cantidad'] for i in items})
    for i in items:
        p = productos[i['id']]
        p.costo = i['costo']
        p.save(update_fields=['costo'])
        DetalleCompra.objects.create(compra=compra, producto=p, productoIdHistorico=str(p.pk),
                                    nombre=p.nombre, cantidad=i['cantidad'], costo=i['costo'], subtotal=i['cantidad']*i['costo'])
    return compra_json(compra)


@operacion_unica
def corregir_venta(datos, usuario):
    venta = obtener(Venta, identificador(datos.get('id')))
    if venta.estado != 'cerrada':
        raise ValidationError("Solo puedes corregir ventas cerradas.")
    version_correcta(venta, datos)
    if venta.reembolsos.exists():
        raise Conflicto("No se puede corregir una venta con reembolsos registrados.")
    items = detalles_entrada(datos)
    historicos = list(venta.detalles.all())
    if any(d.inventarioAplicado is None for d in historicos):
        raise Conflicto('La venta histórica no confirma el movimiento de stock; requiere revisión antes de corregir.')
    anteriores = {d.productoIdHistorico: d.cantidad if d.inventarioAplicado else 0 for d in historicos}
    nuevos = {i['id']: i['cantidad'] for i in items}
    productos = productos_bloqueados(set(anteriores) | set(nuevos))
    preparar_venta(venta, datos, productos, items)
    cobrar(venta, datos)
    mover_stock(productos, {pk: anteriores.get(pk, 0)-(nuevos.get(pk, 0) if productos[pk].seguimientoInventario else 0) for pk in productos}, respetar_seguimiento=False)
    venta.corregida, venta.corregidaEn, venta.corregidaPor = True, timezone.now(), usuario
    venta.save()
    guardar_detalles(venta, items, productos)
    for d in venta.detalles.all():
        d.inventarioAplicado = productos[d.productoIdHistorico].seguimientoInventario
        d.save(update_fields=['inventarioAplicado'])
    return venta_json(venta)


@operacion_unica
def registrar_reembolso(datos, usuario):
    venta = obtener(Venta, datos.get('ventaId'))
    if venta.estado != 'cerrada':
        raise ValidationError("Solo se reembolsan ventas cerradas.")
    items = datos.get('items')
    if not isinstance(items, list) or not items:
        raise ValidationError("Selecciona artículos para reembolsar.")
    detalles = list(venta.detalles.order_by('id'))
    por_id = {d.pk: d for d in detalles}
    # Reparte el total neto por líneas. La última absorbe el redondeo de pesos.
    acumulado, anterior, importes = 0, 0, {}
    for d in detalles:
        acumulado += d.subtotal
        limite = redondear(Decimal(venta.total)*acumulado/venta.subtotal) if venta.subtotal else 0
        importes[d.pk] = limite - anterior
        anterior = limite
    usados, lineas, movimientos = set(), [], {}
    for item in items:
        if not isinstance(item, dict):
            raise ValidationError("Detalle inválido.")
        did = entero(item.get('detalleId'), 'detalleId', 1)
        if did not in por_id or did in usados:
            raise ValidationError("El artículo no pertenece a la venta o está repetido.")
        usados.add(did)
        d = por_id[did]
        cantidad = entero(item.get('cantidad'), 'cantidad', 1)
        retorna = item.get('retornaInventario')
        if not isinstance(retorna, bool):
            raise ValidationError("Indica si el producto retorna al inventario.")
        previo = d.detalles_reembolso.aggregate(n=Sum('cantidad'))['n'] or 0
        if previo + cantidad > d.cantidad:
            raise ValidationError(f"Cantidad superior a la pendiente de reembolso para {d.nombre}.")
        monto = redondear(Decimal(importes[did])*(previo+cantidad)/d.cantidad)-redondear(Decimal(importes[did])*previo/d.cantidad)
        lineas.append((d, cantidad, retorna, monto))
        if retorna and d.inventarioAplicado is None:
            raise Conflicto('El detalle histórico no confirma el movimiento original de inventario.')
        if retorna and d.inventarioAplicado:
            movimientos[d.productoIdHistorico] = movimientos.get(d.productoIdHistorico, 0)+cantidad
    productos = productos_bloqueados(movimientos)
    mover_stock(productos, movimientos, respetar_seguimiento=False)
    reembolso = Reembolso.objects.create(id=identificador(datos.get('id')), venta=venta, usuario=usuario,
                                         total=sum(l[3] for l in lineas))
    for d, cantidad, retorna, monto in lineas:
        DetalleReembolso.objects.create(reembolso=reembolso, detalleVenta=d, cantidad=cantidad, monto=monto, retornaInventario=retorna)
    return dict(id=str(reembolso.pk), ventaId=str(venta.pk), total=reembolso.total,
                fecha=reembolso.fecha.isoformat(), usuario=usuario.get_username(), venta=venta_json(venta))
