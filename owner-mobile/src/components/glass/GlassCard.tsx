import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';

export type GlassVariant = 'default' | 'hero' | 'emerald' | 'vacant' | 'apricot';

export const GLASS_TOKENS = {
  canvasBg: '#FAF7F4',
  brandOrange: '#EA580C',
  charcoalText: '#0F172A',
  cardBg: 'rgba(255, 255, 255, 0.72)',
  cardBorder: 'rgba(255, 255, 255, 0.92)',
  heroBg: 'rgba(30, 41, 59, 0.86)',
  heroBorder: 'rgba(255, 255, 255, 0.18)',
  emeraldBg: 'rgba(209, 250, 229, 0.68)',
  emeraldBorder: 'rgba(16, 185, 129, 0.30)',
  vacantBg: 'rgba(255, 255, 255, 0.78)',
  vacantBorder: 'rgba(255, 255, 255, 0.95)',
  apricotBg: 'rgba(255, 247, 237, 0.85)',
  apricotBorder: '#EA580C',
  dockBg: 'rgba(255, 255, 255, 0.82)',
  dockBorder: 'rgba(255, 255, 255, 0.95)',
  shadow: {
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  webBlur16:
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as any)
      : null,
  webBlur20:
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as any)
      : null,
};

interface GlassCardProps {
  children: React.ReactNode;
  variant?: GlassVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * Frosted Translucent Container with specular glass border, warm shadow,
 * web backdrop-filter blur, and 60fps Android fallback.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'default',
  style,
}) => {
  const variantStyle =
    variant === 'hero'
      ? styles.hero
      : variant === 'emerald'
        ? styles.emerald
        : variant === 'vacant'
          ? styles.vacant
          : variant === 'apricot'
            ? styles.apricot
            : styles.default;

  return (
    <View style={[styles.base, variantStyle, GLASS_TOKENS.webBlur16, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    ...GLASS_TOKENS.shadow,
  },
  default: {
    backgroundColor: GLASS_TOKENS.cardBg,
    borderWidth: 1,
    borderColor: GLASS_TOKENS.cardBorder,
  },
  hero: {
    backgroundColor: GLASS_TOKENS.heroBg,
    borderWidth: 1,
    borderColor: GLASS_TOKENS.heroBorder,
  },
  emerald: {
    backgroundColor: GLASS_TOKENS.emeraldBg,
    borderWidth: 1,
    borderColor: GLASS_TOKENS.emeraldBorder,
  },
  vacant: {
    backgroundColor: GLASS_TOKENS.vacantBg,
    borderWidth: 1,
    borderColor: GLASS_TOKENS.vacantBorder,
  },
  apricot: {
    backgroundColor: GLASS_TOKENS.apricotBg,
    borderWidth: 1.5,
    borderColor: GLASS_TOKENS.apricotBorder,
  },
});
