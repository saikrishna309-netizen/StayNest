import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';

interface ShimmerBoxProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const ShimmerBox: React.FC<ShimmerBoxProps> = ({
  width = '100%',
  height,
  borderRadius = 12,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 260],
  });

  return (
    <View
      style={[
        styles.shimmerBase,
        { width: width as any, height, borderRadius },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmerSweep,
          { transform: [{ translateX }] },
        ]}
      />
    </View>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Top Property Pill + Action Icons */}
      <View style={styles.topRow}>
        <ShimmerBox width="56%" height={42} borderRadius={21} />
        <View style={styles.topActions}>
          <ShimmerBox width={40} height={40} borderRadius={20} />
          <ShimmerBox width={40} height={40} borderRadius={20} />
        </View>
      </View>

      {/* 2x2 Metric Cards */}
      <View style={styles.gridRow}>
        <View style={styles.metricCard}>
          <ShimmerBox width={36} height={36} borderRadius={10} />
          <ShimmerBox width="62%" height={12} borderRadius={6} style={{ marginTop: 12 }} />
          <ShimmerBox width="78%" height={22} borderRadius={8} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.metricCard}>
          <ShimmerBox width={36} height={36} borderRadius={10} />
          <ShimmerBox width="55%" height={12} borderRadius={6} style={{ marginTop: 12 }} />
          <ShimmerBox width="72%" height={22} borderRadius={8} style={{ marginTop: 8 }} />
        </View>
      </View>

      <View style={styles.gridRow}>
        <View style={styles.metricCard}>
          <ShimmerBox width={36} height={36} borderRadius={10} />
          <ShimmerBox width="58%" height={12} borderRadius={6} style={{ marginTop: 12 }} />
          <ShimmerBox width="45%" height={22} borderRadius={8} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.metricCard}>
          <ShimmerBox width={36} height={36} borderRadius={10} />
          <ShimmerBox width="64%" height={12} borderRadius={6} style={{ marginTop: 12 }} />
          <ShimmerBox width="48%" height={22} borderRadius={8} style={{ marginTop: 8 }} />
        </View>
      </View>

      {/* Quick Actions Row */}
      <View style={styles.quickActionsCard}>
        <ShimmerBox width="38%" height={14} borderRadius={7} style={{ marginBottom: 14 }} />
        <View style={styles.quickCircleRow}>
          {[0, 1, 2, 3].map((idx) => (
            <View key={`qa-${idx}`} style={styles.quickActionItem}>
              <ShimmerBox width={50} height={50} borderRadius={25} />
              <ShimmerBox width={54} height={10} borderRadius={5} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      </View>

      {/* Due Tenants List Rows */}
      <View style={styles.listSection}>
        <ShimmerBox width="44%" height={15} borderRadius={7} style={{ marginBottom: 12 }} />
        {[0, 1, 2].map((idx) => (
          <View key={`due-${idx}`} style={styles.listRowCard}>
            <ShimmerBox width={42} height={42} borderRadius={21} />
            <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
              <ShimmerBox width="58%" height={14} borderRadius={7} />
              <ShimmerBox width="38%" height={11} borderRadius={5} />
            </View>
            <ShimmerBox width={68} height={26} borderRadius={13} />
          </View>
        ))}
      </View>
    </View>
  );
};

export const RoomsSkeleton: React.FC = () => {
  return (
    <View style={styles.roomsWrap}>
      {/* Horizontal Floor Selector Tabs */}
      <View style={styles.floorTabsRow}>
        <ShimmerBox width={82} height={34} borderRadius={17} />
        <ShimmerBox width={94} height={34} borderRadius={17} />
        <ShimmerBox width={94} height={34} borderRadius={17} />
      </View>

      {/* Floor Section Cards */}
      {[0, 1].map((floorIdx) => (
        <View key={`floor-skel-${floorIdx}`} style={styles.floorCard}>
          <View style={styles.floorCardHeader}>
            <ShimmerBox width="38%" height={16} borderRadius={8} />
            <ShimmerBox width={74} height={22} borderRadius={11} />
          </View>
          <View style={styles.roomGrid}>
            {[0, 1, 2, 3].map((roomIdx) => (
              <View key={`room-skel-${floorIdx}-${roomIdx}`} style={styles.roomCard}>
                <View style={styles.roomHeaderRow}>
                  <ShimmerBox width="45%" height={14} borderRadius={7} />
                  <ShimmerBox width={46} height={18} borderRadius={9} />
                </View>
                <View style={styles.bedPillRow}>
                  <ShimmerBox width="46%" height={32} borderRadius={10} />
                  <ShimmerBox width="46%" height={32} borderRadius={10} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: '#FFF7ED',
    opacity: 0.78,
    borderRightWidth: 18,
    borderRightColor: '#FFEDD5',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 24,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  quickActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  quickCircleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
  },
  listSection: {
    marginTop: 4,
    gap: 10,
  },
  listRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  roomsWrap: {
    gap: 16,
    paddingTop: 4,
  },
  floorTabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  floorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    gap: 14,
  },
  floorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roomCard: {
    width: '48%',
    backgroundColor: '#FFFBF7',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    gap: 10,
  },
  roomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bedPillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
});
