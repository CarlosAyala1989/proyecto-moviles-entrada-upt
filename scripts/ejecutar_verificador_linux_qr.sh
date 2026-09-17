#!/usr/bin/env bash
set -euo pipefail

directorio_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
directorio_proyecto="$(cd "$directorio_script/.." && pwd)"

cd "$directorio_proyecto/seguridad_verificador"
exec flutter run -d linux \
  --dart-define=PUNTO_ACCESO_CODIGO=PRUEBA-LOCAL \
  --dart-define=UBICACION_DESARROLLO_SIMULADA=true \
  --dart-define=UBICACION_DESARROLLO_LATITUD=-18.013 \
  --dart-define=UBICACION_DESARROLLO_LONGITUD=-70.251 \
  --dart-define=UBICACION_DESARROLLO_PRECISION_METROS=5
