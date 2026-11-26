import { useState, useEffect, useCallback } from 'react';
import {
  ConnectionState,
  DeviceInfo,
  QRPairingPayload,
  RuntimeSettings,
  TransferHistoryEntry,
  TransferRecord,
  TrustedDevice,
} from '../types/droply';
import { droplyEngine } from '../services/droplyEngine';

interface DroplyStoreState {
  engineConnected: boolean;
  connectionState: ConnectionState;
  selfDevice: DeviceInfo | null;
  peers: DeviceInfo[];
  activePairing: QRPairingPayload | null;
  qrPayloadString: string;
  transfers: TransferRecord[];
  history: TransferHistoryEntry[];
  trustedDevices: TrustedDevice[];
  settings: RuntimeSettings | null;
  freeStorageGB: number;
  lastError: string | null;
}

let globalState: DroplyStoreState = {
  engineConnected: false,
  connectionState: 'Discovering',
  selfDevice: null,
  peers: [],
  activePairing: null,
  qrPayloadString: '',
  transfers: [],
  history: [],
  trustedDevices: [],
  settings: null,
  freeStorageGB: 142.8,
  lastError: null,
};

const listeners = new Set<() => void>();

function setGlobalState(partial: Partial<DroplyStoreState>) {
  globalState = { ...globalState, ...partial };
  listeners.forEach((l) => l());
}

export async function syncWithGoEngine(): Promise<boolean> {
  try {
    const [status, peers, txData, history, trusted] = await Promise.all([
      droplyEngine.getStatus(),
      droplyEngine.listPeers(),
      droplyEngine.listTransfers(),
      droplyEngine.listHistory(),
      droplyEngine.listTrustedDevices(),
    ]);

    const activeTx = (txData.transfers || []).some(
      (t) => t.status === 'Transferring' || t.status === 'Preparing' || t.status === 'Verifying'
    );

    setGlobalState({
      engineConnected: true,
      connectionState: activeTx ? 'Transferring' : 'Connected',
      selfDevice: status.self,
      settings: status.settings,
      freeStorageGB: status.free_gb ? Number(status.free_gb.toFixed(1)) : 142.8,
      activePairing: status.active_pairing,
      qrPayloadString: status.qr_payload_str || '',
      peers,
      transfers: txData.transfers || [],
      history,
      trustedDevices: trusted,
      lastError: null,
    });
    return true;
  } catch (err: any) {
    setGlobalState({
      engineConnected: false,
      lastError: err?.message || 'Go Engine offline',
    });
    return false;
  }
}

export function useDroplyStore() {
  const [state, setState] = useState<DroplyStoreState>(globalState);

  useEffect(() => {
    const listener = () => setState({ ...globalState });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const rescanLAN = useCallback(async () => {
    setGlobalState({ connectionState: 'Discovering' });
    try {
      const peers = await droplyEngine.rescanPeers();
      setGlobalState({ peers, connectionState: 'Connected' });
    } catch {
      await syncWithGoEngine();
    }
  }, []);

  const refreshPairingSession = useCallback(async () => {
    try {
      const res = await droplyEngine.generatePairingQR();
      setGlobalState({
        activePairing: res.payload,
        qrPayloadString: res.qr_payload_str,
      });
    } catch (e: any) {
      setGlobalState({ lastError: e?.message });
    }
  }, []);

  const pairWithQR = useCallback(async (qrString: string) => {
    setGlobalState({ connectionState: 'Pairing' });
    const res = await droplyEngine.connectWithPairing({ qr_string: qrString });
    await syncWithGoEngine();
    return res;
  }, []);

  const pairWithManualEndpoint = useCallback(
    async (ip: string, port: number, pin?: string) => {
      setGlobalState({ connectionState: 'Pairing' });
      if (pin) {
        const res = await droplyEngine.connectWithPairing({ ip, port, pin });
        await syncWithGoEngine();
        return res;
      }
      const peer = await droplyEngine.registerManualPeer({
        ip_address: ip,
        port,
      });
      await syncWithGoEngine();
      return peer;
    },
    []
  );

  const startFileTransfer = useCallback(
    async (params: {
      peer_id: string;
      peer_ip?: string;
      peer_port?: number;
      peer_name?: string;
      file_paths?: string[];
      synthetic_file?: { file_name: string; size_bytes: number };
    }) => {
      setGlobalState({ connectionState: 'Transferring' });
      const job = await droplyEngine.sendFiles(params);
      await syncWithGoEngine();
      return job;
    },
    []
  );

  const pauseActiveTransfer = useCallback(async (transferId: string) => {
    await droplyEngine.pauseTransfer(transferId);
    await syncWithGoEngine();
  }, []);

  const resumeActiveTransfer = useCallback(async (transferId: string) => {
    await droplyEngine.resumeTransfer(transferId);
    await syncWithGoEngine();
  }, []);

  const cancelActiveTransfer = useCallback(async (transferId: string) => {
    await droplyEngine.cancelTransfer(transferId);
    await syncWithGoEngine();
  }, []);

  const approveIncomingTransfer = useCallback(async (transferId: string) => {
    await droplyEngine.approveIncoming(transferId);
    await syncWithGoEngine();
  }, []);

  const rejectIncomingTransfer = useCallback(async (transferId: string) => {
    await droplyEngine.rejectIncoming(transferId);
    await syncWithGoEngine();
  }, []);

  const updateEngineSettings = useCallback(
    async (partial: Partial<RuntimeSettings>) => {
      const updated = await droplyEngine.updateSettings(partial);
      setGlobalState({ settings: updated });
      await syncWithGoEngine();
    },
    []
  );

  return {
    ...state,
    syncWithGoEngine,
    rescanLAN,
    refreshPairingSession,
    pairWithQR,
    pairWithManualEndpoint,
    startFileTransfer,
    pauseActiveTransfer,
    resumeActiveTransfer,
    cancelActiveTransfer,
    approveIncomingTransfer,
    rejectIncomingTransfer,
    updateEngineSettings,
  };
}
