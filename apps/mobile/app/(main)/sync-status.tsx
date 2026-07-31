import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyState } from '@/components/ui/Surface';
import { Txt } from '@/components/ui/Txt';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { useSync } from '@/lib/hooks/useSync';
import { compareWithCloud, TABLE_LABELS, type SyncComparison } from '@/services/sync/reconcile';
import { createSupabaseTransport } from '@/services/sync/supabaseTransport';

/**
 * ¿Está todo en la nube?
 *
 * "Última sincronización correcta" contesta si el proceso terminó sin error, no
 * si la copia está completa. Son preguntas distintas y solo la segunda importa
 * el día que se pierde el teléfono, así que esta pantalla enseña los dos lados
 * y deja que los compares tú.
 */
export default function SyncStatusScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { accountUuid } = useAuth();
  const { colors } = useTheme();
  const { status, syncNow } = useSync();

  const [comparison, setComparison] = useState<SyncComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountUuid) return;
    setLoading(true);
    setError(null);
    try {
      setComparison(await compareWithCloud(db, createSupabaseTransport(accountUuid)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo comparar con la nube');
    } finally {
      setLoading(false);
    }
  }, [db, accountUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!accountUuid) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Sin cuenta"
          message="Inicia sesión para comparar tu diario con la copia en la nube."
        />
      </Screen>
    );
  }

  const everythingUp =
    comparison !== null &&
    comparison.totalPendingUpload === 0 &&
    comparison.photosPendingUpload === 0;
  const everythingDown =
    comparison !== null && comparison.totalMissingLocally === 0 && comparison.photosMissing === 0;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerClassName="px-5 pb-16 pt-3 gap-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <View className="rounded-lg border border-danger/30 bg-danger/10 p-3">
            <Txt variant="caption" tone="danger">
              {error}
            </Txt>
          </View>
        ) : null}

        {loading && !comparison ? (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : comparison ? (
          <>
            {/* El veredicto primero. Los conteos por tabla son para cuando algo
                no cuadra y quieres saber qué; la pregunta de partida es una sola
                y merece una respuesta de una línea. */}
            <Card
              className={`gap-2 ${everythingUp && everythingDown ? 'border-sage/40' : 'border-primary/40'}`}
            >
              <View className="flex-row items-center gap-2.5">
                <Ionicons
                  name={
                    everythingUp && everythingDown ? 'shield-checkmark' : 'cloud-upload-outline'
                  }
                  size={20}
                  color={everythingUp && everythingDown ? colors.sage : colors.primary}
                />
                <Txt variant="heading" weight="bold" serif={false}>
                  {everythingUp && everythingDown
                    ? 'Tu diario está a salvo'
                    : 'Todavía falta algo por sincronizar'}
                </Txt>
              </View>

              <Txt variant="caption" tone="muted">
                {everythingUp
                  ? 'Todo lo de este móvil está en la nube.'
                  : `Faltan por subir ${comparison.totalPendingUpload} entradas` +
                    (comparison.photosPendingUpload > 0
                      ? ` y ${comparison.photosPendingUpload} fotos.`
                      : '.')}
              </Txt>
              <Txt variant="caption" tone="muted">
                {everythingDown
                  ? 'Y todo lo de la nube está en este móvil.'
                  : `La nube tiene ${comparison.totalMissingLocally} entradas` +
                    (comparison.photosMissing > 0
                      ? ` y ${comparison.photosMissing} fotos que aquí no están.`
                      : ' que aquí no están.')}
              </Txt>
            </Card>

            <View className="gap-2">
              <Txt variant="overline" tone="subtle" serif={false} uppercase>
                Aquí y en la nube
              </Txt>

              <Card className="gap-0 p-0">
                <View className="flex-row border-b border-line px-4 py-2.5">
                  <Txt variant="caption" tone="subtle" className="flex-1">
                    {' '}
                  </Txt>
                  <Txt variant="caption" tone="subtle" className="w-20 text-right">
                    Móvil
                  </Txt>
                  <Txt variant="caption" tone="subtle" className="w-20 text-right">
                    Nube
                  </Txt>
                </View>

                {comparison.tables.map((row, index) => {
                  const matches = row.local === row.cloud;
                  return (
                    <View
                      key={row.table}
                      className={`flex-row items-center px-4 py-3 ${
                        index > 0 ? 'border-t border-line' : ''
                      }`}
                    >
                      <View className="flex-1 flex-row items-center gap-2">
                        <Txt variant="body" serif={false}>
                          {TABLE_LABELS[row.table] ?? row.table}
                        </Txt>
                        {row.pendingUpload > 0 ? (
                          <View className="rounded-pill bg-primary/12 px-2 py-0.5">
                            <Txt variant="caption" tone="primary" weight="semi" serif={false}>
                              {row.pendingUpload} sin subir
                            </Txt>
                          </View>
                        ) : null}
                      </View>
                      <Txt variant="body" serif={false} className="w-20 text-right">
                        {row.local}
                      </Txt>
                      <Txt
                        variant="body"
                        serif={false}
                        tone={matches ? 'ink' : 'primary'}
                        weight={matches ? 'regular' : 'bold'}
                        className="w-20 text-right"
                      >
                        {row.cloud}
                      </Txt>
                    </View>
                  );
                })}
              </Card>

              <Txt variant="caption" tone="subtle">
                Las fotos van aparte de las filas y tardan más: es normal que el número de la nube
                vaya por detrás justo después de registrar algo.
              </Txt>
            </View>

            <Button
              label={status === 'syncing' ? 'Sincronizando…' : 'Sincronizar ahora'}
              icon="sync"
              loading={status === 'syncing'}
              onPress={() => {
                void (async () => {
                  await syncNow();
                  await load();
                })();
              }}
            />

            {/* Una salida, y no solo el gesto de volver. Se llega aquí desde el
                final del registro —«¿está todo?»— y quien llega ha terminado un
                trámite: lo siguiente es su diario, no la pantalla anterior. */}
            <Button
              label="Ir al inicio"
              icon="home-outline"
              variant="ghost"
              onPress={() => router.replace('/(main)/(tabs)')}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
