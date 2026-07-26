# 📍 ESTADO — documentación viva

**Última actualización:** 2026-07-26 (tarde)

Punto de entrada al retomar el trabajo: qué está hecho, qué sigue, qué está bloqueado. Se actualiza al cerrar cada bloque de trabajo.

## 🔴 AQUÍ SE RETOMA — 26 de julio de 2026 (tarde)

La v2.0.0 **está instalada y en uso en el móvil del autor**, con datos reales y
cuenta iniciada. Ya no estamos construyendo: estamos corrigiendo lo que aparece
al usarla.

### 👉 Lo siguiente, en orden

1. **Generar un APK nuevo y probarlo.** `expo-notifications` es un módulo
   nativo: el APK instalado no sirve, y sin uno nuevo no se puede verificar
   nada de esta tanda en pantalla. `eas build -p android --profile preview`.
2. **Desplegar el Worker** (`cd apps/api && npx wrangler deploy`). El envío de
   push vive en un cron, y un cron sin desplegar no se dispara. Comprobar que
   el panel de Cloudflare lista **dos** triggers.
3. **Confirmar que la clave FCM está subida a EAS** (`eas credentials`). Es lo
   único bloqueado por terceros, y lo único que queda de
   [docs/15](15-notificaciones-push.md) §1.
4. **Probar el sync con dos dispositivos y sesión iniciada.** Sigue sin
   verificarse contra servicios reales. Empezar por Ajustes → «¿Está todo en la
   nube?»: si algo no cuadra, esa pantalla dice qué falta y en qué dirección.
5. **Arreglar `IntentHandler` con el dev client** (abajo, en cómo probar). Sin
   eso, la app no arranca contra Metro.
6. **Fusionar `claude/sync-multiple-fixes-vzwo8h`.** `main` no tiene nada de
   las dos últimas sesiones.

### 🟢 Lo cerrado en esta tanda (feedback en dispositivo, ronda 3)

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

1. **Memoria: 1–2 GB en caché.** Diagnosticado, sin arreglar. Dos causas:
   `ImagePicker` usa `quality: 0.5` pero **nunca redimensiona**, así que una foto
   de 3000×4000 ocupa ~48 MB _decodificada_ independientemente de lo que pese el
   fichero; y hay 13 usos de `cachePolicy="memory-disk"` sin límite, que guardan
   una segunda copia en disco de cada imagen mostrada. El arreglo es generar
   miniaturas al guardar y no alimentar los originales a las listas.
2. **Etiquetar a alguien muestra la foto del restaurante**, debería ser la de la
   visita, y el detalle debería verse como en compartidos (foto, platos,
   personas, descripción).
3. **«con 1 persona»** en Amigos y Contigo: poner los nombres/usuarios.
4. **Cambiar la foto de perfil**: no existe.
5. **Tap en nombre/foto → perfil**, en amigos y en etiquetas.

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

  **Falta todo el código:** `expo-notifications`, el permiso, el registro del
  token con `register_push_token` (la RPC ya existe) y el envío en el Worker
  recorriendo `notifications` con `pushed_at is null`. Requiere **reconstruir el
  APK**: es un módulo nativo, no una recarga de JavaScript.

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

### Guiones de mantenimiento

`supabase/scripts/` — vaciar una cuenta en la nube (`reset-account.sql`,
verificado contra una base real) y el móvil (`reset-device.md`). Van juntos: si
solo se vacía uno, el otro lo repuebla en el siguiente sync.

## Estado global

Leyenda: 🟢 código completo y testeado · 🟡 código escrito, necesita servicio/dispositivo para verificarse · ⬜ pendiente.

| Fase                    | Estado                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentación de diseño | ✅ Completa (docs 00–15)                                                                                                                                                                                 |
| 0 — Puesta a punto      | ✅                                                                                                                                                                                                       |
| 1 — Esquema local       | ✅ Migraciones 0007–0010 verificadas contra una base v1 poblada                                                                                                                                          |
| 2 — Supabase + Auth     | ✅ Google OAuth funcionando en dispositivo                                                                                                                                                               |
| 3 — Sync                | 🟡 Filas y uniones sí. **La bajada de fotos y el caso de dos dispositivos nunca se habían probado**, y los dos estaban rotos (ver arriba); corregidos y con tests, sin verificar contra servicios reales |
| 4 — Worker / Share      | ✅ Desplegado; R2 sirviendo fotos                                                                                                                                                                        |
| 5 — Social              | ✅ Amigos, feed, perfiles, etiquetado y bandeja «Contigo»                                                                                                                                                |
| 6 — UI                  | ✅ Rediseño completo                                                                                                                                                                                     |
| 7 — Asistente IA        | 🟡 Tools de consulta testeadas · agente/voz/embeddings pendientes · **apagado en la 2.0.0** (`lib/features.ts`)                                                                                          |

**Verificación transversal en cada commit:** TypeScript en 0, **298 tests** (109 app-mobile + 165 node-mobile + 24 worker) más **117 aserciones SQL** (`npm run db:test`), `npm run lint` sin errores ni warnings, bundle Android.

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
