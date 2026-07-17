import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

import { BackupService, BackupInfo, ImportInfo } from '@/services/backup/backupService';
import * as schema from '@/services/db/schema';

interface StorageInfo {
  total: number;
  used: number;
}

export const useAppSettings = () => {
  const db = useSQLiteContext();
  const drizzleDb = useMemo(() => drizzle(db, { schema }), [db]);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [lastExport, setLastExport] = useState<BackupInfo | null>(null);
  const [lastBackup, setLastBackup] = useState<ImportInfo | null>(null);
  const [backupService, setBackupService] = useState<BackupService | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({ total: 0, used: 0 });
  const appVersion = useMemo(() => {
    try {
      const name = Application.applicationName || '';
      const version = Application.nativeApplicationVersion || '';
      const build = Application.nativeBuildVersion || '';

      return Platform.OS === 'ios'
        ? `${name} v${version}`
        : `${name} v${version} (${build})`;
    } catch (error) {
      console.error('Error al obtener versión de la app:', error);
      return '';
    }
  }, []);

  useEffect(() => {
    getStorageInfo();
  }, []);

  const getStorageInfo = async () => {
    try {
      const appDir = FileSystem.documentDirectory || '';
      const dirInfo = await FileSystem.getInfoAsync(appDir);
      const totalSpace = 4 * 1024 ** 3; // ~4GB
      setStorageInfo({
        total: totalSpace,
        used: (dirInfo as any).size || 0,
      });
    } catch (error) {
      console.error('Error al obtener información de almacenamiento:', error);
    }
  };

  const initBackupService = useCallback(async (version: string) => {
    try {
      const service = new BackupService(drizzleDb, version);
      setBackupService(service);
      
      const exportInfo = await service.getLastExportInfo();
      setLastExport(exportInfo);
      
      const backupInfo = await service.getLastBackupInfo();
      setLastBackup(backupInfo);
    } catch (error) {
      console.error('Error al inicializar el servicio de backup:', error);
    }
  }, [drizzleDb]);

  useEffect(() => {
    initBackupService(appVersion);
  }, [appVersion, initBackupService]);

  return {
    db,
    drizzleDb,
    isExporting,
    setIsExporting,
    isImporting,
    setIsImporting,
    exportProgress,
    setExportProgress,
    importProgress,
    setImportProgress,
    lastExport,
    setLastExport,
    lastBackup,
    setLastBackup,
    backupService,
    storageInfo,
    appVersion,
  };
};
