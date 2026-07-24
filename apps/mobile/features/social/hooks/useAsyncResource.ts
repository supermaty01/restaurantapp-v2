import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Refetches. Safe to pass straight to a RefreshControl. */
  reload: () => Promise<void>;
  /** Replaces the local copy without a round trip, for optimistic updates. */
  setData: (next: T) => void;
}

/**
 * Loads something from the network once, with reload and an error the UI can
 * show.
 *
 * The social screens all have the same shape — fetch, spinner, error, pull to
 * refresh — and the cloud is optional, so every one of them has to survive
 * being offline or signed out without blowing up. Doing that once here keeps it
 * consistent; `enabled` is what lets a screen render its signed-out state
 * instead of firing a request that is guaranteed to fail.
 */
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  { enabled = true, deps = [] as unknown[] } = {},
): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref so a caller passing an inline arrow doesn't re-run the fetch
  // on every render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (!mounted.current) return;
      setData(result);
      setError(null);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { data, loading, error, reload: load, setData };
}
