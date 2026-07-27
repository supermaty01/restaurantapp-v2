import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { Card, EmptyState, FieldLabel } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { fetchMyProfile, updateMyProfile } from '@/features/social/api';
import type { Profile } from '@/features/social/api';
import { deletePreviousAvatar, uploadAvatar } from '@/features/social/avatar';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';
import { reportError } from '@/lib/helpers/report-error';
import { usePermissionGate } from '@/lib/hooks/usePermissionGate';

/** Mirrors the database constraint, so a bad handle is caught before the trip. */
const USERNAME_RULE = /^[a-z0-9_.]{3,30}$/;

export default function ProfileEditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, accountUuid } = useAuth();

  const { data, loading, error } = useAsyncResource<Profile>(fetchMyProfile, {
    enabled: Boolean(session),
    deps: [session?.user.id],
  });

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  /*
   * La foto se guarda sola, no con el botón de Guardar.
   *
   * El resto de la pantalla son campos de texto que se revisan antes de
   * mandarlos; una foto ya se ha revisado al elegirla, y hacerla esperar a
   * Guardar deja la pantalla enseñando algo que todavía no es verdad. Es la
   * misma regla que la insignia de privacidad del detalle: lo que no tiene nada
   * que validar se aplica en el momento.
   */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const askForSettings = usePermissionGate();
  const toast = useToast();

  const chooseAvatar = async (source: 'camera' | 'gallery' | 'remove') => {
    setPickerOpen(false);

    if (source === 'remove') {
      const previous = avatarUrl;
      setAvatarUrl(null);
      try {
        await updateMyProfile({ avatarUrl: null });
        void deletePreviousAvatar(previous);
      } catch (cause) {
        setAvatarUrl(previous);
        reportError('No se pudo quitar la foto', cause);
      }
      return;
    }

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      await askForSettings(source === 'camera' ? 'la cámara' : 'tus fotos');
      return;
    }

    // Cuadrada y pequeña: es lo único que se pinta de un avatar, y recortar
    // aquí evita subir ocho megapíxeles para enseñar treinta y cuatro puntos.
    const options = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.7 };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] });

    const picked = result.canceled ? null : result.assets?.[0]?.uri;
    if (!picked || !accountUuid) return;

    setUploading(true);
    const previous = avatarUrl;
    try {
      const url = await uploadAvatar(picked, accountUuid);
      await updateMyProfile({ avatarUrl: url });
      setAvatarUrl(url);
      void deletePreviousAvatar(previous);
      toast.notify('Foto actualizada');
    } catch (cause) {
      reportError('No se pudo cambiar la foto', cause);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!data) return;
    setUsername(data.username);
    setDisplayName(data.displayName ?? '');
    setBio(data.bio ?? '');
    setAvatarUrl(data.avatarUrl);
  }, [data]);

  const normalised = username.trim().toLowerCase();
  const usernameError =
    normalised.length === 0 || USERNAME_RULE.test(normalised)
      ? null
      : 'Entre 3 y 30 caracteres: minúsculas, números, punto o guion bajo';

  const dirty =
    data !== null &&
    (normalised !== data.username ||
      displayName.trim() !== (data.displayName ?? '') ||
      bio.trim() !== (data.bio ?? ''));

  const save = async () => {
    if (!data || usernameError) return;
    setSaving(true);
    try {
      await updateMyProfile({
        username: normalised,
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      router.back();
    } catch (cause) {
      // updateMyProfile already phrases its failures for a person ("ese nombre
      // ya está cogido"); prefixing them with a generic sentence buried the
      // part that actually said what to do.
      reportError(cause instanceof Error ? cause.message : 'No se pudo guardar el perfil', cause);
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <Screen>
        <EmptyState
          icon="person-circle-outline"
          title="No has iniciado sesión"
          message="Tu perfil vive en tu cuenta; el diario sigue guardándose en el móvil."
        />
      </Screen>
    );
  }

  if (loading && !data) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="No se pudo cargar tu perfil"
          {...(error ? { message: error } : {})}
        />
      </Screen>
    );
  }

  const preview = displayName.trim() || normalised || 'Tú';

  return (
    <Screen scroll contentClassName="pt-3">
      <Card className="items-center gap-2 py-5">
        {/* La foto es lo primero que se toca al entrar aquí — es lo único de
            esta pantalla que se ve desde fuera. Con la cámara encima para que
            se lea como un botón y no como una decoración. */}
        <PressableScale
          accessibilityLabel={avatarUrl ? 'Cambiar tu foto' : 'Añadir una foto'}
          onPress={() => setPickerOpen(true)}
          disabled={uploading}
          scaleTo={0.94}
        >
          <View>
            <Avatar name={preview} uri={avatarUrl} size={72} />
            <View
              className="absolute -bottom-0.5 -right-0.5 h-7 w-7 items-center justify-center rounded-pill border-2 border-surface bg-primary"
              style={elevation.low}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Ionicons name="camera" size={14} color={colors.onPrimary} />
              )}
            </View>
          </View>
        </PressableScale>

        <Text className="font-display text-[20px] text-ink">{preview}</Text>
        <Text className="text-[13px] text-ink-subtle">@{normalised || data.username}</Text>

        {avatarUrl ? (
          <Pressable onPress={() => void chooseAvatar('remove')} disabled={uploading} hitSlop={8}>
            <Text className="text-[13px] text-ink-subtle">Quitar la foto</Text>
          </Pressable>
        ) : null}
      </Card>

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={avatarUrl ? 'Cambiar tu foto' : 'Tu foto'}
      >
        <View className="gap-2.5 px-5 pb-4 pt-1">
          <Button
            label="Hacer una foto"
            icon="camera-outline"
            variant="secondary"
            block
            onPress={() => void chooseAvatar('camera')}
          />
          <Button
            label="Elegir de la galería"
            icon="images-outline"
            variant="secondary"
            block
            onPress={() => void chooseAvatar('gallery')}
          />
        </View>
      </Sheet>

      <View className="mt-6 gap-5">
        <View className="gap-2">
          <FieldLabel>Nombre de usuario</FieldLabel>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            placeholder="tu_usuario"
            placeholderTextColor={colors.inkSubtle}
            className={`rounded-lg border bg-surface px-4 py-3.5 text-[15px] text-ink ${
              usernameError ? 'border-danger' : 'border-line-strong'
            }`}
          />
          <Text className={`text-[12px] ${usernameError ? 'text-danger' : 'text-ink-subtle'}`}>
            {usernameError ?? 'Así te encontrarán tus amigos.'}
          </Text>
        </View>

        <View className="gap-2">
          <FieldLabel>Nombre</FieldLabel>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={60}
            placeholder="Cómo quieres que te vean"
            placeholderTextColor={colors.inkSubtle}
            className="rounded-lg border border-line-strong bg-surface px-4 py-3.5 text-[15px] text-ink"
          />
        </View>

        <View className="gap-2">
          <FieldLabel>Sobre ti</FieldLabel>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            maxLength={280}
            placeholder="Lo que quieras contar"
            placeholderTextColor={colors.inkSubtle}
            textAlignVertical="top"
            className="min-h-24 rounded-lg border border-line-strong bg-surface px-4 py-3.5 text-[15px] text-ink"
          />
          <Text className="text-[12px] text-ink-subtle">
            Solo la ven tus amigos. {280 - bio.length} caracteres restantes.
          </Text>
        </View>
      </View>

      <Button
        label="Guardar"
        block
        className="mt-7"
        loading={saving}
        disabled={!dirty || Boolean(usernameError)}
        onPress={save}
      />
    </Screen>
  );
}
