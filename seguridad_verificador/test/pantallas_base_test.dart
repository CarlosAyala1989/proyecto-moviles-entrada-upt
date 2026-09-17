import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/pantallas/pantalla_preparacion_seguridad.dart';

void main() {
  testWidgets('muestra la preparación segura del verificador', (
    probador,
  ) async {
    await probador.pumpWidget(
      const MaterialApp(
        home: PantallaPreparacionSeguridad(
          titulo: 'Control de Acceso UPT',
          descripcion: 'Preparando una sesión segura…',
          icono: Icons.security,
          mostrarProgreso: true,
        ),
      ),
    );

    expect(find.text('Control de Acceso UPT'), findsWidgets);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
