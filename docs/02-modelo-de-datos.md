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

Tabla `change_log(id, table_name, row_id, row_uuid, operation, changed_at, synced)` alimentada por la capa de repositorios (no triggers de SQLite, para mantener la lógica en TS y testeable). Es la cola de salida del sync. Detalle en [03](03-sync.md).

`row_uuid` está desnormalizado a propósito: cuando la fila se borra de verdad, su id local deja de resolver a nada y la entrada tiene que seguir sabiendo qué identidad global hay que dar por muerta.

Las **tablas de unión no pasan por aquí**: no tienen uuid ni identidad propia, así que viajan con su fila padre. Ver [03](03-sync.md).

## Entidades nuevas

### Personas y participantes de visitas

Motivación: (a) etiquetar con quién fuiste a una visita (estilo BeReal), (b) habilitar consultas del asistente como "¿cuándo fue la última vez que comí con Caro?". Clave: **una persona no tiene por qué ser usuaria de la app**.

```
people
  id                   integer PK    ← entero local (como el resto)
  uuid                 text unique   ← identidad de sync
  name                 text          ← "Caro"
  linked_account_uuid  text null     ← el uuid de auth, si la etiqueta apunta a una cuenta
  username             text null     ← el @handle al etiquetar, copiado a propósito
  user_id, created_at, updated_at, deleted

visit_participant (N:M)
  visit_id    integer → visits
  person_id   integer → people
  tag_status  text: 'local' | 'pending'
  PK (visit_id, person_id)
```

- `linked_account_uuid` es el uuid remoto de `auth.users`, no un id local: quien te acompaña vive en el móvil de otra persona, y su fila aquí es una etiqueta con un puntero. En el espejo de Postgres la columna se llama `linked_user_id`.
- El `username` se **copia** en vez de consultarse. Una etiqueta tiene que dibujarse sin conexión y años después; un handle que desde entonces cambió es un problema menor que un chip que no sabe pintarse.
- `tag_status` distingue si la etiqueta _puede_ viajar (`pending`, hay cuenta a la que llegar) de si es solo un nombre anotado (`local`). **No es un flujo de aprobación**: a nadie se le pide permiso para etiquetarlo. El consentimiento es posterior y vive en `tag_rejections`, una tabla solo de servidor. Ver [06](06-social.md).
- Identidad: la cuenta cuando la hay, el nombre cuando no. Dos amigas pueden llamarse Ana, pero una cuenta es una persona.

### Visibilidad por entidad

`restaurants`, `dishes` y `visits` ganan `visibility: 'default' | 'private' | 'friends' | 'public'`, default **`default`**.

`default` no es un hueco: es un valor guardado que significa «lo que digan mis ajustes generales, ahora y más adelante», y se resuelve al leer. La primera versión copiaba el ajuste en la fila al crearla, lo cual convertía el ajuste en una sugerencia de una sola vez y dejaba todo lo importado de la v1 clavado en privado. El razonamiento completo y sus consecuencias en [06](06-social.md).

Los ajustes generales por tipo viven en `app_settings` (local) y en `visibility_defaults` (Postgres): el servidor también tiene que poder resolverlos, porque es quien decide si tu amigo puede leer una fila.

Los tags y las personas son siempre privados (solo el nombre de la persona etiquetada se muestra a quien ya puede ver la visita).

## Esquema cloud (Supabase)

Dos grupos:

1. **Espejo de datos personales** — mismas tablas y columnas que local (`restaurants`, `dishes`, `visits`, `tags`, `images`, `people`, uniones). RLS: solo el dueño (`user_id = auth.uid()`) lee/escribe; los amigos tienen lectura sobre filas con `visibility in ('friends','public')` según la policy de amistad.
2. **Solo servidor** — no se sincronizan al SQLite de otros:
   - `profiles(user_id, username unique, display_name, avatar_url, bio)`
   - `friendships(user_a, user_b, status: pending|accepted, requested_by)`
   - `share_links(id corto, entity_type, entity_id, owner_id, expires_at, revoked)`
   - `visibility_defaults(user_id, restaurant, dish, visit)` — los ajustes generales, para resolver `visibility = 'default'`
   - `tag_rejections(user_id, visit_uuid)` — quitarse de una etiqueta ajena. Fila **tuya** a propósito: `visit_participant` pertenece a quien etiquetó, y su móvil reenvía el conjunto completo en cada sync
   - `embeddings(entity_type, entity_id, user_id, vector)` con pgvector 🚧
   - `ai_usage(user_id, period, tokens_used)` para cuotas 🚧

## Imágenes

- Local: archivo en filesystem + fila `images` con `path` (igual que v1) y ahora `uuid` + `remote_key` (clave en R2, null si no subida).
- Cloud: solo metadatos en Postgres; el binario vive en R2 con clave `{user_id}/{image_uuid}` (sin extensión; el content-type va en los metadatos del objeto). Las sube el sync de 15 en 15, ver [05](05-api.md).

## Diagrama (simplificado)

```
users/profiles ──< friendships
      │
      ├──< restaurants ──< dishes ──< dish_tag >── tags
      │        │              └──< dish_visit >──┐
      │        └──< visits ──────────────────────┘
      │              ├──< visit_participant >── people (linked_account_uuid → auth.users)
      │              └──< images (también en restaurants y dishes)
      └──< share_links / embeddings / ai_usage
```

**Resuelto:** el precio del plato admite decimales. SQLite no obliga el tipo de columna y guardaba `3.5` en una INTEGER sin protestar; Postgres rechazaba la fila entera al sincronizar con `invalid input syntax for type integer: "3.5"`. De las dos formas de reconciliarlo se eligió la que no pierde datos: `numeric(12,2)` en el espejo (migración 0008). La moneda sigue sin modelarse.
**Abierto:** purga de soft-deletes y de imágenes huérfanas en R2 (job periódico del Worker con cron trigger, fase 4+).
