# 📍 ESTADO — documentación viva

**Última actualización:** 2026-07-17

Punto de entrada al retomar el trabajo: qué está hecho, qué sigue, qué está bloqueado. Se actualiza al cerrar cada bloque de trabajo.

## Estado global

| Fase                    | Estado                      |
| ----------------------- | --------------------------- |
| Documentación de diseño | ✅ Completa (docs 00–13)    |
| 0 — Puesta a punto      | 🟡 En curso (~85%)          |
| 1 — Esquema local       | ⬜ Siguiente                |
| 2 — Supabase + Auth     | ⬜ Bloqueada (credenciales) |
| 3 — Sync                | ⬜                          |
| 4 — Worker / Share      | ⬜ Bloqueada (credenciales) |
| 5 — Social              | ⬜                          |
| 6 — UI                  | ⬜                          |
| 7 — Asistente IA        | ⬜ Bloqueada (credenciales) |

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

## ⚠️ Fase 0 — lo que falta

1. **13 errores de TypeScript** (desde 133) y lint pendiente en el código portado de v1.
   Son consecuencia _deseada_ de activar las reglas estrictas de [12 — Calidad](12-calidad.md) sobre código que no se escribió con ellas. **No son regresiones**: tests y bundle en verde en cada paso.

   Ya saldado, y no fue cosmético — salieron bugs reales:
   - asertaba : un plato o visita huérfano habría petado en runtime. Ahora se trata explícitamente.
   - parseaba los JSON de con un cast; ahora se validan con **zod** (es un borde no confiable: una versión vieja pudo escribir otra forma).
   - Las consultas de restaurantes **no seleccionaban ** aunque el componente lo pinta.
   - , , y eran : aceptaban cualquier nombre de campo. Ahora son genéricos, con restringiendo al tipo real del campo.
   - DTOs: pasa de opcional a (la BD lo define NOT NULL DEFAULT false).

   Restantes (13), medibles con app/(main)/dishes/[id]/edit.tsx(198,24): error TS2322: Type 'Control<{ name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }, any, { name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }>' is not assignable to type 'Control<any>'.
   The types of '_options.validate' are incompatible between these types.
   Type 'ValidateForm<{ name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }>' is not assignable to type 'ValidateForm<any>'.
   Types of parameters 'props' and 'props' are incompatible.
   Type '{ formValues: any; formState: FormState<any>; eventType?: ValidateFormEventType; name?: string | string[]; }' is not assignable to type '{ formValues: { name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }; formState: FormState<{ name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }>; eventType?: ValidateFor...' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
   Types of property 'name' are incompatible.
   Type 'string | string[]' is not assignable to type '"name" | "comments" | "rating" | "restaurantId" | "price" | ("name" | "comments" | "rating" | "restaurantId" | "price")[]'.
   Type 'string' is not assignable to type '"name" | "comments" | "rating" | "restaurantId" | "price" | ("name" | "comments" | "rating" | "restaurantId" | "price")[]'.
   app/(main)/dishes/new.tsx(73,20): error TS2345: Argument of type '{ id: number; name: string; comments: string; rating: number | null; tags: never[]; images: never[]; }' is not assignable to parameter of type 'DishListDTO'.
   Property 'deleted' is missing in type '{ id: number; name: string; comments: string; rating: number | null; tags: never[]; images: never[]; }' but required in type 'DishListDTO'.
   app/(main)/dishes/new.tsx(139,24): error TS2322: Type 'Control<{ name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }, any, { name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }>' is not assignable to type 'Control<any>'.
   The types of '_options.validate' are incompatible between these types.
   Type 'ValidateForm<{ name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }>' is not assignable to type 'ValidateForm<any>'.
   Types of parameters 'props' and 'props' are incompatible.
   Type '{ formValues: any; formState: FormState<any>; eventType?: ValidateFormEventType; name?: string | string[]; }' is not assignable to type '{ formValues: { name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }; formState: FormState<{ name: string; restaurantId: number; comments?: string | undefined; rating?: number | undefined; price?: number | undefined; }>; eventType?: ValidateFor...' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
   Types of property 'name' are incompatible.
   Type 'string | string[]' is not assignable to type '"name" | "comments" | "rating" | "restaurantId" | "price" | ("name" | "comments" | "rating" | "restaurantId" | "price")[]'.
   Type 'string' is not assignable to type '"name" | "comments" | "rating" | "restaurantId" | "price" | ("name" | "comments" | "rating" | "restaurantId" | "price")[]'.
   app/(main)/map.tsx(254,14): error TS2375: Type '{ key: number; coordinate: { latitude: number; longitude: number; }; title: string; description: string | undefined; onCalloutPress: () => void; }' is not assignable to type 'Readonly<MapMarkerProps>' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
   Types of property 'description' are incompatible.
   Type 'string | undefined' is not assignable to type 'string'.
   Type 'undefined' is not assignable to type 'string'.
   app/(main)/restaurants/[id]/edit.tsx(188,24): error TS2322: Type 'Control<{ name: string; comments?: string | null | undefined; rating?: number | null | undefined; location?: { latitude: number; longitude: number; } | null | undefined; }, any, { name: string; comments?: string | ... 1 more ... | undefined; rating?: number | ... 1 more ... | undefined; location?: { ...; } | ... 1 m...' is not assignable to type 'Control<any>'.
   The types of '_options.validate' are incompatible between these types.
   Type 'ValidateForm<{ name: string; comments?: string | null | undefined; rating?: number | null | undefined; location?: { latitude: number; longitude: number; } | null | undefined; }>' is not assignable to type 'ValidateForm<any>'.
   Types of parameters 'props' and 'props' are incompatible.
   Type '{ formValues: any; formState: FormState<any>; eventType?: ValidateFormEventType; name?: string | string[]; }' is not assignable to type '{ formValues: { name: string; comments?: string | null | undefined; rating?: number | null | undefined; location?: { latitude: number; longitude: number; } | null | undefined; }; formState: FormState<...>; eventType?: ValidateFormEventType; name?: "name" | ... 5 more ... | ("name" | ... 4 more ... | "location.longit...' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
   Types of property 'name' are incompatible.
   Type 'string | string[]' is not assignable to type '"name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude" | ("name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude")[]'.
   Type 'string' is not assignable to type '"name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude" | ("name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude")[]'.
   app/(main)/restaurants/new.tsx(137,24): error TS2322: Type 'Control<{ name: string; comments?: string | null | undefined; rating?: number | null | undefined; location?: { latitude: number; longitude: number; } | null | undefined; }, any, { name: string; comments?: string | ... 1 more ... | undefined; rating?: number | ... 1 more ... | undefined; location?: { ...; } | ... 1 m...' is not assignable to type 'Control<any>'.
   The types of '_options.validate' are incompatible between these types.
   Type 'ValidateForm<{ name: string; comments?: string | null | undefined; rating?: number | null | undefined; location?: { latitude: number; longitude: number; } | null | undefined; }>' is not assignable to type 'ValidateForm<any>'.
   Types of parameters 'props' and 'props' are incompatible.
   Type '{ formValues: any; formState: FormState<any>; eventType?: ValidateFormEventType; name?: string | string[]; }' is not assignable to type '{ formValues: { name: string; comments?: string | null | undefined; rating?: number | null | undefined; location?: { latitude: number; longitude: number; } | null | undefined; }; formState: FormState<...>; eventType?: ValidateFormEventType; name?: "name" | ... 5 more ... | ("name" | ... 4 more ... | "location.longit...' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
   Types of property 'name' are incompatible.
   Type 'string | string[]' is not assignable to type '"name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude" | ("name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude")[]'.
   Type 'string' is not assignable to type '"name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude" | ("name" | "comments" | "rating" | "location" | "location.latitude" | "location.longitude")[]'.
   app/(main)/visits/[id]/edit.tsx(61,9): error TS2345: Argument of type '{ id: number; name: string; comments: null; rating: null; tags: never[]; images: never[]; }[]' is not assignable to parameter of type 'SetStateAction<DishListDTO[]>'.
   Type '{ id: number; name: string; comments: null; rating: null; tags: never[]; images: never[]; }[]' is not assignable to type 'DishListDTO[]'.
   Property 'deleted' is missing in type '{ id: number; name: string; comments: null; rating: null; tags: never[]; images: never[]; }' but required in type 'DishListDTO'.
   app/(main)/visits/[id]/edit.tsx(170,11): error TS2322: Type 'string' is not assignable to type 'never'.
   app/(main)/visits/new.tsx(124,11): error TS2322: Type 'string' is not assignable to type 'never'.
   components/ImportConflictModal.tsx(109,51): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
   Type 'undefined' is not assignable to type 'number'.
   components/PeekablePressable.tsx(170,8): error TS2375: Type '{ children: ReactNode; className: string | undefined; style: { opacity: number; transform: { scale: Value; }[]; }; }' is not assignable to type 'AnimatedProps<ViewProps & RefAttributes<View>>' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
   Types of property 'className' are incompatible.
   Type 'string | undefined' is not assignable to type 'string | Value | AnimatedInterpolation<string | number>'.
   Type 'undefined' is not assignable to type 'string | Value | AnimatedInterpolation<string | number>'.
   features/dishes/components/DishPicker.tsx(131,63): error TS2769: No overload matches this call.
   Overload 1 of 2, '(props: TextProps): Text', gave the following error.
   Type 'string | ("message" extends keyof FieldError & keyof DeepRequired<TFieldValues>[string] ? [FieldError["message" & keyof DeepRequired<...>[string]], FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]] : strin...' is not assignable to type 'ReactNode'.
   Type '"message" extends keyof FieldError & keyof DeepRequired<TFieldValues>[string] ? [FieldError["message" & keyof DeepRequired<...>[string]], FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]] : string | undefi...' is not assignable to type 'ReactNode'.
   Type 'string | ([FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]) | undefined' is not assignable to type 'ReactNode'.
   Type '[FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]' is not assignable to type 'ReactNode'.
   Type 'FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<TFieldValues>[string]] | Merge<...>' is not assignable to type 'ReactNode'.
   Type '(DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obj...' is not assignable to type 'ReactNode'.
   Type 'DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obje...' is not assignable to type 'ReactNode'.
   Type 'FieldError | ("message" & keyof DeepRequired<TFieldValues>[string] extends "root" | `root.${string}` ? Partial<{ type: string | number; message: string; }> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends object ? Merge<...> : FieldError)' is not assignable to type 'ReactNode'.
   Type 'FieldError' is not assignable to type 'ReactNode'.
   Type 'FieldError' is missing the following properties from type 'ReactPortal': children, props, key
   Type 'DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obje...' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'FieldError | ("message" & keyof DeepRequired<TFieldValues>[string] extends "root" | `root.${string}` ? Partial<{ type: string | number; message: string; }> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends object ? Merge<...> : FieldError)' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'FieldError' is missing the following properties from type 'Promise<AwaitedReactNode>': then, catch, finally, [Symbol.toStringTag]
   Type '[FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<TFieldValues>[string]] | Merge<...>' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type '(DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obj...' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'undefined' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type '"message" extends keyof FieldError & keyof DeepRequired<TFieldValues>[string] ? [FieldError["message" & keyof DeepRequired<...>[string]], FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]] : string | undefi...' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'string | ([FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]) | undefined' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'undefined' is not assignable to type 'Promise<AwaitedReactNode>'.
   Overload 2 of 2, '(props: TextProps, context: any): Text', gave the following error.
   Type 'string | ("message" extends keyof FieldError & keyof DeepRequired<TFieldValues>[string] ? [FieldError["message" & keyof DeepRequired<...>[string]], FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]] : strin...' is not assignable to type 'ReactNode'.
   Type '"message" extends keyof FieldError & keyof DeepRequired<TFieldValues>[string] ? [FieldError["message" & keyof DeepRequired<...>[string]], FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]] : string | undefi...' is not assignable to type 'ReactNode'.
   Type 'string | ([FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]) | undefined' is not assignable to type 'ReactNode'.
   Type '[FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]' is not assignable to type 'ReactNode'.
   Type 'FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<TFieldValues>[string]] | Merge<...>' is not assignable to type 'ReactNode'.
   Type '(DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obj...' is not assignable to type 'ReactNode'.
   Type 'DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obje...' is not assignable to type 'ReactNode'.
   Type 'FieldError | ("message" & keyof DeepRequired<TFieldValues>[string] extends "root" | `root.${string}` ? Partial<{ type: string | number; message: string; }> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends object ? Merge<...> : FieldError)' is not assignable to type 'ReactNode'.
   Type 'FieldError' is not assignable to type 'ReactNode'.
   Type 'FieldError' is missing the following properties from type 'ReactPortal': children, props, key
   Type 'DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obje...' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'FieldError | ("message" & keyof DeepRequired<TFieldValues>[string] extends "root" | `root.${string}` ? Partial<{ type: string | number; message: string; }> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends object ? Merge<...> : FieldError)' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'FieldError' is missing the following properties from type 'Promise<AwaitedReactNode>': then, catch, finally, [Symbol.toStringTag]
   Type '[FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<TFieldValues>[string]] | Merge<...>' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type '(DeepRequired<TFieldValues>[string]["message" & keyof DeepRequired<TFieldValues>[string]] extends Blob | BrowserNativeObject ? FieldError : "message" & keyof DeepRequired<...>[string] extends "root" | `root.${string}` ? Partial<...> : DeepRequired<...>[string]["message" & keyof DeepRequired<...>[string]] extends obj...' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'undefined' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type '"message" extends keyof FieldError & keyof DeepRequired<TFieldValues>[string] ? [FieldError["message" & keyof DeepRequired<...>[string]], FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]] : string | undefi...' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'string | ([FieldError["message" & keyof DeepRequired<TFieldValues>[string]], FieldErrorsImpl<DeepRequired<TFieldValues>[string]>["message" & keyof DeepRequired<...>[string]]] extends [...] ? Merge<...> : FieldErrorsImpl<...>["message" & keyof DeepRequired<...>[string]]) | undefined' is not assignable to type 'Promise<AwaitedReactNode>'.
   Type 'undefined' is not assignable to type 'Promise<AwaitedReactNode>'.
   services/share/importService.ts(128,5): error TS2375: Type '{ hasConflict: true; existingEntity: { id: number; name: string; } | undefined; incomingName: string; }' is not assignable to type 'ConflictResult' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
   Types of property 'existingEntity' are incompatible.
   Type '{ id: number; name: string; } | undefined' is not assignable to type '{ id: number | undefined; name: string; }'.
   Type 'undefined' is not assignable to type '{ id: number | undefined; name: string; }'.:
   , , , , , (paso de a los pickers ya genéricos), (prop de MapMarker), (props de Animated), , .

2. ** está vacío** — mover ahí los schemas zod.
3. **CI (GitHub Actions) no creada.**
4. **Verificación en emulador/dispositivo: no hecha.** El bundle compila, pero eso no prueba que la app _se vea bien_ ni que el visor de imágenes nuevo se sienta correcto.

### Corrección a los docs a partir de lo aprendido

- La decisión de [11](11-dependencias.md) se cumplió **mejor de lo previsto**: al migrar a expo-router y sustituir las pestañas internas por `SegmentedTabs`, también salieron `react-native-pager-view`, `react-native-tab-view` y `@react-navigation/material-top-tabs`. La app ya **no depende de ninguna librería de carrusel, pager ni zoom**.
- `expo-file-system`: el código portado usa la API **legacy** (`expo-file-system/legacy`), que SDK 57 sigue exportando. Decisión consciente: migrar a la API nueva a la vez que se toca ese código en fase 1, en vez de mezclar dos refactors sobre la ruta crítica de backups. **Deuda anotada.**

## Siguiente paso concreto

1. Arrancar la app en emulador (`npm run -w apps/mobile start`). **Prioridad máxima**: probar navegación por tabs, detalle de restaurante/visita (SegmentedTabs nuevo) y sobre todo el **carrusel + visor de imágenes propios** (pinch, doble-tap, arrastrar para cerrar).
2. Saldar los 133 errores TS + lint (fichero a fichero, `app/**` primero).
3. Mover schemas zod a `packages/shared`.
4. CI en GitHub Actions con `npm run check`.
5. Cerrar fase 0 y abrir [fase 1](10-roadmap.md#fase-1--refactor-del-esquema-local--crítica).

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
