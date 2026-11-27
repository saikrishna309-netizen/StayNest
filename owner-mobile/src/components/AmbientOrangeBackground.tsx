import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface AmbientOrangeBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Warm off-white/cream canvas (#FAF8F5 -> #FFF7ED) with heavily blurred
 * soft tangerine radial glow orbs so frosted glass cards pick up warm depth.
 */
export const AmbientOrangeBackground: React.FC<AmbientOrangeBackgroundProps> = ({
  children,
  style,
}) => {
  const webOrbBlur = Platform.OS === 'web' ? ({ filter: 'blur(54px)' } as any) : null;

  return (
    <View style={[styles.canvas, style]}>
      <View style={styles.orbLayer} pointerEvents="none">
        {/* Top-Right Warm Tangerine Glow */}
        <View style={[styles.orbBase, styles.orbTopRightOuter, webOrbBlur]}>
          <View style={styles.orbTopRightMid}>
            <View style={styles.orbTopRightInner} />
          </View>
        </View>

        {/* Mid-Left Soft Peach Glow */}
        <View style={[styles.orbBase, styles.orbMidLeftOuter, webOrbBlur]}>
          <View style={styles.orbMidLeftMid}>
            <View style={styles.orbMidLeftInner} />
          </View>
        </View>

        {/* Bottom-Left Deep Tangerine Glow */}
        <View style={[styles.orbBase, styles.orbBottomLeftOuter, webOrbBlur]}>
          <View style={styles.orbBottomLeftMid}>
            <View style={styles.orbBottomLeftInner} />
          </View>
        </View>

        {/* Bottom-Right Warm Amber Glow */}
        <View style={[styles.orbBase, styles.orbBottomRightOuter, webOrbBlur]}>
          <View style={styles.orbBottomRightMid} />
        </View>
      </View>

      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#FAF8F5',
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
    top: -65,
    right: -70,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(253, 186, 116, 0.36)',
  },
  orbTopRightMid: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(251, 146, 60, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbTopRightInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
  },
  orbMidLeftOuter: {
    top: '28%',
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(253, 186, 116, 0.32)',
  },
  orbMidLeftMid: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(251, 146, 60, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbMidLeftInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
  },
  orbBottomLeftOuter: {
    bottom: -90,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(251, 146, 60, 0.38)',
  },
  orbBottomLeftMid: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(249, 115, 22, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbBottomLeftInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(234, 88, 12, 0.22)',
  },
  orbBottomRightOuter: {
    bottom: -75,
    right: -65,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(253, 186, 116, 0.35)',
  },
  orbBottomRightMid: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(251, 146, 60, 0.28)',
  },
});
