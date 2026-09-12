import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

import '../navegacion/rutas_estudiante.dart';

class PantallaInicioEstudiante extends StatelessWidget {
  const PantallaInicioEstudiante({required this.controladorSesion, super.key});

  final ControladorSesion controladorSesion;

  @override
  Widget build(BuildContext context) {
    final usuario = controladorSesion.sesion!.usuario;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Identidad Digital UPT'),
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
            'Hola, ${usuario.nombres}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text(usuario.codigoInstitucional),
          const SizedBox(height: 24),
          Card(
            child: ListTile(
              leading: const Icon(Icons.badge_outlined),
              title: const Text('Consultar identidad digital'),
              subtitle: const Text(
                'Perfil y estado autorizado por el backend.',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () =>
                  Navigator.pushNamed(context, RutasEstudiante.identidad),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.qr_code_2),
              title: const Text('Solicitar código QR'),
              subtitle: const Text(
                'Credencial temporal para solicitar ingreso.',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () =>
                  Navigator.pushNamed(context, RutasEstudiante.codigoQr),
            ),
          ),
        ],
      ),
    );
  }
}
