"""Importa un respaldo revisado del MVP 2 sin repetir movimientos de inventario."""
import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime, parse_date
from pos.models import (Categoria, Cliente, Proveedor, Producto, Venta, Compra, DetalleVenta, DetalleCompra)
from pos.serializers import CategoriaSerializer, ClienteSerializer, ProveedorSerializer, ProductoSerializer
from pos.services import entero, identificador


class Command(BaseCommand):
    help = 'Valida un JSON de los seis recursos. Solo escribe con --aplicar y base de negocio vacía.'

    def add_arguments(self, parser):
        parser.add_argument('archivo')
        parser.add_argument('--aplicar', action='store_true')

    def handle(self, *args, **options):
        try:
            datos = json.loads(Path(options['archivo']).read_text(encoding='utf-8'))
            with transaction.atomic():
                for modelo in [Categoria, Cliente, Proveedor, Producto, Venta, Compra]:
                    if modelo.objects.exists():
                        raise CommandError('La base de negocio debe estar vacía. No se sobrescriben datos existentes.')
                for recurso in ['categorias', 'clientes', 'proveedores', 'productos', 'ventas', 'compras']:
                    if not isinstance(datos.get(recurso), list):
                        raise CommandError(f'Falta la lista {recurso}.')
                for recurso, serializer in [('categorias', CategoriaSerializer), ('clientes', ClienteSerializer),
                                             ('proveedores', ProveedorSerializer), ('productos', ProductoSerializer)]:
                    for fila in datos[recurso]:
                        identificador(fila.get('id'))
                        s = serializer(data=fila)
                        s.is_valid(raise_exception=True)
                        s.save()
                for fila in datos['ventas']:
                    fecha = parse_datetime(fila['fecha'])
                    actualizado = parse_datetime(fila['actualizadoEn'])
                    if not fecha or not actualizado or fecha.tzinfo is None or actualizado.tzinfo is None:
                        raise CommandError('Las ventas requieren fechas ISO con zona horaria.')
                    v = Venta(id=identificador(fila['id']), fecha=fecha, actualizadoEn=actualizado,
                        estado=fila['estado'], cliente_id=fila.get('clienteId') or None,
                        clienteNombre=fila.get('clienteNombre', ''), persona=fila.get('persona', ''),
                        metodoPago=fila.get('metodoPago', ''),
                        **{k: entero(fila.get(k, 0), k) for k in ['subtotal', 'iva', 'total', 'valorRecibido', 'cambio']})
                    v.full_clean(); v.save()
                    suma = self.detalles(fila, v, venta=True)
                    if suma != v.subtotal or v.total != v.subtotal + v.iva:
                        raise CommandError(f'Totales inconsistentes en venta {v.pk}.')
                for fila in datos['compras']:
                    fecha = parse_date(fila['fecha'])
                    if not fecha: raise CommandError('Compra sin fecha válida.')
                    c = Compra(id=identificador(fila['id']), fecha=fecha,
                               proveedor_id=fila['proveedorId'], total=entero(fila['total'], 'total'))
                    c.full_clean(); c.save()
                    if self.detalles(fila, c, venta=False) != c.total:
                        raise CommandError(f'Total inconsistente en compra {c.pk}.')
                if not options['aplicar']:
                    transaction.set_rollback(True)
            self.stdout.write(self.style.SUCCESS('Respaldo importado sin mover stock.' if options['aplicar'] else 'Validación correcta. No se guardaron datos; usa --aplicar para importar.'))
        except CommandError:
            raise
        except Exception as error:
            raise CommandError(f'No se importó nada: {error}') from error

    def detalles(self, fila, cabecera, venta):
        items = fila.get('itemsJson')
        if isinstance(items, str): items = json.loads(items)
        if not isinstance(items, list) or not items: raise CommandError('Detalle vacío o inválido.')
        ids, suma = set(), 0
        for item in items:
            pk = identificador(item['id'])
            if pk in ids: raise CommandError('Hay productos repetidos en un detalle.')
            ids.add(pk)
            producto = Producto.objects.filter(pk=pk).first()
            cantidad = entero(item['cantidad'], 'cantidad', 1, 2147483647)
            precio = entero(item['precio' if venta else 'costo'], 'importe')
            subtotal = entero(item['subtotal'], 'subtotal')
            if subtotal != cantidad * precio: raise CommandError('Subtotal de detalle inconsistente.')
            nombre = item.get('nombre')
            if not isinstance(nombre, str) or not nombre.strip():
                raise CommandError('Falta un nombre histórico. Revísalo antes de importar; no se inventa.')
            comunes = dict(producto=producto, productoIdHistorico=pk, nombre=nombre,
                           cantidad=cantidad, subtotal=subtotal)
            if venta:
                costo = item.get('costo')
                if costo is not None: entero(costo, 'costo')
                d = DetalleVenta(venta=cabecera, precio=precio, costo=costo, inventarioAplicado=None if cabecera.estado == 'cerrada' else False, **comunes)
            else:
                d = DetalleCompra(compra=cabecera, costo=precio, **comunes)
            d.full_clean(); d.save(); suma += subtotal
        return suma
