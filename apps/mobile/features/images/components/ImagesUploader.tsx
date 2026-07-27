import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, ScrollView, TouchableOpacity, View } from 'react-native';

import { PressableScale } from '@/components/ui/Motion';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';
import { useTheme } from '@/lib/context/ThemeContext';
import { usePermissionGate } from '@/lib/hooks/usePermissionGate';

import type { ComponentProps } from 'react';

interface ImagesUploaderBaseProps {
  disabled?: boolean | undefined;
}

// Props para el modo creación (usa string[] para las imágenes)
interface ImagesUploaderCreateProps extends ImagesUploaderBaseProps {
  isEdit?: false;
  images: string[];
  onChangeImages: (newImages: string[]) => void;
  onRemoveExistingImage?: never;
}

// Tipo para imágenes en modo edición
export interface ImageItem {
  id?: number; // Si proviene de la BD, tendrá id
  uri: string;
}

// Props para el modo edición (usa ImageItem[] y callback para imagen eliminada)
interface ImagesUploaderEditProps extends ImagesUploaderBaseProps {
  isEdit: true;
  images: ImageItem[];
  onChangeImages: (newImages: ImageItem[]) => void;
  onRemoveExistingImage: (id: number) => void;
}

type ImagesUploaderProps = ImagesUploaderCreateProps | ImagesUploaderEditProps;

export default function ImagesUploader(props: ImagesUploaderProps) {
  const askForSettings = usePermissionGate();

  // Kept as `props` (not destructured) so TS can narrow the discriminated
  // union on `props.isEdit` inside each handler; that removes the `as any`
  // casts v1 needed because the destructured callback was an untyped union.
  const { disabled, isEdit, images } = props;
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const addImages = (uris: string[]) => {
    if (props.isEdit) {
      props.onChangeImages([...props.images, ...uris.map((uri) => ({ uri }))]);
    } else {
      props.onChangeImages([...props.images, ...uris]);
    }
  };

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      await askForSettings('tus fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.5,
      allowsMultipleSelection: true,
      mediaTypes: ['images'],
    });

    if (!result.canceled && result.assets?.length) {
      addImages(result.assets.map((asset) => asset.uri));
    }
  };

  const pickFromCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      await askForSettings('la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.5,
    });

    if (!result.canceled && result.assets?.length) {
      addImages(result.assets.map((asset) => asset.uri));
    }
  };

  const removeImage = (image: ImageItem | string) => {
    if (props.isEdit) {
      const target = image as ImageItem;
      if (target.id) {
        props.onRemoveExistingImage(target.id);
      }
      props.onChangeImages(props.images.filter((img) => img.uri !== target.uri));
    } else {
      props.onChangeImages(props.images.filter((img) => img !== image));
    }
  };

  const uris = isEdit
    ? (images as ImageItem[]).map((image) => ({ key: image.uri, uri: image.uri, item: image }))
    : (images as string[]).map((uri) => ({ key: uri, uri, item: uri }));

  return (
    <View className="gap-2.5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        {uris.map(({ key, uri, item }) => (
          <View key={key} style={{ width: TILE, height: TILE }}>
            <Image
              source={{ uri }}
              style={{ width: TILE, height: TILE, borderRadius: 14 }}
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => removeImage(item as never)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Quitar foto"
              hitSlop={8}
              className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-pill"
              style={{ backgroundColor: 'rgba(26, 21, 18, 0.65)' }}
            >
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Añadir foto"
          style={{ width: TILE, height: TILE }}
          className="items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-line-strong"
        >
          <Ionicons name="add" size={22} color={colors.inkSubtle} />
          <Txt variant="overline" tone="subtle" serif={false}>
            {uris.length === 0 ? 'Añadir' : 'Más'}
          </Txt>
        </TouchableOpacity>
      </ScrollView>

      {uris.length > 0 ? (
        <Txt variant="caption" tone="subtle">
          {uris.length} {uris.length === 1 ? 'foto' : 'fotos'}
        </Txt>
      ) : null}

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Añadir una foto"
        maxHeightRatio={0.45}
      >
        <View className="gap-2.5 px-5 pb-4 pt-1">
          <SourceOption
            icon="camera"
            label="Hacer una foto"
            onPress={() => {
              setPickerOpen(false);
              void pickFromCamera();
            }}
          />
          <SourceOption
            icon="images"
            label="Elegir de la galería"
            onPress={() => {
              setPickerOpen(false);
              void pickFromGallery();
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

/** Square edge of a thumbnail in the strip. */
const TILE = 96;

function SourceOption({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      className="flex-row items-center gap-3.5 rounded-xl border border-line bg-surface p-3.5"
    >
      <View className="h-11 w-11 items-center justify-center rounded-pill bg-primary/12">
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Txt variant="heading" weight="bold" serif={false} className="flex-1">
        {label}
      </Txt>
      <Ionicons name="chevron-forward" size={17} color={colors.inkSubtle} />
    </PressableScale>
  );
}
