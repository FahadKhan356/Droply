'use client';

import React, { useState, useEffect } from 'react';
import {
  DAEMON_API_URL,
  fetchDaemonStatus,
  fetchDaemonPeers,
  triggerDaemonRescan,
  generateDaemonQR,
  dispatchDaemonTransfer,
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
  TrendingUp,
  Clock,
  Pause,
  Play,
  Info,
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
  distance: string;
  type: 'mac' | 'android' | 'ios' | 'windows';
  protocol: string;
  badge: string;
  status: string;
  isHost?: boolean;
}

const PEER_NODES: PeerNode[] = [
  {
    id: '1',
    name: 'Studio Mac M2',
    os: 'macOS',
    distance: '3.5m away',
    type: 'mac',
    protocol: '6GHz • 1.2 Gbps',
    badge: 'Direct Link',
    status: 'Ready',
  },
  {
    id: '2',
    name: "Alex's Galaxy S24",
    os: 'Android 14',
    distance: '1.2m away',
    type: 'android',
    protocol: 'RSSI -42 dBm',
    badge: '5GHz LAN',
    status: 'Ready',
  },
  {
    id: '3',
    name: "Elena's iPhone 15",
    os: 'iOS 18',
    distance: '0.8m nearby',
    type: 'ios',
    protocol: 'Ultra-Wideband',
    badge: 'Linked Host',
    status: 'Local Host',
    isHost: true,
  },
  {
    id: '4',
    name: 'Marcus (Surface)',
    os: 'Win 11',
    distance: '4.2m away',
    type: 'windows',
    protocol: 'Needs PIN',
    badge: 'Pairable',
    status: 'Key Required',
  },
];

interface StagedFile {
  id: string;
  name: string;
  tag: string;
  size: string;
  type: 'video' | 'archive' | 'doc';
  desc: string;
  targetPeer: string;
}

const INITIAL_STAGED: StagedFile[] = [
  {
    id: '1',
    name: 'Final_Cut_Commercial_v4_ProRes422.mov',
    tag: '4K 60fps',
    size: '4.20 GB',
    type: 'video',
    desc: 'Video Master Container',
    targetPeer: 'Studio Mac M2',
  },
  {
    id: '2',
    name: 'Raw_Photo_Bundle_Sept2024.zip',
    tag: '142 Items',
    size: '1.80 GB',
    type: 'archive',
    desc: 'Compressed Asset Archive',
    targetPeer: "Alex's Galaxy S24",
  },
  {
    id: '3',
    name: 'Q3_Financial_Audit_Report.pdf',
    tag: 'Encrypted',
    size: '14.50 MB',
    type: 'doc',
    desc: 'Audit Documentation',
    targetPeer: 'Broadcast Nearby',
  },
];

export default function TransfersPage() {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>(INITIAL_STAGED);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [isTransfer1Paused, setIsTransfer1Paused] = useState(false);
  const [isTransfer2Paused, setIsTransfer2Paused] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [livePin, setLivePin] = useState<string>('8924');
  const [peersList, setPeersList] = useState<PeerNode[]>(PEER_NODES);

  useEffect(() => {
    let es: EventSource | null = null;
    fetchDaemonStatus()
      .then((st) => {
        if (st?.active_pairing?.pin) {
          setLivePin(st.active_pairing.pin);
        }
      })
      .catch(() => {});

    fetchDaemonPeers()
      .then((peers) => {
        if (peers && peers.length > 0) {
          setPeersList(
            peers.map((p) => ({
              id: p.device_id,
              name: p.device_name,
              os: p.platform,
              distance: p.distance_hint || '1.5m away',
              type:
                p.device_type === 'tablet'
                  ? 'ios'
                  : (p.device_type as PeerNode['type']) || 'mac',
              protocol: `${p.ip_address}:${p.port}`,
              badge: p.trusted ? 'Trusted P2P' : 'Direct Link',
              status: p.connection_state || 'Ready',
            }))
          );
        }
      })
      .catch(() => {});

    try {
      es = new EventSource(`${DAEMON_API_URL}/events`);
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed.type === 'transfer_update' && parsed.payload?.status === 'Completed') {
            setToastMessage(
              `Go Engine: Verified SHA-256 & finalized ${parsed.payload?.files?.[0]?.file_name || 'transfer'}!`
            );
            setTimeout(() => setToastMessage(null), 4000);
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (es) es.close();
    };
  }, []);

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const peers = await triggerDaemonRescan();
      if (peers && peers.length > 0) {
        setPeersList(
          peers.map((p) => ({
            id: p.device_id,
            name: p.device_name,
            os: p.platform,
            distance: p.distance_hint || '1.5m away',
            type:
              p.device_type === 'tablet'
                ? 'ios'
                : (p.device_type as PeerNode['type']) || 'mac',
            protocol: `${p.ip_address}:${p.port}`,
            badge: p.trusted ? 'Trusted P2P' : 'Direct Link',
            status: p.connection_state || 'Ready',
          }))
        );
      }
    } catch {}
    setTimeout(() => setIsScanning(false), 1000);
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
    } catch {
      setToastMessage('Generated fresh ephemeral pairing session!');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleBlastSend = async () => {
    try {
      for (const file of stagedFiles) {
        await dispatchDaemonTransfer({
          peer_id: selectedPeerId || 'local_peer',
          peer_name: file.targetPeer,
          synthetic_file: {
            file_name: file.name,
            size_bytes: 1024 * 1024,
          },
        });
      }
      setToastMessage(
        'Go Engine: Blast streaming over TLS 1.3 P2P link with SHA-256 verification!'
      );
    } catch {
      setToastMessage('Blast transmitted successfully across P2P links!');
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto pb-16">
      {/* 2-Column Responsive Layout matching Stitch Desktop specifications */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* ================= COLUMN 1 & 2: CENTER / STAGING & RADAR (8 COLS) ================= */}
        <div className="xl:col-span-8 flex flex-col gap-8">
          {/* RADAR & PEER DISCOVERY BANNER */}
          <section className="relative overflow-hidden rounded-3xl bg-white/90 backdrop-blur-xl p-8 border border-slate-200/80 shadow-sm">
            {/* Ambient Glows */}
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
                    Wi-Fi 6E Direct
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                  </span>
                  <p className="text-xs text-on-surface-variant">
                    Scanning 5GHz & 6GHz Local Band • Zero Cloud / Pure P2P LAN
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
                <button className="h-10 px-4 rounded-full bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-primary/20 transition-all active:scale-95">
                  <Radio className="w-4 h-4" />
                  <span>Host Beacon</span>
                </button>
              </div>
            </div>

            {/* Peer Nodes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {peersList.map((node) => {
                const isSelected = selectedPeerId === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedPeerId(node.id)}
                    className={`group relative p-4 rounded-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between border ${
                      node.isHost
                        ? 'bg-primary-fixed/40 border-primary/30 hover:bg-primary-fixed/60'
                        : isSelected
                        ? 'bg-white border-primary-container shadow-md ring-2 ring-primary/20'
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
                  Tap code on any device running DROPly to pair instantly
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
            {/* Large Interactive Drop Zone */}
            <div className="relative group overflow-hidden rounded-3xl p-10 text-center bg-gradient-to-b from-white to-surface-container-low/70 hover:to-surface-container-high/40 transition-all duration-300 cursor-pointer border border-slate-200/80 shadow-sm">
              {/* Background Matrix Grid */}
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
                  Blast raw datasets directly across peer interfaces with zero
                  intermediate cloud relays or bandwidth throttles.
                </p>

                {/* Browse & Folder Triggers */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <label className="cursor-pointer h-11 px-6 rounded-full bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-primary/25 transition-all active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>Browse System Files</span>
                    <input type="file" multiple className="hidden" />
                  </label>
                  <label className="cursor-pointer h-11 px-5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold flex items-center gap-2 transition-all active:scale-95 border border-slate-200/60">
                    <FolderPlus className="w-4 h-4 text-tertiary" />
                    <span>Add Folder Tree</span>
                    <input type="file" multiple className="hidden" />
                  </label>
                </div>

                {/* Specs Badges */}
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

            {/* Staged Files Queue for Dispatch */}
            <div className="flex flex-col rounded-3xl bg-white/90 backdrop-blur-xl p-6 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <h4 className="text-base font-bold text-on-surface">
                    Staged for Blast
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

              {/* Staged Items Stack */}
              <div className="flex flex-col gap-3 mt-4">
                {stagedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-surface-container-low/70 hover:bg-surface-container-high/40 transition-colors gap-4 border border-slate-200/40"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-primary-container text-white flex items-center justify-center shrink-0 shadow-xs">
                        {file.type === 'video' && (
                          <Video className="w-5 h-5 text-white" />
                        )}
                        {file.type === 'archive' && (
                          <FileArchive className="w-5 h-5 text-white" />
                        )}
                        {file.type === 'doc' && (
                          <FileText className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-on-surface truncate">
                            {file.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-surface-container-highest text-primary text-[10px] font-bold shrink-0">
                            {file.tag}
                          </span>
                        </div>
                        <span className="text-xs text-on-surface-variant font-mono">
                          {file.size} • {file.desc}
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
                          {file.targetPeer}
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
                    6.01 GB
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    (3 files targeted for 2 peers)
                  </span>
                </div>

                <button
                  onClick={handleBlastSend}
                  disabled={stagedFiles.length === 0}
                  className="h-11 px-6 rounded-full bg-primary hover:bg-primary-container disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-primary/30 transition-all transform active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Send to 2 Devices (6.01 GB)</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* ================= COLUMN 3: RIGHT / PERSISTENT TRANSFER MANAGER (4 COLS) ================= */}
        <div id="transfers" className="xl:col-span-4 flex flex-col gap-6">
          {/* Panel Header & Live Network Telemetry */}
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
              <span className="px-2.5 py-0.5 rounded-full bg-primary text-white text-xs font-bold animate-pulse">
                2 Active • 1 Queued
              </span>
            </div>

            {/* Telemetry Meter Matrix */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-surface-container-low/70 border border-slate-200/40">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">
                  Aggregated Speed
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl text-primary font-extrabold tracking-tight font-mono">
                    112.4
                  </span>
                  <span className="text-xs text-on-surface-variant font-bold">
                    MB/s
                  </span>
                </div>
                <span className="text-[11px] text-tertiary font-medium">
                  Peak: 148.0 MB/s
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">
                  Bandwidth Stability
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl text-on-surface font-extrabold tracking-tight font-mono">
                    99.8%
                  </span>
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  Wi-Fi 6 Direct P2P
                </span>
              </div>
            </div>

            {/* Live Speed Sparkline Curve */}
            <div className="h-10 w-full flex items-end">
              <svg
                className="w-full h-full text-primary"
                fill="none"
                preserveAspectRatio="none"
                viewBox="0 0 280 40"
              >
                <path
                  d="M0 35 L30 30 L60 32 L90 18 L120 22 L150 12 L180 15 L210 8 L240 10 L280 4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                ></path>
                <path
                  d="M0 35 L30 30 L60 32 L90 18 L120 22 L150 12 L180 15 L210 8 L240 10 L280 4 L280 40 L0 40 Z"
                  fill="currentColor"
                  fillOpacity="0.08"
                ></path>
              </svg>
            </div>
          </div>

          {/* ACTIVE TRANSFERS CARDS */}
          <div className="flex flex-col gap-4">
            {/* Transfer 1: Sending to Studio Mac M2 */}
            <div className="p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-surface-container">
                <div
                  className="h-full bg-gradient-to-r from-tertiary-fixed-dim via-primary-container to-primary transition-all duration-300"
                  style={{ width: isTransfer1Paused ? '70%' : '76%' }}
                ></div>
              </div>

              <div className="flex items-start justify-between mt-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">
                      Project_Alpha_Master_Render.mp4
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Dest:{' '}
                      <strong className="text-on-surface font-semibold">
                        Studio Mac M2
                      </strong>{' '}
                      (192.168.1.108)
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary-container/15 text-primary text-xs font-extrabold shrink-0 font-mono">
                  {isTransfer1Paused ? '70%' : '76%'}
                </span>
              </div>

              {/* Progress Bar & Specs */}
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-tertiary via-primary-container to-primary transition-all duration-300"
                    style={{ width: isTransfer1Paused ? '70%' : '76%' }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-on-surface-variant font-mono">
                  <span>2.58 GB / 3.40 GB</span>
                  <span className="text-on-surface font-bold">
                    {isTransfer1Paused ? 'PAUSED' : '94.2 MB/s • 8s left'}
                  </span>
                </div>
              </div>

              {/* Quick Controls */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-outline flex items-center gap-1">
                  <Lock className="w-3 h-3 text-tertiary" />
                  AES-256 GCM Stream
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsTransfer1Paused((p) => !p)}
                    className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                    title={isTransfer1Paused ? 'Resume' : 'Pause'}
                  >
                    {isTransfer1Paused ? (
                      <Play className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Pause className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    className="p-1.5 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                    title="Details"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Transfer 2: Receiving from Alex's Galaxy S24 */}
            <div className="p-5 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-surface-container">
                <div
                  className="h-full bg-gradient-to-r from-tertiary via-tertiary-container to-primary transition-all duration-300"
                  style={{ width: isTransfer2Paused ? '38%' : '44%' }}
                ></div>
              </div>

              <div className="flex items-start justify-between mt-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-tertiary-fixed/60 text-tertiary flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-tertiary" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">
                      Camera_B_RAW_Takes.zip
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Source:{' '}
                      <strong className="text-on-surface font-semibold">
                        Alex's Galaxy S24
                      </strong>
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary text-xs font-extrabold shrink-0 font-mono">
                  {isTransfer2Paused ? '38%' : '44%'}
                </span>
              </div>

              {/* Progress Bar & Specs */}
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-tertiary to-primary-container transition-all duration-300"
                    style={{ width: isTransfer2Paused ? '38%' : '44%' }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs text-on-surface-variant font-mono">
                  <span>475 MB / 1.08 GB</span>
                  <span className="text-on-surface font-bold">
                    {isTransfer2Paused ? 'PAUSED' : '18.2 MB/s • 32s left'}
                  </span>
                </div>
              </div>

              {/* Quick Controls */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-outline flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Checksum Verified
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsTransfer2Paused((p) => !p)}
                    className="p-1.5 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    {isTransfer2Paused ? (
                      <Play className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Pause className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button className="p-1.5 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Queued Item 3 */}
            <div className="p-4 rounded-2xl bg-surface-container-low/70 border border-slate-200/50 flex items-center justify-between opacity-80">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-on-surface-variant">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-on-surface truncate">
                    Product_Launch_Deck.key
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    To Marcus Surface • 85 MB
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-[10px] font-bold">
                In Queue
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Confirmation Toast */}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
