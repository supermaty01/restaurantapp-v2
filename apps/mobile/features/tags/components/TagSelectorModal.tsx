import { Ionicons } from '@expo/vector-icons';
import clsx from 'clsx';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList } from 'react-native';

import Tag from '@/features/tags/components/Tag';
import { TagDTO } from '@/features/tags/types/tag-dto';
import * as schema from '@/services/db/schema';

import CreateTagModal from './CreateTagModal';
import { useTagsList } from '../hooks/useTagsList';

interface TagSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  selectedTags: TagDTO[];
  onChangeSelected: (newTags: TagDTO[]) => void;
}

export default function TagSelectorModal({
  visible,
  onClose,
  selectedTags,
  onChangeSelected,
}: TagSelectorModalProps) {
  const tags = useTagsList();
  const db = useSQLiteContext();
  const drizzleDb = drizzle(db, { schema });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleToggle = (selectedTag: TagDTO) => {
    if (selectedTags.find((tag) => tag.id === selectedTag.id)) {
      onChangeSelected(selectedTags.filter((tag) => tag.id !== selectedTag.id));
    } else {
      onChangeSelected([...selectedTags, selectedTag]);
    }
  };

  const handleCreateTag = async (tagData: { name: string; color: string }) => {
    try {
      const result = await drizzleDb
        .insert(schema.tags)
        .values({ name: tagData.name, color: tagData.color });
      const newTag: TagDTO = {
        id: result.lastInsertRowId,
        name: tagData.name,
        color: tagData.color,
        deleted: false,
      };
      onChangeSelected([...selectedTags, newTag]);
      setShowCreateModal(false);
    } catch {
      setShowCreateModal(false);
    }
  };

  return (
    <Modal visible={visible} transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-white dark:bg-dark-card w-10/12 rounded-md p-4 max-h-[60%]">
          <Text className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-200">Seleccionar Etiquetas</Text>
          <FlatList
            data={tags}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => {
              const isSelected = selectedTags.some((tag) => tag.id === item.id);
              return (
                <TouchableOpacity
                  className="flex-row items-bottom mb-2"
                  onPress={() => handleToggle(item)}
                >
                  <View
                    className={clsx("size-6 mr-2 rounded-md", isSelected ? 'bg-primary dark:bg-dark-primary' : 'bg-gray-300 dark:bg-gray-700')}
                  >
                    {isSelected && <Ionicons name="checkmark" size={20} />}
                  </View>
                  <Tag name={item.name} color={item.color} />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center mt-10">
                <Text className="text-base text-gray-800 dark:text-gray-200">No se encontraron etiquetas.</Text>
              </View>
            }
          />
          <View className="flex-row justify-between mt-4">
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              className="flex-row items-center px-4 py-2 bg-primary dark:bg-dark-primary rounded-md"
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text className="text-white ml-1 font-semibold">Crear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-md"
            >
              <Text className="text-gray-800 dark:text-gray-200">Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <CreateTagModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onAdd={handleCreateTag}
      />
    </Modal>
  );
}
