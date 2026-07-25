import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';

import { Txt } from './Txt';

import type { ComponentProps, ReactNode } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ToastTone = 'success' | 'info' | 'danger';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  /** Says something happened, without stopping what the user is doing. */
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ notify: () => {} });

/** Long enough to read a short sentence, short enough not to linger. */
const VISIBLE_MS = 2600;

const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'checkmark-circle',
  info: 'information-circle',
  danger: 'alert-circle',
};

/**
 * Brief, non-blocking confirmations.
 *
 * Saving used to raise a dialog saying "Éxito", which you had to dismiss before
 * you could see the thing you had just created — a modal interruption to
 * announce that nothing went wrong. This says the same thing without taking the
 * screen: it appears over the content, and leaves on its own.
 *
 * Only for outcomes that need no decision. Anything the user must answer is a
 * `Dialog`; anything they must act on is an error.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current;
    nextId.current += 1;

    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, VISIBLE_MS);
  }, []);

  const api = useMemo<ToastApi>(() => ({ notify }), [notify]);

  const toneColor: Record<ToastTone, string> = {
    success: colors.sage,
    info: colors.primary,
    danger: colors.danger,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Above the floating tab bar, so a confirmation never hides navigation. */}
      <View
        pointerEvents="box-none"
        style={{ bottom: Math.max(insets.bottom, 12) + 84 }}
        className="absolute inset-x-0 items-center gap-2 px-5"
      >
        {toasts.map((toast) => (
          <Animated.View
            key={toast.id}
            entering={SlideInDown.springify().damping(28).stiffness(280)}
            exiting={SlideOutDown.duration(200)}
            style={[elevation.medium, { backgroundColor: colors.inverse }]}
            className="max-w-full flex-row items-center gap-2.5 rounded-pill px-4 py-3"
          >
            <Ionicons name={TONE_ICON[toast.tone]} size={17} color={toneColor[toast.tone]} />
            <Txt
              variant="callout"
              weight="semi"
              serif={false}
              numberOfLines={2}
              tone="onInverse"
              className="shrink"
            >
              {toast.message}
            </Txt>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
