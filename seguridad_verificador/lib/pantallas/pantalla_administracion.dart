import '../servicios/coordenadas_maps.dart';
import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class PantallaAdministracion extends StatefulWidget {
  const PantallaAdministracion({
    required this.sesion,
    required this.api,
    super.key,
  });
  final ControladorSesion sesion;
  final ContratoAdministracion api;
  @override
  State<PantallaAdministracion> createState() => _EstadoAdministracion();
}

class _EstadoAdministracion extends State<PantallaAdministracion> {
  List<Map<String, dynamic>> _puertas = [];
  List<Map<String, dynamic>> _guardias = [];
  bool _cargando = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final token = await widget.sesion.obtenerTokenAcceso();
      final puertas = await widget.api.consultarPuertas(token);
      final guardias = await widget.api.consultarGuardias(token);
      if (mounted) {
        setState(() {
          _puertas = puertas;
          _guardias = guardias;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error is ExcepcionApi
              ? error.mensajeParaUsuario
              : 'No pudimos cargar la administración.',
        );
      }
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _editar(bool puerta, [Map<String, dynamic>? actual]) async {
    if (!puerta && !_puertas.any((p) => p['estado'] == 'ACTIVO')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Primero registra una puerta activa.')),
      );
      return;
    }
    final datos = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _FormularioAdministracion(
        puerta: puerta,
        actual: actual,
        puertas: _puertas,
      ),
    );
    if (datos == null) return;
    setState(() => _cargando = true);
    try {
      final token = await widget.sesion.obtenerTokenAcceso();
      if (puerta) {
        await widget.api.guardarPuerta(token, datos, id: actual?['id'] as int?);
      } else {
        await widget.api.guardarGuardia(
          token,
          datos,
          id: actual?['id'] as int?,
        );
      }
      await _cargar();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error is ExcepcionApi
              ? error.mensajeParaUsuario
              : 'No pudimos guardar los cambios.';
          _cargando = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Administración UPT'),
      actions: [
        IconButton(
          tooltip: 'Actualizar',
          onPressed: _cargando ? null : _cargar,
          icon: const Icon(Icons.refresh),
        ),
        IconButton(
          tooltip: 'Cerrar sesión',
          onPressed: widget.sesion.cerrarSesion,
          icon: const Icon(Icons.logout),
        ),
      ],
    ),
    body: _cargando
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                widget.sesion.sesion!.usuario.nombreCompleto,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Text(
                'Gestiona puertas y guardias. Tu acceso no requiere ubicación.',
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () => _editar(true),
                icon: const Icon(Icons.add_location_alt),
                label: const Text('Agregar puerta'),
              ),
              if (_puertas.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Aún no hay puertas. Registra las coordenadas y el radio permitido.',
                  ),
                ),
              ..._puertas.map(
                (p) => Card(
                  child: ListTile(
                    title: Text('${p['nombre']} (${p['codigo']})'),
                    subtitle: Text(
                      '${p['latitud']}, ${p['longitud']} · ${p['radio_permitido_metros']} m · ${p['estado']}',
                    ),
                    trailing: const Icon(Icons.edit),
                    onTap: () => _editar(true, p),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => _editar(false),
                icon: const Icon(Icons.person_add),
                label: const Text('Agregar guardia'),
              ),
              if (_guardias.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Aún no hay guardias registrados.'),
                ),
              ..._guardias.map(
                (g) => Card(
                  child: ListTile(
                    title: Text('${g['nombres']} ${g['apellidos']}'),
                    subtitle: Text(
                      '${g['usuario']} · ${g['punto_acceso_nombre'] ?? 'Sin puerta asignada'} · ${g['estado']}',
                    ),
                    trailing: const Icon(Icons.edit),
                    onTap: () => _editar(false, g),
                  ),
                ),
              ),
            ],
          ),
  );
}

class _FormularioAdministracion extends StatefulWidget {
  const _FormularioAdministracion({
    required this.puerta,
    required this.actual,
    required this.puertas,
  });
  final bool puerta;
  final Map<String, dynamic>? actual;
  final List<Map<String, dynamic>> puertas;
  @override
  State<_FormularioAdministracion> createState() => _EstadoFormulario();
}

class _EstadoFormulario extends State<_FormularioAdministracion> {
  final _formulario = GlobalKey<FormState>();
  final Map<String, TextEditingController> _campos = {};
  int? _puntoId;
  bool _activo = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    for (final clave
        in widget.puerta
            ? [
                'codigo',
                'nombre',
                'latitud',
                'longitud',
                'radio_permitido_metros',
                'coordenadas_maps',
              ]
            : ['usuario', 'nombres', 'apellidos', 'contrasena']) {
      _campos[clave] = TextEditingController(
        text:
            '${widget.actual?[clave] ?? (clave == 'radio_permitido_metros' ? '100' : '')}',
      );
    }
    _puntoId = widget.actual?['punto_acceso_id'] as int?;
    if (!widget.puertas.any(
      (p) => p['id'] == _puntoId && p['estado'] == 'ACTIVO',
    )) {
      _puntoId = null;
    }
    _activo = widget.actual == null || widget.actual!['estado'] == 'ACTIVO';
  }

  @override
  void dispose() {
    for (final campo in _campos.values) {
      campo.dispose();
    }
    super.dispose();
  }

  Widget _campo(
    String clave,
    String titulo, {
    bool numero = false,
    bool secreto = false,
    double? minimo,
    double? maximo,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      key: ValueKey(clave),
      controller: _campos[clave],
      obscureText: secreto,
      autocorrect: !secreto,
      enableSuggestions: !secreto,
      keyboardType: numero
          ? const TextInputType.numberWithOptions(decimal: true, signed: true)
          : TextInputType.text,
      decoration: InputDecoration(labelText: titulo),
      validator: (valor) {
        if (secreto && widget.actual != null && (valor ?? '').isEmpty) {
          return null;
        }
        if ((valor ?? '').trim().isEmpty) return 'Completa este campo.';
        if (secreto &&
            (valor!.length < 14 ||
                !RegExp(r'[a-z]').hasMatch(valor) ||
                !RegExp(r'[A-Z]').hasMatch(valor) ||
                !RegExp(r'[0-9]').hasMatch(valor) ||
                !RegExp(r'[^A-Za-z0-9]').hasMatch(valor))) {
          return 'Usa 14 caracteres o más, mayúsculas, minúsculas, número y símbolo.';
        }
        if (numero) {
          final n = double.tryParse(valor!.trim());
          if (n == null ||
              !n.isFinite ||
              (minimo != null && n < minimo) ||
              (maximo != null && n > maximo)) {
            return 'Introduce un número válido entre $minimo y $maximo.';
          }
        }
        return null;
      },
    ),
  );

  void _guardar() {
    if (!_formulario.currentState!.validate()) return;
    if (!widget.puerta && _puntoId == null) {
      setState(() => _error = 'Selecciona una puerta.');
      return;
    }
    final datos = <String, dynamic>{};
    for (final campo in _campos.entries) {
      if (campo.key == 'coordenadas_maps') continue;
      if (campo.key == 'contrasena' &&
          campo.value.text.isEmpty &&
          widget.actual != null) {
        continue;
      }
      datos[campo.key] =
          ['latitud', 'longitud', 'radio_permitido_metros'].contains(campo.key)
          ? double.parse(campo.value.text.trim())
          : (campo.key == 'contrasena'
                ? campo.value.text
                : campo.value.text.trim());
    }
    if (widget.puerta) {
      datos['estado'] = _activo ? 'ACTIVO' : 'INACTIVO';
    } else {
      datos['activo'] = _activo;
      datos['punto_acceso_id'] = _puntoId;
    }
    Navigator.pop(context, datos);
  }

  Future<void> _maps() async {
    final lat = double.tryParse(_campos['latitud']!.text);
    final lon = double.tryParse(_campos['longitud']!.text);
    final url = lat == null || lon == null
        ? Uri.parse('https://www.google.com/maps')
        : Uri.https('www.google.com', '/maps/search/', {
            'api': '1',
            'query': '$lat,$lon',
          });
    try {
      if (!await launchUrl(url, mode: LaunchMode.externalApplication) &&
          mounted) {
        setState(() => _error = 'No se pudo abrir Google Maps.');
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'No se pudo abrir el navegador.');
    }
  }

  void _pegarCoordenadas() {
    final coordenadas = leerCoordenadasMaps(_campos['coordenadas_maps']!.text);
    if (coordenadas == null) {
      setState(
        () => _error =
            'Copia las coordenadas decimales del punto en Google Maps: latitud, longitud. Los enlaces cortos o del centro de la cámara no indican el punto exacto.',
      );
      return;
    }
    _campos['latitud']!.text = '${coordenadas.latitud}';
    _campos['longitud']!.text = '${coordenadas.longitud}';
    setState(() => _error = null);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      '${widget.actual == null ? 'Agregar' : 'Editar'} ${widget.puerta ? 'puerta' : 'guardia'}',
    ),
    content: SizedBox(
      width: 480,
      child: SingleChildScrollView(
        child: Form(
          key: _formulario,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.puerta) ...[
                _campo('codigo', 'Código de puerta'),
                _campo('nombre', 'Nombre de puerta'),
                OutlinedButton.icon(
                  onPressed: _maps,
                  icon: const Icon(Icons.map),
                  label: const Text('Abrir Google Maps'),
                ),
                const Text(
                  'Marca el lugar en Maps, copia sus coordenadas y pégalas aquí. En computadora: clic derecho sobre el punto.',
                ),
                TextField(
                  controller: _campos['coordenadas_maps'],
                  decoration: const InputDecoration(
                    labelText: 'Coordenadas o enlace de Maps con coordenadas',
                  ),
                ),
                TextButton(
                  onPressed: _pegarCoordenadas,
                  child: const Text('Usar coordenadas copiadas'),
                ),
                _campo(
                  'latitud',
                  'Latitud',
                  numero: true,
                  minimo: -90,
                  maximo: 90,
                ),
                _campo(
                  'longitud',
                  'Longitud',
                  numero: true,
                  minimo: -180,
                  maximo: 180,
                ),
                _campo(
                  'radio_permitido_metros',
                  'Radio permitido (metros)',
                  numero: true,
                  minimo: 1,
                  maximo: 10000,
                ),
              ] else ...[
                _campo('nombres', 'Nombres'),
                _campo('apellidos', 'Apellidos'),
                _campo('usuario', 'Usuario'),
                _campo(
                  'contrasena',
                  widget.actual == null
                      ? 'Contraseña'
                      : 'Nueva contraseña (vacío para conservar)',
                  secreto: true,
                ),
                DropdownButtonFormField<int>(
                  initialValue: _puntoId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Puerta asignada',
                  ),
                  items: _puertasActivas(),
                  onChanged: (id) => _puntoId = id,
                ),
              ],
              SwitchListTile(
                title: const Text('Activo'),
                value: _activo,
                onChanged: (valor) => setState(() => _activo = valor),
              ),
              if (_error != null)
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancelar'),
      ),
      FilledButton(onPressed: _guardar, child: const Text('Guardar')),
    ],
  );
  List<DropdownMenuItem<int>> _puertasActivas() => widget.puertas
      .where((p) => p['estado'] == 'ACTIVO')
      .map(
        (p) => DropdownMenuItem(
          value: p['id'] as int,
          child: Text(p['nombre'] as String),
        ),
      )
      .toList();
}
