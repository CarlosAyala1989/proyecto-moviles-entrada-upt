#!/usr/bin/env bash

set -euo pipefail

RAIZ_PROYECTO="$({ CDPATH= cd -- "$(dirname -- "$0")/.." && pwd; })"
CONSTRUIR_APK=false

case "${1:-}" in
  '') ;;
  --construir-apk) CONSTRUIR_APK=true ;;
  *)
    echo "Uso: scripts/verificar_proyecto.sh [--construir-apk]" >&2
    exit 2
    ;;
esac

for COMANDO_REQUERIDO in node npm flutter; do
  if ! command -v "$COMANDO_REQUERIDO" >/dev/null 2>&1; then
    echo "Falta el comando requerido: $COMANDO_REQUERIDO" >&2
    exit 1
  fi
done

verificar_flutter() {
  local DIRECTORIO_PAQUETE="$1"
  local NOMBRE_PAQUETE="$2"
  echo "Verificando $NOMBRE_PAQUETE"
  (
    cd "$RAIZ_PROYECTO/$DIRECTORIO_PAQUETE"
    flutter pub get --enforce-lockfile
    flutter analyze
    flutter test
  )
}

echo "Verificando backend"
(
  cd "$RAIZ_PROYECTO/api-backend-entrada-upt"
  npm test
)

verificar_flutter "paquetes/cliente_api_upt" "cliente_api_upt"
verificar_flutter "seguridad_estudiante" "seguridad_estudiante"
verificar_flutter "seguridad_verificador" "seguridad_verificador"

if "$CONSTRUIR_APK"; then
  echo "Construyendo APK de seguridad_estudiante"
  (
    cd "$RAIZ_PROYECTO/seguridad_estudiante"
    flutter build apk --debug --no-pub
  )
  echo "Construyendo APK de seguridad_verificador"
  (
    cd "$RAIZ_PROYECTO/seguridad_verificador"
    flutter build apk --debug --no-pub
  )
fi

echo "Verificación completada correctamente"
