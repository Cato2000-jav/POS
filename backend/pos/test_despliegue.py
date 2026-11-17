from django.test import SimpleTestCase


class DespliegueTests(SimpleTestCase):
    def test_authors_publico_sin_sesion(self):
        response = self.client.get('/authors')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [
            {'nombre': 'Alicia', 'codigo': '368580'},
            {'nombre': 'Santiago Rengifo', 'codigo': '387002'},
            {'nombre': 'Gabriel Romero', 'codigo': '324277'},
        ])

    def test_authors_no_acepta_escrituras(self):
        self.assertEqual(self.client.post('/authors', {}).status_code, 405)
