import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useTheme } from '@/lib/context/ThemeContext';

import { PressableScale } from './Motion';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * What the ➕ in the tab bar opens.
 *
 * Creating used to be scattered: a FAB on each of the three lists plus quick
 * actions on the home screen, so "add something" meant first deciding where to
 * be. One permanent affordance, three destinations, ordered by how often they
 * are actually used — a visit is the thing you log constantly, a dish and a
 * place are usually created *while* logging one.
 */
export function CreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();

  const go = (path: string) => {
    onClose();
    // Let the sheet finish closing, or the push fights the dismissal animation.
    setTimeout(() => router.push(path), 180);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Registrar" maxHeightRatio={0.6}>
      <View className="gap-2.5 px-5 pb-4 pt-1">
        <Option
          icon="calendar"
          title="Una visita"
          description="Dónde comiste, con quién y qué pediste"
          onPress={() => go('/(main)/visits/new')}
        />
        <Option
          icon="location"
          title="Un lugar nuevo"
          description="Un restaurante que aún no está en tu diario"
          onPress={() => go('/(main)/restaurants/new')}
        />
        <Option
          icon="fast-food"
          title="Un plato"
          description="Algo que has probado, con su valoración"
          onPress={() => go('/(main)/dishes/new')}
        />
      </View>
    </Sheet>
  );
}

function Option({
  icon,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={title}
      onPress={onPress}
      scaleTo={0.98}
      className="flex-row items-center gap-3.5 rounded-xl border border-primary/30 bg-primary/8 p-3.5"
    >
      <View className="h-11 w-11 items-center justify-center rounded-pill bg-primary">
        <Ionicons name={icon} size={20} color={colors.onPrimary} />
      </View>
      <View className="min-w-0 flex-1">
        <Txt variant="heading" weight="bold" serif={false}>
          {title}
        </Txt>
        <Txt variant="caption" tone="subtle" numberOfLines={1}>
          {description}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
    </PressableScale>
  );
}
