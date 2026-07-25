import * as DocumentPicker from 'expo-document-picker';
import { useContext, useState } from 'react';
import { Alert } from 'react-native';

import { DBVersionContext } from '@/app/_layout';
import { FormSection } from '@/components/ui/FormScaffold';
import { Screen } from '@/components/ui/Screen';
import ExportCard from '@/features/settings/components/ExportCard';
import ImportCard from '@/features/settings/components/ImportCard';
import InfoCard from '@/features/settings/components/InfoCard';
import ThemeCard from '@/features/settings/components/ThemeCard';
import ThemeSelectionModal from '@/features/settings/components/ThemeSelectionModal';
import { useAppSettings } from '@/features/settings/hooks/useAppSettings';
import { reportError } from '@/lib/helpers/report-error';

export default function SettingsScreen() {
  const bumpDb = useContext(DBVersionContext);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const {
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
    backupService,
    storageInfo,
    appVersion,
  } = useAppSettings();

  const handleExportData = async () => {
    if (!backupService) return;

    try {
      setIsExporting(true);
      setExportProgress(0);

      // Realizar la exportación utilizando el servicio
      const exportInfo = await backupService.exportData((progress) => {
        setExportProgress(progress);
      });

      // Actualizar la información de la última exportación
      setLastExport(exportInfo);

      // Compartir el archivo automáticamente
      try {
        await backupService.shareBackup(exportInfo.path);
      } catch (error) {
        reportError('No se pudo compartir el archivo', error);
      }
    } catch (error) {
      reportError('No se pudo completar la exportación', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!backupService) return;

    try {
      // 1. Seleccionar archivo
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) return;
      const fileUri = asset.uri;

      // 2. Verificar que sea un archivo válido
      Alert.alert(
        'Importar datos',
        'Esta acción reemplazará todos los datos actuales. ¿Deseas continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  setIsImporting(true);
                  setImportProgress(0);

                  // Realizar la importación utilizando el servicio
                  await backupService.importData(fileUri, (progress) => {
                    setImportProgress(progress);
                  });
                } catch (error) {
                  reportError('No se pudo completar la importación', error);
                  try {
                    await backupService.restoreBackup();
                  } catch (e) {
                    console.error('Error al restaurar la copia de seguridad:', e);
                  }
                } finally {
                  setIsImporting(false);
                  // Both import and restore swap the SQLite file underneath the
                  // open connection, which leaves it stale ("attempt to write a
                  // readonly database") until the provider is remounted. Always
                  // reconnect — not only on success, or a failed import bricks
                  // every later write.
                  bumpDb();
                }
              })();
            },
          },
        ],
      );
    } catch (error) {
      reportError('No se pudo seleccionar el archivo', error);
    }
  };

  const handleThemePress = () => {
    setThemeModalVisible(true);
  };

  return (
    <Screen scroll contentClassName="pt-1 gap-6">
      <FormSection
        title="Copias de seguridad"
        hint="Todo tu diario en un único archivo, con las fotos incluidas"
      >
        <ExportCard
          onPress={handleExportData}
          isExporting={isExporting}
          exportProgress={exportProgress}
          disabled={isExporting || isImporting}
        />
        <ImportCard
          onPress={handleImportData}
          isImporting={isImporting}
          importProgress={importProgress}
          disabled={isExporting || isImporting}
        />
      </FormSection>

      <FormSection title="Apariencia">
        <ThemeCard onPress={handleThemePress} />
      </FormSection>

      <FormSection title="Acerca de">
        <InfoCard appVersion={appVersion} storageUsed={storageInfo.used} lastExport={lastExport} />
      </FormSection>

      <ThemeSelectionModal
        visible={themeModalVisible}
        onClose={() => setThemeModalVisible(false)}
      />
    </Screen>
  );
}
