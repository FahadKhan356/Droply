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

export interface RealFileEntry {
  id: string;
  name: string;
  type: 'photo' | 'video' | 'doc' | 'audio' | 'archive' | 'sheet';
  tag: string;
  ext: string;
  size_str: string;
  size_bytes: number;
  date_str: string;
  color_bg: string;
  source_path: string;
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

export interface DaemonHistoryEntry {
  transfer_id: string;
  direction: 'send' | 'receive';
  peer_device_id: string;
  peer_device_name: string;
  peer_ip: string;
  peer_port: number;
  file_names: string[];
  total_size_bytes: number;
  duration_seconds: number;
  average_speed_mbps: number;
  status: string;
  timestamp: string;
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

export async function fetchDaemonFiles(): Promise<RealFileEntry[]> {
  const res = await fetch(`${DAEMON_API_URL}/files`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch local files');
  const data = await res.json();
  return data.files || [];
}

export async function uploadFileToDaemon(file: File): Promise<RealFileEntry> {
  const res = await fetch(`${DAEMON_API_URL}/files/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': file.name,
    },
    body: file,
  });
  if (!res.ok) throw new Error('Failed to stage file');
  return res.json();
}

export async function fetchDaemonTransfers(): Promise<{
  transfers: DaemonTransfer[];
  history: DaemonHistoryEntry[];
}> {
  const [txRes, histRes] = await Promise.all([
    fetch(`${DAEMON_API_URL}/transfers`, { cache: 'no-store' }),
    fetch(`${DAEMON_API_URL}/history`, { cache: 'no-store' }),
  ]);
  const txData = txRes.ok ? await txRes.json() : { transfers: [] };
  const histData = histRes.ok ? await histRes.json() : { history: [] };
  return {
    transfers: txData.transfers || [],
    history: histData.history || [],
  };
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
