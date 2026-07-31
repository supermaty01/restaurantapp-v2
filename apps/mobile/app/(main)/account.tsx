import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/Dialog';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState, FieldLabel } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { APPLE_SIGN_IN_ENABLED } from '@/lib/features';
import { formatRelativeDate } from '@/lib/helpers/date';
import { useSync } from '@/lib/hooks/useSync';
import { photoProgressLabel, SYNC_LABEL } from '@/services/sync/syncStore';

/** Lo mínimo que Supabase acepta; comprobarlo aquí ahorra un viaje y un inglés. */
const MIN_PASSWORD = 6;

/** Suficiente para pillar lo que se escribe mal; el servidor tiene la última palabra. */
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Mode = 'sign-in' | 'sign-up';

/**
 * Crear cuenta, entrar, y saber que ha ido bien.
 *
 * La app es local primero y esta pantalla es opcional (docs/04): se llega desde
 * Perfil y nunca es una puerta que haya que cruzar para usar el diario.
 *
 * Lo que se arregló, que era casi todo:
 *
 * - **«Iniciar sesión» y «Crear cuenta nueva» eran dos botones a la vez**, con
 *   el segundo disfrazado de enlace, sobre los mismos dos campos: no había forma
 *   de saber cuál de los dos iba a ocurrir hasta que ocurría. Ahora es un modo,
 *   se elige arriba, y el formulario dice qué va a hacer.
 * - **Crear cuenta no daba señal de vida.** Con la confirmación por correo
 *   activada, `signUp` no falla ni deja sesión, así que la pantalla se quedaba
 *   exactamente igual que antes de pulsar.
 * - **Los errores llegaban en inglés**, tal cual venían del proveedor: «Invalid
 *   login credentials» en una app escrita entera en español.
 * - **No había forma de recuperar la contraseña.** Un formulario de acceso sin
 *   esa salida deja a alguien fuera de sus propios datos para siempre.
 * - **Y entrar no llevaba a ninguna parte.** Se quedaba aquí, con una tarjeta de
 *   sincronización, sin nada que dijera «ya está, sigue a lo tuyo». Ahora ese es
 *   el botón principal.
 *
 * Apple queda detrás de una bandera apagada: exige cuenta de desarrollador de
 * pago y clave firmante, y sin eso el botón solo puede fallar (lib/features.ts).
 */
export default function AccountScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    isConfigured,
    session,
    accountUuid,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    resetPassword,
  } = useAuth();
  const { status, lastOutcome, photos, syncNow } = useSync();
  const { ask, tell } = useDialog();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!isConfigured) {
    return (
      <Screen>
        <EmptyState
          icon="phone-portrait-outline"
          title="Modo local"
          message="La app funciona entera sin cuenta: tu diario vive en este móvil. Las cuentas y la sincronización se activan cuando se configura el servicio."
        />
      </Screen>
    );
  }

  if (session && accountUuid) {
    return (
      <SignedIn
        email={session.user.email ?? ''}
        onGoHome={() => router.replace('/(main)/(tabs)')}
        onOpenStatus={() => router.push('/(main)/sync-status')}
        onSync={() => void syncNow()}
        syncLabel={
          status === 'syncing' && photos && photos.done < photos.total
            ? photoProgressLabel(photos)
            : status === 'ok' && lastOutcome?.ok
              ? `Al día · ${formatRelativeDate(lastOutcome.at)}`
              : status === 'error' && lastOutcome?.error
                ? lastOutcome.error
                : SYNC_LABEL[status]
        }
        syncing={status === 'syncing'}
        failed={status === 'error'}
      />
    );
  }

  const normalisedEmail = email.trim().toLowerCase();
  const emailLooksWrong = normalisedEmail.length > 0 && !EMAIL_RULE.test(normalisedEmail);
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const canSubmit = !busy && EMAIL_RULE.test(normalisedEmail) && password.length >= MIN_PASSWORD;

  /*
   * Se comprueba antes de salir a la red. No por rapidez: por lo que se puede
   * decir. El servidor contesta «Unable to validate email address» sin decir
   * cuál de los dos campos, y desde aquí se puede señalar el que está mal
   * mientras todavía se está escribiendo.
   */
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setProblem(null);

    try {
      if (mode === 'sign-in') {
        const { error } = await signInWithEmail(normalisedEmail, password);
        // Al entrar bien no hay nada que hacer aquí: la sesión cambia por el
        // listener del contexto y esta pantalla se vuelve a pintar «por dentro».
        if (error) setProblem(error);
        return;
      }

      const { error, needsConfirmation } = await signUpWithEmail(normalisedEmail, password);
      if (error) {
        setProblem(error);
        return;
      }

      if (needsConfirmation) {
        setPassword('');
        await tell({
          title: 'Revisa tu correo',
          message: `Hemos enviado un enlace a ${normalisedEmail}. Ábrelo para confirmar la cuenta y vuelve aquí a entrar.`,
          icon: 'mail-outline',
        });
        setMode('sign-in');
      }
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!EMAIL_RULE.test(normalisedEmail)) {
      setProblem('Escribe tu correo arriba y vuelve a pulsar.');
      return;
    }

    const confirmed = await ask({
      title: '¿Enviar el correo de recuperación?',
      message: `Se enviará a ${normalisedEmail} un enlace para poner una contraseña nueva.`,
      icon: 'key-outline',
      confirmLabel: 'Enviar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    setBusy(true);
    const { error } = await resetPassword(normalisedEmail);
    setBusy(false);
    // Se contesta lo mismo exista la cuenta o no: decir «ese correo no está
    // registrado» es decirle a cualquiera qué correos tienen cuenta aquí.
    if (error) setProblem(error);
    else toast.notify('Si hay una cuenta con ese correo, el enlace ya va de camino');
  };

  const withGoogle = async () => {
    setBusy(true);
    setProblem(null);
    const { error } = await signInWithOAuth('google');
    setBusy(false);
    if (error) setProblem(error);
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerClassName="px-5 pb-16 pt-2 gap-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1.5">
          <Txt variant="title">{mode === 'sign-in' ? 'Entra en tu cuenta' : 'Crea una cuenta'}</Txt>
          <Txt variant="callout" tone="muted">
            Es opcional. Sirve para tener tu diario en más de un móvil, recuperarlo si pierdes este,
            y compartir con amigos. Lo que ya has escrito se queda donde está.
          </Txt>
        </View>

        {/* El modo, arriba y explícito. Antes eran dos botones sobre los mismos
            campos y no se sabía cuál iba a pasar hasta que pasaba. */}
        <View className="flex-row rounded-pill bg-sunken p-1">
          <ModeTab
            label="Ya tengo cuenta"
            selected={mode === 'sign-in'}
            onPress={() => {
              setMode('sign-in');
              setProblem(null);
            }}
          />
          <ModeTab
            label="Crear una"
            selected={mode === 'sign-up'}
            onPress={() => {
              setMode('sign-up');
              setProblem(null);
            }}
          />
        </View>

        <View className="gap-4">
          <View className="gap-2">
            <FieldLabel>Correo</FieldLabel>
            <TextInput
              value={email}
              onChangeText={(next) => {
                setEmail(next);
                setProblem(null);
              }}
              placeholder="tu@correo.com"
              placeholderTextColor={colors.inkSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              className={`min-h-12 rounded-lg border bg-surface px-4 py-3 text-[15px] text-ink ${
                emailLooksWrong ? 'border-danger' : 'border-line-strong'
              }`}
            />
            {emailLooksWrong ? (
              <Txt variant="caption" tone="danger">
                Falta algo: un correo lleva una arroba y un punto.
              </Txt>
            ) : null}
          </View>

          <View className="gap-2">
            <FieldLabel>Contraseña</FieldLabel>
            <View
              className={`min-h-12 flex-row items-center rounded-lg border bg-surface pr-2 ${
                passwordTooShort ? 'border-danger' : 'border-line-strong'
              }`}
            >
              <TextInput
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  setProblem(null);
                }}
                placeholder={`Al menos ${MIN_PASSWORD} caracteres`}
                placeholderTextColor={colors.inkSubtle}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                onSubmitEditing={() => void submit()}
                returnKeyType="go"
                className="flex-1 px-4 py-3 text-[15px] text-ink"
              />
              {/* Verla es lo que evita el tercer intento fallido: en un móvil la
                  contraseña se escribe a ciegas y con el pulgar. */}
              <PressableScale
                accessibilityLabel={showPassword ? 'Ocultar la contraseña' : 'Ver la contraseña'}
                onPress={() => setShowPassword((current) => !current)}
                scaleTo={0.9}
                className="h-9 w-9 items-center justify-center"
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={colors.inkSubtle}
                />
              </PressableScale>
            </View>
            {passwordTooShort ? (
              <Txt variant="caption" tone="danger">
                Necesita al menos {MIN_PASSWORD} caracteres.
              </Txt>
            ) : mode === 'sign-up' ? (
              <Txt variant="caption" tone="subtle">
                Te enviaremos un correo para confirmar que es tuyo.
              </Txt>
            ) : null}
          </View>

          {problem ? (
            <View className="flex-row items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Txt variant="caption" tone="danger" className="flex-1">
                {problem}
              </Txt>
            </View>
          ) : null}

          <Button
            label={mode === 'sign-in' ? 'Entrar' : 'Crear cuenta'}
            block
            loading={busy}
            disabled={!canSubmit}
            onPress={() => void submit()}
          />

          {mode === 'sign-in' ? (
            <PressableScale
              accessibilityLabel="He olvidado mi contraseña"
              onPress={() => void forgotPassword()}
              disabled={busy}
              scaleTo={0.97}
              className="items-center py-1"
            >
              <Txt variant="caption" tone="primary" weight="semi" serif={false}>
                He olvidado mi contraseña
              </Txt>
            </PressableScale>
          ) : null}
        </View>

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-line" />
          <Txt variant="caption" tone="subtle">
            o
          </Txt>
          <View className="h-px flex-1 bg-line" />
        </View>

        <Button
          label="Continuar con Google"
          icon="logo-google"
          variant="secondary"
          block
          disabled={busy}
          onPress={() => void withGoogle()}
        />
        {APPLE_SIGN_IN_ENABLED ? (
          <Button
            label="Continuar con Apple"
            icon="logo-apple"
            variant="secondary"
            block
            disabled={busy}
            onPress={() => void signInWithOAuth('apple')}
          />
        ) : null}
      </ScrollView>
    </Screen>
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
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      scaleTo={0.97}
      className={`flex-1 items-center rounded-pill py-2 ${selected ? 'bg-surface' : ''}`}
    >
      <Txt
        variant="callout"
        weight={selected ? 'bold' : 'semi'}
        serif={false}
        tone={selected ? 'ink' : 'subtle'}
      >
        {label}
      </Txt>
    </PressableScale>
  );
}

/**
 * Ya estás dentro.
 *
 * Lo primero es la salida: entrar es un trámite, y lo que quiere quien acaba de
 * hacerlo es volver a lo suyo. Antes esta pantalla no ofrecía ninguna, así que
 * el final del registro era una tarjeta de sincronización y un gesto de volver.
 */
function SignedIn({
  email,
  onGoHome,
  onOpenStatus,
  onSync,
  syncLabel,
  syncing,
  failed,
}: {
  email: string;
  onGoHome: () => void;
  onOpenStatus: () => void;
  onSync: () => void;
  syncLabel: string;
  syncing: boolean;
  failed: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerClassName="px-5 pb-16 pt-2 gap-4">
        <Card className="items-center gap-2.5 py-6">
          <View className="h-14 w-14 items-center justify-center rounded-pill bg-sage/15">
            <Ionicons name="checkmark" size={28} color={colors.sage} />
          </View>
          <Txt variant="title">Cuenta lista</Txt>
          <Txt variant="callout" tone="muted" className="text-center">
            {email}
          </Txt>
          <Txt variant="caption" tone="subtle" className="max-w-[280px] text-center">
            Tu diario se sincroniza solo a partir de ahora. No hace falta que hagas nada más aquí.
          </Txt>
        </Card>

        <Button label="Ir al inicio" icon="home-outline" block onPress={onGoHome} />

        <Card className="gap-3">
          <View className="flex-row items-center gap-2.5">
            <Ionicons
              name={failed ? 'alert-circle' : syncing ? 'sync' : 'cloud-done'}
              size={17}
              color={failed ? colors.danger : colors.sage}
            />
            <Txt
              variant="caption"
              tone={failed ? 'danger' : 'muted'}
              numberOfLines={2}
              className="flex-1"
            >
              {syncLabel}
            </Txt>
          </View>

          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Button
                label={failed ? 'Reintentar' : 'Sincronizar'}
                variant="secondary"
                size="sm"
                block
                disabled={syncing}
                onPress={onSync}
              />
            </View>
            <View className="flex-1">
              {/* «Última sincronización correcta» dice que el proceso no falló,
                  no que la copia esté completa. La diferencia solo se nota el
                  día que se pierde el teléfono, así que hay que poder mirarla
                  antes. */}
              <Button label="¿Está todo?" variant="ghost" size="sm" block onPress={onOpenStatus} />
            </View>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
