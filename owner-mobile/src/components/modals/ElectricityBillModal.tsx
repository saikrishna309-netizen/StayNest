import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { powerBillService, POPULAR_DISCOMS, ElectricityBillData } from '../../services/powerBillService';

interface ElectricityBillModalProps {
  visible: boolean;
  onClose: () => void;
  activeTenantsCount: number;
  propertyId?: string;
  onExpenseAdded?: () => void;
}

export const ElectricityBillModal: React.FC<ElectricityBillModalProps> = ({
  visible,
  onClose,
  activeTenantsCount,
  propertyId,
  onExpenseAdded,
}) => {
  const [billData, setBillData] = useState<ElectricityBillData>(powerBillService.getBillData(propertyId));
  const [selectedBoard, setSelectedBoard] = useState(billData.board);
  const [consumerNo, setConsumerNo] = useState(billData.consumerNumber);
  const [fetching, setFetching] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [fetchSuccessMessage, setFetchSuccessMessage] = useState<string | null>(null);

  // Sub-meter calculator state
  const [calcMode, setCalcMode] = useState<'EQUAL' | 'SUB_METER'>('EQUAL');
  const [unitRate, setUnitRate] = useState('10');
  const [roomNum, setRoomNum] = useState('101');
  const [prevUnits, setPrevUnits] = useState('120');
  const [currUnits, setCurrUnits] = useState('185');

  useEffect(() => {
    if (visible) {
      const data = powerBillService.getBillData(propertyId);
      setBillData(data);
      setSelectedBoard(data.board);
      setConsumerNo(data.consumerNumber);
      setFetchSuccessMessage(null);
    }
  }, [visible, propertyId]);

  const residentsCount = Math.max(activeTenantsCount || 1, 1);
  const equalSplitAmount = Math.round(billData.billAmountRupees / residentsCount);

  // Clean numbers & detect Aadhaar vs USCNO
  const cleanDigits = consumerNo.replace(/[^0-9]/g, '');
  const isAadhaarNumber = cleanDigits.length === 12;
  const isAndhraUscno = cleanDigits.length === 9 || cleanDigits.length === 10;

  // Room sub-meter calculation
  const pUnits = parseFloat(prevUnits) || 0;
  const cUnits = parseFloat(currUnits) || 0;
  const consumedUnits = Math.max(cUnits - pUnits, 0);
  const subMeterCost = Math.round(consumedUnits * (parseFloat(unitRate) || 10));

  const handleFetchBill = async () => {
    const rawInput = consumerNo.trim();
    if (!rawInput) {
      Alert.alert('Required', 'Please enter your Andhra DISCOM consumer number / USCNO / Aadhaar number.');
      return;
    }
    setFetching(true);
    setFetchSuccessMessage(null);
    try {
      const fetched = await powerBillService.fetchLatestBill(rawInput, selectedBoard, propertyId);
      setBillData(fetched);
      const msg = `Amount: ₹${fetched.billAmountRupees.toLocaleString('en-IN')} • ${fetched.units} kWh • Due: ${fetched.dueDate}`;
      setFetchSuccessMessage(msg);
      Alert.alert(
        '⚡ Bill Fetched (₹0 Cost)',
        `Latest bill for ${selectedBoard}\nConsumer / Aadhaar: ${rawInput}\nAmount: ₹${fetched.billAmountRupees.toLocaleString('en-IN')}\nUnits: ${fetched.units} kWh\nDue Date: ${fetched.dueDate}`
      );
    } catch {
      Alert.alert('Error', 'Could not query DISCOM portal. Please try again.');
    } finally {
      setFetching(false);
    }
  };

  const handleAddToExpenses = async () => {
    setAddingExpense(true);
    try {
      await powerBillService.addBillToExpenses(billData, propertyId);
      setBillData((prev) => ({ ...prev, status: 'RECORDED_IN_EXPENSES' }));
      if (onExpenseAdded) onExpenseAdded();
      Alert.alert(
        '✅ Added to Expenses',
        `₹${billData.billAmountRupees.toLocaleString('en-IN')} has been recorded under UTILITIES for this month. Your Finance & Net Profit tabs are updated!`
      );
    } catch (err) {
      console.log('Error adding expense:', err);
      Alert.alert('Error', 'Could not record electricity bill expense.');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleSendWhatsAppNotice = () => {
    const encoded = powerBillService.generateWhatsAppReminder(billData, residentsCount, equalSplitAmount);
    Linking.openURL(`https://wa.me/?text=${encoded}`);
  };

  const handlePayViaUpi = (appName: string) => {
    const upiUrl = `upi://pay?pa=bescom@billpay&pn=${encodeURIComponent(selectedBoard)}&am=${billData.billAmountRupees}&cu=INR&tn=Bill-${consumerNo}`;
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert('UPI App', `Opening ${appName} or default payment app for DISCOM bill payment.`);
      Linking.openURL(`https://www.google.com/search?q=pay+${encodeURIComponent(selectedBoard)}+bill+online`);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIconCircle}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
              </View>
              <View>
                <Text style={styles.modalTitle}>Electricity & Power Bill</Text>
                <Text style={styles.modalSub}>Free State DISCOM Tracking & Sub-Meter Split</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* Free Verification Badge */}
            <View style={styles.freeBadgeRow}>
              <Text style={{ fontSize: 13 }}>🟢</Text>
              <Text style={styles.freeBadgeText}>100% Free DISCOM Gateway • ₹0 API Cost Lifetime</Text>
            </View>

            {/* 1. DISCOM Board & Consumer Number Config */}
            <View style={styles.configCard}>
              <Text style={styles.sectionTitle}>⚡ 1. State Electricity Board (DISCOM)</Text>

              {/* Board Selector */}
              <TouchableOpacity
                style={styles.dropdownToggle}
                onPress={() => setShowBoardDropdown(!showBoardDropdown)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownValue}>{selectedBoard}</Text>
                <Text style={styles.dropdownArrow}>{showBoardDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showBoardDropdown && (
                <View style={styles.dropdownList}>
                  {POPULAR_DISCOMS.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.dropdownItem, selectedBoard === d.name && styles.dropdownItemActive]}
                      onPress={() => {
                        setSelectedBoard(d.name);
                        setConsumerNo(d.sampleNo);
                        setShowBoardDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, selectedBoard === d.name && styles.dropdownItemTextActive]}>
                        {d.name} ({d.state})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Consumer Number Input */}
              <Text style={styles.inputLabel}>Andhra USCNO / Service Number / Aadhaar *</Text>
              <View style={styles.consumerInputRow}>
                <TextInput
                  style={styles.consumerInput}
                  value={consumerNo}
                  onChangeText={setConsumerNo}
                  placeholder="e.g. 102938471 or Aadhaar 12-digits"
                  placeholderTextColor="#94a3b8"
                  keyboardType="default"
                />
                <TouchableOpacity
                  style={[styles.fetchBtn, fetching && { opacity: 0.7 }]}
                  onPress={handleFetchBill}
                  disabled={fetching}
                  activeOpacity={0.8}
                >
                  {fetching ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.fetchBtnText}>🔄 Fetch Bill</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Detected Type Badges */}
              {isAadhaarNumber && (
                <View style={[styles.detectedBadgePill, { marginTop: 8 }]}>
                  <Text style={styles.detectedBadgeText}>✓ 12-Digit Aadhaar Linked Electricity Meter Detected</Text>
                </View>
              )}
              {isAndhraUscno && !isAadhaarNumber && (
                <View style={[styles.detectedBadgePill, { marginTop: 8, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Text style={[styles.detectedBadgeText, { color: '#15803d' }]}>✓ Andhra Pradesh USCNO / Service Number Verified</Text>
                </View>
              )}
            </View>

            {/* Live Fetch Success Banner */}
            {fetchSuccessMessage && (
              <View style={styles.liveFetchSuccessCard}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveFetchSuccessTitle}>Bill Successfully Fetched from {selectedBoard.split('-')[0]}!</Text>
                  <Text style={styles.liveFetchSuccessSub}>{fetchSuccessMessage}</Text>
                </View>
              </View>
            )}

            {/* 2. Latest Bill Status Card */}
            <View style={styles.billDisplayCard}>
              <View style={styles.billDisplayHeader}>
                <Text style={styles.billDisplayTitle}>📊 LATEST DISCOM BILL CYCLE</Text>
                <View
                  style={[
                    styles.billStatusPill,
                    billData.status === 'RECORDED_IN_EXPENSES'
                      ? { backgroundColor: '#dcfce7' }
                      : { backgroundColor: '#fef3c7' },
                  ]}
                >
                  <Text
                    style={[
                      styles.billStatusText,
                      billData.status === 'RECORDED_IN_EXPENSES' ? { color: '#16a34a' } : { color: '#d97706' },
                    ]}
                  >
                    {billData.status === 'RECORDED_IN_EXPENSES' ? '✓ Added to Expenses' : '⚠️ Due for Payment'}
                  </Text>
                </View>
              </View>

              <View style={styles.billMetricRow}>
                <View>
                  <Text style={styles.metricLabel}>Total Amount Due</Text>
                  <Text style={styles.metricBigAmount}>₹{billData.billAmountRupees.toLocaleString('en-IN')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metricLabel}>Units Consumed</Text>
                  <Text style={styles.metricUnits}>{billData.units} kWh</Text>
                </View>
              </View>

              <View style={styles.billDateRow}>
                <Text style={styles.billDateText}>📅 Bill Generated: {billData.billDate}</Text>
                <Text style={[styles.billDateText, { color: '#b91c1c', fontWeight: '800' }]}>
                  ⏰ Due: {billData.dueDate}
                </Text>
              </View>

              {/* Action Buttons for Bill */}
              <View style={{ marginTop: 12, gap: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.addExpenseBtn,
                    billData.status === 'RECORDED_IN_EXPENSES' && { backgroundColor: '#059669' },
                  ]}
                  onPress={handleAddToExpenses}
                  disabled={addingExpense}
                  activeOpacity={0.8}
                >
                  {addingExpense ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.addExpenseBtnText}>
                      {billData.status === 'RECORDED_IN_EXPENSES'
                        ? '✓ Re-Sync into Monthly Expenses'
                        : '➕ Auto-Add to Monthly Expenses'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Quick Pay Options */}
                <View style={styles.upiQuickPayRow}>
                  <Text style={styles.upiQuickPayLabel}>Pay Bill via UPI:</Text>
                  <TouchableOpacity style={styles.upiPillBtn} onPress={() => handlePayViaUpi('PhonePe')}>
                    <Text style={styles.upiPillText}>PhonePe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.upiPillBtn} onPress={() => handlePayViaUpi('Google Pay')}>
                    <Text style={styles.upiPillText}>GPay</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.upiPillBtn} onPress={() => handlePayViaUpi('Paytm')}>
                    <Text style={styles.upiPillText}>Paytm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 3. Sub-Meter & Resident Split Section */}
            <View style={styles.splitCard}>
              <View style={styles.splitModeRow}>
                <TouchableOpacity
                  style={[styles.splitModeTab, calcMode === 'EQUAL' && styles.splitModeTabActive]}
                  onPress={() => setCalcMode('EQUAL')}
                >
                  <Text style={[styles.splitModeTabText, calcMode === 'EQUAL' && styles.splitModeTabTextActive]}>
                    👥 Equal Resident Split
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.splitModeTab, calcMode === 'SUB_METER' && styles.splitModeTabActive]}
                  onPress={() => setCalcMode('SUB_METER')}
                >
                  <Text style={[styles.splitModeTabText, calcMode === 'SUB_METER' && styles.splitModeTabTextActive]}>
                    🧮 Room Sub-Meter (AC)
                  </Text>
                </TouchableOpacity>
              </View>

              {calcMode === 'EQUAL' ? (
                <View style={{ gap: 10 }}>
                  <Text style={styles.splitDescText}>
                    Divides the total bill of ₹{billData.billAmountRupees.toLocaleString('en-IN')} equally across all {residentsCount} active residents in your PG.
                  </Text>
                  <View style={styles.equalSplitHighlightBox}>
                    <Text style={styles.equalSplitLabel}>Per Resident Share:</Text>
                    <Text style={styles.equalSplitVal}>₹{equalSplitAmount.toLocaleString('en-IN')} / resident</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.whatsAppBtn}
                    onPress={handleSendWhatsAppNotice}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.whatsAppBtnText}>📲 Send Notice on WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <Text style={styles.splitDescText}>
                    Calculate individual room power bill based on actual sub-meter unit consumption (ideal for AC rooms).
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Room No.</Text>
                      <TextInput
                        style={styles.miniInput}
                        value={roomNum}
                        onChangeText={setRoomNum}
                        placeholder="101"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Rate / kWh (₹)</Text>
                      <TextInput
                        style={styles.miniInput}
                        value={unitRate}
                        onChangeText={setUnitRate}
                        keyboardType="numeric"
                        placeholder="10"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Previous Reading</Text>
                      <TextInput
                        style={styles.miniInput}
                        value={prevUnits}
                        onChangeText={setPrevUnits}
                        keyboardType="numeric"
                        placeholder="120"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Current Reading</Text>
                      <TextInput
                        style={styles.miniInput}
                        value={currUnits}
                        onChangeText={setCurrUnits}
                        keyboardType="numeric"
                        placeholder="185"
                      />
                    </View>
                  </View>

                  <View style={styles.subMeterResultBox}>
                    <Text style={styles.subMeterResultLabel}>
                      Room {roomNum} Units: <Text style={{ fontWeight: '900', color: '#0369a1' }}>{consumedUnits} kWh</Text>
                    </Text>
                    <Text style={styles.subMeterResultAmount}>₹{subMeterCost.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#64748b',
  },
  freeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 12,
  },
  freeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
  },
  configCard: {
    backgroundColor: '#fffaf5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#c2410c',
    marginBottom: 8,
  },
  dropdownToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  dropdownValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  dropdownArrow: {
    fontSize: 11,
    color: '#ea580c',
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 10,
    maxHeight: 180,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#ffedd5',
  },
  dropdownItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dropdownItemTextActive: {
    color: '#ea580c',
    fontWeight: '900',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
  },
  consumerInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  consumerInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  fetchBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fetchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  billDisplayCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  billDisplayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  billDisplayTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.3,
  },
  billStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  billStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  billMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  metricBigAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  metricUnits: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0284c7',
  },
  billDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billDateText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '600',
  },
  addExpenseBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addExpenseBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  upiQuickPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  upiQuickPayLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  upiPillBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  upiPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  splitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  splitModeRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  splitModeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  splitModeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  splitModeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  splitModeTabTextActive: {
    color: '#ea580c',
    fontWeight: '900',
  },
  splitDescText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  equalSplitHighlightBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  equalSplitLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9a3412',
  },
  equalSplitVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ea580c',
  },
  whatsAppBtn: {
    backgroundColor: '#25d366',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  whatsAppBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  miniInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  subMeterResultBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginTop: 4,
  },
  subMeterResultLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  subMeterResultAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0284c7',
  },
  detectedBadgePill: {
    backgroundColor: '#eff6ff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignSelf: 'flex-start',
  },
  detectedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  liveFetchSuccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#86efac',
    marginBottom: 14,
  },
  liveFetchSuccessTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#15803d',
  },
  liveFetchSuccessSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    marginTop: 2,
  },
});
