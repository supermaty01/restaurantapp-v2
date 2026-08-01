# 11 — Dependencias y upgrades

## Por qué este documento existe

En la v1, **actualizar Expo era doloroso, sobre todo por las librerías de imágenes**. Ese dolor se paga en cada SDK (Expo saca ~3 al año) y bloquea todo lo demás. La v2 ataca la causa raíz: **menos dependencias, y ninguna dependencia en la superficie que más ha dolido**.

Regla general del proyecto: **una dependencia entra solo si el coste de escribirla supera claramente el coste de mantenerla a lo largo de los SDK.**

## Decisión: carrusel y visor de imágenes desde cero

**Decisión: eliminar toda librería de carrusel/visor/zoom de imágenes y escribir el componente propio.**

El alcance real es pequeño (esto es clave: no estamos reimplementando una librería genérica, sino _nuestro_ caso):

1. **Carrusel** — lista horizontal paginada de imágenes + indicador de puntos.
   Implementación: `FlatList` horizontal con `pagingEnabled` (RN core). Indicador: `Animated` con `useNativeDriver` sobre el scroll offset. Sin dependencias.
2. **Visor de detalle** — abrir una imagen a pantalla completa, deslizar entre ellas, pinch-zoom y doble-tap, cerrar deslizando hacia abajo.
   Implementación: `Modal` (RN core) + `react-native-gesture-handler` + `react-native-reanimated`, que **ya están en el proyecto** y son parte del stack base de Expo (los usa expo-router; se actualizan con el SDK y son las dependencias mejor mantenidas del ecosistema). No añadimos nada nuevo.

Superficie total estimada: ~250–350 líneas en `apps/mobile/components/media/`. A cambio: cero librerías de terceros que rompan en cada SDK, y control total del comportamiento (que además el rediseño va a cambiar).

Lo que **no** se reimplementa (siguen siendo módulos oficiales de Expo, actualizados con el SDK):

- `expo-image-picker` — acceso a cámara/galería (código nativo; reimplementarlo sería absurdo).
- `expo-image` — decodificación/caché de imágenes. **Abierto:** evaluar en fase 0 si se usa `expo-image` (mejor caché y rendimiento, módulo oficial) o el `Image` de RN core (cero módulos extra). Preferencia inicial: `expo-image` por el caché, que hará falta para las imágenes remotas de la fase 3.
- `expo-file-system`, `expo-sharing`, `expo-document-picker` — I/O de archivos para backups.

## Inventario de dependencias v1 y decisión

| Dependencia                                                                                                         | Decisión v2                  | Motivo                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Carrusel / visor / zoom de imágenes                                                                                 | ❌ **Fuera — código propio** | Causa raíz del dolor de upgrades                                                                                                |
| `axios`                                                                                                             | ❌ Fuera                     | `fetch` nativo basta; se va con la API legacy                                                                                   |
| `@react-native-async-storage/async-storage`                                                                         | ❌ Fuera                     | `expo-secure-store` para tokens; el resto de settings ya vive en SQLite (`app_settings`)                                        |
| `expo-drizzle-studio-plugin`                                                                                        | ⚠️ Solo dev                  | Útil; mantener como devDependency                                                                                               |
| `jszip`                                                                                                             | ⚠️ Solo tests                | Se probó para backups y **no aguanta el tamaño real** (ver abajo); queda para construir archivos de prueba                      |
| `react-native-zip-archive`                                                                                          | ✅ Vuelve (nativo)           | Zip por streaming para backups: es la única forma de manejar copias de cientos de MB. Es lo que ya usaba v1                     |
| `date-fns`                                                                                                          | ✅ Se queda                  | Puro JS; alternativa `Intl` nativo — **abierto**, evaluar en fase 0                                                             |
| `react-hook-form` + `zod` + `@hookform/resolvers`                                                                   | ✅ Se quedan                 | Núcleo de los formularios, puro JS, buena salud                                                                                 |
| `nativewind` + `tailwindcss`                                                                                        | ✅ Se queda                  | Base del sistema de diseño                                                                                                      |
| `drizzle-orm`                                                                                                       | ✅ Se queda                  | Puro JS sobre `expo-sqlite`                                                                                                     |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens` | ✅ Se quedan                 | Stack base de Expo/expo-router; se versionan con el SDK                                                                         |
| `react-native-maps`                                                                                                 | ✅ Se queda                  | Sin alternativa razonable; módulo con soporte de Expo                                                                           |
| `react-native-keyboard-controller`                                                                                  | ➕ Nuevo (ronda 7)           | El `KeyboardAvoidingView` del core no funciona en Android edge-to-edge (ver abajo). Va en los `bundledNativeModules` del SDK 57 |
| `@react-navigation/*`                                                                                               | ⚠️ Solo transitivas          | Desde SDK 56 expo-router prohíbe usar react-navigation directamente; no se importa desde el código                              |
| `react-native-pager-view`, `react-native-tab-view`                                                                  | ❌ Fuera                     | Salieron con `material-top-tabs` al migrar a expo-router + `SegmentedTabs` propio                                               |
| Módulos `expo-*` (location, haptics, blur, constants, linking, splash…)                                             | ✅ Se quedan                 | Versionados por el SDK, `expo install` los alinea                                                                               |
| `@supabase/supabase-js`                                                                                             | ➕ Nuevo (fase 2)            | Auth + sync                                                                                                                     |
| `expo-secure-store`                                                                                                 | ➕ Nuevo (fase 2)            | Tokens                                                                                                                          |
| `expo-background-task`                                                                                              | ➕ Nuevo (fase 3)            | Sync periódico                                                                                                                  |
| `expo-speech-recognition`                                                                                           | ➕ Nuevo (fase 7)            | STT nativo; **abierto**: verificar salud y compatibilidad con el SDK antes de adoptar (si es frágil → solo Whisper vía Worker)  |
| `hono`                                                                                                              | ➕ Nuevo (fase 4)            | Worker                                                                                                                          |

## Excepción razonada: el zip de los backups

La regla del proyecto es evitar dependencias nativas. Los backups son la
excepción, y conviene dejar escrito el porqué para no repetir el error.

Primero se sustituyó `react-native-zip-archive` (nativo, de v1) por **jszip**
(puro JS) siguiendo el principio. Funcionaba en los tests… con archivos de
juguete. En un backup real **de 207 MB** falla siempre: jszip lee el archivo
entero como base64 (~276 MB de string) y descomprime en memoria, así que
revienta el heap de JS. Peor aún, el fallo aparecía como un engañoso
`Invalid format`, como si la copia estuviera corrupta.

**Decisión revisada:** los backups usan el módulo nativo, que hace streaming a
disco. Motivos:

- El objetivo es soportar **varios GB**; ninguna solución en memoria llega.
- Los backups son la garantía de que no se pierden datos ([09](09-migracion-datos.md)):
  la corrección pesa más que la pureza de dependencias.
- Es la misma librería con la que v1 escribió las copias que hay que poder
  restaurar.

La regla general de [11](11-dependencias.md) sigue en pie —"una dependencia
entra solo si el coste de escribirla supera al de mantenerla"— y aquí escribir
un zip con streaming en JS no es viable. Coste asumido: hay que vigilarla en
cada subida de SDK, y **ya no se puede probar el zip en node**; los tests fijan
el _layout_ del archivo, que es el contrato de compatibilidad con v1.

## Segunda excepción: el teclado en Android

`react-native-keyboard-controller` es la otra dependencia nativa que entra, y
por el mismo tipo de motivo: **la alternativa del core no funciona**, no es que
sea menos cómoda.

El `KeyboardAvoidingView` de React Native, en Android, no esquiva nada. Sin
`behavior` pinta un `View` normal y delega en que la ventana se encoja con
`adjustResize`. Eso valía antes de edge-to-edge; desde el SDK 57 edge-to-edge
es obligatorio (`edgeToEdgeEnabled` desapareció de la configuración de Expo),
la ventana ocupa la pantalla entera y **el teclado llega como un inset**. Con
`behavior="padding"` tampoco sirve: la altura la calcula desde el `screenY` que
el core deriva de `getWindowVisibleDisplayFrame`, que en edge-to-edge tampoco se
mueve.

Se descartó `useAnimatedKeyboard` de `react-native-reanimated`, que sí lee los
insets de la IME y **ya estaba instalado**: está deprecado desde la 4.5 y su
propio aviso remite a esta librería. Construir encima habría sido deuda desde el
primer día.

Coste asumido: es un módulo nativo, así que un cambio aquí no se prueba
recargando JavaScript — hace falta APK. A cambio va en los
`bundledNativeModules` de Expo SDK 57 (1.21.9), es decir que la versión la fija
el SDK y `expo install --fix` la mantiene alineada, igual que reanimated o
gesture-handler.

## Procedimiento de upgrade de SDK (fase 0 y en adelante)

1. `npx expo install --fix` como base; **nunca** subir versiones de módulos nativos a mano fuera de lo que dicta el SDK.
2. `npx expo-doctor` debe quedar limpio.
3. Un commit por paso: (a) SDK + módulos expo, (b) React/RN, (c) dependencias JS puras, (d) retirada de librerías. Así un fallo se bisecta trivialmente.
4. Verificación tras cada paso: `npm run check` (lint + typecheck + tests) **y** arranque real de la app en dispositivo/emulador — los fallos de módulos nativos no aparecen en los tests.
5. Anotar en este documento cualquier incidencia y su causa (memoria del proyecto para el siguiente SDK).

## Política a futuro

- Actualizar SDK **cada release** (saltarse SDKs es lo que convierte el upgrade en un proyecto).
- Antes de añadir una dependencia nativa: ¿está en el ecosistema Expo? ¿tiene commits recientes? ¿qué pasa si muere? Si la respuesta a la última es "reescribirla es un fin de semana" → escribirla ya.

## Los binarios de lightningcss en el lock

`package.json` de la raíz declara en `optionalDependencies`:

```json
"lightningcss-linux-x64-gnu": "1.27.0",
"lightningcss-darwin-arm64": "1.27.0"
```

**No los usa nadie directamente y no se pueden borrar.** NativeWind compila el CSS con lightningcss, que es un módulo nativo: publica un binario por plataforma como `optionalDependencies` y npm **solo apunta en el lock el de la plataforma donde se instaló**. Con el lock generado en Windows, `npm ci` en un builder de Linux nunca instala el binario de Linux, y la build muere con:

```
Cannot find module '../lightningcss.linux-x64-gnu.node'
```

Declararlos explícitamente obliga a npm a registrarlos en el lock en cualquier plataforma. `npm install --os=linux --cpu=x64` no vale: elige la plataforma objetivo en vez de acumular.

Hay dos copias de lightningcss en el árbol —1.32.0 desde `@expo/metro-config`, 1.27.0 desde `react-native-css-interop`— y el lock acaba con el binario correcto para cada una. Se dejaron sin unificar a propósito: colapsarlas obliga a subir o bajar de versión un parser de CSS, y ninguna de las dos cosas hacía falta para arreglar esto.
