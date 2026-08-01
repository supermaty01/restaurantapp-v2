import 'dotenv/config';

const BUNDLE_ID = 'com.supermaty01.restaurantapp';

/**
 * Android instala una actualización solo si el versionCode **sube**.
 *
 * Aquí no había ninguno y Expo pone 1 por defecto, así que la build se negaba a
 * instalarse encima de la v1 con un "App not installed" que no explica nada.
 * Hasta ahí, bien. Lo que estaba mal era el número.
 *
 * **Este comentario decía que la v1.3 salió con `versionCode: 1`. Es falso:
 * salió con 6.** Comprobado contra el histórico de builds del propio proyecto:
 *
 * ```bash
 * eas build:list --platform android --limit 25
 * ```
 *
 * v1.1.0 y v1.2.x fueron con 5 y la v1.3.0 con 6, todas en este mismo proyecto
 * de EAS. O sea que subir a 2 no arreglaba nada: 2 sigue siendo menor que 6, y
 * Android rechaza el downgrade con exactamente el mismo mensaje. El síntoma no
 * cambió y por eso parecía que el arreglo no había servido — había servido para
 * pasar de 1 a 2, que era el problema equivocado.
 *
 * Es un número aparte de `version` a propósito: el de la tienda tiene que
 * crecer aunque la versión visible no. Y **solo puede subir**; lo vigila
 * `version-code.node.test.ts`.
 *
 * No se usa `autoIncrement` de EAS, que sería lo ideal: con
 * `appVersionSource: "local"` tendría que reescribir este fichero, y no sabe
 * hacerlo en una configuración dinámica (`app.config.js`), solo en `app.json`.
 */
const VERSION_CODE = 7;

/**
 * Lo que la app necesita saber en tiempo de compilación.
 *
 * Las EXPO_PUBLIC_* se incrustan en el bundle al compilar, no se leen al
 * arrancar. Si faltan, la build sale bien y la app queda muda: sin Supabase, sin
 * Worker, sin poder decir por qué. Y `.env` está en .gitignore, así que en EAS
 * no existe salvo que se declaren como variables de entorno del proyecto.
 *
 * Mejor romper aquí, donde el mensaje dice cuál falta.
 */
const REQUIRED_ENV = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_URL',
];

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  const message = `Faltan variables de entorno: ${missing.join(', ')}`;
  // En una build de EAS es un fallo: instalar esto sería instalar una app rota.
  // En local es un aviso, porque el modo puramente local sigue siendo válido.
  if (process.env.EAS_BUILD === 'true') throw new Error(message);
  console.warn(`[app.config] ${message} — la app funcionará solo en local.`);
}

/** @type {import('expo/config').ExpoConfig} */
export default {
  name: 'RestaurantApp',
  slug: 'restaurantapp',
  version: '2.0.0',
  orientation: 'portrait',
  icon: './assets/burger-logo-fondo.png',
  scheme: 'restaurantapp',
  userInterfaceStyle: 'automatic',
  // New Architecture is the only supported mode from SDK 55 onwards.
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Keeps v1 backup files openable from Files/AirDrop.
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'RestoShare File',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Owner',
          LSItemContentTypes: [`${BUNDLE_ID}.restoshare`],
        },
      ],
      UTExportedTypeDeclarations: [
        {
          UTTypeIdentifier: `${BUNDLE_ID}.restoshare`,
          UTTypeDescription: 'RestoShare File',
          UTTypeConformsTo: ['public.data', 'public.json'],
          UTTypeTagSpecification: {
            'public.filename-extension': ['restoshare'],
          },
        },
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/burger-logo-fondo.png',
      backgroundColor: '#DFE2CF',
    },
    package: BUNDLE_ID,
    versionCode: VERSION_CODE,
    // Registro de la app en Firebase, que es de donde FCM saca a quién entregar
    // una notificación. Solo lleva identificadores públicos —número de proyecto,
    // id de app, clave de API restringida por paquete—, así que va al repo; la
    // que **no** va nunca es la clave de cuenta de servicio, que es la que
    // firma los envíos y vive en EAS. Ver docs/15.
    googleServicesFile: './google-services.json',
    // `edgeToEdgeEnabled` no longer exists: Android 16 makes edge-to-edge
    // mandatory, so the option was removed from the Expo config.
    config: {
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY },
    },
    intentFilters: [
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [
          { scheme: 'file', mimeType: 'application/octet-stream', pathPattern: '.*\\.restoshare' },
          {
            scheme: 'content',
            mimeType: 'application/octet-stream',
            pathPattern: '.*\\.restoshare',
          },
        ],
      },
    ],
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/burger-logo.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#DFE2CF',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'RestaurantApp usa tu ubicación para situar restaurantes.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'RestaurantApp accede a tus fotos para añadirlas a tus platos y visitas.',
        cameraPermission: 'RestaurantApp usa la cámara para fotografiar tus platos.',
      },
    ],
    // Módulo nativo: el APK instalado no vale, hay que generar uno nuevo. No es
    // una recarga de JavaScript. El icono y el color son los del sistema si no
    // se dicen, y el del sistema es un cuadrado blanco.
    [
      'expo-notifications',
      {
        icon: './assets/burger-logo.png',
        color: '#C2603C',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  // Una build por versión de app: mientras no haya expo-updates, esto solo
  // etiqueta la build, pero deja el campo puesto para cuando lo haya.
  runtimeVersion: { policy: 'appVersion' },
  extra: {
    router: {},
    eas: {
      projectId: 'acb4a328-034e-4fa5-8381-226436faaf98',
    },
  },
};
