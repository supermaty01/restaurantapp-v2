import 'dotenv/config';

const BUNDLE_ID = 'com.supermaty01.restaurantapp';

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
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'acb4a328-034e-4fa5-8381-226436faaf98',
    },
  },
};
