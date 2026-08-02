import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';

import FormInput from '@/components/FormInput';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { Card } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useAuth, type OAuthProvider } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { APPLE_SIGN_IN_ENABLED } from '@/lib/features';
import { credentialsSchema, type Credentials } from '@/lib/helpers/credentials-schema';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { useSync } from '@/lib/hooks/useSync';
import { countUnclaimedRows, linkLocalData } from '@/services/sync/linkLocalData';
import { countPendingChanges } from '@/services/sync/pendingCount';
import { SYNC_LABEL } from '@/services/sync/syncStore';

/**
 * Optional account + sync screen (docs/04). Local-first: the app works without
 * ever visiting this. When configured, sign in to enable sync; when not, it
 * explains the app is fully local.
 *
 * ## Entrar y registrarse dejan de ser una adivinanza
 *
 * Antes había un botón grande «Iniciar sesión» y un enlace «Crear cuenta nueva»
 * debajo, los dos sobre los mismos dos campos. Con un correo que aún no existe,
 * el primero contesta «el correo o la contraseña no son correctos» — que suena a
 * que te has equivocado escribiendo, cuando lo que pasa es que hace falta el
 * otro botón. Ahora se elige primero qué se va a hacer, y el formulario dice lo
 * que va a pasar.
 *
 * Y registrarse tenía un final que no se contaba: con la confirmación de correo
 * activada, `signUp` responde **sin sesión y sin error**. La pantalla no
 * cambiaba de estado ni decía nada, así que pulsar el botón parecía no hacer
 * absolutamente nada. Ver `SignUpResult` en `AuthContext`.
 */
type Mode = 'signIn' | 'signUp';

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
  /*
   * `?welcome=1` lo pone el onboarding.
   *
   * Es lo que arregla el callejón sin salida que se vivía: se elegía «ya tengo
   * cuenta», se entraba, empezaba a sincronizar… y no había ninguna salida hacia
   * el diario. La única forma de seguir era el gesto de volver atrás, que en una
   * pantalla a la que acabas de llegar no se le ocurre a nadie.
   *
   * Solo desde ahí: en Ajustes, un botón «ir a mi diario» sobraría, porque a
   * Ajustes se llega desde el diario.
   */
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const fromOnboarding = welcome === '1';
  const { status, lastOutcome, rows, photos, syncNow } = useSync();
  const { ask, tell } = useDialog();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('signIn');
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
    // Al enviar y luego en cada tecla: el primer aviso no llega mientras se
    // escribe algo que todavía no está terminado, y una vez avisado el error se
    // apaga en cuanto se corrige.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  if (!isConfigured) {
    return (
      <ScrollView className="flex-1 bg-canvas" contentContainerClassName="p-5 gap-4">
        <Card className="gap-2 p-4">
          <Txt variant="title">Modo local</Txt>
          <Txt variant="callout" tone="muted">
            La app funciona completamente sin cuenta: tus datos viven en este dispositivo. Las
            cuentas y la sincronización se activan cuando se configura el servicio.
          </Txt>
        </Card>
      </ScrollView>
    );
  }

  const fail = (message: string) =>
    tell({
      title: 'No se pudo continuar',
      message,
      icon: 'alert-circle-outline',
      destructive: true,
    });

  /*
   * Entrar termina en el diario, no aquí.
   *
   * Con Google ya pasaba —el redirect aterriza en `auth/callback`, que hace
   * exactamente este `replace`— y con correo y contraseña no, porque no hay
   * ningún redirect: la sesión aparece y la pantalla simplemente se vuelve a
   * pintar mostrando el bloque de sincronización. Desde fuera eso se lee como
   * «he entrado y me ha dejado en los ajustes», que además es la pantalla que
   * uno acaba de decidir abandonar.
   *
   * `replace` y no `push`: la pantalla de entrar ya no tiene sentido en el
   * histórico una vez has entrado, y el gesto de volver atrás debe llevarte a
   * donde estabas antes de venir aquí.
   */
  const enterTheApp = () => router.replace('/(main)/(tabs)');

  /*
   * Lo que hay que decir **antes** de entrar por primera vez con un diario ya
   * escrito, y que no se decía.
   *
   * Desde que las lecturas filtran por cuenta (`services/db/account-scope.ts`),
   * entrar asocia a esa cuenta todo lo que ya había en el móvil, y cerrar sesión
   * lo saca de la pantalla. Es la semántica correcta —las filas quedaron
   * selladas y vuelven al volver a entrar— pero es un cambio brusco, y sin este
   * aviso se vive exactamente como perder el diario. La bienvenida ya dice la
   * mitad («si creas una cuenta más adelante, lo que hayas guardado se asocia a
   * ella»); faltaba la otra mitad, y faltaba en el momento en que se decide.
   *
   * Solo cuando hay algo huérfano que asociar: a quien entra con el diario
   * vacío, o a quien ya entró una vez, esto no le dice nada.
   *
   * Devuelve si se sigue adelante.
   */
  const confirmLocalDataWillBeLinked = async (): Promise<boolean> => {
    const unclaimed = await countUnclaimedRows(db);
    if (unclaimed === 0) return true;

    return ask({
      title: 'Tu diario pasa a ser de esta cuenta',
      message:
        `Lo que ya tienes guardado en este móvil (${unclaimed} entradas) se asociará a la cuenta ` +
        'con la que entres y se subirá a la nube. Si cierras sesión dejarás de verlo aquí: no se ' +
        'borra, y vuelve entero al volver a entrar con esa misma cuenta.',
      icon: 'cloud-upload-outline',
      confirmLabel: 'Entendido, entrar',
      cancelLabel: 'Cancelar',
    });
  };

  const submit = handleSubmit(async ({ email, password }) => {
    if (!(await confirmLocalDataWillBeLinked())) return;

    setBusy(true);
    try {
      if (mode === 'signIn') {
        const { error } = await signInWithEmail(email, password);
        if (error) {
          await fail(error);
          return;
        }
        enterTheApp();
        return;
      }

      const { error, needsConfirmation } = await signUpWithEmail(email, password);
      if (error) {
        await fail(error);
        return;
      }
      if (!needsConfirmation) {
        // Sin confirmación de correo el registro deja sesión abierta, así que
        // es un inicio de sesión y acaba donde acaban los demás.
        enterTheApp();
        return;
      }
      // Un modal y no un toast: hay que salir de la app a leer un correo, y
      // eso es una instrucción, no el acuse de recibo de algo ya terminado.
      await tell({
        title: 'Revisa tu correo',
        message: `Te hemos escrito a ${email}. Abre el enlace desde este móvil y la app se abrirá sola con la sesión ya iniciada.`,
        icon: 'mail-outline',
      });
      setMode('signIn');
    } finally {
      setBusy(false);
    }
  });

  const oauth = async (provider: OAuthProvider) => {
    if (!(await confirmLocalDataWillBeLinked())) return;

    setBusy(true);
    try {
      const { error } = await signInWithOAuth(provider);
      // «cancelled» es cerrar el navegador a propósito, no un fallo que contar.
      if (error && error !== 'cancelled') {
        await fail(error);
        return;
      }
      if (!error) enterTheApp();
    } finally {
      setBusy(false);
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
      <ScrollView className="flex-1 bg-canvas" contentContainerClassName="p-5 gap-4">
        {fromOnboarding ? (
          /*
           * Lo primero de la pantalla, no lo último: quien llega aquí desde el
           * onboarding viene a entrar, y en cuanto ha entrado lo que quiere es
           * irse. La sincronización sigue corriendo de fondo — no hay nada que
           * esperar aquí mirando.
           */
          <Card className="gap-3 p-4">
            <Txt variant="title">Ya está</Txt>
            <Txt variant="callout" tone="muted">
              Tu cuenta está lista. Lo que guardes se sincroniza solo; puedes empezar a usar la app
              mientras termina.
            </Txt>
            <Button
              label="Ir a mi diario"
              icon="arrow-forward"
              size="lg"
              block
              onPress={() => router.replace('/(main)/(tabs)')}
            />
          </Card>
        ) : null}

        <Card className="gap-1 p-4">
          <Txt variant="heading" weight="bold" serif={false}>
            Tu cuenta
          </Txt>
          <Txt variant="callout" tone="muted">
            {session.user.email}
          </Txt>
        </Card>

        <Card className="gap-3 p-4">
          <Txt variant="heading" weight="bold" serif={false}>
            Sincronización
          </Txt>
          <Txt variant="callout" tone="muted">
            {/* El detalle del avance cuando lo hay: «Sincronizando…» a secas
                durante minutos no se distingue de estar colgado. */}
            {status === 'syncing' && rows
              ? `${rows.phase === 'push' ? 'Subiendo' : 'Bajando'} ${rows.table} · ${rows.done}`
              : status === 'syncing' && photos
                ? `${photos.phase === 'upload' ? 'Subiendo' : 'Descargando'} fotos · ${photos.done} de ${photos.total}`
                : status === 'error' && lastOutcome?.error
                  ? `No se pudo sincronizar: ${lastOutcome.error}`
                  : SYNC_LABEL[status]}
          </Txt>

          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Button
                label="Sincronizar ahora"
                icon="sync"
                block
                loading={status === 'syncing'}
                onPress={() => void syncNow()}
              />
            </View>
          </View>

          <View className="gap-2">
            <Pressable accessibilityRole="button" onPress={() => void handleLink()} hitSlop={6}>
              <Txt variant="callout" tone="primary" weight="semi" serif={false}>
                Subir mis datos locales
              </Txt>
            </Pressable>
            {/* "Última sincronización correcta" dice que el proceso no falló, no
                que la copia esté completa. La diferencia solo se nota el día que
                se pierde el teléfono, así que hay que poder mirarla antes. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(main)/sync-status')}
              hitSlop={6}
            >
              <Txt variant="callout" tone="primary" weight="semi" serif={false}>
                ¿Está todo en la nube?
              </Txt>
            </Pressable>
          </View>
        </Card>

        <Button
          label="Cerrar sesión"
          variant="danger"
          size="lg"
          block
          onPress={() => void confirmSignOut()}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="p-5"
      keyboardShouldPersistTaps="handled"
    >
      <Card className="gap-4 p-4">
        <View className="gap-1">
          <Txt variant="title">
            {mode === 'signIn' ? 'Entrar en tu cuenta' : 'Crear una cuenta'}
          </Txt>
          <Txt variant="callout" tone="muted">
            {mode === 'signIn'
              ? 'Recupera tu diario en este móvil y vuelve a ver a tus amigos.'
              : 'Opcional. Añade copia en la nube, otro dispositivo y compartir con quien quieras.'}
          </Txt>
        </View>

        {/* Elegir primero qué se va a hacer, y después rellenar. Al revés —dos
            botones bajo los mismos campos— el error que devuelve el servidor
            habla de la contraseña cuando el problema era el botón. */}
        <View className="flex-row rounded-pill bg-sunken p-1">
          <ModeTab
            label="Ya tengo cuenta"
            selected={mode === 'signIn'}
            onPress={() => setMode('signIn')}
          />
          <ModeTab
            label="Crear cuenta"
            selected={mode === 'signUp'}
            onPress={() => setMode('signUp')}
          />
        </View>

        <FormInput
          control={control}
          name="email"
          label="Correo"
          placeholder="tu@correo.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />

        <View>
          <FormInput
            control={control}
            name="password"
            label="Contraseña"
            placeholder={mode === 'signUp' ? 'Al menos 6 caracteres' : 'Tu contraseña'}
            secureTextEntry={!showPassword}
            // `new-password` en el registro: es lo que hace que el gestor de
            // contraseñas ofrezca generar una en vez de rellenar la de otra app.
            autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
            autoCapitalize="none"
            {...(mode === 'signIn' ? {} : { hint: 'Mínimo 6 caracteres' })}
          />
          {/* Ver lo que se escribe. En un teclado de móvil, escribir a ciegas una
              contraseña larga es el motivo más común de «no son correctos». */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
            onPress={() => setShowPassword((current) => !current)}
            hitSlop={10}
            className="absolute right-3 top-[34px] h-9 w-9 items-center justify-center"
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={colors.inkSubtle}
            />
          </Pressable>
        </View>

        <Button
          label={mode === 'signIn' ? 'Entrar' : 'Crear cuenta'}
          size="lg"
          block
          loading={busy}
          onPress={() => void submit()}
        />

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-line" />
          <Txt variant="caption" tone="subtle">
            o
          </Txt>
          <View className="h-px flex-1 bg-line" />
        </View>

        {/* Apple está apagado en `lib/features.ts`, y el porqué está allí: el
            proveedor no está configurado, así que el botón llevaba a un error. */}
        {(APPLE_SIGN_IN_ENABLED
          ? (['google', 'apple'] as OAuthProvider[])
          : (['google'] as OAuthProvider[])
        ).map((provider) => (
          <Pressable
            key={provider}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void oauth(provider)}
            className={`flex-row items-center justify-center gap-2 rounded-xl border border-line-strong py-3.5 ${
              busy ? 'opacity-50' : ''
            }`}
          >
            <Ionicons name={`logo-${provider}`} size={19} color={colors.ink} />
            <Txt variant="body" weight="semi" serif={false}>
              Continuar con {provider === 'google' ? 'Google' : 'Apple'}
            </Txt>
          </Pressable>
        ))}

        <Txt variant="caption" tone="subtle" className="text-center">
          Tu diario seguirá guardándose en este teléfono aunque no entres.
        </Txt>
      </Card>
    </ScrollView>
  );
}

function ModeTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`flex-1 items-center justify-center rounded-pill py-2 ${
        selected ? 'bg-surface' : ''
      }`}
    >
      <Txt
        variant="callout"
        serif={false}
        weight={selected ? 'bold' : 'semi'}
        tone={selected ? 'ink' : 'subtle'}
        numberOfLines={1}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
