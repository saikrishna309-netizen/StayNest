import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { GLASS_TOKENS } from './GlassCard';

export interface GlassSuccessOptions {
  title?: string;
  message: string;
  buttonText?: string;
  onDone?: () => void;
}

type Listener = (opts: GlassSuccessOptions) => void;
const listeners = new Set<Listener>();

export const showGlassSuccess = (options: GlassSuccessOptions) => {
  if (listeners.size === 0) return;
  listeners.forEach((fn) => fn(options));
};

export const GlassSuccessHost: React.FC = () => {
  const [queue, setQueue] = useState<GlassSuccessOptions[]>([]);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const handler: Listener = (opts) => {
      setQueue((prev) => [...prev, opts]);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const current = queue[0] || null;

  useEffect(() => {
    if (!current) return;
    scaleAnim.setValue(0.88);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [current, scaleAnim, opacityAnim]);

  const handleDone = () => {
    const cb = current?.onDone;
    setQueue((prev) => prev.slice(1));
    if (cb) cb();
  };

  if (!current) return null;

  return (
    <Modal
      visible={!!current}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDone}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.glassCard,
            GLASS_TOKENS.webBlur20,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Circular Checkmark Badge */}
          <View style={styles.checkCircleOuter}>
            <Svg width={92} height={92} viewBox="0 0 92 92" fill="none">
              <Circle
                cx="46"
                cy="46"
                r="42"
                fill="rgba(16, 185, 129, 0.12)"
                stroke="rgba(16, 185, 129, 0.55)"
                strokeWidth="3.5"
              />
              <Path
                d="M29 47.5L40.5 59L64 34"
                stroke="#10B981"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <Text style={styles.title}>{current.title || 'Success'}</Text>
          <Text style={styles.message}>{current.message}</Text>

          <TouchableOpacity
            style={[styles.doneBtn, GLASS_TOKENS.webBlur16]}
            onPress={handleDone}
            activeOpacity={0.82}
          >
            <Text style={styles.doneBtnText}>{current.buttonText || 'Done'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as any)
      : {}),
  },
  glassCard: {
    width: '100%',
    maxWidth: 336,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 14,
  },
  checkCircleOuter: {
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  message: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 26,
  },
  doneBtn: {
    minWidth: 136,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(249, 115, 22, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 2,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: 0.2,
  },
});
