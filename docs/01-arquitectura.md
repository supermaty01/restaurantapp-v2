# 01 — Arquitectura

## Vista general

```
┌─────────────────────────────────────────────┐
│  App Expo (apps/mobile)                     │
│  ┌───────────────┐   ┌───────────────────┐  │
│  │ UI (features/)│──▶│ SQLite (Drizzle)  │  │  ← fuente de verdad local
│  └───────────────┘   └─────────┬─────────┘  │
│  ┌───────────────┐             │            │
│  │ Asistente IA  │   ┌─────────▼─────────┐  │
│  │ (orquestador  │   │ Sync engine       │  │  ← solo si hay sesión
│  │  local)       │   │ (segundo plano)   │  │
│  └───────┬───────┘   └─────────┬─────────┘  │
└──────────┼─────────────────────┼────────────┘
           │ LLM proxy           │ push/pull (REST + RLS)
           ▼                     ▼
┌──────────────────┐   ┌──────────────────────┐
│ Cloudflare Worker│   │ Supabase             │
│ (apps/api, Hono) │◀─▶│ Postgres + Auth +    │
│ · share links    │   │ Realtime + pgvector  │
│ · proxy IA+cuotas│   └──────────────────────┘
│ · imágenes ─▶ R2 │
└──────────────────┘
```

## Componentes y responsabilidades

### App móvil (`apps/mobile`)

Se conserva el stack de la v1 (decisión: **no reescribir desde cero**): Expo + expo-router, Drizzle sobre expo-sqlite, NativeWind, react-hook-form + zod, arquitectura por features. Cambios estructurales:

- **SQLite es la única fuente de lectura de la UI.** Nada de la UI llama a la red directamente; el sync engine y el asistente son los únicos clientes de red.
- Capa `services/sync` nueva (ver [03](03-sync.md)).
- Capa `features/assistant` nueva (ver [07](07-asistente-ia.md)).
- La auth legacy contra Railway (`services/api.ts`) se elimina por completo.

### Supabase

- **Postgres** con esquema espejo del local (ver [02](02-modelo-de-datos.md)) + tablas exclusivas del servidor (perfiles, amistades, share links, feed).
- **Auth**: email/password, Google, Apple (ver [04](04-auth.md)).
- **RLS en todas las tablas.** La app habla con Supabase directamente (supabase-js) para el sync CRUD; la seguridad la garantizan las policies, no un backend intermedio. Esto mantiene el API mínimo.
- **pgvector** para embeddings de búsqueda semántica de usuarios con cuenta (el modo local usa otra vía, ver [07](07-asistente-ia.md)).
- **Realtime** (opcional, fase social): notificaciones de feed/solicitudes en vivo.

### Cloudflare Worker (`apps/api`)

Solo lo que **no puede** hacerse cliente→Supabase con RLS:

1. **Share links** públicos con preview web y OG tags (ver [05](05-api.md)).
2. **Proxy de IA**: guarda las API keys, aplica cuotas por usuario, expone endpoints de chat/embeddings/STT (ver [05](05-api.md) y [07](07-asistente-ia.md)).
3. **Imágenes**: subida/lectura firmada contra R2. Las fotos NO van a Supabase Storage (1 GB free) sino a R2 (10 GB free, sin egreso).

Framework: **Hono**. Validación con los mismos schemas zod de `packages/shared`. Verifica JWTs de Supabase para autenticar peticiones.

### Paquete compartido (`packages/shared`)

Schemas zod de entidades y de payloads de API. Es el contrato único entre mobile y api. También constantes (versiones de formato de backup, límites, enums de visibilidad).

## Decisiones transversales

- **Decisión:** monorepo con npm workspaces (sin turborepo de momento; se añade solo si el build lo pide).
- **Decisión:** TypeScript estricto en todos los paquetes.
- **Decisión:** la app nunca contiene secretos. Google Maps API key restringida por app; todo lo demás vive en el Worker o en Supabase.
- **Decisión:** el Worker es stateless; todo estado en Supabase/R2. Así el free tier de Workers (requests/día) es el único límite.
- **Abierto:** CI (GitHub Actions) — lint + typecheck + tests por workspace; definir al crear el scaffolding.

## Modos de operación de la app

| Modo              | Datos                       | Sync             | Social | Share                 | Asistente IA                    |
| ----------------- | --------------------------- | ---------------- | ------ | --------------------- | ------------------------------- |
| Anónimo (default) | SQLite local                | ❌               | ❌     | export/import archivo | ✅ (con cuota anónima reducida) |
| Con cuenta        | SQLite local + espejo cloud | ✅ segundo plano | ✅     | ✅ links              | ✅ (cuota normal)               |

**Abierto:** si el asistente en modo anónimo es viable (requiere proxy IA sin auth → riesgo de abuso). Alternativa: exigir cuenta solo para el asistente. Se decide en fase 7.
