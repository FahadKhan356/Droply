import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Radio, Upload, Activity, QrCode } from 'lucide-react-native';
import { colors } from '../theme/colors';

export type ScreenType = 'radar' | 'send' | 'transfer' | 'receive' | 'settings';

interface BottomTabNavigatorProps {
  currentScreen: ScreenType;
  onSelectScreen: (screen: ScreenType) => void;
  hasActiveTransfer?: boolean;
}

export const BottomTabNavigator: React.FC<BottomTabNavigatorProps> = ({
  currentScreen,
  onSelectScreen,
  hasActiveTransfer = true,
}) => {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onSelectScreen('radar')}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.navIconContainer,
            currentScreen === 'radar' && styles.navIconContainerActive,
          ]}
        >
          <Radio
            size={22}
            color={
              currentScreen === 'radar'
                ? colors.primaryContainer
                : colors.secondary
            }
          />
        </View>
        <Text
          style={[
            styles.navLabel,
            currentScreen === 'radar' && styles.navLabelActive,
          ]}
        >
          Radar
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onSelectScreen('send')}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.navIconContainer,
            currentScreen === 'send' && styles.navIconContainerActive,
          ]}
        >
          <Upload
            size={22}
            color={
              currentScreen === 'send'
                ? colors.primaryContainer
                : colors.secondary
            }
          />
        </View>
        <Text
          style={[
            styles.navLabel,
            currentScreen === 'send' && styles.navLabelActive,
          ]}
        >
          Send
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onSelectScreen('transfer')}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.navIconContainer,
            currentScreen === 'transfer' && styles.navIconContainerActive,
          ]}
        >
          <Activity
            size={22}
            color={
              currentScreen === 'transfer'
                ? colors.primaryContainer
                : colors.secondary
            }
          />
          {hasActiveTransfer && <View style={styles.badgeNotification} />}
        </View>
        <Text
          style={[
            styles.navLabel,
            currentScreen === 'transfer' && styles.navLabelActive,
          ]}
        >
          Transfer
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onSelectScreen('receive')}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.navIconContainer,
            currentScreen === 'receive' && styles.navIconContainerActive,
          ]}
        >
          <QrCode
            size={22}
            color={
              currentScreen === 'receive'
                ? colors.primaryContainer
                : colors.secondary
            }
          />
        </View>
        <Text
          style={[
            styles.navLabel,
            currentScreen === 'receive' && styles.navLabelActive,
          ]}
        >
          Receive
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 3,
  },
  navIconContainer: {
    position: 'relative',
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  navIconContainerActive: {
    backgroundColor: 'rgba(221, 225, 255, 0.7)',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.secondary,
  },
  navLabelActive: {
    color: colors.primaryContainer,
    fontWeight: '700',
  },
  badgeNotification: {
    position: 'absolute',
    top: 4,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
