# 03 — Sincronización

## Decisión de fondo

**Decisión: motor de sync propio** (push/pull sobre supabase-js) en vez de un servicio dedicado (PowerSync, ElectricSQL, WatermelonDB). Motivos: el modelo de datos es pequeño y estable, el caso dominante es 1 usuario con 1–2 dispositivos, se evita otra dependencia/servicio, y el conocimiento del protocolo queda en el proyecto. Coste: hay que diseñarlo y testearlo con cuidado — esta es la fase de mayor riesgo técnico después de la migración.

## Modelo

- **Fuente de verdad local:** la UI solo lee/escribe SQLite. El sync es un proceso de fondo que reconcilia.
- **Unidad de sync: la fila.** Estrategia de conflicto: **last-write-wins por fila** usando `updated_at` (reloj del cliente, ISO UTC). Para un diario personal esto es suficiente; no hay edición concurrente real de la misma fila por dos personas.
- **Soft-deletes** se propagan como updates (`deleted = true`).

### Identidad: uuid global vs PK entero local

La app usa PK entero autoincremental local; el `uuid` (columna única por fila) es la identidad global (ver [02](02-modelo-de-datos.md#1-identidad-de-sync-pk-entero-local--uuid-global--decisión-revisada)). El motor de sync es el único que traduce:

- **Push:** para cada fila del `change_log`, se envía su `uuid` y sus campos; **las FKs se traducen de id-local → uuid** de la fila referenciada (un join local). Supabase usa `uuid` como PK.
- **Pull:** llega una fila keyed por `uuid`. Se busca localmente por `uuid` (índice único): si existe → update de ese id-local; si no → insert con nuevo id-local autoincremental. **Las FKs entrantes (uuid) se traducen a id-local**; si el referenciado aún no está local, se resuelve en orden de dependencia o se difiere.
- El mapeo `uuid ↔ id-local` se resuelve por consulta sobre la propia columna `uuid` (no hace falta tabla de mapeo aparte).

Esto mantiene el código de la app en enteros y confina toda la complejidad de uuid a esta capa.

## Protocolo

### Cuándo corre

Al iniciar sesión, al volver la app a primer plano, **poco después de cualquier escritura local** (2,5 s de reposo, reiniciados por cada cambio nuevo, para que guardar tres cosas seguidas sea un solo sync) y a mano desde Perfil.

Lo de la escritura faltaba: escribir una entrada y quedarse en la app la dejaba en el móvil hasta el siguiente arranque. Para un diario que además es copia de seguridad eso es lo único que no puede pasar, y para el etiquetado significaba que la persona etiquetada no se enteraba hasta que quien la etiquetó mandara la app al fondo.

`recordChange` emite una señal (`services/sync/pending.ts`) y `useSync` decide qué hacer con ella: los repositorios no tienen cuenta, ni red, ni por qué decidir cuándo se habla con un servidor.

**Lo que se pide mientras corre una pasada no se descarta.** `requestSync` devolvía la que estuviera en marcha —es idempotente, y dos a la vez se pisarían los cursores, así que evitar la segunda era correcto— pero contesta a otra pregunta: quien acaba de guardar algo pregunta si **eso** llegó, y la pasada en curso ya envió lo suyo antes de que existiera. Con fotos subiendo, que es la parte que dura minutos, etiquetar a alguien durante ese rato dejaba la etiqueta en el móvil hasta el siguiente arranque. Ahora se anota y se repite al terminar. Una sola repetición, no una cola: la pasada siguiente drena la bandeja entera.

Cada pasada envía primero los **ajustes de visibilidad** de la cuenta. Una fila guardada como `default` no significa nada para el servidor hasta que sabe cuál _es_ el default de esa cuenta.

**Y hay que leerlos del disco antes**, cosa que durante un tiempo no se hacía. El almacén en memoria (`defaultsStore`) nace en blanco —todo privado— y solo lo rellenaba `useDefaultVisibility`, que es un hook: corre cuando se monta un formulario o la pantalla de Ajustes, no al arrancar. Así que la primera pasada tras abrir la app publicaba `private/private/private` encima de lo que el usuario tuviera elegido, y toda fila guardada como `default` —que son casi todas— pasaba a ser privada **para el servidor**, que es quien decide qué puede leer un amigo. En el móvil del dueño no se notaba nada: la app lee de SQLite. Los amigos veían un perfil vacío hasta que esa persona, por casualidad, volviera a abrir Ajustes.

Lo arregla `ensureDefaultsLoaded` (`features/privacy/loadDefaults.ts`), que el sync espera. Y si no se pueden leer, **no se publica nada**: el servidor no distingue «todavía no lo sé» de «no comparto nada», y la segunda respuesta esconde el diario entero.

Hay una segunda puerta al mismo fallo, y solo se abre al estrenar teléfono. El ajuste es **de la cuenta** pero se guarda **en el dispositivo**, así que un móvil nuevo no tiene nada en disco y su privado de reserva pisaría lo que la cuenta ya tenía elegido. Por eso **la primera vez manda el servidor**: si aquí no se ha elegido nunca y la cuenta tiene fila en `visibility_defaults`, se adopta y se guarda localmente. A partir de ahí manda el móvil, que es donde está el control.

### Push

1. Leer `change_log` con `synced = false`, agrupado por tabla, en orden de dependencia (restaurants → dishes/visits → uniones → images).
2. `upsert` por lotes a Supabase (`onConflict: id`), condicionado en el servidor a `updated_at` entrante ≥ existente (función SQL `upsert_if_newer` para no pisar cambios más nuevos de otro dispositivo).
3. Marcar `synced = true` solo tras confirmación.
4. **Fase aparte al final: las uniones.** Ver abajo.

### Pull

1. Cursor local por tabla (en `app_settings`). Es un **número de secuencia del servidor**, no una fecha.
2. `select * where user_id = me and sync_seq > cursor order by sync_seq limit N` por tabla, aplicar en SQLite con last-write-wins, avanzar cursor, repetir hasta agotar.

   **El cursor no puede ser `updated_at`, y durante un tiempo lo fue.** `updated_at` lo escribe el móvil que editó — es lo que compara el last-write-wins y por eso tiene que ser suyo. Usarlo además para paginar mezcla dos preguntas distintas:

   - _¿cuál de estas dos versiones gana?_ → `updated_at`, el reloj de quien escribió.
   - _¿qué ha cambiado desde que miré?_ → solo puede contestarlo el servidor, que es el único reloj que ven todos los dispositivos.

   Con un dispositivo funcionaba por casualidad. Con dos, bastaba con que el segundo tuviera el reloj unos minutos atrasado —desfase normal entre teléfonos, un cambio de zona horaria, uno que estuvo sin red— para que sus filas llegaran con una fecha anterior al cursor que el primero ya había guardado, y **el primero no las bajaba nunca**: sin error, sin reintento, sin nada que lo delatara. Para algo que también es copia de seguridad, perder filas en silencio es el peor fallo posible.

   Migración **0017**: una secuencia (`sync_seq`) sellada por trigger en cada insert _y_ en cada update. `nextval` es monótona y única por fila tocada, y no depende de ningún reloj. Una secuencia y no un `now()` del servidor porque `now()` devuelve el instante en que empezó la transacción, así que dos transacciones solapadas pueden grabar el mismo valor y una hacerse visible después de que otro dispositivo lo guardara como cursor — la fila se salta igual.

   El cursor avanza **después** de aplicar cada página: si el proceso muere a la mitad se repite esa página, y aplicar dos veces la misma fila es inofensivo mientras que saltársela es permanente.

   **El `where user_id = me` es obligatorio y no lo cubre RLS.** RLS dice qué te está _permitido leer_, y te está permitido leer la visita compartida de un amigo. Un `select *` sin filtrar se traía las filas de otras personas al diario local: el diario dejaba de ser solo lo que escribiste tú, y el push siguiente las estampaba con tu cuenta y las mandaba encima de las de su dueño, cosa que la policy de propiedad rechaza matando el push entero con `new row violates row-level security policy (USING expression)`.

   Lo ajeno llega a la app por las RPC sociales, que lo devuelven como algo que mirar. No entra en las tablas de las que está hecho el diario.

3. Primera sesión en un dispositivo nuevo = pull completo (bootstrap).
4. Una fila que llega por pull nace con su entrada de `change_log` ya marcada `synced`. Sin eso, el auto-reparador (`linkLocalData`, que encola toda fila sin entrada — así es como un primer login sube un diario anterior a la cuenta) no puede distinguirla de una fila local nueva, y el dispositivo le devuelve al servidor sus propias filas. Para los escalares es inofensivo; para las uniones resucita enlaces que otro dispositivo acababa de borrar.

### Las uniones viajan con su padre

`restaurant_tag`, `dish_tag`, `dish_visit` y `visit_participant` no pasan por `change_log`.

Una unión no tiene uuid, ni marcas de tiempo, ni identidad propia: _es_ el par de uuids. No hay nada que apuntar en la bitácora ni nada que comparar por última-escritura-gana.

Así que la unidad de trabajo es un padre, no un enlace: «el restaurante #4 tiene exactamente estas etiquetas». Al enviar un padre, su conjunto completo de enlaces reemplaza lo que hubiera en el servidor. Es idempotente, y un enlace borrado desaparece sin necesitar una lápida que lo explique.

Se envían **después de todos los padres**, porque un `dish_visit` adelantado a su plato lo rechazaría la clave foránea. Y en el pull solo se reemplazan los padres que volvieron en esa pasada: reescribir todas las uniones desharía los enlaces que el dispositivo hizo sin conexión.

Registro en `services/sync/tables.ts` (`LINK_TABLES`), mecánica en `services/sync/links.ts`.

### Disparadores

- Al abrir la app / volver a foreground.
- Debounced tras cada escritura local (~5 s).
- Periódico con `expo-background-task` (mejor esfuerzo; en móvil el background es poco fiable, el disparador real es abrir la app).
- Botón manual "sincronizar ahora" en ajustes, con indicador de estado (última sync, pendientes, errores).

## Imágenes

Sync en dos niveles, siempre después de las filas:

- **Subida:** imágenes con `remote_key = null` se comprimen (resize ~2048px, jpeg q80) y suben al Worker → R2. Solo en wifi por defecto (configurable).
- **Bajada:** `downloadMissingPhotos` trae en cada pasada las fotos que tienen `remote_key` y cuyo fichero no está en el teléfono, en tandas de 15, desde `GET /images/:userId/:key`.

  Esto **no existía** hasta ahora: el diseño decía «bajo demanda» y no había una sola línea que lo hiciera. `imagePathToUri()` resuelve siempre a un `file://` local y no cae de vuelta a la clave remota, así que restaurar en un móvil nuevo devolvía el diario entero con **todas las fotos rotas** — justo el caso que una copia de seguridad existe para cubrir. Se baja todo, no bajo demanda: un diario restaurado que necesita red para verse no está restaurado.

  Qué falta se deduce del disco («tiene clave y no tiene fichero»), no de una columna: así no hay estado que mantener al día ni que pueda quedarse mintiendo, y vaciar la caché del móvil se repara solo en la siguiente pasada.

- **`images.path` no se sincroniza**, y por eso hace falta `localDefaults` (`services/sync/tables.ts`): es la ruta del fichero _en este teléfono_ y la de otro dispositivo no significa nada aquí, pero la columna es `not null`. Sin rellenarla, insertar una foto que llegaba del servidor reventaba con `NOT NULL constraint failed: images.path` — y como `images` es la última tabla escalar del registro, ese error se llevaba por delante el final del pull: la restauración se quedaba sin fotos **y sin uniones** (etiquetas, platos por visita, personas), porque `pullLinks` va después y no llegaba a correr. La ruta se deriva del uuid (`{uuid}.jpg`), así que se sabe dónde irá el fichero antes de bajarlo.

### ¿Está todo? (`sync-status`)

«Última sincronización correcta» dice que el proceso terminó sin error, no que la copia esté completa — son preguntas distintas y solo la segunda importa el día que se pierde el teléfono. `services/sync/reconcile.ts` compara los conteos de los dos lados (RPC `sync_counts`, 0017) más la bandeja de salida y las fotos que faltan, y la pantalla `sync-status` los enseña por tabla.

## Vinculación inicial (primer login)

Al iniciar sesión con datos locales existentes:

1. Se ofrece "subir tus datos a tu cuenta": asigna `user_id` a todas las filas locales y encola todo en `change_log`.
2. Si la cuenta ya tiene datos en la nube (segundo dispositivo), se hace pull completo + push; los UUIDs garantizan que no hay colisiones, conviven ambos conjuntos.
3. Caso raro (misma entidad creada a mano en dos dispositivos antes de vincular): quedan duplicados lógicos. **Decisión:** no se deduplica automáticamente; se ofrece detección de duplicados como utilidad manual (misma lógica de conflictos que ya tiene el import de `.restoshare`).

### Cuándo se pregunta «hay dos diarios»

La pantalla `sync-choice` solo aparece **la primera vez que este dispositivo y esta cuenta se encuentran**, y solo con entradas a los dos lados.

Durante un tiempo la señal fue «hay filas sin subir», como sustituto de «este móvil ya escribía antes de esta cuenta». No lo es: la bandeja de salida tiene algo cada vez que se escribe una entrada y todavía no ha corrido el sync. Bastaba con guardar una comida y cerrar la app —o que la pasada fallara por falta de red— para que el siguiente arranque anunciara «hay dos diarios» a alguien que solo ha usado la app en un teléfono. Y como la marca de «ya elegiste» solo se escribía **al elegir**, cerrar la pantalla hacía que volviera a salir en cada arranque, con dos de las tres opciones capaces de borrar un diario entero delante.

Ahora la respuesta la da una marca propia (`sync_linked_account` en `app_settings`) que pone el gestor de sync al terminar una pasada correcta. Después de eso ya no hay dos diarios: hay uno.

## Errores y robustez

- Todo el sync es **idempotente**: repetir un push/pull no corrompe nada.
- Backoff exponencial en fallos de red; el estado de error se muestra pero nunca bloquea la app.
- Tests: suite de integración del protocolo con un Supabase local (CLI) — escenarios de conflicto, borrado, bootstrap, doble dispositivo.

**Abierto:** ¿cifrado de comentarios en la nube? (Supabase ve los datos). De momento no — complica search/feed/IA. Reevaluar si algún usuario lo pide.
**Abierto:** límites de lote y paginación del pull para datasets grandes (miles de filas) — definir en fase 3.
