# 📍 ESTADO — documentación viva

**Última actualización:** 2026-07-17

Este archivo es el punto de entrada al retomar el trabajo: qué está hecho, qué sigue, qué está bloqueado. Se actualiza al cerrar cada bloque de trabajo.

## Estado global

| Fase | Estado |
|---|---|
| Documentación de diseño | ✅ Completa (docs 00–13) |
| 0 — Puesta a punto | 🔜 Siguiente |
| 1 — Esquema local | ⬜ |
| 2 — Supabase + Auth | ⬜ Bloqueada (requiere credenciales) |
| 3 — Sync | ⬜ |
| 4 — Worker / Share | ⬜ Bloqueada (requiere credenciales) |
| 5 — Social | ⬜ |
| 6 — UI | ⬜ |
| 7 — Asistente IA | ⬜ Bloqueada (requiere credenciales) |

## Hecho

- Repo `restaurant-app-v2` creado con estructura de monorepo (`apps/mobile`, `apps/api`, `packages/shared`, `supabase`, `docs`).
- Documentación de arquitectura completa (00–13), incluyendo las decisiones de: no reescribir desde cero, sync propio, Workers AI gratuito vía AI Gateway, imágenes sin dependencias, rediseño de la arquitectura de información.

## Siguiente paso concreto

**Fase 0** ([roadmap](10-roadmap.md#fase-0--puesta-a-punto)), en este orden:

1. Scaffolding del monorepo (workspaces, tsconfig base, eslint/prettier compartidos) — ver [12](12-calidad.md).
2. Copiar el código v1 a `apps/mobile` (el repo v1 en `C:\Universidad\Movil\restaurantapp-application` es **solo lectura**: es la referencia, no se toca).
3. Upgrade de SDK paso a paso — ver procedimiento en [11](11-dependencias.md#procedimiento-de-upgrade-de-sdk-fase-0-y-en-adelante).
4. Carrusel/visor de imágenes propios; retirar librerías de imágenes.
5. Eliminar auth legacy (Railway).
6. CI verde.

## Bloqueos conocidos

Requieren acción del autor (credenciales/cuentas), no son trabajo de código:

- **Fase 2**: proyecto Supabase + OAuth de Google (y Apple si iOS). Ver [13 — Despliegue §3](13-despliegue.md).
- **Fase 4**: cuenta Cloudflare, bucket R2, decisión de dominio propio para App Links.
- **Fase 7**: AI Gateway creado en el dashboard.
- **Verificación en dispositivo**: los upgrades de SDK y los módulos nativos solo se validan de verdad ejecutando la app en un emulador/dispositivo real.

## Decisiones abiertas pendientes de resolver

Listadas en cada doc como **Abierto:**. Las de mayor impacto:

| Tema | Doc | Cuándo se decide |
|---|---|---|
| `expo-image` vs `Image` de RN core | [11](11-dependencias.md) | Fase 0 |
| Precio: entero sin moneda vs con moneda | [02](02-modelo-de-datos.md) | Fase 1 |
| Dominio propio (único gasto probable, ~$10/año) | [05](05-api.md) | Fase 4 |
| Estructura de navegación definitiva | [08](08-ui.md) | Fase 6 |
| Modelo concreto de chat/embeddings del catálogo | [07](07-asistente-ia.md) | Fase 7a |
| ¿Asistente disponible sin cuenta? | [07](07-asistente-ia.md) | Fase 7 |

## Notas de contexto que no están en el código

- El repo v1 (`C:\Universidad\Movil\restaurantapp-application`) es **read-only**: toda la implementación va en este repo.
- El dolor histórico de upgrades de Expo vino de las **librerías de imágenes** — de ahí la decisión de escribirlas a mano ([11](11-dependencias.md)).
- Restricción dura de coste: **todo debe caber en free tiers**. Ante la duda, se recorta alcance antes que pagar.
