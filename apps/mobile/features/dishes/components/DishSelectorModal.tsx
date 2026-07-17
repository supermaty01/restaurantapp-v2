import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';

interface Dish {
  id: number;
  name: string;
}

interface DishSelectorModalProps {
  visible: boolean;
  dishes: Dish[];
  onSelect: (dish: Dish) => void;
  onClose: () => void;
}

const DishSelectorModal: React.FC<DishSelectorModalProps> = ({ visible, dishes, onSelect, onClose }) => {
  const handleSelect = (dish: Dish) => {
    onSelect(dish);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-4/5 bg-white rounded-lg p-5 items-center">
          <Text className="text-lg font-bold mb-5">Select a Dish</Text>
          <FlatList
            data={dishes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity className="p-3 border-b border-gray-300" onPress={() => handleSelect(item)}>
                <Text className="text-base">{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity className="mt-5 p-3 bg-blue-500 rounded" onPress={onClose}>
            <Text className="text-white text-base">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default DishSelectorModal;