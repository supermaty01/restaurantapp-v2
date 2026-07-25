import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { elevation } from '@/lib/design/tokens';

import { Button } from './Button';
import { Txt } from './Txt';

import type { ReactNode } from 'react';

/**
 * The frame every create/edit screen shares.
 *
 * v1 put the whole form in one card and left Guardar at the bottom of the
 * scroll, so on a long form you had to scroll back down to find it and there
 * was no sign of whether anything was wrong until you did. The action now sits
 * in a fixed footer, always reachable and always able to say what it is doing.
 */
export function FormScaffold({
  children,
  submitLabel,
  onSubmit,
  loading = false,
  disabled = false,
  /** Shown next to the action, e.g. "Falta el nombre". */
  hint,
  secondary,
}: {
  children: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  hint?: string | undefined;
  secondary?: ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 bg-canvas">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-8 pt-1 gap-6"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        <View
          className="border-t border-line bg-surface-alt px-5 pb-6 pt-3"
          style={elevation.medium}
        >
          {hint ? (
            <Txt variant="caption" tone="danger" className="mb-2">
              {hint}
            </Txt>
          ) : null}
          <View className="flex-row gap-2.5">
            {secondary ? <View className="flex-1">{secondary}</View> : null}
            <View className={secondary ? 'flex-[1.6]' : 'flex-1'}>
              <Button
                label={submitLabel}
                block
                size="lg"
                loading={loading}
                disabled={disabled}
                onPress={onSubmit}
              />
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * A titled group of fields.
 *
 * Forms read as a wall of inputs otherwise; grouping is what lets you skip the
 * parts you do not care about, which on an optional-heavy form is most of it.
 */
export function FormSection({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Txt variant="heading" weight="bold" serif={false}>
            {title}
          </Txt>
          {hint ? (
            <Txt variant="caption" tone="subtle" className="mt-0.5">
              {hint}
            </Txt>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
