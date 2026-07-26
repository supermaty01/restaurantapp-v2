import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeekProvider } from '@/lib/context/PeekContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { ASSISTANT_ENABLED } from '@/lib/features';

/**
 * Routing is fully file-based: from SDK 56 expo-router no longer allows
 * declaring react-navigation navigators by hand, which is how v1 did it.
 * Screens are picked up from the folder structure instead.
 *
 * The header follows the Clay design (docs/14): a back chevron and the screen's
 * own title, left aligned. v1 centred the burger logo on every screen, which
 * looked pleasant and told you nothing about where you were.
 */
function ScreenHeader({ title, canGoBack }: { title: string; canGoBack: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View className="w-full flex-row items-center gap-3.5 bg-canvas px-5 pb-2.5 pt-3.5">
      {canGoBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
      ) : null}
      <Text className="flex-1 font-display text-[22px] text-ink" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

export default function MainLayout() {
  const { isDarkMode, colors } = useTheme();

  return (
    <PeekProvider>
      <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'left', 'right']}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.canvas },
            header: ({ navigation, options, route }) => (
              <ScreenHeader
                title={options.title ?? route.name}
                canGoBack={navigation.canGoBack()}
              />
            ),
          }}
        >
          {/* The tab bar carries its own headers. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          <Stack.Screen name="search" options={{ title: 'Buscar' }} />
          <Stack.Screen name="tags/index" options={{ title: 'Etiquetas' }} />
          <Stack.Screen name="friends/index" options={{ title: 'Amigos' }} />
          <Stack.Screen name="friends/search" options={{ title: 'Buscar personas' }} />
          <Stack.Screen name="friends/[id]" options={{ title: 'Perfil' }} />
          {/* Sin cabecera: la pantalla trae la suya, con el botón de volver y
              el rótulo "Visita compartida". Sin registrarla aquí, expo-router
              usa el nombre del fichero y sale un título "shared/[visit]". */}
          <Stack.Screen name="shared/[visit]" options={{ headerShown: false }} />
          <Stack.Screen name="profile-edit" options={{ title: 'Editar perfil' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Ajustes' }} />
          <Stack.Screen name="account" options={{ title: 'Tu cuenta' }} />
          <Stack.Screen name="map" options={{ title: 'Mapa' }} />
          {/* Sin pantalla registrada no hay a dónde navegar: una función
              apagada no debe dejar una puerta a la que llegue un enlace viejo. */}
          {ASSISTANT_ENABLED ? (
            <Stack.Screen name="assistant" options={{ title: 'Asistente' }} />
          ) : null}

          <Stack.Screen name="restaurants/new" options={{ title: 'Nuevo restaurante' }} />
          <Stack.Screen name="restaurants/[id]/view" options={{ title: 'Restaurante' }} />
          <Stack.Screen name="restaurants/[id]/edit" options={{ title: 'Editar restaurante' }} />
          <Stack.Screen name="dishes/new" options={{ title: 'Nuevo plato' }} />
          <Stack.Screen name="dishes/[id]/view" options={{ title: 'Plato' }} />
          <Stack.Screen name="dishes/[id]/edit" options={{ title: 'Editar plato' }} />
          <Stack.Screen name="visits/new" options={{ title: 'Nueva visita' }} />
          <Stack.Screen name="visits/[id]/view" options={{ title: 'Visita' }} />
          <Stack.Screen name="visits/[id]/edit" options={{ title: 'Editar visita' }} />
        </Stack>
      </SafeAreaView>
    </PeekProvider>
  );
}
