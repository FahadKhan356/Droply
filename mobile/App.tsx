import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Radio, Upload, Activity, Settings, QrCode } from 'lucide-react-native';
import { colors } from './src/theme/colors';
import { HomeScreen } from './src/screens/HomeScreen';

export type ScreenType = 'radar' | 'send' | 'transfer' | 'receive' | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('radar');
  const [activePeer, setActivePeer] = useState<any>(null);

  const handleNavigateToSend = (peer?: any) => {
    setActivePeer(peer);
    setCurrentScreen('send');
  };

  const handleNavigateToReceive = () => {
    setCurrentScreen('receive');
  };

  const handleNavigateToTransfer = () => {
    setCurrentScreen('transfer');
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      
      {/* Screen Render Container */}
      <View style={styles.screenContainer}>
        {currentScreen === 'radar' && (
          <HomeScreen
            onNavigateToSend={handleNavigateToSend}
            onNavigateToReceive={handleNavigateToReceive}
            onNavigateToTransfer={handleNavigateToTransfer}
          />
        )}
        {currentScreen !== 'radar' && (
          <HomeScreen
            onNavigateToSend={handleNavigateToSend}
            onNavigateToReceive={handleNavigateToReceive}
            onNavigateToTransfer={handleNavigateToTransfer}
          />
        )}
      </View>

      {/* Global Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[
            styles.navItem,
            currentScreen === 'radar' && styles.navItemActive,
          ]}
          onPress={() => setCurrentScreen('radar')}
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
          style={[
            styles.navItem,
            currentScreen === 'send' && styles.navItemActive,
          ]}
          onPress={() => setCurrentScreen('send')}
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
          style={[
            styles.navItem,
            currentScreen === 'transfer' && styles.navItemActive,
          ]}
          onPress={() => setCurrentScreen('transfer')}
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
            {/* Active transfer pill indicator */}
            <View style={styles.badgeNotification} />
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
          style={[
            styles.navItem,
            currentScreen === 'receive' && styles.navItemActive,
          ]}
          onPress={() => setCurrentScreen('receive')}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  screenContainer: {
    flex: 1,
  },
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
  navItemActive: {},
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
