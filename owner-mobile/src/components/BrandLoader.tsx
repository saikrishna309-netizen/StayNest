import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export const BRAND_LOADER_COLORS = {
  primary: '#F97316',
  deepAccent: '#EA580C',
  softTint: '#FFF7ED',
  peachBorder: '#FFEDD5',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#0F172A',
  textPrimary: '#1E293B',
  textMuted: '#64748B',
  overlayBackdrop: 'rgba(15, 23, 42, 0.45)',
};

export interface BrandLoaderProps {
  variant?: 'fullScreen' | 'overlay' | 'inline';
  message?: string;
  visible?: boolean;
  color?: string;
  dark?: boolean;
  style?: ViewStyle;
}

const HouseKeyEmblem: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 20v-9.5z"
      fill="#F97316"
      fillOpacity={0.14}
      stroke="#EA580C"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="12.5" r="2.2" stroke="#F97316" strokeWidth={2} />
    <Path d="M12 14.7V18M12 16.8h1.8" stroke="#F97316" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const OrbitingOrangeSpinner: React.FC<{ size?: number }> = ({ size = 76 }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1150,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinLoop.start();
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [spinAnim, pulseAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const strokeWidth = 4;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.38;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          styles.badgeGlow,
          {
            width: size - 16,
            height: size - 16,
            borderRadius: (size - 16) / 2,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <HouseKeyEmblem size={Math.round(size * 0.37)} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <LinearGradient id="neoXpoOrangeArc" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={BRAND_LOADER_COLORS.primary} stopOpacity="1" />
              <Stop offset="100%" stopColor={BRAND_LOADER_COLORS.deepAccent} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={BRAND_LOADER_COLORS.peachBorder}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#neoXpoOrangeArc)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const InlineDotWave: React.FC<{ color: string }> = ({ color }) => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animations = dots.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 130),
          Animated.timing(anim, {
            toValue: -5,
            duration: 240,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 240,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay((2 - index) * 130 + 180),
        ])
      )
    );

    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.inlineRow}>
      {dots.map((anim, i) => (
        <Animated.View
          key={`dot-${i}`}
          style={[
            styles.inlineDot,
            { backgroundColor: color, transform: [{ translateY: anim }] },
          ]}
        />
      ))}
    </View>
  );
};

export const BrandLoader: React.FC<BrandLoaderProps> = ({
  variant = 'inline',
  message,
  visible = true,
  color = BRAND_LOADER_COLORS.primary,
  dark = false,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible, message, fadeAnim]);

  if (!visible) return null;

  if (variant === 'inline') {
    return (
      <View style={[styles.inlineWrap, style]}>
        <InlineDotWave color={color} />
        {message ? (
          <Text style={[styles.inlineMsg, { color: color === '#FFFFFF' ? '#FFFFFF' : BRAND_LOADER_COLORS.textMuted }]}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  if (variant === 'fullScreen') {
    return (
      <View
        style={[
          styles.fullScreenWrap,
          { backgroundColor: dark ? BRAND_LOADER_COLORS.surfaceDark : BRAND_LOADER_COLORS.surfaceLight },
          style,
        ]}
      >
        <Animated.View style={[styles.centerBlock, { opacity: fadeAnim }]}>
          <OrbitingOrangeSpinner size={84} />
          <Text style={[styles.brandWordmark, dark && { color: '#F8FAFC' }]}>Neo Xpo</Text>
          <Text style={[styles.statusMessage, dark && { color: '#94A3B8' }]}>
            {message || 'Setting up your workspace...'}
          </Text>
        </Animated.View>
      </View>
    );
  }

  // variant === 'overlay'
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlayBackdrop}>
        <Animated.View
          style={[
            styles.overlayCard,
            dark && { backgroundColor: BRAND_LOADER_COLORS.surfaceDark, borderColor: '#1E293B' },
            { opacity: fadeAnim },
          ]}
        >
          <OrbitingOrangeSpinner size={72} />
          <Text style={[styles.overlayTitle, dark && { color: '#F8FAFC' }]}>
            {message || 'Saving changes...'}
          </Text>
          <Text style={[styles.overlaySub, dark && { color: '#94A3B8' }]}>
            Please wait a moment
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlow: {
    backgroundColor: BRAND_LOADER_COLORS.softTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND_LOADER_COLORS.peachBorder,
    shadowColor: BRAND_LOADER_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  brandWordmark: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '800',
    color: BRAND_LOADER_COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  statusMessage: {
    marginTop: 6,
    fontSize: 13.5,
    fontWeight: '600',
    color: BRAND_LOADER_COLORS.textMuted,
    textAlign: 'center',
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: BRAND_LOADER_COLORS.overlayBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as any) : {}),
  },
  overlayCard: {
    width: '100%',
    maxWidth: 290,
    backgroundColor: BRAND_LOADER_COLORS.surfaceLight,
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND_LOADER_COLORS.peachBorder,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 12,
  },
  overlayTitle: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_LOADER_COLORS.textPrimary,
    textAlign: 'center',
  },
  overlaySub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: BRAND_LOADER_COLORS.textMuted,
    textAlign: 'center',
  },
  inlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 18,
  },
  inlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  inlineMsg: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
