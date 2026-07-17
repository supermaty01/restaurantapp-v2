import React from 'react';
import { View, Text } from 'react-native';

import { BackupInfo } from '@/services/backup/backupService';

import { formatBytes, formatDate } from '../utils/formatters';

interface InfoCardProps {
  appVersion: string;
  storageUsed: number;
  lastExport: BackupInfo | null;
}

const InfoCard: React.FC<InfoCardProps> = ({ appVersion, storageUsed, lastExport }) => {
  return (
    <View className="bg-card dark:bg-dark-card p-4 rounded-xl mb-4">
      <Text className="text-lg font-bold text-text dark:text-dark-text mb-2">Información</Text>
      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600 dark:text-gray-400">Versión</Text>
        <Text className="text-text dark:text-dark-text">{appVersion}</Text>
      </View>
      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600 dark:text-gray-400">Almacenamiento usado</Text>
        <Text className="text-text dark:text-dark-text">{formatBytes(storageUsed)}</Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-gray-600 dark:text-gray-400">Última exportación</Text>
        <Text className="text-text dark:text-dark-text">{formatDate(lastExport?.date)}</Text>
      </View>
    </View>
  );
};

export default InfoCard;
