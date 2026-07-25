import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { DetailMissing, DetailScaffold } from '@/components/ui/DetailScaffold';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ImageDisplay } from '@/features/images/components/ImageDisplay';
import VisitDetails from '@/features/visits/components/VisitDetails';
import VisitDishes from '@/features/visits/components/VisitDishes';
import { useVisitById } from '@/features/visits/hooks/useVisitById';
import { hardDeleteVisit } from '@/features/visits/repositories/visitRepository';
import { formatVisitDate } from '@/lib/helpers/date';
import { reportError } from '@/lib/helpers/report-error';
import { useDatabase } from '@/lib/hooks/useDatabase';
import { exportVisit } from '@/services/share/exportService';

export default function VisitDetailScreen() {
  const router = useRouter();
  const { id } = useGlobalSearchParams();
  const drizzleDb = useDatabase();
  const visit = useVisitById(Number(id));
  const [isSharing, setIsSharing] = useState(false);

  async function handleShare() {
    try {
      setIsSharing(true);
      await exportVisit(drizzleDb, Number(id));
    } catch (error) {
      reportError('No se pudo compartir la visita', error);
    } finally {
      setIsSharing(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Eliminar visita',
      // Nothing references a visit, so this really is permanent.
      'Se borrará definitivamente. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await hardDeleteVisit(drizzleDb, Number(id));
                router.back();
              } catch (error) {
                reportError('No se pudo eliminar la visita', error);
              }
            })();
          },
        },
      ],
      { cancelable: true },
    );
  }

  if (!visit) {
    return <DetailMissing message="No se encontró la visita" />;
  }

  const notices = [
    ...(visit.deleted ? ['Esta visita ha sido eliminada'] : []),
    ...(visit.restaurant.deleted ? ['El restaurante de esta visita ha sido eliminado'] : []),
  ];

  return (
    <DetailScaffold
      media={<ImageDisplay images={visit.images} />}
      // The place leads and the date supports it. The old screen titled the
      // visit with its date, which is the part you are least likely to recall.
      title={visit.restaurant.name}
      subtitle={formatVisitDate(visit.visited_at)}
      {...(notices.length > 0 ? { notices } : {})}
      actions={[
        {
          icon: 'share-outline',
          label: 'Compartir',
          onPress: () => void handleShare(),
          busy: isSharing,
        },
        {
          icon: 'create-outline',
          label: 'Editar',
          // push, not replace: replacing meant that after editing, going back
          // skipped the visit you had just been looking at.
          onPress: () => router.push({ pathname: '/visits/[id]/edit', params: { id: String(id) } }),
        },
        {
          icon: 'trash-outline',
          label: 'Eliminar',
          onPress: () => void handleDelete(),
          danger: true,
        },
      ]}
    >
      <SegmentedTabs
        tabs={[
          { key: 'details', label: 'Detalles', render: () => <VisitDetails visit={visit} /> },
          { key: 'dishes', label: 'Platos', render: () => <VisitDishes visit={visit} /> },
        ]}
      />
    </DetailScaffold>
  );
}
