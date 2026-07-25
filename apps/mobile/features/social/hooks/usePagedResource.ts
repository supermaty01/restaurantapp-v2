import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * An endless list fed by a cursor.
 *
 * Every social list on the server pages the same way: ask for a page, get up to
 * `pageSize` rows back, and pass the oldest one's timestamp as `before` to get
 * the next. The screens were all calling the first page and stopping there, so
 * a diary older than twenty entries simply ended.
 *
 * A cursor rather than an offset because the list grows at the top: with
 * `offset` a friend posting mid-scroll shifts every later page by one and you
 * see the same card twice. A timestamp names a position that stays put.
 */
export interface PagedResource<T> {
  items: T[];
  loading: boolean;
  /** True while a *further* page is loading, so the spinner goes at the end. */
  loadingMore: boolean;
  error: string | null;
  exhausted: boolean;
  reload: () => Promise<void>;
  loadMore: () => void;
}

export function usePagedResource<T>(
  fetchPage: (before?: string) => Promise<T[]>,
  cursorOf: (item: T) => string,
  { enabled = true, pageSize = 20, deps = [] as unknown[] } = {},
): PagedResource<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  // Held in a ref so an inline arrow at the call site does not restart paging
  // on every render.
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  const mounted = useRef(true);
  // A page already in flight. Without this, a fast scroll fires `loadMore`
  // several times with the same cursor and the same rows arrive twice.
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (before?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;

      const first = before === undefined;
      if (first) setLoading(true);
      else setLoadingMore(true);

      try {
        const page = await fetchRef.current(before);
        if (!mounted.current) return;

        setError(null);
        // A short page means the end. Asking again would return nothing and
        // leave a spinner running at the bottom forever.
        setExhausted(page.length < pageSize);
        setItems((current) => (first ? page : [...current, ...page]));
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
    [pageSize],
  );

  const reload = useCallback(async () => {
    setExhausted(false);
    await load(undefined);
  }, [load]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }
    void load(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, load, ...deps]);

  const loadMore = useCallback(() => {
    if (exhausted || loading || loadingMore || items.length === 0) return;
    const last = items[items.length - 1];
    if (last) void load(cursorOf(last));
  }, [exhausted, loading, loadingMore, items, load, cursorOf]);

  return { items, loading, loadingMore, error, exhausted, reload, loadMore };
}
