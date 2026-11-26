export const DAEMON_API_URL =
  process.env.NEXT_PUBLIC_DROPLY_DAEMON_URL || 'http://127.0.0.1:53318/api/v1';

export interface DaemonPeer {
  device_id: string;
  device_name: string;
  device_type: 'mac' | 'android' | 'ios' | 'windows' | 'tablet';
  platform: string;
  ip_address: string;
  port: number;
  online: boolean;
  trusted: boolean;
  connection_state: string;
  distance_hint?: string;
  protocol_badge?: string;
}

export interface DaemonTransfer {
  transfer_id: string;
  direction: 'send' | 'receive';
  sender: DaemonPeer;
  receiver: DaemonPeer;
  files: Array<{
    file_id: string;
    file_name: string;
    file_size: number;
    sha256: string;
  }>;
  total_size: number;
  transferred_bytes: number;
  current_speed_mbps: number;
  peak_speed_mbps: number;
  progress_percent: number;
  status: string;
}

export async function fetchDaemonStatus() {
  const res = await fetch(`${DAEMON_API_URL}/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Daemon unreachable');
  return res.json();
}

export async function fetchDaemonPeers(): Promise<DaemonPeer[]> {
  const res = await fetch(`${DAEMON_API_URL}/peers`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Daemon unreachable');
  const data = await res.json();
  return data.peers || [];
}

export async function triggerDaemonRescan(): Promise<DaemonPeer[]> {
  const res = await fetch(`${DAEMON_API_URL}/peers/rescan`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Rescan failed');
  const data = await res.json();
  return data.peers || [];
}

export async function generateDaemonQR() {
  const res = await fetch(`${DAEMON_API_URL}/pairing/generate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('QR generation failed');
  return res.json();
}

export async function dispatchDaemonTransfer(params: {
  peer_id: string;
  peer_name?: string;
  peer_ip?: string;
  peer_port?: number;
  file_paths?: string[];
  synthetic_file?: { file_name: string; size_bytes: number };
}) {
  const res = await fetch(`${DAEMON_API_URL}/transfers/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Transfer dispatch failed');
  return res.json();
}

export async function controlDaemonTransfer(
  action: 'pause' | 'resume' | 'cancel' | 'approve' | 'reject',
  transferId: string
) {
  const res = await fetch(`${DAEMON_API_URL}/transfers/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transfer_id: transferId }),
  });
  if (!res.ok) throw new Error(`Transfer ${action} failed`);
  return res.json();
}

export async function saveDaemonSettings(settings: Record<string, any>) {
  const res = await fetch(`${DAEMON_API_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save settings to Go daemon');
  return res.json();
}
