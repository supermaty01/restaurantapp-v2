# 15 — Notificaciones push

Estado: **la mitad de servidor está hecha y probada; el push está apagado a la
espera de credenciales.** Este documento es el reparto: lo que tienes que hacer
tú (que es todo lo que involucra cuentas y secretos) y lo que queda por escribir
después.

El aviso in-app ya funciona sin nada de esto: `notifications` + trigger + la
pantalla Novedades (migración 0016). El push solo añade que el aviso llegue
**con la app cerrada**.

---

## 0. Por qué hace falta tu parte

Enviar una notificación a un teléfono Android exige una credencial emitida por
Google para *tu* aplicación. No es algo que se pueda generar desde el repo ni
que yo pueda pedir prestado: va firmada contra el nombre del paquete y vive en
tu cuenta.

Concretamente son **dos ficheros distintos** y se confunden constantemente:

| Fichero                       | Qué es                                                  | ¿Secreto?                            | Dónde va                       |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------ | ------------------------------ |
| `google-services.json`        | Identificadores públicos de la app en Firebase          | **No.** Se puede commitear           | En el repo, junto a la app     |
| Clave de cuenta de servicio   | La llave privada con la que se **envían** notificaciones | **Sí. Nunca al repo**                | Subida a EAS, y en tu disco    |

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

### 1.5 Comprobación

- `eas credentials` → Android → production debe listar la FCM V1 key.
- Con el APK nuevo instalado y sesión iniciada, en Ajustes debería aparecer el
  token de push (lo dejaré visible ahí a propósito mientras se depura).
- Un token válido empieza por `ExponentPushToken[`.

---

## 2. Lo que queda por escribir (mi parte)

Nada de esto necesita esperar a las credenciales salvo la prueba final.

1. **`expo-notifications`** como dependencia y en `plugins`.

2. **Pedir permiso en el momento correcto**, no al arrancar. Pedirlo en el
   primer arranque es la forma más rápida de que te lo denieguen para siempre:
   la pregunta llega antes de que la app haya dado ninguna razón para decir que
   sí. El momento con sentido aquí es **justo después de etiquetar a alguien por
   primera vez**, que es cuando el aviso ya significa algo.

3. **Registrar el token** con `register_push_token(token, platform)` — la RPC y
   la tabla `device_push_tokens` ya existen desde 0016, con RLS por dueño. Se
   re-registra al iniciar sesión y cuando Expo lo rota.

4. **El envío, en el Worker.** Lee `notifications` con `pushed_at is null`,
   agrupa por destinatario, busca sus tokens y hace POST a
   `https://exp.host/--/api/v2/push/send`. Marca `pushed_at` **solo con la
   respuesta del servicio en la mano** — si se marca antes y la petición falla,
   el aviso no se envía nunca y nadie se entera.

   El índice parcial `notifications_pending_push_idx` ya está creado para que
   esa consulta no recorra la tabla.

5. **Disparo.** La opción barata es un cron de Cloudflare cada pocos minutos.
   Un push que tarda dos minutos sigue siendo un push; montar un webhook desde
   Postgres para ganar ese tiempo no compensa la pieza extra que hay que
   mantener.

6. **Retirar tokens muertos.** Expo responde `DeviceNotRegistered` cuando alguien
   desinstala. Si no se borra la fila, ese token se reintenta en cada pasada para
   siempre.

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
