import 'package:flutter/material.dart';

class PantallaPreparacion extends StatelessWidget {
  const PantallaPreparacion({
    required this.titulo,
    required this.descripcion,
    required this.icono,
    this.mostrarProgreso = false,
    super.key,
  });

  final String titulo;
  final String descripcion;
  final IconData icono;
  final bool mostrarProgreso;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icono, size: 64, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 24),
              Text(
                titulo,
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(descripcion, textAlign: TextAlign.center),
              if (mostrarProgreso) ...[
                const SizedBox(height: 24),
                const CircularProgressIndicator(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
