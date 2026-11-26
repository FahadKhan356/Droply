export type ConnectionState =
  | 'Disconnected'
  | 'Discovering'
  | 'Connecting'
  | 'Pairing'
  | 'Connected'
  | 'Transferring'
  | 'Interrupted'
  | 'Failed';

export type TransferStatus =
  | 'Queued'
  | 'Connecting'
  | 'Waiting for Approval'
  | 'Preparing'
  | 'Transferring'
  | 'Paused'
  | 'Interrupted'
  | 'Verifying'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'Rejected';

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_type: 'android' | 'ios' | 'mac' | 'windows' | 'tablet';
  platform: string;
  ip_address: string;
  port: number;
  capabilities: string[];
  protocol_version: string;
  tls_fingerprint?: string;
  online: boolean;
  last_seen: string;
  connection_state: ConnectionState;
  trusted: boolean;
  distance_hint?: string;
  protocol_badge?: string;
}

export interface QRPairingPayload {
  v: string;
  sid: string;
  id: string;
  name: string;
  type: string;
  ip: string;
  port: number;
  token: string;
  pin: string;
  fp: string;
  exp: number;
}

export interface FileMetadata {
  file_id: string;
  file_name: string;
  relative_path?: string;
  file_size: number;
  mime_type: string;
  extension: string;
  sha256: string;
  chunk_size: number;
  total_chunks: number;
  thumbnail_b64?: string;
  source_path?: string;
}

export interface TransferRecord {
  transfer_id: string;
  session_id: string;
  direction: 'send' | 'receive';
  sender: DeviceInfo;
  receiver: DeviceInfo;
  files: FileMetadata[];
  total_size: number;
  transferred_bytes: number;
  current_speed_mbps: number;
  peak_speed_mbps: number;
  progress_percent: number;
  status: TransferStatus;
  start_time: string;
  completion_time?: string;
  saved_paths?: string[];
  error_code?: string;
  error_message?: string;
}

export interface TransferHistoryEntry {
  transfer_id: string;
  direction: 'send' | 'receive';
  peer_device_id: string;
  peer_device_name: string;
  peer_ip: string;
  peer_port: number;
  file_names: string[];
  source_paths?: string[];
  saved_locations?: string[];
  total_size_bytes: number;
  duration_seconds: number;
  average_speed_mbps: number;
  status: TransferStatus;
  error_message?: string;
  timestamp: string;
}

export interface TrustedDevice {
  device_id: string;
  device_name: string;
  custom_alias?: string;
  device_type: string;
  platform: string;
  tls_fingerprint: string;
  last_ip: string;
  last_port: number;
  supported_features: string[];
  auto_accept: boolean;
  paired_at: string;
  last_connected_at: string;
}

export interface RuntimeSettings {
  device_name: string;
  preset: 'turbo' | 'balanced' | 'custom';
  upload_rate_mbps: number;
  download_rate_mbps: number;
  parallel_streams: number;
  listen_port: number;
  visibility: 'everyone' | 'contacts' | 'hidden';
  auto_accept_paired: boolean;
  download_dir: string;
}
