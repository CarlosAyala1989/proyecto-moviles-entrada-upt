import 'dart:convert';

import 'package:flutter/material.dart';

import '../controladores/controlador_verificacion_intranet.dart';

class PantallaVerificacionIntranet extends StatefulWidget {
  const PantallaVerificacionIntranet({required this.controlador, super.key});

  final ControladorVerificacionIntranet controlador;

  @override
  State<PantallaVerificacionIntranet> createState() =>
      _EstadoPantallaVerificacionIntranet();
}

class _EstadoPantallaVerificacionIntranet
    extends State<PantallaVerificacionIntranet> {
  final _formulario = GlobalKey<FormState>();
  final _codigo = TextEditingController();
  final _contrasena = TextEditingController();
  final _textoCaptcha = TextEditingController();
  bool _ocultarContrasena = true;

  @override
  void initState() {
    super.initState();
    widget.controlador.addListener(_actualizar);
    widget.controlador.cargarCaptcha();
  }

  @override
  void dispose() {
    widget.controlador.removeListener(_actualizar);
    _codigo.dispose();
    _contrasena.dispose();
    _textoCaptcha.dispose();
    super.dispose();
  }

  void _actualizar() {
    if (mounted) setState(() {});
  }

  Future<void> _verificar() async {
    if (!_formulario.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final codigo = _codigo.text.trim();
    final contrasena = _contrasena.text;
    final textoCaptcha = _textoCaptcha.text.trim();
    await widget.controlador.verificar(
      codigo: codigo,
      contrasena: contrasena,
      textoCaptcha: textoCaptcha,
    );
    if (!mounted) return;
    _contrasena.clear();
    _textoCaptcha.clear();
  }

  Future<void> _continuarGoogle() => widget.controlador.iniciarGoogle();

  @override
  Widget build(BuildContext context) {
    final controlador = widget.controlador;
    final captcha = controlador.captcha;
    final perfil = controlador.perfil;
    return Scaffold(
      appBar: AppBar(title: const Text('Verificar intranet')),
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
                    Text(
                      'Paso 1 de 2: Intranet UPT',
                      style: Theme.of(context).textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Ingresa personalmente tu código, contraseña de intranet y '
                      'el número de la imagen. No se guardarán en el dispositivo.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _codigo,
                      enabled: !controlador.estaProcesando,
                      keyboardType: TextInputType.number,
                      maxLength: 10,
                      decoration: const InputDecoration(
                        labelText: 'Código institucional',
                        prefixIcon: Icon(Icons.badge_outlined),
                      ),
                      validator: (valor) =>
                          RegExp(r'^\d{10}$').hasMatch(valor ?? '')
                          ? null
                          : 'Ingresa los 10 dígitos de tu código.',
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _contrasena,
                      enabled: !controlador.estaProcesando,
                      keyboardType: TextInputType.number,
                      obscureText: _ocultarContrasena,
                      maxLength: 6,
                      decoration: InputDecoration(
                        labelText: 'Contraseña de intranet',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: _ocultarContrasena
                              ? 'Mostrar contraseña'
                              : 'Ocultar contraseña',
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
                      validator: (valor) =>
                          RegExp(r'^\d{1,6}$').hasMatch(valor ?? '')
                          ? null
                          : 'Ingresa tu contraseña numérica.',
                    ),
                    const SizedBox(height: 12),
                    if (captcha != null)
                      Semantics(
                        label: 'Imagen de seguridad de la intranet',
                        image: true,
                        child: Image.memory(
                          base64Decode(captcha.imagenBase64),
                          height: 70,
                          filterQuality: FilterQuality.none,
                        ),
                      )
                    else if (controlador.estaProcesando)
                      const Center(child: CircularProgressIndicator())
                    else
                      OutlinedButton.icon(
                        onPressed: controlador.cargarCaptcha,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Cargar imagen'),
                      ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: controlador.estaProcesando
                          ? null
                          : controlador.cargarCaptcha,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Cambiar imagen'),
                    ),
                    TextFormField(
                      controller: _textoCaptcha,
                      enabled: !controlador.estaProcesando && captcha != null,
                      keyboardType: TextInputType.number,
                      maxLength: 5,
                      decoration: const InputDecoration(
                        labelText: 'Número de la imagen',
                        prefixIcon: Icon(Icons.image_outlined),
                      ),
                      validator: (valor) =>
                          RegExp(r'^\d{1,5}$').hasMatch(valor ?? '')
                          ? null
                          : 'Ingresa el número mostrado en la imagen.',
                    ),
                    if (controlador.mensajeError case final mensaje?) ...[
                      const SizedBox(height: 16),
                      Text(
                        mensaje,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    if (controlador.mensajeEstado case final mensaje?) ...[
                      const SizedBox(height: 16),
                      Text(mensaje, textAlign: TextAlign.center),
                    ],
                    if (perfil != null) ...[
                      const SizedBox(height: 16),
                      Card(
                        color: Theme.of(context).colorScheme.primaryContainer,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(
                            'Intranet verificada: ${perfil.nombreApellidos} '
                            '(${perfil.codigo}).\n\nPaso 2 de 2: usa la cuenta '
                            'Google institucional que termina en '
                            '@virtual.upt.pe.',
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed:
                          controlador.estaProcesando ||
                              captcha == null ||
                              perfil != null
                          ? null
                          : _verificar,
                      icon: controlador.estaProcesando
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.verified_user_outlined),
                      label: const Text('Verificar intranet'),
                    ),
                    if (perfil != null) ...[
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: controlador.estaProcesando
                            ? null
                            : _continuarGoogle,
                        icon: controlador.estaProcesando
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.account_circle_outlined),
                        label: const Text('Continuar con Google institucional'),
                      ),
                    ],
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
