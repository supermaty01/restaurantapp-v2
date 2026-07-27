# 09 — Migración de datos

**Requisito innegociable:** ningún usuario de la v1 (empezando por el autor) pierde datos, y la importación de copias de seguridad sigue funcionando siempre.

## Migración de esquema v1 → v2 (en el dispositivo)

La app v2 se instala **sobre** la v1: mismo `package`, mismo `slug`, mismo proyecto EAS y **mismo nombre de base de datos**. Android la trata como la misma app y conserva el SQLite y las fotos. Lo único que sube es el `versionCode` (1 → 2), sin el cual el APK ni siquiera se instala. Procedimiento completo en [13](13-despliegue.md#6b-actualizar-desde-la-v13-en-un-móvil).

Al primer arranque, Drizzle encuentra `0000–0006` ya aplicadas —los ficheros y el journal son byte a byte los mismos que en la v1— y corre solo:

|        | Qué hace                                                                     | Riesgo                                                                 |
| ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `0007` | uuid, `created_at`/`updated_at` y `visibility` en todas las filas existentes | Añadir columnas con default no constante; ya reventó una vez en diseño |
| `0008` | **Reconstruye la tabla de visitas** para hacer la fecha opcional             | El que más fácil pierde filas                                          |
| `0009` | Columnas de cuenta en `people`                                               | Bajo, puramente aditivo                                                |
| `0010` | Todo el diario de la v1 pasa a `visibility = 'default'`                      | Reescribe una columna de todas las filas                               |

**Las FKs no se reescriben.** Siguen siendo enteros locales; el uuid es una columna añadida al lado. Es la decisión de [02](02-modelo-de-datos.md) y lo que hace que esta migración sea puramente aditiva.

**No hay transacción que envuelva la cadena** ni rollback: Drizzle aplica migración a migración. Lo que sí hay es un arranque que se **bloquea** en una pantalla de error si alguna falla, en vez de seguir escribiendo contra un esquema a medias.

Las imágenes no se mueven (mismos paths); sus filas ganan `uuid` y `remote_key`.

### Cómo está verificado

`services/db/__tests__/migrations.node.test.ts` siembra una base v1 **sintética pero poblada** (restaurantes, platos, visitas, tags, imágenes y las tres tablas de unión), aplica el SQL real contra un SQLite real y comprueba que no se pierde ninguna fila ni ninguna unión, que los uuid son v4 distintos, que las FKs siguen resolviendo y que repetir la cadena no rompe nada.

> **Lo que no está verificado:** no se usa la base de datos real del autor como fixture. Sería mejor y no se ha hecho.
>
> **Y no hay backup automático antes de migrar.** Una versión anterior de este documento lo describía como el paso 1 y nunca se implementó. La copia previa a instalar es **manual**, desde Ajustes, y está en el checklist de [13](13-despliegue.md). Anotado como pendiente en [ESTADO](ESTADO.md); mientras no exista, la instrucción de hacer la copia a mano no es una precaución opcional.

## Formatos de archivo

Un único pipeline de import con **detección de versión**, dos usos:

| Formato                                                                       | Uso                | Estado en v2                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `.restoshare` v1 (entidad suelta: restaurante/plato/visita + imágenes base64) | compartir en v1    | **Se sigue importando siempre** (los amigos pueden tener archivos viejos). Deja de generarse: compartir pasa a links ([05](05-api.md)) |
| Backup v1 (export completo)                                                   | copia de seguridad | **Se sigue importando siempre**                                                                                                        |
| Backup v2 (nuevo)                                                             | copia de seguridad | Export/import completo: todas las tablas (con UUIDs, personas, visibilidad) + imágenes, empaquetado zip (jszip, como v1)               |

Reglas del importador:

- Versionado explícito en el archivo (`version` ya existe en v1); cada versión tiene su parser + mapeo al esquema vigente. Los parsers viejos no se borran jamás; se cubren con tests y fixtures congelados.
- Importar un backup v1 reutiliza la misma lógica de la migración de esquema (generar UUIDs, backfill de columnas).
- Resolución de conflictos (entidad ya existe) reutiliza el mecanismo de la v1: usar existente / crear nueva.

## Interacción con el sync

- Importar un backup con sesión activa = escrituras locales normales → entran al `change_log` → se sincronizan. Sin caminos especiales.
- El backup a archivo **se mantiene como feature** aun con sync activo (exportar todo a un zip desde ajustes): es la garantía de que los datos nunca son rehenes de la nube.

**Pendiente:** backup automático antes de migrar. Es la red de seguridad que este documento daba por hecha durante varias fases sin que existiera.
**Abierto:** ¿backup automático periódico local, además del manual?
**Abierto:** política de retención de los backups automáticos, cuando los haya.
