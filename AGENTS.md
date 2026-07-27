# Cómo se trabaja en este proyecto

Para quien retome esto —persona o agente— después de la auditoría de julio de 2026. No repite [docs/12](docs/12-calidad.md), que es el estándar; esto es lo que
se aprendió aplicándolo, que es distinto y no estaba escrito en ninguna parte.

Lo primero sigue siendo [docs/ESTADO.md](docs/ESTADO.md).

---

## La regla que resume el resto

**Una regla que no se ejecuta no existe, y una que no se puede cumplir es peor
que no tenerla.**

La auditoría encontró el estándar de calidad completo, bien argumentado, y
casi entero sin aplicar:

- `.husky/` tenía el directorio `_` y ningún hook. `lint-staged` llevaba meses
  configurado en `package.json` sin que nada lo ejecutara — y **estaba mal
  escrito**: llamaba a `eslint` desde la raíz del monorepo, donde no hay
  configuración. Habría fallado la primera vez que corriera. Nadie lo supo
  porque nunca corrió.
- CI comprobaba `apps/mobile` y nada más. Los 57 tests del Worker y los 154
  asserts SQL existían y no los ejecutaba nadie.
- El lint estaba en un job con `continue-on-error: true` y un comentario que
  decía «quitar cuando aterrice la fase 1». La fase 1 había aterrizado hacía
  mucho.
- `npm run check` no podía pasar en Windows: varios ficheros tenían CRLF pese al
  `eol=lf` de `.gitattributes`, así que `format:check` fallaba por ruido.

Ese último es el más instructivo. Una puerta que falla por motivos ajenos al
código es la que se acaba saltando con `--no-verify`, y a partir de ahí ya no
hay puerta. **Si una comprobación molesta sin aportar, se arregla la
comprobación; no se rodea.**

### Qué hacer con esto

- Antes de empujar: `npm run check`. El hook de pre-push ya lo hace.
- Antes de tocar la base de datos: `npm run db:test`. Necesita `supabase start`
  o `DATABASE_URL`.
- Si una regla nueva produce cien avisos, **no la pongas en `warn`**. O bloquea,
  o va a un script aparte que se lanza a propósito. Está explicado en docs/12 a
  cuenta de las reglas de React Compiler, y es la decisión correcta.

---

## Los cinco errores que más caros salieron

Vale la pena conocerlos porque los cinco tienen la misma forma: **algo que
parecía comprobado y no lo estaba.**

### 1. Cadenas donde debería haber tipos

Cinco hooks pasaban `'dishTags'` a `useLiveTablesQuery`, que compara con el
nombre SQL de la tabla — `dish_tag`. Los dos son `string`, así que la
comparación no fallaba: no coincidía nunca. Poner una etiqueta a un plato no
refrescaba la pantalla, y a veces sí (cuando la operación tocaba además una
tabla bien escrita), lo que lo hacía parecer intermitente.

Dos hooks lo tenían bien y cinco mal, conviviendo en el mismo repo.

> **Regla:** si una API acepta el nombre de algo que ya existe como objeto, que
> acepte el objeto. `useLiveTablesQuery` ahora recibe tablas y saca el nombre con
> `getTableName`. El error dejó de poder escribirse.

### 2. `as` sobre entrada que viene de fuera

`JSON.parse(content) as ShareFileData` en la importación de `.restoshare`. Un
`as` no comprueba: afirma. Era la única entrada verdaderamente no confiable de
la app —la abre el sistema desde un adjunto— y la única sin zod, mientras cada
formulario propio sí pasaba por zod.

> **Regla:** `as` nunca sobre algo que no escribió este código. En el borde va
> `unknown` y un esquema. El del fichero compartido vive en
> `packages/shared/src/share-file.ts`.

### 3. Respuestas que no se miran

`shareStore.revoke` lanzaba el `fetch` y descartaba la respuesta; la ruta
contestaba `{ok:true}` pasara lo que pasara. Un 4xx de Supabase se veía en la app
como «enlace revocado» con el enlace todavía sirviendo el contenido.

> **Regla:** toda respuesta se comprueba, y con más razón las de las acciones de
> seguridad. `no-floating-promises` está activo en los tres workspaces; es la
> regla que encuentra la mitad de estos.

### 4. Comentarios que describen lo que se quiso hacer

Tres casos, todos con el mismo patrón: el comentario decía la intención y el
código hacía otra cosa.

- `0002` decía «solo username/display_name/avatar se exponen». La policy era
  `for select using (auth.role() = 'authenticated')` sobre la tabla entera, sin
  columnas: `GET /rest/v1/profiles?select=bio` devolvía la bio de cualquiera,
  saltándose la comprobación cuidadosa de `user_profile()`.
- `0016` decía «solo de lectura y marcado». Era un `for update` sin restricción
  de columnas.
- `ai.ts` decía «siempre a través del AI Gateway (rate limiting)». `AI_GATEWAY`
  viene vacío en `wrangler.toml`, así que el único control de coste era opcional
  y venía apagado.

> **Regla:** cuando escribas un comentario que afirme una garantía, pregúntate
> qué la sujeta. Si la respuesta es «el código de al lado», escribe el test. Los
> `.test.sql` de `supabase/tests/` existen para esto: comprueban las políticas
> como Postgres las ejecuta, no como creemos que las escribimos.

### 5. Artefactos generados dentro del repo

Un `android/` de `expo prebuild` se coló en un commit de UI y se quedó congelado
en `com.restaurantappv2` con `versionCode 1`, sin el intent-filter de
`restaurantapp://` y sin permiso de notificaciones — mientras
`google-services.json` estaba registrado para `com.supermaty01.restaurantapp` y
un `app.json` en la raíz declaraba un tercer nombre.

Cualquier build hecha desde ahí llevaba el paquete equivocado: Firebase no
arranca y el redirect de OAuth no vuelve a la app.

> **Regla:** el proyecto es **CNG**. `android/` y `ios/` los genera EAS desde
> `app.config.js`, están en `.gitignore` desde la raíz, y no se commitean nunca.
> `app.config.js` es la única fuente de verdad de la configuración nativa.

---

## Cómo se escribe aquí

El estilo del proyecto es bueno y conviene mantenerlo. No es decoración: es lo
que hace que el código se pueda retomar a los seis meses.

### Comentarios

Se explica **por qué**, nunca **qué**. Y en particular se explica _qué se
intentó antes y por qué no valía_ — el repo está lleno de comentarios así y son
lo más útil que tiene. Ejemplo real, en `tables.ts`:

> `images.path` es la ruta del fichero _en este teléfono_: no se sincroniza a
> propósito —la ruta de otro dispositivo no significa nada aquí— pero la columna
> es `not null`, así que sin esto insertar una foto que llega del servidor
> reventaba con `NOT NULL constraint failed`.

Eso evita que alguien «arregle» la excepción dentro de seis meses.

**Idioma:** docs/12 decía «comentarios en inglés» y el código real está mitad y
mitad. La regla se ha cambiado para reflejar lo que se hace: **comentarios
nuevos en español**, como el resto de la documentación y la UI. No se reescriben
los que ya están en inglés; mezclar es feo, pero reescribir comentarios buenos
para uniformar el idioma es cambiar algo que funciona por algo que se lee igual.

### Tests

No se persigue cobertura global. Se cubre donde el fallo es caro, y sobre todo:
**todo bug corregido entra con su test**. Además, cuando el test es sobre una
propiedad no funcional, hay que verificar que falla con el código anterior — un
guardián que no caza el bug que dice cazar es peor que ninguno, porque da
tranquilidad falsa.

Dos idiomas de test que ya existen y conviene reutilizar:

- **Guardianes sobre el código fuente** (`no-native-alerts.node.test.ts`,
  `live-tables-contract.node.test.ts`): leen los ficheros y comprueban que no
  reaparece un patrón. Llevan siempre un «guardián sobre el guardián» que
  comprueba que la prueba encontró ficheros que revisar.
- **Medición, no suposición** (`query-count.node.test.ts`): cuenta las
  sentencias que llegan a SQLite. Fija órdenes de magnitud, no números exactos,
  para que un refactor honesto no lo rompa.

### Migraciones

Cada una lleva una cabecera que explica qué problema resuelve y qué se
consideró. Cuando una migración hace lo contrario que otra anterior, **dilo y
explica por qué**: `0020` crea una vista con derechos de definidor justo después
de que `0005` arreglara una vista quitándoselos, y sin el párrafo que distingue
«filtro de filas» de «filtro de columnas» eso parece el mismo fallo repetido.

Si son muchas y mecánicas, genera desde el catálogo (`pg_policies`) en vez de
copiar a mano: `0021` reescribe 27 políticas así. Veintisiete transcripciones
manuales son veintisiete formas de aflojar una condición sin darse cuenta, y
**una política mal copiada no falla, deja pasar.**

---

## Mapa rápido

| Dónde                             | Qué vive ahí                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `apps/mobile/app/`                | Rutas (expo-router). Sin SQL, sin red.                                            |
| `apps/mobile/features/<dominio>/` | `components/`, `hooks/`, `repositories/`, `schemas/`, `mappers/`, `types/`        |
| `apps/mobile/services/`           | Lo transversal: `db/`, `sync/`, `api/`, `push/`, `share/`, `backup/`, `supabase/` |
| `apps/mobile/services/api/`       | **Todo lo que habla con el Worker.** El linter prohíbe `fetch` fuera.             |
| `apps/api/`                       | Cloudflare Worker (Hono): enlaces, proxy de IA, imágenes R2, cron                 |
| `packages/shared/`                | Lo que comparten app y Worker. Hoy: el esquema del `.restoshare`.                 |
| `supabase/migrations/`            | El espejo, RLS, RPCs. Numeradas, nunca se editan las ya aplicadas.                |
| `supabase/tests/`                 | `.test.sql` contra Postgres de verdad.                                            |

## Comandos

```bash
npm run check      # formato + lint + tipos + tests de los tres workspaces
npm run db:test    # los .test.sql (necesita `supabase start` o DATABASE_URL)
npm run mobile     # arrancar la app
npm run -w apps/mobile lint:compiler   # la pregunta de React Compiler, aparte
```
