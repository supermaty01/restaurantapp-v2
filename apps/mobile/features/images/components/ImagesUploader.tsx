import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { View, Text, TouchableOpacity, Image, Alert, Linking } from 'react-native';

interface ImagesUploaderBaseProps {
  disabled?: boolean;
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

export default function ImagesUploader({ disabled, isEdit, images, onChangeImages, onRemoveExistingImage }: ImagesUploaderProps) {
  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        'Permiso denegado',
        'Se requieren permisos para acceder a la galería. ¿Deseas ir a la configuración para habilitarlos?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuración', onPress: openAppSettings }
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.5,
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
    });

    if (!result.canceled && result.assets?.length) {
      if (isEdit) {
        const newImages = result.assets.map((asset) => ({ uri: asset.uri }));
        onChangeImages([...images, ...newImages] as any);
      } else {
        const newImages = result.assets.map((asset) => asset.uri);
        onChangeImages([...images, ...newImages] as any);
      }
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
          { text: 'Abrir Configuración', onPress: openAppSettings }
        ]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.5,
    });

    if (!result.canceled && result.assets?.length) {
      if (isEdit) {
        const newImages = result.assets.map((asset) => ({ uri: asset.uri }));
        onChangeImages([...images, ...newImages] as any);
      } else {
        const newImages = result.assets.map((asset) => asset.uri);
        onChangeImages([...images, ...newImages] as any);
      }
    }
  };

  const removeImage = (image: any) => {
    if (isEdit) {
      if (image.id) {
        onRemoveExistingImage(image.id);
      }
      const newImages = images.filter((img) => img.uri !== image.uri);
      onChangeImages(newImages as any);
    } else {
      const newImages = images.filter((img) => img !== image);
      onChangeImages(newImages as any);
    }
  };

  return (
    <View className="mt-4">
      <Text className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">Fotos</Text>
      <View className="flex-row gap-2 mb-4">
        <TouchableOpacity
          className="bg-gray-300 dark:bg-gray-700 px-3 py-2 rounded-md"
          onPress={pickFromGallery}
          disabled={disabled}
        >
          <Text className="text-gray-800 dark:text-gray-200">Seleccionar archivos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-gray-300 dark:bg-gray-700 px-3 py-2 rounded-md"
          onPress={pickFromCamera}
          disabled={disabled}
        >
          <Text className="text-gray-800 dark:text-gray-200">Abrir cámara</Text>
        </TouchableOpacity>
      </View>
      {isEdit ? (
        images.map((image) => (
          <View key={image.uri} className="mb-2">
            <Image
              source={{ uri: image.uri }}
              className="w-full h-40 mb-1 rounded-md"
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => removeImage(image)}
              className="bg-destructive dark:bg-dark-destructive px-3 py-2 rounded-md w-28 flex-row justify-center"
              disabled={disabled}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" className="mr-2" />
              <Text className="text-white font-semibold">Eliminar</Text>
            </TouchableOpacity>
          </View>
        ))
      ) : (
        images.map((uri) => (
          <View key={uri} className="mb-2">
            <Image
              source={{ uri }}
              className="w-full h-40 mb-1 rounded-md"
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => removeImage(uri)}
              className="bg-destructive dark:bg-dark-destructive px-3 py-2 rounded-md w-24 text-center"
              disabled={disabled}
            >
              <Text className="text-white font-semibold">Eliminar</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}
