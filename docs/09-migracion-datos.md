# 09 — Migración de datos

**Requisito innegociable:** ningún usuario de la v1 (empezando por el autor) pierde datos, y la importación de copias de seguridad sigue funcionando siempre.

## Migración de esquema v1 → v2 (en el dispositivo)

La app v2 se instala **sobre** la v1 (misma app en la store, mismo SQLite). Al primer arranque:

1. **Backup automático previo**: se genera un export completo (formato backup, ver abajo) a un archivo local *antes* de tocar nada. Si la migración falla, la app lo comunica y el archivo queda disponible; la migración es reintentable.
2. Migración Drizzle en transacción:
   - Generar UUID por fila; construir mapa `int id → uuid`; reescribir todas las FKs y tablas de unión con el mapa.
   - Añadir `created_at`/`updated_at` (backfill: ahora), `visibility='private'`, `user_id=null`.
   - Crear tablas nuevas (`people`, `visit_participants`, `change_log`).
3. Verificación post-migración: conteos por tabla iguales a los previos, spot-checks de FKs. Si algo no cuadra → rollback de la transacción + aviso.
4. Las imágenes no se mueven (mismos paths); solo sus filas ganan uuid/`remote_key`.

Esta migración se testea con **fixtures reales**: copias de bases de datos v1 pobladas (incluida la del autor) como casos de test de integración.

## Formatos de archivo

Un único pipeline de import con **detección de versión**, dos usos:

| Formato | Uso | Estado en v2 |
|---|---|---|
| `.restoshare` v1 (entidad suelta: restaurante/plato/visita + imágenes base64) | compartir en v1 | **Se sigue importando siempre** (los amigos pueden tener archivos viejos). Deja de generarse: compartir pasa a links ([05](05-api.md)) |
| Backup v1 (export completo) | copia de seguridad | **Se sigue importando siempre** |
| Backup v2 (nuevo) | copia de seguridad | Export/import completo: todas las tablas (con UUIDs, personas, visibilidad) + imágenes, empaquetado zip (jszip, como v1) |

Reglas del importador:

- Versionado explícito en el archivo (`version` ya existe en v1); cada versión tiene su parser + mapeo al esquema vigente. Los parsers viejos no se borran jamás; se cubren con tests y fixtures congelados.
- Importar un backup v1 reutiliza la misma lógica de la migración de esquema (generar UUIDs, backfill de columnas).
- Resolución de conflictos (entidad ya existe) reutiliza el mecanismo de la v1: usar existente / crear nueva.

## Interacción con el sync

- Importar un backup con sesión activa = escrituras locales normales → entran al `change_log` → se sincronizan. Sin caminos especiales.
- El backup a archivo **se mantiene como feature** aun con sync activo (exportar todo a un zip desde ajustes): es la garantía de que los datos nunca son rehenes de la nube.

**Abierto:** ¿backup automático periódico local (además del manual y el pre-migración)? Barato de añadir; decidir en fase 1.
**Abierto:** política de retención de los backups pre-migración (¿borrar tras N días con confirmación?).
