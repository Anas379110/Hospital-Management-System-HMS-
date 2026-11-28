import { useEffect, useState } from 'react';
import { useQuery, type QueryKey, type QueryFunction } from '@tanstack/react-query';
import { isReadStale, isViewActive, REFRESH_MS } from './freshnessPolicy';

/** Read-only polling. Never used for mutations. Hidden/offline queries do not run. */
export function useFreshRead<T>({ queryKey, queryFn, enabled = true, live = true }: { queryKey: QueryKey; queryFn: QueryFunction<T>; enabled?: boolean; live?: boolean }) {
  const [view, setView] = useState(() => ({ active: isViewActive(document.visibilityState, navigator.onLine), online: navigator.onLine, resumedAt: 0 }));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => { const active = isViewActive(document.visibilityState, navigator.onLine); setView(previous => ({ active, online: navigator.onLine, resumedAt: active && !previous.active ? Date.now() : previous.resumedAt })); setNow(Date.now()); };
    document.addEventListener('visibilitychange', update); window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (!live || !view.active || !enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [view.active, live, enabled]);
  const query = useQuery<T>({ queryKey, queryFn, enabled: enabled && (!live || view.active), staleTime: live ? 0 : 30_000, retry: live ? false : 1, refetchInterval: live && view.active && enabled ? REFRESH_MS : false, refetchIntervalInBackground: false, refetchOnWindowFocus: !live, refetchOnReconnect: !live });
  return { ...query, freshness: { active: view.active, online: view.online, stale: isReadStale(query.dataUpdatedAt, now, view.active, query.isError, view.resumedAt), refresh: () => { if (enabled && view.active) return query.refetch({ cancelRefetch: false }); } } };
}
