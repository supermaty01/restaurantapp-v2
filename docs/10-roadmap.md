# 10 — Roadmap

Cada fase deja la app **funcional y publicable**. Las fases 0–1 tocan datos existentes (riesgo alto, alcance corto); a partir de ahí todo es aditivo. Al iniciar cada fase se baja su documento a especificación detallada.

> **Estado vivo:** este roadmap es la fuente de verdad del progreso. Ver [ESTADO.md](ESTADO.md) para el detalle de qué está hecho ahora mismo.

```
0 Puesta a punto ─▶ 1 Esquema local ─▶ 2 Supabase+Auth ─▶ 3 Sync ─▶ 4 API/Share ─▶ 5 Social ─▶ 7 IA
                                                              6 UI: sistema de diseño ──┘ (antes de 5)
                                                              6 UI: re-skin pantallas v1 (paralelo desde 4)
```

## Fase 0 — Puesta a punto

Base segura antes de construir. Sin features.

- Monorepo npm workspaces; código v1 → `apps/mobile`; schemas zod compartidos → `packages/shared`.
- **Upgrade Expo SDK 52 → actual, con cuidado dependencia por dependencia** (ver [11 — Dependencias](11-dependencias.md)). Es el punto histórico de dolor del proyecto.
- **Reescribir el carrusel/visor de imágenes desde cero, sin dependencias** — causa raíz de los bloqueos de upgrade anteriores.
- Eliminar auth legacy de Railway (`services/api.ts`, `AuthContext`, pantallas `(auth)/*`, token en AsyncStorage).
- Endurecer calidad: ESLint estricto, Prettier, tests, CI (ver [12 — Calidad](12-calidad.md)).

**Salida:** la app funciona igual que v1, sobre el repo nuevo, SDK actual, sin código muerto, con CI en verde.

## Fase 1 — Refactor del esquema local ⚠️ crítica

Documentos: [02](02-modelo-de-datos.md), [09](09-migracion-datos.md).

- UUIDs + `created_at`/`updated_at` + `visibility` + `change_log`; tablas `people` y `visit_participants` (etiquetado local de personas ya funcional en el formulario de visitas).
- Migración con backup automático previo, verificación y fixtures reales.
- Importador versionado (acepta `.restoshare` v1 y backup v1); export backup v2.
- Repositorios de consulta parametrizados y testeados (base de las futuras tools del asistente).

**Salida:** datos intactos tras migrar; import/export v1 y v2 funcionando; etiquetar personas en visitas (modo local).

## Fase 2 — Supabase + login opcional

Documento: [04](04-auth.md).

- Proyecto Supabase; esquema espejo + RLS de dueño; migraciones SQL en `supabase/`.
- Auth email/Google/Apple; wizard de vinculación de datos locales; perfil básico (username).
- La app sin cuenta no cambia en nada.

**Salida:** puedo crear cuenta, loguearme y mis datos locales quedan vinculados (aún sin sync).

## Fase 3 — Motor de sync ⚠️ la más laboriosa

Documento: [03](03-sync.md).

- Push/pull con `change_log` y cursores; last-write-wins; bootstrap de dispositivo nuevo.
- Subida/bajada de imágenes (requiere adelantar de fase 4 el endpoint de R2 del Worker).
- Suite de integración contra Supabase local (conflictos, borrados, dos dispositivos).
- UI de estado de sync en ajustes.

**Salida:** dos dispositivos con la misma cuenta convergen sin acción manual.

## Fase 4 — Worker y share por links

Documento: [05](05-api.md).

- Worker Hono: auth JWT, `POST /share`, resolución + preview web con OG tags, deep links, endpoints de imágenes R2, crons de mantenimiento.
- Flujo de importación desde link en la app (reusa conflictos del importador).
- Decidir dominio propio (App Links) — único gasto probable del proyecto.

**Salida:** comparto un restaurante por WhatsApp con preview bonita; mi amigo lo abre e importa en su app.

## Fase 5 — Social

Documento: [06](06-social.md).

- Perfiles completos, amistades (solicitud/aceptación), visibilidad por entidad en formularios.
- Etiquetado de amigos en visitas con flujo pending/accepted; visitas aceptadas en el perfil propio.
- Feed (query paginada + RLS), notificaciones in-app; push si el presupuesto de tiempo alcanza.

**Salida:** veo en el feed dónde estuvieron mis amigos; me etiquetan y decido si sale en mi perfil.

## Fase 6 — UI renovada (transversal)

Documento: [08](08-ui.md). No es estrictamente secuencial:

- **6a — Sistema de diseño** (tokens + componentes, tomando el proyecto de Claude Design como *referencia visual*, no como estructura): debe completarse **antes de la fase 5**, para que perfil/feed/asistente nazcan con el diseño nuevo.
- **6b — Re-arquitectura de navegación**: la v2 tiene superficies que el rediseño no contemplaba (feed, perfil, amigos, asistente). La estructura de navegación se rediseña de cero.
- **6c — Re-skin de pantallas v1**: en paralelo desde la fase 4, por grupos de pantallas.
- Prefill por parámetros en formularios (prerrequisito del asistente).

## Fase 7 — Asistente IA

Documento: [07](07-asistente-ia.md). Requiere su propio ciclo de diseño detallado (tools, prompts, evaluación).

- 7a: endpoints `/ai/*` en el Worker (Workers AI vía AI Gateway) con cuotas; indexación de embeddings locales.
- 7b: consultas en lenguaje natural (agente con tools de solo-lectura híbridas estructurada+semántica).
- 7c: agente de registro conversacional (tools de propuesta + formularios pre-llenados).
- 7d: entrada por voz (STT nativo + fallback Whisper en Workers AI).

**Salida:** "¿cuántas carbonaras comí en Roma?" responde bien; "estoy en Guadalupe con Irene comiendo chihuahua" termina en visita registrada con confirmaciones.

## Ideas futuras (fuera de alcance v2, anotadas)

- Likes/comentarios en el feed; "qué pedir aquí" (recomendaciones al llegar a un sitio); wrapped anual; foto→plato con visión; resumen semanal del feed; TTS/conversación por voz continua; deduplicación asistida de entidades; web-app.
