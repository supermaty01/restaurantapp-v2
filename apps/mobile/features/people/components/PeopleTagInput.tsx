import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

interface PeopleTagInputProps {
  /** Names of the people tagged on this visit. */
  value: string[];
  onChange: (names: string[]) => void;
  label?: string | undefined;
}

/**
 * Tags people on a visit (docs/06, BeReal-style). Local-only for now: names are
 * free text resolved to person rows on save (visitRepository). The pending/
 * accepted account flow lands in phase 5.
 */
export function PeopleTagInput({ value, onChange, label = 'Con quién' }: PeopleTagInputProps) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const addPerson = () => {
    const name = draft.trim();
    if (!name) return;
    const exists = value.some((n) => n.toLowerCase() === name.toLowerCase());
    if (!exists) onChange([...value, name]);
    setDraft('');
  };

  const removePerson = (name: string) => {
    onChange(value.filter((n) => n !== name));
  };

  return (
    <View className="mb-4">
      <Text className="text-xl font-semibold text-ink mb-2">{label}</Text>

      <View className="flex-row items-center gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addPerson}
          placeholder="Añade a alguien y pulsa +"
          placeholderTextColor={colors.inkMuted}
          returnKeyType="done"
          className="flex-1 min-h-12 px-4 border border-line rounded-lg bg-surface text-ink"
        />
        <TouchableOpacity
          onPress={addPerson}
          className="bg-primary rounded-full p-2"
          accessibilityRole="button"
          accessibilityLabel="Añadir persona"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {value.length > 0 && (
        <View className="flex-row flex-wrap mt-2">
          {value.map((name) => (
            <Pressable
              key={name}
              onPress={() => removePerson(name)}
              className="flex-row items-center bg-primary/20/30 rounded-full px-3 py-1 mr-2 mb-2"
              accessibilityRole="button"
              accessibilityLabel={`Quitar a ${name}`}
            >
              <Text className="text-primary mr-1">{name}</Text>
              <Ionicons name="close" size={16} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
