import React from 'react';
import { View } from 'react-native';

import { Divider } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import type { BackupInfo } from '@/services/backup/backupService';

import { formatBytes, formatDate } from '../utils/formatters';

interface InfoCardProps {
  appVersion: string;
  storageUsed: number;
  lastExport: BackupInfo | null;
}

/** Facts about the install. Read rarely, so it sits last and stays quiet. */
const InfoCard: React.FC<InfoCardProps> = ({ appVersion, storageUsed, lastExport }) => {
  const rows = [
    { label: 'Versión', value: appVersion },
    { label: 'Almacenamiento usado', value: formatBytes(storageUsed) },
    { label: 'Última copia', value: formatDate(lastExport?.date) },
  ];

  return (
    <View className="rounded-xl border border-line bg-surface px-4">
      {rows.map((row, index) => (
        <View key={row.label}>
          {index > 0 ? <Divider /> : null}
          <View className="flex-row items-center justify-between py-3.5">
            <Txt variant="callout" tone="muted">
              {row.label}
            </Txt>
            <Txt variant="callout" weight="semi" serif={false}>
              {row.value}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  );
};

export default InfoCard;
