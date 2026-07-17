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

| Dependencia                                                                                                         | Decisión v2                  | Motivo                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Carrusel / visor / zoom de imágenes                                                                                 | ❌ **Fuera — código propio** | Causa raíz del dolor de upgrades                                                                                               |
| `axios`                                                                                                             | ❌ Fuera                     | `fetch` nativo basta; se va con la API legacy                                                                                  |
| `@react-native-async-storage/async-storage`                                                                         | ❌ Fuera                     | `expo-secure-store` para tokens; el resto de settings ya vive en SQLite (`app_settings`)                                       |
| `expo-drizzle-studio-plugin`                                                                                        | ⚠️ Solo dev                  | Útil; mantener como devDependency                                                                                              |
| `jszip`                                                                                                             | ✅ Se queda                  | Formato de backup; puro JS, sin nativo, no rompe en upgrades                                                                   |
| `date-fns`                                                                                                          | ✅ Se queda                  | Puro JS; alternativa `Intl` nativo — **abierto**, evaluar en fase 0                                                            |
| `react-hook-form` + `zod` + `@hookform/resolvers`                                                                   | ✅ Se quedan                 | Núcleo de los formularios, puro JS, buena salud                                                                                |
| `nativewind` + `tailwindcss`                                                                                        | ✅ Se queda                  | Base del sistema de diseño                                                                                                     |
| `drizzle-orm`                                                                                                       | ✅ Se queda                  | Puro JS sobre `expo-sqlite`                                                                                                    |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens` | ✅ Se quedan                 | Stack base de Expo/expo-router; se versionan con el SDK                                                                        |
| `react-native-maps`                                                                                                 | ✅ Se queda                  | Sin alternativa razonable; módulo con soporte de Expo                                                                          |
| `@react-navigation/*`                                                                                               | ✅ Se queda                  | Lo usa expo-router                                                                                                             |
| Módulos `expo-*` (location, haptics, blur, constants, linking, splash…)                                             | ✅ Se quedan                 | Versionados por el SDK, `expo install` los alinea                                                                              |
| `@supabase/supabase-js`                                                                                             | ➕ Nuevo (fase 2)            | Auth + sync                                                                                                                    |
| `expo-secure-store`                                                                                                 | ➕ Nuevo (fase 2)            | Tokens                                                                                                                         |
| `expo-background-task`                                                                                              | ➕ Nuevo (fase 3)            | Sync periódico                                                                                                                 |
| `expo-speech-recognition`                                                                                           | ➕ Nuevo (fase 7)            | STT nativo; **abierto**: verificar salud y compatibilidad con el SDK antes de adoptar (si es frágil → solo Whisper vía Worker) |
| `hono`                                                                                                              | ➕ Nuevo (fase 4)            | Worker                                                                                                                         |

## Procedimiento de upgrade de SDK (fase 0 y en adelante)

1. `npx expo install --fix` como base; **nunca** subir versiones de módulos nativos a mano fuera de lo que dicta el SDK.
2. `npx expo-doctor` debe quedar limpio.
3. Un commit por paso: (a) SDK + módulos expo, (b) React/RN, (c) dependencias JS puras, (d) retirada de librerías. Así un fallo se bisecta trivialmente.
4. Verificación tras cada paso: `npm run check` (lint + typecheck + tests) **y** arranque real de la app en dispositivo/emulador — los fallos de módulos nativos no aparecen en los tests.
5. Anotar en este documento cualquier incidencia y su causa (memoria del proyecto para el siguiente SDK).

## Política a futuro

- Actualizar SDK **cada release** (saltarse SDKs es lo que convierte el upgrade en un proyecto).
- Antes de añadir una dependencia nativa: ¿está en el ecosistema Expo? ¿tiene commits recientes? ¿qué pasa si muere? Si la respuesta a la última es "reescribirla es un fin de semana" → escribirla ya.
