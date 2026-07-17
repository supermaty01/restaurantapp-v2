# 04 — Autenticación

## Requisitos

- **Opcional.** La app arranca y funciona completa sin cuenta (modo anónimo = v1). El login añade sync, social, share por link y asistente con cuota normal.
- Proveedores: **email/password**, **Google**, y **Apple** (obligatorio en App Store si se ofrece Google login en iOS; en Supabase es configuración, no código extra).
- Cerrar sesión **no** borra los datos locales; solo detiene el sync.

## Decisión de proveedor

**Decisión: Supabase Auth.** Ya está en el stack, gratis, integra RLS (`auth.uid()`) directamente con el modelo de seguridad de datos, y soporta los tres proveedores. Se elimina por completo la auth legacy de la v1 (API en Railway): `services/api.ts`, `AuthContext`, pantallas `(auth)/login` y `(auth)/register` se reescriben contra supabase-js.

## Flujos

### Registro / login

1. Pantalla de perfil/ajustes → "Crear cuenta o iniciar sesión" (nunca es un muro de entrada).
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

**Abierto:** ¿magic links además de password? Barato de añadir con Supabase; decidir por UX en fase 2.
**Abierto:** política de usernames (cambios, longitud, caracteres) — definir con el diseño de perfiles en fase 5.
