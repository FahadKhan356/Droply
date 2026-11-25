# DROPly - High Speed P2P File Sharing

Cross-platform local network file transfer suite built with **React Native** (Mobile) and **Next.js** (Web Desktop), matching the Google Stitch design specifications 1:1.

## Structure

```
DROPly/
├── mobile/         # React Native / Expo application (iOS & Android)
│   ├── App.tsx     # Screen navigator & state manager
│   └── src/
│       ├── screens/
│       │   ├── HomeScreen.tsx        # Screen 1: Home & Discovery Radar
│       │   ├── SendFilesScreen.tsx   # Screen 2: Send & Select Files
│       │   ├── TransferScreen.tsx    # Screen 3: Transfer in Progress
│       │   └── ReceiveScreen.tsx     # Screen 4: Receive & QR Pairing
│       ├── components/               # Custom UI components
│       └── theme/                    # Stitch Material 3 design tokens
│
└── web/            # Next.js 15 Web application (Desktop)
    ├── app/
    │   ├── layout.tsx                # App shell & fonts
    │   ├── page.tsx                  # Screen 1: Discovery & Transfer Manager
    │   └── settings/page.tsx         # Screen 2: Settings & Bandwidth Throttling
    ├── components/                   # Desktop UI components (Radar, Queue, Sidebar)
    └── tailwind.config.ts            # Stitch design system palette & typography
```

## Screen Specifications

### Mobile Screens (React Native)
1. **Screen 1: Home & Discovery Radar**
   - Live WiFi & P2P network status banner
   - Concentric glowing radar canvas with active peer detection (Alex's S24, iPad Pro, Studio Mac, Workstation)
   - Quick action bar (Send Files, Receive, Scan QR)
   - Nearby peers carousel with 1-tap connect
   - Local storage telemetry bar

2. **Screen 2: Send & Select Files**
   - Search & filter bar with category pills (Photos, Videos, Documents, Audio, Folders)
   - Multi-select interactive file list with badge indicators
   - Batch selection counter, total size computation
   - Floating Send action bar with target peer chip

3. **Screen 3: Transfer in Progress**
   - Active high-speed transfer cockpit
   - Large radial progress gauge (84.5% complete)
   - Real-time speed monitor (98.4 MB/s) and estimated ETA
   - Transfer queue breakdown with per-file status
   - Pause / Resume / Cancel controls

4. **Screen 4: Receive & QR Pairing**
   - Tab switch: Receive Mode vs QR Scanner
   - High-fidelity QR code pairing card with session PIN
   - Device discoverability toggle and trusted devices filter
   - Incoming transfer request dialog with Accept/Decline actions

### Web Screens (Next.js Desktop)
1. **Screen 1: Discovery & Transfer Manager**
   - Dual-view layout: Active Peer Radar + Staged Blast Dropzone
   - Comprehensive transfer manager queue with live throughput meters
   - Global sidebar navigation with quick pair & dialpad shortcuts
   - Peer status overview with multi-channel indicators (Wi-Fi 6E, Direct P2P)

2. **Screen 2: Settings & Bandwidth Throttling**
   - Rate control presets (Uncapped Turbo, Balanced QoS, Custom Throttling)
   - Upstream/Downstream bandwidth limiters
   - Network interface binding (5GHz / 6GHz, Direct Wi-Fi, Ethernet)
   - Storage destination directory picker & auto-accept policies
