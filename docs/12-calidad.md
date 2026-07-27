# 12 — Estándares de calidad

Objetivo declarado del refactor: que este proyecto sea **mantenible durante años por una persona**. Eso se consigue con reglas automáticas (nadie recuerda convenciones a los 6 meses) y con tests donde el fallo es caro.

## Herramientas (toda la CI en `npm run check`)

| Capa    | Herramienta                                                                                                             | Regla                                                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato | **Prettier**                                                                                                            | Fuente única de formato. Nada de discutir estilo; `format:check` en CI                                                                                               |
| Lint    | **ESLint** (flat config) + `eslint-config-expo`, `@typescript-eslint` (type-aware), `eslint-plugin-import`, `-jsx-a11y` | 0 warnings permitidos en CI (`--max-warnings=0`). En los tres workspaces, y `recommendedTypeChecked` también en el Worker                                            |
| Tipos   | **TypeScript strict**                                                                                                   | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Prohibido `any` (`no-explicit-any` = error); `unknown` + zod en los bordes |
| Tests   | **Jest** (app) + **Vitest** (Worker y shared) + `.test.sql` contra Postgres                                             | Ver política abajo                                                                                                                                                   |
| Hooks   | **husky** + **lint-staged**                                                                                             | Pre-commit: prettier en la raíz, eslint desde cada workspace. Pre-push: `npm run check`                                                                              |
| CI      | **GitHub Actions**                                                                                                      | `npm run check` entero + `db:test` contra Postgres, bloqueantes. `npm audit` informativo                                                                             |

> **Julio 2026.** Hasta la auditoría esta tabla describía una intención, no un
> hecho: `.husky/` estaba vacío, CI solo comprobaba `apps/mobile` y el lint no
> bloqueaba. Ahora la tabla es cierta. Si alguna fila deja de serlo, **se
> corrige la fila o se corrige el proyecto** — lo que no vale es dejarla puesta.
>
> `eslint-plugin-unicorn` figuraba aquí y nunca estuvo instalado. Se ha quitado
> de la lista en vez de añadirlo: el conjunto actual ya sujeta lo que importa, y
> meter un plugin de cientos de reglas de estilo ahora mismo produce ruido, no
> calidad.

## Reglas de arquitectura (las hace cumplir el linter, no la buena voluntad)

Las que **hoy comprueba `npm run lint`**:

- **Ninguna pantalla escribe SQL.** `app/`, `components/` y
  `features/*/components/` no pueden importar Drizzle ni el schema
  (`no-restricted-imports`).
- **Ninguna pantalla llama a la red.** `app/`, `components/` y `features/`
  tienen prohibido el `fetch` global (`no-restricted-globals`). Todo lo que
  habla con el Worker vive en `services/api/`.
- Orden de imports, imports duplicados, imports sin usar, `no-empty` sin
  excepción para `catch`, promesas sin esperar, `switch` exhaustivo.

Las que **no** se comprueban, y por qué:

- **`features/*/` no importa de otra feature.** `no-restricted-imports` no sabe
  expresar «cualquier feature menos la mía»: un patrón `@/features/*/*` marca
  también los imports de la propia. Hace falta `eslint-plugin-boundaries` y
  mover a un sitio común lo que hoy se comparte con razón (el componente `Tag`,
  `ImageDTO`/`TagDTO`). Pendiente.
- **Solo `repositories/` toca Drizzle.** Los hooks de lista también lo hacen, y
  **no es deuda: es la arquitectura**. `useLiveTablesQuery` necesita el _objeto
  consulta_ para relanzarlo cuando cambian sus tablas, no el resultado. Un
  repositorio que devuelve un query-builder de Drizzle no esconde Drizzle: lo
  reexporta con más pasos. La regla real, y la que sí se comprueba, es que el
  SQL vive en `repositories/` o en `hooks/` y nunca en un componente.

## Convenciones de estructura

- **Estructura por feature** (evolución de la v1, que ya va en esta dirección):
  ```
  features/<dominio>/
    components/    UI de la feature
    hooks/         estado y orquestación para la UI
    repositories/  acceso a datos (escrituras y lecturas puntuales)
    schemas/       zod (fuente de verdad de tipos: z.infer, nada de tipos duplicados)
    mappers/       filas → DTOs de vista
    types/
  ```
  Y en `services/`, lo transversal: `db/`, `sync/`, `api/` (**todo lo que habla
  con el Worker**), `push/`, `share/`, `backup/`, `supabase/`.
- **Nada de estado global salvo lo justificado** (sesión, tema). Los datos vienen de queries a SQLite con suscripción a cambios (`useLiveTablesQuery` de la v1, revisado).
- **Errores**: tipos de error propios por capa; nunca `catch {}` silencioso (`no-empty` + revisión). Los errores de red degradan la UI, no la rompen.
- **Fechas**: siempre ISO 8601 UTC en base de datos, formateo solo en presentación.
- **Dinero**: ⚠️ **la regla original está rota y no se ha arreglado.** Decía
  «entero en unidad mínima, nunca float». `schema.ts` declara
  `price: integer('price')` — pero SQLite no aplica tipos, la app escribe `3.5`,
  y eso tumbó un push entero contra Postgres (ver la cabecera de la migración
  `0008`, que lo cuenta). El arreglo fue del lado del servidor:
  `numeric(12,2)`. **El lado local sigue declarando `integer` y guardando
  decimales**, así que la columna miente sobre su contenido y los dos esquemas
  discrepan en tipo. Hay que decidir uno de los dos —céntimos enteros en ambos
  lados, o `real` en ambos— y migrar. Anotado en ESTADO.md.

## Política de tests

No se persigue un % de cobertura global (métrica que miente). Se exige cobertura **donde el fallo es irreversible o caro**:

| Zona                       | Nivel exigido                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Migraciones de esquema** | ✅ Hecho: `migrations.node.test.ts` aplica la cadena entera sobre SQLite real                                                                       |
| **Políticas RLS y RPCs**   | ✅ Hecho: 154 asserts en `supabase/tests/*.test.sql`, cada fichero sobre una base construida desde cero. Bloqueante en CI                           |
| **Motor de sync**          | ✅ Parcial: cubierto contra un `FakeServer` que modela el trigger LWW y `sync_seq`. ❌ **Falta** contra Supabase local (dos dispositivos de verdad) |
| **Import de backups**      | ✅ Parcial: el esquema del `.restoshare` está cubierto en `packages/shared`. ❌ **Falta** el round-trip export→import idempotente                   |
| **Repositorios y mappers** | ✅ Hecho                                                                                                                                            |
| **Schemas zod**            | ✅ Hecho                                                                                                                                            |
| **Tools del asistente**    | ✅ Parcial: `tools.node.test.ts` cubre la ejecución. ❌ **Falta** el set de evaluación de preguntas                                                 |
| **Worker**                 | ✅ Hecho: 57 tests con `vitest` sobre rutas, auth, push, imágenes y enlaces. Sin `@cloudflare/vitest-pool-workers` — los dobles bastan hasta ahora  |
| **Componentes de UI**      | ❌ **Nada.** Cero `.test.tsx`. `@testing-library/react-native` está instalado y no se importa en ninguna parte                                      |

Además:

- **Test de regresión por bug**: todo bug corregido entra con su test.
- **Un test de una propiedad no funcional tiene que fallar con el código
  anterior.** Si mide consultas, latencia o tamaño, compruébalo revirtiendo el
  cambio y viéndolo caer. Un guardián que no caza lo que dice cazar es peor que
  ninguno: da tranquilidad falsa. `query-count.node.test.ts` se verificó así.
- Fixtures de datos reales **anonimizados** para la migración (la DB del autor es el mejor caso de prueba que existe).

## Convenciones

- Idioma: **nombres e identificadores en inglés**; comentarios, documentación y
  textos de UI **en español**. La regla decía «comentarios en inglés» y el código
  real llevaba tiempo escribiéndolos en español —`push.ts`, `photos.ts`,
  `tables.ts`, medio motor de sync—, así que se ha cambiado la regla para que
  describa lo que se hace. Lo que ya está en inglés se queda: reescribir
  comentarios buenos para uniformar el idioma es cambiar algo que funciona por
  algo que se lee igual.
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
