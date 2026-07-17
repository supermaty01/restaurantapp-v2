# 📍 ESTADO — documentación viva

**Última actualización:** 2026-07-17

Punto de entrada al retomar el trabajo: qué está hecho, qué sigue, qué está bloqueado. Se actualiza al cerrar cada bloque de trabajo.

## Estado global

| Fase                     | Estado                                    |
| ------------------------ | ----------------------------------------- |
| Documentación de diseño  | ✅ Completa (docs 00–13)                  |
| 0 — Puesta a punto       | 🟡 En curso (~70%)                        |
| 1 — Esquema local        | ⬜ Siguiente                              |
| 2 — Supabase + Auth      | ⬜ Bloqueada (credenciales)               |
| 3 — Sync                 | ⬜                                        |
| 4 — Worker / Share       | ⬜ Bloqueada (credenciales)               |
| 5 — Social               | ⬜                                        |
| 6 — UI                   | ⬜                                        |
| 7 — Asistente IA         | ⬜ Bloqueada (credenciales)               |

## Hecho

### Repo y monorepo

- Monorepo npm workspaces: `apps/mobile`, `apps/api` (vacío), `packages/shared` (vacío), `supabase` (vacío), `docs`.
- Prettier + tsconfig base estricto compartidos; husky/lint-staged declarados.

### Fase 0 — completado

- **Upgrade SDK 52 → 57 resuelto por scaffolding limpio + port del código**, en vez de encadenar cinco upgrades. Resultado: Expo 57.0.6, React 19.2.3, RN 0.86, expo-router 57.
- `expo-doctor`: **19/20 checks** (el que falla es el schema de `app.config.js`, ver abajo).
- **React deduplicado** a una sola versión (19.2.3): npm subía 19.2.7 al root vía peers; se fija con `overrides` + devDependency en la raíz.
- **Tests: 9 suites / 17 tests en verde** sobre el SDK nuevo. Es la señal de que el port no rompió la lógica.
- **Nueva arquitectura de RN activada** (`newArchEnabled: true`); la v1 la tenía desactivada.

### Dependencias retiradas (docs/11)

| Dependencia                    | Sustituida por                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `react-native-image-zoom-viewer` | **Código propio**: `components/media/{ImageCarousel,ImageLightbox,ZoomableImage}.tsx` sobre gesture-handler + reanimated |
| `react-native-webview`         | Ya no hace falta (era dependencia del zoom viewer)                                 |
| `react-native-zip-archive`     | `services/backup/zip.ts` con jszip (JS puro)                                       |
| `async-storage`                | `services/db/settings-repository.ts` (tabla `app_settings` de SQLite)              |
| `axios` + auth Railway         | Eliminada; la app es local-first sin login gate                                    |

El visor propio incluye: paginado, pinch-zoom con clamp de bordes, doble-tap con foco en el punto tocado, arrastrar para cerrar con fade del fondo, contador. **Sin verificar en dispositivo** (ver bloqueos).

## ⚠️ Fase 0 — lo que falta

1. **132 errores de TypeScript** y **234 errores de ESLint** en el código portado de v1.
   Son consecuencia *deseada* de activar las reglas estrictas de [12 — Calidad](12-calidad.md) (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `no-explicit-any`, `no-unsafe-assignment`) sobre código que no se escribió con ellas. **No son regresiones del port**: los tests pasan.
   Ya corregidos: mappers, `soft-delete`, DTOs (`deleted` pasa de `boolean?` a `boolean`, que es lo que dice la BD), ThemeContext, componentes de media.
   Pendiente: mayoría en `app/**` (pantallas) y `services/share/exportService.ts`.
   Medir con: `cd apps/mobile && npx tsc --noEmit | grep -c "error TS"`.
2. **`app.config.js` no valida contra el schema de Expo** — revisar qué campo sobra/falta (`npx expo-doctor --verbose`).
3. **`packages/shared` está vacío** — mover ahí los schemas zod.
4. **CI (GitHub Actions) no creada.**
5. **Verificación en emulador/dispositivo: no hecha.** Nada de lo anterior prueba que la app *arranque*. Es el siguiente paso obligatorio antes de dar la fase por cerrada.

### Corrección a los docs a partir de lo aprendido

- `react-native-pager-view` **vuelve** al proyecto, pero como dependencia de `@react-navigation/material-top-tabs`, no de imágenes. La decisión de [11](11-dependencias.md) se mantiene (nada de librerías de *imágenes*), pero la tabla debe reflejarlo.
- `expo-file-system`: el código portado usa la API **legacy** (`expo-file-system/legacy`), que SDK 57 sigue exportando. Decisión consciente: migrar a la API nueva a la vez que se toca ese código en fase 1, en vez de mezclar dos refactors sobre la ruta crítica de backups. **Deuda anotada.**

## Siguiente paso concreto

1. Arrancar la app en emulador y arreglar lo que salte (`npm run -w apps/mobile start`). **Prioridad máxima**: sin esto, la fase 0 no está cerrada.
2. Saldar los 132 errores TS + 234 lint (fichero a fichero, `app/**` primero).
3. Mover schemas zod a `packages/shared`.
4. CI en GitHub Actions con `npm run check`.
5. Cerrar fase 0 y abrir [fase 1](10-roadmap.md#fase-1--refactor-del-esquema-local--crítica).

## Bloqueos conocidos

Requieren acción del autor, no son trabajo de código:

- **Emulador/dispositivo**: los módulos nativos y el visor de imágenes nuevo solo se validan ejecutando la app. No se ha podido hacer en esta sesión.
- **Fase 2**: proyecto Supabase + OAuth de Google (y Apple si iOS). Ver [13 §3](13-despliegue.md).
- **Fase 4**: cuenta Cloudflare, bucket R2, decisión de dominio propio.
- **Fase 7**: AI Gateway creado en el dashboard.

## Decisiones abiertas pendientes

| Tema                                             | Doc                       | Cuándo   |
| ------------------------------------------------ | ------------------------- | -------- |
| Migrar a la API nueva de `expo-file-system`      | este doc                  | Fase 1   |
| Precio: entero sin moneda vs con moneda          | [02](02-modelo-de-datos.md) | Fase 1   |
| Dominio propio (~$10/año, único gasto probable)  | [05](05-api.md)           | Fase 4   |
| Estructura de navegación definitiva              | [08](08-ui.md)            | Fase 6   |
| Modelo concreto de chat/embeddings del catálogo  | [07](07-asistente-ia.md)  | Fase 7a  |
| ¿Asistente disponible sin cuenta?                | [07](07-asistente-ia.md)  | Fase 7   |

## Notas de contexto que no están en el código

- El repo v1 (`C:\Universidad\Movil\restaurantapp-application`) es **read-only**: referencia, no se toca.
- El dolor histórico de upgrades venía de las **librerías de imágenes** → de ahí el código propio ([11](11-dependencias.md)).
- Restricción dura: **todo cabe en free tiers**. Ante la duda, se recorta alcance antes que pagar.
- El salto de 5 SDKs se resolvió con scaffolding limpio + port. Si vuelve a acumularse ese retraso, es la estrategia a repetir; mejor aún, actualizar cada release.
