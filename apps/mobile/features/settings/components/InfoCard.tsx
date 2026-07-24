import React from 'react';
import { View, Text } from 'react-native';

import type { BackupInfo } from '@/services/backup/backupService';

import { formatBytes, formatDate } from '../utils/formatters';

interface InfoCardProps {
  appVersion: string;
  storageUsed: number;
  lastExport: BackupInfo | null;
}

const InfoCard: React.FC<InfoCardProps> = ({ appVersion, storageUsed, lastExport }) => {
  return (
    <View className="bg-surface p-4 rounded-xl mb-4">
      <Text className="text-lg font-bold text-ink mb-2">Información</Text>
      <View className="flex-row justify-between mb-2">
        <Text className="text-ink-muted">Versión</Text>
        <Text className="text-ink">{appVersion}</Text>
      </View>
      <View className="flex-row justify-between mb-2">
        <Text className="text-ink-muted">Almacenamiento usado</Text>
        <Text className="text-ink">{formatBytes(storageUsed)}</Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-ink-muted">Última exportación</Text>
        <Text className="text-ink">{formatDate(lastExport?.date)}</Text>
      </View>
    </View>
  );
};

export default InfoCard;
