# 02 — Modelo de datos

## Punto de partida (v1)

Tablas: `restaurants`, `dishes`, `visits`, `tags`, `images`, uniones N:M (`restaurant_tag`, `dish_tag`, `dish_visit`), `app_settings`. IDs enteros autoincrementales, soft-delete con flag `deleted`, imágenes como archivos locales referenciados por path.

## Cambios estructurales

### 1. Identidad de sync: PK entero local + `uuid` global ⭐ decisión revisada

**Decisión (revisada en implementación):** se **conserva el PK entero autoincremental local** y se añade una columna **`uuid text unique`** a cada tabla sincronizable, generada en el cliente. El `uuid` es la identidad global (la que viaja a Supabase); el entero sigue siendo la clave local y de las FKs.

> **Por qué se cambió respecto al diseño inicial (`id: uuid` como PK).** Migrar el PK de entero a UUID obliga a reescribir _todos_ los usos de IDs del código portado: cientos de `id: number`, `Number(id)`, tipos de params de rutas, DTOs y FKs. Es un cambio de blast radius enorme y **no verificable en dispositivo en esta fase** (el mayor riesgo: un `Number(uuid)` silencioso que devuelve `NaN`). El patrón "PK entero local + uuid de sync" es un enfoque local-first estándar que:
>
> - logra el mismo objetivo (identidad global sin colisiones entre dispositivos),
> - es una **migración puramente aditiva** (añadir columna + backfill), de riesgo bajo,
> - deja intacto el código de la app (sigue con enteros), confinando la complejidad uuid↔id-local a la **capa de sync (fase 3)**, que es donde corresponde.
>
> Coste asumido: el motor de sync mantiene un mapeo uuid↔id-local y traduce las FKs al empujar/traer (detalle en [03](03-sync.md)). Es más lógica en la fase 3, pero localizada y testeable.

- SQLite: `uuid` es `text unique not null`. Postgres (Supabase): la tabla espejo usa `uuid` como PK.
- La migración v1→v2 hace backfill de un uuid por fila existente (ver [09](09-migracion-datos.md)); las FKs locales **no cambian**.

### 2. Columnas de sync en todas las tablas de datos

```
id          integer PK autoincrement   ← se mantiene (clave local y de FKs)
uuid        text unique not null       ← identidad global de sync (v4, cliente)
...campos propios...
user_id     integer null               ← null en modo anónimo (FK local a users)
created_at  text (ISO 8601, UTC)
updated_at  text (ISO 8601, UTC)       ← lo escribe siempre el cliente al modificar
deleted     boolean                    ← soft-delete, ya existía en v1
```

Los soft-deletes son permanentes hasta una purga explícita (los necesita el sync para propagar borrados).

### 3. Change-log local

Tabla `change_log(id, table_name, row_id, operation, changed_at, synced)` alimentada por la capa de repositorios (no triggers de SQLite, para mantener la lógica en TS y testeable). Es la cola de salida del sync. Detalle en [03](03-sync.md).

## Entidades nuevas

### Personas y participantes de visitas

Motivación: (a) etiquetar con quién fuiste a una visita (estilo BeReal), (b) habilitar consultas del asistente como "¿cuándo fue la última vez que comí con Caro?". Clave: **una persona no tiene por qué ser usuaria de la app**.

```
people
  id          integer PK          ← entero local (como el resto)
  uuid        text unique         ← identidad de sync
  name        text                ← "Caro"
  linked_user_id integer null     ← si esa persona es un amigo con cuenta, se vincula
  user_id, created_at, updated_at, deleted

visit_participants (N:M)
  visit_id    integer → visits
  person_id   integer → people
  tag_status  text: 'local' | 'pending' | 'accepted' | 'rejected'
  PK (visit_id, person_id)
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

- Local: archivo en filesystem + fila `images` con `path` (igual que v1) y ahora `uuid` + `remote_key` (clave en R2, null si no subida).
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

**Abierto:** ¿precio del plato como entero (centavos) o texto libre con moneda? La v1 usa entero sin moneda; **se pospone** — no bloquea el esquema de sync y tocarlo ahora añadiría churn a los formularios ya migrados. Se retoma con el rediseño de UI (fase 6).
**Abierto:** purga de soft-deletes y de imágenes huérfanas en R2 (job periódico del Worker con cron trigger, fase 4+).
