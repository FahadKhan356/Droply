import {
  DeviceInfo,
  QRPairingPayload,
  RuntimeSettings,
  TransferHistoryEntry,
  TransferRecord,
  TrustedDevice,
} from '../types/droply';

const DEFAULT_ENGINE_URL = 'http://127.0.0.1:53318/api/v1';

class DroplyEngineClient {
  private baseUrl: string = DEFAULT_ENGINE_URL;

  setEngineUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getEngineUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getStatus(): Promise<{
    self: DeviceInfo;
    settings: RuntimeSettings;
    free_bytes: number;
    free_gb: number;
    active_pairing: QRPairingPayload;
    qr_payload_str: string;
  }> {
    return this.request('/status');
  }

  async listPeers(): Promise<DeviceInfo[]> {
    const data = await this.request<{ peers: DeviceInfo[] }>('/peers');
    return data.peers || [];
  }

  async rescanPeers(): Promise<DeviceInfo[]> {
    const data = await this.request<{ peers: DeviceInfo[] }>('/peers/rescan', {
      method: 'POST',
    });
    return data.peers || [];
  }

  async registerManualPeer(peer: Partial<DeviceInfo>): Promise<DeviceInfo> {
    return this.request<DeviceInfo>('/peers/manual', {
      method: 'POST',
      body: JSON.stringify(peer),
    });
  }

  async generatePairingQR(): Promise<{
    payload: QRPairingPayload;
    qr_payload_str: string;
  }> {
    return this.request('/pairing/generate', { method: 'POST' });
  }

  async connectWithPairing(params: {
    qr_string?: string;
    ip?: string;
    port?: number;
    pin?: string;
  }): Promise<{
    authorized: boolean;
    session_id: string;
    auth_session_key?: string;
    host_device: DeviceInfo;
    error_code?: string;
    error_message?: string;
  }> {
    return this.request('/pairing/connect', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async listTransfers(): Promise<{
    transfers: TransferRecord[];
    queue: any[];
  }> {
    return this.request('/transfers');
  }

  async sendFiles(params: {
    peer_id: string;
    peer_ip?: string;
    peer_port?: number;
    peer_name?: string;
    session_id?: string;
    file_paths?: string[];
    synthetic_file?: { file_name: string; size_bytes: number };
    priority?: number;
  }): Promise<any> {
    return this.request('/transfers/send', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async approveIncoming(transferId: string): Promise<void> {
    await this.request('/transfers/approve', {
      method: 'POST',
      body: JSON.stringify({ transfer_id: transferId }),
    });
  }

  async rejectIncoming(transferId: string): Promise<void> {
    await this.request('/transfers/reject', {
      method: 'POST',
      body: JSON.stringify({ transfer_id: transferId }),
    });
  }

  async pauseTransfer(transferId: string): Promise<void> {
    await this.request('/transfers/pause', {
      method: 'POST',
      body: JSON.stringify({ transfer_id: transferId }),
    });
  }

  async resumeTransfer(transferId: string): Promise<void> {
    await this.request('/transfers/resume', {
      method: 'POST',
      body: JSON.stringify({ transfer_id: transferId }),
    });
  }

  async cancelTransfer(transferId: string): Promise<void> {
    await this.request('/transfers/cancel', {
      method: 'POST',
      body: JSON.stringify({ transfer_id: transferId }),
    });
  }

  async listHistory(): Promise<TransferHistoryEntry[]> {
    const data = await this.request<{ history: TransferHistoryEntry[] }>('/history');
    return data.history || [];
  }

  async clearHistory(transferId?: string): Promise<void> {
    const query = transferId ? `?transfer_id=${encodeURIComponent(transferId)}` : '';
    await this.request(`/history${query}`, { method: 'DELETE' });
  }

  async listTrustedDevices(): Promise<TrustedDevice[]> {
    const data = await this.request<{ trusted_devices: TrustedDevice[] }>('/trusted');
    return data.trusted_devices || [];
  }

  async renameTrustedDevice(deviceId: string, newName: string): Promise<TrustedDevice> {
    return this.request('/trusted', {
      method: 'PUT',
      body: JSON.stringify({ device_id: deviceId, new_name: newName }),
    });
  }

  async revokeTrustedDevice(deviceId: string): Promise<void> {
    await this.request(`/trusted?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  }

  async updateSettings(settings: Partial<RuntimeSettings>): Promise<RuntimeSettings> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

export const droplyEngine = new DroplyEngineClient();
