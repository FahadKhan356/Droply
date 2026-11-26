'use client';

import React, { useState } from 'react';
import {
  Wifi,
  QrCode,
  KeyRound,
  Activity,
  Bell,
  Search,
  CheckCircle2,
  Share2,
} from 'lucide-react';

interface HeaderProps {
  onOpenQR?: () => void;
  onOpenPIN?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQR, onOpenPIN }) => {
  return (
    <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30 px-8 flex items-center justify-between">
      {/* Network pill & Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-surface-container-low border border-slate-200/60">
          <div className="relative flex items-center justify-center">
            <Wifi className="w-4 h-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface">
              Studio_Ultra_5G
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="text-xs font-mono text-on-surface-variant">
              192.168.1.142
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            Wi-Fi 6E
          </span>
        </div>
      </div>

      {/* Quick Action Buttons & Profile */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenQR}
          className="h-10 px-4 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
        >
          <QrCode className="w-4 h-4 text-primary" />
          <span>Pair QR</span>
        </button>

        <button
          onClick={onOpenPIN}
          className="h-10 px-4 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
        >
          <KeyRound className="w-4 h-4 text-primary" />
          <span>Direct PIN</span>
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        {/* Active Transfer Pill Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-fixed/60 text-primary text-xs font-bold">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>3 Active</span>
        </div>

        {/* Notification Bell */}
        <button className="w-10 h-10 rounded-full hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary"></span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-white font-bold text-sm shadow-md shadow-primary/20 ring-2 ring-primary/20">
            ME
          </div>
        </div>
      </div>
    </header>
  );
};
