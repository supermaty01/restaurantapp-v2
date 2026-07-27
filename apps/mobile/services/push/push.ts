import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { devLog } from '@/lib/helpers/dev-log';
import { getSupabase } from '@/services/supabase/client';

export { actorFromNotification, visitFromNotification } from './payload';

/**
 * Que el aviso llegue con la app cerrada.
 *
 * Todo lo demás ya funcionaba sin esto: la tabla `notifications`, el trigger, la
 * campana y la pantalla Novedades (migración 0016). El push solo añade que te
 * enteres **sin abrir la app**, y por eso nada de aquí es obligatorio — quien
 * deniegue el permiso conserva la campana entera. Un aviso que solo llega por
 * push es un aviso que se pierde.
 *
 * ## Por qué el permiso no se pide al arrancar
 *
 * Pedirlo en el primer arranque es la forma más rápida de que te lo denieguen
 * para siempre: la pregunta llega antes de que la app haya dado ninguna razón
 * para decir que sí, y en Android 13+ un "no" cierra la puerta hasta que
 * alguien vaya a los ajustes del sistema. El momento con sentido es **justo
 * después de etiquetar a alguien por primera vez**: ahí el aviso ya significa
 * algo concreto, porque acabas de crear el motivo por el que existiría.
 */

/** `ExponentPushToken[…]`, lo que entiende el servicio de Expo. */
export type ExpoPushToken = string;

/**
 * El proyecto de EAS al que pertenece el token.
 *
 * Sin él, `getExpoPushTokenAsync` falla en una build de producción con un error
 * que habla de "projectId" y no de notificaciones. Sale de `app.config.js`, así
 * que no hay una segunda copia que pueda quedarse vieja.
 */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    { eas?: { projectId?: string } | undefined } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Cómo se comporta un aviso con la app abierta: no se muestra.
 *
 * Ya está la campana con su punto, y una notificación del sistema por algo que
 * estás mirando es ruido. Se registra al importar el módulo porque
 * expo-notifications lo consulta en cuanto llega el primer aviso, que puede ser
 * antes de que ninguna pantalla se haya montado.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * El canal de Android.
 *
 * Android 8+ **exige** uno: sin canal, el sistema descarta la notificación en
 * silencio. Y tiene que existir antes de que llegue la primera, no cuando se
 * muestre.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Avisos',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/** Si ya está concedido, sin preguntar nada. */
export async function pushPermissionGranted(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Guarda el token de este dispositivo en la cuenta.
 *
 * Se re-registra en cada arranque con sesión y cuando Expo lo rota: un token no
 * es para siempre —cambia al reinstalar, al restaurar una copia del móvil, y a
 * veces sin motivo aparente— y uno viejo no falla, simplemente entrega a nadie.
 * `register_push_token` es idempotente (0016), así que repetirlo no cuesta.
 */
async function storeToken(token: ExpoPushToken): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.rpc('register_push_token', {
    device_token: token,
    device_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });

  if (error) {
    // No se relanza: quedarse sin push es peor experiencia, no una avería. La
    // app entera sigue funcionando y el próximo arranque lo reintenta.
    devLog('Push', 'no se pudo registrar el token:', error.message);
    return;
  }

  devLog('Push', 'token registrado');
}

/**
 * Pide el token a Expo y lo guarda. Devuelve null si no se pudo.
 *
 * Nunca lanza. Los motivos por los que esto falla —un emulador sin Google Play,
 * unas credenciales de FCM sin subir, un `projectId` que no cuadra— son todos
 * cosas que no debe notar quien está usando el diario.
 */
async function registerToken(): Promise<ExpoPushToken | null> {
  try {
    await ensureAndroidChannel();
    const id = projectId();
    const { data } = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : {});
    if (!data) return null;
    await storeToken(data);
    return data;
  } catch (error) {
    devLog('Push', 'no se pudo obtener el token:', error);
    return null;
  }
}

/**
 * Registra el dispositivo **si el permiso ya está dado**. No pregunta nada.
 *
 * Es lo que corre al iniciar sesión y en cada arranque. Preguntar aquí sería
 * volver a pedirlo al arrancar por la puerta de atrás.
 */
export async function registerPushIfAllowed(): Promise<ExpoPushToken | null> {
  if (!(await pushPermissionGranted())) return null;
  return registerToken();
}

/**
 * Pide el permiso y, si lo dan, registra el dispositivo.
 *
 * Solo se llama desde el momento en que el aviso ya significa algo. Si el
 * sistema ya lo tiene decidido —concedido o denegado para siempre—
 * `requestPermissionsAsync` no muestra nada y devuelve lo que ya había, así que
 * llamarlo de más no molesta a nadie.
 */
export async function requestPushPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.status === 'granted'
        ? current
        : await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true, allowBadge: false },
          });

    if (granted.status !== 'granted') return false;
    await registerToken();
    return true;
  } catch (error) {
    devLog('Push', 'no se pudo pedir el permiso:', error);
    return false;
  }
}
