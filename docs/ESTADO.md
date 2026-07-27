# 📍 ESTADO — documentación viva

**Última actualización:** 2026-07-26 (ronda 6 — auditoría)

Punto de entrada al retomar el trabajo: qué está hecho, qué sigue, qué está bloqueado. Se actualiza al cerrar cada bloque de trabajo.

---

## ☑️ TODO — todo lo pendiente, en una lista

Índice de lo que queda, recogido de todas las rondas. Cada línea enlaza o
referencia el apartado donde está el detalle; **esto es el resumen, no la
fuente**. Marcar aquí al cerrar algo.

### 🚀 Despliegue — bloquea a casi todo lo demás

- [ ] **APK nuevo** (`eas build -p android --profile preview`). Paso cero de las últimas tres rondas
- [ ] Desplegar el Worker (`npx wrangler deploy`) y comprobar que Cloudflare lista **dos** triggers
- [ ] Aplicar migraciones pendientes a Supabase (`supabase db push`): **0019, 0020, 0021**
- [ ] Confirmar la clave FCM subida a EAS (`eas credentials`)
- [x] ~~Añadir `.easignore`~~ — hecho. Ojo: **no** excluye `packages/`, que era lo que decía [D2](#d2-el-archivo-de-eas-pesa-334-mb): `packages/shared` lo importa la app en runtime (`services/share/importService.ts`). Se excluyen sus tests, no el paquete
- [ ] Fusionar la rama a `main`: no tiene nada de las últimas seis sesiones

### 🐛 De probar la app (26 jul) — detalle en [Hallazgos](#-hallazgos-del-autor-probando-la-app--26-de-julio-de-2026)

**Baratas y visibles**

- [ ] A1 · Foto de perfil no sale en Inicio (`Avatar` sin `uri`)
- [ ] A2 · Editar perfil no refresca la pestaña Perfil — _misma raíz que A1: no hay fuente única de «mi perfil»_
- [x] ~~A3 · Errores de login en inglés~~ — las dos capas: `signInWithEmail`/`signUpWithEmail` pasan por `describeAuthError` (+7 entradas de correo/contraseña) y `account.tsx` valida con zod + react-hook-form antes de salir a la red, como el resto de la app

**Arquitectura**

- [ ] B1 · La app se congela en el primer sync — ceder el hilo entre lotes + loader con progreso
- [ ] B2 · **Dos cuentas en el mismo móvil** — necesita columna `account_uuid` + filtro en todas las lecturas. La más grande
- [ ] B3 · Push no llega — verificar los 4 eslabones de despliegue **antes** de tocar código
- [ ] B4 · La barra de navegación del sistema tapa la interfaz (`Screen` no aplica safe area)

**Interfaz**

- [ ] C1 · Transición del Diario fluida + «efecto gota» **y quitar los previews** (10 ficheros, va todo junto)
- [ ] C2 · Filtros de etiquetas: extraer el componente de `TagField` y reutilizarlo
- [x] ~~C3 · El teclado tapa «Sobre ti»~~ — `profile-edit` pasa por `FormScaffold`; Guardar va al pie fijo. **Sin verificar en dispositivo**
- [ ] C4 · Fotos de «Lo último que añadiste»: falta caer a la URL remota si el fichero local no está
- [x] ~~C5 · Márgenes laterales del drawer «¿Quién puede ver esto?»~~ — `px-5`, como el resto de hojas

**Producto**

- [ ] D1 · Pantalla de bienvenida (primera ejecución, sin convertirse en puerta de login)

### 🔍 De la auditoría (ronda 6) — detalle en [Lo que queda pendiente](#-lo-que-queda-pendiente-por-orden)

- [ ] Eliminar cuenta y datos (**GDPR**) — obligación legal el día que haya producción
- [ ] La **regla del dinero** está rota: `price: integer` guardando `3.5`; se arregló solo el lado servidor
- [ ] **Cero tests de UI** — ni un `.test.tsx`; `@testing-library/react-native` instalado y sin usar
- [ ] Round-trip export→import idempotente (docs/12 lo exige)
- [ ] Sync contra Supabase local con dos dispositivos de verdad
- [ ] Aislamiento entre features (`eslint-plugin-boundaries` + mover lo compartido)
- [ ] Telemetría de errores — hoy un fallo que no se reproduzca delante no deja rastro
- [ ] `npm audit`: `overrides` de `brace-expansion` y `uuid`. **Nunca `npm audit fix --force`**

### 🧱 De rondas anteriores

- [ ] **RAM: ~1 GB medido** (`TOTAL PSS`), con swap. Plan en [docs/16 §2](16-memoria-e-imagenes.md), **midiendo antes de construir miniaturas**
- [ ] Tarea #32 · Copia de seguridad automática **antes de migrar** — la pieza existe (`BackupService`), falta engancharla
- [ ] Persona etiquetada en una visita no se muestra tras crearla
- [ ] La moneda está fijada a COP en el detalle de plato
- [x] ~~`jszip` sigue en `dependencies`~~ — a `devDependencies`; solo lo usa `zip.node.test.ts`
- [ ] «Armonía» en formularios de detalle y creación — idea concreta: **empezar por la foto**
- [ ] Repasar docs sin revisar: **00, 01, 04, 07, 08, 10**
- [ ] `lint:compiler`: 83 avisos de React Compiler readiness (fuera de la puerta a propósito)
- [ ] Confirmar si el orden de «Lo último que añadiste» (por fecha de registro) chirría — una línea en `useHomeSummary`

### 📱 Verificar en dispositivo (con el APK nuevo)

- [ ] Sync con **dos dispositivos** — el caso que antes fallaba en silencio
- [ ] Descarga de fotos y `sync-status` con sesión y Worker reales
- [ ] Novedades con datos de verdad: que llegue el aviso al etiquetar y que el punto se apague
- [ ] Pantalla de conflictos (nunca se ha visto en pantalla)
- [ ] Que las hojas toquen el borde inferior sin meterse bajo la barra de navegación
- [ ] Arrastre hacia abajo para cerrar paneles
- [ ] Parpadeo en vista calendario (`removeClippedSubviews={false}`)

### ⚠️ Riesgo conocido, asumido

- **Sin transacciones**: la fila y su `change_log` se escriben por separado (con
  better-sqlite3 un callback `async` en `transaction()` crashea el proceso).
  Mitigado con `linkLocalData` en cada push y cubierto por test. Anotado, no
  pendiente.

---

## 🔴 AQUÍ SE RETOMA — 26 de julio de 2026 (ronda 6)

Rama `fix/auditoria-ronda-6`. Auditoría completa del proyecto y corrección de lo
encontrado, en orden de gravedad. **Cómo se trabaja a partir de ahora está en
[AGENTS.md](../AGENTS.md)**, en la raíz: es lo segundo que hay que leer después
de este documento.

### Lo que se arregló

**Cuatro fallos que se veían en la app o la habrían roto:**

1. **Las pantallas no se enteraban de las etiquetas.** Cinco hooks pasaban a
   `useLiveTablesQuery` el nombre del export de Drizzle (`dishTags`) en vez del
   nombre SQL (`dish_tag`). Los dos son cadenas, así que no fallaba: no
   coincidía. Poner o quitar una etiqueta a un plato, o un acompañante a una
   visita, no repintaba — y a veces sí, cuando la operación tocaba además una
   tabla bien escrita, lo que lo hacía parecer intermitente. El hook ahora recibe
   objetos de tabla y el error no se puede escribir.
2. **El `android/` commiteado apuntaba a otra app** (`com.restaurantappv2`,
   `versionCode 1`, sin el intent-filter de `restaurantapp://`, sin permiso de
   notificaciones) mientras `google-services.json` estaba registrado para
   `com.supermaty01.restaurantapp` y un `app.json` en la raíz declaraba un tercer
   nombre. Se coló por accidente en un commit de UI. **Es una causa
   independiente del mismo síntoma que el punto 0 de abajo.** Fuera, e ignorado
   desde la raíz.
3. **`packages/shared` no tenía código.** Es lo que rompía `npm run check`. Ahora
   contiene lo que le correspondía: el esquema zod del `.restoshare`.
4. **Revocar un enlace compartido decía que sí pasara lo que pasara.** El
   `fetch` salía y la respuesta se descartaba.

**Seguridad:**

- Las imágenes guardaban el `content-type` que mandara quien subía y el `GET`
  público lo devolvía tal cual con `immutable` a un año: subir `text/html` daba
  una página ejecutándose en el mismo origen que las previsualizaciones de
  `/s/:id`. Ahora el tipo lo deciden los bytes, con tope de tamaño y `nosniff`.
- La **bio se leía por la puerta de al lado**: `user_profile()` la escondía a un
  desconocido y `GET /rest/v1/profiles?select=bio` la devolvía igual
  (migración `0020`).
- Marcar un aviso permitía reescribirlo entero pese a decir «solo marcado»
  (`0020`).
- Las rutas de IA no tenían ningún tope, y el control que la documentación decía
  que había —el AI Gateway— viene desactivado por defecto.
- El JWKS se pedía por red en **cada** petición autenticada.
- El cron de las 3:00 que `wrangler.toml` documenta no existía: `scheduled` no
  miraba `event.cron`.

**Las puertas de calidad, que estaban apagadas:** `.husky/` vacío (y con el
`lint-staged` mal escrito, llamando a eslint desde donde no hay configuración),
CI comprobando solo `apps/mobile`, lint con `continue-on-error: true`, y
`format:check` imposible de pasar en Windows por CRLF. Todo eso funciona ahora, y
`npm run db:test` corre en CI contra un Postgres de verdad.

**Rendimiento:** el sync hacía una consulta a SQLite por cada clave ajena de cada
fila —del orden de 2.000 por página de 500— y las 27 políticas RLS reevaluaban
`auth.uid()` fila a fila.

Números: **321 tests** en la app (antes 319, +2 que miden consultas), **57** en
el Worker (+11), **9** en shared (nuevos), **154 asserts SQL** (antes 146).

---

## 🐛 Hallazgos del autor probando la app — 26 de julio de 2026

Catorce cosas encontradas usando la app, **anteriores a la auditoría** y ninguna
corregida todavía. Cada una está investigada contra el código: aquí va la causa
raíz, no el síntoma. El orden es por (impacto × certeza) ÷ coste.

> Nota: ninguna la arregló la ronda 6. La auditoría miró el código; esto salió de
> usar la app, que es otra cosa y encuentra otras cosas.

### 🔴 A — Baratas y muy visibles (una sesión las tres)

#### A1. La foto de perfil nunca sale en Inicio

**Causa raíz encontrada.** [`index.tsx:74`](<../apps/mobile/app/(main)/(tabs)/index.tsx>)
pinta `<Avatar name={displayName ?? 'Tú'} size={38} />` — **sin pasar `uri`**.
El componente sí lo admite (`Avatar` tiene la prop y `profile.tsx:131` la usa
bien), así que siempre cae a las iniciales.

No es un cambio de una línea: Inicio saca `displayName` de `useAuth()`, que es la
sesión, y **nunca pide el perfil**, así que no tiene `avatarUrl` que pasar.

**Comparte causa con A2** — ver abajo.

#### A2. Editar el perfil y volver no actualiza la pestaña Perfil

**Causa raíz encontrada.** `profile-edit` termina con `router.back()`
([línea 138](<../apps/mobile/app/(main)/profile-edit.tsx>)). La pestaña Perfil
**ya estaba montada** —expo-router mantiene las tabs vivas— y
[`useAsyncResource`](../apps/mobile/features/social/hooks/useAsyncResource.ts)
solo carga en el montaje: su `useEffect` depende de `load`, que solo depende de
`enabled`. Nadie llama a `reload` al volver a enfocar.

**A1 y A2 son el mismo problema de fondo: no hay una fuente única para "mi
perfil".** Cada pantalla lo pide por su cuenta y se queda con su copia. La
solución que arregla las dos —y previene las siguientes— es un contexto o store
de perfil, poblado una vez y actualizado al guardar. Parchear cada pantalla con
`useFocusEffect` arregla el síntoma y deja el patrón puesto para el próximo.

#### A3. Errores de login en inglés

**Causa raíz encontrada, y son dos capas:**

1. `describeAuthError` existe, tiene su tabla de traducciones y **solo se usa en
   el camino de OAuth** (`AuthContext` líneas 155 y 179). `signInWithEmail` y
   `signUpWithEmail` devuelven `error.message` **en crudo**.
2. `account.tsx` no valida nada antes de llamar: el formulario vacío va derecho a
   Supabase, que contesta `missing email or phone`. El resto de la app usa zod +
   react-hook-form; esta pantalla no.

Arreglar (1) es pasar dos llamadas por `describeAuthError` y añadir las entradas
que faltan. Arreglar (2) es que el formulario valide antes de salir a la red,
que además ahorra el viaje.

### 🟠 B — Arquitectura y bloqueos reales

#### B1. La app se congela en el primer sync

**Confirmado estructuralmente.** `runSync` es una función `async` normal que corre
**en el hilo de JavaScript**: SQLite, red y traducción, todo ahí. React Native
pinta desde ese mismo hilo, así que mientras dura no hay frames. En un diario
importado son miles de filas.

La ronda 6 recortó mucho trabajo (de ~2.000 consultas por página a menos de 10,
ver `query-count.node.test.ts`), lo cual **alivia pero no arregla**: sigue siendo
trabajo largo en el hilo que pinta.

Opciones, de menos a más:

1. **Un loader honesto** con progreso real. `photos.ts` ya emite `PhotoProgress`;
   el motor de filas no emite nada todavía. Es lo que el autor propone y es
   defendible: el sync inicial ocurre una vez.
2. **Ceder el hilo entre lotes** (`await new Promise(r => setTimeout(r, 0))` cada
   N filas). Barato, y convierte el bloqueo en lentitud con la UI viva.
3. `react-native-worklets` / hilo aparte. Es lo correcto y es caro: expo-sqlite
   no es accesible desde un worklet, así que habría que mover el acceso a datos.

Recomendación: **2 + 1**. La 3 no compensa hoy.

#### B2. Dos cuentas en el mismo móvil

**Hoy no es posible, y la razón es de esquema.** Investigado:

- Las tablas locales tienen `userId: integer` — pero apunta a la **tabla `users`
  local vestigial** de la auth vieja, que docs/12 ya marca para eliminar. **No
  existe ninguna columna con el uuid de la cuenta de Supabase.**
- Las consultas no filtran por cuenta: todo lo local se ve siempre.
- `linkLocalData` encola **toda** fila sin entrada en `change_log`, sin mirar de
  quién es. Iniciar sesión con la cuenta B en un móvil con datos de A los
  encolaría como de B.
- `signOut` a propósito no toca lo local (docs/04).

Hoy el servidor **falla de forma segura** —RLS rechaza las filas ajenas y
`pushBatch` las absorbe, cambio de la ronda anterior—, pero en el móvil se sigue
viendo todo mezclado.

Los cinco casos que planteó el autor se reducen a **una columna y un filtro**:

| Caso                                 | Qué hace falta                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 1. Sin cuenta → inicio sesión        | `account_uuid IS NULL` → sellar con la cuenta y sincronizar. Es lo que `linkLocalData` ya hace, más el sellado |
| 2. Con cuenta → misma cuenta         | Ya funciona                                                                                                    |
| 3. Con cuenta → otra cuenta          | **Lo que falta.** Guardar las dos, mostrar solo la activa                                                      |
| 4. Siempre sin cuenta                | Ya funciona (`account_uuid` nulo)                                                                              |
| 5. Cerrar sesión con datos asociados | Sale del mismo filtro: sin sesión solo se ve lo que tiene `account_uuid` nulo                                  |

**Alcance real:** migración local que añade `account_uuid` (nullable) a las seis
tablas sincronizables, más filtro en **todas** las lecturas —los 13 hooks de
`useLiveTablesQuery` y los repositorios—, más `linkLocalData` reclamando solo las
filas huérfanas. Es la tarea más grande de esta lista y la que más se beneficia
de hacerse **antes** de que haya usuarios reales, porque después es una migración
de datos de verdad.

**Y hay que decirlo en la UI**, que es la mitad que se olvida: al iniciar sesión
por primera vez con datos locales, avisar de que van a quedar asociados a esa
cuenta y de que al cerrar sesión dejarán de verse. Sin ese aviso, el caso 5 se
vive como pérdida de datos.

#### B3. Las notificaciones push no llegan

**No es un bug de código; es una cadena de despliegue con varios eslabones
sueltos.** El código está y está probado (57 tests en el Worker, 16 solo de
reparto). Lo que falta, en orden, y **todo tiene que estar**:

1. **Credenciales de FCM en EAS.** `docs/15` ya lo marca como bloqueado por
   terceros. Sin esto no hay entrega, punto.
2. **El Worker desplegado.** El reparto vive en un cron; un cron sin desplegar no
   se dispara. Comprobar que el panel de Cloudflare lista **dos** triggers.
3. **APK construido con `googleServicesFile`**, que entró en `app.config.js`
   después del APK instalado (ronda 4).
4. **El `android/` que la ronda 6 borró** estaba congelado en
   `com.restaurantappv2` mientras `google-services.json` es de
   `com.supermaty01.restaurantapp`. Era una causa **independiente** del mismo
   síntoma. Ya no está, pero por eso el APK nuevo es el paso cero.

Antes de tocar código, verificar los cuatro. Es muy probable que el código esté
bien y el diagnóstico haya sido siempre de infraestructura.

#### B4. La barra de navegación del sistema se come la interfaz

**Causa raíz encontrada.** `Sheet` y `FloatingTabBar` usan `useSafeAreaInsets` y
respetan `insets.bottom`. **`Screen`, que es la base de casi todas las pantallas,
no tiene ni una línea de safe area.** Así que en un móvil con barra de tres
botones —en vez de gestos— el contenido queda debajo.

Se arregla en un sitio: que `Screen` aplique el inset inferior, con una salida
para las pantallas que ya lo gestionan (las que llevan `FloatingTabBar`, o
tendrían el hueco dos veces).

### 🟡 C — Interfaz

#### C1. La transición del Diario, y quitar los previews

**Investigado, y el diagnóstico es más simple de lo que parecía.**
[`SegmentedTabs`](../apps/mobile/components/ui/SegmentedTabs.tsx) hoy:

- **Renderiza solo la pestaña activa**: `<View className="flex-1">{activeTab?.render()}</View>`.
  No hay tres páginas ni desplazamiento: hay un intercambio. Por eso se siente
  como una redirección — **es** una redirección.
- El gesto Pan **no mueve nada mientras arrastras**: solo mira al soltar y llama
  a `go(±1)`. No hay `translateX` seguido al dedo.
- El indicador anima con `withSpring` **por segmento** (cada uno su opacidad), no
  una pastilla compartida que se desliza. El «efecto gota» no existe.

Para lo que pide el autor hace falta: un pager con las tres páginas montadas y un
`translateX` compartido, y que la posición y anchura de la pastilla se interpolen
**desde el desplazamiento del pager**, no desde el estado. Así el indicador
sigue al dedo y el efecto fluido sale solo. Para la «gota» de verdad —que se
estire al pasar— la anchura interpola con un pico en el punto medio.

**Y por eso quitar los previews va en la misma tarea, no en otra.** El peek es un
gesto largo/Pan sobre los ítems de lista, y el pager necesita el Pan horizontal:
convivir exige coordinar dos reconocedores, que es de donde salían los problemas.
Quitándolos, el pager es directo.

Los previews tocan **10 ficheros**: `PeekablePressable`, `GridPeekItem`,
`components/peek/*` (3), `PeekContext`, y los `*Item`/`*List` de platos, visitas
y lugares, más `VisitTimeline`. Quitar de verdad —no dejar el componente
huérfano— incluye borrar el contexto y el proveedor del layout.

#### C2. Los filtros de etiquetas

`FilterSheet.tsx:286` usa `checkmark-circle` / `ellipse-outline` con
`accessibilityRole="radio"`: es literalmente un radio button a la derecha. El
diseño que el autor quiere ya existe en `features/tags/components/TagField.tsx`
(el drawer de añadir etiquetas). **La solución no es rediseñar: es extraer el
componente de TagField y usarlo en los dos sitios**, que además elimina una
duplicación real.

#### C3. El teclado tapa «Sobre ti»

`KeyboardAvoidingView` existe **en un solo sitio de toda la app**:
`components/ui/FormScaffold.tsx`. Y `profile-edit.tsx` **no usa FormScaffold** —
tiene su propio layout. El campo de bio es `multiline` y está al final de un
formulario largo, así que el teclado se le sienta encima.

Lo barato es pasar `profile-edit` por `FormScaffold`. Conviene comprobar si hay
más pantallas fuera de él con el mismo problema latente.

#### C4. Las fotos de «Lo último que añadiste» no siempre cargan

**Causa raíz encontrada, y es interesante.** `useHomeSummary` selecciona de
`images` solo `path` — **nunca `remoteKey`**. Y cuando una foto llega por sync,
`localDefaults` en `tables.ts` le pone `path = '{uuid}.jpg'` **antes de que el
fichero se haya descargado**: `downloadMissingPhotos` va después y puede tardar o
fallar.

Así que la fila dice que hay una foto en una ruta local que todavía no existe, y
`imagePathToUri` devuelve ese `file://` sin alternativa: solo cae a una URL si la
_propia ruta_ ya era `http`. Resultado: hueco en blanco hasta que la descarga
termine, y para siempre si falló.

**Arreglo correcto:** que la resolución de imagen sepa caer a
`{API_URL}/images/{cuenta}/{uuid}` cuando el fichero local no está y hay
`remoteKey`. Beneficia a toda la app, no solo a Inicio.

#### C5. El drawer «¿Quién puede ver esto?» va pegado a los lados

`VisibilityControl.tsx` abre con `<View className="gap-3 pb-2">`: vertical sí,
horizontal nada. Faltan los `px-` que el resto de hojas sí tienen.

### 🔵 D — Producto e infraestructura

#### D1. Pantalla de bienvenida

Hoy `app/index.tsx` es un `Redirect` a las tabs, y el comentario explica por qué:
_«no hay puerta de login; las cuentas son una capa opcional, nunca una barrera de
entrada»_ (docs/00, docs/04).

**Eso no se puede romper para meter la bienvenida.** Lo que pide el autor es
compatible si es: primera ejecución **solamente**, con «Continuar sin cuenta»
como opción de igual peso —no un enlace pequeño debajo— y una marca en
`app_settings` para no repetirla. Y es el sitio natural para explicar la regla de
B2: _si luego creas una cuenta, lo que hayas guardado se asocia a ella_.

#### D2. El archivo de EAS pesa 334 MB

**No hay `.easignore`** en el repo. Sin él, EAS sube todo lo que no esté en
`.gitignore`, y eso incluye `.git` entero con su historia.

Es el arreglo más barato de toda la lista: un `.easignore` con `.git`, `docs`,
`supabase`, `apps/api`, `packages`, `coverage`, `*.md` y los tests. Nada de eso
participa en construir el APK. Minutos de subida en cada build.

### ⏭️ Lo que queda pendiente (por orden)

0. **Generar un APK nuevo y probarlo.** Sigue siendo el paso cero. Ahora hay una
   razón más para hacerlo: se ha borrado el `android/` commiteado, así que la
   build sale de `app.config.js` limpia por primera vez. Ojo — el paquete
   correcto (`com.supermaty01.restaurantapp`) **no es** el del APK que pudiera
   haberse construido desde el `android/` viejo, así que puede instalarse al lado
   en vez de encima.

   `eas build -p android --profile preview`.

1. **Eliminar cuenta y datos (GDPR).** Sin tocar; sigue siendo lo único que
   queda del plan original. Detalle abajo.

2. **La regla del dinero está rota.** `schema.ts` declara
   `price: integer('price')` y la app escribe `3.5`; SQLite no lo impide y por
   eso tumbó un push contra Postgres en su día (ver `0008`). Se arregló **solo el
   lado servidor** (`numeric(12,2)`). Hay que decidir uno de los dos —céntimos
   enteros en ambos lados, o `real` en ambos— y migrar el local.

3. **Cero tests de UI.** No hay un solo `.test.tsx`;
   `@testing-library/react-native` está instalado y no se importa en ninguna
   parte. docs/12 pide cubrir «lógica no trivial»: el visor de imágenes y los
   formularios con prefill.

4. **Round-trip export→import.** docs/12 lo exige y no existe. El esquema del
   `.restoshare` ya está cubierto en `packages/shared`; falta la vuelta entera.

5. **Sync contra Supabase local.** Hoy está cubierto contra un `FakeServer` que
   modela el trigger LWW y `sync_seq`, que es bastante — pero dos dispositivos de
   verdad contra un Postgres de verdad es otra cosa.

6. **Aislamiento entre features.** Necesita `eslint-plugin-boundaries` y mover a
   un sitio común lo que hoy se comparte con razón (el componente `Tag`,
   `ImageDTO`/`TagDTO`). Explicado en docs/12.

7. **Sin telemetría de errores.** `reportError` hace `console.error` y enseña un
   diálogo. En cuanto la app esté en manos de alguien más, un fallo que no se
   reproduzca delante no deja rastro.

8. **`npm audit`: 53 avisos, 3 causas.** Todas transitivas y de la cadena de
   construcción (`brace-expansion` vía eslint/jest, `esbuild` vía drizzle-kit,
   `uuid` vía los config-plugins de Expo). **No ejecutar `npm audit fix
--force`:** propone bajar a expo 46, jest 19 y drizzle-kit 0.18. Lo razonable
   son `overrides` puntuales de `brace-expansion` y `uuid`. CI ya lo reporta sin
   bloquear.

### 📌 De la ronda 5, todavía vigente

## 🗄️ Ronda 5 — 26 de julio de 2026

Las **notificaciones nuevas están hechas y probadas contra Postgres de verdad**
(migración 0019). De la lista que fijó el autor —foto de perfil > scroll >
Inicio > notificaciones > borrar cuenta— queda **solo la última**.

Esta ronda hubo Docker, así que por primera vez en tres sesiones las aserciones
SQL se pudieron correr: **146 comprobaciones sobre el esquema real**, aplicando
las 19 migraciones desde cero en una base desechable por fichero de test.

### 👉 Lo siguiente, en orden

0. **Generar un APK nuevo y probarlo.** Sigue siendo el paso cero y sigue sin
   hacerse, con las mismas dos razones de la ronda 4: los drawers y los textos
   cortados funcionan contra esta rama pero el móvil tiene un APK anterior, y el
   push falla al arrancar con `Default FirebaseApp is not initialized` porque el
   APK instalado se construyó antes de que `googleServicesFile` entrara en
   `app.config.js`. Ninguna recarga de JavaScript lo arregla.

   `eas build -p android --profile preview`.

1. **Eliminar cuenta y datos (GDPR).** Lo único que queda del plan, y entra
   limpio en una sesión propia. Apartado poco visible en Ajustes, con
   confirmación fuerte —escribir el usuario, no un «sí»—. Tiene que borrar de
   verdad: espejo, fotos en R2, perfil, tokens de push, avisos y la cuenta de
   auth. Y decir qué **no** se borra: lo que otras personas ya guardaron de una
   visita compartida. Ofrecer exportar antes (`BackupService` ya existe). No es
   urgente porque no hay producción todavía, pero es obligación legal el día que
   la haya.

### ⚠️ Encontrado de paso, sin arreglar

> **Los dos se arreglaron en la ronda 6.** Se dejan escritos porque explican por
> qué varias rondas pudieron declararse «verdes» sin serlo, que es la lección
> que interesa conservar.

- ~~**`npm run check` desde la raíz está roto**~~, y lleva tiempo estándolo:
  `packages/shared` no tiene `src/` y revienta en `typecheck`, `test:ci` y
  `lint`. Las rondas que declararon «verde» corrían los workspaces por separado.
  → Resuelto: el paquete ya tiene contenido y `npm run check` pasa entero.
- ~~**Diez ficheros sin formatear**~~ que `format:check` marca. Resultaron ser
  CRLF, no formato: `.gitattributes` decía `eol=lf` y el árbol tenía otra cosa,
  así que la comprobación era imposible de pasar en Windows. → Renormalizado.

### Decidido y sin cerrar del todo

- **El orden de «Lo último que añadiste» es por fecha de registro**, no por la
  fecha de la comida, así que puede verse «29 jun» encima de «24 jul». Es
  coherente con el título y con agrupar por sesión, pero está pendiente de que
  el autor confirme que no le chirría. Cambiarlo es una línea en
  `useHomeSummary`.

### Servicios (bloqueado por terceros)

1. **Desplegar el Worker** (`cd apps/api && npx wrangler deploy`). El envío de
   push vive en un cron, y un cron sin desplegar no se dispara. Comprobar que
   el panel de Cloudflare lista **dos** triggers. Ahora además hace falta para
   que salgan las clases nuevas: la 0019 las emite, pero el Worker desplegado no
   sabe redactarlas.
2. **Aplicar la 0019 al proyecto de Supabase** (`supabase db push`). Las tres
   clases nuevas no existen hasta que se aplique.
3. **Confirmar que la clave FCM está subida a EAS** (`eas credentials`).
4. **Probar el sync con dos dispositivos y sesión iniciada.** Sigue sin
   verificarse contra servicios reales. Empezar por Ajustes → «¿Está todo en la
   nube?».
5. **Fusionar la rama.** `main` no tiene nada de las últimas cinco sesiones.

### 🟢 Lo cerrado en la ronda 5

Verde: TypeScript en 0 y lint sin avisos en `apps/mobile` y `apps/api`, **311
tests** de app (+2), **40 del worker** (+4) y **146 aserciones SQL** en verde
—estas últimas corridas de verdad, no supuestas—.

- **Tres clases de aviso más** (migración **0019**), sobre la tabla que la 0016
  dejó genérica por `kind`: `friend_request`, `friend_accepted` y
  `friend_published`. El detalle de cada decisión está en
  [docs/15](15-notificaciones-push.md#3-las-cuatro-clases); lo que importa aquí:
  - El aviso de amistad va en un **trigger sobre `friendships`** y no dentro de
    las RPC, porque hay dos caminos hasta «ahora sois amigos» —responder que sí,
    y pedir amistad a quien ya te la había pedido, que `send_friend_request`
    acepta en el sitio— y desde la tabla los dos avisan igual.
  - `friend_published` sale **una vez por ráfaga y gana el primero**: registrar
    una comida escribe tres filas y de ahí sale un aviso. El silencio de diez
    minutos mira **cualquier** aviso reciente de esa persona, no solo de esta
    clase: si acaba de etiquetarte ya te enteraste.
  - **Y no apunta a ninguna fila.** La que dispara el trigger es la que ganó la
    carrera del sync —el restaurante unas veces, la visita otras—, así que
    apuntar a ella llevaría a un sitio distinto según el orden de subida. Lleva
    al perfil, que es donde están las tres.
  - **Un diario histórico no despierta a nadie.** `created_at` lo pone el móvil,
    no el servidor, así que la primera sesión sube años de comidas de golpe. Sin
    freno, todos tus amigos reciben «ha añadido algo nuevo» por una comida de 2023. La ventana es de siete días: deja pasar el móvil sin cobertura una
    semana de viaje —justo cuando más se registra— y para el volcado.
  - **Descartada a propósito** la idea de «un amigo visita un sitio que puntuaste
    alto»: depende de que dos personas registren el mismo local —misma sede,
    mismo nombre— y eso no se puede dar por hecho.

- **El punto y la lista contaban cosas distintas.** `unread_notifications` y
  `notifications_page` tenían la regla escrita dos veces y ya no coincidían: el
  contador no miraba si la visita seguía existiendo, así que una visita borrada
  dejaba el punto encendido sobre una lista vacía. Ahora las dos llaman a
  `notification_visible`, y hay un test que las compara entre sí.

- **🐛 `dishe` no es una entidad.** La 0014 montó las tres policies de lectura
  entre amigos en un bucle que sacaba el nombre recortando la última letra, y
  sobre `dishes` eso da `'dishe'`. `effective_visibility` no tiene rama para esa
  entidad: devuelve NULL, el coalesce lo vuelve `'private'`, y **todo plato en
  `default` quedaba ilegible para tus amigos** por mucho que el ajuste dijera que
  sí. No se notaba porque nada lee `dishes` de otra persona por RLS —el feed, el
  perfil ajeno y el detalle van por RPC security definer, que sí escriben
  `'dish'`—, así que era una mina y no una avería. Arreglado en la 0019, con un
  test en `visibility.test.sql` que se comprobó que falla contra la policy vieja.

- **🐛 El aviso enseñaba la fachada del restaurante.** El mismo bicho que arregló
  la 0018 en `tagged_visits`, en un segundo nido que se quedó atrás:
  `notifications_page` ordenaba con `(i.visit_uuid = v.uuid) desc`, que da NULL
  para una foto de restaurante, y Postgres ordena NULLS FIRST en `DESC`. Le llega
  ahora el mismo `nulls last`.

### 🟢 Lo cerrado en la ronda 4 (todo verificado en el emulador)

Verde: TypeScript en 0, **309 tests**, lint sin avisos, SQL en verde.

El emulador tenía sesión iniciada y datos reales, así que por primera vez se
pudo comprobar lo social de verdad en vez de estados vacíos.

- **La etiqueta enseñaba la fachada del restaurante** (migración **0018**).
  `tagged_visits` ordenaba con `(i.visit_uuid = v.uuid) desc` para preferir la
  foto de la visita — pero para una foto de restaurante `visit_uuid` es NULL, la
  comparación da NULL, y **Postgres ordena NULLS FIRST en `DESC`**. Iban
  delante las del restaurante: justo lo contrario de lo que se lee. Por eso la
  misma comida salía con la fachada en «Contigo» y con la mesa en el feed —
  `feed_page` nunca mira las del restaurante.
- **«con 2 personas» → «con Irene y Moni»**, en Amigos y en Contigo. Se prefiere
  el nombre al @usuario: mezclarlos deja «con caro y Moni», con una en
  minúscula. Quien mira no se lista a sí misma.
- **Fuera los quince `Alert` del sistema**, con test estructural que lo sujeta.
  El diálogo de permisos estaba copiado tres veces → `usePermissionGate`.
  **Cerrar sesión ahora pregunta** y dice cuántos cambios quedan sin subir.
- **Foto de perfil.** La clave lleva la hora a propósito: el Worker sirve con
  `immutable, max-age=31536000` —correcto para el diario, cuyas claves son
  uuids— y con clave fija la foto nueva quedaría escondida detrás de la vieja un
  año en cada dispositivo que la hubiera visto.
- **El scroll del calendario**, en dos pasadas (ver abajo).
- **Inicio: «Lo último que añadiste»**, una entrada por sesión de registro.
  Agrupa por **relaciones y no por reloj**: `dish_visit` y el restaurante de
  cada fila dicen qué se creó como parte de qué, mientras que una ventana de
  tiempo fundiría dos comidas registradas seguidas y partiría una sesión lenta.

### 🔬 El scroll del calendario, y una lección de medición

Costó dos pasadas y las dos enseñan algo.

**Primera: faltaba `getItemLayout`.** Reproducido antes de tocar nada — tras un
fling, la cabecera fija decía «Agosto 2025» sobre filas del 4 y el 3 de julio.
Sin `getItemLayout` la `SectionList` estima posiciones y las corrige al medir;
al lanzar un fling se saltan decenas de celdas sin medir y
`stickySectionHeadersEnabled`, que decide qué cabecera pintar a partir de esos
offsets, acaba enseñando el mes equivocado.

**Segunda: la estimación estaba mal.** Quedaba un hueco por el que se veía el
fondo. La cabecera se calculaba en 52 dp y **mide 49,1**: el alto de una fila
`items-baseline` no es el `lineHeight` del texto más alto. Tres dp por sección
se acumulan hasta despegarla. Medido con `uiautomator dump`: cabecera 129 px,
fila 607 px a densidad 420 — la fila estaba bien, solo fallaba la cabecera.
Ahora la estimación es semilla y manda la medida real, **tomada una sola vez**
con un guard de ref.

> **Dos trampas que casi cuestan una sesión, anotadas para no repetirlas.**
>
> 1. El primer intento de medir puso `onLayout` en **cada** cabecera y fila: cada
>    una que entraba en pantalla disparaba un `setState`, la tabla de offsets se
>    rehacía a media animación y la lista se quedaba en blanco. Medir una vez, no
>    continuamente.
> 2. Ese «se queda en blanco» tras seis flings seguidos **también pasa sin ningún
>    cambio, y se recupera solo en dos segundos**: es latencia de render, no un
>    layout roto. Capturar justo al soltar pilla la lista a medias. Estuve a punto
>    de perseguir un fallo inexistente por sacar la captura demasiado pronto.

### 🟢 Lo cerrado en la ronda 3 (feedback en dispositivo)

Verde: TypeScript en 0, **295 tests** de app + **36 del worker**, lint sin
avisos. Las aserciones SQL no se pudieron correr —el entorno no tiene Docker—
pero **no se tocó ningún fichero SQL**: el push usa la 0016 tal cual.

**El sync de fotos paraba cada quince.** Un tope por pasada hacía que un móvil
recién estrenado se diera por sincronizado con novecientas fotos aún en el
servidor, y no volviera solo: había que salir y entrar de la app, una vez por
tanda. El argumento del tope —que sobreviva lo hecho si se corta la conexión—
nunca dependió de él: cada foto se confirma en su propia escritura. Ahora sigue
hasta el final.

**Y decía «Subiendo fotos» mientras las bajaba.** Subida y bajada compartían el
reporte de progreso y la palabra la escribía la tarjeta de perfil. La dirección
va ahora en el dato (`PhotoProgress.phase`).

**Las fotos, más rápidas.** Iban de una en una, y una transferencia es casi toda
espera: el tiempo total era la suma de las latencias. Con seis en vuelo lo marca
el ancho de banda. Y la bajada hacía un `getInfoAsync` por fila **antes de bajar
nada** —mil saltos al hilo nativo en cada sync, se pagaran o no—; ahora un solo
listado del directorio responde por todas.

**Los paneles: el parpadeo era tener tres animaciones.** `SlideInDown` al
montar, `SlideOutDown` al desmontar y un valor aparte para el arrastre, sin
hablarse. Al soltar, el gesto devolvía la hoja arriba y _después_ empezaba la
salida: un salto entero antes de caer. Ahora hay un solo `translateY` y el
desmontaje espera a que la animación termine. Ver
[la sección de abajo](#-el-bug-de-los-paneles-era-el-pie-no-pressablescale) para
el bug anterior, que era otro.

**Y salen desde abajo.** Faltaba `navigationBarTranslucent` junto a
`statusBarTranslucent`: sin las dos, Android mete la ventana del modal dentro de
los insets y la hoja no puede tocar el borde. Eso es lo que dejó el panel
flotando con márgenes y cuatro esquinas redondeadas.

**Textos explicativos que no cabían.** «Sigue tu configuración general, también
si la c…» cortaba antes de la mitad que aporta algo. Ya no se recortan las
descripciones del panel de visibilidad, las de «Registrar» ni los ejemplos del
buscador; «te etiquetó en X» pasa a dos líneas, como ya estaba el feed.

**Tocar a alguien abre su perfil.** No es que no pasara nada: el toque lo
recogía la tarjeta entera y llevaba a la comida. Nueva `AuthorHeader`, usada en
el feed, en «Contigo» y en Novedades.

**El push, entero.** Ver [docs/15](15-notificaciones-push.md). Dos cosas que
habrían fallado en silencio: el `[triggers]` de `wrangler.toml` se disparaba
contra un Worker sin `scheduled` —`export default app` exporta solo `fetch`—, y
el nombre de quien etiqueta no se puede embeber desde `notifications` porque no
hay clave ajena directa a `profiles`.

**`expo-env.d.ts` pasa a `.gitignore`.** Lo genera Expo y no estaba: un clon
recién hecho no compilaba, lo que enmascaraba el estado real de `tsc` y de
`lint` (salían errores en ficheros que nadie había tocado).

### Sigue sin verificarse en un dispositivo

Nada de esta tanda se ha visto en pantalla: el entorno no tiene emulador. En
concreto, lo que hay que mirar primero con el APK nuevo:

- **El gesto de los paneles**, que ahora vive en la cabecera entera y no en la
  muesca. La X tiene que seguir cerrando con un toque.
- **Que la hoja toque el borde de abajo** y el contenido no se meta bajo la
  barra de navegación.
- **Tocar el nombre en una tarjeta del feed**: `Pressable` dentro de
  `PressableScale` depende de que el más profundo se quede con el gesto.
- **El sync de fotos completo** en un móvil limpio, con el recuento avanzando.

### ✅ El bug de los paneles: era el pie, no `PressableScale`

**La sesión anterior lo diagnosticó mal y el arreglo que proponía —tocar ~50
sitios de uso de `PressableScale`— habría sido trabajo tirado.** Queda escrito
aquí porque la hipótesis era convincente y volverá a serlo.

Se reprodujo en el emulador contra el APK instalado y se midió con
`adb shell uiautomator dump`, que da los límites reales de cada vista:

| nodo               | antes         | después   |
| ------------------ | ------------- | --------- |
| tarjeta del panel  | 278..**2211** | —         |
| pie (`footer`)     | h=**81**      | h=**151** |
| botón «Limpiar»    | h=**51**      | h=**121** |
| etiqueta «Limpiar» | h=**21**      | h=**61**  |

Todo terminaba exactamente en 2211, que es el borde de la tarjeta: **el pie se
salía del panel y Android lo recortaba**. Los botones quedaban partidos por la
mitad; con menos sitio o una fuente más grande se recortan a nada y dejan de
poder pulsarse. Eso es lo que se veía como «el panel no responde».

**Por qué el tope estaba en el sitio equivocado.** `Sheet` ponía `maxHeight` en
la tarjeta y `flexShrink: 1` en el cuerpo, esperando que cediera el cuerpo. No
cedía: el cuerpo casi siempre es un `ScrollView`, cuya altura la fija su
contenido, así que quien acababa cediendo era el pie. Ahora **el tope lo lleva el
cuerpo**, que es lo único que sabe desplazarse, y la cabecera y el pie se miden
con `onLayout` y se restan. Su altura deja de ser negociable.

**Lo que se descartó, con evidencia:**

- `PressableScale` funciona. Se pulsó «Una visita» en «Registrar» y navegó.
- La X de los paneles funciona, y además **es un `Pressable` normal**, no un
  `PressableScale` — por sí solo eso ya desmontaba la hipótesis.
- `useAnimatedStyle` corre en el hilo de UI y **no provoca render**, así que no
  podía estar reiniciando el estado de pulsación.

Lección de método: `uiautomator dump` da medidas, no impresiones, y distingue
«no llega el toque» de «la vista mide la mitad». Es lo que había que hacer antes
de refactorizar 50 ficheros sobre una corazonada.

### 🔴 El sync como copia de seguridad — dos fallos silenciosos, corregidos

El motor push/pull estaba mucho más completo de lo que parecía (bandeja de
salida, cursores, LWW, traducción uuid↔id, lápidas, uniones). Lo que fallaba no
era el mecanismo sino dos cosas que **no daban ningún error**:

1. **El pull paginaba por el reloj del cliente.** El cursor era
   `max(updated_at)`, y `updated_at` lo escribe el móvil que editó. Con dos
   dispositivos bastaba un desfase de minutos para que las filas del segundo
   llegaran con una fecha anterior al cursor del primero y **el primero no las
   bajara nunca**. Migración **0017**: secuencia `sync_seq` sellada por trigger;
   `updated_at` se queda solo para decidir qué versión gana. El pull además
   pagina (antes pedía la tabla entera en una respuesta).

2. **Restaurar en un móvil vacío se caía, y sin fotos.** Dos fallos encadenados:
   `images.path` es `not null` y no se sincroniza (es la ruta _de este_
   teléfono), y nadie la rellenaba al insertar una fila que llegaba del
   servidor → `NOT NULL constraint failed: images.path`. Como `images` es la
   última tabla escalar, ese error tumbaba el final del pull y la restauración
   se quedaba **también sin uniones** (etiquetas, platos por visita, personas),
   con cada sync terminando en error. Y aunque no se hubiera caído: **no existía
   ninguna ruta de descarga de fotos**, así que el diario volvía con todas las
   fotos rotas.

Los dos llevan test de regresión **verificado reintroduciendo el fallo**. El
primero costó dos intentos: la primera reintroducción no era fiel (el fake y el
motor compartían la suposición equivocada, así que el test pasaba con el bug
puesto) — reintroducir mal es indistinguible de un test que no sirve.

Nuevo `sync-status`: compara los conteos de los dos lados y dice qué falta por
subir y por bajar. «Última sincronización correcta» dice que el proceso no
falló, no que la copia esté completa.

### ✅ Elegir quién manda cuando hay dos diarios

Último hueco del sync, ya cerrado. Tres salidas: **combinar** (lo de siempre,
recomendada), **que mande la nube**, **que mande este móvil**.

- **La comprobación va antes del primer sync**, y ese orden no es reversible:
  sincronizar primero ya combina, y preguntar después sería preguntar por algo
  que ya pasó.
- **Solo se pregunta cuando la respuesta no es obvia**: hacen falta filas a los
  dos lados _y_ cambios locales sin subir. Un móvil vacío que entra en una
  cuenta con diario solo puede querer restaurar.
- **Copia de seguridad automática antes de vaciar.** `docs/09` la pedía desde el
  principio y nunca se hizo; aquí sí, y no es opcional.
- **Lo que se retira de la nube va como lápida, no como `delete`.** Un borrado a
  secas reaparecería en el siguiente push del otro móvil, que sigue teniéndolo y
  no sabe que fue a propósito.
- Navegar es cosa de `SyncRunner`, no del hook: `useSync` se monta en dos sitios
  y un `router.push` ahí dentro abriría la pantalla dos veces.

### Migraciones: aplicadas y verificadas

> **Al día de la ronda 5 esto se queda en 17 de 19.** La **0018** y la **0019**
> están escritas y verdes contra una base desechable, pero **no aplicadas al
> proyecto real**: hasta que se haga `supabase db push`, las tres clases nuevas
> de aviso no existen en el servidor.

**0015, 0016 y 0017 están aplicadas en el proyecto real** y comprobadas, no solo
empujadas: `supabase migration list --linked` da 17/17 con `local` = `remote`, y
`supabase db diff --linked` **no muestra ninguna deriva estructural** (si
faltaran `sync_seq`, sus triggers o las tablas nuevas, saldrían aquí).

Los `NOTICE ... trigger does not exist, skipping` de 0017 son esperados: salen
del `drop trigger if exists` la primera vez que corre, puesto a propósito para
que la migración se pueda reaplicar.

El diff sí muestra cientos de `grant … to anon/authenticated/service_role`: es
ruido conocido de la herramienta —Supabase los concede por defecto a toda tabla
de `public` y la base desechable con la que compara no los reproduce—. Lo que
protege esas tablas es RLS, activado en todas.

> **El primer sync tras 0017 baja el diario entero una vez.** Los cursores
> guardados son fechas ISO; `Number()` de eso da `NaN` y `sync_seq > NaN` no
> devolvería nada, o sea que el móvil dejaría de bajar cambios para siempre. Un
> cursor que no es número se trata como «no hay cursor». Volver a aplicar filas
> que ya tienes es inofensivo; no volver a mirarlas, no.

**Sin verificar contra servicios reales:** la descarga de fotos, la comparación
y la pantalla de conflictos necesitan sesión y Worker, y el emulador está en
`OFFLINE_MODE` y sin sesión. La lógica de las tres tiene tests; el camino real
(Worker + R2 + token) no se ha ejercitado nunca.

### Bugs pendientes, del uso real

1. **Memoria: 1–2 GB.** Resultó ser **dos problemas**, y el diagnóstico original
   estaba equivocado. [docs/16](16-memoria-e-imagenes.md) se reescribió entero.
   - **El disco: arreglado.** No era el tamaño de las fotos: eran **copias del
     diario entero que nadie borraba**. Cada exportación dejaba un zip de ~200 MB
     con un nombre distinto —un zip no comprime JPEG— y ningún `deleteAsync` del
     repo apuntaba a él; la app olvidaba incluso dónde los había dejado. Más la
     copia previa a importar, un diario completo en caché que solo se borraba al
     empezar la _siguiente_ importación (y la migración de la v1 es una
     importación, así que llevaba ahí desde el primer día). El `setTimeout` de 24
     horas que debía limpiarla no se ejecutó nunca: el temporizador muere con el
     proceso.
   - **La RAM: abierta.** Medido **1,0 GB de `TOTAL PSS`** con 500 MB de native
     heap y ya tirando de swap. Real, pero es otro asunto. El plan está en
     docs/16 §2, ordenado por coste y **con el aviso de medir antes de construir
     miniaturas**: la cuenta de los «48 MB por foto» solo vale si nadie
     submuestrea, y Glide submuestrea al tamaño de la vista.
2. ~~**«con 1 persona»** en Amigos y Contigo~~ — **cerrado en la ronda 4**, ahora
   dice «con Irene y Moni».
3. ~~**Cambiar la foto de perfil**~~ — **cerrado en la ronda 4**.
4. ~~**Tap en nombre/foto → perfil**~~ — **cerrado**: se reportó roto y funciona
   contra esta rama; lo que se probó en el móvil era un APK anterior.

O sea que de esta lista **solo queda la memoria**. Los tres de abajo se dejan
tachados y no borrados porque «esto ya lo arreglamos» es justo lo que hay que
poder comprobar cuando alguien lo vuelve a reportar desde un APK viejo.

### Lo cerrado en esta sesión (26 de julio)

> ⚠️ **El trabajo está en la rama `fix/sync-como-copia-y-notificaciones`, no en
> `main`.** Seis commits. Falta fusionarla.

Verde: TypeScript en 0, **274 tests** de app, lint sin avisos, y las aserciones
SQL en verde con dos ficheros nuevos (`notifications.test.sql` y
`sync-cursor.test.sql`).

- **El pie de los paneles** — arriba. Verificado midiendo en el emulador.
- **La sección de fotos duplicada al editar.** Era literal: `ImagesUploader`
  aparecía dos veces. Pasaba **también en editar restaurante**; visitas estaba
  bien.
- **Fotos de compartidos con el visor.** La portada, las del carrete y las de
  cada plato abren el `ImageLightbox`, todas en la misma lista para poder
  deslizar entre ellas. Antes se veían recortadas a 4:3 o a un cuadrado de 150 y
  no había forma de verlas enteras: la misma foto se comportaba distinto según
  quién la hubiera hecho.
- **El texto del feed.** La frase «X estuvo en Y» iba a una línea y se cortaba
  justo en el dato que se venía a leer. Ahora dos.
- **Una etiqueta abre la puerta por sí sola** (migración **0015**). Etiquetar en
  una comida privada no hacía nada: la persona salía en la lista de
  participantes y no se enteraba nunca. `visibility` reparte a un público;
  escribir el nombre de alguien nombra a un destinatario. **El feed no cambia**
  — `feed_page` sigue exigiendo `is_shared` —, así que la visita privada llega a
  «Contigo» y no se cuela en el feed de nadie. Con aserciones de seguridad para
  las dos mitades.
- **Notificaciones al etiquetar** (migración **0016**): tabla `notifications`,
  trigger, RPCs, campana con punto en el Feed y pantalla **Novedades**.
- **El sync como copia de seguridad**, arriba: 0017, descarga de fotos,
  `sync-status` y la pantalla de conflictos.

### Notificaciones: qué está hecho y qué no

- **Hecho y probado en SQL:** la tabla, el trigger, `notifications_page`,
  `unread_notifications`, `mark_notifications_read`. Un índice único hace el
  trigger **idempotente**, que no es un detalle: el móvil de quien etiqueta
  reenvía el conjunto completo de participantes en cada sync, así que sin él el
  aviso reaparecía en cada pasada.
- **Hecho, sin probar con datos reales:** la pantalla y la campana. El emulador
  está en `OFFLINE_MODE` y sin sesión, así que solo se pudo ver el estado vacío.
- **Push: el reparto está en [docs/15](15-notificaciones-push.md).** La parte del
  autor ya está hecha: proyecto de Firebase (`complete-welder-452606-k5`), app de
  Android con el paquete correcto, `google-services.json` en el repo y enlazado
  desde `app.config.js`, y la clave de cuenta de servicio en `.gitignore`
  (verificado: **nunca ha entrado en el historial**, y el `google-services.json`
  no lleva marcadores de cuenta de servicio).

  **Sin confirmar:** que la clave esté subida a EAS (`eas credentials`). Es lo
  primero que hay que mirar al retomar.

  > ~~**Falta todo el código.**~~ **Desactualizado desde la ronda 3.** El código
  > está entero a los dos lados —`expo-notifications`, el permiso, el registro
  > del token y el envío en el Worker— y en la ronda 5 se le añadieron tres
  > clases más. Lo que sigue faltando es **reconstruir el APK**: es un módulo
  > nativo, no una recarga de JavaScript.

  Las credenciales FCM **no van por perfil de build**: cuelgan del identificador
  de aplicación, y `BUNDLE_ID` es una constante, así que una sola subida cubre
  `preview` y `production`. No hay que duplicarlas.

### Verificaciones que dependen del dispositivo

- El **orden en Android** del peek (`elevation` en `PeekOverlay`).
- El **arrastre hacia abajo** para cerrar paneles.
- El **parpadeo en vista calendario** (`removeClippedSubviews={false}`).
- **Novedades con datos de verdad**: que llegue el aviso al etiquetar desde otra
  cuenta y que el punto se apague al entrar.
- **El sync con dos dispositivos**: registrar en cada uno y ver que aparece en el
  otro. Es el caso que antes fallaba en silencio.
- **La descarga de fotos y `sync-status`** con sesión y Worker de verdad.
- **La pantalla de conflictos**, que no se llegó a ver en pantalla (ver abajo).

### 🛠️ Cómo probar en el emulador (esto costó media sesión)

- El APK instalado en el emulador **es ahora una build de debug** puesta encima
  de la release, con la misma clave de firma — los datos siguen intactos. Se
  conecta a Metro: `npx expo start --dev-client` + `adb reverse tcp:8081 tcp:8081`.
- **`adb shell screencap` no es fiable** con la superficie de React Native en
  dev: devuelve negro con la app perfectamente pintada. Se perdió bastante rato
  creyendo que la app no arrancaba. `adb shell uiautomator dump` sí funciona
  siempre, y además da **medidas reales**, que es como se cazó el bug del pie.
- **`IntentHandler` se traga la URL de arranque del dev client.** Ve
  `restaurantapp://expo-development-client/?url=…`, la trata como un fichero
  `.restoshare` y navega a importar, que falla con «Invalid format». La app se
  queda ahí y parece colgada en el splash. **Solo pasa en dev** — la release no
  arranca con esa URL, por eso nunca se ha visto en el móvil. Arreglo: que
  `IntentHandler` ignore el esquema `expo-development-client`. Es lo que impidió
  ver la pantalla de conflictos.
- El emulador se quedó **sin espacio** al instalar (`INSUFFICIENT_STORAGE`);
  `adb shell pm trim-caches 2000M` liberó lo suficiente.
- Está en `OFFLINE_MODE=true` y sin sesión, así que todo lo social y lo de sync
  solo enseña estados vacíos.

### Deuda anotada

- **Tarea #32: copia de seguridad automática antes de migrar.** Sigue sin
  hacerse **para las migraciones**, que es lo que `docs/09` pedía desde el
  principio; la copia manual antes de instalar sigue sin ser opcional. Lo que sí
  existe ya es la copia automática antes de vaciar el diario en la pantalla de
  conflictos, con el mismo `BackupService` — o sea que la pieza está y falta
  engancharla al arranque de las migraciones.
- **Docs sin repasar:** 00, 01, 04, 07, 08, 10, 12 y README. Los repasados
  (02, 03, 05, 06, 09, 11, 13, 15, ESTADO) ya dicen lo que hace el código.
- **`lint:compiler`**: 83 avisos de React Compiler readiness, fuera de la puerta
  principal a propósito. Ver `docs/12`.

- **🔧 `packages/shared` rompe `npm run check` desde la raíz.** El paquete existe
  con `package.json` y `tsconfig.json` pero **sin `src/`**, así que sus tres
  scripts fallan: `typecheck` con `TS18003` («No inputs were found»), `test:ci`
  con «No test files found, exiting with code 1» y `lint` con «couldn't find an
  eslint.config».

  Comprobado en la ronda 5 que **falla igual con el árbol limpio** (`git stash` y
  a correr): es anterior, no una regresión. Las rondas que declararon «verde»
  corrían los workspaces por separado sin darse cuenta, y por eso la puerta
  principal del repo lleva tiempo roja sin que nadie lo notara.

  Dos salidas, y la buena depende de si el paquete va a tener código: o se le
  pone un `src/index.ts` —el README lo describe como los schemas zod compartidos
  entre `mobile` y `api`, así que en algún momento lo tendrá—, o se le quitan los
  tres scripts hasta entonces. Lo que no puede quedarse es como está, porque
  entrena a no mirar el resultado de `npm run check`.

- **🔧 Diez ficheros sin formatear** que `format:check` marca desde antes de la
  ronda 5: `docs/02`, `05`, `06`, `09`, `11`, `12`, `13`, `package.json`,
  `apps/mobile/google-services.json` y `supabase/scripts/reset-device.md`. Un
  `prettier --write .` los arregla; se dejó para un commit propio porque mezclado
  con trabajo real vuelve el diff ilegible.

### Guiones de mantenimiento

`supabase/scripts/` — vaciar una cuenta en la nube (`reset-account.sql`,
verificado contra una base real) y el móvil (`reset-device.md`). Van juntos: si
solo se vacía uno, el otro lo repuebla en el siguiente sync.

## Estado global

Leyenda: 🟢 código completo y testeado · 🟡 código escrito, necesita servicio/dispositivo para verificarse · ⬜ pendiente.

| Fase                    | Estado                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentación de diseño | ✅ Completa (docs 00–16)                                                                                                                                                                                 |
| 0 — Puesta a punto      | ✅                                                                                                                                                                                                       |
| 1 — Esquema local       | ✅ Migraciones 0007–0010 verificadas contra una base v1 poblada                                                                                                                                          |
| 2 — Supabase + Auth     | ✅ Google OAuth funcionando en dispositivo                                                                                                                                                               |
| 3 — Sync                | 🟡 Filas y uniones sí. **La bajada de fotos y el caso de dos dispositivos nunca se habían probado**, y los dos estaban rotos (ver arriba); corregidos y con tests, sin verificar contra servicios reales |
| 4 — Worker / Share      | ✅ Desplegado; R2 sirviendo fotos                                                                                                                                                                        |
| 5 — Social              | ✅ Amigos, feed, perfiles, etiquetado y bandeja «Contigo»                                                                                                                                                |
| 6 — UI                  | ✅ Rediseño completo                                                                                                                                                                                     |
| 7 — Asistente IA        | 🟡 Tools de consulta testeadas · agente/voz/embeddings pendientes · **apagado en la 2.0.0** (`lib/features.ts`)                                                                                          |

**Verificación transversal en cada commit:** TypeScript en 0, **345 tests** (109 app-mobile + 200 node-mobile + 36 worker) más **121 aserciones SQL** (`npm run db:test`), `npm run lint` sin errores ni warnings, bundle Android.

## Primer despliegue — v2.0.0

Para instalar **encima de la v1.3** en un móvil. La IA queda fuera de esta versión. Procedimiento y checklist en [13](13-despliegue.md).

- `versionCode` 2 (la v1.3 salió con 1; sin subirlo, Android rechaza el APK).
- Mismo paquete, slug, proyecto EAS y nombre de base de datos → actualización en sitio, conserva diario y fotos.
- El APK debe ir firmado con la misma clave que la v1.3: `eas credentials -p android`.
- `EXPO_PUBLIC_*` declaradas en EAS; `app.config.js` rompe la build si faltan.
- Migraciones de Supabase hasta la **0014** aplicadas.

**Pendiente antes de considerarlo cerrado:** no existe copia de seguridad automática antes de migrar (ver [09](09-migracion-datos.md)). La copia previa es manual y está en el checklist.

## Auditoría (julio 2026) — 7 bugs reales corregidos

Repaso en frío de todo lo escrito. Cada corrección lleva su test de regresión, verificado reintroduciendo el bug:

1. **Pérdida de datos en sync**: `push` marcaba `synced` con un UPDATE global, tragándose los cambios encolados _durante_ el push. Ahora marca por id lo realmente enviado.
2. **Sync concurrente**: `useSync` se monta dos veces (SyncRunner + pantalla de cuenta) y el guard era por instancia → dos pases a la vez. Estado movido a un store de módulo (`syncStore`) con `useSyncExternalStore`.
3. **Escapado LIKE inefectivo**: SQLite ignora el escape sin cláusula `ESCAPE`, que `like()` de drizzle no emite. Un plato "Menú 100%" era inencontrable. El test viejo pasaba por la razón equivocada.
4. **Seguridad en el Worker**: la allowlist pública ignoraba el método HTTP → `DELETE /images/:u/:id` saltaba la auth (404 en vez de 401). Ahora es `{method, pattern}`, con tests de frontera.
5. **Sesión**: guardar cadena vacía devolvía `null` al leerla. `secureStorage` gana 7 tests (round-trip, sin fugas de chunks, escritura rota = ausente).
6. **OAuth roto**: se usaba `exchangeCodeForSession` (PKCE) pero supabase-js viene con `flowType: 'implicit'` por defecto → el login con Google **nunca** habría funcionado. Fijado a `pkce`; el parseo del callback sale a un helper testeado (`URL` no es fiable con esquemas custom en RN).
7. **Claves de Supabase al día** (ver abajo).

### Supabase: claves y firma de JWT (actualizado)

- Las claves legacy `anon`/`service_role` se retiran a lo largo de 2026 → usar **publishable** (`sb_publishable_…`) y **secret** (`sb_secret_…`). Las secret **no son JWT**: van en `apikey`, nunca en `Authorization: Bearer` (corregido en `shareStore`).
- Los proyectos creados desde **octubre de 2025 firman con claves asimétricas** (ES256/RS256) y publican las públicas en el JWKS del proyecto. El Worker verificaba con HS256 y un secreto compartido: **habría rechazado todos los tokens de un proyecto nuevo**. Ahora verifica vía JWKS con respaldo HS256 para proyectos antiguos, así que **no necesitas `SUPABASE_JWT_SECRET`**.
- Secret del Worker renombrada a `SUPABASE_SECRET_KEY`. Detalles en [13 §3–4](13-despliegue.md).

### Riesgo conocido: sin transacciones

Los repositorios escriben la fila y su entrada de `change_log` por separado. No se pueden usar transacciones agnósticas del driver (con better-sqlite3 un callback `async` en `transaction()` **crashea el proceso**; comprobado). Mitigación: `linkLocalData` (una consulta `NOT EXISTS` por tabla) corre al inicio de cada push y reencola cualquier fila sin entrada, convirtiendo una divergencia permanente en consistencia eventual. Cubierto por test.

---

---

---

---

## Feedback en dispositivo, ronda 2 (25 de julio de 2026)

Verde: TypeScript en 0, **169 tests** + 24 del worker + 39 aserciones SQL, lint sin errores, `expo export` compila.

### Resuelto

| Tu nota                                          | Qué pasaba de verdad                                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los filtros dejaron de funcionar                 | `groupByMonth` ordenaba siempre de más nuevo a más viejo e ignoraba el orden elegido. Además el filtro por etiquetas era UI muerta en Visitas: no tienen etiquetas            |
| El mes no cubre la vista al hacer scroll         | El margen horizontal vivía en el `contentContainer`, así que la cabecera fijada quedaba metida hacia dentro y las fotos pasaban por los lados                                 |
| Solo imágenes en la línea de tiempo              | Dos columnas con nombre y fecha. Un muro de fotos es bonito e imposible de buscar                                                                                             |
| No se puede valorar algo creado sin valoración   | Bug de v1: `RatingStars` pintaba «Sin calificación» como texto también en edición, así que no había estrellas que pulsar. De paso, pulsar la valoración actual ahora la quita |
| Las tarjetas cambian de tamaño con/sin estrellas | Alto reservado siempre                                                                                                                                                        |
| El mapa se centra en Medellín                    | Nuevo `useCurrentRegion`. **No pide permiso** — pedir ubicación solo para centrar un mapa es de mala educación — solo actúa si ya está concedido                              |
| Swipe up/down para salir de la foto              | Ya existía pero estaba muerto por el problema del Modal. Ahora además descarta por velocidad y encoge la imagen al arrastrar                                                  |
| El icono de la app en Inicio                     | Hecho                                                                                                                                                                         |
| Añadir etiquetas es terrible                     | Era: pulsar `+`, esperar modal, buscar, cerrar, comprobar. Ahora las que más usas están en línea como chips                                                                   |
| Las fotos y «los 2 botones feos»                 | Eran dos botones grises y cada foto a ancho completo con un botón rojo debajo. Ahora tira de miniaturas con su × y una hoja para cámara/galería                               |
| Añadir restaurantes es terrible                  | Era un `Picker` nativo: sin búsqueda, sin foto, inservible con cientos de sitios. Ahora fila con lo elegido + hoja con buscador y «crear uno nuevo» dentro                    |

### Resuelto después (misma sesión)

- **`DishPicker`**: los platos que ya tiene el restaurante aparecen como chips a un toque. Casi toda visita repite algo que ya has comido allí, así que el caso común no debería exigir abrir nada.
- **El mapa**: buscador sobre tus lugares —antes solo se podía desplazar a mano— y marcadores propios con el color de la app y su valoración. El pin rojo por defecto hacía tu diario indistinguible de los puntos de interés que pinta Google.
- **La fecha de una visita**: chips «Hoy / Ayer / Anteayer» en vez de abrir siempre el calendario, y tope en la fecha de hoy.

Se retiran tres componentes que ya no usa nadie: `DishSelectorModal`, `TagSelectorModal` y `TagItem`.

### 🔜 Lo que sigue abierto

**«Armonía» en detalle y creación.** Es lo más subjetivo de tu feedback y lo que menos he cerrado. Los formularios ya no son una lista plana de campos y los tres selectores que llamabas terribles están resueltos, pero el _orden_ de un formulario de visita sigue siendo el de las columnas de la base de datos, no el de cómo se registra una comida. Idea concreta pendiente: **empezar por la foto**, que suele ser lo que acabas de hacer, para que se lea como una entrada de diario y no como un alta.

---

## Rediseño visual: cerrado (25 de julio de 2026)

Verde: TypeScript en 0, **159 tests** de app + 24 del worker + **39 aserciones SQL**, lint sin errores, `expo export` compila.

Cubierto: sistema de diseño, navegación, Inicio, Diario (las tres listas), Feed, Perfil, amigos, búsqueda, filtros, etiquetas, peek, detalles, formularios y ajustes. Detalle en [docs/14](14-diseno.md).

### Dos fallos que llegaron al dispositivo

- **La app abría en «página no encontrada».** `app/index.tsx` seguía redirigiendo a `/restaurants` tras reestructurar las pestañas. La causa de fondo: expo-router toma las rutas como cadenas y nada las comprueba. Nuevo `lib/__tests__/routes.node.test.ts` que valida cada destino contra el árbol de rutas.
- **Ese mismo test tiró el bundle.** Lo puse dentro de `app/`, y expo-router arrastra todo lo que hay ahí con `require.context`: acabó empaquetado en la app intentando importar `node:fs`. Compilaba, pasaba en Jest, y rompía el arranque. Movido a `lib/`, con `app-directory.node.test.ts` para que no vuelva a pasar.

### Cosas que se descubrieron al rediseñar

- **El filtro por restaurante en Platos era UI muerta**: el panel lo ofrecía y la lista nunca lo consumía, porque `DishListDTO` ni siquiera trae el restaurante. Ahora esa sección solo aparece en Visitas.
- **El detalle de plato fingía una pestaña** «Detalles» con un subrayado pintado a mano.
- **Editar una visita usaba `router.replace`**, así que al volver desde la edición te saltabas la visita que acababas de mirar.
- **El peek pintaba las fotos con `contentFit="contain"` sobre gris**, así que toda imagen que no fuera 4:3 salía con bandas.

### 🔜 Siguiente

1. **Reintentar el login con Google** y pasarme el mensaje. Sigue bloqueando todo lo online.
2. **Aplicar las migraciones 0005, 0006 y 0007**, y correr `npm run db:test`.
3. Sync de las tablas puente (`restaurant_tag`, `dish_tag`, `dish_visit`, `visit_participant`).
4. IA: el hueco ya está en el buscador de Inicio; falta el agente, la voz y los embeddings.

### Pendientes menores

- **Etiquetar personas en una visita funciona, pero la persona no se muestra tras crearla.**
- **Swipe entre pestañas**: sigue sin estar (SDK 56 prohibió los navegadores a mano).
- La moneda de los precios está fijada a COP en el detalle de plato.
- `jszip` sigue en `dependencies` aunque solo lo use un test.
- 79 avisos de lint por _React Compiler readiness_; el compilador no está activado.

---

## Sesión del 25 de julio de 2026

Verde: TypeScript en 0, **121 tests** de app + 24 del worker + **39 aserciones SQL**, lint sin errores, `expo export` compila.

### Cerrado

**Paleta fuera de los puntos de uso.** Los ~150 ternarios `isDarkMode ? '#x' : '#y'` repartidos por 30 ficheros pasan a tokens. Quedan dos usos de `isDarkMode` y ninguno es un color: el estilo de la barra de estado y el icono luna/sol. De paso salieron a la luz: `MapLocationPicker` mantenía su **propia** paleta local llamada `colors`, y `SegmentedTabs` seguía con clases que ya no existían (se habría quedado sin fondo).

**🔴 Los gestos del visor de imágenes estaban muertos.** El pinch y el doble tap no respondían, pero la causa no era la composición de gestos: el visor vive dentro de un `Modal` de React Native, que renderiza en su propia jerarquía nativa, **fuera** de la raíz a la que se engancha gesture-handler. Todo gesto declarado ahí dentro es inerte, sin error ni aviso. Eso explica el síntoma exacto: seguía funcionando la X (un `Pressable`) y deslizar entre fotos (scroll nativo). Arrastrar para cerrar tampoco funcionaba. `FilterSortModal` ya lo hacía bien, así que el patrón se conocía y el visor era la única omisión. Hay test estructural que lo impide en el futuro.

**Perfil propio editable y perfil de otras personas** (migración 0007). La decisión de cuánto se ve la toma el servidor: un desconocido recibe solo lo público, un amigo también lo marcado para amigos, y la biografía solo viaja si hay amistad.

**Rediseño visual.** Ver [docs/14](14-diseno.md). Sombras cálidas, escala tipográfica, `PressableScale`, `FadeInUp`, `Skeleton`, barra de pestañas flotante, control segmentado, Inicio rediseñado, filas de lista y etiquetas, cabecera y FAB compartidos por las tres colecciones.

### Notas de proceso

El runner de SQL da ahora **una base de datos limpia a cada fichero de test**. Compartirla hacía que las altas de un fichero se colasen en los conteos del siguiente — un fallo por motivos ajenos al código, y lo que es peor, también un aprobado por ellos.

Dos tests míos fallaron al verificarlos, y las dos veces el test tenía razón:

- La aserción del visor usaba `toContain('GestureHandlerRootView')` y **pasaba con el bug reintroducido**, porque `GestureHandlerRootViewX` contiene esa subcadena. Ahora exige el elemento JSX.
- El contraste de las etiquetas suponía que luminosidad HSL era luminancia percibida. No lo es.

### 🔜 Siguiente

1. **Reintentar el login con Google** y pasarme el mensaje nuevo. Sigue bloqueando todo lo online.
2. **Aplicar las migraciones 0005, 0006 y 0007**, y correr `npm run db:test`.
3. Rediseño de las pantallas que faltan: detalles (restaurante, plato, visita), formularios de alta y edición, ajustes, mapa.
4. Sync de las tablas puente (`restaurant_tag`, `dish_tag`, `dish_visit`, `visit_participant`).
5. IA: aparcada a propósito hasta el final.

### Pendientes menores

- **Etiquetar personas en una visita funciona, pero la persona no se muestra tras crearla.** Confirmado en dispositivo; acordado dejarlo para el rediseño de la sección de amigos.
- **Swipe entre pestañas**: sigue sin estar (SDK 56 prohibió los navegadores a mano).
- `jszip` sigue en `dependencies` aunque solo lo use un test.
- 81 avisos de lint por _React Compiler readiness_; el compilador no está activado.

---

## ⏸️ Pausa del 24 de julio de 2026 — dónde retomar

Trabajo detenido a petición tuya a mitad del refactor visual. **El repo queda verde**: TypeScript en 0, 95 tests de app + 24 del worker, lint sin errores. Nada a medio aplicar.

### Lo que se cerró en esta sesión

**1. Capa social en Supabase (migraciones 0005 y 0006) — cerrada y probada de verdad.**

Encontré tres agujeros que impedían que el sistema de amigos existiera:

- **`profiles` estaba siempre vacía.** La tabla existía desde 0001 con su RLS, pero _nadie insertaba nunca una fila_: al registrarte no se creaba perfil, así que no había a quién buscar ni cómo saber quién hizo qué en el feed. 0005 añade el trigger de alta, el backfill de cuentas existentes, unicidad insensible a mayúsculas e índice de búsqueda por prefijo.
- **El trigger no puede propagar excepciones.** Si un trigger sobre `auth.users` falla, Supabase rechaza el registro entero con _"Database error saving new user"_ y la cuenta queda inaccesible para siempre. Traga el error y deja `ensure_profile()` como reparación desde el cliente.
- **🔴 SEGURIDAD: la vista `feed` de 0004 filtraba datos de todos los usuarios.** Una vista de Postgres se ejecuta con permisos de _quien la creó_ salvo que declare `security_invoker`, así que las políticas RLS de `visits`/`dishes`/`restaurants` **nunca se evaluaban**: cualquier usuario autenticado veía las filas `friends`/`public` de cualquier otro, sin ninguna amistad de por medio. Verificado reintroduciendo el bug — con la definición antigua un desconocido veía 2 filas ajenas; ahora ve 0.

0006 añade las RPC que consume la app (búsqueda de usuarios, solicitudes, feed paginado ya denormalizado), en `security definer` y revocadas de `public` para que la clave anónima no las alcance.

**Nuevo `npm run db:test`**: levanta una base de datos desechable en el contenedor local de Supabase, aplica las 6 migraciones desde cero sobre un stub de `auth`, y corre **26 aserciones** sobre el comportamiento real (perfiles automáticos, desduplicado de nombres, quién puede aceptar una solicitud, solicitudes cruzadas, y la regresión de la fuga). Necesita `supabase start` en marcha.

**2. Sistema de diseño Clay.** Importado del proyecto de Claude Design. Paleta única en `lib/design/tokens.ts` (arcilla/papel, terracota como único acento, ámbar para valoraciones, salvia para categorías), tipografías Newsreader + Plus Jakarta Sans.

El cambio estructural: los colores viven ahora en variables CSS (`global.css`), así que **una sola clase vale para claro y oscuro**. Eso elimina el `dark:` gemelo que colgaba de cada elemento (350 clases) y los ternarios `isDarkMode ? '#x' : '#y'` repartidos por 30 ficheros. `tokens.node.test.ts` falla si el CSS y el TypeScript se desincronizan.

De paso arregla un bug latente: `darkMode: 'class'` estaba configurado pero **nadie llamaba nunca a `colorScheme.set()`**, así que elegir "oscuro" en ajustes con el móvil en claro dejaba media pantalla sin cambiar. `ThemeContext` ya lo conecta.

**3. Nueva navegación y pantallas nuevas.** Cinco pestañas: **Inicio · Feed · Lugares · Platos · Perfil**. Visitas y Etiquetas dejan de ser pestañas y pasan a pantallas completas (desde Inicio y Perfil respectivamente) — nada se pierde, quedan a un toque. Cabecera nueva con chevron y título propio de cada pantalla, en lugar del logo centrado que no decía dónde estabas.

Escritas de cero: `Inicio` (saludo, buscador, contadores, visitas recientes, acciones rápidas), `Feed`, `Perfil`, `Amigos` y `Buscar personas`, más los primitivos `Button`, `Card`, `Chip`, `Avatar`, `Thumbnail`, `Screen`, `EmptyState`, `SectionHeader`.

**4. Login OAuth — diagnóstico.** El `oauth-code-missing` que viste era **un mensaje mío que tiraba a la basura la URL de vuelta**, justo donde está el diagnóstico. Además solo contemplaba una de las tres formas en que puede responder Supabase. Ahora `parseOAuthCallback` distingue código PKCE, tokens en el fragmento (flujo implícito, que antes fallaba pudiendo funcionar) y errores del proveedor, y `AuthContext` maneja las tres. **La causa raíz sigue sin confirmarse**: al reintentar el login, el mensaje dirá exactamente cuál de los tres casos es.

### 🔜 Por dónde seguir, en orden

1. **Reintentar el login con Google** y pasarme el mensaje de error nuevo. Desbloquea todo lo online.
2. **Aplicar las migraciones 0005 y 0006** (`supabase db reset` o `supabase db push`), y correr `npm run db:test`.
3. **Terminar el refactor visual** — es lo único a medias. Las clases de paleta ya están migradas en los ~50 ficheros de pantallas, pero quedan **28 ficheros que aún eligen colores a mano con `isDarkMode ? '#hex' : '#hex'`** para props (iconos, mapas, indicadores). Funcionan y se ven bien, pero usan la paleta vieja, así que conviven dos gamas. Hay un script preparado con el mapeo hex→token en el scratchpad de la sesión (`decolor.py`), sin ejecutar; se puede rehacer en 10 minutos. Después toca repasar pantalla a pantalla el detalle visual (formularios, detalles, ajustes), que la migración automática deja correctos pero no _rediseñados_.
4. **Perfil editable** (`updateMyProfile` ya existe en `features/social/api.ts`, falta la pantalla) y **perfil de otro usuario** (`app/(main)/friends/[id].tsx` está declarado en el layout pero **el fichero no existe todavía** — navegar ahí daría 404).
5. **Sync de las tablas puente** (`restaurant_tag`, `dish_tag`, `dish_visit`, `visit_participant`): el esquema y el motor lo anticipan, falta traducir uuids de miembros.
6. **IA**: aparcada a propósito hasta el final, como pediste.

### Pendientes menores anotados

- **Etiquetar personas en una visita funciona, pero la persona no se muestra tras crearla.** Confirmado por ti en dispositivo; acordamos dejarlo para el rediseño de la sección de amigos.
- **Visor de imágenes: pinch-zoom y doble-tap no responden** (ver y deslizar entre fotos sí). Probablemente los gestos `Pinch`/`Tap` no están compuestos con el `Pan` del carrusel (`Gesture.Simultaneous`/`Race`). Tarea #16.
- **Swipe entre pestañas**: sigue sin estar; dijiste que no corre prisa y que se re-incluya con el refactor visual si encaja.
- `jszip` sigue en `dependencies` aunque solo lo use un test; debería bajar a `devDependencies`.
- 78 avisos de lint por _React Compiler readiness_ (el compilador no está activado). Workstream aparte.

---

## Qué falta para que sea "todo" (mi parte vs la tuya)

**Solo requieren tus servicios/dispositivo (no más código mío para el camino feliz):**

- Crear proyecto Supabase y aplicar `supabase/migrations/0001–0004` (`supabase db reset`).
- Configurar OAuth Google/Apple en Supabase.
- Desplegar el Worker (`wrangler deploy`), crear bucket R2 y AI Gateway, cargar secrets.
- Rellenar `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` y `EXPO_PUBLIC_API_URL`.
- Verificar en emulador: migración de un usuario existente, sync entre dos dispositivos, share link, y el asistente respondiendo.

**Código mío que aún falta (necesita servicios/dispositivo/diseño para hacerse bien):**

- **Fase 5 UI**: pantallas de perfil, búsqueda/solicitudes de amigos y feed (el esquema y las policies ya están; la UI se construye sobre el diseño de la fase 6).
- **Fase 6**: sistema de diseño e IA de navegación desde el proyecto de Claude Design — necesita importarlo y un dispositivo para iterar visualmente.
- **Fase 7 restante**: agente de registro conversacional ("estoy en Guadalupe con Irene…"), **voz** (STT nativo + Whisper), e **indexación de embeddings** (búsqueda semántica) — todo requiere el Worker AI y/o dispositivo.
- **Sync de tablas de unión** (tags↔restaurante, etc.): el esquema y el motor lo contemplan; falta el paso por miembros-uuid (follow-up de fase 3).

## Fase 1 — cerrada (esquema local + repositorios)

Todo verificado con TS en 0, **38 tests** (22 app + 16 node contra SQLite real), lint sin errores y bundle de 2979 módulos.

- **Estrategia de IDs revisada** (docs/02): PK entero local + columna `uuid` de sync, en vez de migrar el PK a UUID. Migración aditiva de bajo riesgo; la complejidad uuid↔id-local se confina al sync (fase 3).
- **Esquema** (migración 0007): `uuid`/`created_at`/`updated_at` en tablas sincronizables, `visibility`, y tablas `people` / `visit_participant` / `change_log`. La migración que generó drizzle-kit **habría petado en el arranque de cada usuario** (ADD COLUMN con default no-constante); reescrita a ADD COLUMN nullable + UPDATE de backfill. **El harness de test la cazó.**
- **Capa de repositorios** (`features/*/repositories/`): todas las escrituras pasan por aquí y conectan uuid/timestamps/`change_log`. Todas las pantallas migradas a `useDatabase()` — **0 violaciones de la frontera "nada de SQL en pantallas"**.
- **Etiquetado de personas en visitas** (tarea social cimentada): `PeopleTagInput` + `visitRepository.setVisitParticipants`, con creación on-demand y `tagStatus='local'`.
- **Importador**: `.restoshare` v1 se importa con backfill de columnas de sync (bug de uuid NULL corregido); backup completo v1 se cubre vía la migración al remontar; export = backupService v2.

### Deuda anotada de fase 1

- **Aislación cross-feature no enforced por lint**: `no-restricted-imports` no puede expresar "cualquier feature menos el propio". Necesita `eslint-plugin-boundaries` + reubicar piezas compartidas (componente `Tag`, `ImageDTO`/`TagDTO`) a un área común. La frontera de BD (la crítica) sí está enforced.
- **`expo-file-system` API legacy**: sigue en uso; migrar a la nueva API cuando se toque esa ruta.
- **Fixtures congelados de `.restoshare`**: el test de importación usa payloads v1 en código; un archivo `.restoshare` real congelado sería más robusto (polish).

## Hecho

### Repo y monorepo

- Monorepo npm workspaces: `apps/mobile`, `apps/api` (vacío), `packages/shared` (vacío), `supabase` (vacío), `docs`.
- Prettier + tsconfig base estricto compartidos; husky/lint-staged declarados.

### Fase 0 — completado

- **Upgrade SDK 52 → 57 resuelto por scaffolding limpio + port del código**, en vez de encadenar cinco upgrades. Resultado: Expo 57.0.6, React 19.2.3, RN 0.86, expo-router 57.
- ✅ **`expo-doctor`: 20/20 checks.**
- ✅ **La app empaqueta**: `npx expo export --platform android` → 2958 módulos, bundle generado.
- ✅ **Tests: 9 suites / 17 tests en verde** sobre el SDK nuevo.
- **React deduplicado** a una sola versión (19.2.3): npm subía 19.2.7 al root vía peers; se fija con `overrides` + devDependency en la raíz.
- **Nueva arquitectura de RN activada** (`newArchEnabled: true`); la v1 la tenía desactivada.

### Migración de navegación (bloqueante que solo apareció al empaquetar)

Desde **SDK 56, expo-router prohíbe declarar navegadores de react-navigation a mano**, que es exactamente como lo hacía la v1 (expo-router solo en la raíz + `createNativeStackNavigator`/`createMaterialTopTabNavigator` en `(main)/_layout.tsx`). El typecheck y los tests pasaban igualmente: **solo el bundle lo detecta**. Lección: `expo export` es parte de la verificación, no un extra.

Migrado a enrutado por ficheros puro:

- `app/(main)/_layout.tsx` → `<Stack>` de expo-router con el header propio.
- `app/(main)/(tabs)/_layout.tsx` → `<Tabs>` de expo-router; las pantallas de lista se movieron a `(tabs)/{restaurants,dishes,visits,tags}/index.tsx`.
- Las pestañas **internas** de los detalles de restaurante/visita (Detalles/Visitas/Platos) no eran rutas: se sustituyen por `components/ui/SegmentedTabs.tsx`, componente propio. Menos maquinaria y una dependencia menos.
- `@react-navigation/material-top-tabs` **desinstalada**.

⚠️ **Cambio de comportamiento a validar contigo:** se pierde el _swipe_ entre pestañas (era propio de material-top-tabs). Las tabs inferiores ahora son las nativas de expo-router. Como la navegación se rediseña en [fase 6](08-ui.md) de todos modos, no se ha invertido en recuperar el gesto; si lo quieres antes, es trabajo aparte.

### Dependencias retiradas (docs/11)

| Dependencia                      | Sustituida por                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `react-native-image-zoom-viewer` | **Código propio**: `components/media/{ImageCarousel,ImageLightbox,ZoomableImage}.tsx` sobre gesture-handler + reanimated |
| `react-native-webview`           | Ya no hace falta (era dependencia del zoom viewer)                                                                       |
| `react-native-zip-archive`       | `services/backup/zip.ts` con jszip (JS puro)                                                                             |
| `async-storage`                  | `services/db/settings-repository.ts` (tabla `app_settings` de SQLite)                                                    |
| `axios` + auth Railway           | Eliminada; la app es local-first sin login gate                                                                          |

El visor propio incluye: paginado, pinch-zoom con clamp de bordes, doble-tap con foco en el punto tocado, arrastrar para cerrar con fade del fondo, contador. **Sin verificar en dispositivo** (ver bloqueos).

## Historial de calidad (fases 0–1)

### ✅ TypeScript: 0 errores (venían de 133)

Todo el código portado pasa `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. No fue cosmético — salieron bugs reales:

- `exportService` asertaba `dishes[0].restaurantId!`. Un plato o visita sin restaurante (que el esquema permite) habría petado al compartir. Ahora se trata explícitamente.
- `backupService` parseaba los JSON de `app_settings` con un cast. Es un borde no confiable (una versión vieja pudo escribir otra forma): ahora se validan con **zod**.
- Las consultas de restaurantes **no seleccionaban `tags.deleted`** aunque el componente `Tag` lo pinta.
- `FormInput`, `FormDatePicker`, `RestaurantPicker`, `DishPicker` y `RatingStars` usaban `Control<any>`: aceptaban cualquier nombre de campo sin avisar. Ahora son genéricos, con `FieldPathByValue` restringiendo `name` al tipo real del campo.
- `ImportConflictModal` y `importService` usaban `existingEntity!`; ahora hay narrowing real.
- DTOs: `deleted` pasa de opcional a `boolean` requerido, que es lo que dice la BD (NOT NULL DEFAULT false).

### 🟡 ESLint: de 208 errores a 40 errores + 76 avisos

Progreso saldado (todo con TS en 0, 17 tests y bundle verdes en cada paso):

- **47 de promesas eliminadas** (`no-floating-promises` + `no-misused-promises`) — cada una era un fallo que se tragaba en silencio. `void` explícito en fire-and-forget; handlers JSX async permitidos (idiomático en RN, `checksVoidReturn.attributes:false`); botones de Alert envueltos en `void (async …)()`.
- **42 `any` / `unsafe-assignment` eliminadas → 0.** Nuevo `services/places` con validación zod; hooks de Drizzle sin `any` (joins antes del where); `ImagesUploader` con narrowing de la unión discriminada; iconos tipados con `ComponentProps<typeof Ionicons>['name']`; `catch (error: any)` → `unknown`.
- Logs, `clsx` (import nombrado), comillas JSX escapadas, `import/order`: limpiados.

**Estado actual del lint (tras fase 1): 0 errores + 76 avisos.**

- Las 40 de fronteras las **saldó la fase 1** con la capa de repositorios.
- **76 avisos — preparación para React Compiler** (`react-hooks/refs`, `immutability`, `set-state-in-effect`, `incompatible-library`, `preserve-manual-memoization`). **El compiler NO está activado** en `app.config.js` (solo `typedRoutes`), así que no afectan al runtime. Se dejan en `warn` a propósito: workstream propio a saldar con verificación en dispositivo. `rules-of-hooks` y `exhaustive-deps` siguen como error.

### ✅ CI creada

`.github/workflows/ci.yml`: job `verify` (bloqueante) corre `format:check` + `typecheck` + `test:ci` — todo en verde. Job `lint` informativo (`continue-on-error`) mientras queden los 76 avisos del compiler; al saldarlos se vuelve bloqueante.

### ❓ Para decidir tú

`features/visits/schemas/visit-schema.ts` declara `dishes: number[] | string[]`. La rama de strings parece **no intencionada** (los ids de plato son enteros; hoy `["a","b"]` pasaría la validación). No se ha tocado sin tu visto bueno. Si se confirma, se elimina la unión y `DishPicker` recupera un constraint limpio de `number[]`.

## Siguiente paso concreto

1. **Verificación en emulador** (`npm run -w apps/mobile start`) — prioridad máxima, es lo único que falta para cerrar fases 0 y 1. Probar: navegación por tabs, `SegmentedTabs`, **carrusel/visor de imágenes** (pinch, doble-tap, arrastrar para cerrar), **etiquetado de personas** en visita, y sobre todo el **arranque de un usuario existente** (que la migración 0007 haga el backfill sin perder datos).
2. **Fase 2 — Supabase + Auth** ([roadmap](10-roadmap.md#fase-2--supabase--login-opcional)): requiere que crees el proyecto Supabase y el OAuth de Google (ver [13 §3](13-despliegue.md)). El esquema espejo se deriva del schema local ya listo.
3. Workstream de React Compiler (los 76 avisos) cuando haya dispositivo para verificar.

## Bloqueos conocidos

Requieren acción del autor, no son trabajo de código:

- **Emulador/dispositivo**: los módulos nativos y el visor de imágenes nuevo solo se validan ejecutando la app. No se ha podido hacer en esta sesión.
- **Fase 2**: proyecto Supabase + OAuth de Google (y Apple si iOS). Ver [13 §3](13-despliegue.md).
- **Fase 4**: cuenta Cloudflare, bucket R2, decisión de dominio propio.
- **Fase 7**: AI Gateway creado en el dashboard.

## Decisiones abiertas pendientes

| Tema                                            | Doc                         | Cuándo  |
| ----------------------------------------------- | --------------------------- | ------- |
| Migrar a la API nueva de `expo-file-system`     | este doc                    | Fase 1  |
| Precio: entero sin moneda vs con moneda         | [02](02-modelo-de-datos.md) | Fase 1  |
| Dominio propio (~$10/año, único gasto probable) | [05](05-api.md)             | Fase 4  |
| Estructura de navegación definitiva             | [08](08-ui.md)              | Fase 6  |
| Modelo concreto de chat/embeddings del catálogo | [07](07-asistente-ia.md)    | Fase 7a |
| ¿Asistente disponible sin cuenta?               | [07](07-asistente-ia.md)    | Fase 7  |

## Notas de contexto que no están en el código

- El repo v1 (`C:\Universidad\Movil\restaurantapp-application`) es **read-only**: referencia, no se toca.
- El dolor histórico de upgrades venía de las **librerías de imágenes** → de ahí el código propio ([11](11-dependencias.md)).
- Restricción dura: **todo cabe en free tiers**. Ante la duda, se recorta alcance antes que pagar.
- El salto de 5 SDKs se resolvió con scaffolding limpio + port. Si vuelve a acumularse ese retraso, es la estrategia a repetir; mejor aún, actualizar cada release.
