import 'dart:convert';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'pantalla_datos_estudiante_intranet.dart';

class PantallaConsultaIntranet extends StatefulWidget {
  const PantallaConsultaIntranet({
    required this.cliente,
    required this.codigo,
    super.key,
  });

  final ContratoConsultaIntranet cliente;
  final String codigo;

  @override
  State<PantallaConsultaIntranet> createState() => _EstadoConsultaIntranet();
}

class _EstadoConsultaIntranet extends State<PantallaConsultaIntranet> {
  final _formulario = GlobalKey<FormState>();
  final _contrasena = TextEditingController();
  final _textoCaptcha = TextEditingController();
  CaptchaIntranet? _captcha;
  Uint8List? _imagen;
  bool _cargandoImagen = false;
  bool _consultando = false;
  bool _ocultarContrasena = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargarImagen();
  }

  @override
  void dispose() {
    _contrasena.dispose();
    _textoCaptcha.dispose();
    super.dispose();
  }

  Future<void> _cargarImagen({bool conservarError = false}) async {
    if (_cargandoImagen || _consultando) return;
    _textoCaptcha.clear();
    setState(() {
      _captcha = null;
      _imagen = null;
      _cargandoImagen = true;
      if (!conservarError) _error = null;
    });
    try {
      final captcha = await widget.cliente.obtenerCaptchaIntranet();
      final imagen = base64Decode(captcha.imagenBase64);
      if (mounted) {
        setState(() {
          _captcha = captcha;
          _imagen = imagen;
        });
      }
    } on ExcepcionApi catch (error) {
      if (mounted) setState(() => _error = error.mensajeParaUsuario);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No pudimos cargar la imagen de seguridad.');
      }
    } finally {
      if (mounted) setState(() => _cargandoImagen = false);
    }
  }

  Future<void> _consultar() async {
    final captcha = _captcha;
    if (_consultando ||
        captcha == null ||
        !_formulario.currentState!.validate()) {
      return;
    }
    if (!DateTime.now().isBefore(captcha.expiraEn)) {
      setState(() => _error = mensajeErrorParaUsuario('CAPTCHA_EXPIRADO'));
      await _cargarImagen(conservarError: true);
      return;
    }
    FocusScope.of(context).unfocus();
    final contrasena = _contrasena.text;
    final textoCaptcha = _textoCaptcha.text;
    _contrasena.clear();
    _textoCaptcha.clear();
    setState(() {
      _captcha = null;
      _imagen = null;
      _error = null;
      _consultando = true;
      _ocultarContrasena = true;
    });

    String error;
    try {
      final datos = await widget.cliente.consultarDatosEstudianteIntranet(
        transaccionId: captcha.transaccionId,
        codigo: widget.codigo,
        contrasena: contrasena,
        captcha: textoCaptcha,
      );
      if (!mounted) return;
      if (datos.estado != 'no_disponible') {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => PantallaDatosEstudianteIntranet(datos: datos),
          ),
        );
        return;
      }
      error =
          'La intranet no devolvió tus datos académicos ni de pagos. Inténtalo de nuevo.';
    } on ExcepcionApi catch (excepcion) {
      error = excepcion.mensajeParaUsuario;
    } catch (_) {
      error =
          'No pudimos consultar tus datos de la intranet. Inténtalo de nuevo.';
    }
    if (!mounted) return;
    setState(() {
      _consultando = false;
      _error = error;
    });
    await _cargarImagen(conservarError: true);
  }

  @override
  Widget build(BuildContext context) {
    final captcha = _captcha;
    final ocupado = _cargandoImagen || _consultando;
    final tema = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Consultar intranet UPT')),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  'Datos académicos y pagos',
                  style: tema.textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Ingresa tu contraseña de intranet y el número de la imagen para consultar tus datos.',
                ),
                const SizedBox(height: 20),
                Text('Código institucional', style: tema.textTheme.labelLarge),
                Text(widget.codigo, style: tema.textTheme.titleMedium),
                const SizedBox(height: 20),
                if (_consultando) ...[
                  const LinearProgressIndicator(
                    semanticsLabel: 'Consultando tus datos en la intranet',
                  ),
                  const SizedBox(height: 12),
                  Semantics(
                    liveRegion: true,
                    child: const Text(
                      'Consultando la intranet. Esto puede tardar unos momentos.',
                    ),
                  ),
                ] else
                  Form(
                    key: _formulario,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextFormField(
                          controller: _contrasena,
                          keyboardType: TextInputType.number,
                          obscureText: _ocultarContrasena,
                          autocorrect: false,
                          enableSuggestions: false,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          decoration: InputDecoration(
                            labelText: 'Contraseña de intranet',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              tooltip: _ocultarContrasena
                                  ? 'Mostrar contraseña'
                                  : 'Ocultar contraseña',
                              icon: Icon(
                                _ocultarContrasena
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                              onPressed: () => setState(
                                () => _ocultarContrasena = !_ocultarContrasena,
                              ),
                            ),
                          ),
                          validator: (valor) => valor?.isNotEmpty == true
                              ? null
                              : 'Ingresa tu contraseña de intranet.',
                        ),
                        const SizedBox(height: 20),
                        if (_imagen case final imagen?)
                          Semantics(
                            label: 'Imagen de seguridad de la intranet',
                            image: true,
                            child: Image.memory(
                              imagen,
                              height: 70,
                              filterQuality: FilterQuality.none,
                              errorBuilder: (_, _, _) => const Text(
                                'No se pudo mostrar la imagen. Cámbiala para continuar.',
                              ),
                            ),
                          )
                        else if (_cargandoImagen)
                          const LinearProgressIndicator(
                            semanticsLabel: 'Cargando imagen de seguridad',
                          ),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: ocupado ? null : _cargarImagen,
                            icon: const Icon(Icons.refresh),
                            label: Text(
                              captcha == null
                                  ? 'Cargar imagen'
                                  : 'Cambiar imagen',
                            ),
                          ),
                        ),
                        TextFormField(
                          controller: _textoCaptcha,
                          enabled: captcha != null,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(5),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Número de la imagen',
                            prefixIcon: Icon(Icons.image_outlined),
                          ),
                          validator: (valor) => valor?.isNotEmpty == true
                              ? null
                              : 'Ingresa el número que aparece en la imagen.',
                          onFieldSubmitted: (_) => _consultar(),
                        ),
                        if (_error case final error?) ...[
                          const SizedBox(height: 12),
                          Semantics(
                            liveRegion: true,
                            child: Text(
                              error,
                              style: TextStyle(color: tema.colorScheme.error),
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: captcha == null ? null : _consultar,
                          child: const Text('Consultar datos'),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
