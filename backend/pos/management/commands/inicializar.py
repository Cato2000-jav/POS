"""Crea roles y usuarios iniciales sin sobrescribir usuarios existentes."""
import os
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from pos.models import Categoria, Producto, Proveedor, Cliente, ControlInventario


class Command(BaseCommand):
    help = 'Crea roles y usuarios; --demo agrega un catálogo ficticio para la sustentación local.'

    def add_arguments(self, parser):
        parser.add_argument('--demo', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        demo = options['demo']
        for nombre, rol, variable, clave_demo in [
            ('admin', 'Administrador', 'POS_ADMIN_PASSWORD', 'LunaDemo-Admin-2026!'),
            ('cajero', 'Cajero', 'POS_CAJERO_PASSWORD', 'LunaDemo-Cajero-2026!'),
        ]:
            grupo, _ = Group.objects.get_or_create(name=rol)
            usuario = get_user_model().objects.filter(username=nombre).first()
            if usuario:
                self.stdout.write(f'{nombre} ya existe; no se cambia su contraseña ni su rol.')
                continue
            clave = clave_demo if demo else os.environ.get(variable)
            if not clave:
                raise CommandError(f'Define {variable} o usa --demo solo en desarrollo local.')
            usuario = get_user_model()(username=nombre)
            validate_password(clave, usuario)
            usuario.set_password(clave)
            usuario.save()
            usuario.groups.add(grupo)
        ControlInventario.objects.get_or_create(pk=1)
        if demo:
            categoria, _ = Categoria.objects.get_or_create(id='demo-escolar', defaults={'nombre':'Escolar'})
            Producto.objects.get_or_create(id='demo-cuaderno', defaults=dict(nombre='Cuaderno de prueba', codigo='DEMO-1', categoria=categoria, precio=5000, costo=3000, stock=20, seguimientoInventario=True))
            Proveedor.objects.get_or_create(id='demo-proveedor', defaults={'nombre':'Distribuidora de prueba'})
            Cliente.objects.get_or_create(id='demo-cliente', defaults={'nombre':'Cliente de prueba'})
        self.stdout.write(self.style.SUCCESS('Inicialización completada.'))
