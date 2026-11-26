import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  Search,
  Mic,
  Plus,
  Image as ImageIcon,
  Video,
  FileText,
  Headphones,
  Folder,
  Check,
  Play,
  FileArchive,
  FileSpreadsheet,
  ArrowRight,
  Droplet,
  Smartphone,
  Laptop,
  X,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useDroplyStore } from '../store/useDroplyStore';
import { formatBytes } from '../utils/formatters';

const { width } = Dimensions.get('window');

interface SendFilesScreenProps {
  recipient?: any;
  onNavigateToTransfer?: () => void;
  onBack?: () => void;
}

export const SendFilesScreen: React.FC<SendFilesScreenProps> = ({
  recipient,
  onNavigateToTransfer,
  onBack,
}) => {
  const {
    localFiles,
    peers,
    selfDevice,
    startFileTransfer,
    createRealNoteFile,
    syncWithGoEngine,
  } = useDroplyStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const targetPeerName =
    recipient?.name ||
    peers[0]?.device_name ||
    selfDevice?.device_name ||
    'Local Host';
  const targetPeerId =
    recipient?.id ||
    peers[0]?.device_id ||
    selfDevice?.device_id ||
    'local_host';
  const targetPeerIp =
    recipient?.ip ||
    peers[0]?.ip_address ||
    selfDevice?.ip_address ||
    '127.0.0.1';
  const targetPeerPort =
    recipient?.port || peers[0]?.port || selfDevice?.port || 53317;

  const handleAddRealFile = async () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const created = await createRealNoteFile(
      `DROPly_Note_${ts}.txt`,
      `DROPly Real P2P Payload created at ${new Date().toLocaleString()}\nHost: ${selfDevice?.device_name || 'DROPly'}\nIP: ${selfDevice?.ip_address || '127.0.0.1'}\n`
    );
    if (created?.id) {
      setSelectedIds((prev) => [...prev, created.id]);
    }
  };

  const handleSendBlast = async () => {
    const chosen = localFiles.filter((f) => selectedIds.includes(f.id));
    if (chosen.length === 0) return;
    try {
      await startFileTransfer({
        peer_id: targetPeerId,
        peer_name: targetPeerName,
        peer_ip: targetPeerIp,
        peer_port: targetPeerPort,
        file_paths: chosen.map((f) => f.source_path),
      });
    } catch {
      await syncWithGoEngine();
    }
    if (onNavigateToTransfer) {
      onNavigateToTransfer();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const photoCount = localFiles.filter((f) => f.type === 'photo').length;
  const videoCount = localFiles.filter((f) => f.type === 'video').length;
  const docCount = localFiles.filter(
    (f) => f.type === 'doc' || f.type === 'sheet' || f.type === 'archive'
  ).length;
  const audioCount = localFiles.filter((f) => f.type === 'audio').length;

  const filteredFiles = localFiles.filter((file) => {
    const matchesSearch = file.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (activeCategory === 'all') return matchesSearch;
    if (activeCategory === 'photos') return matchesSearch && file.type === 'photo';
    if (activeCategory === 'videos') return matchesSearch && file.type === 'video';
    if (activeCategory === 'docs')
      return (
        matchesSearch &&
        (file.type === 'doc' || file.type === 'sheet' || file.type === 'archive')
      );
    if (activeCategory === 'audio') return matchesSearch && file.type === 'audio';
    return matchesSearch;
  });

  const selectedFiles = localFiles.filter((f) => selectedIds.includes(f.id));
  const totalSizeBytes = selectedFiles.reduce((acc, f) => acc + f.size_bytes, 0);
  const totalSizeFormatted = formatBytes(totalSizeBytes);

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
              <Text style={styles.screenLabel}>• Send</Text>
            </View>
            <View style={styles.networkBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.networkName}>Office_5Ghz</Text>
            </View>
          </View>
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
        {/* Title & Add Action Area */}
        <View style={styles.headingSection}>
          <View style={styles.headingRow}>
            <View>
              <Text style={styles.screenHeading}>Select Content to Share</Text>
              <Text style={styles.screenSubheading}>
                Tap to pick files or drag across devices
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addFilesBtn}
              onPress={handleAddRealFile}
              activeOpacity={0.7}
            >
              <Plus size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Search Input Box */}
          <View style={styles.searchBox}>
            <Search size={18} color={colors.outline} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search photos, videos, docs..."
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity style={styles.micBtn}>
              <Mic size={17} color={colors.outline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Horizontal Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              activeCategory === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setActiveCategory('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                activeCategory === 'all' && styles.filterChipTextActive,
              ]}
            >
              All ({localFiles.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              activeCategory === 'photos' && styles.filterChipActive,
            ]}
            onPress={() => setActiveCategory('photos')}
          >
            <ImageIcon
              size={15}
              color={
                activeCategory === 'photos'
                  ? colors.onPrimaryContainer
                  : colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.filterChipText,
                activeCategory === 'photos' && styles.filterChipTextActive,
              ]}
            >
              Photos ({photoCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              activeCategory === 'videos' && styles.filterChipActive,
            ]}
            onPress={() => setActiveCategory('videos')}
          >
            <Video
              size={15}
              color={
                activeCategory === 'videos'
                  ? colors.onPrimaryContainer
                  : colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.filterChipText,
                activeCategory === 'videos' && styles.filterChipTextActive,
              ]}
            >
              Videos ({videoCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              activeCategory === 'docs' && styles.filterChipActive,
            ]}
            onPress={() => setActiveCategory('docs')}
          >
            <FileText
              size={15}
              color={
                activeCategory === 'docs'
                  ? colors.onPrimaryContainer
                  : colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.filterChipText,
                activeCategory === 'docs' && styles.filterChipTextActive,
              ]}
            >
              Documents ({docCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              activeCategory === 'audio' && styles.filterChipActive,
            ]}
            onPress={() => setActiveCategory('audio')}
          >
            <Headphones
              size={15}
              color={
                activeCategory === 'audio'
                  ? colors.onPrimaryContainer
                  : colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.filterChipText,
                activeCategory === 'audio' && styles.filterChipTextActive,
              ]}
            >
              Audio ({audioCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 2-Column Media Grid */}
        <View style={styles.mediaGrid}>
          {filteredFiles.map((file) => {
            const isSelected = selectedIds.includes(file.id);
            return (
              <TouchableOpacity
                key={file.id}
                style={[
                  styles.fileCard,
                  isSelected && styles.fileCardSelected,
                ]}
                onPress={() => toggleSelect(file.id)}
                activeOpacity={0.85}
              >
                {/* Visual Thumbnail Area */}
                <View
                  style={[
                    styles.thumbnailContainer,
                    { backgroundColor: file.color_bg || '#dbeafe' },
                  ]}
                >
                  {/* Tag Badge */}
                  <View style={styles.fileTagBadge}>
                    <Text style={styles.fileTagText}>{file.tag}</Text>
                  </View>

                  {/* Selection Checkmark */}
                  <View
                    style={[
                      styles.checkboxCircle,
                      isSelected && styles.checkboxCircleSelected,
                    ]}
                  >
                    {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                  </View>

                  {/* Center Content Graphic */}
                  <View style={styles.thumbnailCenter}>
                    {file.type === 'photo' && (
                      <ImageIcon size={38} color={colors.primary} />
                    )}
                    {file.type === 'video' && (
                      <Video size={38} color="#7c3aed" />
                    )}
                    {file.type === 'doc' && (
                      <FileText size={38} color="#dc2626" />
                    )}
                    {file.type === 'audio' && (
                      <Headphones size={38} color="#d97706" />
                    )}
                    {file.type === 'archive' && (
                      <FileArchive size={38} color={colors.primary} />
                    )}
                    {file.type === 'sheet' && (
                      <FileSpreadsheet size={38} color="#16a34a" />
                    )}
                  </View>

                  <View style={styles.extBadge}>
                    <Text style={styles.extText}>{file.ext}</Text>
                  </View>
                </View>

                {/* File Metadata */}
                <View style={styles.fileMeta}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <View style={styles.fileSubRow}>
                    <Text
                      style={[
                        styles.fileSize,
                        isSelected && styles.fileSizeSelected,
                      ]}
                    >
                      {file.size_str}
                    </Text>
                    <Text style={styles.fileDate}>{file.date_str}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Bottom Selection Bar */}
      <View style={styles.bottomStagingBar}>
        {/* Recipient Target Pill */}
        <View style={styles.recipientPill}>
          <Smartphone size={14} color={colors.primary} />
          <Text style={styles.recipientText} numberOfLines={1}>
            To: {targetPeerName} ({targetPeerIp})
          </Text>
          <View style={styles.p2pActiveDot} />
        </View>

        {/* Counter and Action Buttons */}
        <View style={styles.stagingActionsRow}>
          <View style={styles.stagingMeta}>
            <Text style={styles.stagingCountText}>
              {selectedIds.length} files selected
            </Text>
            <Text style={styles.stagingSizeText}>• {totalSizeFormatted} total</Text>
          </View>

          <View style={styles.actionButtonsRow}>
            {selectedIds.length > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearAll}
                activeOpacity={0.7}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.sendBlastBtn,
                selectedIds.length === 0 && styles.sendBlastBtnDisabled,
              ]}
              onPress={handleSendBlast}
              disabled={selectedIds.length === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.sendBlastText}>Send Blast</Text>
              <ArrowRight size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    justifyContent: 'space-between',
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
  screenLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryContainer,
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
  profileBadge: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
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
    paddingBottom: 110,
    gap: 16,
  },
  headingSection: {
    gap: 12,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  screenSubheading: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  addFilesBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.3)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurface,
  },
  micBtn: {
    padding: 4,
  },
  filterChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainer,
  },
  filterChipActive: {
    backgroundColor: colors.primaryContainer,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  fileCard: {
    width: (width - 44) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fileCardSelected: {
    borderColor: colors.primaryContainer,
    backgroundColor: 'rgba(237, 243, 255, 0.5)',
  },
  thumbnailContainer: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fileTagBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(11, 28, 48, 0.7)',
  },
  fileTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  checkboxCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  checkboxCircleSelected: {
    backgroundColor: colors.primaryContainer,
  },
  thumbnailCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(11, 28, 48, 0.75)',
  },
  durationText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  extBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  extText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurface,
  },
  fileMeta: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 2,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onSurface,
  },
  fileSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  fileSize: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  fileSizeSelected: {
    color: colors.primaryContainer,
  },
  fileDate: {
    fontSize: 10,
    color: colors.outline,
  },
  bottomStagingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(195, 197, 216, 0.3)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainerLow,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(195, 197, 216, 0.25)',
  },
  recipientText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurface,
  },
  p2pActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  stagingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stagingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stagingCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurface,
  },
  stagingSizeText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainer,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  sendBlastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBlastBtnDisabled: {
    backgroundColor: colors.surfaceContainerHigh,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBlastText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
