# 12 — Estándares de calidad

Objetivo declarado del refactor: que este proyecto sea **mantenible durante años por una persona**. Eso se consigue con reglas automáticas (nadie recuerda convenciones a los 6 meses) y con tests donde el fallo es caro.

## Herramientas (toda la CI en `npm run check`)

| Capa    | Herramienta                                                                                                                         | Regla                                                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato | **Prettier**                                                                                                                        | Fuente única de formato. Nada de discutir estilo; `format:check` en CI                                                                                               |
| Lint    | **ESLint** (flat config) + `eslint-config-expo`, `@typescript-eslint` (type-aware), `eslint-plugin-import`, `-unicorn`, `-jsx-a11y` | 0 warnings permitidos en CI (`--max-warnings=0`)                                                                                                                     |
| Tipos   | **TypeScript strict**                                                                                                               | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Prohibido `any` (`no-explicit-any` = error); `unknown` + zod en los bordes |
| Tests   | **Jest** + `@testing-library/react-native`                                                                                          | Ver política abajo                                                                                                                                                   |
| Hooks   | **husky** + **lint-staged**                                                                                                         | Pre-commit: prettier + eslint sobre lo tocado. Pre-push: `npm run check`                                                                                             |
| CI      | **GitHub Actions**                                                                                                                  | `check` por workspace en cada push/PR                                                                                                                                |

## Reglas de arquitectura (las hace cumplir el linter, no la buena voluntad)

- **Fronteras entre capas** con `eslint-plugin-boundaries` o `import/no-restricted-paths`:
  - `app/` (rutas) → solo puede importar de `features/`, `components/`, `lib/`.
  - `features/*/` → **no puede importar de otra feature** (lo común sube a `lib/` o `packages/shared`).
  - Solo `services/db/` y `features/*/repositories/` pueden importar Drizzle. **Ninguna pantalla escribe SQL.**
  - Solo `services/sync/`, `services/ai/` y `services/api-client/` pueden usar `fetch`. **Ninguna pantalla llama a la red.**
- **Estructura por feature** (evolución de la v1, que ya va en esta dirección):
  ```
  features/<dominio>/
    components/    UI de la feature
    hooks/         estado y orquestación para la UI
    repositories/  acceso a datos (único sitio con Drizzle)
    schemas/       zod (fuente de verdad de tipos: z.infer, nada de tipos duplicados)
    mappers/       filas → DTOs de vista
    types/
  ```
- **Nada de estado global salvo lo justificado** (sesión, tema). Los datos vienen de queries a SQLite con suscripción a cambios (`useLiveTablesQuery` de la v1, revisado).
- **Errores**: tipos de error propios por capa; nunca `catch {}` silencioso (`no-empty` + revisión). Los errores de red degradan la UI, no la rompen.
- **Fechas**: siempre ISO 8601 UTC en base de datos, formateo solo en presentación.
- **Dinero**: entero en unidad mínima, nunca `float`.

## Política de tests

No se persigue un % de cobertura global (métrica que miente). Se exige cobertura **donde el fallo es irreversible o caro**:

| Zona                                | Nivel exigido                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Migraciones de esquema** (fase 1) | Obligatorio: fixtures de DB v1 reales, verificación de conteos e integridad referencial. Sin esto no se mergea                         |
| **Import / export de backups**      | Obligatorio: fixtures congelados por versión de formato (v1 `.restoshare`, backup v1, backup v2); round-trip export→import idempotente |
| **Motor de sync** (fase 3)          | Obligatorio: tests de integración con Supabase local — conflictos, borrados, bootstrap, dos dispositivos, idempotencia                 |
| **Repositorios y mappers**          | Obligatorio (ya existen en v1: `mapDishListRows`, etc.)                                                                                |
| **Schemas zod**                     | Obligatorio (ya existen en v1)                                                                                                         |
| **Tools del asistente** (fase 7)    | Obligatorio: son consultas de datos; casos de prueba con datos sintéticos + set de evaluación de preguntas                             |
| **Componentes de UI**               | Selectivo: solo lógica no trivial (el visor de imágenes propio, formularios con prefill). No test de snapshot por vicio                |
| **Worker** (fase 4)                 | Tests con `vitest` + `@cloudflare/vitest-pool-workers` sobre rutas y auth                                                              |

Además:

- **Test de regresión por bug**: todo bug corregido entra con su test.
- Fixtures de datos reales **anonimizados** para la migración (la DB del autor es el mejor caso de prueba que existe).

## Convenciones

- Idioma: **código, nombres y comentarios en inglés**; documentación y textos de UI en español. (La v1 mezcla; se unifica al migrar cada archivo.)
- Comentarios: solo para explicar _por qué_, nunca _qué_. El código dice el qué.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`…) — ya se usa parcialmente en la v1. Un commit = un cambio coherente.
- Ramas: `main` siempre desplegable; trabajo en ramas por fase/feature.
- Cada fase acaba con: CI verde + docs actualizados + [ESTADO.md](ESTADO.md) al día.

## Deuda conocida que se salda en el refactor

- Tabla `users` local vestigial (de la auth vieja) — se elimina/reemplaza.
- `services/api.ts` + token en AsyncStorage — se elimina.
- Mezcla español/inglés en el código — se unifica.
- Ausencia de capa de repositorios explícita (hay SQL en hooks) — se introduce.

## Las reglas de React Compiler van aparte

`npm run lint` es la puerta: si pasa, el código cumple el estándar. `npm run
lint:compiler` es una pregunta distinta que se hace a propósito.

Las reglas de _compiler readiness_ de `eslint-plugin-react-hooks` v6 estuvieron
en `warn`, que suena a la opción prudente y era la peor de las tres: el script
lleva `--max-warnings=0`, así que 83 avisos hacían que el estándar no pudiera
pasar nunca — y CI en rojo permanente. Un estándar que no se puede cumplir es un
estándar que se aprende a ignorar.

React Compiler no está activado, así que esos avisos no dicen nada sobre cómo se
comporta la app hoy: describen trabajo necesario **antes** de activarlo. O una
regla bloquea la build, o es una consulta aparte. Es lo segundo.

Las dos clásicas —`rules-of-hooks` y `exhaustive-deps`— siguen siendo errores:
esas sí son correctitud de ahora.
