# 02 — Modelo de datos

## Punto de partida (v1)

Tablas: `restaurants`, `dishes`, `visits`, `tags`, `images`, uniones N:M (`restaurant_tag`, `dish_tag`, `dish_visit`), `app_settings`. IDs enteros autoincrementales, soft-delete con flag `deleted`, imágenes como archivos locales referenciados por path.

## Cambios estructurales

### 1. UUIDs como identidad global

**Decisión:** toda entidad pasa a `id: uuid` (v4, generado en el cliente). Motivo: los IDs enteros locales colisionan al sincronizar entre dispositivos/usuarios. Un UUID generado offline es válido globalmente sin coordinación.

- En SQLite se almacena como `text`. En Postgres como `uuid`.
- La migración v1→v2 genera UUIDs para las filas existentes y reescribe las FKs (ver [09](09-migracion-datos.md)).

### 2. Columnas de sync en todas las tablas de datos

```
id          text (uuid) PK
...campos propios...
user_id     text (uuid, null en modo anónimo)
created_at  text (ISO 8601, UTC)
updated_at  text (ISO 8601, UTC)   ← lo escribe siempre el cliente al modificar
deleted     boolean                ← soft-delete, ya existía en v1
```

Los soft-deletes son permanentes hasta una purga explícita (los necesita el sync para propagar borrados).

### 3. Change-log local

Tabla `change_log(id, table_name, row_id, operation, changed_at, synced)` alimentada por la capa de repositorios (no triggers de SQLite, para mantener la lógica en TS y testeable). Es la cola de salida del sync. Detalle en [03](03-sync.md).

## Entidades nuevas

### Personas y participantes de visitas

Motivación: (a) etiquetar con quién fuiste a una visita (estilo BeReal), (b) habilitar consultas del asistente como "¿cuándo fue la última vez que comí con Caro?". Clave: **una persona no tiene por qué ser usuaria de la app**.

```
people
  id          uuid
  name        text          ← "Caro"
  linked_user_id uuid null  ← si esa persona es un amigo con cuenta, se vincula
  user_id, created_at, updated_at, deleted

visit_participants (N:M)
  visit_id    uuid → visits
  person_id   uuid → people
  tag_status  text: 'local' | 'pending' | 'accepted' | 'rejected'
```

- En modo local, etiquetar a "Caro" solo crea/reutiliza una `person` local. `tag_status = 'local'`.
- Si la persona está vinculada a un usuario real, el etiquetado se convierte en una **solicitud** (`pending`): el otro usuario la acepta y la visita puede aparecer en su perfil (ver [06](06-social.md)).
- Si más adelante "Caro" se une a la app, su `person` local puede vincularse a su cuenta sin perder el historial de visitas compartidas.

### Visibilidad por entidad

`restaurants`, `dishes` y `visits` ganan `visibility: 'private' | 'friends' | 'public'`, default `private`. Controla qué ven los amigos en perfil y feed, y qué expone un share link. Los tags y las personas son siempre privados (solo el nombre de la persona etiquetada se muestra a quien ya puede ver la visita).

## Esquema cloud (Supabase)

Dos grupos:

1. **Espejo de datos personales** — mismas tablas y columnas que local (`restaurants`, `dishes`, `visits`, `tags`, `images`, `people`, uniones). RLS: solo el dueño (`user_id = auth.uid()`) lee/escribe; los amigos tienen lectura sobre filas con `visibility in ('friends','public')` según la policy de amistad.
2. **Solo servidor** — no se sincronizan al SQLite de otros:
   - `profiles(user_id, username unique, display_name, avatar_url, bio)`
   - `friendships(user_a, user_b, status: pending|accepted, requested_by)`
   - `share_links(id corto, entity_type, entity_id, owner_id, expires_at, revoked)`
   - `embeddings(entity_type, entity_id, user_id, vector)` con pgvector
   - `ai_usage(user_id, period, tokens_used)` para cuotas

## Imágenes

- Local: archivo en filesystem + fila `images` con `path` (igual que v1) y ahora `id` uuid + `remote_key` (clave en R2, null si no subida).
- Cloud: solo metadatos en Postgres; el binario vive en R2 (`{user_id}/{image_id}.jpg`, comprimidas al subir).

## Diagrama (simplificado)

```
users/profiles ──< friendships
      │
      ├──< restaurants ──< dishes ──< dish_tag >── tags
      │        │              └──< dish_visit >──┐
      │        └──< visits ──────────────────────┘
      │              ├──< visit_participants >── people (linked_user_id → users)
      │              └──< images (también en restaurants y dishes)
      └──< share_links / embeddings / ai_usage
```

**Abierto:** ¿precio del plato como entero (centavos) o texto libre con moneda? La v1 usa entero sin moneda; decidir al detallar fase 1 (afecta a usuarios en distintos países).
**Abierto:** purga de soft-deletes y de imágenes huérfanas en R2 (job periódico del Worker con cron trigger, fase 4+).
