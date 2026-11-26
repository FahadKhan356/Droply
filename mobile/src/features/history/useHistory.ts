import { useDroplyStore } from '../../store/useDroplyStore';
import { droplyEngine } from '../../services/droplyEngine';

export function useHistory() {
  const { history, syncWithGoEngine } = useDroplyStore();

  const clearAllHistory = async () => {
    await droplyEngine.clearHistory();
    await syncWithGoEngine();
  };

  const removeHistoryEntry = async (transferId: string) => {
    await droplyEngine.clearHistory(transferId);
    await syncWithGoEngine();
  };

  return {
    history,
    clearAllHistory,
    removeHistoryEntry,
  };
}
