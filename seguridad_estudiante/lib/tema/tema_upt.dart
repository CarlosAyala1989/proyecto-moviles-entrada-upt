import 'package:flutter/material.dart';

ThemeData construirTemaUpt() {
  const colorInstitucional = Color(0xFF8A1538);
  return ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: colorInstitucional,
      brightness: Brightness.light,
    ),
    useMaterial3: true,
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
    ),
  );
}
