import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  padding?: number;
}

/**
 * Reusable Warm Orange Frosted Glass Card.
 * Uses web backdrop-filter blur + translucent white fill, luminous 1.5px white border,
 * warm orange drop shadow, and clean iOS/Android translucent fallback.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  borderRadius = 24,
  padding = 20,
}) => {
  const webBlur =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        } as any)
      : null;

  return (
    <View
      style={[
        styles.card,
        { borderRadius, padding },
        webBlur,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
});
