'use client';

import React, { useState } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  Gauge,
  Zap,
  Scale,
  Sliders,
  ArrowUp,
  ArrowDown,
  Moon,
  Network,
  ChevronDown,
  Check,
  Laptop,
  Edit2,
  Folder,
  HardDrive,
  Shield,
  FileCheck,
  Terminal,
  Activity,
  Globe,
  Users,
  EyeOff,
  Radio,
} from 'lucide-react';

export default function SettingsPage() {
  const [activePreset, setActivePreset] = useState<'turbo' | 'balanced' | 'custom'>('custom');
  const [uploadRate, setUploadRate] = useState<number>(50);
  const [downloadRate, setDownloadRate] = useState<number>(120);
  const [streams, setStreams] = useState<number>(4);
  const [offPeakTurbo, setOffPeakTurbo] = useState<boolean>(true);
  const [selectedInterface, setSelectedInterface] = useState<string>('en0');
  const [listenPort, setListenPort] = useState<string>('53317');
  const [isPortTesting, setIsPortTesting] = useState<boolean>(false);
  const [portTestResult, setPortTestResult] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string>('Studio Mac M2 Max');
  const [visibility, setVisibility] = useState<'everyone' | 'contacts' | 'hidden'>('everyone');
  const [pinRotation, setPinRotation] = useState<boolean>(true);
  const [autoAcceptPaired, setAutoAcceptPaired] = useState<boolean>(true);
  const [flagLargeArchives, setFlagLargeArchives] = useState<boolean>(true);
  const [gatekeeperCheck, setGatekeeperCheck] = useState<boolean>(true);
  const [saveToast, setSaveToast] = useState<boolean>(false);

  const handlePresetSelect = (preset: 'turbo' | 'balanced' | 'custom') => {
    setActivePreset(preset);
    if (preset === 'turbo') {
      setUploadRate(150);
      setDownloadRate(200);
      setStreams(8);
    } else if (preset === 'balanced') {
      setUploadRate(35);
      setDownloadRate(80);
      setStreams(4);
    }
  };

  const handleTestPort = () => {
    setIsPortTesting(true);
    setPortTestResult(null);
    setTimeout(() => {
      setIsPortTesting(false);
      setPortTestResult('UPnP Port Mapping Verified: 53317/TCP open');
    }, 1200);
  };

  const handleResetDefaults = () => {
    setActivePreset('custom');
    setUploadRate(50);
    setDownloadRate(120);
    setStreams(4);
    setOffPeakTurbo(true);
    setDeviceLabel('Studio Mac M2 Max');
    setVisibility('everyone');
    setPinRotation(true);
  };

  const handleSaveChanges = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3500);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1600px] mx-auto pb-16">
      {/* Top Utility Context & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-outline uppercase tracking-wider">
              Configuration Node
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-primary font-semibold">
              Network & Bandwidth Management
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
              System & Network Engine
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Direct P2P Fabric • TLS 1.3 Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-center">
          <button
            onClick={handleResetDefaults}
            className="h-10 px-5 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors text-xs font-bold flex items-center gap-2 border border-slate-200/60"
          >
            <RotateCcw className="w-4 h-4 text-on-surface-variant" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSaveChanges}
            className="h-10 px-6 rounded-full bg-primary hover:bg-primary-container text-white transition-all shadow-md shadow-primary/30 text-xs font-bold flex items-center gap-2 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Primary Bento Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* ================= LEFT COLUMN: Bandwidth & Throughput (8 Cols) ================= */}
        <div className="xl:col-span-8 flex flex-col gap-8">
          {/* SECTION: Bandwidth Shaping & Rate Control */}
          <section className="p-8 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed/70 flex items-center justify-center text-primary">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-surface leading-tight">
                    Bandwidth Shaping & Rate Control
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Arbitrate peer-to-peer transmission quotas across multi-interface lanes
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-surface-container-low text-tertiary tracking-wide border border-slate-200/50">
                QoS ENGINE 2.4
              </span>
            </div>

            {/* Mode Presets Matrix (3 Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Mode 1: Turbo */}
              <div
                onClick={() => handlePresetSelect('turbo')}
                className={`p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between gap-3 border ${
                  activePreset === 'turbo'
                    ? 'bg-primary-container text-white shadow-lg shadow-primary/30 border-primary-container'
                    : 'bg-surface-container-low/70 hover:bg-surface-container-low border-slate-200/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Zap
                    className={`w-6 h-6 ${
                      activePreset === 'turbo' ? 'text-white' : 'text-primary'
                    }`}
                  />
                  {activePreset === 'turbo' && (
                    <span className="w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold">Uncapped Turbo</p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      activePreset === 'turbo'
                        ? 'text-white/80'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    Peak 1.2+ Gbps Wi-Fi 6 Direct. Zero throttling overhead.
                  </p>
                </div>
                <div
                  className={`text-xs font-mono font-semibold pt-1 ${
                    activePreset === 'turbo' ? 'text-white' : 'text-primary'
                  }`}
                >
                  Line Speed (Max)
                </div>
              </div>

              {/* Mode 2: Balanced Dynamic QoS */}
              <div
                onClick={() => handlePresetSelect('balanced')}
                className={`p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between gap-3 border ${
                  activePreset === 'balanced'
                    ? 'bg-primary-container text-white shadow-lg shadow-primary/30 border-primary-container'
                    : 'bg-surface-container-low/70 hover:bg-surface-container-low border-slate-200/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Scale
                    className={`w-6 h-6 ${
                      activePreset === 'balanced' ? 'text-white' : 'text-tertiary'
                    }`}
                  />
                  {activePreset === 'balanced' && (
                    <span className="w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold">Balanced Dynamic QoS</p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      activePreset === 'balanced'
                        ? 'text-white/80'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    Automatically yields pipe for active video calls and gaming.
                  </p>
                </div>
                <div
                  className={`text-xs font-mono font-semibold pt-1 ${
                    activePreset === 'balanced' ? 'text-white' : 'text-tertiary'
                  }`}
                >
                  Adaptive Buffer
                </div>
              </div>

              {/* Mode 3: Custom Rate Throttling */}
              <div
                onClick={() => handlePresetSelect('custom')}
                className={`p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between gap-3 border ${
                  activePreset === 'custom'
                    ? 'bg-primary-container text-white shadow-lg shadow-primary/30 border-primary-container'
                    : 'bg-surface-container-low/70 hover:bg-surface-container-low border-slate-200/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Sliders
                    className={`w-6 h-6 ${
                      activePreset === 'custom' ? 'text-white' : 'text-on-surface'
                    }`}
                  />
                  {activePreset === 'custom' && (
                    <span className="w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold">Custom Rate Throttling</p>
                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      activePreset === 'custom'
                        ? 'text-white/80'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    Strict per-direction kilobyte caps & concurrent thread boundaries.
                  </p>
                </div>
                <div
                  className={`text-xs font-mono font-semibold pt-1 ${
                    activePreset === 'custom' ? 'text-white' : 'text-primary'
                  }`}
                >
                  User Defined (Active)
                </div>
              </div>
            </div>

            {/* Interactive Sliders Surface */}
            <div className="p-6 rounded-2xl bg-surface-container-low/50 border border-slate-200/50 flex flex-col gap-6">
              {/* Upload Rate Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-on-surface">
                      Maximum Upload Rate
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[10px] font-bold">
                      LAN Peer Fabric
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-xl font-extrabold text-on-surface">
                      {uploadRate}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      MB/s ({uploadRate * 8} Mbps)
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min="5"
                  max="150"
                  value={uploadRate}
                  onChange={(e) => {
                    setUploadRate(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary"
                />

                <div className="flex justify-between text-[11px] text-outline font-medium">
                  <span>Low (5 MB/s)</span>
                  <span>Balanced (50 MB/s)</span>
                  <span>Gigabit Direct (150 MB/s)</span>
                </div>
              </div>

              <div className="h-px bg-slate-200/60"></div>

              {/* Download Rate Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="w-4 h-4 text-tertiary" />
                    <span className="text-sm font-bold text-on-surface">
                      Maximum Download Rate
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold">
                      Full Hardware Limit
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-xl font-extrabold text-on-surface">
                      {downloadRate}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      MB/s ({downloadRate * 8} Mbps)
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min="10"
                  max="200"
                  value={downloadRate}
                  onChange={(e) => {
                    setDownloadRate(Number(e.target.value));
                    setActivePreset('custom');
                  }}
                  className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-tertiary-container"
                />

                <div className="flex justify-between text-[11px] text-outline font-medium">
                  <span>Restricted (10 MB/s)</span>
                  <span>Fast (100 MB/s)</span>
                  <span>Saturate Link (200 MB/s)</span>
                </div>
              </div>

              <div className="h-px bg-slate-200/60"></div>

              {/* Parallel Transport Streams & Saturation Gauge */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-on-surface">
                    Parallel Transport Streams
                  </span>
                  <p className="text-xs text-on-surface-variant">
                    Simultaneous multiplexed chunks per incoming/outgoing session
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setStreams((s) => Math.max(1, s - 1))}
                      className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high font-bold flex items-center justify-center text-on-surface border border-slate-200/60"
                    >
                      -
                    </button>
                    <div className="h-9 px-5 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center text-base font-bold font-mono text-primary">
                      {streams}
                    </div>
                    <button
                      onClick={() => setStreams((s) => Math.min(16, s + 1))}
                      className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high font-bold flex items-center justify-center text-on-surface border border-slate-200/60"
                    >
                      +
                    </button>
                    <span className="text-xs text-on-surface-variant ml-2 font-medium">
                      Recommended: 4 Streams
                    </span>
                  </div>
                </div>

                {/* Saturation Gauge Card */}
                <div className="p-4 rounded-xl bg-white border border-slate-200/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-outline uppercase tracking-wider">
                      Interface Load Pipe
                    </span>
                    <span className="text-xs font-bold font-mono text-tertiary">
                      58% Allocated
                    </span>
                  </div>

                  <div className="py-2">
                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex relative">
                      <div
                        className="bg-primary-container h-full"
                        style={{ width: '45%' }}
                      ></div>
                      <div
                        className="bg-tertiary-fixed-dim h-full"
                        style={{ width: '20%' }}
                      ></div>
                      <div className="absolute right-[20%] top-0 bottom-0 w-0.5 bg-error border-dashed"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary-container"></span>
                      Rx: {downloadRate}M
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span>
                      Tx: {uploadRate}M
                    </span>
                    <span className="text-error font-bold">Ceiling: 1.2G</span>
                  </div>
                </div>
              </div>

              {/* Turbo Toggle Banner */}
              <div className="p-4 rounded-xl bg-white border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
                    <Moon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">
                      Enable Off-Peak Full Turbo
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      Auto-disable bandwidth ceilings between 12:00 AM and 06:00 AM local time
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={offPeakTurbo}
                  onChange={(e) => setOffPeakTurbo(e.target.checked)}
                  className="w-5 h-5 accent-primary rounded cursor-pointer"
                />
              </div>
            </div>
          </section>

          {/* SECTION: Network Interface & P2P Discovery Protocols */}
          <section className="p-8 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/70 flex items-center justify-center text-tertiary">
                  <Network className="w-5 h-5 text-tertiary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-surface leading-tight">
                    Network Interface & Discovery Protocols
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Manage zero-configuration socket bindings and physical transceiver state
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-surface-container-low text-primary tracking-wide border border-slate-200/50">
                PHY LAYER
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              {/* Primary Interface Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface">
                  Primary Interface Binding
                </label>
                <div className="relative">
                  <select
                    value={selectedInterface}
                    onChange={(e) => setSelectedInterface(e.target.value)}
                    className="w-full h-11 px-4 pr-10 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-primary border border-slate-200/60 cursor-pointer"
                  >
                    <option value="en0">
                      en0 — Wi-Fi 6E Direct 160MHz (192.168.1.142)
                    </option>
                    <option value="en1">
                      en1 — Thunderbolt Bridge 10GbE (169.254.12.80)
                    </option>
                    <option value="awdl0">
                      awdl0 — Apple Wireless Direct Link (Mesh Peer)
                    </option>
                    <option value="all">
                      all — Auto-Bond All Available Interfaces
                    </option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-outline absolute right-4 top-3.5 pointer-events-none" />
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Prioritizes highest MTU interface for low frame loss.
                </p>
              </div>

              {/* Listen Port Config */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-on-surface">
                    Transfer Listen Port
                  </label>
                  <span className="text-[10px] text-tertiary flex items-center gap-1 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                    Port Reachable (UPnP Active)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={listenPort}
                    onChange={(e) => setListenPort(e.target.value)}
                    className="flex-1 h-11 px-4 rounded-xl bg-surface-container-low text-on-surface text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary border border-slate-200/60"
                  />
                  <button
                    onClick={handleTestPort}
                    disabled={isPortTesting}
                    className="h-11 px-5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold border border-slate-200/60 transition-colors whitespace-nowrap"
                  >
                    {isPortTesting ? 'Testing...' : 'Test Port'}
                  </button>
                </div>
                {portTestResult && (
                  <p className="text-[11px] text-emerald-600 font-medium">
                    {portTestResult}
                  </p>
                )}
              </div>
            </div>

            {/* Protocol Discovery Matrix */}
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-xs font-bold text-outline uppercase tracking-wider">
                Multi-Protocol Beacon Matrix
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between border border-slate-200/40">
                  <div className="flex items-center gap-3">
                    <Radio className="w-5 h-5 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">
                        mDNS / Bonjour Multicast
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono">
                        224.0.0.251 / Local LAN
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed">
                    Active
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between border border-slate-200/40">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">
                        BLE Proximity Beacon
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono">
                        Direct Hardware Radar
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed">
                    Active
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between border border-slate-200/40">
                  <div className="flex items-center gap-3">
                    <Network className="w-5 h-5 text-tertiary" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">
                        Wi-Fi Aware / NAN P2P
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono">
                        AP-Independent Direct Mesh
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                    Active
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between border border-slate-200/40 opacity-75">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-outline" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-on-surface">
                        Direct Subnet Broadcast
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-mono">
                        Legacy UDP 255.255.255.255
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                    Disabled
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ================= RIGHT COLUMN: Security, Storage & Identity (4 Cols) ================= */}
        <div className="xl:col-span-4 flex flex-col gap-8">
          {/* SECTION: Device Identity & LAN Privacy */}
          <section className="p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container">
                <Laptop className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface leading-tight">
                  Identity & Beacon
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Broadcast metadata for nearby peers
                </p>
              </div>
            </div>

            {/* Device Name Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface">
                Device Broadcast Label
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  className="w-full h-11 px-4 pr-10 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary border border-slate-200/60"
                />
                <button className="absolute right-3 text-outline hover:text-on-surface p-1">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visibility Radio Options */}
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-xs font-bold text-on-surface">
                Radar Presence Visibility
              </span>

              <label className="p-3 rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low flex items-center justify-between cursor-pointer border border-slate-200/50">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'everyone'}
                    onChange={() => setVisibility('everyone')}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-on-surface">
                      Visible to Everyone on LAN
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      Broadcasts beacon to all peers on subnet
                    </p>
                  </div>
                </div>
                <Globe className="w-4 h-4 text-tertiary" />
              </label>

              <label className="p-3 rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low flex items-center justify-between cursor-pointer border border-slate-200/50">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'contacts'}
                    onChange={() => setVisibility('contacts')}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-on-surface">
                      Contacts / Paired Peers Only
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      Responds only to established cryptokeys
                    </p>
                  </div>
                </div>
                <Users className="w-4 h-4 text-primary" />
              </label>

              <label className="p-3 rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low flex items-center justify-between cursor-pointer border border-slate-200/50">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'hidden'}
                    onChange={() => setVisibility('hidden')}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-on-surface">
                      Hidden / Incognito Mode
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      Invisible to radar; initiate outgoing only
                    </p>
                  </div>
                </div>
                <EyeOff className="w-4 h-4 text-outline" />
              </label>
            </div>

            {/* Ephemeral PIN Rotation */}
            <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between border border-slate-200/50">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">
                  Ephemeral PIN Rotation
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Regenerate 6-digit PIN every 15 minutes
                </span>
              </div>
              <input
                type="checkbox"
                checked={pinRotation}
                onChange={(e) => setPinRotation(e.target.checked)}
                className="w-5 h-5 accent-primary rounded cursor-pointer"
              />
            </div>
          </section>

          {/* SECTION: Storage & Download Destination */}
          <section className="p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed/60 flex items-center justify-center text-primary">
                <Folder className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-on-surface leading-tight">
                  Storage & Payloads
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Destination folders and quarantine shields
                </p>
              </div>
            </div>

            {/* Folder Picker Box */}
            <div className="p-3.5 rounded-2xl bg-surface-container-low flex flex-col gap-2.5 border border-slate-200/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">
                  Default Target Path
                </span>
                <button className="text-[11px] text-primary font-bold hover:underline">
                  Change Folder
                </button>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200/60 shadow-xs">
                <Folder className="w-4 h-4 text-tertiary" />
                <span className="text-xs font-mono font-semibold truncate text-on-surface">
                  /Users/elena/Downloads/DROPly
                </span>
              </div>

              {/* Disk Capacity Meter */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-on-surface-variant">Macintosh HD Capacity</span>
                  <span className="font-bold text-on-surface font-mono">
                    412 GB free of 1.0 TB
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-primary-container rounded-full"
                    style={{ width: '58.8%' }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Safe Ingestion Checkboxes */}
            <div className="flex flex-col gap-3 pt-1">
              <span className="text-xs font-bold text-outline uppercase tracking-wider">
                Automated Ingestion Policies
              </span>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAcceptPaired}
                  onChange={(e) => setAutoAcceptPaired(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <div>
                  <p className="text-xs font-bold text-on-surface">
                    Auto-accept from Paired Devices
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    Bypasses interactive prompt for verified cryptographic fingerprints
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flagLargeArchives}
                  onChange={(e) => setFlagLargeArchives(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <div>
                  <p className="text-xs font-bold text-on-surface">
                    Flag Large Archives (&gt; 500 MB)
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    Prompts for disk-space sanity check before buffering
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gatekeeperCheck}
                  onChange={(e) => setGatekeeperCheck(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-primary rounded cursor-pointer"
                />
                <div>
                  <p className="text-xs font-bold text-on-surface">
                    macOS Gatekeeper Verification
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    Applies quarantine bit (`com.apple.quarantine`) to executable files
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* Telemetry Daemon Status */}
          <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">
                  P2P Kernel Daemon: v2.4.9
                </span>
                <span className="text-[11px] font-mono text-on-surface-variant">
                  Socket Latency: 1.2ms (Zero Packet Drop)
                </span>
              </div>
            </div>
            <button className="px-3 py-1 rounded-full bg-white hover:bg-surface-container text-on-surface text-xs font-bold transition-colors border border-slate-200/60 shadow-xs">
              View Logs
            </button>
          </div>
        </div>
      </div>

      {/* Save Success Toast */}
      {saveToast && (
        <div className="fixed bottom-8 right-8 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">
            Network & Bandwidth configurations updated successfully!
          </span>
        </div>
      )}
    </div>
  );
}
