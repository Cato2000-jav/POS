from django.db import migrations


def crear_control(apps, schema_editor):
    apps.get_model('pos', 'ControlInventario').objects.using(schema_editor.connection.alias).get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [('pos', '0002_controlinventario_operacion')]
    operations = [migrations.RunPython(crear_control, migrations.RunPython.noop)]
