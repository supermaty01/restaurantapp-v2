# 📍 ESTADO — documentación viva

**Última actualización:** 2026-07-17

Punto de entrada al retomar el trabajo: qué está hecho, qué sigue, qué está bloqueado. Se actualiza al cerrar cada bloque de trabajo.

## Estado global

| Fase                    | Estado                                               |
| ----------------------- | ---------------------------------------------------- |
| Documentación de diseño | ✅ Completa (docs 00–13)                             |
| 0 — Puesta a punto      | 🟢 Casi lista: TS+CI verdes; lint pendiente = fase 1 |
| 1 — Esquema local       | ⬜ Siguiente                                         |
| 2 — Supabase + Auth     | ⬜ Bloqueada (credenciales)                          |
| 3 — Sync                | ⬜                                                   |
| 4 — Worker / Share      | ⬜ Bloqueada (credenciales)                          |
| 5 — Social              | ⬜                                                   |
| 6 — UI                  | ⬜                                                   |
| 7 — Asistente IA        | ⬜ Bloqueada (credenciales)                          |

## Hecho

### Repo y monorepo

- Monorepo npm workspaces: `apps/mobile`, `apps/api` (vacío), `packages/shared` (vacío), `supabase` (vacío), `docs`.
- Prettier + tsconfig base estricto compartidos; husky/lint-staged declarados.

### Fase 0 — completado

- **Upgrade SDK 52 → 57 resuelto por scaffolding limpio + port del código**, en vez de encadenar cinco upgrades. Resultado: Expo 57.0.6, React 19.2.3, RN 0.86, expo-router 57.
- ✅ **`expo-doctor`: 20/20 checks.**
- ✅ **La app empaqueta**: `npx expo export --platform android` → 2958 módulos, bundle generado.
- ✅ **Tests: 9 suites / 17 tests en verde** sobre el SDK nuevo.
- **React deduplicado** a una sola versión (19.2.3): npm subía 19.2.7 al root vía peers; se fija con `overrides` + devDependency en la raíz.
- **Nueva arquitectura de RN activada** (`newArchEnabled: true`); la v1 la tenía desactivada.

### Migración de navegación (bloqueante que solo apareció al empaquetar)

Desde **SDK 56, expo-router prohíbe declarar navegadores de react-navigation a mano**, que es exactamente como lo hacía la v1 (expo-router solo en la raíz + `createNativeStackNavigator`/`createMaterialTopTabNavigator` en `(main)/_layout.tsx`). El typecheck y los tests pasaban igualmente: **solo el bundle lo detecta**. Lección: `expo export` es parte de la verificación, no un extra.

Migrado a enrutado por ficheros puro:

- `app/(main)/_layout.tsx` → `<Stack>` de expo-router con el header propio.
- `app/(main)/(tabs)/_layout.tsx` → `<Tabs>` de expo-router; las pantallas de lista se movieron a `(tabs)/{restaurants,dishes,visits,tags}/index.tsx`.
- Las pestañas **internas** de los detalles de restaurante/visita (Detalles/Visitas/Platos) no eran rutas: se sustituyen por `components/ui/SegmentedTabs.tsx`, componente propio. Menos maquinaria y una dependencia menos.
- `@react-navigation/material-top-tabs` **desinstalada**.

⚠️ **Cambio de comportamiento a validar contigo:** se pierde el _swipe_ entre pestañas (era propio de material-top-tabs). Las tabs inferiores ahora son las nativas de expo-router. Como la navegación se rediseña en [fase 6](08-ui.md) de todos modos, no se ha invertido en recuperar el gesto; si lo quieres antes, es trabajo aparte.

### Dependencias retiradas (docs/11)

| Dependencia                      | Sustituida por                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `react-native-image-zoom-viewer` | **Código propio**: `components/media/{ImageCarousel,ImageLightbox,ZoomableImage}.tsx` sobre gesture-handler + reanimated |
| `react-native-webview`           | Ya no hace falta (era dependencia del zoom viewer)                                                                       |
| `react-native-zip-archive`       | `services/backup/zip.ts` con jszip (JS puro)                                                                             |
| `async-storage`                  | `services/db/settings-repository.ts` (tabla `app_settings` de SQLite)                                                    |
| `axios` + auth Railway           | Eliminada; la app es local-first sin login gate                                                                          |

El visor propio incluye: paginado, pinch-zoom con clamp de bordes, doble-tap con foco en el punto tocado, arrastrar para cerrar con fade del fondo, contador. **Sin verificar en dispositivo** (ver bloqueos).

## ⚠️ Fase 0 — lo que falta

### ✅ TypeScript: 0 errores (venían de 133)

Todo el código portado pasa `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. No fue cosmético — salieron bugs reales:

- `exportService` asertaba `dishes[0].restaurantId!`. Un plato o visita sin restaurante (que el esquema permite) habría petado al compartir. Ahora se trata explícitamente.
- `backupService` parseaba los JSON de `app_settings` con un cast. Es un borde no confiable (una versión vieja pudo escribir otra forma): ahora se validan con **zod**.
- Las consultas de restaurantes **no seleccionaban `tags.deleted`** aunque el componente `Tag` lo pinta.
- `FormInput`, `FormDatePicker`, `RestaurantPicker`, `DishPicker` y `RatingStars` usaban `Control<any>`: aceptaban cualquier nombre de campo sin avisar. Ahora son genéricos, con `FieldPathByValue` restringiendo `name` al tipo real del campo.
- `ImportConflictModal` y `importService` usaban `existingEntity!`; ahora hay narrowing real.
- DTOs: `deleted` pasa de opcional a `boolean` requerido, que es lo que dice la BD (NOT NULL DEFAULT false).

### 🟡 ESLint: de 208 errores a 40 errores + 76 avisos

Progreso saldado (todo con TS en 0, 17 tests y bundle verdes en cada paso):

- **47 de promesas eliminadas** (`no-floating-promises` + `no-misused-promises`) — cada una era un fallo que se tragaba en silencio. `void` explícito en fire-and-forget; handlers JSX async permitidos (idiomático en RN, `checksVoidReturn.attributes:false`); botones de Alert envueltos en `void (async …)()`.
- **42 `any` / `unsafe-assignment` eliminadas → 0.** Nuevo `services/places` con validación zod; hooks de Drizzle sin `any` (joins antes del where); `ImagesUploader` con narrowing de la unión discriminada; iconos tipados con `ComponentProps<typeof Ionicons>['name']`; `catch (error: any)` → `unknown`.
- Logs, `clsx` (import nombrado), comillas JSX escapadas, `import/order`: limpiados.

**Restante:**

1. **40 errores — regla de fronteras** (`no-restricted-imports`): las pantallas consultan Drizzle directamente. **Deuda que salda la [fase 1](10-roadmap.md#fase-1--refactor-del-esquema-local--crítica)** con la capa de repositorios; moverlo antes sería trabajo tirado.
2. **76 avisos — preparación para React Compiler** (`react-hooks/refs`, `immutability`, `set-state-in-effect`, `incompatible-library`, `preserve-manual-memoization`). **El compiler NO está activado** en `app.config.js` (solo `typedRoutes`), así que no afectan al runtime. Se dejan en `warn` a propósito: son deuda de preparación a saldar como **workstream propio con verificación en dispositivo**, no a ciegas. Al adoptar el compiler se re-suben a `error`. `rules-of-hooks` y `exhaustive-deps` siguen como error.

### ✅ CI creada

`.github/workflows/ci.yml`: job `verify` (bloqueante) corre `format:check` + `typecheck` + `test:ci` — todo en verde. Job `lint` informativo (`continue-on-error`) hasta que la fase 1 elimine las 40 de fronteras; entonces se vuelve bloqueante.

### Otros pendientes

1. **`packages/shared` sigue vacío.** Decisión: se puebla al crear la API (fase 4), que es su primer consumidor real; moverlo ahora, con el app como único consumidor, es riesgo sin beneficio.
2. **Verificación en emulador/dispositivo: no hecha.** El bundle compila (2959 módulos), pero eso no prueba que la app _se vea bien_ ni que el visor de imágenes nuevo se sienta correcto.

### ❓ Para decidir tú

`features/visits/schemas/visit-schema.ts` declara `dishes: number[] | string[]`. La rama de strings parece **no intencionada** (los ids de plato son enteros; hoy `["a","b"]` pasaría la validación). No se ha tocado la validación sin tu visto bueno. Si se confirma, se elimina la unión y `DishPicker` recupera un constraint limpio de `number[]`.

### Corrección a los docs a partir de lo aprendido

- La decisión de [11](11-dependencias.md) se cumplió **mejor de lo previsto**: al migrar a expo-router y sustituir las pestañas internas por `SegmentedTabs`, también salieron `react-native-pager-view`, `react-native-tab-view` y `@react-navigation/material-top-tabs`. La app ya **no depende de ninguna librería de carrusel, pager ni zoom**.
- `expo-file-system`: el código portado usa la API **legacy** (`expo-file-system/legacy`), que SDK 57 sigue exportando. Decisión consciente: migrar a la API nueva a la vez que se toca ese código en fase 1, en vez de mezclar dos refactors sobre la ruta crítica de backups. **Deuda anotada.**

## Siguiente paso concreto

1. Arrancar la app en emulador (`npm run -w apps/mobile start`). **Prioridad máxima**: probar navegación por tabs, detalle de restaurante/visita (SegmentedTabs nuevo) y sobre todo el **carrusel + visor de imágenes propios** (pinch, doble-tap, arrastrar para cerrar).
2. Saldar los 133 errores TS + lint (fichero a fichero, `app/**` primero).
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

| Tema                                            | Doc                         | Cuándo  |
| ----------------------------------------------- | --------------------------- | ------- |
| Migrar a la API nueva de `expo-file-system`     | este doc                    | Fase 1  |
| Precio: entero sin moneda vs con moneda         | [02](02-modelo-de-datos.md) | Fase 1  |
| Dominio propio (~$10/año, único gasto probable) | [05](05-api.md)             | Fase 4  |
| Estructura de navegación definitiva             | [08](08-ui.md)              | Fase 6  |
| Modelo concreto de chat/embeddings del catálogo | [07](07-asistente-ia.md)    | Fase 7a |
| ¿Asistente disponible sin cuenta?               | [07](07-asistente-ia.md)    | Fase 7  |

## Notas de contexto que no están en el código

- El repo v1 (`C:\Universidad\Movil\restaurantapp-application`) es **read-only**: referencia, no se toca.
- El dolor histórico de upgrades venía de las **librerías de imágenes** → de ahí el código propio ([11](11-dependencias.md)).
- Restricción dura: **todo cabe en free tiers**. Ante la duda, se recorta alcance antes que pagar.
- El salto de 5 SDKs se resolvió con scaffolding limpio + port. Si vuelve a acumularse ese retraso, es la estrategia a repetir; mejor aún, actualizar cada release.
