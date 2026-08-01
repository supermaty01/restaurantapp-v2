# 06 — Social

Todo lo de este documento requiere cuenta y datos sincronizados. Es puramente aditivo sobre el núcleo local: sin cuenta, la app funciona entera y nada de esto existe.

## Perfiles

`profiles`: username único, nombre visible, avatar (R2), bio. El perfil de otra persona muestra, según la relación:

- **Desconocido**: nombre, handle y nada más. Ni bio, ni contenido.
- **Amigo**: lo que tenga en `friends`/`public`, paginado.
- **Tú**: todo.

Lo decide el servidor (`user_profile`, `user_entries_page`, `user_entry_counts`), nunca el cliente.

El perfil se reparte en **secciones** —visitas, lugares, platos— igual que el diario propio, y con los mismos filtros de orden y nota. Solo salen las que tienen algo: a quien no es tu amigo y solo ha hecho públicos un par de sitios se le enseña una pestaña, no tres con dos vacías. Una pestaña vacía se lee como «no ha compartido nada» cuando lo que significa es «esto no te toca», y el único que sabe cuánto de esto puede ver quien mira es el servidor (0022).

Las secciones paginan **por desplazamiento**, al revés que el feed. No es descuido: allí el orden es siempre `occurred_at desc`, así que un cursor por fecha nombra una posición estable; aquí el orden lo elige quien mira, y haría falta una clave de cursor por criterio. La lista de una sección es corta y no crece mientras la miras — es el diario de otra persona.

## Amistades

- Modelo de **solicitud mutua** (no follow asimétrico): `friendships(user_a, user_b, status, requested_by)`, una fila por par en orden canónico.
- Dos personas que se añaden a la vez es consentimiento mutuo, no dos solicitudes pendientes: la segunda acepta la primera.
- Búsqueda por prefijo de username o nombre visible. Sin sugerencias por contactos del teléfono.

## Visibilidad

Por entidad, el valor guardado es uno de cuatro: **`default`** | `private` | `friends` | `public`.

`default` **no es un hueco ni una copia**: es un valor real que significa "lo que digan mis ajustes generales, ahora y más adelante". Se resuelve **al leer**, no al escribir.

Esto se hizo primero al revés, copiando el ajuste en la fila al crearla, y estaba mal por dos motivos que solo se ven con datos reales:

- El ajuste se convertía en una sugerencia de una sola vez. Cambiar "mis amigos ven mis visitas" no movía nada de lo ya escrito, que es lo contrario de lo que promete algo llamado _default_.
- Todo lo importado de la v1 —que es casi todo un diario de años— se quedaba clavado en `private`, porque en la v1 ese campo no existía. El diario entero era invisible para los amigos de su dueño y ningún ajuste lo alcanzaba.

El precio es que **ninguna comprobación de visibilidad puede mirar la columna directamente**. Todas pasan por `effective_visibility(stored, owner, entity)` (migración 0014), y los ajustes generales viven también en Postgres (`visibility_defaults`) porque es el servidor quien decide si tu amigo puede leer una fila.

**Sin cuenta no aparece nada de esto.** Ni la sección de Ajustes, ni el control en cada entrada, ni el filtro de las listas. Nada sale del dispositivo, así que «quién lo ve» tiene una sola respuesta posible; ofrecer el control igualmente sugiere que hay algo que decidir, y un control de privacidad que no cambia nada es justo el que enseña a dejar de leerlos. Lo decide `useSharingAvailable()`, y los dos componentes se defienden solos además de que las pantallas los escondan.

Lo que se _guarda_ no cambia: las entradas se escriben como `default` igualmente, así que iniciar sesión más tarde aplica los ajustes retroactivamente a todo lo ya escrito, sin migración y sin preguntar.

El ajuste general por defecto es privado, y no por prudencia genérica: compartir algo sin querer no se deshace del todo, y el default tiene que ser aquel cuyo error se puede corregir.

Se puede **sobrescribir en cada entrada**: al crearla, y después desde la propia pantalla de detalle. Esto último importa más de lo que parece — decidir compartir una comida casi siempre pasa _después_ de registrarla. Una entrada marcada a mano no se mueve nunca; solo las que están en `default` siguen al ajuste.

Los cuatro valores son además un **filtro** en las tres listas, sobre el valor guardado y no el resuelto: «¿cuáles dejé en automático?» es la pregunta que hay que poder responder para auditar lo que compartes, porque son justo las que se moverán si cambias el ajuste.

### La visibilidad es transitiva desde una visita

Si puedes leer una visita, puedes leer **el restaurante donde ocurrió y los platos anotados en ella**, aunque su dueño los tenga en privado.

Sin esto, quien guardaba sus restaurantes en privado y compartía una visita mandaba una tarjeta que decía "Una visita" y nada más: ni dónde, ni qué comió. La visita es el envoltorio; sin su contenido no queda nada que compartir.

No al revés: ver un plato no da acceso a las demás visitas a ese restaurante. La decisión de quien comparte fue sobre _esa comida_, no sobre el sitio. Y la nota y los comentarios del restaurante se quedan fuera — son opinión sobre el lugar en general.

Implementado en `can_read_visit` y `visit_detail` (migración 0011).

## Etiquetar personas en visitas

Extiende `people` / `visit_participant` de [02](02-modelo-de-datos.md).

**Etiquetar es lo principal, no invitar.** La mayoría de las personas con las que comes no usan la app, así que "Irene" tiene que ser una respuesta de primera clase y no el plan B de cuando la búsqueda no encuentra nada.

Dos formas de entrada, con forma distinta a propósito:

- **Un amigo se elige de una lista.** Ya sabes quiénes son tus amigos; teclear un handle que hay que recordar exacto es una versión peor de recorrer una lista corta. La etiqueta guarda su `linked_user_id` y su handle.
- **Cualquier otra persona se escribe.** No hay lista en la que pueda estar.

**`@` está reservado para cuentas.** Escribir `@algo` busca solo entre amigos, y si no encuentra a nadie **no añade nada**: crear una persona llamada "@caro1234" que no es Caro, no está conectada a nada y parece una etiqueta correcta es exactamente el fallo que la regla evita.

Solo se ofrecen amigos. Buscar entre todas las cuentas convertiría una entrada privada del diario en algo que puedes colgarle a un desconocido.

La identidad de una persona es **su cuenta cuando la tiene, y su nombre cuando no**. Dos amigas pueden llamarse Ana, pero una cuenta es una persona; mientras que volver a escribir "Irene" quiere decir la misma Irene.

### Qué pasa cuando te etiquetan

**No se pide permiso.** Pedirlo convertiría "cené con Caro" en una negociación. El consentimiento es posterior, lo cual solo funciona si retirarlo es real:

- Estar etiquetado **es acceso por derecho propio**, distinto de la amistad: te etiquetan porque estuviste allí, y no hace falta ser amigo de alguien para haber cenado con esa persona.
- Pero **no anula la visibilidad**: una visita `private` sigue siendo privada aunque te etiquete. La etiqueta es entonces una anotación en su diario, no un envío.
- **Puedes quitarte** (`reject_tag`). Deja de aparecerte y pierdes el acceso; no se borra nada del diario de quien te etiquetó. Es reversible: retirarse no es bloquear.

El rechazo vive en una tabla propia (`tag_rejections`, migración 0013) y no en `visit_participant`. Esa fila pertenece a quien etiquetó, y su móvil manda el conjunto completo de participantes de cada visita en cada sync: marcarla ahí duraría hasta que esa persona volviera a abrir la app.

### Las visitas etiquetadas van a una bandeja aparte

Nunca se mezclan con el diario. Una visita ajena habla de los restaurantes y los platos de otra persona; meterla en tu diario ensuciaría tus listas con filas que no puedes editar y tus estadísticas con comidas que no registraste tú.

Vive en la pestaña Feed, junto al feed de amigos pero como lista separada: `tagged_visits` (0011, filtrada por `is_active_tag` desde 0013).

> Cambio respecto a la versión anterior de este documento, que proponía un flujo `pending`/`accepted` y publicar las visitas aceptadas en tu propio perfil, estilo BeReal. Se descartaron las dos cosas: el permiso previo por lo dicho arriba, y el muro propio porque mezcla el diario de dos personas.

## Feed

**El feed es una query, no un sistema.** A escala de decenas de usuarios: `select` sobre las tablas de los amigos, ordenado por `created_at`, paginado, en una RPC con la comprobación de relación dentro. Sin fan-out, sin colas, sin tabla materializada. Si algún día duele, se materializa.

### Cuenta comidas, no filas

La primera versión emitía una tarjeta por fila, así que quien comparte todo llenaba el feed con tres tarjetas por comida: "descubrió Ichiran", "probó Tonkotsu", "estuvo en Ichiran". Un diario activo borraba a todos los demás en una tarde.

Regla actual (0012): **una entrada no aparece si ya está representada por otra.**

- Un plato comido en una visita compartida viaja **dentro** de esa visita.
- Un restaurante donde hay una visita compartida ya se ha contado.
- Lo que queda es lo que de verdad pasó: comió aquí, probó esto suelto, descubrió este sitio.

### Paginación

Por cursor (`before`), no por offset: la lista crece por arriba, y con offset alguien publicando a mitad de scroll desplaza todas las páginas siguientes y ves la misma tarjeta dos veces. Un timestamp nombra una posición que se queda quieta. `usePagedResource` lo implementa una vez para el feed, la bandeja y los perfiles.

### Fuera de alcance

Likes y comentarios. Multiplican superficie de moderación y notificaciones sin añadir nada a un diario personal.

## Sincronización de las relaciones

Las tablas de unión (`restaurant_tag`, `dish_tag`, `dish_visit`, `visit_participant`) **viajan con su fila padre**, no por `change_log`. Una unión no tiene uuid, ni marcas de tiempo, ni identidad propia: _es_ el par de uuids, así que no hay nada que reconciliar por última-escritura-gana. Ver [03](03-sync.md).

## Notificaciones

In-app: badge de solicitudes de amistad en Perfil, cuenta de visitas etiquetadas en la pestaña Feed.

Push (expo-notifications): pendiente. Los triggers saldrían de webhooks de Supabase → Worker → Expo Push.

## Abierto

- **Bloquear usuarios.** Hoy la salida es dejar de ser amigo y quitarse de las etiquetas, que cubre el caso normal pero no el hostil.
- **Perfil público sin amistad.** Ahora mismo un desconocido ve nombre y handle; el contenido `public` aparece en su perfil pero nadie tiene forma de llegar a él salvo buscándolo.
- **Avisar de que te han etiquetado** sin que tengas que abrir la pestaña.
