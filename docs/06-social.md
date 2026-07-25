# 06 — Social

Todo lo de este documento requiere cuenta y datos sincronizados. Es puramente aditivo sobre el núcleo local: sin cuenta, la app funciona entera y nada de esto existe.

## Perfiles

`profiles`: username único, nombre visible, avatar (R2), bio. El perfil de otra persona muestra, según la relación:

- **Desconocido**: nombre, handle y nada más. Ni bio, ni contenido.
- **Amigo**: lo que tenga en `friends`/`public`, paginado.
- **Tú**: todo.

Lo decide el servidor (`user_profile`, `user_entries`), nunca el cliente.

## Amistades

- Modelo de **solicitud mutua** (no follow asimétrico): `friendships(user_a, user_b, status, requested_by)`, una fila por par en orden canónico.
- Dos personas que se añaden a la vez es consentimiento mutuo, no dos solicitudes pendientes: la segunda acepta la primera.
- Búsqueda por prefijo de username o nombre visible. Sin sugerencias por contactos del teléfono.

## Visibilidad

Por entidad: `private` (default) | `friends` | `public`.

El default es privado, y no por prudencia genérica: compartir algo sin querer no se deshace del todo, y el default tiene que ser aquel cuyo error se puede corregir.

**Hay un ajuste general por tipo de entrada** (Lugares / Platos / Visitas) que decide con qué nace lo que creas, y **se puede sobrescribir en cada entrada**: al crearla en el formulario, y después desde la propia pantalla de detalle. Esto último importa más de lo que parece — decidir compartir una comida casi siempre pasa *después* de registrarla.

### La visibilidad es transitiva desde una visita

Si puedes leer una visita, puedes leer **el restaurante donde ocurrió y los platos anotados en ella**, aunque su dueño los tenga en privado.

Sin esto, quien guardaba sus restaurantes en privado y compartía una visita mandaba una tarjeta que decía "Una visita" y nada más: ni dónde, ni qué comió. La visita es el envoltorio; sin su contenido no queda nada que compartir.

No al revés: ver un plato no da acceso a las demás visitas a ese restaurante. La decisión de quien comparte fue sobre *esa comida*, no sobre el sitio. Y la nota y los comentarios del restaurante se quedan fuera — son opinión sobre el lugar en general.

Implementado en `can_read_visit` y `visit_detail` (migración 0011).

## Etiquetar personas en visitas

Extiende `people` / `visit_participant` de [02](02-modelo-de-datos.md).

**Etiquetar es lo principal, no invitar.** La mayoría de las personas con las que comes no usan la app, así que "Irene" tiene que ser una respuesta de primera clase y no el plan B de cuando la búsqueda no encuentra nada.

Dos formas de entrada, con forma distinta a propósito:

- **Un amigo se elige de una lista.** Ya sabes quiénes son tus amigos; teclear un handle que hay que recordar exacto es una versión peor de recorrer una lista corta. La etiqueta guarda su `linked_user_id` y su handle.
- **Cualquier otra persona se escribe.** No hay lista en la que pueda estar.

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

Las tablas de unión (`restaurant_tag`, `dish_tag`, `dish_visit`, `visit_participant`) **viajan con su fila padre**, no por `change_log`. Una unión no tiene uuid, ni marcas de tiempo, ni identidad propia: *es* el par de uuids, así que no hay nada que reconciliar por última-escritura-gana. Ver [03](03-sync.md).

## Notificaciones

In-app: badge de solicitudes de amistad en Perfil, cuenta de visitas etiquetadas en la pestaña Feed.

Push (expo-notifications): pendiente. Los triggers saldrían de webhooks de Supabase → Worker → Expo Push.

## Abierto

- **Bloquear usuarios.** Hoy la salida es dejar de ser amigo y quitarse de las etiquetas, que cubre el caso normal pero no el hostil.
- **Perfil público sin amistad.** Ahora mismo un desconocido ve nombre y handle; el contenido `public` aparece en su perfil pero nadie tiene forma de llegar a él salvo buscándolo.
- **Avisar de que te han etiquetado** sin que tengas que abrir la pestaña.
