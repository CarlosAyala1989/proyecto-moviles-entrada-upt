import 'package:flutter/material.dart';

class PantallaConfiguracionInvalida extends StatelessWidget {
  const PantallaConfiguracionInvalida({
    required this.titulo,
    required this.mensaje,
    required this.icono,
    super.key,
  });

  final String titulo;
  final String mensaje;
  final IconData icono;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    icono,
                    size: 72,
                    color: Theme.of(context).colorScheme.error,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    titulo,
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Semantics(
                    liveRegion: true,
                    child: Text(mensaje, textAlign: TextAlign.center),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'No se intentó conectar. Recompila la aplicación con una configuración válida.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
