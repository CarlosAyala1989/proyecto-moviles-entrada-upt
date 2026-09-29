import 'dart:convert';
import 'dart:typed_data';

import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seguridad_verificador/aplicacion/aplicacion_seguridad.dart';
import 'package:seguridad_verificador/controladores/controlador_validacion_ingresos.dart';
import 'package:seguridad_verificador/servicios/proveedor_ubicacion.dart';
import 'package:seguridad_verificador/widgets/selector_punto_google_maps.dart';
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
  }) async => base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  );
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

void main() {
  test('el centro del mapa conserva las coordenadas seleccionadas', () {
    final punto = coordenadaDesdeToqueMapa(
      centroLatitud: -18.0060535,
      centroLongitud: -70.2266368,
      zoom: 18,
      desplazamientoX: 0,
      desplazamientoY: 0,
    );
    expect(punto.latitud, closeTo(-18.0060535, 0.0000001));
    expect(punto.longitud, closeTo(-70.2266368, 0.0000001));
  });

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
  montar(WidgetTester tester, ClienteOperativoFalso cliente) async {
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

  testWidgets(
    'administrador selecciona la ubicación de una puerta tocando el mapa',
    (tester) async {
      final cliente = ClienteOperativoFalso(esAdmin: true);
      await montar(tester, cliente);
      await tester.tap(find.text('Agregar puerta'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Código de puerta'),
        'PUERTA-MAPA',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Nombre de puerta'),
        'Puerta elegida en mapa',
      );

      final mapa = find.byKey(const ValueKey('selector-punto-google-maps'));
      expect(mapa, findsOneWidget);
      await tester.tapAt(tester.getCenter(mapa) + const Offset(60, -30));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();

      expect(cliente.puertaGuardada, isNotNull);
      expect(cliente.puertaGuardada!['codigo'], 'PUERTA-MAPA');
      expect(cliente.puertaGuardada!['latitud'], isA<double>());
      expect(cliente.puertaGuardada!['longitud'], isA<double>());
      expect(cliente.puertaGuardada!['latitud'], isNot(1));
      expect(cliente.puertaGuardada!['longitud'], isNot(1));
    },
  );

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
