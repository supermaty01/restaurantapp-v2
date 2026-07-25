import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { PressableScale } from '@/components/ui/Motion';
import { Txt } from '@/components/ui/Txt';
import { useFriends } from '@/features/social/hooks/useFriends';
import { useTheme } from '@/lib/context/ThemeContext';

import { useKnownPeople } from '../hooks/useKnownPeople';

import type { PersonTag } from '../repositories/peopleRepository';

interface PeopleTagInputProps {
  value: PersonTag[];
  onChange: (people: PersonTag[]) => void;
  label?: string | undefined;
}

/** Two tags are the same person if they point at the same account, else name. */
function sameTag(a: PersonTag, b: PersonTag): boolean {
  if (a.accountUuid && b.accountUuid) return a.accountUuid === b.accountUuid;
  if (a.accountUuid || b.accountUuid) return false;
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

/**
 * Who was there.
 *
 * Tagging is the point, not inviting: most of the people you eat with will
 * never install this, so a plain name has to be a first-class answer and not a
 * fallback for when the search finds nobody.
 *
 * The two ways in are deliberately different shapes. A friend is *picked* from
 * a list — you know who your friends are, and typing a handle you have to
 * remember exactly is a worse version of scrolling a short list. Everyone else
 * is typed, because there is no list they could be on.
 *
 * Only friends are offered. Search across every account would turn a private
 * diary entry into something you can attach to a stranger.
 */
export function PeopleTagInput({ value, onChange, label }: PeopleTagInputProps) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const recent = useKnownPeople();
  const { friends, enabled } = useFriends();

  const add = (tag: PersonTag) => {
    if (!tag.name.trim()) return;
    if (value.some((existing) => sameTag(existing, tag))) return;
    onChange([...value, { ...tag, name: tag.name.trim() }]);
  };

  const remove = (tag: PersonTag) => {
    onChange(value.filter((existing) => !sameTag(existing, tag)));
  };

  const addTyped = () => {
    add({ name: draft });
    setDraft('');
  };

  const query = draft.trim().toLowerCase();

  /** Friends first, then people tagged before who have no account of their own. */
  const suggestions = useMemo(() => {
    const fromFriends: PersonTag[] = friends.map((friend) => ({
      name: friend.displayName ?? friend.username,
      accountUuid: friend.userId,
      username: friend.username,
    }));

    // Someone tagged as a name before and since added as a friend would appear
    // twice; the friend entry wins because it is the one that can be delivered.
    const fromHistory = recent.filter(
      (person) => !fromFriends.some((friend) => friend.name === person.name),
    );

    return [...fromFriends, ...fromHistory]
      .filter((tag) => !value.some((existing) => sameTag(existing, tag)))
      .filter(
        (tag) =>
          query.length === 0 ||
          tag.name.toLowerCase().includes(query) ||
          (tag.username ?? '').toLowerCase().includes(query),
      );
  }, [friends, recent, value, query]);

  const exactMatch = suggestions.some((tag) => tag.name.toLowerCase() === query);

  return (
    <View className="gap-2.5">
      {label ? (
        <Txt variant="caption" tone="subtle">
          {label}
        </Txt>
      ) : null}

      {value.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {value.map((tag) => (
            <PressableScale
              key={tag.accountUuid ?? tag.name}
              accessibilityLabel={`Quitar a ${tag.name}`}
              onPress={() => remove(tag)}
              scaleTo={0.94}
              className="flex-row items-center gap-2 rounded-pill border border-line-strong bg-surface py-1.5 pl-1.5 pr-3"
            >
              <Avatar name={tag.name} size={24} />
              <View>
                <Txt variant="caption" weight="semi" serif={false}>
                  {tag.name}
                </Txt>
                {/* The handle only when it adds something: for a friend picked
                    from the list the display name is usually enough. */}
                {tag.username && tag.username !== tag.name ? (
                  <Txt variant="caption" tone="subtle">
                    @{tag.username}
                  </Txt>
                ) : null}
              </View>
              <Ionicons name="close" size={14} color={colors.inkMuted} />
            </PressableScale>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addTyped}
          placeholder="Nombre de quien te acompañó"
          placeholderTextColor={colors.inkSubtle}
          returnKeyType="done"
          autoCapitalize="words"
          className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-ink"
        />
        <PressableScale
          accessibilityLabel="Añadir persona"
          onPress={addTyped}
          scaleTo={0.92}
          className="h-12 w-12 items-center justify-center rounded-xl bg-primary"
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </PressableScale>
      </View>

      {/* A typed name that matches nobody is not an error — it is the normal
          case — so this only says what pressing + will do. */}
      {query.length > 0 && !exactMatch ? (
        <Txt variant="caption" tone="subtle">
          Se añadirá «{draft.trim()}» como alguien sin cuenta.
        </Txt>
      ) : null}

      {suggestions.length > 0 ? (
        <View className="gap-1.5">
          <Txt variant="caption" tone="subtle">
            {enabled ? 'Amigos y personas frecuentes' : 'Personas frecuentes'}
          </Txt>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.slice(0, 12).map((tag) => (
              <PressableScale
                key={tag.accountUuid ?? tag.name}
                accessibilityLabel={`Añadir a ${tag.name}`}
                onPress={() => {
                  add(tag);
                  setDraft('');
                }}
                scaleTo={0.94}
                className="flex-row items-center gap-1.5 rounded-pill border border-line-strong bg-surface py-1.5 pl-1.5 pr-3"
              >
                <Avatar name={tag.name} size={22} />
                <Txt variant="caption" weight="semi" serif={false} numberOfLines={1}>
                  {tag.name}
                </Txt>
                {tag.accountUuid ? <Ionicons name="at" size={11} color={colors.sage} /> : null}
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
