# 06 — Social

Todo lo de este documento requiere cuenta y datos sincronizados. Es puramente aditivo sobre el núcleo local.

## Perfiles

`profiles`: username único, nombre visible, avatar (R2), bio. El perfil muestra, según visibilidad y amistad:

- Estadísticas (nº restaurantes, platos, visitas — solo sobre contenido visible al que mira)
- Contenido con `visibility in ('friends','public')`: restaurantes/platos/visitas destacados y recientes
- **Visitas en las que fue etiquetado y aceptó** (ver abajo) — el "muro" estilo BeReal

## Amistades

- Modelo de **solicitud mutua** (no follow asimétrico): `friendships(user_a, user_b, status, requested_by)` con una fila por par (orden canónico de IDs).
- Búsqueda de usuarios por username exacto/prefijo. Sin sugerencias por contactos del teléfono (privacidad, y complejidad innecesaria a esta escala).
- RLS: las policies de lectura de datos personales de otros comprueban `friendship accepted` + `visibility`.

## Visibilidad

Por entidad: `private` (default) | `friends` | `public`. Reglas:

- La visibilidad de un plato/visita no puede superar la de su restaurante en la práctica de UI (se avisa y se ofrece subir la del restaurante), pero el modelo la almacena por entidad para mantenerlo simple.
- Cambiar a `private` retira el contenido de perfiles/feeds ajenos en el siguiente refresh (es una query, no hay copias).

## Etiquetado de personas en visitas

Extiende el modelo `people` / `visit_participants` de [02](02-modelo-de-datos.md):

1. Al crear/editar una visita se etiquetan personas (autocompletado sobre `people` propios + amigos).
2. Si la persona etiquetada es un **amigo con cuenta**: se crea la participación con `tag_status='pending'` y le llega una notificación. Al **aceptar**, la visita aparece en su perfil como "estuvo en X con Y" (estilo BeReal: contenido de otro que te incluye, publicado en tu perfil con tu consentimiento). Puede rechazar o retirar la aceptación después.
3. Si es una persona local sin cuenta: solo dato privado del autor (y combustible para el asistente: "¿cuándo comí con Caro?").
4. Quien acepta un tag ve la visita aunque sea `private` para el resto (la participación aceptada es un grant de lectura explícito en la policy).

## Feed

- Contenido: actividad de amigos — visitas registradas (con etiquetados), platos nuevos, restaurantes nuevos; solo con visibilidad `friends`/`public`.
- **Decisión: el feed es una query, no un sistema.** A escala de decenas de usuarios: `select` sobre las tablas de amigos ordenado por `created_at`, paginado, vía una vista o RPC de Supabase con RLS. Sin fan-out, sin colas, sin tabla de feed materializada. Si algún día duele, se materializa — el modelo lo permite.
- Pull-to-refresh + Realtime opcional para badge de "hay novedades".
- Interacciones sociales (likes/comentarios): **fuera del alcance v2**. Anotado como idea futura; multiplica superficie de moderación/notificaciones.

## Notificaciones

- In-app (badge + lista): solicitudes de amistad, etiquetados pendientes, aceptaciones.
- Push (expo-notifications): deseable pero no crítico; decidir en fase 5 si entra o se pospone. Los triggers saldrían de webhooks de Supabase → Worker → Expo Push.

**Abierto:** ¿perfil "público" visible sin amistad (solo username/avatar/stats) o todo restringido a amigos? Propuesta: perfil mínimo visible para poder buscar/agregar, contenido solo amigos.
**Abierto:** bloquear usuarios — probablemente necesario incluso a pequeña escala; definir en fase 5.
