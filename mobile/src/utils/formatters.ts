export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`;
}

export function formatPIN(rawPin?: string): string {
  const clean = (rawPin || '8924').replace(/[^0-9]/g, '').slice(0, 4).padEnd(4, '0');
  return `DROP · ${clean.split('').join(' ')}`;
}

export function estimateRemainingSeconds(totalBytes: number, transferredBytes: number, speedMBps: number): string {
  const remainingBytes = Math.max(0, totalBytes - transferredBytes);
  if (remainingBytes === 0) return '0s';
  const bps = Math.max(1, speedMBps * 1024 * 1024);
  const secs = Math.ceil(remainingBytes / bps);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}
