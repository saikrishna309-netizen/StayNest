import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';

interface GlassBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Ambient Mesh Canvas (#FAF7F4 warm alabaster) with soft radial gradient orbs
 * so frosted glass cards have genuine depth behind them at 60fps.
 */
export const GlassBackground: React.FC<GlassBackgroundProps> = ({ children, style }) => {
  const webBlurOrb = Platform.OS === 'web' ? ({ filter: 'blur(52px)' } as any) : null;

  return (
    <View style={[styles.canvas, style]}>
      {/* Ambient Orbs Layer */}
      <View style={styles.orbLayer} pointerEvents="none">
        {/* Top-Right: Warm Peach */}
        <View style={[styles.orbBase, styles.orbTopRightOuter, webBlurOrb]}>
          <View style={styles.orbTopRightMid}>
            <View style={styles.orbTopRightInner} />
          </View>
        </View>

        {/* Mid-Left: Soft Amber */}
        <View style={[styles.orbBase, styles.orbMidLeftOuter, webBlurOrb]}>
          <View style={styles.orbMidLeftMid}>
            <View style={styles.orbMidLeftInner} />
          </View>
        </View>

        {/* Bottom-Right: Subtle Mint */}
        <View style={[styles.orbBase, styles.orbBottomRightOuter, webBlurOrb]}>
          <View style={styles.orbBottomRightMid}>
            <View style={styles.orbBottomRightInner} />
          </View>
        </View>
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#FAF7F4',
    position: 'relative',
  },
  orbLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  orbBase: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbTopRightOuter: {
    top: -90,
    right: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(234, 88, 12, 0.04)',
  },
  orbTopRightMid: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(234, 88, 12, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbTopRightInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(234, 88, 12, 0.07)',
  },
  orbMidLeftOuter: {
    top: '30%',
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(251, 191, 36, 0.04)',
  },
  orbMidLeftMid: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbMidLeftInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(251, 191, 36, 0.07)',
  },
  orbBottomRightOuter: {
    bottom: 10,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(16, 185, 129, 0.03)',
  },
  orbBottomRightMid: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbBottomRightInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
});
