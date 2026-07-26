import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useDialog } from '@/components/ui/Dialog';
import { PressableScale } from '@/components/ui/Motion';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/Surface';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';
import { useBackupService } from '@/features/settings/hooks/useBackupService';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { useSync } from '@/lib/hooks/useSync';
import { compareWithCloud, type SyncComparison } from '@/services/sync/reconcile';
import {
  applyDivergenceChoice,
  rememberChoiceMade,
  type Divergence,
} from '@/services/sync/resolveDivergence';
import { createSupabaseTransport } from '@/services/sync/supabaseTransport';

/**
 * Quién manda, cuando el móvil y la nube traen diarios distintos.
 *
 * Se pregunta **una vez por cuenta y dispositivo**, y solo si de verdad hay algo
 * a los dos lados: preguntar cuando la respuesta es obvia enseña a contestar sin
 * leer, que es justo lo que no puede pasar en la única pantalla de la app capaz
 * de borrar un diario entero.
 *
 * Combinar es lo que hacía siempre y sigue siendo el camino recomendado. Las
 * otras dos existen porque combinar no es evidentemente correcto cuando los dos
 * diarios no tenían por qué encontrarse, y eso solo lo sabe quien los escribió.
 */
export default function SyncChoiceScreen() {
  const db = useDatabase();
  const backups = useBackupService();
  const router = useRouter();
  const { accountUuid } = useAuth();
  const { colors } = useTheme();
  const { syncNow } = useSync();
  const { ask, tell } = useDialog();
  const toast = useToast();

  const [comparison, setComparison] = useState<SyncComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accountUuid) return;
    try {
      setComparison(await compareWithCloud(db, createSupabaseTransport(accountUuid)));
    } finally {
      setLoading(false);
    }
  }, [db, accountUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const localTotal = comparison?.tables.reduce((sum, t) => sum + t.local, 0) ?? 0;
  const cloudTotal = comparison?.tables.reduce((sum, t) => sum + t.cloud, 0) ?? 0;

  async function choose(choice: Divergence) {
    if (!accountUuid) return;

    if (choice !== 'merge') {
      const destroysLocal = choice === 'cloud-wins';
      const confirmed = await ask({
        title: destroysLocal ? '¿Borrar el diario de este móvil?' : '¿Retirar lo que no está aquí?',
        message: destroysLocal
          ? `Se borrarán las ${localTotal} entradas de este teléfono y se descargarán las ${cloudTotal} de la cuenta. Antes se guarda una copia de seguridad.`
          : `Las ${cloudTotal} entradas de la nube pasarán a ser las ${localTotal} de este móvil. Lo que solo esté en la nube se marcará como borrado también en el otro dispositivo.`,
        icon: 'warning-outline',
        confirmLabel: destroysLocal ? 'Borrar y descargar' : 'Que mande este móvil',
        cancelLabel: 'Cancelar',
        destructive: true,
      });
      if (!confirmed) return;
    }

    setBusy(true);
    try {
      // La copia va antes de tocar nada y **no es opcional**: es la única
      // pantalla capaz de borrar un diario entero, y "había una copia" es la
      // diferencia entre un susto y una pérdida. docs/09 lo pedía desde el
      // principio para las migraciones y nunca se hizo; aquí sí.
      if (choice === 'cloud-wins') {
        const backup = await backups.exportData(() => {});
        toast.notify(`Copia guardada: ${backup.path.split('/').pop() ?? 'copia.zip'}`);
      }

      await applyDivergenceChoice(db, createSupabaseTransport(accountUuid), choice);
      await rememberChoiceMade(db, accountUuid);
      await syncNow();
      router.back();
    } catch (error) {
      await tell({
        title: 'No se pudo aplicar',
        message: error instanceof Error ? error.message : 'Inténtalo de nuevo',
        icon: 'alert-circle-outline',
        destructive: true,
      });
    } finally {
      setBusy(false);
    }
  }

  if (!accountUuid) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Sin cuenta"
          message="Inicia sesión para decidir qué hacer con tu diario."
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerClassName="px-5 pb-16 pt-3 gap-4">
        <View className="gap-1.5">
          <Txt variant="title">Hay dos diarios</Txt>
          <Txt variant="callout" tone="muted">
            Este móvil tiene {localTotal} entradas y la cuenta tiene {cloudTotal}. Elige qué hacer;
            solo se pregunta una vez.
          </Txt>
        </View>

        <Option
          icon="git-merge-outline"
          title="Combinar"
          description="Se quedan las dos. Si algo está en los dos lados, gana la versión más reciente."
          hint="Recomendado"
          disabled={busy}
          onPress={() => void choose('merge')}
        />
        <Option
          icon="cloud-download-outline"
          title="Que mande la nube"
          description={`Se borra lo de este teléfono y se descarga lo de la cuenta. Se guarda una copia antes.`}
          disabled={busy}
          destructive
          onPress={() => void choose('cloud-wins')}
        />
        <Option
          icon="phone-portrait-outline"
          title="Que mande este móvil"
          description="Se sube todo lo de aquí y se retira de la nube lo que este teléfono no tiene."
          disabled={busy}
          destructive
          onPress={() => void choose('device-wins')}
        />

        {busy ? (
          <View className="flex-row items-center gap-2 py-2">
            <ActivityIndicator color={colors.primary} />
            <Txt variant="caption" tone="muted">
              Aplicando… no cierres la app.
            </Txt>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Option({
  icon,
  title,
  description,
  hint,
  destructive = false,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  hint?: string;
  destructive?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.98}
      className={`flex-row items-start gap-3.5 rounded-xl border p-4 ${
        destructive ? 'border-danger/30 bg-danger/5' : 'border-primary/30 bg-primary/8'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-pill ${
          destructive ? 'bg-danger/15' : 'bg-primary'
        }`}
      >
        <Ionicons name={icon} size={19} color={destructive ? colors.danger : colors.onPrimary} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Txt variant="heading" weight="bold" serif={false}>
            {title}
          </Txt>
          {hint ? (
            <View className="rounded-pill bg-sage/20 px-2 py-0.5">
              <Txt variant="caption" weight="semi" serif={false}>
                {hint}
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt variant="caption" tone="muted">
          {description}
        </Txt>
      </View>
    </PressableScale>
  );
}
