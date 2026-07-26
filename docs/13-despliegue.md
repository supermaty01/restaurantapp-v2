# 13 — Guía de despliegue

Guía end-to-end para levantar el proyecto completo (app + servicios) desde cero. Se mantiene actualizada a medida que cada fase añade un servicio.

> **Estado:** las secciones marcadas 🚧 corresponden a fases aún no implementadas; el procedimiento está definido pero no verificado. Ver [ESTADO.md](ESTADO.md).

## 0. Prerrequisitos

- Node.js 20+ y npm 10+
- `npm i -g eas-cli` + cuenta Expo
- Cuenta Cloudflare (gratis) + `npx wrangler login`
- Cuenta Supabase (gratis) + `npx supabase login`
- Android Studio (emulador) y/o Xcode (iOS, solo macOS)

## 1. Repo

```bash
git clone <repo> && cd restaurant-app-v2
npm install                 # workspaces: instala mobile, api y shared
cp .env.example .env        # ver variables abajo
```

## 2. App móvil (funciona sin ningún servicio)

```bash
npm start            # desde la raíz del repo (alias de: npm run -w apps/mobile start)
npm start -- -c      # añade -c para limpiar la caché de Metro
```

> ⚠️ **No ejecutes `npx expo start` en la raíz del monorepo.** La raíz no tiene
> campo `main`, así que Expo cae a su entry por defecto (`expo/AppEntry.js`) y
> falla con `Unable to resolve "../../App"`. Usa `npm start` desde la raíz, o
> `cd apps/mobile && npx expo start`.

La app arranca en **modo local**: SQLite en el dispositivo, sin cuenta, sin red. Este modo debe funcionar siempre, incluso sin nada de lo que sigue configurado.

### Development build (recomendado) en vez de Expo Go

```bash
cd apps/mobile
npx expo run:android      # compila e instala; deja Metro corriendo
```

**Por qué no Expo Go:** el proyecto declara _config plugins_ (permisos de
ubicación, cámara y galería, `expo-secure-store`) y Expo Go **no puede
aplicarlos** — trae un binario fijo. Un development build compila exactamente
los módulos nativos que el proyecto declara y, sobre todo, **muestra el error
real** en vez de cerrarse en silencio.

Requisitos: Android Studio + SDK y **JDK 17**, con un emulador abierto o un
móvil por USB con depuración activada. Se genera `apps/mobile/android/`
(ignorado por git); regenerable con `npx expo prebuild --platform android --clean`.

Solo hay que hacerlo cuando cambian las dependencias nativas o `app.config.js`;
el día a día es `npm start` y recarga en caliente.

Variables (`apps/mobile/.env`):

| Variable                        | Necesaria para                       | Notas                                                                             |
| ------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY`           | Mapa y autocompletado de direcciones | Restringir la key por app id + SHA en la consola de Google                        |
| `EXPO_PUBLIC_SUPABASE_URL`      | Cuentas y sync 🚧                    | Vacía = la app oculta el login                                                    |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cuentas y sync 🚧                    | Usa la **publishable key** (`sb_publishable_…`); es pública por diseño, RLS manda |
| `EXPO_PUBLIC_API_URL`           | Share links, IA 🚧                   | URL del Worker                                                                    |

> **Claves de Supabase (importante).** Supabase está retirando las claves legacy
> `anon` / `service_role` (JWT) a lo largo de 2026, sustituidas por
> **publishable** (`sb_publishable_…`, cliente) y **secret** (`sb_secret_…`,
> servidor). Usa las nuevas: el nombre de la variable se mantiene por
> compatibilidad, pero pega la publishable key. Las secret keys **no son JWT**,
> así que viajan en la cabecera `apikey`, nunca en `Authorization: Bearer` (el
> Worker ya lo hace así).

**Decisión:** si faltan las variables de Supabase/API, la app degrada a modo local en vez de fallar. Esto mantiene el principio de "la nube es opcional" también en el arranque de desarrollo.

## 3. Supabase 🚧 (fase 2)

Migraciones ya escritas en `supabase/migrations/` (aplicar en orden):

- `0001_data_mirror.sql` — espejo de datos (uuid PK, FKs por uuid) + profiles.
- `0002_rls_and_lww.sql` — RLS de dueño en todas las tablas + trigger de last-write-wins.
- `0003_share_and_ai.sql` — `share_links` + `ai_usage` (usadas por el Worker).
- `0004_social.sql` — friendships, `are_friends`, lectura para amigos, vista `feed`.

```bash
# Local (desarrollo)
npx supabase start                      # Postgres + Auth + Studio en Docker
npx supabase db reset                   # aplica supabase/migrations/* en orden

# Producción
npx supabase link --project-ref <ref>
npx supabase db push
```

Configuración en el dashboard:

1. **Auth → Providers**: habilitar Email, Google (client id/secret de Google Cloud Console) y Apple (solo si se publica en iOS).
2. **Auth → URL Configuration**: añadir el redirect del deep link (`restaurantapp://auth/callback`) y el del Worker.
3. **Database → Extensions**: habilitar `vector` (pgvector) para la fase 7.
4. **API Keys**: copiar la **publishable key** para la app. La **secret key** solo va al Worker.
5. Verificar que **RLS está activo en todas las tablas** (`supabase/migrations` lo hace, pero conviene comprobarlo: una tabla sin RLS es una fuga de datos de todos los usuarios).

### Firma de JWT (asimétrica)

Los proyectos creados desde octubre de 2025 firman los tokens con **claves
asimétricas** (ES256/RS256) y publican las públicas en
`https://<proyecto>.supabase.co/auth/v1/.well-known/jwks.json`. El Worker
verifica contra ese endpoint —local, sin llamar a Auth y sin secreto
compartido—, así que **no necesitas configurar `SUPABASE_JWT_SECRET`**. Solo
hace falta si tu proyecto es antiguo y sigue con el secreto HS256; en ese caso
el Worker cae automáticamente a ese modo.

El login OAuth de la app usa **PKCE** (`flowType: 'pkce'`), que es lo que exige
el flujo nativo con deep link.

### Google: el cliente OAuth tiene que ser de tipo «Aplicación web»

Es el error que más cuesta encontrar, porque el mensaje no lo dice:

> `Unable to exchange external code: 4/0A`

Significa que Google devolvió el código de autorización correctamente, pero
Supabase **no pudo canjearlo** con Google desde su servidor. La causa casi
siempre es una de estas dos, y ambas se arreglan en Google Cloud Console →
_APIs y servicios → Credenciales_:

1. **El cliente OAuth es de tipo «Android» (o «iOS») en vez de «Aplicación
   web».** Los clientes nativos **no tienen client secret**, y Supabase
   necesita uno para hacer el canje servidor a servidor. Aunque la app sea
   nativa, aquí quien habla con Google es Supabase, no el móvil: el cliente
   debe ser **Web application**.
2. **El client secret pegado en Supabase no corresponde a ese client id**, o se
   copió con espacios.

Además, en ese mismo cliente web, en _URIs de redireccionamiento
autorizados_, tiene que estar exactamente:

```
https://<proyecto>.supabase.co/auth/v1/callback
```

No `restaurantapp://auth/callback`: ese es el salto siguiente, el que Supabase
hace hacia la app, y va en Supabase (paso 2 de arriba), no en Google.

### Cuando el login falle, los Auth Logs tienen la respuesta

Supabase devuelve el fallo a la app como `Unable to exchange external code: …`,
que no dice nada. El motivo real está en **Logs → Auth Logs**, filtrando por el
endpoint `/callback` justo después de reproducirlo. Aparece el mensaje literal
del proveedor:

| Lo que dice Google                            | Qué arreglar                                              |
| --------------------------------------------- | --------------------------------------------------------- |
| `"invalid client" "client secret is invalid"` | El secreto de Supabase no es el del cliente de Google     |
| `redirect_uri_mismatch`                       | El URI que envía Supabase no está registrado tal cual     |
| `invalid_grant`                               | Código ya usado o caducado; mirar la hora del dispositivo |
| `unauthorized_client`                         | El tipo de cliente no admite este flujo                   |

Para el secreto: cópialo con **el icono de descarga** de Google Cloud, nunca
seleccionando el texto. Un espacio invisible al pegar es la causa más frecuente
de `invalid client`, y desde el dashboard los dos secretos se ven idénticos.

La app traduce estos errores a mensajes accionables
(`lib/helpers/auth-errors.ts`), pero la fuente de verdad son los logs.

### Que la pantalla de permisos diga «RestaurantApp»

Si Google muestra «…permitirá que `xxxx.supabase.co` acceda a esta información»
es porque la pantalla de consentimiento no tiene nombre de aplicación y Google
cae al dominio del redirect.

En Google Cloud Console → _APIs y servicios → Pantalla de consentimiento de
OAuth_:

- **Nombre de la aplicación**: `RestaurantApp`.
- **Logotipo**: el icono de la app (mejora bastante la percepción).
- **Correo de asistencia** y **dominio del desarrollador**.

Con eso el diálogo pasa a decir el nombre. Ojo: mientras la app esté en modo
**Testing** Google añade un aviso de app no verificada; para quitarlo hace
falta pasar a producción y, si se piden scopes sensibles, verificación. Para
los scopes básicos (`email`, `profile`) no hace falta verificación.

> Nota free tier: el proyecto se **pausa por inactividad**. El cron del Worker lo mantiene despierto, o se asume arranque frío.

## 4. Cloudflare Worker 🚧 (fase 4)

```bash
cd apps/api
npx wrangler r2 bucket create restaurantapp-images
npx wrangler deploy
```

`wrangler.toml` declara: binding R2 (`IMAGES`), binding Workers AI (`AI`), y los crons de mantenimiento.

Secrets (nunca en el repo):

```bash
npx wrangler secret put SUPABASE_URL          # también resuelve el JWKS para verificar tokens
npx wrangler secret put SUPABASE_SECRET_KEY   # sb_secret_… : share links y operaciones de servidor

# Solo si tu proyecto es antiguo y firma con el secreto HS256 compartido:
# npx wrangler secret put SUPABASE_JWT_SECRET
```

Desarrollo local: `npx wrangler dev` + `.dev.vars` (gitignored).

## 5. IA — Workers AI + AI Gateway 🚧 (fase 7)

**Decisión: solo modelos gratuitos de Workers AI, siempre a través de AI Gateway.** Sin Claude ni ningún proveedor de pago (ver [07](07-asistente-ia.md)).

1. Crear un **AI Gateway** en el dashboard de Cloudflare (AI → AI Gateway) → anotar `account_id` y `gateway_id`.
2. Enrutar el binding `AI` del Worker a través del gateway (opción `gateway` en las llamadas `env.AI.run`).
3. En el gateway se configuran: **caché** (respuestas repetidas gratis), **rate limiting** (defensa de cuota), y **analytics/logs** (visibilidad del gasto de neuronas).

No hay API keys de terceros que gestionar: el binding `AI` autentica solo. Esta es una razón más de la decisión.

## 6. Builds de la app

```bash
eas build -p android --profile preview      # APK, se instala directo en el móvil
eas build -p android --profile production   # AAB, para la Play Store
eas submit -p android --profile production
```

`eas.json` fija `appVersionSource: "local"`: el `versionCode` sale de `app.config.js` y no lo gestiona EAS. Es a propósito — de ese número depende que una actualización se instale, y quiero verlo en el diff, no en un panel.

### Variables de entorno

Las `EXPO_PUBLIC_*` **se incrustan en el bundle al compilar**, no se leen al arrancar. Y `.env` está en `.gitignore`, así que en EAS no existe salvo que se declaren aparte:

```bash
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL      --value "https://…"
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_…"
eas env:create --scope project --name EXPO_PUBLIC_API_URL           --value "https://…workers.dev"
eas env:create --scope project --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value "…"
eas env:create --scope project --name GOOGLE_MAPS_API_KEY           --value "…"
```

Si falta alguna de las tres obligatorias, `app.config.js` **rompe la build** en vez de producir un APK que se instala y no llega a ningún sitio. En local solo avisa, porque el modo puramente local es válido.

Deep links: `app.config.js` declara el scheme y los App Links del dominio de share.

## 6.b Actualizar desde la v1.3 en un móvil

Esto es una **actualización en sitio**, no una instalación nueva. La v2 mantiene a propósito:

| | v1.3 | v2.0 |
|---|---|---|
| `package` / `bundleIdentifier` | `com.supermaty01.restaurantapp` | igual |
| `slug` y proyecto EAS | `restaurantapp` / `acb4a328…` | igual |
| Base de datos | `restaurantapp` | igual |
| `versionCode` | 1 | **2** |

Las tres primeras hacen que Android trate el APK como la misma app y **conserve la base de datos y las fotos**. La cuarta es la que permite instalarlo: con un `versionCode` igual o menor, Android rechaza el APK con un «App not installed» que no explica el motivo.

**Firma.** El APK tiene que ir firmado con **la misma clave** que la versión instalada, o Android lo rechaza aunque el `versionCode` suba:

```
INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package … signatures do not match
```

Usar el mismo proyecto EAS **no basta**. Lo que decide es con qué se firmó lo que hay en el dispositivo:

| Cómo se instaló lo que hay | Firma | ¿Entra un APK de EAS? |
|---|---|---|
| `expo run:android`, Android Studio, dev-client | Keystore de depuración (`CN=Android Debug`, la misma en todas las máquinas) | **No** |
| `eas build` en este proyecto | Keystore de release de EAS | Sí |
| Google Play | Play App Signing | No (hay que pasar por Play) |

Comprobarlo antes de compilar, con el dispositivo conectado:

```bash
adb devices                       # asegúrate de apuntar al móvil, no a un emulador
adb -s <ID> shell dumpsys package com.supermaty01.restaurantapp   | grep -E "versionName|versionCode|signatures|pkgFlags"
```

`pkgFlags=[ DEBUGGABLE … ]` significa build local: firmada con la clave de depuración, y **un APK de EAS no se instalará encima**.

### Si las firmas no coinciden

No se puede reconciliar: no se firma un release con la keystore de depuración, cuya clave privada es pública y viene con el SDK. Cualquiera podría firmar una actualización de tu app.

La salida sin perder datos existe porque el formato de copia se ha mantenido:

1. En la app vieja: **Ajustes → copia de seguridad**. Genera un ZIP con el fichero SQLite entero y el directorio de imágenes.
2. **Sácalo del teléfono** (correo, Drive, cable). Este paso no es opcional: el siguiente borra la app.
3. `adb uninstall com.supermaty01.restaurantapp`, o desinstalar a mano.
4. Instalar el APK de EAS.
5. En la app nueva: **Ajustes → restaurar** y elegir el ZIP.

Restaurar sustituye el fichero SQLite y remonta el proveedor, así que las migraciones `0007–0010` corren sobre la base de la v1 — el mismo camino que cubren los tests de `migrations.node.test.ts`. Las fotos vuelven con el ZIP.

A partir de ahí, todas las builds salen de EAS y esto no se repite.

**Qué pasa al abrir por primera vez.** Drizzle encuentra las migraciones `0000–0006` ya aplicadas (mismos ficheros, mismo journal) y corre solo `0007–0010`:

- `0007` añade uuid, marcas de tiempo y visibilidad a todas las filas existentes.
- `0008` **reconstruye la tabla de visitas** para hacer la fecha opcional. Es el paso que más fácil pierde datos.
- `0009` añade a las personas las columnas de cuenta.
- `0010` pasa todo el diario de la v1 a `visibility = 'default'`.

La cadena está cubierta por tests contra una base v1 poblada (`services/db/__tests__/migrations.node.test.ts`, bloque «actualización v1.3 → v2»), incluido que no se pierda ninguna fila ni ninguna unión. Verificado rompiendo el `INSERT` de `0008` a mano: fallan cuatro tests.

**Antes de instalar, haz una copia.** Ajustes → copia de seguridad, y sácala del teléfono. Los tests cubren el camino, pero es tu diario y esta es la primera vez que esas migraciones tocan datos reales fuera de un test.

**La primera sincronización es larga.** Sube el diario entero y luego las fotos de 15 en 15, una tanda por pasada. Déjala en primer plano un rato; el progreso queda guardado, así que interrumpirla no pierde nada.

## 7. Checklist del primer despliegue (v2.0, sin IA)

Servicios:

- [ ] Migraciones de Supabase `0001–0014` aplicadas; `npm run db:test` en verde
- [ ] RLS activo en todas las tablas
- [ ] Google OAuth configurado con su redirect
- [ ] Worker desplegado; `GET /health` responde `{"ok":true}`
- [ ] Secretos del Worker cargados (`SUPABASE_URL` es el que hace falta para verificar los JWT; sin él todo `PUT /images` devuelve 401)
- [ ] Bucket R2 creado y enlazado como `IMAGES`

App:

- [ ] Variables `EXPO_PUBLIC_*` declaradas en EAS
- [ ] `versionCode` mayor que el instalado (2 para actualizar desde la v1.3)
- [ ] Credenciales de firma son las mismas que la v1.3 (`eas credentials -p android`)
- [ ] `ASSISTANT_ENABLED = false` en `lib/features.ts`
- [ ] `npm test` y `npm run lint` en verde; `npx tsc --noEmit` sin errores

En el móvil, tras instalar:

- [ ] Copia de seguridad de la v1.3 **hecha y sacada del teléfono**
- [ ] La app abre y el diario está completo (restaurantes, platos, visitas, fotos, etiquetas)
- [ ] Iniciar sesión → la primera sincronización termina sin error
- [ ] Las fotos aparecen en R2 (`[sync] fotos: N subidas`)
- [ ] Ajustes de privacidad: cambiar el general mueve lo que está en «Como mis ajustes»
- [ ] Un amigo ve en su feed lo que compartes
- [ ] Etiquetar a alguien → le llega a su bandeja «Contigo»

Fuera de esta versión: el asistente de IA (fase 7).
