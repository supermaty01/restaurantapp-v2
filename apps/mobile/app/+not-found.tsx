import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';
import { SHARE_FILE_EXTENSION } from '@/services/share/types';

export default function NotFoundScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const [checking, setChecking] = useState(true);
  const [isFileImport, setIsFileImport] = useState(false);

  useEffect(() => {
    const checkIfFileImport = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        const urlToCheck = initialUrl || pathname || '';

        const isFileRelated =
          urlToCheck.includes(SHARE_FILE_EXTENSION) ||
          urlToCheck.includes('restoshare') ||
          urlToCheck.includes('content://') ||
          urlToCheck.includes('file://') ||
          urlToCheck.includes('provider') ||
          urlToCheck.includes('media/item');

        if (isFileRelated) {
          setIsFileImport(true);

          let fileUri = '';

          if (urlToCheck.startsWith('content://') || urlToCheck.startsWith('file://')) {
            fileUri = urlToCheck;
          } else {
            let pathPart = pathname;
            if (pathPart.startsWith('/')) {
              pathPart = pathPart.substring(1);
            }

            if (pathPart.includes('provider') || pathPart.includes('.')) {
              fileUri = 'content://' + pathPart;
            } else if (initialUrl) {
              fileUri = initialUrl;
            }
          }

          if (fileUri) {
            setTimeout(() => {
              router.replace({
                pathname: '/import',
                params: { uri: encodeURIComponent(fileUri) },
              });
            }, 100);
            return;
          }
        }

        setChecking(false);
      } catch {
        setChecking(false);
      }
    };

    checkIfFileImport();
  }, [pathname, router]);

  if (checking || isFileImport) {
    return (
      <View className={`flex-1 justify-center items-center ${isDarkMode ? 'bg-dark-muted' : 'bg-muted'}`}>
        <ActivityIndicator size="large" color={isDarkMode ? '#7A9455' : '#93AE72'} />
        <Text className={`mt-4 text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Procesando...
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-1 justify-center items-center p-6 ${isDarkMode ? 'bg-dark-muted' : 'bg-muted'}`}>
      <Ionicons name="alert-circle-outline" size={64} color={isDarkMode ? '#888' : '#666'} />
      <Text className={`mt-4 text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        Página no encontrada
      </Text>
      <Text className={`mt-2 text-base text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        La página que buscas no existe.
      </Text>
      <TouchableOpacity
        className="mt-6 bg-primary dark:bg-dark-primary px-6 py-3 rounded-xl"
        onPress={() => router.replace('/')}
      >
        <Text className="text-white font-semibold">Volver al inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

