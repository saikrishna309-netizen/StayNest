import React from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Tenant } from '../types';
import { GlassCard } from './GlassCard';
import { ScalePressable } from './ScalePressable';

interface RentDueSectionProps {
  dueTenants: Tenant[];
  onViewAll: () => void;
  onWhatsApp: (tenant: Tenant) => void;
  onUpdate: (tenant: Tenant) => void;
}

export const RentDueSection: React.FC<RentDueSectionProps> = ({
  dueTenants,
  onViewAll,
  onWhatsApp,
  onUpdate,
}) => {
  return (
    <GlassCard borderRadius={24} padding={18} style={styles.outerCard}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleCluster}>
          <Text style={styles.title}>Rent Due</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{dueTenants.length}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={onViewAll} activeOpacity={0.75}>
          <Text style={styles.viewAllText}>View all ›</Text>
        </TouchableOpacity>
      </View>

      {dueTenants.length === 0 ? (
        <View style={styles.allClearCard}>
          <Text style={{ fontSize: 28, marginBottom: 6 }}>🎉</Text>
          <Text style={styles.allClearTitle}>No Rent Due Pending</Text>
          <Text style={styles.allClearSub}>All active residents have cleared their payments!</Text>
        </View>
      ) : (
        <View style={styles.listCol}>
          {dueTenants.map((t) => {
            const totalRent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
            const dueAmount =
              typeof t.outstandingPaise === 'number'
                ? Math.round(t.outstandingPaise / 100)
                : t.rentStatus === 'PAID'
                  ? 0
                  : totalRent;
            const paidAmount = Math.max(0, totalRent - dueAmount);
            const isPartial = dueAmount > 0 && paidAmount > 0;

            const rawDate = t.checkIn || t.rentDueDate || t.createdAt;
            const dueDateLabel = rawDate
              ? new Date(rawDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '27 Nov 2026';

            return (
              <View key={t.id} style={styles.tenantCard}>
                {/* Top Row: Name + Room/Paid left, Date + PARTIAL badge right */}
                <View style={styles.topRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.tenantName} numberOfLines={1}>
                      {t.fullName}
                    </Text>
                    <Text style={styles.tenantSub} numberOfLines={1}>
                      Room no. - {t.roomNumber || '205'}
                      {isPartial ? ` • Paid ₹${paidAmount.toLocaleString('en-IN')}` : ''}
                    </Text>
                  </View>

                  <View style={styles.dateBadgeCol}>
                    <Text style={styles.dueDate}>{dueDateLabel}</Text>
                    {isPartial && (
                      <View style={styles.partialBadge}>
                        <Text style={styles.partialBadgeText}>PARTIAL</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Bottom Row: Orange Due Amount + Action Cluster */}
                <View style={styles.bottomRow}>
                  <Text style={styles.dueAmountText} numberOfLines={1}>
                    ₹{dueAmount.toLocaleString('en-IN')}{' '}
                    <Text style={styles.dueWord}>Due</Text>
                  </Text>

                  <View style={styles.actionsRow}>
                    {/* Circular Frosted WhatsApp */}
                    <ScalePressable
                      style={styles.whatsAppCircle}
                      onPress={() => onWhatsApp(t)}
                      scaleTo={0.96}
                    >
                      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.08-1.33C8.53 21.52 10.21 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.47 14.21c-.23.65-1.34 1.24-1.85 1.32-.47.07-1.08.1-1.74-.11-.4-.13-.92-.3-1.58-.59-2.78-1.2-4.6-4.01-4.74-4.2-.14-.19-1.13-1.5-1.13-2.86 0-1.36.71-2.03.97-2.31.26-.28.56-.35.75-.35.19 0 .37 0 .54.01.17.01.4-.07.63.48.23.56.79 1.93.86 2.07.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07.16-.19.69-.8.88-1.08.19-.28.37-.23.63-.14.26.09 1.63.77 1.91.91.28.14.47.21.54.33.07.12.07.69-.16 1.34z"
                          fill="#16A34A"
                        />
                      </Svg>
                    </ScalePressable>

                    {/* Circular Frosted Call */}
                    <ScalePressable
                      style={styles.callCircle}
                      onPress={() => {
                        const clean = (t.phone || '').replace(/[^0-9]/g, '');
                        Linking.openURL(`tel:${clean}`).catch(() =>
                          Alert.alert('Call', `Call ${t.fullName} at +91 ${clean}`)
                        );
                      }}
                      scaleTo={0.96}
                    >
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
                          stroke="#475569"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </ScalePressable>

                    {/* Pill Orange Update Button */}
                    <ScalePressable
                      style={styles.updatePillBtn}
                      onPress={() => onUpdate(t)}
                      scaleTo={0.96}
                    >
                      <Text style={styles.updatePillText}>Update</Text>
                    </ScalePressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  outerCard: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  countBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4338CA',
  },
  viewAllText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  listCol: {
    gap: 12,
  },
  tenantCard: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tenantName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 3,
  },
  tenantSub: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
  },
  dateBadgeCol: {
    alignItems: 'flex-end',
    gap: 5,
  },
  dueDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  partialBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  partialBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dueAmountText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EA580C',
    flexShrink: 1,
  },
  dueWord: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  whatsAppCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  callCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  updatePillBtn: {
    backgroundColor: '#F97316',
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EA580C',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  updatePillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  allClearCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  allClearSub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
  },
});
