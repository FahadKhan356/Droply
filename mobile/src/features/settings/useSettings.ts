import { useDroplyStore } from '../../store/useDroplyStore';

export function useSettings() {
  const { settings, freeStorageGB, updateEngineSettings } = useDroplyStore();

  return {
    settings,
    freeStorageGB,
    updateEngineSettings,
  };
}
