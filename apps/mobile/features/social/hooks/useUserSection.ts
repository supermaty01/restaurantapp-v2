import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchUserEntriesPage, type FeedEntry, type FeedKind, type UserEntrySort } from '../api';

/** Lo que el panel de filtros de una sección puede cambiar. */
export interface SectionOptions {
  sort: UserEntrySort;
  descending: boolean;
  /** Nulo salvo en platos y lugares: una visita no tiene nota propia. */
  minRating: number | null;
}

export const defaultSectionOptions: SectionOptions = {
  sort: 'date',
  descending: true,
  minRating: null,
};

const PAGE_SIZE = 20;

export interface UserSection {
  items: FeedEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  reload: () => Promise<void>;
  loadMore: () => void;
}

/**
 * Una sección del perfil de alguien: sus visitas, o sus platos, o sus lugares.
 *
 * Aparte de `usePagedResource` porque pagina distinto y el motivo importa. Allí
 * el cursor es una fecha, y es lo correcto: el feed crece por arriba, así que un
 * desplazamiento haría que un amigo publicando a media lectura desplazara todas
 * las páginas siguientes y salieran tarjetas repetidas.
 *
 * Aquí el orden lo elige quien mira —por nombre, por nota, por fecha—, así que
 * un cursor necesitaría una clave por criterio, cada una con su desempate. La
 * lista es corta y no crece mientras la miras: es el diario de otra persona.
 *
 * Cambiar los filtros vuelve a la primera página. Mantener el desplazamiento al
 * reordenar deja la lista empezando por la mitad de otro orden, que es de las
 * pocas cosas que se leen directamente como un fallo.
 */
export function useUserSection(
  userId: string,
  kind: FeedKind,
  options: SectionOptions,
  { enabled = true }: { enabled?: boolean } = {},
): UserSection {
  const [items, setItems] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Una página ya en vuelo. Sin esto, un scroll rápido pide la misma varias
  // veces y las mismas filas llegan repetidas.
  const inFlight = useRef(false);

  const { sort, descending, minRating } = options;

  const load = useCallback(
    async (offset: number) => {
      if (inFlight.current) return;
      inFlight.current = true;

      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const page = await fetchUserEntriesPage(userId, {
          kind,
          sort,
          descending,
          minRating,
          offset,
          pageSize: PAGE_SIZE,
        });
        if (!mounted.current) return;

        setError(null);
        // Una página corta es el final. Volver a pedir dejaría una ruedecita
        // girando abajo para siempre.
        setExhausted(page.length < PAGE_SIZE);
        setItems((current) => (offset === 0 ? page : [...current, ...page]));
      } catch (cause) {
        if (!mounted.current) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar');
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [userId, kind, sort, descending, minRating],
  );

  const reload = useCallback(async () => {
    setExhausted(false);
    await load(0);
  }, [load]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    setExhausted(false);
    void load(0);
  }, [enabled, load]);

  const loadMore = useCallback(() => {
    if (exhausted || loading || loadingMore || items.length === 0) return;
    void load(items.length);
  }, [exhausted, loading, loadingMore, items.length, load]);

  return { items, loading, loadingMore, error, reload, loadMore };
}
