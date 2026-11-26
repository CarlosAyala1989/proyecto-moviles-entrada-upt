import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';

class PantallaDatosEstudianteIntranet extends StatelessWidget {
  const PantallaDatosEstudianteIntranet({required this.datos, super.key});

  final DatosEstudianteIntranet datos;

  @override
  Widget build(BuildContext context) {
    final fecha = datos.fechaExtraccion?.toLocal();
    return Scaffold(
      appBar: AppBar(title: const Text('Datos académicos y pagos')),
      body: _ListaIntranet(
        children: [
          if (fecha != null)
            Text(
              'Consulta del ${_dosDigitos(fecha.day)}/${_dosDigitos(fecha.month)}/${fecha.year} · ${_dosDigitos(fecha.hour)}:${_dosDigitos(fecha.minute)}',
            ),
          if (datos.estado == 'parcial') ...[
            const SizedBox(height: 12),
            const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.info_outline),
              title: Text('Algunas secciones no están disponibles'),
              subtitle: Text(
                'Puedes revisar la información que devolvió la intranet.',
              ),
            ),
          ],
          const _Encabezado('Información académica'),
          for (final seccion in [
            SeccionIntranet.notas,
            SeccionIntranet.record,
            SeccionIntranet.horario,
            SeccionIntranet.asistencia,
            SeccionIntranet.extracurriculares,
          ])
            _OpcionSeccion(seccion: seccion, pagina: datos.secciones[seccion]),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: const Text('Períodos académicos'),
            subtitle: datos.periodos.isEmpty
                ? const Text('La intranet no devolvió períodos.')
                : null,
            enabled: datos.periodos.isNotEmpty,
            children: [
              for (final pagina in datos.periodos)
                _OpcionPagina(
                  titulo: pagina.periodo ?? 'Período académico',
                  pagina: pagina,
                ),
            ],
          ),
          const _Encabezado('Pagos'),
          for (final seccion in [
            SeccionIntranet.pagos,
            SeccionIntranet.comprobantes,
            SeccionIntranet.pasarela,
          ])
            _OpcionSeccion(seccion: seccion, pagina: datos.secciones[seccion]),
        ],
      ),
    );
  }

  String _dosDigitos(int valor) => valor.toString().padLeft(2, '0');
}

class _ListaIntranet extends StatelessWidget {
  const _ListaIntranet({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 860),
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: children,
          ),
        ),
      ),
    );
  }
}

class _Encabezado extends StatelessWidget {
  const _Encabezado(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 6),
      child: Semantics(
        header: true,
        child: Text(texto, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}

class _OpcionSeccion extends StatelessWidget {
  const _OpcionSeccion({required this.seccion, required this.pagina});

  final SeccionIntranet seccion;
  final PaginaIntranet? pagina;

  @override
  Widget build(BuildContext context) {
    return _OpcionPagina(
      titulo: seccion.titulo,
      pagina: pagina,
      seccion: seccion,
    );
  }
}

class _OpcionPagina extends StatelessWidget {
  const _OpcionPagina({
    required this.titulo,
    required this.pagina,
    this.seccion,
  });

  final String titulo;
  final PaginaIntranet? pagina;
  final SeccionIntranet? seccion;

  @override
  Widget build(BuildContext context) {
    final pagina = this.pagina;
    final disponible = pagina?.leida == true;
    final descripcion = switch (pagina?.estado) {
      'leida' => null,
      'requiere_autenticacion' => 'La pasarela solicita su propio acceso.',
      'redirigido_al_acceso' => 'La sesión de intranet venció.',
      'error' => 'No se pudo consultar en este momento.',
      _ => 'La intranet no devolvió esta información.',
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(titulo),
      subtitle: descripcion == null ? null : Text(descripcion),
      trailing: disponible ? const Icon(Icons.chevron_right) : null,
      onTap: disponible
          ? () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => _DetallePagina(
                  titulo: titulo,
                  pagina: pagina!,
                  seccion: seccion,
                ),
              ),
            )
          : null,
    );
  }
}

class _DetallePagina extends StatelessWidget {
  const _DetallePagina({
    required this.titulo,
    required this.pagina,
    this.seccion,
  });

  final String titulo;
  final PaginaIntranet pagina;
  final SeccionIntranet? seccion;

  @override
  Widget build(BuildContext context) {
    final tablasConCabecera = pagina.tablas
        .where((tabla) => tabla.cabeceras.isNotEmpty)
        .toList();
    final tablas = tablasConCabecera.isEmpty
        ? pagina.tablas
        : tablasConCabecera;
    final asistencias = seccion == SeccionIntranet.asistencia
        ? pagina.texto
              .where((linea) => linea.startsWith('Asistencia al curso de '))
              .toList()
        : const <String>[];
    final notasDetalladas = pagina.cursos.any(
      (curso) => curso.unidades.isNotEmpty,
    );
    final esPagos = seccion == SeccionIntranet.pagos;
    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: _ListaIntranet(
        children: [
          if (pagina.total case final total?) ...[
            Text(
              'Total pendiente · S/ $total',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
          ],
          if (pagina.deudaBiblioteca case final deuda?) ...[
            Text(deuda),
            const SizedBox(height: 16),
          ],
          if (notasDetalladas)
            for (final curso in pagina.cursos) _NotasCurso(curso: curso)
          else if (esPagos)
            for (final tabla in tablas) _CuotasIntranet(tabla: tabla)
          else
            for (final (indice, tabla) in tablas.indexed) ...[
              _TablaIntranet(
                tabla: tabla,
                titulo: asistencias.length == tablas.length
                    ? asistencias[indice]
                    : tabla.titulo,
              ),
              const SizedBox(height: 16),
            ],
          if (!esPagos && pagina.texto.isNotEmpty)
            if (tablas.isEmpty && !notasDetalladas)
              Text(pagina.texto.join('\n'))
            else
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('Ver texto de la intranet'),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(pagina.texto.join('\n')),
                  ),
                ],
              ),
          if (tablas.isEmpty &&
              !notasDetalladas &&
              pagina.texto.isEmpty &&
              pagina.deudaBiblioteca == null)
            const Text('La intranet no mostró registros para esta sección.'),
        ],
      ),
    );
  }
}

class _CuotasIntranet extends StatelessWidget {
  const _CuotasIntranet({required this.tabla});

  final TablaIntranet tabla;

  @override
  Widget build(BuildContext context) {
    final cuotas = tabla.filas
        .where(
          (fila) =>
              fila.isNotEmpty && !fila.first.toLowerCase().startsWith('total'),
        )
        .toList();
    if (cuotas.isEmpty) {
      return const Text('No hay cuotas pendientes en esta consulta.');
    }

    final descripcion = tabla.cabeceras.indexWhere(
      (nombre) => ['descripción', 'descripcion'].contains(nombre.toLowerCase()),
    );
    final estilo = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final fila in cuotas) ...[
          const Divider(),
          if (descripcion >= 0 && descripcion < fila.length)
            Text(fila[descripcion], style: estilo.titleMedium),
          for (final (indice, valor) in fila.indexed)
            if (indice != descripcion && valor.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  indice < tabla.cabeceras.length &&
                          tabla.cabeceras[indice].isNotEmpty
                      ? '${tabla.cabeceras[indice]} · $valor'
                      : valor,
                ),
              ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _NotasCurso extends StatelessWidget {
  const _NotasCurso({required this.curso});

  final CursoIntranet curso;

  @override
  Widget build(BuildContext context) {
    final estilos = Theme.of(context).textTheme;
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: Text(curso.nombre),
      subtitle: curso.unidades.isEmpty
          ? const Text('Sin unidades publicadas.')
          : null,
      enabled: curso.unidades.isNotEmpty,
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final unidad in curso.unidades) ...[
          const SizedBox(height: 8),
          Text(unidad.nombre, style: estilos.titleMedium),
          if (unidad.peso case final peso?) Text('Peso de la unidad · $peso'),
          for (final evaluacion in unidad.evaluaciones)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(evaluacion['Criterio'] as String? ?? 'Evaluación'),
              subtitle: Text(
                [
                  if (evaluacion['celdas'] case final List<dynamic> celdas)
                    celdas
                        .whereType<String>()
                        .where((valor) => valor.isNotEmpty)
                        .join(' · ')
                  else ...[
                    for (final etiqueta in ['Descripción', 'Peso C.', 'Fecha'])
                      if (evaluacion[etiqueta] case final String valor
                          when valor.isNotEmpty)
                        etiqueta == 'Peso C.' ? 'Peso · $valor' : valor,
                    if (evaluacion['Nota'] case final String nota
                        when nota.isNotEmpty)
                      'Nota · $nota',
                  ],
                ].join('\n'),
              ),
            ),
          if (unidad.resumen.any((valor) => valor.isNotEmpty))
            Text(unidad.resumen.where((valor) => valor.isNotEmpty).join(' · ')),
          const Divider(),
        ],
      ],
    );
  }
}

class _TablaIntranet extends StatelessWidget {
  const _TablaIntranet({required this.tabla, this.titulo});

  final TablaIntranet tabla;
  final String? titulo;

  @override
  Widget build(BuildContext context) {
    final filas = tabla.filas.where((fila) => fila.isNotEmpty).toList();
    final columnas = tabla.cabeceras.length;
    final tema = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (titulo case final titulo?) ...[
          Text(titulo, style: tema.textTheme.titleMedium),
          const SizedBox(height: 8),
        ],
        if (filas.isEmpty)
          const Text('Sin registros.')
        else
          LayoutBuilder(
            builder: (context, limites) => SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: limites.maxWidth),
                child: IntrinsicWidth(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (columnas > 0)
                        ColoredBox(
                          color: tema.colorScheme.surfaceContainer,
                          child: _fila(
                            tabla.cabeceras,
                            tema.textTheme.labelLarge,
                          ),
                        ),
                      for (final fila in filas) ...[
                        if (fila.length == columnas || columnas == 0)
                          _fila(fila)
                        else if (fila.length < columnas && fila.length > 2)
                          _fila([
                            ...fila,
                            ...List.filled(columnas - fila.length, ''),
                          ])
                        else
                          Padding(
                            padding: const EdgeInsets.all(10),
                            child: Text(
                              fila
                                  .where((valor) => valor.isNotEmpty)
                                  .join(' · '),
                            ),
                          ),
                        const Divider(height: 1),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _fila(List<String> celdas, [TextStyle? estilo]) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (indice, celda) in celdas.indexed)
          SizedBox(
            width: _ancho(indice),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Text(celda, style: estilo),
            ),
          ),
      ],
    );
  }

  double _ancho(int indice) {
    final nombre = indice < tabla.cabeceras.length
        ? tabla.cabeceras[indice].toLowerCase()
        : '';
    return switch (nombre) {
      'nro' || 'nota' || 'credito' || 'crédito' => 70,
      'asignatura' || 'curso' || 'descripción' || 'dependencia' => 220,
      _ => tabla.cabeceras.isEmpty ? 220 : 112,
    };
  }
}
