"""Pruebas de negocio: dinero, stock, transacciones y reintentos."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from .models import (Categoria, Producto, Proveedor, Cliente, Descuento, Venta,
                     Compra, Reembolso, Operacion, Faltante, ControlInventario)
from . import services as s


class OperacionesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = get_user_model().objects.create_user(username='operador')
        cls.usuario.groups.add(Group.objects.create(name='Administrador'))
        cls.categoria = Categoria.objects.create(nombre='Escolar')
        cls.producto = Producto.objects.create(id='p', nombre='Cuaderno', categoria=cls.categoria,
            precio=1000, costo=500, stock=10, seguimientoInventario=True)
        cls.servicio = Producto.objects.create(id='s', nombre='Servicio', categoria=cls.categoria,
            precio=100, costo=10, stock=0, seguimientoInventario=False)
        cls.proveedor = Proveedor.objects.create(id='prov', nombre='Proveedor')
        cls.cliente = Cliente.objects.create(id='cli', nombre='Cliente')
        ControlInventario.objects.get_or_create(pk=1)

    def abierta(self, cantidad=2, **extra):
        datos=dict(id='v', metodoPago='Efectivo', itemsJson=[{'id':'p','cantidad':cantidad}], **extra)
        return s.guardar_venta(datos, self.usuario, 'abrir')

    def cerrada(self, **extra):
        v=self.abierta(**extra)
        return s.cerrar_venta(dict(id='v', actualizadoEn=v['actualizadoEn'],valorRecibido=30000),self.usuario,'cerrar')

    def stock(self):
        self.producto.refresh_from_db()
        return self.producto.stock

    def test_abierta_cierre_y_reintento_no_duplican_stock(self):
        v=self.abierta()
        self.assertEqual(self.stock(),10)
        datos=dict(id='v',actualizadoEn=v['actualizadoEn'],valorRecibido=3000)
        r=s.cerrar_venta(datos,self.usuario,'cierre')
        self.assertEqual((r['subtotal'],r['iva'],r['total'],r['cambio']),(2000,380,2380,620))
        self.assertEqual(self.stock(),8)
        self.assertEqual(s.cerrar_venta(datos,self.usuario,'cierre'),r)
        self.assertEqual(self.stock(),8)

    def test_stock_insuficiente_revierte_estado_y_operacion(self):
        v=self.abierta(cantidad=11)
        with self.assertRaisesMessage(s.Conflicto,'Cuaderno'):
            s.cerrar_venta(dict(id='v',actualizadoEn=v['actualizadoEn'],valorRecibido=30000),self.usuario,'cierre')
        self.assertEqual(self.stock(),10)
        self.assertEqual(Venta.objects.get(pk='v').estado,'abierta')
        self.assertFalse(Operacion.objects.filter(pk='cerrar_venta:cierre').exists())

    def test_debe_exige_cliente_y_no_efectivo(self):
        datos=dict(id='v',metodoPago='Debe',itemsJson=[dict(id='p',cantidad=1)])
        with self.assertRaises(ValidationError):s.guardar_venta(datos,self.usuario,'abierta')
        datos['clienteId']='cli'
        v=s.guardar_venta(datos,self.usuario,'abierta')
        r=s.cerrar_venta(dict(id='v',actualizadoEn=v['actualizadoEn'],valorRecibido=None),self.usuario,'cerrar')
        self.assertEqual((r['clienteId'],r['valorRecibido'],r['cambio']),('cli',0,0))

    def test_version_obsoleta_no_sobrescribe(self):
        v=self.abierta()
        datos=dict(id='v',metodoPago='Nequi',actualizadoEn=v['actualizadoEn'],itemsJson=[dict(id='p',cantidad=3)])
        nuevo=s.guardar_venta(datos,self.usuario,'editar')
        with self.assertRaises(s.Conflicto):s.guardar_venta({**datos,'metodoPago':'Efectivo'},self.usuario,'obsoleta')
        self.assertEqual(Venta.objects.get(pk='v').metodoPago,'Nequi')
        self.assertNotEqual(v['actualizadoEn'],nuevo['actualizadoEn'])

    def test_clave_reutilizada_con_datos_distintos_rechazada(self):
        self.abierta()
        with self.assertRaises(s.Conflicto):self.abierta(cantidad=3)
        self.assertEqual(Venta.objects.count(),1)

    def test_efectivo_insuficiente_no_descuenta(self):
        v=self.abierta()
        with self.assertRaises(ValidationError):s.cerrar_venta(dict(id='v',actualizadoEn=v['actualizadoEn'],valorRecibido=1),self.usuario,'cerrar')
        self.assertEqual(self.stock(),10)

    def test_compra_actualiza_costo_stock_una_vez(self):
        datos=dict(id='c',proveedorId='prov',fecha='2026-11-16',itemsJson=[dict(id='p',cantidad=3,costo=700),dict(id='s',cantidad=2,costo=20)])
        r=s.registrar_compra(datos,self.usuario,'comprar')
        self.assertEqual(r['total'],2140)
        self.assertEqual(self.stock(),13)
        self.assertEqual(self.producto.costo,700)
        self.servicio.refresh_from_db()
        self.assertEqual((self.servicio.stock,self.servicio.costo),(0,20))
        self.assertEqual(s.registrar_compra(datos,self.usuario,'comprar'),r)
        self.assertEqual(self.stock(),13)

    def test_compra_invalida_no_guarda_cabecera(self):
        with self.assertRaises(ValidationError):
            s.registrar_compra(dict(id='c',proveedorId='prov',fecha='2026-11-16',itemsJson=[dict(id='p',cantidad=3,costo=-1)]),self.usuario,'comprar')
        self.assertFalse(Compra.objects.exists())
        self.assertEqual(self.stock(),10)

    def test_descuento_fijo_no_produce_total_negativo(self):
        d=Descuento.objects.create(nombre='Gratis',tipo='fijo',valor=999999)
        v=self.cerrada(descuentoId=str(d.pk))
        self.assertEqual(v['total'],0)
        self.assertEqual(v['descuentoMonto'],2380)

    def test_correccion_ajusta_diferencia_y_auditoria(self):
        v=self.cerrada()
        datos=dict(id='v',actualizadoEn=v['actualizadoEn'],metodoPago='Nequi',itemsJson=[dict(id='p',cantidad=3)])
        r=s.corregir_venta(datos,self.usuario,'corregir')
        self.assertEqual(self.stock(),7)
        self.assertTrue(r['corregida'])
        self.assertEqual(r['corregidaPor'],'operador')
        self.assertEqual(r['id'],'v')
        self.assertEqual(s.corregir_venta(datos,self.usuario,'corregir'),r)
        self.assertEqual(self.stock(),7)

    def test_correccion_sin_stock_conserva_venta_original(self):
        v=self.cerrada()
        with self.assertRaises(s.Conflicto):
            s.corregir_venta(dict(id='v',actualizadoEn=v['actualizadoEn'],metodoPago='Nequi',itemsJson=[dict(id='p',cantidad=20)]),self.usuario,'corregir')
        self.assertEqual(self.stock(),8)
        self.assertEqual(Venta.objects.get(pk='v').total,2380)
        self.assertFalse(Venta.objects.get(pk='v').corregida)

    def test_reembolsos_parciales_suman_total_neto(self):
        d=Descuento.objects.create(nombre='Promoción',tipo='porcentaje',valor=15)
        v=self.cerrada(descuentoId=str(d.pk))
        detalle=v['itemsJson'][0]['detalleId']
        datos=dict(id='r1',ventaId='v',items=[dict(detalleId=detalle,cantidad=1,retornaInventario=True)])
        r1=s.registrar_reembolso(datos,self.usuario,'r1')
        self.assertEqual(self.stock(),9)
        self.assertEqual(r1['venta']['reembolsoEstado'],'parcial')
        self.assertEqual(s.registrar_reembolso(datos,self.usuario,'r1'),r1)
        r2=s.registrar_reembolso(dict(id='r2',ventaId='v',items=[dict(detalleId=detalle,cantidad=1,retornaInventario=False)]),self.usuario,'r2')
        self.assertEqual(r1['total']+r2['total'],v['total'])
        self.assertEqual(r2['venta']['reembolsoEstado'],'total')
        self.assertEqual(self.stock(),9)
        with self.assertRaises(ValidationError):
            s.registrar_reembolso(dict(id='r3',ventaId='v',items=[dict(detalleId=detalle,cantidad=1,retornaInventario=True)]),self.usuario,'r3')
        self.assertEqual(Reembolso.objects.count(),2)

    def test_detalle_ajeno_y_abierta_no_admiten_reembolso(self):
        v=self.abierta()
        with self.assertRaises(ValidationError):s.registrar_reembolso(dict(id='r',ventaId='v',items=[]),self.usuario,'r')
        v=s.cerrar_venta(dict(id='v',actualizadoEn=v['actualizadoEn'],valorRecibido=3000),self.usuario,'cerrar')
        with self.assertRaises(ValidationError):s.registrar_reembolso(dict(id='r',ventaId='v',items=[dict(detalleId=9999,cantidad=1,retornaInventario=True)]),self.usuario,'r')

    def test_api_cajero_no_corrige_ni_reembolsa(self):
        c=APIClient(HTTP_HOST='localhost')
        cajero=get_user_model().objects.create_user(username='cajero_ops')
        cajero.groups.add(Group.objects.create(name='Cajero'))
        c.force_authenticate(cajero)
        for url in ['/api/ventas/v/corregir/','/api/reembolsos/','/api/compras/']:
            self.assertEqual(c.post(url,{},format='json').status_code,403)
        self.assertEqual(c.get('/api/reportes/?desde=2026-11-16&hasta=2026-11-16').status_code,403)

    def test_faltantes_y_reporte_normalizan_sin_stock(self):
        c=APIClient(HTTP_HOST='localhost');c.force_authenticate(self.usuario)
        for nombre in ['Lápices','lapices']:
            r=c.post('/api/faltantes/',dict(nombre=nombre,tipo='no_registrado',cantidad=2),format='json')
            self.assertEqual(r.status_code,201,r.data)
        self.assertEqual(self.stock(),10)
        hoy=__import__('django.utils.timezone',fromlist=['localdate']).localdate().isoformat()
        r=c.get(f'/api/reportes/?desde={hoy}&hasta={hoy}')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(len(r.data['faltantesFrecuentes']),1)
        self.assertEqual(r.data['faltantesFrecuentes'][0]['cantidad'],4)

    def test_fallo_segundo_producto_revierte_primer_movimiento(self):
        otro=Producto.objects.create(id='z',nombre='Sin stock',categoria=self.categoria,
            precio=100,costo=20,stock=0,seguimientoInventario=True)
        v=s.guardar_venta(dict(id='v',metodoPago='Nequi',itemsJson=[dict(id='p',cantidad=1),dict(id='z',cantidad=1)]),self.usuario,'abrir')
        with self.assertRaises(s.Conflicto):
            s.cerrar_venta(dict(id='v',actualizadoEn=v['actualizadoEn']),self.usuario,'cerrar')
        self.assertEqual(self.stock(),10)
        self.assertEqual(Venta.objects.get(pk='v').estado,'abierta')

    def test_producto_sin_seguimiento_no_genera_stock_al_reembolsar(self):
        v=s.guardar_venta(dict(id='v',metodoPago='Nequi',itemsJson=[dict(id='s',cantidad=2)]),self.usuario,'abrir')
        v=s.cerrar_venta(dict(id='v',actualizadoEn=v['actualizadoEn']),self.usuario,'cerrar')
        s.registrar_reembolso(dict(id='r',ventaId='v',items=[dict(detalleId=v['itemsJson'][0]['detalleId'],cantidad=2,retornaInventario=True)]),self.usuario,'reembolso')
        self.servicio.refresh_from_db()
        self.assertEqual(self.servicio.stock,0)

    def test_retorno_respeta_movimiento_original_aunque_cambie_catalogo(self):
        v=self.cerrada()
        Producto.objects.filter(pk='p').update(seguimientoInventario=False)
        s.registrar_reembolso(dict(id='r',ventaId='v',items=[dict(detalleId=v['itemsJson'][0]['detalleId'],cantidad=1,retornaInventario=True)]),self.usuario,'reembolso')
        self.assertEqual(self.stock(),9)

    def test_correccion_con_reembolsos_se_rechaza(self):
        v=self.cerrada()
        s.registrar_reembolso(dict(id='r',ventaId='v',items=[dict(detalleId=v['itemsJson'][0]['detalleId'],cantidad=1,retornaInventario=False)]),self.usuario,'reembolso')
        with self.assertRaises(s.Conflicto):
            s.corregir_venta(dict(id='v',actualizadoEn=v['actualizadoEn'],metodoPago='Nequi',itemsJson=[dict(id='p',cantidad=1)]),self.usuario,'corregir')
        self.assertEqual(self.stock(),8)
