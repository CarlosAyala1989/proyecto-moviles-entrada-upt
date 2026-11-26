enum SeccionIntranet {
  notas('notas_actuales', 'Notas actuales'),
  record('cursos_actuales', 'Récord académico'),
  horario('horario', 'Horario'),
  asistencia('asistencia', 'Asistencia'),
  extracurriculares('cursos_extracurriculares', 'Cursos extracurriculares'),
  pagos('economia_inicio', 'Cuotas y vencimientos'),
  comprobantes('comprobantes_electronicos', 'Comprobantes electrónicos'),
  pasarela('pasarela', 'Pasarela de pagos');

  const SeccionIntranet(this.clave, this.titulo);

  final String clave;
  final String titulo;
}

class DatosEstudianteIntranet {
  DatosEstudianteIntranet.desdeJson(Map<String, dynamic> json)
    : estado = json['estado'] as String,
      fechaExtraccion = DateTime.tryParse(
        json['fecha_extraccion'] as String? ?? '',
      ),
      secciones = Map.unmodifiable({
        for (final seccion in SeccionIntranet.values)
          if (json[seccion.clave] case final Map<String, dynamic> datos)
            seccion: PaginaIntranet.desdeJson(datos),
      }),
      periodos = _objetos(
        json['periodos_anteriores'],
      ).map(PaginaIntranet.desdeJson).toList(growable: false);

  final String estado;
  final DateTime? fechaExtraccion;
  final Map<SeccionIntranet, PaginaIntranet> secciones;
  final List<PaginaIntranet> periodos;
}

class PaginaIntranet {
  PaginaIntranet.desdeJson(Map<String, dynamic> json)
    : estado = json['estado'] as String,
      periodo = json['periodo'] as String?,
      texto = _textos(json['texto']),
      tablas = _objetos(
        json['tablas'],
      ).map(TablaIntranet.desdeJson).toList(growable: false),
      cursos = _objetos(
        json['cursos_con_notas'],
      ).map(CursoIntranet.desdeJson).toList(growable: false),
      total = json['total'] as String?,
      deudaBiblioteca = json['deuda_biblioteca'] as String?;

  final String estado;
  final String? periodo;
  final List<String> texto;
  final List<TablaIntranet> tablas;
  final List<CursoIntranet> cursos;
  final String? total;
  final String? deudaBiblioteca;

  bool get leida => estado == 'leida';
}

class TablaIntranet {
  TablaIntranet.desdeJson(Map<String, dynamic> json)
    : titulo = json['titulo'] as String?,
      cabeceras = _textos(json['cabeceras']),
      filas = (json['filas'] as List? ?? const [])
          .map(_textos)
          .toList(growable: false);

  final String? titulo;
  final List<String> cabeceras;
  final List<List<String>> filas;
}

class CursoIntranet {
  CursoIntranet.desdeJson(Map<String, dynamic> json)
    : nombre = json['curso'] as String,
      unidades = _objetos(
        json['unidades'],
      ).map(UnidadIntranet.desdeJson).toList(growable: false);

  final String nombre;
  final List<UnidadIntranet> unidades;
}

class UnidadIntranet {
  UnidadIntranet.desdeJson(Map<String, dynamic> json)
    : nombre = json['unidad'] as String,
      peso = json['peso_unidad'] as String?,
      evaluaciones = _objetos(json['evaluaciones']),
      resumen = _textos(json['resumen_final']);

  final String nombre;
  final String? peso;
  final List<Map<String, dynamic>> evaluaciones;
  final List<String> resumen;
}

List<Map<String, dynamic>> _objetos(Object? valor) => valor is List
    ? valor.whereType<Map<String, dynamic>>().toList(growable: false)
    : const [];

List<String> _textos(Object? valor) => valor is List
    ? valor.whereType<String>().toList(growable: false)
    : const [];
