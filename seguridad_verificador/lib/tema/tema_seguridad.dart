import 'package:flutter/material.dart';

ThemeData construirTemaSeguridad() {
  const colorPrincipal = Color(0xFF17365D);
  return ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: colorPrincipal,
      brightness: Brightness.light,
    ),
    useMaterial3: true,
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
    ),
  );
}
