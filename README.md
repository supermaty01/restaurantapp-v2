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
│   └── shared/      # Schemas zod y tipos compartidos entre mobile y api
├── supabase/        # Migraciones SQL, políticas RLS, seeds
└── docs/            # Documentación de diseño y plan de trabajo ← empezar por aquí
```

## Documentación

El plan completo vive en [`docs/`](docs/README.md). Documentos clave:

- [Visión y principios](docs/00-vision-y-principios.md)
- [Arquitectura](docs/01-arquitectura.md)
- [Roadmap por fases](docs/10-roadmap.md)

## Stack

| Pieza               | Tecnología                                                     | Plan gratis |
| ------------------- | -------------------------------------------------------------- | ----------- |
| App móvil           | Expo + React Native, expo-router, Drizzle + SQLite, NativeWind | —           |
| Base de datos cloud | Supabase (Postgres + Auth + Realtime + pgvector)               | ✅          |
| API                 | Cloudflare Workers + Hono                                      | ✅          |
| Imágenes            | Cloudflare R2                                                  | ✅ (10 GB)  |
| Builds              | EAS                                                            | ✅          |

## Estado

🚧 Fase de diseño. El código de la v1 vive en `C:\Universidad\Movil\restaurantapp-application` y se migrará por fases según el [roadmap](docs/10-roadmap.md).
