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
  Future<List<Map<String, dynamic>>> consultarGuardias(
    String tokenAcceso,
  ) async => [];
  @override
  Future<void> guardarPuerta(
    String tokenAcceso,
    Map<String, dynamic> datos, {
    int? id,
  }) async {}
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
        'GUARDIA-01',
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
}
