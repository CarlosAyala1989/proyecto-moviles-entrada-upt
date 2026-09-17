import 'package:flutter/material.dart';

import '../controladores/controlador_verificacion_intranet.dart';
import 'pantalla_verificacion_intranet.dart';

class PantallaInicioSesion extends StatelessWidget {
  const PantallaInicioSesion({
    required this.controladorVerificacionIntranet,
    super.key,
  });

  final ControladorVerificacionIntranet controladorVerificacionIntranet;

  void _iniciarAcceso(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PantallaVerificacionIntranet(
          controlador: controladorVerificacionIntranet,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    Icons.account_balance_outlined,
                    size: 72,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Identidad Digital UPT',
                    style: Theme.of(context).textTheme.headlineMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'El registro y el inicio de sesión utilizan el mismo '
                    'proceso institucional.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  const _PasoAcceso(
                    numero: '1',
                    titulo: 'Verifica la intranet UPT',
                    descripcion:
                        'Ingresa tu código, contraseña numérica y el número de la imagen.',
                  ),
                  const SizedBox(height: 12),
                  const _PasoAcceso(
                    numero: '2',
                    titulo: 'Accede con Google institucional',
                    descripcion:
                        'Usa la cuenta que termina en @virtual.upt.pe.',
                  ),
                  const SizedBox(height: 28),
                  FilledButton.icon(
                    onPressed: () => _iniciarAcceso(context),
                    icon: const Icon(Icons.verified_user_outlined),
                    label: const Text('Ingresar o registrarme'),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No se usa una contraseña local de esta aplicación.',
                    style: Theme.of(context).textTheme.bodySmall,
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

class _PasoAcceso extends StatelessWidget {
  const _PasoAcceso({
    required this.numero,
    required this.titulo,
    required this.descripcion,
  });

  final String numero;
  final String titulo;
  final String descripcion;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(child: Text(numero)),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(titulo, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(descripcion),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
