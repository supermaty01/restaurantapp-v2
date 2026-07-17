import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeekProvider } from '@/lib/context/PeekContext';
import { useTheme } from '@/lib/context/ThemeContext';

/**
 * Routing is fully file-based: from SDK 56 expo-router no longer allows
 * declaring react-navigation navigators by hand, which is how v1 did it.
 * Screens are picked up from the folder structure instead.
 */

interface CustomHeaderProps {
  canGoBack: boolean;
  showSettings: boolean;
}

function CustomHeader({ canGoBack, showSettings }: CustomHeaderProps) {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const iconColor = isDarkMode ? '#B27A4D' : '#905c36';

  return (
    <View className="w-full flex-row items-center justify-between p-4 bg-accent dark:bg-dark-accent">
      <View className="w-20">
        {canGoBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={8}
          >
            <Ionicons name="arrow-back-outline" size={24} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>

      <Image source={require('@/assets/burger-logo.png')} className="w-12 h-12" />

      <View className="w-20 items-end">
        {showSettings && (
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Configuración"
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={28} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function MainLayout() {
  const { isDarkMode } = useTheme();

  return (
    <PeekProvider>
      <SafeAreaView className="flex-1 bg-muted dark:bg-dark-muted">
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            header: ({ navigation, route }) => (
              <CustomHeader
                canGoBack={navigation.canGoBack()}
                showSettings={route.name !== 'settings/index'}
              />
            ),
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaView>
    </PeekProvider>
  );
}
