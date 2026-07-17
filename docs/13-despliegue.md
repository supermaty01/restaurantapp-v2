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
npm run -w apps/mobile start
```

La app arranca en **modo local**: SQLite en el dispositivo, sin cuenta, sin red. Este modo debe funcionar siempre, incluso sin nada de lo que sigue configurado.

Variables (`apps/mobile/.env`):

| Variable                        | Necesaria para                       | Notas                                                      |
| ------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `GOOGLE_MAPS_API_KEY`           | Mapa y autocompletado de direcciones | Restringir la key por app id + SHA en la consola de Google |
| `EXPO_PUBLIC_SUPABASE_URL`      | Cuentas y sync 🚧                    | Vacía = la app oculta el login                             |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Cuentas y sync 🚧                    | Es pública por diseño; la seguridad la da RLS              |
| `EXPO_PUBLIC_API_URL`           | Share links, IA 🚧                   | URL del Worker                                             |

**Decisión:** si faltan las variables de Supabase/API, la app degrada a modo local en vez de fallar. Esto mantiene el principio de "la nube es opcional" también en el arranque de desarrollo.

## 3. Supabase 🚧 (fase 2)

```bash
# Local (desarrollo)
npx supabase start                      # Postgres + Auth + Studio en Docker
npx supabase db reset                   # aplica supabase/migrations/*

# Producción
npx supabase link --project-ref <ref>
npx supabase db push
```

Configuración en el dashboard:

1. **Auth → Providers**: habilitar Email, Google (client id/secret de Google Cloud Console) y Apple (solo si se publica en iOS).
2. **Auth → URL Configuration**: añadir el redirect del deep link (`restaurantapp://auth/callback`) y el del Worker.
3. **Database → Extensions**: habilitar `vector` (pgvector) para la fase 7.
4. Verificar que **RLS está activo en todas las tablas** (`supabase/migrations` lo hace, pero conviene comprobarlo: una tabla sin RLS es una fuga de datos de todos los usuarios).

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
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # solo para operaciones de servidor (borrado de cuenta, cuotas)
npx wrangler secret put SUPABASE_JWT_SECRET         # verificación de tokens
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
