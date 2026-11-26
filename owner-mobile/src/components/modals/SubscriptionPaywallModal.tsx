import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  AppState,
} from 'react-native';
import {
  AutoPayApp,
  formatDisplayDate,
  startProTrialWithAutoPay,
  verifyAndSyncSubscription,
  SubscriptionState,
} from '../../services/subscriptionService';

interface SubscriptionPaywallModalProps {
  visible: boolean;
  reason?: 'PROPERTY_LIMIT' | 'WHATSAPP_LIMIT' | 'UPGRADE';
  onClose: () => void;
  onActivated?: (state: SubscriptionState) => void;
}

export const SubscriptionPaywallModal: React.FC<SubscriptionPaywallModalProps> = ({
  visible,
  reason = 'UPGRADE',
  onClose,
  onActivated,
}) => {
  const [selectedApp, setSelectedApp] = useState<AutoPayApp>('PHONEPE');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pendingSubscriptionId, setPendingSubscriptionId] = useState<string | null>(null);

  const nextMonthDate = formatDisplayDate(
    new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0]
  );

  const handleVerifyNow = async (subIdOverride?: string | null, silent = false) => {
    const targetId = subIdOverride ?? pendingSubscriptionId;
    if (!targetId) return;
    setVerifying(true);
    try {
      const { verified, state } = await verifyAndSyncSubscription(targetId);
      if (verified) {
        setPendingSubscriptionId(null);
        onActivated?.(state);
        onClose();
        Alert.alert(
          '👑 Pro Trial Activated!',
          `UPI AutoPay confirmed! Your 1-Month Free Trial is active (₹0 today, ₹149/mo starting ${formatDisplayDate(state.nextBillingDate)}).`
        );
      } else if (!silent) {
        Alert.alert(
          'Awaiting Confirmation',
          'We have not received Razorpay/UPI AutoPay confirmation yet. Please complete the mandate approval in your payment app, then tap "Verify & Activate Pro".'
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!visible || !pendingSubscriptionId) return;
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void handleVerifyNow(pendingSubscriptionId, true);
      }
    });
    return () => sub.remove();
  }, [visible, pendingSubscriptionId]);

  const reasonBannerText =
    reason === 'PROPERTY_LIMIT'
      ? 'Free plan includes 1 property. Start your 1-Month Free Trial (₹0 today, ₹149/mo after) to manage unlimited properties.'
      : reason === 'WHATSAPP_LIMIT'
      ? "You've reached 5/5 free WhatsApp reminders this month. Upgrade to Pro for unlimited reminders."
      : 'Unlock unlimited properties & unlimited WhatsApp rent reminders with your 1-Month Free Trial.';

  const handleStartTrial = async () => {
    setSubmitting(true);
    try {
      const { state, launchedUpiApp, shortUrl } = await startProTrialWithAutoPay(selectedApp);
      setPendingSubscriptionId(state.subscriptionId || null);
      if (!launchedUpiApp && !shortUrl) {
        Alert.alert(
          'Complete UPI AutoPay',
          'Could not open the payment app automatically. Please complete your Razorpay mandate and tap "Verify & Activate Pro".'
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Could Not Start AutoPay',
        err?.message || 'Unable to create Razorpay AutoPay mandate. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>👑 STAYNEST PRO • 1-MONTH FREE TRIAL</Text>
              </View>
              <Text style={styles.title}>Upgrade to StayNest Pro</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            <View style={styles.reasonBox}>
              <Text style={styles.reasonText}>{reasonBannerText}</Text>
            </View>

            {/* Price Hero */}
            <View style={styles.priceCard}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.priceZero}>₹0</Text>
                <Text style={styles.priceToday}>Today</Text>
              </View>
              <Text style={styles.priceSub}>
                Then <Text style={{ fontWeight: '800', color: '#0f172a' }}>₹149/month</Text> starting {nextMonthDate} • Cancel anytime in 1 tap
              </Text>
            </View>

            {/* Free vs Pro Comparison */}
            <View style={styles.compareCard}>
              <View style={styles.compareRowHeader}>
                <Text style={[styles.compareColLabel, { flex: 1.4 }]}>Feature</Text>
                <Text style={[styles.compareColLabel, { flex: 0.8, textAlign: 'center' }]}>Free</Text>
                <Text style={[styles.compareColLabel, { flex: 1, textAlign: 'center', color: '#ea580c' }]}>Pro</Text>
              </View>
              {[
                { name: 'Properties Allowed', free: 'Max 1', pro: 'Unlimited' },
                { name: 'WhatsApp Reminders', free: '5 / month', pro: 'Unlimited' },
                { name: 'UPI AutoPay Trial', free: '—', pro: '₹0 (30 days)' },
              ].map((row) => (
                <View key={row.name} style={styles.compareRow}>
                  <Text style={[styles.compareFeat, { flex: 1.4 }]}>{row.name}</Text>
                  <Text style={[styles.compareVal, { flex: 0.8, textAlign: 'center' }]}>{row.free}</Text>
                  <Text style={[styles.compareValPro, { flex: 1, textAlign: 'center' }]}>{row.pro}</Text>
                </View>
              ))}
            </View>

            {/* UPI AutoPay App Selector */}
            <Text style={styles.methodLabel}>SELECT UPI AUTOPAY APP</Text>
            <View style={styles.methodRow}>
              {(
                [
                  { id: 'PHONEPE', label: 'PhonePe' },
                  { id: 'GPAY', label: 'Google Pay' },
                  { id: 'PAYTM', label: 'Paytm' },
                  { id: 'UPI', label: 'Any UPI' },
                ] as const
              ).map((app) => {
                const active = selectedApp === app.id;
                return (
                  <TouchableOpacity
                    key={app.id}
                    style={[styles.methodChip, active && styles.methodChipActive]}
                    onPress={() => setSelectedApp(app.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                      {app.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {pendingSubscriptionId ? (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonText}>
                  ⏳ Waiting for Razorpay / UPI AutoPay confirmation for mandate {pendingSubscriptionId}. Once you approve in your UPI app, tap below to verify and unlock Pro.
                </Text>
                <TouchableOpacity
                  style={[styles.ctaBtn, { marginTop: 10 }, verifying && { opacity: 0.65 }]}
                  onPress={() => handleVerifyNow(pendingSubscriptionId, false)}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.ctaBtnText}>Verify & Activate Pro</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.ctaBtn, submitting && { opacity: 0.65 }]}
                onPress={handleStartTrial}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.ctaBtnText}>Start 1-Month Free Trial (₹0 Today)</Text>
                )}
              </TouchableOpacity>
            )}

            <Text style={styles.footnote}>
              🔒 UPI AutoPay Mandate • Auto-debits ₹149/mo from {nextMonthDate}. Cancel anytime in Profile.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#faf8f6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  proPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    marginBottom: 6,
  },
  proPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  reasonText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#9a3412',
    lineHeight: 18,
  },
  priceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#efece9',
    padding: 14,
    marginBottom: 12,
  },
  priceZero: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ea580c',
  },
  priceToday: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  compareCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#efece9',
    padding: 12,
    marginBottom: 14,
  },
  compareRowHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  compareColLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  compareRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  compareFeat: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  compareVal: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  compareValPro: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '800',
  },
  methodLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  methodChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  methodChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  methodChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  methodChipTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  ctaBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  footnote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
  },
});
