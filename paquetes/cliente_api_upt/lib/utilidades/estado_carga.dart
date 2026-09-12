enum FaseCarga { inicial, cargando, completada, error }

class EstadoCarga<T> {
  const EstadoCarga._({required this.fase, this.datos, this.mensaje});

  const EstadoCarga.inicial() : this._(fase: FaseCarga.inicial);
  const EstadoCarga.cargando() : this._(fase: FaseCarga.cargando);
  const EstadoCarga.completada(T datos)
    : this._(fase: FaseCarga.completada, datos: datos);
  const EstadoCarga.error(String mensaje)
    : this._(fase: FaseCarga.error, mensaje: mensaje);

  final FaseCarga fase;
  final T? datos;
  final String? mensaje;
}
