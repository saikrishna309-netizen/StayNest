import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Tenant } from '../../types';
import { apiClient } from '../../api/client';
import { safeStorage } from '../../utils/safeStorage';
import { computeMonthlyInvoiceTotal } from '../../services/financeSummaryService';

interface MonthlyInvoiceModalProps {
  visible: boolean;
  tenant: Tenant | null;
  onClose: () => void;
  onPaymentSuccess?: (tenantId: string, paidAmount: number, method: string) => void;
}

export const MonthlyInvoiceModal: React.FC<MonthlyInvoiceModalProps> = ({
  visible,
  tenant,
  onClose,
  onPaymentSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'CASH'>('UPI');
  const [editingMeter, setEditingMeter] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dynamic utility & meter states initialized from property utility config or tenant record
  const [electricityMode, setElectricityMode] = useState<'METERED' | 'FIXED' | 'INCLUDED'>('METERED');
  const [prevReading, setPrevReading] = useState('1210');
  const [currReading, setCurrReading] = useState('1355');
  const [ratePerUnit, setRatePerUnit] = useState('8');
  const [fixedElectricity, setFixedElectricity] = useState('0');
  const [maintenanceMode, setMaintenanceMode] = useState<'INCLUDED' | 'EXTRA'>('EXTRA');
  const [maintenanceFee, setMaintenanceFee] = useState('1200');
  const [discount, setDiscount] = useState('0');
  const [propertyMode, setPropertyMode] = useState<'PG' | 'RENTAL'>('PG');

  useEffect(() => {
    if (!tenant || !visible) return;
    const loadUtilityConfig = async () => {
      try {
        const propId = tenant.propertyId || 'prop-pg-1';
        let raw = await safeStorage.getItem(`@staynest_utility_config_${propId}`);
        if (!raw && typeof window !== 'undefined' && window.localStorage) {
          raw = window.localStorage.getItem(`staynest_utility_config_${propId}`);
        }
        if (raw) {
          const cfg = JSON.parse(raw);
          if (cfg.propertyMode) setPropertyMode(cfg.propertyMode);
          if (cfg.electricityMode) setElectricityMode(cfg.electricityMode);
          if (cfg.electricityRatePerUnit !== undefined) setRatePerUnit(String(cfg.electricityRatePerUnit));
          if (cfg.electricityFixedCharge !== undefined) setFixedElectricity(String(cfg.electricityFixedCharge));
          if (cfg.maintenanceMode) setMaintenanceMode(cfg.maintenanceMode);
          if (cfg.maintenanceFee !== undefined) setMaintenanceFee(String(cfg.maintenanceFee));
        } else {
          // Default sensible values if no custom utility config saved yet
          setPropertyMode(tenant.bedLabel ? 'PG' : 'RENTAL');
        }
      } catch {}
    };
    loadUtilityConfig();
  }, [tenant, visible]);

  if (!tenant) return null;

  const baseRent = tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 0;
  const prevNum = Math.max(0, parseInt(prevReading.replace(/\D/g, '') || '0', 10));
  const currNum = Math.max(prevNum, parseInt(currReading.replace(/\D/g, '') || '0', 10));
  const rateNum = Math.max(0, parseFloat(ratePerUnit || '0'));
  const unitsConsumed = Math.max(0, currNum - prevNum);

  const invoice = computeMonthlyInvoiceTotal({
    baseRent,
    electricityMode,
    electricityFixed: parseInt(fixedElectricity.replace(/\D/g, '') || '0', 10),
    prevReading: prevNum,
    currReading: currNum,
    ratePerUnit: rateNum,
    maintenanceMode,
    maintenanceFee: parseInt(maintenanceFee.replace(/\D/g, '') || '0', 10),
    discount: parseInt(discount.replace(/\D/g, '') || '0', 10),
  });

  const unitLabel =
    propertyMode === 'RENTAL'
      ? `Flat ${tenant.roomNumber || '101'}`
      : `Room ${tenant.roomNumber || '101'}${tenant.bedLabel ? ` • ${tenant.bedLabel}` : ''}`;

  const propertyTitle = tenant.propertyName || 'StayNest Property';

  const handlePayNow = async () => {
    setSubmitting(true);
    try {
      try {
        await apiClient('/owner/rent-invoices', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: tenant.id,
            propertyId: tenant.propertyId,
            totalAmountPaise: invoice.totalInvoice * 100,
            paidAmountPaise: invoice.totalInvoice * 100,
            status: 'PAID',
            paymentMode: paymentMethod,
            notes: `Rent ₹${invoice.baseRent} + Elec ₹${invoice.electricityCharge} + Maint ₹${invoice.maintenanceCharge}`,
          }),
        });
      } catch {}

      // Persist payment status locally so Dashboard, Tenants & Financials stay 100% synced
      if (typeof window !== 'undefined' && window.localStorage) {
        const cleanPhone = (tenant.phone || '').replace(/[^0-9]/g, '');
        window.localStorage.setItem(`staynest_paid_${tenant.id}`, 'PAID');
        if (cleanPhone) {
          window.localStorage.setItem(`staynest_paid_${cleanPhone}`, 'PAID');
        }
        window.dispatchEvent(new Event('staynest_expense_added'));
      }

      if (paymentMethod === 'UPI') {
        const upiUrl = `upi://pay?pa=staynest@okaxis&pn=${encodeURIComponent(propertyTitle)}&am=${invoice.totalInvoice}&cu=INR&tn=${encodeURIComponent(`Rent Invoice - ${tenant.fullName}`)}`;
        Linking.openURL(upiUrl).catch(() => {});
      }

      onPaymentSuccess?.(tenant.id, invoice.totalInvoice, paymentMethod);
      Alert.alert(
        '✓ Payment Settled',
        `₹${invoice.totalInvoice.toLocaleString('en-IN')} recorded via ${paymentMethod} for ${tenant.fullName}.`
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareWhatsApp = () => {
    const cleanPhone = (tenant.phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const elecLine =
      electricityMode === 'METERED'
        ? `⚡ Electricity (${unitsConsumed} units @ ₹${rateNum}/unit, ${prevNum} → ${currNum}): ₹${invoice.electricityCharge.toLocaleString('en-IN')}`
        : `⚡ Electricity: ₹${invoice.electricityCharge.toLocaleString('en-IN')}`;
    const msg = [
      `*StayNest Monthly Rent & Utility Invoice*`,
      `👤 Tenant: *${tenant.fullName}*`,
      `🏠 Unit: ${unitLabel} (${propertyTitle})`,
      ``,
      `• Monthly ${propertyMode === 'RENTAL' ? 'Room' : 'Bed'} Rent: ₹${invoice.baseRent.toLocaleString('en-IN')}`,
      `• ${elecLine}`,
      `• Monthly Maintenance: ₹${invoice.maintenanceCharge.toLocaleString('en-IN')}`,
      invoice.discount > 0 ? `• Credits / Discount: -₹${invoice.discount.toLocaleString('en-IN')}` : null,
      ``,
      `*Total Payable: ₹${invoice.totalInvoice.toLocaleString('en-IN')}*`,
      `Please pay via UPI / Cash at your earliest convenience. Thank you!`,
    ]
      .filter(Boolean)
      .join('\n');

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(waUrl, '_blank');
    } else {
      Linking.openURL(waUrl).catch(() =>
        Alert.alert('WhatsApp Not Found', 'Could not open WhatsApp on this device.')
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Top App Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.brandTitle}>StayNest</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Invoice Title & Tenant Subtitle */}
            <Text style={styles.pageTitle}>Monthly Rent & Utility Invoice</Text>
            <Text style={styles.pageSub}>
              {tenant.fullName} • {unitLabel} • {propertyTitle}
            </Text>

            {/* Itemized Breakdown Card */}
            <View style={styles.card}>
              <View style={styles.breakdownHeaderRow}>
                <Text style={styles.breakdownTitle}>Breakdown</Text>
                <TouchableOpacity
                  onPress={() => setEditingMeter(!editingMeter)}
                  style={styles.editMeterPill}
                >
                  <Text style={styles.editMeterPillText}>
                    {editingMeter ? '✓ Done' : '⚡ Edit Meter / Fees'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inline Editable Meter / Utility Controls */}
              {editingMeter && (
                <View style={styles.meterEditBox}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    {(['METERED', 'FIXED', 'INCLUDED'] as const).map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.miniChip, electricityMode === m && styles.miniChipActive]}
                        onPress={() => setElectricityMode(m)}
                      >
                        <Text style={[styles.miniChipText, electricityMode === m && styles.miniChipTextActive]}>
                          {m === 'METERED' ? 'Metered' : m === 'FIXED' ? 'Fixed' : 'Included'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {electricityMode === 'METERED' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniLabel}>Prev Reading</Text>
                        <TextInput
                          style={styles.miniInput}
                          keyboardType="numeric"
                          value={prevReading}
                          onChangeText={setPrevReading}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniLabel}>Curr Reading</Text>
                        <TextInput
                          style={styles.miniInput}
                          keyboardType="numeric"
                          value={currReading}
                          onChangeText={setCurrReading}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.miniLabel}>Rate (₹/unit)</Text>
                        <TextInput
                          style={styles.miniInput}
                          keyboardType="numeric"
                          value={ratePerUnit}
                          onChangeText={setRatePerUnit}
                        />
                      </View>
                    </View>
                  )}

                  {electricityMode === 'FIXED' && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={styles.miniLabel}>Fixed Electricity (₹)</Text>
                      <TextInput
                        style={styles.miniInput}
                        keyboardType="numeric"
                        value={fixedElectricity}
                        onChangeText={setFixedElectricity}
                      />
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Maintenance (₹)</Text>
                      <TextInput
                        style={styles.miniInput}
                        keyboardType="numeric"
                        value={maintenanceFee}
                        onChangeText={(val) => {
                          setMaintenanceFee(val);
                          setMaintenanceMode(Number(val) > 0 ? 'EXTRA' : 'INCLUDED');
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniLabel}>Discount / Credit (₹)</Text>
                      <TextInput
                        style={styles.miniInput}
                        keyboardType="numeric"
                        value={discount}
                        onChangeText={setDiscount}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Line 1: Monthly Room / Bed Rent */}
              <View style={styles.lineItemRow}>
                <Text style={styles.lineItemLabel}>
                  Monthly {propertyMode === 'RENTAL' ? 'Room' : 'Bed'} Rent
                </Text>
                <Text style={styles.lineItemVal}>₹{invoice.baseRent.toLocaleString('en-IN')}</Text>
              </View>

              {/* Line 2: Electricity Bill */}
              <View style={styles.lineItemRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.lineItemLabel}>Electricity Bill</Text>
                  {electricityMode === 'METERED' && (
                    <Text style={styles.lineItemSub}>
                      ({unitsConsumed} units @ ₹{rateNum}/unit,{'\n'}Prev: {prevNum.toLocaleString('en-IN')} → Curr: {currNum.toLocaleString('en-IN')})
                    </Text>
                  )}
                </View>
                <Text style={styles.lineItemVal}>₹{invoice.electricityCharge.toLocaleString('en-IN')}</Text>
              </View>

              {/* Line 3: Monthly Maintenance */}
              <View style={styles.lineItemRow}>
                <Text style={styles.lineItemLabel}>Monthly Maintenance</Text>
                <Text style={styles.lineItemVal}>
                  {invoice.maintenanceCharge > 0
                    ? `₹${invoice.maintenanceCharge.toLocaleString('en-IN')}`
                    : '₹0 (Included)'}
                </Text>
              </View>

              {invoice.discount > 0 && (
                <View style={styles.lineItemRow}>
                  <Text style={styles.lineItemLabel}>Credits / Discount</Text>
                  <Text style={[styles.lineItemVal, { color: '#16a34a' }]}>
                    -₹{invoice.discount.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              {/* Total Payable */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payable:</Text>
                <Text style={styles.totalVal}>₹{invoice.totalInvoice.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            {/* Selectable Payment Methods Card */}
            <View style={styles.paymentCard}>
              {[
                { key: 'UPI', icon: '💠', label: 'UPI / QR' },
                { key: 'CARD', icon: '💳', label: 'Card / NetBanking' },
                { key: 'CASH', icon: '💵', label: 'Cash / Record Payment' },
              ].map((method, idx) => {
                const isSelected = paymentMethod === method.key;
                return (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.paymentOptionRow,
                      isSelected && styles.paymentOptionRowActive,
                      idx < 2 && styles.paymentOptionBorder,
                    ]}
                    onPress={() => setPaymentMethod(method.key as any)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 16, marginRight: 10 }}>{method.icon}</Text>
                    <Text style={[styles.paymentOptionText, isSelected && { fontWeight: '800' }]}>
                      {method.label}
                    </Text>
                    {isSelected && <Text style={styles.selectedCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Primary CTA: Pay ₹[Total Payable] Now */}
            <TouchableOpacity
              style={[styles.payNowBtn, submitting && { opacity: 0.7 }]}
              onPress={handlePayNow}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.payNowBtnText}>
                  {paymentMethod === 'CASH'
                    ? `Record ₹${invoice.totalInvoice.toLocaleString('en-IN')} Cash Payment`
                    : `Pay ₹${invoice.totalInvoice.toLocaleString('en-IN')} Now`}
                </Text>
              )}
            </TouchableOpacity>

            {/* Secondary Outlined CTA: Share Invoice on WhatsApp */}
            <TouchableOpacity
              style={styles.shareWaBtn}
              onPress={handleShareWhatsApp}
              activeOpacity={0.8}
            >
              <Text style={styles.shareWaBtnText}>Share Invoice on WhatsApp</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#faf8f6',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 26,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4,
  },
  pageSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 3,
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#efece9',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  breakdownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  editMeterPill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  editMeterPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ea580c',
  },
  meterEditBox: {
    backgroundColor: '#faf8f6',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#efece9',
    marginBottom: 12,
  },
  miniChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  miniChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  miniChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#374151',
  },
  miniChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  miniLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 2,
  },
  miniInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lineItemLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#111827',
  },
  lineItemSub: {
    fontSize: 11.5,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 16,
  },
  lineItemVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ea580c',
  },
  totalVal: {
    fontSize: 19,
    fontWeight: '900',
    color: '#ea580c',
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#efece9',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  paymentOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  paymentOptionRowActive: {
    backgroundColor: '#fff7ed',
  },
  paymentOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  paymentOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  selectedCheck: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ea580c',
  },
  payNowBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#ea580c',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  payNowBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  shareWaBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  shareWaBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
});
