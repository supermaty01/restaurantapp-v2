import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/context/ThemeContext';
import { elevation } from '@/lib/design/tokens';
import { setErrorPresenter } from '@/lib/helpers/report-error';

import { Button } from './Button';
import { Txt } from './Txt';

import type { ComponentProps, ReactNode } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface DialogRequest {
  title: string;
  message?: string | undefined;
  icon?: IconName | undefined;
  /** Label for the action. Omit for a plain acknowledgement. */
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  destructive?: boolean | undefined;
}

type Resolver = (confirmed: boolean) => void;

interface DialogApi {
  /** Shows a dialog. Resolves true if confirmed, false if dismissed. */
  ask: (request: DialogRequest) => Promise<boolean>;
  /** Shows a message with a single button. */
  tell: (request: Omit<DialogRequest, 'cancelLabel'>) => Promise<void>;
}

const DialogContext = createContext<DialogApi>({
  ask: async () => false,
  tell: async () => {},
});

/**
 * The app's own dialog, replacing React Native's `Alert`.
 *
 * `Alert` draws the platform's native dialog: square on Android, system font,
 * system blue. Every one of them punched a hole in the design — and worse, it
 * cannot show anything except a title, a body and buttons, so "are you sure"
 * looked identical to "that failed".
 *
 * It is a provider rather than a component because the call sites are event
 * handlers, not render paths: `await ask({...})` reads like `Alert.alert`
 * always wanted to.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [resolver, setResolver] = useState<{ resolve: Resolver } | null>(null);

  const close = useCallback(
    (confirmed: boolean) => {
      resolver?.resolve(confirmed);
      setResolver(null);
      setRequest(null);
    },
    [resolver],
  );

  const api = useMemo<DialogApi>(
    () => ({
      ask: (next) =>
        new Promise<boolean>((resolve) => {
          setRequest(next);
          setResolver({ resolve });
        }),
      tell: (next) =>
        new Promise<void>((resolve) => {
          setRequest({
            ...next,
            cancelLabel: undefined,
            confirmLabel: next.confirmLabel ?? 'Vale',
          });
          setResolver({ resolve: () => resolve() });
        }),
    }),
    [],
  );

  // Route reportError through this dialog: it is called from catch blocks, so
  // it cannot reach the context by hook.
  useEffect(() => {
    setErrorPresenter((title, message) => {
      void api.tell({ title, message, icon: 'alert-circle-outline', destructive: true });
    });
    return () => setErrorPresenter(null);
  }, [api]);

  const open = request !== null;

  return (
    <DialogContext.Provider value={api}>
      {children}

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => close(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {/* Same reason as Sheet: a modal does not inherit the app's inset
            context, and without it the dialog is laid out against zeros. */}
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Animated.View
              entering={FadeIn.duration(140)}
              exiting={FadeOut.duration(120)}
              style={{ flex: 1, backgroundColor: 'rgba(26, 21, 18, 0.5)' }}
              className="items-center justify-center px-8"
            >
              {/* Tapping outside dismisses, which for a confirmation means "no". */}
              <Pressable
                accessibilityLabel="Cerrar"
                onPress={() => close(false)}
                style={{ position: 'absolute', inset: 0 }}
              />

              <Animated.View
                entering={ZoomIn.springify().damping(26).stiffness(300).mass(0.7)}
                style={[elevation.high, { backgroundColor: colors.surface }]}
                className="w-full max-w-[340px] items-center gap-3 rounded-[22px] p-6"
              >
                {request?.icon ? (
                  <View
                    className={`mb-1 h-14 w-14 items-center justify-center rounded-pill ${
                      request.destructive ? 'bg-danger/12' : 'bg-primary/12'
                    }`}
                  >
                    <Ionicons
                      name={request.icon}
                      size={24}
                      color={request.destructive ? colors.danger : colors.primary}
                    />
                  </View>
                ) : null}

                <Txt variant="title" className="text-center">
                  {request?.title ?? ''}
                </Txt>

                {request?.message ? (
                  <Txt variant="callout" tone="muted" className="text-center">
                    {request.message}
                  </Txt>
                ) : null}

                <View className="mt-2 w-full flex-row gap-2.5">
                  {request?.cancelLabel ? (
                    <View className="flex-1">
                      <Button
                        label={request.cancelLabel}
                        variant="secondary"
                        block
                        onPress={() => close(false)}
                      />
                    </View>
                  ) : null}
                  <View className="flex-1">
                    <Button
                      label={request?.confirmLabel ?? 'Vale'}
                      variant={request?.destructive ? 'danger' : 'primary'}
                      block
                      onPress={() => close(true)}
                    />
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  return useContext(DialogContext);
}
