import 'dart:async';
import 'dart:typed_data';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/aplicacion/aplicacion_seguridad.dart';
import 'package:seguridad_verificador/controladores/controlador_validacion_ingresos.dart';
import 'package:seguridad_verificador/servicios/proveedor_ubicacion.dart';
import 'ayudas/dobles_hito_11.dart';

class ClienteOperativoFalso extends ClienteSeguridadFalso
    implements ContratoAdministracion, ContratoControlSeguridad {
  ClienteOperativoFalso({this.esAdmin = false})
    : super(resultadoValidacion: crearResultadoAutorizado());
  final bool esAdmin;
  bool fuera = true;
  int comprobaciones = 0;
  Map<String, dynamic>? guardiaGuardado;
  Map<String, dynamic>? puertaGuardada;
  int solicitudesMapa = 0;
  @override
  SesionUsuario get sesion => esAdmin
      ? super.sesion.conUsuario(
          const UsuarioSesion(
            id: 21,
            codigoInstitucional: 'ADMIN-UPT',
            correoInstitucional: 'admin@example.invalid',
            nombres: 'Administrador',
            apellidos: 'UPT',
            roles: ['ADMINISTRADOR'],
          ),
        )
      : super.sesion;
  @override
  Future<Map<String, dynamic>> comprobarUbicacionSeguridad(
    String tokenAcceso,
    UbicacionReportada ubicacion,
  ) async {
    comprobaciones++;
    if (fuera) {
      throw const ExcepcionApi(
        codigo: 'SEGURIDAD_FUERA_DE_ZONA',
        mensaje: 'Fuera de zona.',
      );
    }
    return {
      'habilitado': true,
      'punto_acceso': {'codigo': 'PUERTA-01'},
    };
  }

  @override
  Future<List<Map<String, dynamic>>> consultarPuertas(
    String tokenAcceso,
  ) async => [
    {
      'id': 1,
      'codigo': 'PUERTA-01',
      'nombre': 'Puerta principal',
      'latitud': 1,
      'longitud': 1,
      'radio_permitido_metros': 100,
      'estado': 'ACTIVO',
    },
  ];
  @override
  Future<Uint8List> obtenerMapaEstatico(
    String tokenAcceso, {
    required double latitud,
    required double longitud,
    required int zoom,
    int ancho = 600,
    int alto = 340,
  }) async {
    solicitudesMapa++;
    throw const ExcepcionApi(
      codigo: 'GOOGLE_MAPS_NO_CONFIGURADO',
      mensaje: 'Google Maps no está configurado.',
    );
  }

  @override
  Future<List<Map<String, dynamic>>> consultarGuardias(
    String tokenAcceso,
  ) async => [];
  @override
  Future<void> guardarPuerta(
    String tokenAcceso,
    Map<String, dynamic> datos, {
    int? id,
  }) async {
    puertaGuardada = datos;
  }

  @override
  Future<void> guardarGuardia(
    String tokenAcceso,
    Map<String, dynamic> datos, {
    int? id,
  }) async {
    guardiaGuardado = datos;
  }
}

class ProveedorUbicacionPendiente implements ProveedorUbicacion {
  ProveedorUbicacionPendiente(this.resultado);
  final Future<UbicacionReportada> resultado;

  @override
  Future<UbicacionReportada> obtenerUbicacionActual() => resultado;
}

void main() {
  test(
    'perder el GPS al consultar historial bloquea la operación inmediatamente',
    () async {
      final cliente = ClienteOperativoFalso();
      final sesion = ControladorSesion(
        clienteApi: cliente,
        almacenSesion: AlmacenSesionFalso(),
        rolesPermitidos: const {'SEGURIDAD'},
      );
      await sesion.iniciarSesion('usuario', 'clave');
      final controlador = ControladorValidacionIngresos(
        clienteApi: cliente,
        controladorSesion: sesion,
        proveedorUbicacion: ProveedorUbicacionFalso(
          ubicacion: crearUbicacion(),
          error: const ExcepcionUbicacion('Activa el GPS.'),
        ),
        controlSeguridadApi: cliente,
      );
      addTearDown(controlador.dispose);
      addTearDown(sesion.dispose);
      controlador.habilitadoPorUbicacion = true;
      expect(await controlador.cargarHistorial(), isFalse);
      expect(controlador.habilitadoPorUbicacion, isFalse);
      expect(controlador.bloqueoUbicacion, 'Activa el GPS.');
      expect(controlador.historial.fase, FaseCarga.error);
    },
  );
  Future<
    ({
      ControladorValidacionIngresos controlador,
      ProveedorUbicacionFalso ubicacion,
    })
  >
  montar(
    WidgetTester tester,
    ClienteOperativoFalso cliente, {
    ProveedorUbicacion? proveedorAdministracion,
  }) async {
    final sesion = ControladorSesion(
      clienteApi: cliente,
      almacenSesion: AlmacenSesionFalso(),
      rolesPermitidos: const {'ADMINISTRADOR', 'SEGURIDAD'},
    );
    await sesion.iniciarSesion('usuario', 'clave');
    final ubicacion = ProveedorUbicacionFalso(ubicacion: crearUbicacion());
    final controlador = ControladorValidacionIngresos(
      clienteApi: cliente,
      controladorSesion: sesion,
      proveedorUbicacion: ubicacion,
      controlSeguridadApi: cliente,
    );
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      controlador.dispose();
      sesion.dispose();
    });
    await tester.pumpWidget(
      AplicacionSeguridad(
        controladorSesion: sesion,
        controladorValidacion: controlador,
        clienteAdministracion: cliente,
        proveedorUbicacionAdministracion: proveedorAdministracion ?? ubicacion,
      ),
    );
    await tester.pumpAndSettle();
    return (controlador: controlador, ubicacion: ubicacion);
  }

  testWidgets(
    'administrador abre el panel desde cualquier lugar sin consultar GPS',
    (tester) async {
      final cliente = ClienteOperativoFalso(esAdmin: true);
      final estado = await montar(tester, cliente);
      expect(find.text('Administración UPT'), findsOneWidget);
      expect(find.text('Agregar puerta'), findsOneWidget);
      expect(cliente.comprobaciones, 0);
      expect(estado.ubicacion.solicitudes, 0);
    },
  );

  testWidgets(
    'guardia fuera de zona ve el bloqueo y puede reintentar al acercarse',
    (tester) async {
      final cliente = ClienteOperativoFalso();
      final estado = await montar(tester, cliente);
      expect(find.text('La aplicación necesita ayuda'), findsOneWidget);
      expect(find.text('Escanear código QR'), findsNothing);
      cliente.fuera = false;
      await tester.tap(find.text('Comprobar nuevamente'));
      await tester.pumpAndSettle();
      expect(find.text('Escanear código QR'), findsOneWidget);
      expect(estado.controlador.puntoAccesoCodigo, 'PUERTA-01');
      cliente.fuera = true;
      await estado.controlador.comprobarDisponibilidad();
      await tester.pumpAndSettle();
      expect(find.text('Escanear código QR'), findsNothing);
      expect(find.text('La aplicación necesita ayuda'), findsOneWidget);
    },
  );

  testWidgets(
    'administrador registra nombres, usuario, contraseña y puerta del guardia',
    (tester) async {
      final cliente = ClienteOperativoFalso(esAdmin: true);
      await montar(tester, cliente);
      await tester.tap(find.text('Agregar guardia'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Nombres'),
        'Juan Pedro',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Apellidos'),
        'Pérez Torres',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Usuario'),
        'guardia-01',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Contraseña'),
        'Guardia-Seguro!2026',
      );
      await tester.tap(find.text('Puerta asignada'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Puerta principal').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      expect(cliente.solicitudesMapa, 0);
      expect(cliente.guardiaGuardado, {
        'usuario': 'GUARDIA-01',
        'nombres': 'Juan Pedro',
        'apellidos': 'Pérez Torres',
        'contrasena': 'Guardia-Seguro!2026',
        'punto_acceso_id': 1,
        'activo': true,
      });
    },
  );

  Future<void> completarPuerta(WidgetTester tester) async {
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Código de puerta'),
      'PUERTA-GPS',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre de puerta'),
      'Puerta desde el teléfono',
    );
  }

  testWidgets('administrador registra su GPS sin solicitar Google Maps', (
    tester,
  ) async {
    final cliente = ClienteOperativoFalso(esAdmin: true);
    final estado = await montar(tester, cliente);
    await tester.tap(find.text('Agregar puerta'));
    await tester.pumpAndSettle();
    await completarPuerta(tester);
    expect(estado.ubicacion.solicitudes, 0);
    expect(find.text('Todavía no has capturado la ubicación.'), findsOneWidget);
    await tester.tap(find.text('Usar mi ubicación actual'));
    await tester.pumpAndSettle();
    expect(estado.ubicacion.solicitudes, 1);
    expect(find.textContaining('Precisión aproximada: 10.0 m'), findsOneWidget);
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(cliente.puertaGuardada, {
      'codigo': 'PUERTA-GPS',
      'nombre': 'Puerta desde el teléfono',
      'radio_permitido_metros': 100.0,
      'latitud': -18.013,
      'longitud': -70.251,
      'estado': 'ACTIVO',
    });
    expect(cliente.solicitudesMapa, 0);
  });

  testWidgets('una puerta nueva exige capturar su ubicación', (tester) async {
    final cliente = ClienteOperativoFalso(esAdmin: true);
    final estado = await montar(tester, cliente);
    await tester.tap(find.text('Agregar puerta'));
    await tester.pumpAndSettle();
    await completarPuerta(tester);
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(
      find.text('Pulsa «Usar mi ubicación actual» estando en la puerta.'),
      findsOneWidget,
    );
    expect(estado.ubicacion.solicitudes, 0);
    expect(cliente.puertaGuardada, isNull);
  });

  testWidgets('permiso denegado informa el error y permite reintentar', (
    tester,
  ) async {
    final cliente = ClienteOperativoFalso(esAdmin: true);
    await montar(
      tester,
      cliente,
      proveedorAdministracion: ProveedorUbicacionFalso(
        ubicacion: crearUbicacion(),
        error: const ExcepcionUbicacion('Permite el acceso a la ubicación.'),
      ),
    );
    await tester.tap(find.text('Agregar puerta'));
    await tester.pumpAndSettle();
    await completarPuerta(tester);
    await tester.tap(find.text('Usar mi ubicación actual'));
    await tester.pumpAndSettle();
    expect(find.text('Permite el acceso a la ubicación.'), findsOneWidget);
    expect(find.text('Todavía no has capturado la ubicación.'), findsOneWidget);
    final boton = tester.widget<FilledButton>(
      find.ancestor(
        of: find.text('Usar mi ubicación actual'),
        matching: find.byWidgetPredicate((widget) => widget is FilledButton),
      ),
    );
    expect(boton.onPressed, isNotNull);
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(cliente.puertaGuardada, isNull);
  });

  for (final caso in [
    (nombre: 'imprecisa', precision: 200.0, segundos: 0, latitud: -18.013),
    (nombre: 'antigua', precision: 10.0, segundos: 120, latitud: -18.013),
    (nombre: 'futura', precision: 10.0, segundos: -120, latitud: -18.013),
    (nombre: 'inválida', precision: 10.0, segundos: 0, latitud: double.nan),
  ]) {
    testWidgets('rechaza una ubicación ${caso.nombre} para una puerta nueva', (
      tester,
    ) async {
      final cliente = ClienteOperativoFalso(esAdmin: true);
      await montar(
        tester,
        cliente,
        proveedorAdministracion: ProveedorUbicacionFalso(
          ubicacion: UbicacionReportada(
            latitud: caso.latitud,
            longitud: -70.251,
            precisionMetros: caso.precision,
            obtenidaEn: DateTime.now().subtract(
              Duration(seconds: caso.segundos),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Agregar puerta'));
      await tester.pumpAndSettle();
      await completarPuerta(tester);
      await tester.tap(find.text('Usar mi ubicación actual'));
      await tester.pumpAndSettle();
      expect(
        find.text('Todavía no has capturado la ubicación.'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('ubicacion-puerta')), findsNothing);
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      expect(cliente.puertaGuardada, isNull);
    });
  }

  testWidgets('no permite un radio menor que la precisión capturada', (
    tester,
  ) async {
    final cliente = ClienteOperativoFalso(esAdmin: true);
    await montar(tester, cliente);
    await tester.tap(find.text('Agregar puerta'));
    await tester.pumpAndSettle();
    await completarPuerta(tester);
    await tester.tap(find.text('Usar mi ubicación actual'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Radio permitido (metros)'),
      '5',
    );
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('La precisión debe ser mejor'), findsOneWidget);
    expect(cliente.puertaGuardada, isNull);
  });

  testWidgets('editar conserva el punto guardado si no se captura otro', (
    tester,
  ) async {
    final cliente = ClienteOperativoFalso(esAdmin: true);
    final estado = await montar(tester, cliente);
    await tester.tap(find.text('Puerta principal (PUERTA-01)'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Ubicación guardada de esta puerta.'),
      findsOneWidget,
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nombre de puerta'),
      'Puerta renombrada',
    );
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(cliente.puertaGuardada!['nombre'], 'Puerta renombrada');
    expect(cliente.puertaGuardada!['latitud'], 1.0);
    expect(cliente.puertaGuardada!['longitud'], 1.0);
    expect(estado.ubicacion.solicitudes, 0);
    expect(cliente.solicitudesMapa, 0);
  });

  testWidgets('editar permite reemplazar el punto con el GPS del teléfono', (
    tester,
  ) async {
    final cliente = ClienteOperativoFalso(esAdmin: true);
    await montar(tester, cliente);
    await tester.tap(find.text('Puerta principal (PUERTA-01)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Usar mi ubicación actual'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(cliente.puertaGuardada!['latitud'], -18.013);
    expect(cliente.puertaGuardada!['longitud'], -70.251);
  });

  testWidgets('bloquea Guardar durante la captura y tolera cancelar', (
    tester,
  ) async {
    final pendiente = Completer<UbicacionReportada>();
    final cliente = ClienteOperativoFalso(esAdmin: true);
    await montar(
      tester,
      cliente,
      proveedorAdministracion: ProveedorUbicacionPendiente(pendiente.future),
    );
    await tester.tap(find.text('Agregar puerta'));
    await tester.pumpAndSettle();
    await completarPuerta(tester);
    await tester.tap(find.text('Usar mi ubicación actual'));
    await tester.pump();
    final guardar = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Guardar'),
    );
    expect(guardar.onPressed, isNull);
    expect(find.text('Obteniendo ubicación…'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    pendiente.complete(crearUbicacion());
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(cliente.puertaGuardada, isNull);
  });

  testWidgets(
    'formulario explica el formato del usuario antes de enviar el guardia',
    (tester) async {
      final cliente = ClienteOperativoFalso(esAdmin: true);
      await montar(tester, cliente);
      await tester.tap(find.text('Agregar guardia'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Nombres'),
        'Juan',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Apellidos'),
        'Pérez',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Usuario'),
        'GUARDIA CON ESPACIOS',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Contraseña'),
        'Guardia-Seguro!2026',
      );
      await tester.tap(find.text('Puerta asignada'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Puerta principal').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      expect(
        find.text('Usa solo letras, números, punto, guion o guion bajo.'),
        findsOneWidget,
      );
      expect(cliente.guardiaGuardado, isNull);
    },
  );
}
