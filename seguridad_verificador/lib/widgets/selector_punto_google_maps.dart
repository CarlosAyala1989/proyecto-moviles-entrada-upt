import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

typedef CargadorMapaGoogle =
    Future<Uint8List> Function({
      required double latitud,
      required double longitud,
      required int zoom,
    });

class SelectorPuntoGoogleMaps extends StatefulWidget {
  const SelectorPuntoGoogleMaps({
    required this.latitud,
    required this.longitud,
    required this.cargarMapa,
    this.alSeleccionar,
    this.zoomInicial = 18,
    this.interactivo = true,
    super.key,
  });

  final double latitud;
  final double longitud;
  final CargadorMapaGoogle cargarMapa;
  final ValueChanged<({double latitud, double longitud})>? alSeleccionar;
  final int zoomInicial;
  final bool interactivo;

  @override
  State<SelectorPuntoGoogleMaps> createState() =>
      _EstadoSelectorPuntoGoogleMaps();
}

class _EstadoSelectorPuntoGoogleMaps extends State<SelectorPuntoGoogleMaps> {
  static const _anchoSolicitud = 600.0;
  static const _altoSolicitud = 340.0;

  Uint8List? _imagen;
  String? _error;
  bool _cargando = false;
  int _revision = 0;
  late int _zoom;

  @override
  void initState() {
    super.initState();
    _zoom = widget.zoomInicial.clamp(1, 20);
    unawaited(_cargar());
  }

  @override
  void didUpdateWidget(covariant SelectorPuntoGoogleMaps oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.latitud != widget.latitud ||
        oldWidget.longitud != widget.longitud ||
        oldWidget.cargarMapa != widget.cargarMapa) {
      unawaited(_cargar());
    }
  }

  Future<void> _cargar() async {
    final revision = ++_revision;
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final imagen = await widget.cargarMapa(
        latitud: widget.latitud,
        longitud: widget.longitud,
        zoom: _zoom,
      );
      if (!mounted || revision != _revision) return;
      setState(() => _imagen = imagen);
    } on ExcepcionApi catch (error) {
      if (!mounted || revision != _revision) return;
      setState(() => _error = error.mensajeParaUsuario);
    } catch (_) {
      if (!mounted || revision != _revision) return;
      setState(() => _error = 'No pudimos cargar el mapa.');
    } finally {
      if (mounted && revision == _revision) {
        setState(() => _cargando = false);
      }
    }
  }

  void _cambiarZoom(int diferencia) {
    final nuevo = (_zoom + diferencia).clamp(1, 20);
    if (nuevo == _zoom) return;
    setState(() => _zoom = nuevo);
    unawaited(_cargar());
  }

  void _seleccionar(Offset posicion, Size tamano) {
    if (!widget.interactivo ||
        widget.alSeleccionar == null ||
        _imagen == null ||
        _error != null ||
        _cargando) {
      return;
    }
    final coordenada = coordenadaDesdeToqueMapa(
      centroLatitud: widget.latitud,
      centroLongitud: widget.longitud,
      zoom: _zoom,
      desplazamientoX: (posicion.dx / tamano.width - 0.5) * _anchoSolicitud,
      desplazamientoY: (posicion.dy / tamano.height - 0.5) * _altoSolicitud,
    );
    widget.alSeleccionar!(coordenada);
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, restricciones) {
      final ancho = math.min(restricciones.maxWidth, _anchoSolicitud);
      final alto = ancho * _altoSolicitud / _anchoSolicitud;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.interactivo
                ? 'Toca el mapa para establecer el punto exacto.'
                : 'Ubicación de la puerta seleccionada.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Center(
            child: Semantics(
              image: true,
              label:
                  'Mapa de Google en ${widget.latitud.toStringAsFixed(6)}, ${widget.longitud.toStringAsFixed(6)}',
              child: GestureDetector(
                key: const ValueKey('selector-punto-google-maps'),
                onTapUp: (detalle) =>
                    _seleccionar(detalle.localPosition, Size(ancho, alto)),
                child: SizedBox(
                  width: ancho,
                  height: alto,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        ColoredBox(
                          color: Theme.of(
                            context,
                          ).colorScheme.surfaceContainerHighest,
                        ),
                        if (_imagen != null)
                          Image.memory(
                            _imagen!,
                            fit: BoxFit.fill,
                            gaplessPlayback: true,
                            errorBuilder: (_, _, _) => const Center(
                              child: Text('La imagen del mapa no es válida.'),
                            ),
                          ),
                        if (_error != null)
                          ColoredBox(
                            color: Theme.of(context).colorScheme.surface,
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.all(20),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.map_outlined, size: 42),
                                    const SizedBox(height: 8),
                                    Text(_error!, textAlign: TextAlign.center),
                                    const SizedBox(height: 8),
                                    OutlinedButton.icon(
                                      onPressed: _cargar,
                                      icon: const Icon(Icons.refresh),
                                      label: const Text('Reintentar'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        if (_cargando)
                          const ColoredBox(
                            color: Color(0x33000000),
                            child: Center(child: CircularProgressIndicator()),
                          ),
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Card(
                            margin: EdgeInsets.zero,
                            child: Column(
                              children: [
                                IconButton(
                                  tooltip: 'Acercar mapa',
                                  onPressed: _zoom < 20
                                      ? () => _cambiarZoom(1)
                                      : null,
                                  icon: const Icon(Icons.add),
                                ),
                                const Divider(height: 1),
                                IconButton(
                                  tooltip: 'Alejar mapa',
                                  onPressed: _zoom > 1
                                      ? () => _cambiarZoom(-1)
                                      : null,
                                  icon: const Icon(Icons.remove),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Punto: ${widget.latitud.toStringAsFixed(7)}, '
            '${widget.longitud.toStringAsFixed(7)}',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      );
    },
  );
}

({double latitud, double longitud}) coordenadaDesdeToqueMapa({
  required double centroLatitud,
  required double centroLongitud,
  required int zoom,
  required double desplazamientoX,
  required double desplazamientoY,
}) {
  final tamanoMundo = 256.0 * math.pow(2, zoom);
  final latitudLimitada = centroLatitud.clamp(-85.05112878, 85.05112878);
  final seno = math.sin(latitudLimitada * math.pi / 180);
  final centroX = (centroLongitud + 180) / 360 * tamanoMundo;
  final centroY =
      (0.5 - math.log((1 + seno) / (1 - seno)) / (4 * math.pi)) * tamanoMundo;

  final x = (centroX + desplazamientoX) % tamanoMundo;
  final y = (centroY + desplazamientoY).clamp(0.0, tamanoMundo);
  final longitud = x / tamanoMundo * 360 - 180;
  final n = math.pi - 2 * math.pi * y / tamanoMundo;
  final latitud = 180 / math.pi * math.atan(0.5 * (math.exp(n) - math.exp(-n)));
  return (latitud: latitud, longitud: longitud);
}
