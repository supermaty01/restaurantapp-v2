# 04 — Autenticación

## Requisitos

- **Opcional.** La app arranca y funciona completa sin cuenta (modo anónimo = v1). El login añade sync, social, share por link y asistente con cuota normal.
- Proveedores: **email/password** y **Google**. **Apple** está detrás de una bandera apagada (`APPLE_SIGN_IN_ENABLED`, `lib/features.ts`) — sigue siendo obligatorio en App Store si se ofrece Google en iOS, pero exige Apple Developer Program de pago, Service ID y clave firmante, y sin eso el botón manda al navegador para volver con «Unsupported provider». Un botón que solo puede fallar es peor que no tener el botón. Encenderla es el día que haya build de iOS.
- Cerrar sesión **no** borra los datos locales; solo detiene el sync.

## Decisión de proveedor

**Decisión: Supabase Auth.** Ya está en el stack, gratis, integra RLS (`auth.uid()`) directamente con el modelo de seguridad de datos, y soporta los tres proveedores. Se elimina por completo la auth legacy de la v1 (API en Railway): `services/api.ts`, `AuthContext`, pantallas `(auth)/login` y `(auth)/register` se reescriben contra supabase-js.

## Flujos

### Registro / login

1. Pantalla de perfil/ajustes → "Crear cuenta o iniciar sesión" (nunca es un muro de entrada). La bienvenida de primera apertura ofrece «ya tengo cuenta» como atajo, pero «Empezar» lleva al diario: pedir registro antes de haber dado nada a cambio contradice el modelo local-primero.
2. OAuth nativo con deep link (`expo-auth-session` + PKCE) para Google/Apple; email/password con verificación por correo.
3. Al completar login por primera vez → wizard de **vinculación de datos locales** (ver [03 — Sync](03-sync.md#vinculación-inicial-primer-login)): "Encontramos N restaurantes, M platos... ¿subirlos a tu cuenta?" Opciones: subir todo / empezar de cero en la nube (los datos locales se conservan igualmente).
4. Crear `profile` (username único, sugerido a partir del email) — requisito para social.

### Sesión

- Tokens gestionados por supabase-js con almacenamiento seguro (`expo-secure-store`). Refresh automático; si el refresh falla de forma permanente, la app degrada a modo anónimo con banner "sesión expirada", sin pérdida local.

### Logout y borrado

- Logout: detiene sync, conserva SQLite. Re-login re-vincula sin duplicar (los UUIDs ya tienen `user_id`).
- "Eliminar mi cuenta" (obligatorio para las stores): borra datos cloud + R2 vía función del Worker, ofrece antes un export completo a archivo. Local queda intacto.

## Seguridad

- JWTs de Supabase se usan también para autenticarse contra el Worker (verificación del token con el JWKS de Supabase, sin llamada a Supabase por request).
- Nada de contraseñas ni tokens en AsyncStorage plano (la v1 guardaba `userToken` ahí — se elimina).

## La pantalla, y lo que se aprendió de usarla

Cuatro cosas que solo se ven con la app instalada, corregidas en la ronda 6:

- **Un modo, no dos botones.** «Iniciar sesión» y «Crear cuenta nueva» convivían sobre los mismos dos campos, el segundo disfrazado de enlace: no había forma de saber cuál iba a pasar hasta que pasaba.
- **Crear cuenta tiene que decir algo.** Con la confirmación por correo activada, `signUp` **no falla y no deja sesión**: devuelve un usuario y ya está. Sin mirar `data.session === null` la pantalla se queda idéntica a antes de pulsar, y el botón parece roto. El caso de un correo ya registrado cae ahí también —Supabase no lo delata, a propósito— y el mensaje «revisa tu correo» sirve para los dos.
- **Los errores del proveedor van en inglés.** Todos pasan por `describeAuthError` (`lib/helpers/auth-errors.ts`), que ya traducía los de OAuth y ahora también los de correo y contraseña. El de credenciales mantiene la ambigüedad a propósito: distinguir «ese correo no existe» de «esa contraseña está mal» le dice a cualquiera qué correos tienen cuenta aquí.
- **Recuperar la contraseña.** No existía. Un formulario de acceso sin esa salida deja a alguien fuera de sus propios datos para siempre. La respuesta es la misma exista la cuenta o no, por lo mismo de arriba.

Y una de navegación: **entrar tiene que llevar a alguna parte**. El final del registro era una tarjeta de estado de sincronización sin ninguna salida, así que el trámite no terminaba nunca. «Ir al inicio» es ahora el botón principal de esa pantalla, y lo hay también al final de `sync-status` y de `sync-choice`.

**Abierto:** ¿magic links además de password? Barato de añadir con Supabase; decidir por UX en fase 2.
**Abierto:** política de usernames (cambios, longitud, caracteres) — definir con el diseño de perfiles en fase 5.
