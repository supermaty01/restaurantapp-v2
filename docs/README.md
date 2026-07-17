# Documentación — RestaurantApp v2

Índice de los documentos de diseño. El nivel de detalle es de **plan de arquitectura**: decisiones, modelos y flujos. Las especificaciones finas (contratos de API exactos, SQL definitivo, wireframes) se hacen al iniciar cada fase.

> **Documentación viva.** [ESTADO.md](ESTADO.md) refleja el progreso real de la implementación y es lo primero que hay que leer (y actualizar) al retomar el trabajo.

| Doc                                                   | Contenido                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| [ESTADO](ESTADO.md)                                   | 📍 Dónde estamos, qué sigue, decisiones pendientes                |
| [00 — Visión y principios](00-vision-y-principios.md) | Qué es la app, principios innegociables                           |
| [01 — Arquitectura](01-arquitectura.md)               | Componentes del sistema, quién habla con quién, monorepo          |
| [02 — Modelo de datos](02-modelo-de-datos.md)         | Esquema local y cloud, UUIDs, change-log, personas                |
| [03 — Sincronización](03-sync.md)                     | Motor de sync push/pull, conflictos, imágenes                     |
| [04 — Autenticación](04-auth.md)                      | Login opcional, proveedores, vinculación de datos locales         |
| [05 — API (Cloudflare Worker)](05-api.md)             | Share links, proxy de IA, imágenes R2, cuotas                     |
| [06 — Social](06-social.md)                           | Perfiles, amigos, visibilidad, feed, etiquetado en visitas        |
| [07 — Asistente IA](07-asistente-ia.md)               | Consultas en lenguaje natural, agente de registro, voz            |
| [08 — UI](08-ui.md)                                   | Sistema de diseño, arquitectura de información nueva              |
| [09 — Migración de datos](09-migracion-datos.md)      | Preservación de datos v1, backups, compatibilidad                 |
| [10 — Roadmap](10-roadmap.md)                         | Fases, dependencias, criterios de salida                          |
| [11 — Dependencias](11-dependencias.md)               | Política de dependencias, upgrades de SDK, imágenes sin librerías |
| [12 — Calidad](12-calidad.md)                         | Lint, formato, tipos, tests, reglas de arquitectura               |
| [13 — Despliegue](13-despliegue.md)                   | Guía end-to-end: app, Supabase, Worker, R2, AI Gateway            |

## Convenciones

- **Decisión:** marca decisiones tomadas. **Abierto:** preguntas pendientes que se resuelven al detallar la fase.
- Si una decisión cambia, se actualiza el documento (no se acumula historia; para eso está git).
- Al terminar cualquier bloque de trabajo: actualizar [ESTADO.md](ESTADO.md).
