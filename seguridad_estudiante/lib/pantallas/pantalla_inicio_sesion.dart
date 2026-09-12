import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

class PantallaInicioSesion extends StatefulWidget {
  const PantallaInicioSesion({required this.controladorSesion, super.key});

  final ControladorSesion controladorSesion;

  @override
  State<PantallaInicioSesion> createState() => _EstadoPantallaInicioSesion();
}

class _EstadoPantallaInicioSesion extends State<PantallaInicioSesion> {
  final _formulario = GlobalKey<FormState>();
  final _identificador = TextEditingController();
  final _contrasena = TextEditingController();
  bool _ocultarContrasena = true;

  @override
  void dispose() {
    _identificador.dispose();
    _contrasena.dispose();
    super.dispose();
  }

  Future<void> _iniciarSesion() async {
    if (!_formulario.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    await widget.controladorSesion.iniciarSesion(
      _identificador.text.trim(),
      _contrasena.text,
    );
    _contrasena.clear();
  }

  @override
  Widget build(BuildContext context) {
    final procesando = widget.controladorSesion.estaProcesando;
    final mensajeError = widget.controladorSesion.mensajeError;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formulario,
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
                    const SizedBox(height: 8),
                    const Text(
                      'Acceso temporal para usuarios registrados y habilitados.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _identificador,
                      enabled: !procesando,
                      decoration: const InputDecoration(
                        labelText: 'Código o correo institucional',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      validator: (valor) =>
                          valor == null || valor.trim().isEmpty
                          ? 'Ingresa tu identificador.'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _contrasena,
                      enabled: !procesando,
                      obscureText: _ocultarContrasena,
                      decoration: InputDecoration(
                        labelText: 'Contraseña',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          onPressed: () => setState(
                            () => _ocultarContrasena = !_ocultarContrasena,
                          ),
                          icon: Icon(
                            _ocultarContrasena
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (valor) => valor == null || valor.isEmpty
                          ? 'Ingresa tu contraseña.'
                          : null,
                      onFieldSubmitted: (_) {
                        if (!procesando) _iniciarSesion();
                      },
                    ),
                    if (mensajeError != null) ...[
                      const SizedBox(height: 16),
                      Semantics(
                        liveRegion: true,
                        child: Text(
                          mensajeError,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: procesando ? null : _iniciarSesion,
                      icon: procesando
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.login),
                      label: const Text('Iniciar sesión'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
