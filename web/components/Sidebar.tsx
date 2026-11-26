'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Radio,
  Upload,
  QrCode,
  History,
  ShieldCheck,
  Settings,
  HardDrive,
  Wifi,
  Sparkles,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home / Radar', href: '/', icon: Radio },
    { name: 'Send Files', href: '/#dropzone', icon: Upload },
    { name: 'Receive & QR', href: '/#pair-qr', icon: QrCode },
    { name: 'Transfer History', href: '/#transfers', icon: History },
  ];

  const topologyItems = [
    { name: 'Trusted Devices', href: '/#trusted', icon: ShieldCheck },
    { name: 'Network & Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-white/95 backdrop-blur-xl z-40 flex flex-col justify-between border-r border-slate-200/80 shadow-[0_1px_16px_rgba(11,28,48,0.03)]">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-slate-100">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-md shadow-primary/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg tracking-tight text-on-surface font-bold">
                DROPly
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                Local P2P Fabric
              </span>
            </div>
          </Link>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
            v2.4
          </span>
        </div>

        {/* Transfers & Radar Section */}
        <div className="px-4 py-4">
          <p className="px-3 pb-2 text-[11px] font-bold text-outline uppercase tracking-wider">
            Transfers & Radar
          </p>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-primary-container text-white font-semibold shadow-sm shadow-primary/20'
                      : 'text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Network Topology Section */}
        <div className="px-4 py-2">
          <p className="px-3 pb-2 text-[11px] font-bold text-outline uppercase tracking-wider">
            Network Topology
          </p>
          <nav className="flex flex-col gap-1">
            {topologyItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-primary-container text-white font-semibold shadow-sm shadow-primary/20'
                      : 'text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Storage & Network Footer Card */}
      <div className="p-4 m-4 rounded-2xl bg-surface-container-low border border-slate-200/60 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-on-surface">
              Local Storage
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-tertiary">
            142.8 GB Free
          </span>
        </div>

        {/* Dual bar progress meter */}
        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
          <div className="h-full bg-primary" style={{ width: '65%' }}></div>
          <div
            className="h-full bg-tertiary-container"
            style={{ width: '15%' }}
          ></div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            192.168.1.142
          </span>
          <span className="font-medium text-primary">Ultra P2P</span>
        </div>
      </div>
    </aside>
  );
};
