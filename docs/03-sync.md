# 03 — Sincronización

## Decisión de fondo

**Decisión: motor de sync propio** (push/pull sobre supabase-js) en vez de un servicio dedicado (PowerSync, ElectricSQL, WatermelonDB). Motivos: el modelo de datos es pequeño y estable, el caso dominante es 1 usuario con 1–2 dispositivos, se evita otra dependencia/servicio, y el conocimiento del protocolo queda en el proyecto. Coste: hay que diseñarlo y testearlo con cuidado — esta es la fase de mayor riesgo técnico después de la migración.

## Modelo

- **Fuente de verdad local:** la UI solo lee/escribe SQLite. El sync es un proceso de fondo que reconcilia.
- **Unidad de sync: la fila.** Estrategia de conflicto: **last-write-wins por fila** usando `updated_at` (reloj del cliente, ISO UTC). Para un diario personal esto es suficiente; no hay edición concurrente real de la misma fila por dos personas.
- **Soft-deletes** se propagan como updates (`deleted = true`).

## Protocolo

### Push

1. Leer `change_log` con `synced = false`, agrupado por tabla, en orden de dependencia (restaurants → dishes/visits → uniones → images).
2. `upsert` por lotes a Supabase (`onConflict: id`), condicionado en el servidor a `updated_at` entrante ≥ existente (función SQL `upsert_if_newer` para no pisar cambios más nuevos de otro dispositivo).
3. Marcar `synced = true` solo tras confirmación.

### Pull

1. Cursor local `last_pulled_at` por tabla (en `app_settings`).
2. `select * where user_id = me and updated_at > cursor` por tabla, aplicar en SQLite con la misma regla last-write-wins, avanzar cursor.
3. Primera sesión en un dispositivo nuevo = pull completo (bootstrap).

### Disparadores

- Al abrir la app / volver a foreground.
- Debounced tras cada escritura local (~5 s).
- Periódico con `expo-background-task` (mejor esfuerzo; en móvil el background es poco fiable, el disparador real es abrir la app).
- Botón manual "sincronizar ahora" en ajustes, con indicador de estado (última sync, pendientes, errores).

## Imágenes

Sync en dos niveles, siempre después de las filas:

- **Subida:** imágenes con `remote_key = null` se comprimen (resize ~2048px, jpeg q80) y suben al Worker → R2. Solo en wifi por defecto (configurable).
- **Bajada:** al hacer pull de una fila `images` sin archivo local, se descarga bajo demanda (lazy, al mostrarse) con caché en filesystem.

## Vinculación inicial (primer login)

Al iniciar sesión con datos locales existentes:

1. Se ofrece "subir tus datos a tu cuenta": asigna `user_id` a todas las filas locales y encola todo en `change_log`.
2. Si la cuenta ya tiene datos en la nube (segundo dispositivo), se hace pull completo + push; los UUIDs garantizan que no hay colisiones, conviven ambos conjuntos.
3. Caso raro (misma entidad creada a mano en dos dispositivos antes de vincular): quedan duplicados lógicos. **Decisión:** no se deduplica automáticamente; se ofrece detección de duplicados como utilidad manual (misma lógica de conflictos que ya tiene el import de `.restoshare`).

## Errores y robustez

- Todo el sync es **idempotente**: repetir un push/pull no corrompe nada.
- Backoff exponencial en fallos de red; el estado de error se muestra pero nunca bloquea la app.
- Tests: suite de integración del protocolo con un Supabase local (CLI) — escenarios de conflicto, borrado, bootstrap, doble dispositivo.

**Abierto:** ¿cifrado de comentarios en la nube? (Supabase ve los datos). De momento no — complica search/feed/IA. Reevaluar si algún usuario lo pide.
**Abierto:** límites de lote y paginación del pull para datasets grandes (miles de filas) — definir en fase 3.
