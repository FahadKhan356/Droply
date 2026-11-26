import { useEffect } from 'react';
import { useDroplyStore } from '../store/useDroplyStore';

export function useDroplyEngine(pollIntervalMs = 2000) {
  const store = useDroplyStore();

  useEffect(() => {
    store.syncWithGoEngine();
    const interval = setInterval(() => {
      store.syncWithGoEngine();
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  return store;
}
