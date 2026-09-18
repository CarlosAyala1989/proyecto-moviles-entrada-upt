import 'package:cliente_api_upt/cliente_api_upt.dart';
import 'package:flutter_test/flutter_test.dart';

const _urlApi = String.fromEnvironment('URL_API_INTEGRACION');
const _usuarioPortador = String.fromEnvironment('USUARIO_PORTADOR_INTEGRACION');
const _contrasenaPortador = String.fromEnvironment(
  'CONTRASENA_PORTADOR_INTEGRACION',
);
const _usuarioSeguridad = String.fromEnvironment(
  'USUARIO_SEGURIDAD_INTEGRACION',
);
const _contrasenaSeguridad = String.fromEnvironment(
  'CONTRASENA_SEGURIDAD_INTEGRACION',
);
const _puntoAcceso = String.fromEnvironment('PUNTO_ACCESO_INTEGRACION');

UbicacionReportada _ubicacionActual() => UbicacionReportada(
  latitud: -17.654321,
  longitud: -70.123456,
  precisionMetros: 5,
  obtenidaEn: DateTime.now().toUtc(),
);

void main() {
  test(
    'ClienteApi completa autenticación, QR, validación e historial reales',
    () async {
      expect(_urlApi, isNotEmpty, reason: 'Falta URL_API_INTEGRACION.');
      expect(_usuarioPortador, isNotEmpty);
      expect(_contrasenaPortador, isNotEmpty);
      expect(_usuarioSeguridad, isNotEmpty);
      expect(_contrasenaSeguridad, isNotEmpty);
      expect(_puntoAcceso, isNotEmpty);

      final api = ClienteApi(
        urlBase: _urlApi,
        tiempoEspera: const Duration(seconds: 20),
      );
      String? tokenPortador;
      String? tokenSeguridad;

      try {
        final sesionInicial = await api.iniciarSesion(
          _usuarioPortador,
          _contrasenaPortador,
        );
        expect(sesionInicial.usuario.codigoInstitucional, _usuarioPortador);

        final sesionPortador = await api.renovarSesion(
          sesionInicial.tokenRenovacion,
        );
        tokenPortador = sesionPortador.tokenAcceso;
        expect(tokenPortador, isNot(sesionInicial.tokenAcceso));

        final usuario = await api.consultarSesion(tokenPortador);
        expect(usuario.codigoInstitucional, _usuarioPortador);

        final identidad = await api.consultarIdentidadDigital(tokenPortador);
        expect(identidad.codigoInstitucional, _usuarioPortador);
        expect(identidad.puedeSolicitarCodigoQr, isTrue);

        final inicioSolicitud = DateTime.now().toUtc();
        final qr = await api.generarCodigoQr(tokenPortador, _ubicacionActual());
        expect(qr.estado, 'PENDIENTE');
        expect(qr.puntoAccesoCodigo, _puntoAcceso);
        expect(
          qr.expiraEn.difference(qr.emitidaEn),
          Duration(seconds: qr.duracionSegundos),
        );
        final vigenciaDesdeElCliente = qr.expiraEn.difference(inicioSolicitud);
        expect(
          vigenciaDesdeElCliente.inSeconds,
          inInclusiveRange(qr.duracionSegundos - 5, qr.duracionSegundos + 1),
          reason: 'La fecha del QR debe representar el mismo instante en Dart.',
        );

        final sesionSeguridad = await api.iniciarSesion(
          _usuarioSeguridad,
          _contrasenaSeguridad,
        );
        tokenSeguridad = sesionSeguridad.tokenAcceso;

        final autorizado = await api.validarIngreso(
          tokenAcceso: tokenSeguridad,
          codigoQr: qr.codigoQr,
          puntoAccesoCodigo: _puntoAcceso,
          ubicacion: _ubicacionActual(),
        );
        expect(autorizado.autorizado, isTrue);
        expect(autorizado.identidad?.codigoInstitucional, _usuarioPortador);

        final reuso = await api.validarIngreso(
          tokenAcceso: tokenSeguridad,
          codigoQr: qr.codigoQr,
          puntoAccesoCodigo: _puntoAcceso,
          ubicacion: _ubicacionActual(),
        );
        expect(reuso.resultado, 'DENEGADO');
        expect(reuso.motivo, 'CREDENCIAL_YA_UTILIZADA');

        final recientes = await api.consultarIngresosRecientes(
          tokenSeguridad,
          limite: 10,
          ubicacion: _ubicacionActual(),
        );
        expect(
          recientes.any(
            (registro) =>
                registro.codigoInstitucional == _usuarioPortador &&
                registro.resultado == 'AUTORIZADO',
          ),
          isTrue,
        );

        await api.generarCodigoQr(tokenPortador, _ubicacionActual());
        await api.revocarCodigoQr(tokenPortador);
      } finally {
        if (tokenPortador != null) {
          try {
            await api.cerrarSesion(tokenPortador);
          } catch (_) {
            // La limpieza de la prueba Node elimina cualquier sesión remanente.
          }
        }
        if (tokenSeguridad != null) {
          try {
            await api.cerrarSesion(tokenSeguridad);
          } catch (_) {
            // La limpieza de la prueba Node elimina cualquier sesión remanente.
          }
        }
        api.cerrarCliente();
      }
    },
    timeout: const Timeout(Duration(minutes: 2)),
  );
}
