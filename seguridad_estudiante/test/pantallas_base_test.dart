import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_estudiante/pantallas/pantalla_preparacion.dart';

void main() {
  testWidgets('muestra la preparación de identidad digital', (probador) async {
    await probador.pumpWidget(
      const MaterialApp(
        home: PantallaPreparacion(
          titulo: 'Identidad Digital UPT',
          descripcion: 'Preparando una sesión segura…',
          icono: Icons.shield_outlined,
          mostrarProgreso: true,
        ),
      ),
    );

    expect(find.text('Identidad Digital UPT'), findsWidgets);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
