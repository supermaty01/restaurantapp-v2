import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState, FieldLabel } from '@/components/ui/Surface';
import { fetchMyProfile, updateMyProfile } from '@/features/social/api';
import type { Profile } from '@/features/social/api';
import { useAsyncResource } from '@/features/social/hooks/useAsyncResource';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { reportError } from '@/lib/helpers/report-error';

/** Mirrors the database constraint, so a bad handle is caught before the trip. */
const USERNAME_RULE = /^[a-z0-9_.]{3,30}$/;

export default function ProfileEditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();

  const { data, loading, error } = useAsyncResource<Profile>(fetchMyProfile, {
    enabled: Boolean(session),
    deps: [session?.user.id],
  });

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setUsername(data.username);
    setDisplayName(data.displayName ?? '');
    setBio(data.bio ?? '');
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
        <Avatar name={preview} uri={data.avatarUrl} size={72} />
        <Text className="font-display text-[20px] text-ink">{preview}</Text>
        <Text className="text-[13px] text-ink-subtle">@{normalised || data.username}</Text>
      </Card>

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
