# 15 — Notificaciones push

Estado: **el código está entero, a los dos lados.** Lo único que queda es tuyo
y externo: confirmar que la clave de cuenta de servicio está subida a EAS,
generar un APK nuevo —`expo-notifications` es un módulo nativo, no una recarga
de JavaScript— y desplegar el Worker.

Este documento es el reparto: lo que tienes que hacer tú (que es todo lo que
involucra cuentas y secretos) y cómo está montada mi parte.

El aviso in-app ya funciona sin nada de esto: `notifications` + trigger + la
pantalla Novedades (migración 0016). El push solo añade que el aviso llegue
**con la app cerrada**.

---

## 0. Por qué hace falta tu parte

Enviar una notificación a un teléfono Android exige una credencial emitida por
Google para _tu_ aplicación. No es algo que se pueda generar desde el repo ni
que yo pueda pedir prestado: va firmada contra el nombre del paquete y vive en
tu cuenta.

Concretamente son **dos ficheros distintos** y se confunden constantemente:

| Fichero                     | Qué es                                                   | ¿Secreto?                  | Dónde va                    |
| --------------------------- | -------------------------------------------------------- | -------------------------- | --------------------------- |
| `google-services.json`      | Identificadores públicos de la app en Firebase           | **No.** Se puede commitear | En el repo, junto a la app  |
| Clave de cuenta de servicio | La llave privada con la que se **envían** notificaciones | **Sí. Nunca al repo**      | Subida a EAS, y en tu disco |

Mezclarlos es el error clásico: con solo el primero la app se registra pero no
recibe nada, y con solo el segundo el envío no encuentra a quién mandárselo.

> **No me pases nunca el contenido de la clave de cuenta de servicio**, ni por
> chat ni pegándola en un fichero del proyecto. La subes tú a EAS y yo no
> necesito verla en ningún momento.

---

## 1. Tu parte, paso a paso

### 1.1 Proyecto de Firebase

1. Entra en [console.firebase.google.com](https://console.firebase.google.com) y
   crea un proyecto (o reutiliza uno).
2. Añade una **app de Android** dentro del proyecto.
3. El nombre del paquete tiene que ser **exactamente** el de la app:

   ```
   com.supermaty01.restaurantapp
   ```

   Sale de `BUNDLE_ID` en `apps/mobile/app.config.js`. Si no coincide al
   carácter, el registro falla en silencio: la app pide un token, Google lo
   emite para otra aplicación y las notificaciones simplemente no llegan.

### 1.2 `google-services.json`

1. Descárgalo desde la ficha de esa app de Android en Firebase.
2. Déjalo en **`apps/mobile/google-services.json`**.
3. Avísame y yo añado la línea en `app.config.js`:

   ```js
   android: {
     googleServicesFile: './google-services.json',
     …
   }
   ```

Este sí va al repo: solo contiene identificadores públicos.

### 1.3 La clave de cuenta de servicio (FCM V1)

1. En Firebase: **Configuración del proyecto → Cuentas de servicio**.
2. **Generar nueva clave privada** → confirmar. Se descarga un `.json`.
3. Guárdalo fuera del repo. Si por lo que sea lo dejas dentro, que sea con una
   entrada en `.gitignore` **antes** de guardarlo.
4. Súbelo a EAS:

   ```bash
   cd apps/mobile
   eas credentials
   ```

   Y en el menú:

   ```
   Android → production → Google Service Account
     → Manage your Google Service Account Key for Push Notifications (FCM V1)
     → Set up a Google Service Account Key for Push Notifications (FCM V1)
     → Upload a new service account key
   ```

   Si dejaste el `.json` en el directorio del proyecto, la CLI lo detecta y solo
   hay que confirmar con `Y`.

### 1.4 Reconstruir el APK

Añadir `expo-notifications` es un módulo nativo y `googleServicesFile` cambia la
configuración nativa, así que **el APK que tienes instalado no vale**: hay que
generar uno nuevo. No es una actualización de JavaScript.

Cuando estén los dos ficheros y yo haya metido el módulo:

```bash
eas build -p android --profile preview
```

### 1.5 Desplegar el Worker

El envío vive en un cron de Cloudflare, y un cron sin desplegar no se dispara:

```bash
cd apps/api
npx wrangler deploy
```

Comprueba en el panel de Cloudflare que el Worker lista **dos** triggers
(`*/5 * * * *` y `0 3 * * *`). Si solo aparece uno, el `wrangler.toml` que se
desplegó es el viejo.

### 1.6 Comprobación

- `eas credentials` → Android → production debe listar la FCM V1 key.
- Con el APK nuevo instalado y sesión iniciada, **Ajustes → Avisos** dice si el
  permiso está concedido, y deja activarlo desde ahí.
- Etiqueta a la otra cuenta desde este móvil, cierra la app en el otro y espera
  hasta cinco minutos: ese es el periodo del cron.
- Si no llega, mira en este orden: ¿hay fila en `device_push_tokens` para esa
  cuenta? ¿hay filas en `notifications` con `pushed_at is null` más viejas de
  cinco minutos? Lo primero es un problema de permiso o de credenciales en el
  móvil; lo segundo, del Worker (`npx wrangler tail`).

---

## 2. Cómo está montado (mi parte)

Todo esto ya está escrito. Queda aquí porque las decisiones son lo que hay que
volver a leer cuando algo no llegue.

### En la app

1. **`expo-notifications`** como dependencia y en `plugins`
   (`apps/mobile/app.config.js`), con el icono y el color de la app: los del
   sistema son un cuadrado blanco.

2. **El permiso se pide justo después de etiquetar a alguien por primera vez**
   (`services/push/usePushPrompt.ts`), no al arrancar. Pedirlo en el primer
   arranque es la forma más rápida de que te lo denieguen para siempre: la
   pregunta llega antes de que la app haya dado ninguna razón para decir que sí,
   y en Android 13+ un "no" cierra la puerta hasta que alguien vaya a los
   ajustes del sistema.

   Por eso son **dos preguntas**: primero la nuestra, que se puede repetir, y
   solo si dice que sí la del sistema, que no. Y una sola vez en la vida de la
   instalación, dijera lo que dijera: insistir en cada etiqueta convierte una
   buena pregunta en una mala.

   Quien contestó "ahora no" puede cambiar de idea en **Ajustes → Avisos**. Si
   el sistema ya lo tiene denegado para siempre, esa fila abre los ajustes del
   teléfono, porque es el único sitio donde eso se deshace.

3. **El token se registra** con `register_push_token(token, platform)` en cada
   arranque con sesión (`components/PushRunner.tsx`). Repetirlo no cuesta —la
   RPC es idempotente— y hace falta: un token cambia al reinstalar, al restaurar
   una copia del móvil y a veces solo, y uno viejo no da error, simplemente
   entrega a nadie.

4. **Tocar el aviso abre la visita.** Con el listener _y_
   `getLastNotificationResponseAsync`, que no es redundancia: si la app estaba
   cerrada, el toque es lo que la ha abierto y el evento ya había pasado antes
   de que existiera nada a lo que escuchar.

### En el Worker

5. **El envío** (`apps/api/src/push.ts`). Lee `notifications` con `pushed_at is
null`, agrupa por destinatario, busca sus tokens y hace POST a
   `https://exp.host/--/api/v2/push/send`, de cien en cien, que es el tope de
   Expo. Marca `pushed_at` **solo con la respuesta del servicio en la mano**: si
   se marca antes y la petición falla, el aviso no se envía nunca y nadie se
   entera. El otro fallo posible —mandarlo dos veces— se nota y se corrige solo.

   El índice parcial `notifications_pending_push_idx` cubre esa consulta.

   El nombre de quien etiquetó y el del restaurante van en **consultas aparte**,
   no encadenadas al `select`: `notifications.actor_id` apunta a `auth.users`,
   igual que `profiles.user_id`, así que PostgREST no puede embeber una desde la
   otra —no hay clave ajena directa— y devolvería un 400. Y un join a una visita
   borrada sacaría la fila entera del resultado, dejando ese aviso sin enviar
   para siempre en vez de salir con un nombre genérico.

   A quien no tiene ningún dispositivo registrado se le marca igual. Quien no ha
   dado permiso no lo va a dar porque su aviso siga en la cola, y sin marcarlo la
   consulta de pendientes crece sin parar.

6. **Disparo:** cron de Cloudflare cada cinco minutos, en `wrangler.toml`. Un
   push que tarda cinco minutos sigue siendo un push; montar un webhook desde
   Postgres para ganar ese tiempo no compensa la pieza extra que mantener.

   El manejador `scheduled` está en `src/index.ts`. **Esto era una trampa
   silenciosa:** `export default app` exporta solo `fetch`, así que el
   `[triggers]` que ya existía se disparaba contra un Worker sin `scheduled` y
   no hacía nada, sin error, porque no hay a quién dárselo.

7. **Los tokens muertos se retiran.** Expo responde `DeviceNotRegistered` cuando
   alguien desinstala; sin borrar la fila, ese token se reintenta en cada pasada
   para siempre.

### Lo que lo prueba

Doce tests en `apps/api/test/push.test.ts` sobre el reparto entero —agrupar,
trocear, marcar, retirar— sin Supabase ni red, porque lo que se rompe en un
push no es la petición HTTP sino a quién se le manda y qué se hace con la
respuesta. Y `apps/mobile/services/push/__tests__/payload.node.test.ts`
comprueba que los dos repos llaman igual al campo que lleva la visita: si dejan
de coincidir no falla nada — el aviso llega, se toca, y la app abre la pantalla
de inicio.

### Decisiones ya tomadas

- **Expo Push y no FCM directo.** Es gratis, ya estamos en EAS, y evita meter el
  SDK de Firebase en la app. La restricción de que todo quepa en free tiers
  (docs/00) descarta las alternativas de pago sin más discusión.
- **Solo Android por ahora.** iOS necesita cuenta de desarrollador de Apple de
  pago; cuando exista, aquí solo cambia el paso 1.
- **Una clase de aviso para empezar** (`tagged_in_visit`). La tabla ya es
  genérica por `kind`, así que añadir "te han mandado solicitud de amistad" es
  una fila más y no una migración.

---

## 3. Qué esperar cuando funcione

- El aviso llega con la app cerrada. Al tocarlo abre la visita compartida.
- Con la app abierta **no** se muestra notificación del sistema: ya está la
  campana con su punto, y una notificación por algo que estás mirando es ruido.
- Sigue funcionando todo sin permiso concedido: quien lo deniegue conserva la
  campana y Novedades. El push es un extra, nunca el único camino por el que se
  entera de algo.

---

Fuentes de la parte de credenciales, por si cambian:
[Obtain Google Service Account Keys using FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/) ·
[Push notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) ·
[Sending notifications with Expo](https://docs.expo.dev/push-notifications/sending-notifications/)
