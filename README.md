# RestaurantApp v2 🍔

Evolución de [RestaurantApp](https://github.com/) — diario gastronómico personal, ahora **local-first con nube opcional**: cuentas, sincronización en segundo plano, amigos, feed social y un asistente con IA.

> **Principio rector:** la app funciona al 100% sin cuenta y sin conexión. La nube (Supabase + Cloudflare) es una capa opcional que añade sync, social y compartir por links. Los datos del usuario nunca se pierden ni quedan rehenes del servidor.

## Estructura del monorepo

```
restaurant-app-v2/
├── apps/
│   ├── mobile/      # App Expo / React Native (SQLite local, Drizzle, NativeWind)
│   └── api/         # Cloudflare Worker (Hono): share links, proxy IA, imágenes R2
├── packages/
│   └── shared/      # Lo que comparten app y Worker: el esquema del .restoshare
├── supabase/        # Migraciones SQL, políticas RLS, tests contra Postgres
└── docs/            # Documentación de diseño y plan de trabajo ← empezar por aquí
```

Los proyectos nativos (`android/`, `ios/`) **no están en el repo**: los genera
EAS desde `apps/mobile/app.config.js`, que es la única fuente de verdad de la
configuración nativa.

## Documentación

El plan completo vive en [`docs/`](docs/README.md). Por dónde empezar:

- [ESTADO](docs/ESTADO.md) — dónde estamos y qué sigue. **Lo primero.**
- [AGENTS.md](AGENTS.md) — cómo se trabaja aquí: puertas de calidad, convenciones
  y los errores que ya salieron caros una vez
- [Visión y principios](docs/00-vision-y-principios.md)
- [Arquitectura](docs/01-arquitectura.md)

## Puesta en marcha

```bash
npm ci
cp apps/mobile/.env.example apps/mobile/.env   # y rellenar
npm run mobile
```

Antes de empujar, `npm run check` (formato, lint, tipos y tests de los tres
workspaces). El hook de pre-push ya lo hace.

## Stack

| Pieza               | Tecnología                                                     | Plan gratis |
| ------------------- | -------------------------------------------------------------- | ----------- |
| App móvil           | Expo + React Native, expo-router, Drizzle + SQLite, NativeWind | —           |
| Base de datos cloud | Supabase (Postgres + Auth + Realtime + pgvector)               | ✅          |
| API                 | Cloudflare Workers + Hono                                      | ✅          |
| Imágenes            | Cloudflare R2                                                  | ✅ (10 GB)  |
| Builds              | EAS                                                            | ✅          |

## Estado

Implementado y funcionando: diario local, sincronización, cuentas, amigos, feed,
etiquetado, notificaciones push y compartir por enlace. 19 migraciones aplicadas
contra un proyecto real.

Sin publicar todavía. Lo que falta y lo que se está haciendo ahora vive en
[docs/ESTADO.md](docs/ESTADO.md), que es el documento que se actualiza al cerrar
cada bloque de trabajo.
