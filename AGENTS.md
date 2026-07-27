# AGENTS.md

Instrucciones operativas para un agente que trabaja en este repositorio. Léelo
entero antes de tocar nada; está escrito para ahorrarte los errores que ya se
cometieron una vez.

**Antes de cualquier tarea, lee [docs/ESTADO.md](docs/ESTADO.md).** Dice en qué
punto está el trabajo y qué está roto ahora mismo. Está mantenido al día y es la
única fuente fiable de "qué pasa hoy".

---

## 1. Qué es esto

Diario gastronómico personal. **Local-first con nube opcional**: la app funciona
al 100% sin cuenta y sin conexión; cuenta y sincronización son una capa que se
añade encima y que el usuario puede no activar nunca.

Ese principio (docs/00) no es un eslogan, es una restricción de diseño que ya ha
rechazado propuestas. Si tu cambio hace que algo deje de funcionar sin sesión o
sin red, **el cambio está mal**, no el principio.

Segunda restricción: **todo tiene que caber en capas gratuitas**. Descarta
alternativas de pago sin discusión.

```
apps/mobile     Expo / React Native, expo-router, Drizzle + SQLite, NativeWind
apps/api        Cloudflare Worker (Hono): enlaces compartidos, proxy de IA, imágenes R2, cron
packages/shared Lo que comparten app y Worker (hoy: el esquema del .restoshare)
supabase/       Migraciones, RLS, RPCs y tests SQL contra Postgres de verdad
docs/           Diseño y plan. ESTADO.md es el que se actualiza siempre
```

---

## 2. Comandos

```bash
npm run check      # formato + lint + tipos + tests de los tres workspaces. La puerta.
npm run db:test    # los .test.sql (necesita `supabase start` o DATABASE_URL)
npm run mobile     # arrancar la app
```

**`npm run check` tiene que pasar antes de dar nada por terminado.** El hook de
pre-push lo ejecuta. No lo rodees con `--no-verify`: si molesta sin aportar,
arregla la comprobación y explica por qué en el commit.

Si tocas SQL, `npm run db:test` **además**. No lo cubre `npm run check` porque
necesita una base de datos, y es lo único que comprueba que las políticas RLS
hacen lo que crees.

---

## 3. Invariantes: romper esto causa daños silenciosos

Ordenados por lo caro que sale equivocarse. Los cinco primeros ya fallaron una
vez y ninguno dio un error: todos produjeron datos incorrectos o pantallas que no
se enteraban.

### 3.1 `useLiveTablesQuery` recibe tablas, nunca nombres

```ts
useLiveTablesQuery(query, [schema.dishes, schema.dishTags], [deps]); // ✅
useLiveTablesQuery(query, ['dishes', 'dishTags'], [deps]); // ❌
```

`addDatabaseChangeListener` informa del **nombre SQL** (`dish_tag`), no del
nombre del export (`dishTags`). Como los dos son `string`, la comparación no
falla: no coincide nunca, y la pantalla deja de refrescarse. Estuvo así en cinco
hooks. Hoy los tipos lo impiden y
`lib/hooks/__tests__/live-tables-contract.node.test.ts` vigila que siga siendo
así.

### 3.2 Nunca `as` sobre datos que no escribió este código

Ficheros importados, respuestas de red, payloads de deep links: `unknown` y un
esquema zod. `JSON.parse(x) as T` no comprueba nada, **afirma**, y de ahí se va
derecho a un `insert()`.

El esquema del fichero compartido está en `packages/shared/src/share-file.ts`.

### 3.3 Toda respuesta se mira

Un `fetch` cuyo resultado se descarta es un fallo que se reporta como éxito. Pasó
con la revocación de enlaces compartidos: contestaba `{ok:true}` con el enlace
todavía sirviendo el contenido. `no-floating-promises` está activo en los tres
workspaces y encuentra buena parte de estos.

### 3.4 En Postgres, la policy manda sobre el comentario

Postgres **no sabe restringir columnas dentro de una policy**. Un `for select`
sobre una tabla expone la tabla entera, por mucho que una RPC cuidadosa filtre
por su lado — PostgREST expone las tablas directamente y el cliente puede
saltarse la RPC. Si hace falta filtrar columnas, es una **vista**.

Cuando escribas una policy, escribe también su `.test.sql`. Los 154 asserts de
`supabase/tests/` existen porque este error ya se cometió dos veces.

### 3.5 `android/` y `ios/` no se commitean

El proyecto es **CNG**: los genera EAS desde `apps/mobile/app.config.js`, que es
la única fuente de verdad de la configuración nativa. Un `android/` commiteado se
congela y acaba apuntando a otro paquete que el `google-services.json` — Firebase
no arranca y el redirect de OAuth no vuelve a la app. Están en `.gitignore` desde
la raíz; que siga así.

### 3.6 El sync es la parte peligrosa

Toca `services/sync/` con cuidado. Lo que hay que saber:

- **La identidad está partida**: local usa `id` entero, remoto usa `uuid`. La
  traducción vive en `records.ts` y `identityMap.ts`. Ningún `id` local sale del
  dispositivo.
- **`IdentityMap` vive una sola pasada y se tira.** No lo hagas persistente: una
  entrada obsoleta no da error, da una clave ajena apuntando a otra fila, en
  disco y en silencio.
- **RLS no es un filtro.** Dice qué te dejan leer, y te dejan leer la visita
  compartida de un amigo. Un `select *` sin `eq('user_id', …)` mete filas ajenas
  en el diario local. Ya pasó.
- **`SYNC_TABLES` está en orden de dependencia.** Los padres antes que los hijos.
  Reordenar rompe el pull.
- **Las uniones (`dish_tag`, etc.) no tienen uuid ni timestamps**, así que no se
  reconcilian por last-write-wins: viajan con su padre y lo reemplazan entero.

### 3.7 Lo que la app hace sin cuenta tiene que seguir funcionando

`getSupabase()` devuelve `null` cuando no hay configuración, y todo el código que
lo usa lo contempla. Si añades una llamada a la nube, la ruta sin nube tiene que
seguir viva.

---

## 4. Cómo se escribe aquí

### Comentarios: el _porqué_, y sobre todo _qué se intentó antes_

Esta es la característica más valiosa del repositorio y la más fácil de perder.
Los comentarios no describen lo que hace la línea de al lado —eso ya lo dice el
código—: describen **qué alternativa se descartó y por qué**, de modo que nadie
la reintroduzca dentro de seis meses creyendo que mejora algo.

Ejemplo real, en `tables.ts`:

> `images.path` es la ruta del fichero _en este teléfono_: no se sincroniza a
> propósito —la ruta de otro dispositivo no significa nada aquí— pero la columna
> es `not null`, así que sin esto insertar una foto que llega del servidor
> reventaba con `NOT NULL constraint failed`.

Cuando arregles un bug, el comentario cuenta **qué se veía cuando estaba roto**.
«Se marca `pushed_at` con la respuesta en la mano, nunca antes» vale poco; «…
marcarlo antes y que la petición falle deja un aviso que no se envía nunca y del
que nadie se entera» vale mucho.

Si escribes un comentario que **afirma una garantía**, pregúntate qué la sujeta.
Si la respuesta es «el código de al lado», escribe el test. Tres fugas de
seguridad de este proyecto eran comentarios que decían la intención mientras el
código hacía otra cosa.

### Idioma

Identificadores en inglés. **Comentarios, documentación y textos de UI en
español.** Lo que ya está en inglés se queda: reescribir comentarios buenos para
uniformar el idioma cambia algo que funciona por algo que se lee igual.

### Tests

- **Todo bug corregido entra con su test.**
- **Un test de propiedad no funcional tiene que fallar con el código anterior.**
  Si mide consultas, tiempo o tamaño, compruébalo revirtiendo el cambio y
  viéndolo caer. Un guardián que no caza lo que dice cazar da tranquilidad falsa.
- No se persigue cobertura global. Se cubre donde el fallo es caro (docs/12).

Tres idiomas de test que ya existen y conviene reutilizar:

| Cuándo                           | Ejemplo                                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impedir que un patrón reaparezca | `no-native-alerts.node.test.ts`, `live-tables-contract.node.test.ts` — leen el código fuente. Llevan siempre un «guardián sobre el guardián» que verifica que la prueba encontró ficheros que revisar |
| Medir, no suponer                | `query-count.node.test.ts` — cuenta sentencias que llegan a SQLite. Fija órdenes de magnitud, no números exactos                                                                                      |
| Comportamiento real de Postgres  | `supabase/tests/*.test.sql` — cada fichero sobre una base construida desde cero con las 21 migraciones                                                                                                |

### Migraciones

Numeradas, y **las ya aplicadas no se editan nunca**: se añade otra.

La cabecera explica qué problema resuelve y qué se consideró. **Cuando una
migración hace lo contrario que otra anterior, dilo y explica la diferencia**:
`0020` crea una vista con derechos de definidor justo después de que `0005`
arreglara una vista quitándoselos, y sin el párrafo que distingue «filtro de
filas» de «filtro de columnas» parece el mismo fallo repetido.

Si son muchas y mecánicas, **genera desde el catálogo** (`pg_policies`) en vez de
copiar a mano: `0021` reescribe 27 políticas así. Veintisiete transcripciones
manuales son veintisiete formas de aflojar una condición sin darse cuenta, y una
policy mal copiada no falla — deja pasar.

### Commits

Conventional Commits. El cuerpo explica **qué se veía roto**, no qué ficheros se
tocaron: eso está en el diff. Un commit, un cambio coherente.

---

## 5. Dónde vive cada cosa

| Necesitas…                | Ve a                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Una pantalla              | `apps/mobile/app/` (expo-router). **Sin SQL, sin `fetch`** — el linter lo bloquea      |
| Lógica de un dominio      | `apps/mobile/features/<dominio>/{components,hooks,repositories,schemas,mappers,types}` |
| Hablar con el Worker      | `apps/mobile/services/api/`. **Único sitio con `fetch`**                               |
| Esquema local             | `apps/mobile/services/db/schema.ts` + `drizzle/` (generado con `db:generate`)          |
| Sincronización            | `apps/mobile/services/sync/` — `engine`, `records`, `tables`, `identityMap`            |
| Rutas del servidor        | `apps/api/src/routes/`                                                                 |
| Esquema remoto, RLS, RPCs | `supabase/migrations/`                                                                 |

**Antes de crear un fichero, busca si ya existe algo parecido.** Este repo tiene
poca duplicación y conviene mantenerlo: `Sheet`, `Dialog`, `Toast`, `Screen`,
`FormScaffold`, `Avatar`, `Txt` cubren casi toda la UI. Si vas a añadir un
`Alert.alert`, un test lo va a rechazar — usa `Toast` (resultado) o `Dialog`
(decisión).

---

## 6. Trampas concretas de este stack

Cosas que ya costaron una sesión cada una:

- **`Alert.alert` está prohibido** salvo en `report-error.ts` como último
  recurso. Hay un test que lo vigila.
- **Las tablas de unión tienen nombres SQL en `snake_case`** distintos de su
  export. Ver 3.1.
- **SQLite no aplica tipos.** Una columna `integer` acepta `3.5` sin rechistar, y
  el error aparece más tarde, al sincronizar contra Postgres. Hay un caso vivo de
  esto ahora mismo (el precio, ver docs/12).
- **`exactOptionalPropertyTypes` está activo**: `{ foo?: string }` no acepta
  `undefined` explícito. Se declara `foo?: string | undefined`.
- **`noUncheckedIndexedAccess` está activo**: `array[0]` es `T | undefined`.
- **Los tests de node necesitan `.node.test.ts`** en el nombre: hay dos proyectos
  de jest y el de node es el que puede usar `better-sqlite3`.
- **En el Worker, `res.json<T>()`**, no `(await res.json()) as T` — el lint marca
  la segunda como aserción innecesaria.
- **`lint-staged` se ejecuta desde cada workspace**, no desde la raíz: ESLint 9
  busca la configuración desde el directorio de trabajo y en la raíz no hay.

---

## 7. Cómo abordar una tarea

1. **Lee ESTADO.md.** Puede que lo que vas a hacer ya esté investigado, o que
   dependa de algo bloqueado.
2. **Reproduce o localiza antes de cambiar.** La mayoría de los bugs de este
   proyecto tenían una causa raíz distinta del síntoma: «no se refresca la
   pantalla» era una cadena que no coincidía; «las fotos no cargan» era una ruta
   escrita antes de descargar el fichero.
3. **Arregla la causa, no el síntoma.** Si dos bugs comparten raíz —pasa a
   menudo—, arréglala una vez. Dilo en el commit.
4. **`npm run check`**, y `db:test` si tocaste SQL.
5. **Actualiza los docs en el mismo cambio.** Si tu cambio contradice algo escrito
   en `docs/`, corrige el documento o corrige el código; lo que no vale es dejar
   la frase puesta. Una documentación que miente es peor que no tenerla, porque
   se cree.
6. **Actualiza ESTADO.md** al cerrar el bloque.

### Cuando algo no encaje

Si el estándar escrito no describe lo que hace el código, **no lo asumas roto**.
Puede que la regla esté mal. Pasó con «solo `repositories/` toca Drizzle»: los
hooks de lista también lo hacen, y no es deuda — `useLiveTablesQuery` necesita el
_objeto consulta_ para relanzarlo, y un repositorio que devuelve un query-builder
no esconde Drizzle, lo reexporta con más pasos. Se cambió la regla.

Decide y **deja escrito por qué**. Lo que no vale es dejar las dos versiones
conviviendo sin que nadie sepa cuál manda.

### Qué no hacer sin preguntar

- Cambiar el modelo de datos local sin una migración drizzle (`db:generate`).
- Ejecutar `npm audit fix --force`: propone bajar a expo 46, jest 19 y
  drizzle-kit 0.18. El remedio destruye el proyecto; los avisos, no.
- Introducir una dependencia de pago o que no quepa en capa gratuita.
- Convertir una capa opcional (cuenta, red) en obligatoria.
