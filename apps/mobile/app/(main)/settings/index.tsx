import * as DocumentPicker from 'expo-document-picker';
import { useContext, useState } from 'react';

import { DBVersionContext } from '@/app/_layout';
import { useDialog } from '@/components/ui/Dialog';
import { FormSection } from '@/components/ui/FormScaffold';
import { Screen } from '@/components/ui/Screen';
import { PrivacyCard } from '@/features/privacy/PrivacyCard';
import { useSharingAvailable } from '@/features/privacy/useSharingAvailable';
import ExportCard from '@/features/settings/components/ExportCard';
import ImportCard from '@/features/settings/components/ImportCard';
import InfoCard from '@/features/settings/components/InfoCard';
import NotificationsCard from '@/features/settings/components/NotificationsCard';
import ThemeCard from '@/features/settings/components/ThemeCard';
import ThemeSelectionModal from '@/features/settings/components/ThemeSelectionModal';
import { useAppSettings } from '@/features/settings/hooks/useAppSettings';
import { reportError } from '@/lib/helpers/report-error';

export default function SettingsScreen() {
  // Sin cuenta todo es privado y no hay nada que ajustar.
  const sharing = useSharingAvailable();
  const { ask } = useDialog();
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
      const confirmed = await ask({
        title: '¿Reemplazar todo tu diario?',
        message:
          'Importar sustituye lo que hay ahora en este teléfono por lo del archivo. Se guarda una copia antes, por si acaso.',
        icon: 'download-outline',
        confirmLabel: 'Reemplazar',
        cancelLabel: 'Cancelar',
        destructive: true,
      });
      if (!confirmed) return;

      try {
        setIsImporting(true);
        setImportProgress(0);
        await backupService.importData(fileUri, setImportProgress);
      } catch (error) {
        reportError('No se pudo completar la importación', error);
        try {
          await backupService.restoreBackup();
        } catch (e) {
          console.error('Error al restaurar la copia de seguridad:', e);
        }
      } finally {
        setIsImporting(false);
        // Both import and restore swap the SQLite file underneath the open
        // connection, which leaves it stale ("attempt to write a readonly
        // database") until the provider is remounted. Always reconnect — not
        // only on success, or a failed import bricks every later write.
        bumpDb();
      }
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

      {sharing ? (
        <FormSection
          title="Privacidad"
          hint="El punto de partida de cada entrada; siempre puedes cambiarla una a una"
        >
          <PrivacyCard />
        </FormSection>
      ) : null}

      {/* Solo con cuenta: sin ella no hay quien te etiquete, así que un
          interruptor de avisos sería un interruptor de nada. */}
      {sharing ? (
        <FormSection title="Avisos" hint="Cuando alguien te etiqueta en una comida">
          <NotificationsCard />
        </FormSection>
      ) : null}

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
