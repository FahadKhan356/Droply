import { useDroplyStore } from '../../store/useDroplyStore';

export function usePairing() {
  const {
    activePairing,
    qrPayloadString,
    refreshPairingSession,
    pairWithQR,
    pairWithManualEndpoint,
  } = useDroplyStore();

  return {
    activePairing,
    qrPayloadString,
    refreshPairingSession,
    pairWithQR,
    pairWithPIN: (ip: string, port: number, pin: string) =>
      pairWithManualEndpoint(ip, port, pin),
  };
}
