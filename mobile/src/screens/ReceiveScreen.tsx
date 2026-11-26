import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Animated,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  QrCode,
  Scan,
  Smartphone,
  Edit2,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Laptop,
  Download,
  X,
  Share2,
  Wifi,
  Radio,
  CheckCircle2,
  Film,
  Image as ImageIcon,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useDroplyStore } from '../store/useDroplyStore';
import { formatPIN } from '../utils/formatters';

const { width } = Dimensions.get('window');

interface ReceiveScreenProps {
  onBack?: () => void;
  onNavigateToTransfer?: () => void;
}

export const ReceiveScreen: React.FC<ReceiveScreenProps> = ({
  onBack,
  onNavigateToTransfer,
}) => {
  const {
    activePairing,
    transfers,
    approveIncomingTransfer,
    rejectIncomingTransfer,
    updateEngineSettings,
  } = useDroplyStore();
  const [activeTab, setActiveTab] = useState<'receive' | 'scan'>('receive');
  const [copiedPin, setCopiedPin] = useState(false);
  const [trustedOnly, setTrustedOnly] = useState(true);
  const [incomingRequest, setIncomingRequest] = useState<boolean>(true);
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(272);

  const liveIncoming = transfers.find(
    (t) => t.direction === 'receive' && t.status === 'Waiting for Approval'
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCopyPin = () => {
    setCopiedPin(true);
    setTimeout(() => {
      setCopiedPin(false);
    }, 2000);
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    if (liveIncoming) {
      try {
        await approveIncomingTransfer(liveIncoming.transfer_id);
      } catch {}
    }
    setTimeout(() => {
      setIsAccepting(false);
      setAcceptedSuccess(true);
      setTimeout(() => {
        onNavigateToTransfer && onNavigateToTransfer();
      }, 1200);
    }, 1000);
  };

  const handleDecline = async () => {
    if (liveIncoming) {
      try {
        await rejectIncomingTransfer(liveIncoming.transfer_id);
      } catch {}
    }
    setIncomingRequest(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      {/* Top Bar status */}
      <View style={styles.topBar}>
        <View style={styles.meshStatus}>
          <View style={styles.meshDot} />
          <Text style={styles.meshText}>P2P MESH ACTIVE</Text>
        </View>

        <View style={styles.wifiPill}>
          <Wifi size={14} color={colors.primary} />
          <Text style={styles.wifiText}>Studio_Ultra_5G</Text>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeTab === 'receive' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveTab('receive')}
          activeOpacity={0.8}
        >
          <QrCode
            size={18}
            color={
              activeTab === 'receive'
                ? colors.primaryContainer
                : colors.onSurfaceVariant
            }
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'receive' && styles.segmentTextActive,
            ]}
          >
            Receive Mode
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeTab === 'scan' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveTab('scan')}
          activeOpacity={0.8}
        >
          <Scan
            size={18}
            color={
              activeTab === 'scan'
                ? colors.primaryContainer
                : colors.onSurfaceVariant
            }
          />
          <Text
            style={[
              styles.segmentText,
              activeTab === 'scan' && styles.segmentTextActive,
            ]}
          >
            QR Scanner
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Device Broadcast Card */}
        <View style={styles.broadcastCard}>
          <View style={styles.broadcastHeader}>
            <View style={styles.deviceIconCircle}>
              <Smartphone size={20} color={colors.primary} />
            </View>
            <View style={styles.deviceMeta}>
              <View style={styles.deviceNameRow}>
                <Text style={styles.deviceName}>Elena's iPhone 15 Pro</Text>
                <TouchableOpacity style={styles.editBtn}>
                  <Edit2 size={13} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
              <Text style={styles.deviceSub}>
                Discoverable to everyone on 'Studio_Ultra_5G'
              </Text>
            </View>
          </View>

          {/* Direct PIN Box */}
          <View style={styles.pinBox}>
            <View>
              <Text style={styles.pinLabel}>DIRECT PIN CODE</Text>
              <Text style={styles.pinCode}>{formatPIN(activePairing?.pin)}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyPinBtn}
              onPress={handleCopyPin}
              activeOpacity={0.7}
            >
              {copiedPin ? (
                <>
                  <Check size={14} color="#10b981" />
                  <Text style={[styles.copyPinText, { color: '#10b981' }]}>
                    Copied!
                  </Text>
                </>
              ) : (
                <>
                  <Copy size={14} color={colors.primary} />
                  <Text style={styles.copyPinText}>Tap to Copy</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* High-res QR Card */}
        <View style={styles.qrCard}>
          {/* Expiry Badge */}
          <View style={styles.expiryBadge}>
            <RefreshCw size={13} color={colors.onPrimaryFixed} />
            <Text style={styles.expiryText}>
              Refreshes in {formatCountdown(countdown)}
            </Text>
          </View>

          {/* QR Enclosure with corner brackets */}
          <View style={styles.qrEnclosure}>
            {/* Corner Bracket Accents */}
            <View style={[styles.cornerBracket, styles.bracketTopLeft]} />
            <View style={[styles.cornerBracket, styles.bracketTopRight]} />
            <View style={[styles.cornerBracket, styles.bracketBottomLeft]} />
            <View style={[styles.cornerBracket, styles.bracketBottomRight]} />

            {/* Simulated Pixel-Perfect QR Code */}
            <View style={styles.qrCanvas}>
              {/* Outer Alignment Squares */}
              <View style={[styles.qrMarker, { top: 12, left: 12 }]}>
                <View style={styles.qrMarkerInner} />
              </View>
              <View style={[styles.qrMarker, { top: 12, right: 12 }]}>
                <View style={styles.qrMarkerInner} />
              </View>
              <View style={[styles.qrMarker, { bottom: 12, left: 12 }]}>
                <View style={styles.qrMarkerInner} />
              </View>

              {/* Data Matrix Dots Grid */}
              <View style={styles.qrGrid}>
                {Array.from({ length: 48 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.qrPixel,
                      (i % 2 === 0 || i % 5 === 0) && styles.qrPixelActive,
                    ]}
                  />
                ))}
              </View>

              {/* Center Logo Node Pill */}
              <View style={styles.qrCenterPill}>
                <Share2 size={18} color="#ffffff" />
              </View>
            </View>
          </View>

          <Text style={styles.qrInstructions}>
            Scan with any camera or DROPly web app to initiate instant
            peer-to-peer connection without Bluetooth pairing.
          </Text>
        </View>

        {/* Auto-accept Toggle Component */}
        <View style={styles.autoAcceptCard}>
          <View style={styles.autoAcceptLeft}>
            <View style={styles.shieldIconCircle}>
              <ShieldCheck size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.autoAcceptTitle}>Trusted Devices Only</Text>
              <Text style={styles.autoAcceptSub}>
                Auto-accept files from verified peers
              </Text>
            </View>
          </View>
          <Switch
            value={trustedOnly}
            onValueChange={setTrustedOnly}
            trackColor={{ false: colors.surfaceDim, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Realistic Transfer Request Notification Sheet */}
        {incomingRequest && (
          <View style={styles.incomingRequestSheet}>
            {acceptedSuccess ? (
              <View style={styles.successStateContainer}>
                <CheckCircle2 size={24} color={colors.tertiary} />
                <Text style={styles.successStateText}>
                  Transfer complete! Saved to Downloads
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.requestHeader}>
                  <View style={styles.requestSenderRow}>
                    <View style={styles.senderAvatarCircle}>
                      <Laptop size={18} color={colors.onPrimaryFixed} />
                    </View>
                    <View>
                      <Text style={styles.senderName}>
                        Marcus (Windows 11)
                      </Text>
                      <Text style={styles.senderMeta}>
                        Incoming Transfer Request • 3 files (820 MB)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Previews of incoming files */}
                <View style={styles.previewThumbsRow}>
                  <View style={styles.thumbBox}>
                    <ImageIcon size={22} color={colors.primary} />
                    <View style={styles.thumbExtBadge}>
                      <Text style={styles.thumbExtText}>RAW</Text>
                    </View>
                  </View>
                  <View style={styles.thumbBox}>
                    <Film size={22} color="#7c3aed" />
                    <View style={styles.thumbExtBadge}>
                      <Text style={styles.thumbExtText}>MOV</Text>
                    </View>
                  </View>
                  <View style={[styles.thumbBox, styles.thumbBoxGeneric]}>
                    <Text style={styles.genericThumbText}>+1 More</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.requestActionsRow}>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={handleDecline}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.declineText}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.acceptButton,
                      isAccepting && styles.acceptButtonLoading,
                    ]}
                    onPress={handleAccept}
                    disabled={isAccepting}
                    activeOpacity={0.85}
                  >
                    {isAccepting ? (
                      <>
                        <RefreshCw
                          size={16}
                          color="#ffffff"
                          style={styles.spinIcon}
                        />
                        <Text style={styles.acceptText}>
                          Downloading 820MB...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Download size={18} color="#ffffff" />
                        <Text style={styles.acceptText}>
                          Accept & Download
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meshStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meshDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tertiaryContainer,
  },
  meshText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.onSurfaceVariant,
  },
  wifiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  wifiText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurface,
  },
  segmentContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
    backgroundColor: colors.surfaceContainer,
    borderRadius: 24,
    padding: 4,
    flexDirection: 'row',
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 20,
  },
  segmentButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  segmentTextActive: {
    fontWeight: '700',
    color: colors.primaryContainer,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  broadcastCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  broadcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceMeta: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  editBtn: {
    padding: 4,
  },
  deviceSub: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  pinBox: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.onSurfaceVariant,
  },
  pinCode: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.primary,
    marginTop: 2,
  },
  copyPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  copyPinText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurface,
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryFixed,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimaryFixed,
  },
  qrEnclosure: {
    position: 'relative',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: colors.primary,
  },
  bracketTopLeft: {
    top: 8,
    left: 8,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 4,
  },
  bracketTopRight: {
    top: 8,
    right: 8,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 4,
  },
  bracketBottomLeft: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 4,
  },
  bracketBottomRight: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 4,
  },
  qrCanvas: {
    width: 180,
    height: 180,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  qrMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.onSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: colors.onSurface,
  },
  qrGrid: {
    width: 120,
    height: 120,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPixel: {
    width: 8,
    height: 8,
    borderRadius: 1.5,
    backgroundColor: 'transparent',
  },
  qrPixelActive: {
    backgroundColor: colors.onSurface,
  },
  qrCenterPill: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  qrInstructions: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 240,
    lineHeight: 16,
  },
  autoAcceptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
  },
  autoAcceptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoAcceptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  autoAcceptSub: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
  },
  incomingRequestSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 103, 255, 0.3)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  senderAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  senderMeta: {
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  previewThumbsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  thumbBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.3)',
  },
  thumbBoxGeneric: {
    backgroundColor: colors.surfaceContainer,
  },
  genericThumbText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  thumbExtBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(11, 28, 48, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbExtText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  requestActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurface,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  acceptButtonLoading: {
    backgroundColor: colors.tertiaryContainer,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  spinIcon: {
    transform: [{ rotate: '45deg' }],
  },
  successStateContainer: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successStateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.tertiary,
  },
});
