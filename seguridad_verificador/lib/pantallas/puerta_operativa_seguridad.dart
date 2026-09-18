import 'dart:async';
import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import '../controladores/controlador_validacion_ingresos.dart';

class PuertaOperativaSeguridad extends StatefulWidget {
  const PuertaOperativaSeguridad({
    required this.controlador,
    required this.sesion,
    required this.child,
    super.key,
  });
  final ControladorValidacionIngresos controlador;
  final ControladorSesion sesion;
  final Widget child;
  @override
  State<PuertaOperativaSeguridad> createState() => _EstadoPuertaOperativa();
}

class _EstadoPuertaOperativa extends State<PuertaOperativaSeguridad>
    with WidgetsBindingObserver {
  Timer? _temporizador;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.controlador.comprobarDisponibilidad();
    });
    _temporizador = Timer.periodic(
      const Duration(seconds: 30),
      (_) => widget.controlador.comprobarDisponibilidad(),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.controlador.comprobarDisponibilidad();
    }
  }

  @override
  void dispose() {
    _temporizador?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controlador,
    builder: (context, _) {
      if (widget.controlador.habilitadoPorUbicacion) return widget.child;
      final comprobando = widget.controlador.comprobandoUbicacion;
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
                      Icons.settings_suggest_outlined,
                      size: 72,
                      color: Theme.of(context).colorScheme.error,
                    ),
                    const SizedBox(height: 24),
                    Text(
                      comprobando
                          ? 'Comprobando tu ubicación'
                          : 'La aplicación necesita ayuda',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      widget.controlador.bloqueoUbicacion ??
                          'Necesitamos comprobar que estás cerca de tu puerta asignada antes de continuar.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    if (comprobando)
                      const CircularProgressIndicator()
                    else
                      FilledButton.icon(
                        onPressed: widget.controlador.comprobarDisponibilidad,
                        icon: const Icon(Icons.my_location),
                        label: const Text('Comprobar nuevamente'),
                      ),
                    TextButton(
                      onPressed: widget.sesion.cerrarSesion,
                      child: const Text('Cerrar sesión'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}
