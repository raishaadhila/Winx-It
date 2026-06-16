import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

type State<T> = {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
};

type Options = {
  /** Skip the initial fetch (e.g. when inputs aren't ready) */
  skip?: boolean;
  /** Auto re-run when deps change (default: []) */
  deps?: ReadonlyArray<unknown>;
};

/**
 * Tiny data-fetching hook. Re-runs when `deps` change, exposes refetch.
 * Doesn't auto-handle caching or stale-while-revalidate — keep it simple.
 */
export function useApi<T>(fn: () => Promise<T>, opts: Options = {}) {
  const { skip = false, deps = [] } = opts;
  const [state, setState] = useState<State<T>>({ data: null, loading: !skip, error: null });
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    if (skip) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (mounted.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (mounted.current)
        setState({ data: null, loading: false, error: err as ApiError | Error });
    }
  }, [skip]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => run(), [run]);

  const setData = useCallback((updater: (prev: T | null) => T | null) => {
    setState((s) => ({ ...s, data: updater(s.data) }));
  }, []);

  return { ...state, refetch, setData };
}
