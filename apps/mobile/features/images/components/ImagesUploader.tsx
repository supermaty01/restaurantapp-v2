import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, TouchableOpacity, Image, Alert, Linking } from 'react-native';

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

const openAppSettings = () => {
  Linking.openSettings().catch(() => {
    Alert.alert('Error', 'No se pudo abrir la configuración de la aplicación.');
  });
};

export default function ImagesUploader(props: ImagesUploaderProps) {
  // Kept as `props` (not destructured) so TS can narrow the discriminated
  // union on `props.isEdit` inside each handler; that removes the `as any`
  // casts v1 needed because the destructured callback was an untyped union.
  const { disabled, isEdit, images } = props;

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
      Alert.alert(
        'Permiso denegado',
        'Se requieren permisos para acceder a la galería. ¿Deseas ir a la configuración para habilitarlos?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuración', onPress: openAppSettings },
        ],
      );
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
      Alert.alert(
        'Permiso denegado',
        'Se requieren permisos para acceder a la cámara. ¿Deseas ir a la configuración para habilitarlos?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuración', onPress: openAppSettings },
        ],
      );
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

  return (
    <View className="mt-4">
      <Text className="text-xl font-bold mb-2 text-ink">Fotos</Text>
      <View className="flex-row gap-2 mb-4">
        <TouchableOpacity
          className="bg-line-strong px-3 py-2 rounded-md"
          onPress={pickFromGallery}
          disabled={disabled}
        >
          <Text className="text-ink">Seleccionar archivos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-line-strong px-3 py-2 rounded-md"
          onPress={pickFromCamera}
          disabled={disabled}
        >
          <Text className="text-ink">Abrir cámara</Text>
        </TouchableOpacity>
      </View>
      {isEdit
        ? images.map((image) => (
            <View key={image.uri} className="mb-2">
              <Image
                source={{ uri: image.uri }}
                className="w-full h-40 mb-1 rounded-md"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => removeImage(image)}
                className="bg-danger px-3 py-2 rounded-md w-28 flex-row justify-center"
                disabled={disabled}
              >
                <Ionicons name="trash-outline" size={16} color="#fff" className="mr-2" />
                <Text className="text-on-primary font-semibold">Eliminar</Text>
              </TouchableOpacity>
            </View>
          ))
        : images.map((uri) => (
            <View key={uri} className="mb-2">
              <Image source={{ uri }} className="w-full h-40 mb-1 rounded-md" resizeMode="cover" />
              <TouchableOpacity
                onPress={() => removeImage(uri)}
                className="bg-danger px-3 py-2 rounded-md w-24 text-center"
                disabled={disabled}
              >
                <Text className="text-on-primary font-semibold">Eliminar</Text>
              </TouchableOpacity>
            </View>
          ))}
    </View>
  );
}
