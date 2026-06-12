import { useState, useEffect, useCallback, useRef, type DependencyList } from 'react';
import type { Result } from '../types/result';

interface UsePaginatedListOptions<T> {
  fetcher: (page: number, limit: number) => Promise<Result<T[]>>;
  limit?: number;
  dependencies?: DependencyList;
}

export function usePaginatedList<T>({
  fetcher,
  limit = 20,
  dependencies = [],
}: UsePaginatedListOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const loadData = useCallback(async (targetPage: number, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetcherRef.current(targetPage, limit);
      if (result.success) {
        const newItems = result.data;
        setData((prev) => (isRefresh || targetPage === 1 ? newItems : [...prev, ...newItems]));
        setPage(targetPage);
        setHasMore(newItems.length === limit);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit]);

  const refresh = useCallback(async () => {
    await loadData(1, true);
  }, [loadData]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || !hasMore) return;
    await loadData(page + 1, false);
  }, [loading, refreshing, hasMore, page, loadData]);

  useEffect(() => {
    loadData(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    data,
    loading,
    refreshing,
    error,
    hasMore,
    loadMore,
    refresh,
    setData,
  };
}
