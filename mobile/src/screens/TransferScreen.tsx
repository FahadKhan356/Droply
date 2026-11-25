import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Switch,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  ArrowLeft,
  Smartphone,
  Laptop,
  CheckCircle2,
  Wifi,
  Zap,
  Clock,
  Activity,
  TrendingUp,
  FileText,
  Video,
  FileArchive,
  Check,
  Pause,
  Play,
  X,
  Lock,
  Radio,
  HardDrive,
  Droplet,
} from 'lucide-react-native';
import { colors } from '../theme/colors';

interface TransferScreenProps {
  onBack?: () => void;
  onFinish?: () => void;
}

export const TransferScreen: React.FC<TransferScreenProps> = ({
  onBack,
  onFinish,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [keepAwake, setKeepAwake] = useState(true);
  const [progress, setProgress] = useState(68);
  const [speed, setSpeed] = useState(84.5);
  const [activeFileProgress, setActiveFileProgress] = useState(72);

  // Flow animation between devices
  const flowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(flowAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Progress counter simulation
    const interval = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev >= 99) return 99;
          return prev + 1;
        });
        setActiveFileProgress((prev) => {
          if (prev >= 98) return 98;
          return prev + 1;
        });
        setSpeed((prev) => +(80 + Math.random() * 12).toFixed(1));
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleCancelTransfer = () => {
    Alert.alert(
      'Cancel Transfer?',
      'Are you sure you want to cancel? Partial files will be discarded.',
      [
        { text: 'Keep Transferring', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => onBack && onBack(),
        },
      ]
    );
  };

  const translateX = flowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 30],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.logoBadge}>
            <Droplet size={18} color="#ffffff" fill="#ffffff" />
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Active Transfer
          </Text>
        </View>

        <View style={styles.profileBadge}>
          <Text style={styles.profileText}>ME</Text>
          <View style={styles.onlineBadge} />
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Connection Pill Banner */}
        <View style={styles.connectionBanner}>
          <View style={styles.bannerLeft}>
            <View style={styles.pulseContainer}>
              <View style={styles.pulseOuter} />
              <View style={styles.pulseDot} />
            </View>
            <View>
              <Text style={styles.bannerTitle}>DIRECT LOCAL TRANSFER</Text>
              <Text style={styles.bannerSubtitle}>
                Wi-Fi 6 Direct • E2E Encrypted • Zero Cloud
              </Text>
            </View>
          </View>
          <View style={styles.speedBadge}>
            <Zap size={13} color={colors.tertiary} />
            <Text style={styles.speedBadgeText}>1.2 Gbps</Text>
          </View>
        </View>

        {/* Peer Flow Showcase (Interactive Device Bridge) */}
        <View style={styles.peerFlowCard}>
          <View style={styles.deviceColumn}>
            <View style={styles.deviceIconCirclePrimary}>
              <Smartphone size={26} color={colors.onPrimaryFixed} />
              <View style={styles.verifiedCheckBadge}>
                <CheckCircle2 size={13} color={colors.tertiary} />
              </View>
            </View>
            <Text style={styles.deviceNameText}>iPhone 15 Pro</Text>
            <Text style={styles.deviceSelfTag}>(You)</Text>
            <Text style={styles.deviceIpText}>192.168.1.42</Text>
          </View>

          {/* Transfer Wave Stream */}
          <View style={styles.waveStreamContainer}>
            <View style={styles.streamLineContainer}>
              <Animated.View
                style={[
                  styles.streamParticle,
                  { transform: [{ translateX }] },
                ]}
              >
                <Activity size={16} color={colors.primaryContainer} />
              </Animated.View>
            </View>
            <Text style={styles.streamProtocolText}>TLS 1.3 LOCAL DIRECT</Text>
          </View>

          <View style={styles.deviceColumn}>
            <View style={styles.deviceIconCircleSecondary}>
              <Laptop size={26} color={colors.onSecondaryContainer} />
              <View style={styles.verifiedCheckBadge}>
                <Wifi size={13} color={colors.tertiaryContainer} />
              </View>
            </View>
            <Text style={styles.deviceNameText}>Mac Studio M2</Text>
            <Text style={styles.deviceSubPath}>Downloads/DROPly</Text>
            <Text style={styles.deviceIpText}>192.168.1.108</Text>
          </View>
        </View>

        {/* Real-Time Transfer Metrics Card */}
        <View style={styles.metricsCard}>
          <View style={styles.metricsHeader}>
            <View>
              <Text style={styles.metricsSendingLabel}>SENDING 3 FILES</Text>
              <View style={styles.percentageRow}>
                <Text style={styles.percentageNumber}>{progress}</Text>
                <Text style={styles.percentageSign}>%</Text>
              </View>
            </View>

            <View style={styles.etaContainer}>
              <Text style={styles.etaLabel}>Est. time remaining</Text>
              <View style={styles.etaValueRow}>
                <Clock size={16} color={colors.primary} />
                <Text style={styles.etaValue}>8s</Text>
              </View>
            </View>
          </View>

          {/* Dual Tone Progress Bar */}
          <View style={styles.progressBarWrapper}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progress}%` },
                ]}
              />
            </View>
            <View style={styles.progressStatsRow}>
              <Text style={styles.progressStatsLeft}>
                {(2.1 * (progress / 100)).toFixed(2)} GB transferred
              </Text>
              <Text style={styles.progressStatsRight}>2.10 GB total</Text>
            </View>
          </View>

          {/* Live Telemetry Grid (Throughput + Stability) */}
          <View style={styles.telemetryGrid}>
            <View style={styles.telemetryTile}>
              <View style={styles.tileHeader}>
                <Text style={styles.tileTitle}>LAN THROUGHPUT</Text>
                <Zap size={14} color={colors.tertiary} />
              </View>
              <View style={styles.throughputRow}>
                <Text style={styles.throughputNum}>{speed}</Text>
                <Text style={styles.throughputUnit}>MB/s</Text>
              </View>
              <View style={styles.peakRow}>
                <TrendingUp size={12} color={colors.primary} />
                <Text style={styles.peakText}>
                  Peak: <Text style={styles.peakBold}>112 MB/s</Text>
                </Text>
              </View>
            </View>

            <View style={styles.telemetryTile}>
              <View style={styles.tileHeader}>
                <Text style={styles.tileTitle}>BANDWIDTH STABILITY</Text>
                <Text style={styles.stabilityVal}>99.8%</Text>
              </View>
              <View style={styles.sparklineContainer}>
                <View style={[styles.sparkBar, { height: '60%' }]} />
                <View style={[styles.sparkBar, { height: '80%' }]} />
                <View style={[styles.sparkBar, { height: '70%' }]} />
                <View style={[styles.sparkBar, { height: '95%' }]} />
                <View style={[styles.sparkBar, { height: '85%' }]} />
                <View style={[styles.sparkBar, { height: '100%' }]} />
                <View style={[styles.sparkBar, { height: '90%' }]} />
              </View>
              <Text style={styles.retransmitText}>
                Zero packet retransmission
              </Text>
            </View>
          </View>
        </View>

        {/* File Queue List Section */}
        <View style={styles.queueSection}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Transfer Queue</Text>
            <Text style={styles.queueSubtitle}>2 of 3 remaining</Text>
          </View>

          {/* Item 1: Completed */}
          <View style={styles.queueItem}>
            <View style={styles.queueItemIconCompleted}>
              <FileText size={20} color={colors.onSurface} />
            </View>
            <View style={styles.queueItemDetails}>
              <View style={styles.queueItemTitleRow}>
                <Text style={styles.queueItemName} numberOfLines={1}>
                  Design_System_Master.fig
                </Text>
                <View style={styles.doneBadge}>
                  <CheckCircle2 size={13} color={colors.tertiary} />
                  <Text style={styles.doneBadgeText}>Done</Text>
                </View>
              </View>
              <Text style={styles.queueItemMeta}>
                640 MB • Verified SHA-256
              </Text>
            </View>
          </View>

          {/* Item 2: Active In-Progress */}
          <View style={[styles.queueItem, styles.queueItemActive]}>
            <View style={styles.queueItemIconActive}>
              <Video size={20} color={colors.onPrimaryFixed} />
            </View>
            <View style={styles.queueItemDetails}>
              <View style={styles.queueItemTitleRow}>
                <Text style={styles.queueItemName} numberOfLines={1}>
                  Keynote_Presentation_4K.mov
                </Text>
                <Text style={styles.activePercentText}>
                  {activeFileProgress}%
                </Text>
              </View>
              <Text style={styles.queueItemMeta}>
                864 MB of 1.2 GB • {speed} MB/s
              </Text>
              {/* Micro Progress Bar */}
              <View style={styles.microProgressBar}>
                <View
                  style={[
                    styles.microProgressFill,
                    { width: `${activeFileProgress}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Item 3: Queued */}
          <View style={[styles.queueItem, styles.queueItemPending]}>
            <View style={styles.queueItemIconPending}>
              <FileArchive size={20} color={colors.onSurfaceVariant} />
            </View>
            <View style={styles.queueItemDetails}>
              <View style={styles.queueItemTitleRow}>
                <Text style={styles.queueItemName} numberOfLines={1}>
                  Hero_Renders_Package.zip
                </Text>
                <View style={styles.inQueuePill}>
                  <Text style={styles.inQueueText}>In Queue</Text>
                </View>
              </View>
              <Text style={styles.queueItemMeta}>260 MB • Pending transfer</Text>
            </View>
          </View>
        </View>

        {/* Keep Screen Awake Utility */}
        <View style={styles.utilityCard}>
          <View style={styles.utilityLeft}>
            <View style={styles.utilityIconCircle}>
              <Lock size={16} color={colors.onTertiaryFixed} />
            </View>
            <View>
              <Text style={styles.utilityTitle}>Keep Screen Awake</Text>
              <Text style={styles.utilitySub}>
                Prevents transfer suspension
              </Text>
            </View>
          </View>
          <Switch
            value={keepAwake}
            onValueChange={setKeepAwake}
            trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Primary Action Controls */}
        <View style={styles.controlsSection}>
          <TouchableOpacity
            style={[
              styles.pauseButton,
              isPaused && styles.resumeButton,
            ]}
            onPress={handleTogglePause}
            activeOpacity={0.85}
          >
            {isPaused ? (
              <Play size={20} color="#ffffff" fill="#ffffff" />
            ) : (
              <Pause size={20} color="#ffffff" fill="#ffffff" />
            )}
            <Text style={styles.pauseButtonText}>
              {isPaused ? 'Resume Transfer' : 'Pause Transfer'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelTransfer}
            activeOpacity={0.85}
          >
            <X size={18} color={colors.error} />
            <Text style={styles.cancelButtonText}>Cancel Transfer</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248, 249, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backButton: {
    padding: 6,
    borderRadius: 20,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
  },
  profileBadge: {
    position: 'relative',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(56, 103, 255, 0.3)',
  },
  profileText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pulseContainer: {
    position: 'relative',
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseOuter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 101, 119, 0.25)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tertiary,
  },
  bannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  speedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tertiary,
  },
  peerFlowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  deviceColumn: {
    alignItems: 'center',
    width: 95,
  },
  deviceIconCirclePrimary: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  deviceIconCircleSecondary: {
    position: 'relative',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  deviceNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  deviceSelfTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  deviceSubPath: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  deviceIpText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.outline,
    marginTop: 2,
  },
  waveStreamContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  streamLineContainer: {
    width: '100%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(56, 103, 255, 0.2)',
    borderStyle: 'dashed',
  },
  streamParticle: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  streamProtocolText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
    marginTop: 6,
  },
  metricsCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
  },
  metricsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  metricsSendingLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
  },
  percentageRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginTop: 2,
  },
  percentageNumber: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: -1,
  },
  percentageSign: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  etaContainer: {
    alignItems: 'flex-end',
  },
  etaLabel: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  etaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  etaValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onSurface,
  },
  progressBarWrapper: {
    gap: 6,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primaryContainer,
    borderRadius: 6,
  },
  progressStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStatsLeft: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  progressStatsRight: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onSurface,
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  telemetryTile: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.2)',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  throughputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
    marginVertical: 4,
  },
  throughputNum: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.onSurface,
  },
  throughputUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peakText: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  peakBold: {
    fontWeight: '700',
    color: colors.onSurface,
    fontFamily: 'monospace',
  },
  stabilityVal: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tertiary,
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 24,
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  sparkBar: {
    width: 6,
    borderRadius: 3,
    backgroundColor: colors.tertiaryFixedDim,
  },
  retransmitText: {
    fontSize: 9,
    color: colors.onSurfaceVariant,
  },
  queueSection: {
    gap: 8,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
  },
  queueSubtitle: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  queueItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
  },
  queueItemActive: {
    borderColor: colors.primaryContainer,
  },
  queueItemPending: {
    opacity: 0.75,
  },
  queueItemIconCompleted: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItemIconActive: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItemIconPending: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItemDetails: {
    flex: 1,
    gap: 3,
  },
  queueItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
    flex: 1,
    marginRight: 8,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doneBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.tertiary,
  },
  activePercentText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.primary,
  },
  inQueuePill: {
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inQueueText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  queueItemMeta: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
  },
  microProgressBar: {
    height: 4,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  microProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  utilityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
  },
  utilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  utilityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  utilitySub: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  controlsSection: {
    gap: 10,
    marginTop: 4,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryContainer,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  resumeButton: {
    backgroundColor: colors.tertiaryContainer,
  },
  pauseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(186, 26, 26, 0.08)',
    paddingVertical: 12,
    borderRadius: 24,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
});
