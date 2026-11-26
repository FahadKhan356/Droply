import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { ConnectionState } from '../types/droply';

interface EngineStatusPillProps {
  state: ConnectionState;
  engineConnected: boolean;
}

export const EngineStatusPill: React.FC<EngineStatusPillProps> = ({
  state,
  engineConnected,
}) => {
  return (
    <View style={styles.pill}>
      <View
        style={[
          styles.dot,
          { backgroundColor: engineConnected ? '#10b981' : colors.primary },
        ]}
      />
      <Text style={styles.text}>
        {engineConnected ? `Go Engine • ${state}` : state}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
});
