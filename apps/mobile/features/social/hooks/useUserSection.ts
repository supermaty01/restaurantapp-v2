import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchUserSection, type FeedEntry, type SectionQuery } from '../api';

const PAGE_SIZE = 20;

/**
 * Una sección del perfil de otra persona, paginada por número de página.
 *
 * `usePagedResource` no sirve aquí: pagina con un cursor de fecha, y una sección
 * ordenada por nombre o por nota no tiene ninguna fecha que nombre la posición
 * siguiente. Cambiar de orden o de filtro empieza de cero, que es lo que hay que
 * hacer de todas formas — la página 3 del orden anterior no significa nada en el
 * nuevo.
 */
export interface UserSection {
  items: FeedEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  reload: () => Promise<void>;
  loadMore: () => void;
}

export function useUserSection(userId: string, query: SectionQuery | null): UserSection {
  const [items, setItems] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(query));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [page, setPage] = useState(0);

  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (target: SectionQuery) => {
      if (inFlight.current) return;
      inFlight.current = true;

      const first = target.page === 0;
      if (first) setLoading(true);
      else setLoadingMore(true);

      try {
        const rows = await fetchUserSection(userId, target, PAGE_SIZE);
        if (!mounted.current) return;
        setError(null);
        setExhausted(rows.length < PAGE_SIZE);
        setItems((current) => (first ? rows : [...current, ...rows]));
        setPage(target.page);
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
    [userId],
  );

  // La consulta entera es la dependencia: cambiar de pestaña, de orden o de
  // filtro es una lista nueva, no una continuación de la anterior.
  const signature = query ? `${query.kind}|${query.sort}|${query.minRating ?? ''}` : null;

  useEffect(() => {
    if (!query) {
      setItems([]);
      setLoading(false);
      return;
    }
    setItems([]);
    setExhausted(false);
    void load({ ...query, page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, load]);

  const reload = useCallback(async () => {
    if (!query) return;
    setExhausted(false);
    await load({ ...query, page: 0 });
  }, [query, load]);

  const loadMore = useCallback(() => {
    if (!query || exhausted || loading || loadingMore || items.length === 0) return;
    void load({ ...query, page: page + 1 });
  }, [query, exhausted, loading, loadingMore, items.length, page, load]);

  return { items, loading, loadingMore, error, reload, loadMore };
}
