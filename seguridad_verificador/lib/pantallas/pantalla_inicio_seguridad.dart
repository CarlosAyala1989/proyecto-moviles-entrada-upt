import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../navegacion/rutas_seguridad.dart';

class PantallaInicioSeguridad extends StatelessWidget {
  const PantallaInicioSeguridad({required this.controladorSesion, super.key});

  final ControladorSesion controladorSesion;

  @override
  Widget build(BuildContext context) {
    final usuario = controladorSesion.sesion!.usuario;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Control de Acceso UPT'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            onPressed: controladorSesion.cerrarSesion,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Personal: ${usuario.nombreCompleto}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text(usuario.codigoInstitucional),
          if (controladorSesion.mensajeError case final mensaje?) ...[
            const SizedBox(height: 16),
            Semantics(
              liveRegion: true,
              child: Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(mensaje),
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),
          Card(
            child: ListTile(
              leading: const Icon(Icons.qr_code_scanner),
              title: const Text('Escanear código QR'),
              subtitle: const Text(
                'Comprobaremos el código, la identidad y la ubicación.',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.pushNamed(context, RutasSeguridad.escaner),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.history),
              title: const Text('Historial reciente'),
              subtitle: const Text('Revisa los ingresos que comprobaste.'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () =>
                  Navigator.pushNamed(context, RutasSeguridad.historial),
            ),
          ),
        ],
      ),
    );
  }
}
