import { useEffect } from 'react';
import { useDroplyStore } from '../../store/useDroplyStore';

export function useDiscovery(autoPollMs = 4000) {
  const {
    peers,
    selfDevice,
    connectionState,
    engineConnected,
    rescanLAN,
    pairWithManualEndpoint,
    syncWithGoEngine,
  } = useDroplyStore();

  useEffect(() => {
    syncWithGoEngine();
    const timer = setInterval(() => {
      syncWithGoEngine();
    }, autoPollMs);
    return () => clearInterval(timer);
  }, [autoPollMs]);

  return {
    peers,
    selfDevice,
    connectionState,
    engineConnected,
    rescanLAN,
    connectManualPeer: pairWithManualEndpoint,
  };
}
