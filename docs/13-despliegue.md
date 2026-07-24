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

Todas las dependencias son compatibles con **Expo Go**, así que basta escanear el QR — no hace falta development build.

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
eas build -p android --profile preview      # APK de prueba
eas build -p android --profile production
eas submit -p android --profile production
```

Los secrets de build se gestionan con `eas secret:push` (no `.env` en el repo). Deep links: `app.config.js` declara el scheme y los App Links/Universal Links del dominio de share (fase 4).

## 7. Checklist de despliegue completo

- [ ] App arranca en modo local sin ninguna variable configurada
- [ ] Migraciones Supabase aplicadas y **RLS activo en todas las tablas**
- [ ] Providers de auth configurados con sus redirects
- [ ] Worker desplegado; secrets cargados; `GET /health` responde
- [ ] Bucket R2 creado; subida y lectura de imagen verificadas
- [ ] AI Gateway creado, con rate limiting y caché
- [ ] Build de la app apuntando a las URLs de producción
- [ ] Prueba end-to-end: crear cuenta → sync entre dos dispositivos → compartir link → abrir link → asistente responde una pregunta
