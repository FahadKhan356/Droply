import { useDroplyStore } from '../../store/useDroplyStore';
import { droplyEngine } from '../../services/droplyEngine';

export function useTrustedDevices() {
  const { trustedDevices, syncWithGoEngine } = useDroplyStore();

  const renameDevice = async (deviceId: string, newName: string) => {
    await droplyEngine.renameTrustedDevice(deviceId, newName);
    await syncWithGoEngine();
  };

  const revokeTrust = async (deviceId: string) => {
    await droplyEngine.revokeTrustedDevice(deviceId);
    await syncWithGoEngine();
  };

  return {
    trustedDevices,
    renameDevice,
    revokeTrust,
  };
}
