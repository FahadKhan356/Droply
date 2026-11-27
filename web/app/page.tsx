'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DAEMON_API_URL,
  getDaemonApiUrl,
  announceWebClient,
  DaemonHistoryEntry,
  DaemonTransfer,
  RealFileEntry,
  controlDaemonTransfer,
  dispatchDaemonTransfer,
  fetchDaemonFiles,
  fetchDaemonPeers,
  fetchDaemonStatus,
  fetchDaemonTransfers,
  generateDaemonQR,
  triggerDaemonRescan,
  uploadFileToDaemon,
} from '../lib/droplyClient';
import {
  Radio,
  RefreshCw,
  Laptop,
  Smartphone,
  Monitor,
  FolderArchive,
  Upload,
  FolderPlus,
  CheckCircle2,
  Infinity,
  Lock,
  ArrowRight,
  X,
  Send,
  Zap,
  Clock,
  Pause,
  Play,
  QrCode,
  Eye,
  FileText,
  Video,
  FileArchive,
  Download,
} from 'lucide-react';

interface PeerNode {
  id: string;
  name: string;
  os: string;
  ip: string;
  port: number;
  distance: string;
  type: 'mac' | 'android' | 'ios' | 'windows';
  protocol: string;
  badge: string;
  status: string;
  isHost?: boolean;
}

function formatBytesWeb(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
}

export default function TransfersPage() {
  const [stagedFiles, setStagedFiles] = useState<RealFileEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [livePin, setLivePin] = useState<string>('----');
  const [peersList, setPeersList] = useState<PeerNode[]>([]);
  const [liveTransfers, setLiveTransfers] = useState<DaemonTransfer[]>([]);
  const [historyList, setHistoryList] = useState<DaemonHistoryEntry[]>([]);
  const dropInputRef = useRef<HTMLInputElement>(null);

  const loadAllRealData = useCallback(async () => {
    try {
      const [st, peers, files, txBundle] = await Promise.all([
        fetchDaemonStatus(),
        fetchDaemonPeers(),
        fetchDaemonFiles(),
        fetchDaemonTransfers(),
      ]);

      if (st?.active_pairing?.pin) {
        setLivePin(st.active_pairing.pin);
      }

      const selfId = st?.self?.device_id;
      const mappedPeers: PeerNode[] = (peers || []).map((p) => ({
        id: p.device_id,
        name: p.device_name,
        os: p.platform,
        ip: p.ip_address,
        port: p.port,
        distance: p.distance_hint || 'LAN Direct',
        type:
          p.device_type === 'tablet'
            ? 'ios'
            : (p.device_type as PeerNode['type']) || 'mac',
        protocol: `${p.ip_address}:${p.port}`,
        badge: p.device_id === selfId ? 'Local Host' : p.trusted ? 'Trusted P2P' : 'Direct Link',
        status: p.connection_state || 'Connected',
        isHost: p.device_id === selfId,
      }));
      setPeersList(mappedPeers);
      if (!selectedPeerId && mappedPeers.length > 0) {
        setSelectedPeerId(mappedPeers[0].id);
      }

      setStagedFiles((prev) => (prev.length > 0 ? prev : (files || []).slice(0, 4)));
      setLiveTransfers(txBundle.transfers || []);
      setHistoryList(txBundle.history || []);
    } catch {}
  }, [selectedPeerId]);

  useEffect(() => {
    // Announce this browser client to the DROPly Go network
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent;
    let devType = 'mac';
    let devName = 'Web Client';
    let platform = 'web';

    if (/iPhone/i.test(ua)) {
      devType = 'ios';
      devName = "iPhone (Mobile Web)";
      platform = 'ios';
    } else if (/iPad/i.test(ua)) {
      devType = 'tablet';
      devName = "iPad (Mobile Web)";
      platform = 'ios';
    } else if (/Android/i.test(ua)) {
      devType = 'android';
      devName = "Android (Mobile Web)";
      platform = 'android';
    } else if (/Windows/i.test(ua)) {
      devType = 'windows';
      devName = "Windows PC (Web)";
      platform = 'windows';
    }

    let clientId = localStorage.getItem('droply_web_client_id');
    if (!clientId) {
      clientId = 'web_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('droply_web_client_id', clientId);
    }

    const announce = () => {
      announceWebClient({
        device_id: clientId!,
        device_name: devName,
        device_type: devType,
        platform: platform,
      });
    };

    announce();
    const interval = setInterval(announce, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadAllRealData();
    const poll = setInterval(loadAllRealData, 2500);

    let es: EventSource | null = null;
    try {
      es = new EventSource(`${getDaemonApiUrl()}/events`);
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          loadAllRealData();
          if (
            parsed.type === 'transfer_update' &&
            parsed.payload?.status === 'Completed'
          ) {
            setToastMessage(
              `Verified SHA-256 & saved ${
                parsed.payload?.files?.[0]?.file_name || 'file'
              } to Downloads/DROPly!`
            );
            setTimeout(() => setToastMessage(null), 4000);
          }
        } catch {}
      };
    } catch {}

    return () => {
      clearInterval(poll);
      if (es) es.close();
    };
  }, [loadAllRealData]);

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await triggerDaemonRescan();
      await loadAllRealData();
    } catch {}
    setTimeout(() => setIsScanning(false), 800);
  };

  const handleFilesPicked = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const uploaded: RealFileEntry[] = [];
    setToastMessage(`Processing ${fileList.length} file(s)...`);
    for (let i = 0; i < fileList.length; i++) {
      try {
        const entry = await uploadFileToDaemon(fileList[i]);
        uploaded.push(entry);
      } catch (err: any) {
        console.error('File upload error:', err);
        setToastMessage(`Failed to stage ${fileList[i].name}: ${err?.message || 'Error'}`);
      }
    }
    if (uploaded.length > 0) {
      setStagedFiles((prev) => [...uploaded, ...prev]);
      setToastMessage(`Staged ${uploaded.length} real file(s) for P2P transfer!`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearStaging = () => {
    setStagedFiles([]);
  };

  const handleGenerateTempQR = async () => {
    try {
      const res = await generateDaemonQR();
      if (res?.payload?.pin) {
        setLivePin(res.payload.pin);
        setToastMessage(
          `Generated fresh one-time pairing token & PIN: DROP · ${res.payload.pin}`
        );
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch {}
  };

  const targetPeer =
    peersList.find((p) => p.id === selectedPeerId) || peersList[0] || null;

  const totalStagedBytes = stagedFiles.reduce(
    (acc, f) => acc + (f.size_bytes || 0),
    0
  );

  const handleBlastSend = async () => {
    if (stagedFiles.length === 0) return;
    try {
      await dispatchDaemonTransfer({
        peer_id: targetPeer?.id || 'local_host',
        peer_name: targetPeer?.name || 'Local Host',
        peer_ip: targetPeer?.ip || '127.0.0.1',
        peer_port: targetPeer?.port || 53317,
        file_paths: stagedFiles.map((f) => f.source_path),
      });
      setToastMessage(
        `Streaming ${stagedFiles.length} real file(s) over TLS 1.3 to ${
          targetPeer?.name || 'Local Host'
        }!`
      );
      await loadAllRealData();
    } catch (e: any) {
      setToastMessage(`Transfer error: ${e?.message || 'Daemon error'}`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  const aggregatedSpeed = liveTransfers.reduce(
    (sum, t) => sum + (t.current_speed_mbps || 0),
    0
  );
  const peakSpeed = Math.max(
    aggregatedSpeed,
    ...liveTransfers.map((t) => t.peak_speed_mbps || 0),
    ...historyList.map((h) => h.average_speed_mbps || 0),
    0
  );

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto pb-16">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* ================= COLUMN 1 & 2: CENTER / STAGING & RADAR (8 COLS) ================= */}
        <div className="xl:col-span-8 flex flex-col gap-8">
          {/* RADAR & PEER DISCOVERY BANNER */}
          <section className="relative overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl p-8 border border-slate-200/80 shadow-sm">
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary-container/10 blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-tertiary-fixed-dim/20 blur-3xl pointer-events-none"></div>

            {/* Radar Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-container text-white shadow-md shadow-primary/20">
                    <Radio
                      className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`}
                    />
                  </span>
                  <h2 className="text-xl font-bold text-on-surface tracking-tight">
                    Active Peer Radar
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold uppercase tracking-wider">
                    TLS 1.3 Direct
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                  </span>
                  <p className="text-xs text-on-surface-variant">
                    {peersList.length} Real Node(s) Active on LAN • Zero Cloud / Pure P2P
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRescan}
                  className="h-10 px-4 rounded-full bg-surface-container-low hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 border border-slate-200/50"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-primary ${
                      isScanning ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Rescan Peers</span>
                </button>
                <div className="h-6 w-px bg-slate-200"></div>
                <button
                  onClick={handleRescan}
                  className="h-10 px-4 rounded-full bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-primary/20 transition-all active:scale-95"
                >
                  <Radio className="w-4 h-4" />
                  <span>Broadcast Beacon</span>
                </button>
              </div>
            </div>

            {/* Real Peer Nodes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {peersList.map((node) => {
                const isSelected = selectedPeerId === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedPeerId(node.id)}
                    className={`group relative p-4 rounded-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between border ${
                      isSelected
                        ? 'bg-white border-primary-container shadow-md ring-2 ring-primary/20'
                        : node.isHost
                        ? 'bg-primary-fixed/40 border-primary/30 hover:bg-primary-fixed/60'
                        : 'bg-surface-container-low/80 hover:bg-white hover:shadow-md border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${
                          node.isHost
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-primary-container/15 text-primary'
                        }`}
                      >
                        {node.type === 'mac' && <Laptop className="w-5 h-5" />}
                        {node.type === 'android' && (
                          <Smartphone className="w-5 h-5" />
                        )}
                        {node.type === 'ios' && (
                          <Smartphone className="w-5 h-5" />
                        )}
                        {node.type === 'windows' && (
                          <Monitor className="w-5 h-5" />
                        )}
                      </div>
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                        {node.badge}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col">
                      <span className="text-sm font-bold text-on-surface truncate">
                        {node.name}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {node.os} • {node.distance}
                      </span>
                      <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between text-xs">
                        <span className="text-tertiary font-mono font-medium">
                          {node.protocol}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant text-[10px] font-bold">
                          {node.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fast Pairing Bar */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-container-low/90 px-5 py-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Direct PIN:
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-white text-primary text-base font-extrabold tracking-widest shadow-sm font-mono border border-slate-200/60">
                    DROP · {livePin}
                  </span>
                </div>
                <div className="hidden sm:block h-4 w-px bg-slate-300"></div>
                <span className="hidden md:inline text-xs text-on-surface-variant">
                  Real one-time cryptographic pairing PIN from Go Engine
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateTempQR}
                  className="h-8 px-3 rounded-full bg-white hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200/50 shadow-xs"
                >
                  <QrCode className="w-3.5 h-3.5 text-tertiary" />
                  <span>Generate Temp QR</span>
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/70 text-on-secondary-fixed text-xs font-semibold">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  <span>Receive: All Nearby</span>
                </div>
              </div>
            </div>
          </section>

          {/* HIGH-FIDELITY DRAG-AND-DROP STAGING AREA */}
          <section id="dropzone" className="flex flex-col gap-6">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesPicked(e.dataTransfer.files);
              }}
              className="relative group overflow-hidden rounded-3xl p-10 text-center bg-gradient-to-b from-white to-surface-container-low/70 hover:to-surface-container-high/40 transition-all duration-300 cursor-pointer border border-slate-200/80 shadow-sm"
            >
              <div className="absolute inset-0 bg-[radial-gradient(#3867ff_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none"></div>

              <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
                <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full bg-primary-container/20 animate-ping"
                    style={{ animationDuration: '3s' }}
                  ></div>
                  <div className="w-16 h-16 rounded-2xl bg-primary-container text-white flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                    <FolderArchive className="w-8 h-8 text-white" />
                  </div>
                  <span className="absolute -right-1 -top-1 w-6 h-6 rounded-full bg-tertiary text-white flex items-center justify-center shadow-sm">
                    <Zap className="w-3.5 h-3.5" />
                  </span>
                </div>

                <h3 className="text-xl font-bold text-on-surface tracking-tight">
                  Drag & Drop files or folders here
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant max-w-md">
                  Select real files from your Mac filesystem to stream directly over TLS 1.3 with SHA-256 verification.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <label className="cursor-pointer h-11 px-6 rounded-full bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-primary/25 transition-all active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>Browse System Files</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFilesPicked(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <label className="cursor-pointer h-11 px-5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200/60">
                    <FolderPlus className="w-4 h-4 text-tertiary" />
                    <span>Add More Files</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFilesPicked(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-on-surface-variant">
                  <span className="px-3 py-1 rounded-full bg-surface-container text-xs font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    Zero Compression
                  </span>
                  <span className="px-3 py-1 rounded-full bg-surface-container text-xs font-medium flex items-center gap-1.5">
                    <Infinity className="w-3.5 h-3.5 text-primary" />
                    Unlimited File Sizes
                  </span>
                  <span className="px-3 py-1 rounded-full bg-surface-container text-xs font-medium flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    TLS 1.3 Local Direct
                  </span>
                </div>
              </div>
            </div>

            {/* Real Staged Files Queue for Dispatch */}
            <div className="flex flex-col rounded-3xl bg-white/90 backdrop-blur-xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <h4 className="text-base font-bold text-on-surface">
                    Staged for Blast (Real Files)
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-container/15 text-primary text-xs font-bold">
                    {stagedFiles.length} Items Staged
                  </span>
                </div>
                {stagedFiles.length > 0 && (
                  <button
                    onClick={handleClearStaging}
                    className="text-xs font-semibold text-outline hover:text-error transition-colors flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear Staging</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-4">
                {stagedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-surface-container-low/70 hover:bg-surface-container-high/40 transition-colors gap-4 border border-slate-200/40"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-primary-container text-white flex items-center justify-center shrink-0 shadow-xs">
                        {file.type === 'video' ? (
                          <Video className="w-5 h-5 text-white" />
                        ) : file.type === 'archive' ? (
                          <FileArchive className="w-5 h-5 text-white" />
                        ) : (
                          <FileText className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-on-surface truncate">
                            {file.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-surface-container-highest text-primary text-[10px] font-bold shrink-0">
                            {file.ext}
                          </span>
                        </div>
                        <span className="text-xs text-on-surface-variant font-mono truncate">
                          {file.size_str} • {file.source_path}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full shadow-xs border border-slate-200/60">
                        <ArrowRight className="w-3.5 h-3.5 text-tertiary" />
                        <span className="text-xs text-on-surface-variant font-medium">
                          To:
                        </span>
                        <span className="text-xs text-primary font-bold">
                          {targetPeer?.name || 'Local Host'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveStaged(file.id)}
                        className="w-8 h-8 rounded-full bg-surface-container hover:bg-error hover:text-white transition-colors text-on-surface-variant flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Staging Action Bar */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-on-surface">
                    Total Staged:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-surface-container-highest text-primary text-lg font-bold font-mono">
                    {formatBytesWeb(totalStagedBytes)}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    ({stagedFiles.length} real files targeted for{' '}
                    {targetPeer?.name || 'Local Host'})
                  </span>
                </div>

                <button
                  onClick={handleBlastSend}
                  disabled={stagedFiles.length === 0}
                  className="h-11 px-6 rounded-full bg-primary hover:bg-primary-container disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-primary/30 transition-all transform active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    Send to {targetPeer?.name || 'Peer'} ({formatBytesWeb(totalStagedBytes)})
                  </span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* ================= COLUMN 3: RIGHT / PERSISTENT TRANSFER MANAGER (4 COLS) ================= */}
        <div id="transfers" className="xl:col-span-4 flex flex-col gap-6">
          <div className="p-6 rounded-3xl bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed/60 flex items-center justify-center text-primary">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-base font-bold text-on-surface">
                  Transfer Manager
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-bold">
                {liveTransfers.length} Active • {historyList.length} Completed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-surface-container-low/70 border border-slate-200/40">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">
                  Aggregated Speed
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl text-primary font-extrabold tracking-tight font-mono">
                    {aggregatedSpeed.toFixed(1)}
                  </span>
                  <span className="text-xs text-on-surface-variant font-bold">
                    MB/s
                  </span>
                </div>
                <span className="text-[11px] text-tertiary font-medium">
                  Peak: {peakSpeed.toFixed(1)} MB/s
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">
                  Integrity Engine
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl text-on-surface font-extrabold tracking-tight font-mono">
                    SHA-256
                  </span>
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  TLS 1.3 Direct P2P
                </span>
              </div>
            </div>
          </div>

          {/* REAL ACTIVE TRANSFERS & HISTORY CARDS */}
          <div className="flex flex-col gap-4">
            {liveTransfers.map((tx) => {
              const pct = Math.round(tx.progress_percent || 0);
              const isPaused = tx.status === 'Paused';
              return (
                <div
                  key={tx.transfer_id}
                  className="p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-3 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-surface-container">
                    <div
                      className="h-full bg-gradient-to-r from-tertiary-fixed-dim via-primary-container to-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>

                  <div className="flex items-start justify-between mt-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {tx.direction === 'send' ? (
                          <Upload className="w-4 h-4 text-primary" />
                        ) : (
                          <Download className="w-4 h-4 text-tertiary" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-on-surface truncate">
                          {tx.files?.map((f) => f.file_name).join(', ')}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Peer:{' '}
                          <strong className="text-on-surface font-semibold">
                            {tx.receiver?.device_name}
                          </strong>{' '}
                          ({tx.receiver?.ip_address})
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-primary-container/15 text-primary text-xs font-extrabold shrink-0 font-mono">
                      {pct}%
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-tertiary via-primary-container to-primary transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-on-surface-variant font-mono">
                      <span>
                        {formatBytesWeb(tx.transferred_bytes)} /{' '}
                        {formatBytesWeb(tx.total_size)}
                      </span>
                      <span className="text-on-surface font-bold">
                        {tx.status} • {(tx.current_speed_mbps || 0).toFixed(1)} MB/s
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-semibold text-outline flex items-center gap-1">
                      <Lock className="w-3 h-3 text-tertiary" />
                      TLS 1.3 Stream
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          controlDaemonTransfer(
                            isPaused ? 'resume' : 'pause',
                            tx.transfer_id
                          ).then(loadAllRealData)
                        }
                        className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        {isPaused ? (
                          <Play className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Pause className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          controlDaemonTransfer('cancel', tx.transfer_id).then(
                            loadAllRealData
                          )
                        }
                        className="p-1.5 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {historyList.slice(0, 6).map((h) => (
              <div
                key={h.transfer_id}
                className="p-4 rounded-2xl bg-white/95 border border-slate-200/70 flex items-center justify-between shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">
                      {h.file_names.join(', ')}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono">
                      {formatBytesWeb(h.total_size_bytes)} • {h.peer_device_name}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {h.status}
                </span>
              </div>
            ))}

            {liveTransfers.length === 0 && historyList.length === 0 && (
              <div className="p-5 rounded-2xl bg-surface-container-low/70 border border-slate-200/50 flex items-center gap-3">
                <Clock className="w-5 h-5 text-on-surface-variant shrink-0" />
                <span className="text-xs text-on-surface-variant">
                  No transfers yet. Click &ldquo;Send to Peer&rdquo; to execute a real TLS 1.3 transfer.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-8 right-8 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
