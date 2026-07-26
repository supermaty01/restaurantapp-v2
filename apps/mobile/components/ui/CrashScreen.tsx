import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { lightColors } from '@/lib/design/tokens';

/**
 * The last thing standing between a bug and a white screen.
 *
 * In development a render error draws the red box and you fix it. In a release
 * build there is no red box: the tree unmounts and the app is a blank rectangle
 * with no way back, which for a diary someone opens in a restaurant is the
 * worst possible failure — indistinguishable from "my data is gone".
 *
 * Deliberately built from primitives and hard-coded colours. It has to render
 * when the thing that failed *is* the theme provider, or the database, or the
 * fonts. Anything it imported could be the thing that is broken.
 *
 * The message is not reassuring on purpose. It says the diary is intact,
 * because that is the question the person actually has, and it shows the real
 * error because the only person who can act on it is the one reading it.
 */
export function CrashScreen({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: lightColors.canvas, padding: 24 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Ionicons name="alert-circle-outline" size={44} color={lightColors.danger} />
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: lightColors.ink,
              textAlign: 'center',
            }}
          >
            Algo se rompió
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: lightColors.inkMuted,
              textAlign: 'center',
            }}
          >
            Tu diario está intacto: esto es un fallo de la pantalla, no de tus datos. Nada se ha
            borrado.
          </Text>
        </View>

        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: lightColors.line,
            backgroundColor: lightColors.surface,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 12, color: lightColors.inkSubtle, marginBottom: 6 }}>
            Detalle del error
          </Text>
          <Text style={{ fontSize: 13, color: lightColors.ink }} selectable>
            {error.message || 'Sin mensaje'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          onPress={retry}
          style={{
            backgroundColor: lightColors.primary,
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: lightColors.onPrimary, fontWeight: '700', fontSize: 15 }}>
            Reintentar
          </Text>
        </Pressable>

        <Text
          style={{
            fontSize: 12,
            color: lightColors.inkSubtle,
            textAlign: 'center',
          }}
        >
          Si vuelve a pasar, haz una copia de seguridad desde Ajustes antes de nada.
        </Text>
      </ScrollView>
    </View>
  );
}
