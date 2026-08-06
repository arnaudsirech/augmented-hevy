import { useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs `fetcher` whenever `deps` change, tracking loading/error state and
 * ignoring results from stale (superseded) requests.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (requestId.current === id) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (requestId.current === id) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Something went wrong",
          });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
