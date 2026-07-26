import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { useDialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { useAuth, type OAuthProvider } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { useSync } from '@/lib/hooks/useSync';
import { linkLocalData } from '@/services/sync/linkLocalData';
import { countPendingChanges } from '@/services/sync/pendingCount';

/**
 * Optional account + sync screen (docs/04). Local-first: the app works without
 * ever visiting this. When configured, sign in to enable sync; when not, it
 * explains the app is fully local.
 */
export default function AccountScreen() {
  const { colors } = useTheme();
  const {
    isConfigured,
    session,
    accountUuid,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
  } = useAuth();
  const db = useDatabase();
  const router = useRouter();
  const { status, lastOutcome, syncNow } = useSync();
  const { ask, tell } = useDialog();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isConfigured) {
    return (
      <ScrollView className="flex-1 bg-canvas p-4">
        <View className="bg-surface p-4 rounded-xl">
          <Text className="text-lg font-bold text-ink mb-2">Modo local</Text>
          <Text className="text-ink-muted">
            La app funciona completamente sin cuenta: tus datos viven en este dispositivo. Las
            cuentas y la sincronización se activan cuando se configura el servicio.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const runAuth = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      void tell({
        title: 'No se pudo continuar',
        message: error,
        icon: 'alert-circle-outline',
        destructive: true,
      });
    }
  };

  /*
   * Cerrar sesión es la acción que más se lamenta de esta pantalla: se toca por
   * error al buscar otra cosa, y si queda algo sin subir se pierde el único
   * momento en que podía subirse. Así que pregunta, y si hay pendientes lo dice
   * en la propia pregunta en vez de dejarlo para después.
   */
  const confirmSignOut = async () => {
    const pending = await countPendingChanges(db);
    const confirmed = await ask({
      title: '¿Cerrar sesión?',
      message:
        pending > 0
          ? `Quedan ${pending} cambios sin subir. Si cierras ahora, se quedan en este móvil hasta que vuelvas a entrar.`
          : 'Tu diario se queda en este teléfono. Podrás volver a entrar cuando quieras.',
      icon: 'log-out-outline',
      confirmLabel: pending > 0 ? 'Cerrar de todas formas' : 'Cerrar sesión',
      cancelLabel: 'Cancelar',
      destructive: pending > 0,
    });
    if (confirmed) await signOut();
  };

  const handleLink = async () => {
    const count = await linkLocalData(db);
    // Un resultado que no pide decisión no merece un modal que descartar.
    toast.notify(
      count === 0
        ? 'Tus datos ya estaban sincronizados'
        : `Se subirán ${count} elementos en la próxima sincronización`,
    );
    await syncNow();
  };

  if (session && accountUuid) {
    return (
      <ScrollView className="flex-1 bg-canvas p-4">
        <View className="bg-surface p-4 rounded-xl mb-4">
          <Text className="text-lg font-bold text-ink">Tu cuenta</Text>
          <Text className="text-ink-muted mt-1">{session.user.email}</Text>
        </View>

        <View className="bg-surface p-4 rounded-xl mb-4">
          <Text className="text-base font-bold text-ink mb-2">Sincronización</Text>
          <Text className="text-ink-muted mb-3">
            {status === 'syncing'
              ? 'Sincronizando…'
              : lastOutcome
                ? lastOutcome.ok
                  ? `Última sincronización correcta.`
                  : `Error: ${lastOutcome.error}`
                : 'Aún no se ha sincronizado.'}
          </Text>
          <TouchableOpacity
            onPress={() => void syncNow()}
            className="flex-row items-center bg-primary rounded-md px-4 py-2 self-start"
          >
            <Ionicons name="sync" size={18} color="#fff" />
            <Text className="text-on-primary font-semibold ml-2">Sincronizar ahora</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void handleLink()} className="mt-3 self-start">
            <Text className="text-primary">Subir mis datos locales</Text>
          </TouchableOpacity>
          {/* "Última sincronización correcta" dice que el proceso no falló, no
              que la copia esté completa. La diferencia solo se nota el día que
              se pierde el teléfono, así que hay que poder mirarla antes. */}
          <TouchableOpacity
            onPress={() => router.push('/(main)/sync-status')}
            className="mt-3 self-start"
          >
            <Text className="text-primary">¿Está todo en la nube?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => void confirmSignOut()}
          className="bg-danger rounded-md px-4 py-3 items-center"
        >
          <Text className="text-on-primary font-semibold">Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-canvas p-4" keyboardShouldPersistTaps="handled">
      <View className="bg-surface p-4 rounded-xl">
        <Text className="text-lg font-bold text-ink mb-1">Crear cuenta o iniciar sesión</Text>
        <Text className="text-ink-muted mb-4">
          Opcional. Sincroniza tus datos entre dispositivos y habilita amigos y compartir.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo"
          autoCapitalize="none"
          keyboardType="email-address"
          className="min-h-12 px-4 mb-3 border border-line rounded-lg bg-surface text-ink"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          secureTextEntry
          className="min-h-12 px-4 mb-4 border border-line rounded-lg bg-surface text-ink"
        />

        <TouchableOpacity
          disabled={busy}
          onPress={() => void runAuth(() => signInWithEmail(email.trim(), password))}
          className="bg-primary rounded-md py-3 items-center mb-2"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-on-primary font-semibold">Iniciar sesión</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          disabled={busy}
          onPress={() => void runAuth(() => signUpWithEmail(email.trim(), password))}
          className="py-2 items-center mb-4"
        >
          <Text className="text-primary">Crear cuenta nueva</Text>
        </TouchableOpacity>

        {(['google', 'apple'] as OAuthProvider[]).map((provider) => (
          <TouchableOpacity
            key={provider}
            disabled={busy}
            onPress={() => void runAuth(() => signInWithOAuth(provider))}
            className="flex-row items-center justify-center border border-line rounded-md py-3 mb-2"
          >
            <Ionicons name={`logo-${provider}`} size={20} color={colors.primary} />
            <Text className="text-ink font-semibold ml-2">
              Continuar con {provider === 'google' ? 'Google' : 'Apple'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
