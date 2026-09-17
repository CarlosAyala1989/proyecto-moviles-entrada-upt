# Repository Guidelines

## Project Structure & Module Organization

- `api-backend-entrada-upt/`: Node.js/Express API. Business modules in `src/modulos/` separate routes, controllers, validation, services, and repositories. SQL migrations, fixtures, and tests live in `migraciones/`, `semillas/`, and `test/`.
- `seguridad_estudiante/` and `seguridad_verificador/`: Flutter applications for credential holders and security operators. Each organizes `lib/` into screens, controllers, services, navigation, and themes; tests live in `test/`. Platform icons and launch assets reside in platform directories.
- `paquetes/cliente_api_upt/`: shared HTTP client, models, configuration, and session storage; real-backend tests live in `integracion/`.
- `scripts/`: verification. Root Markdown files document milestones, endpoints, and workflows.

## Build, Test, and Development Commands

Use Node.js 20+, Flutter compatible with Dart 3.10, configured MariaDB, and Chrome/Chromium plus Tesseract for the intranet verification flow. The Docker image installs these browser dependencies.

- In `api-backend-entrada-upt/`, run `npm ci`, then `npm run migrar` to install dependencies and apply migrations. `npm run sembrar:pruebas` loads local fixtures and resets their credentials/state.
- `npm run dev`: starts the API with file watching on port 3000.
- In either Flutter app, run `flutter pub get --enforce-lockfile`, then `flutter run -d Linux`. The default API URL is `http://127.0.0.1:3000/api`.
- In each Flutter package, use `dart format lib test` and `flutter analyze` for formatting and lint checks.
- From the root, `./scripts/verificar_proyecto.sh` runs backend tests, Flutter analysis/tests, and HTTP/Dart integration. Add `--construir-apk` to build both debug APKs.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and existing Spanish domain terminology. JavaScript uses ES modules and semicolons. Follow `snake_case` filenames, `lowerCamelCase` functions, and `UpperCamelCase` classes. Backend files include role suffixes such as `ingresos.servicio.js`; migrations use numbered names such as `009_descripcion.sql`. Dart follows `dart format` and `flutter_lints`, including `prefer_single_quotes` and `use_super_parameters`.

## Testing Guidelines

Backend tests use `node:test`, strict assertions, and Supertest in `*.prueba.js`; run `npm test`. Flutter uses `flutter_test` in `*_test.dart`; run `flutter test`. Run `npm run test:flujo-completo` for real MariaDB/API/client integration. Use a development database and isolated fixtures. No numeric coverage threshold is configured; cover changed behavior, authorization, and relevant failure paths.

## Commit & Pull Request Guidelines

History uses Spanish subjects with prefixes `feat:`, `test:`, and `docs:`. Keep commits focused. PRs should describe behavior changes, link issues or milestones, list verification results, and include screenshots for UI changes. Update endpoint/flow documentation when contracts change.

## Security & Configuration

Keep `.env` and `credenciales*.txt` untracked; use `.env.example` as reference. Preserve lockfiles and existing worktree changes. Keep authorization and QR consumption in the backend; Flutter must never connect directly to MariaDB.
