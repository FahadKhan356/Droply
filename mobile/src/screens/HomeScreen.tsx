import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  Wifi,
  Radio,
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  Upload,
  Download,
  QrCode,
  RefreshCw,
  HardDrive,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Droplet,
  Zap,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useDroplyStore } from '../store/useDroplyStore';
import { formatBytes } from '../utils/formatters';

const { width } = Dimensions.get('window');

export interface Peer {
  id: string;
  name: string;
  deviceType: 'android' | 'tablet' | 'mac' | 'windows';
  distance: string;
  protocol: string;
  status: 'Ready' | 'Wi-Fi 6E' | 'Direct P2P' | 'Standby';
  ip: string;
  port: number;
  position: { top?: number; bottom?: number; left?: number; right?: number };
}

const RADAR_POSITIONS: Array<{
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}> = [
  { top: 28, left: 26 },
  { top: 22, right: 30 },
  { bottom: 28, left: 24 },
  { bottom: 24, right: 26 },
];

interface HomeScreenProps {
  onNavigateToSend?: (peer?: Peer) => void;
  onNavigateToReceive?: () => void;
  onNavigateToTransfer?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToSend,
  onNavigateToReceive,
  onNavigateToTransfer,
}) => {
  const {
    peers: livePeers,
    selfDevice,
    freeStorageGB,
    history,
    engineConnected,
    rescanLAN,
  } = useDroplyStore();
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const displayedPeers: Peer[] = livePeers.map((lp, idx) => ({
    id: lp.device_id,
    name: lp.device_name,
    deviceType:
      lp.device_type === 'ios'
        ? 'android'
        : (lp.device_type as Peer['deviceType']) || 'mac',
    distance: lp.distance_hint || 'LAN',
    protocol: lp.protocol_badge || `:${lp.port}`,
    status: lp.trusted ? 'Direct P2P' : 'Ready',
    ip: lp.ip_address,
    port: lp.port,
    position: RADAR_POSITIONS[idx % RADAR_POSITIONS.length],
  }));

  const totalTransferredToday = history.reduce(
    (sum, h) => sum + (h.total_size_bytes || 0),
    0
  );

  // Radar pulse animations
  const pulseAnim1 = useRef(new Animated.Value(0.6)).current;
  const pulseAnim2 = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    // Pulse animation loop
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim1, {
            toValue: 1.15,
            duration: 2600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim1, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(1300),
          Animated.timing(pulseAnim2, {
            toValue: 1.25,
            duration: 2600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim2, {
            toValue: 0.3,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleSelectPeer = (peer: Peer) => {
    setSelectedPeer(peer);
    setToastVisible(true);
    Animated.spring(toastAnim, {
      toValue: 0,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Auto dismiss toast after 5s
    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToastVisible(false));
    }, 5000);
  };

  const handleRescan = async () => {
    setIsScanning(true);
    await rescanLAN();
    setTimeout(() => {
      setIsScanning(false);
    }, 1000);
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderDeviceIcon = (type: Peer['deviceType'], color: string, size = 20) => {
    switch (type) {
      case 'android':
        return <Smartphone size={size} color={color} />;
      case 'tablet':
        return <Tablet size={size} color={color} />;
      case 'mac':
        return <Laptop size={size} color={color} />;
      case 'windows':
        return <Monitor size={size} color={color} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Droplet size={20} color="#ffffff" fill="#ffffff" />
          </View>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brandTitle}>DROPly</Text>
              <View style={styles.radarActiveDot} />
            </View>
            <View style={styles.networkBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.networkName}>Office_5Ghz</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => onNavigateToTransfer && onNavigateToTransfer()}
        >
          <View style={styles.avatarInner}>
            <Text style={styles.avatarText}>ME</Text>
          </View>
          <View style={styles.onlineBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Network Status Banner */}
        <View style={styles.networkBanner}>
          <View style={styles.networkBannerLeft}>
            <View style={styles.wifiCircle}>
              <Wifi size={18} color={colors.primary} />
              <View style={styles.wifiOnlineDot} />
            </View>
            <View style={styles.networkDetails}>
              <View style={styles.networkRow}>
                <Text style={styles.networkSsid}>Studio_Ultra_5G</Text>
                <View style={styles.dotSeparator} />
                <Text style={styles.ipAddress}>
                  {selfDevice?.ip_address || '192.168.1.142'}
                </Text>
              </View>
              <Text style={styles.p2pStatus}>Direct P2P Link Active</Text>
            </View>
          </View>
          <View style={styles.ultraTag}>
            <Zap size={13} color={colors.primary} />
            <Text style={styles.ultraText}>Ultra</Text>
          </View>
        </View>

        {/* Interactive Radar Hub */}
        <View style={styles.radarContainer}>
          {/* Animated concentric pulse rings */}
          <Animated.View
            style={[
              styles.radarRing,
              styles.radarRingOuter,
              { transform: [{ scale: pulseAnim1 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.radarRing,
              styles.radarRingMiddle,
              { transform: [{ scale: pulseAnim2 }] },
            ]}
          />
          <View style={[styles.radarRing, styles.radarRingInner]} />

          {/* Rotating radar sweep ray */}
          <Animated.View
            style={[
              styles.radarSweepRay,
              { transform: [{ rotate: spin }] },
            ]}
          />

          {/* Live Discovered Peer Nodes on Radar */}
          {displayedPeers.slice(0, 4).map((peer) => (
            <TouchableOpacity
              key={peer.id}
              style={[styles.peerNode, peer.position]}
              onPress={() => handleSelectPeer(peer)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.peerIconWrapper,
                  selectedPeer?.id === peer.id && styles.peerSelected,
                ]}
              >
                {renderDeviceIcon(peer.deviceType, colors.primary, 20)}
                <View style={styles.peerOnlineDot} />
              </View>
              <Text style={styles.peerLabel} numberOfLines={1}>
                {peer.name}
              </Text>
              <Text style={styles.peerDistance}>
                {peer.ip}:{peer.port}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Center Host Badge (You) */}
          <View style={styles.centerHost}>
            <View style={styles.centerHostPulse} />
            <View style={styles.centerHostCircle}>
              <Droplet size={28} color="#ffffff" fill="#ffffff" />
            </View>
            <View style={styles.hostChip}>
              <Text style={styles.hostChipYou}>You</Text>
              <Text style={styles.hostChipDevice}>
                • {selfDevice?.device_name || 'Connecting...'}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Discovery Quick Actions */}
        <View style={styles.quickActionsGrid}>
          {/* Send Files */}
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardPrimary]}
            onPress={() =>
              onNavigateToSend &&
              onNavigateToSend(selectedPeer || displayedPeers[0])
            }
            activeOpacity={0.85}
          >
            <View style={styles.actionIconPrimary}>
              <Upload size={20} color="#ffffff" />
            </View>
            <Text style={styles.actionTextPrimary}>Send Files</Text>
          </TouchableOpacity>

          {/* Receive Files */}
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardSecondary]}
            onPress={() => onNavigateToReceive && onNavigateToReceive()}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconSecondary}>
              <Download size={20} color={colors.primary} />
            </View>
            <Text style={styles.actionTextSecondary}>Receive</Text>
          </TouchableOpacity>

          {/* Scan QR */}
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardTertiary]}
            onPress={() => onNavigateToReceive && onNavigateToReceive()}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconTertiary}>
              <QrCode size={20} color={colors.onSurface} />
            </View>
            <Text style={styles.actionTextTertiary}>Scan QR</Text>
          </TouchableOpacity>
        </View>

        {/* Nearby Discovered Devices */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Nearby Peers</Text>
            <View style={styles.foundBadge}>
              <Text style={styles.foundBadgeText}>{displayedPeers.length} Found</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={handleRescan}
            activeOpacity={0.7}
          >
            <Text style={styles.rescanText}>Rescan</Text>
            <RefreshCw
              size={14}
              color={colors.primary}
              style={isScanning ? styles.spinIcon : undefined}
            />
          </TouchableOpacity>
        </View>

        {/* Horizontal Carousel for Devices */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContainer}
        >
          {displayedPeers.map((peer) => (
            <View key={peer.id} style={styles.deviceCard}>
              <View style={styles.deviceCardTop}>
                <View style={styles.deviceCardIconBg}>
                  {renderDeviceIcon(peer.deviceType, colors.primary, 18)}
                </View>
                <View
                  style={[
                    styles.statusPill,
                    peer.status === 'Ready' && styles.statusReady,
                    peer.status === 'Wi-Fi 6E' && styles.statusWifi,
                    peer.status === 'Direct P2P' && styles.statusP2P,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      peer.status === 'Ready' && styles.statusReadyText,
                      peer.status === 'Wi-Fi 6E' && styles.statusWifiText,
                      peer.status === 'Direct P2P' && styles.statusP2PText,
                    ]}
                  >
                    {peer.status}
                  </Text>
                </View>
              </View>

              <View style={styles.deviceCardMeta}>
                <Text style={styles.deviceName} numberOfLines={1}>
                  {peer.name}
                </Text>
                <Text style={styles.deviceMetaSub}>
                  {peer.deviceType.toUpperCase()} • {peer.distance}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sendButton}
                onPress={() => onNavigateToSend && onNavigateToSend(peer)}
                activeOpacity={0.8}
              >
                <Text style={styles.sendButtonText}>Send</Text>
                <ArrowRight size={13} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Live Storage & Telemetry Footer */}
        <View style={styles.telemetryCard}>
          <View style={styles.telemetryHeader}>
            <View style={styles.telemetryTitleRow}>
              <HardDrive size={18} color={colors.primary} />
              <Text style={styles.telemetryTitle}>Local Storage</Text>
            </View>
            <Text style={styles.telemetryFree}>{Math.round(freeStorageGB || 142)} GB Free</Text>
          </View>

          {/* Dual bar progress meter */}
          <View style={styles.storageMeter}>
            <View style={[styles.storageBarPrimary, { width: '62%' }]} />
            <View style={[styles.storageBarTertiary, { width: '14%' }]} />
          </View>

          <View style={styles.telemetryStatsRow}>
            <View style={styles.telemetryStat}>
              <ArrowDown size={14} color="#059669" />
              <Text style={styles.telemetryStatText}>
                {formatBytes(totalTransferredToday)} transferred ({history.length} records)
              </Text>
            </View>
            <View style={styles.telemetryStat}>
              <View style={styles.statDot} />
              <Text style={styles.telemetryStatMono}>
                {engineConnected ? 'TLS 1.3 Go Engine Active' : 'Connecting Engine...'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Target Peer Selection Toast */}
      {toastVisible && selectedPeer && (
        <Animated.View
          style={[
            styles.floatingToast,
            { transform: [{ translateY: toastAnim }] },
          ]}
        >
          <View style={styles.toastContent}>
            <View style={styles.toastLeft}>
              <View style={styles.toastIconBg}>
                {renderDeviceIcon(selectedPeer.deviceType, '#ffffff', 18)}
              </View>
              <View style={styles.toastMeta}>
                <Text style={styles.toastTargetName} numberOfLines={1}>
                  {selectedPeer.name}
                </Text>
                <Text style={styles.toastSubtitle}>Ready to transmit files</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.toastActionButton}
              onPress={() => {
                setToastVisible(false);
                onNavigateToSend && onNavigateToSend(selectedPeer);
              }}
            >
              <Text style={styles.toastActionText}>Select Files</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    backgroundColor: 'rgba(248, 249, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  radarActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  networkName: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(56, 103, 255, 0.3)',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
  },
  networkBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wifiCircle: {
    position: 'relative',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiOnlineDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: colors.surfaceContainerLow,
  },
  networkDetails: {
    gap: 2,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  networkSsid: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.outlineVariant,
  },
  ipAddress: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.onSurfaceVariant,
  },
  p2pStatus: {
    fontSize: 11,
    color: colors.tertiary,
    fontWeight: '500',
  },
  ultraTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ultraText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  radarContainer: {
    position: 'relative',
    width: '100%',
    height: 320,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.3)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 103, 255, 0.18)',
  },
  radarRingOuter: {
    width: 270,
    height: 270,
    borderColor: 'rgba(56, 103, 255, 0.12)',
  },
  radarRingMiddle: {
    width: 190,
    height: 190,
    borderColor: 'rgba(56, 103, 255, 0.22)',
  },
  radarRingInner: {
    width: 110,
    height: 110,
    borderColor: 'rgba(56, 103, 255, 0.3)',
  },
  radarSweepRay: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    borderRightWidth: 2,
    borderRightColor: 'rgba(56, 103, 255, 0.4)',
  },
  centerHost: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerHostPulse: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(56, 103, 255, 0.18)',
  },
  centerHostCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  hostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 233, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 8,
  },
  hostChipYou: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  hostChipDevice: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  peerNode: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 15,
  },
  peerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  peerSelected: {
    borderColor: colors.primaryContainer,
    transform: [{ scale: 1.1 }],
  },
  peerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  peerLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurface,
    marginTop: 4,
  },
  peerDistance: {
    fontSize: 10,
    color: colors.tertiary,
    fontWeight: '500',
  },
  peerDistanceSub: {
    fontSize: 9,
    color: colors.onSurfaceVariant,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  actionCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionCardPrimary: {
    backgroundColor: colors.primaryContainer,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionIconPrimary: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionCardSecondary: {
    backgroundColor: colors.secondaryContainer,
  },
  actionIconSecondary: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextSecondary: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSecondaryFixed,
  },
  actionCardTertiary: {
    backgroundColor: colors.surfaceContainer,
  },
  actionIconTertiary: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextTertiary: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
  },
  foundBadge: {
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  foundBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimaryFixed,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rescanText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  spinIcon: {
    transform: [{ rotate: '45deg' }],
  },
  carouselContainer: {
    gap: 12,
    paddingVertical: 4,
  },
  deviceCard: {
    width: 156,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  deviceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceCardIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  statusReady: {
    backgroundColor: '#ecfdf5',
  },
  statusWifi: {
    backgroundColor: colors.primaryFixed,
  },
  statusP2P: {
    backgroundColor: colors.tertiaryFixed,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  statusReadyText: {
    color: '#047857',
  },
  statusWifiText: {
    color: colors.primary,
  },
  statusP2PText: {
    color: colors.tertiary,
  },
  deviceCardMeta: {
    marginVertical: 10,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  deviceMetaSub: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 7,
    borderRadius: 14,
  },
  sendButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  telemetryCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  telemetryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  telemetryFree: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.tertiary,
  },
  storageMeter: {
    height: 6,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  storageBarPrimary: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  storageBarTertiary: {
    height: '100%',
    backgroundColor: colors.tertiaryContainer,
  },
  telemetryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  telemetryStatText: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  statDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  telemetryStatMono: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.onSurfaceVariant,
  },
  floatingToast: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 99,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inverseSurface,
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  toastIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastMeta: {
    flex: 1,
  },
  toastTargetName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inverseOnSurface,
  },
  toastSubtitle: {
    fontSize: 11,
    color: 'rgba(234, 241, 255, 0.75)',
  },
  toastActionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  toastActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
