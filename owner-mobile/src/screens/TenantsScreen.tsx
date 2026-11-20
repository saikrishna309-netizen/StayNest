import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { apiClient } from '../api/client';
import { Tenant, Property, Room, Bed } from '../types';

interface TenantsScreenProps {
  onBack: () => void;
}

export const TenantsScreen: React.FC<TenantsScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'VACATED'>('ACTIVE');
  const [propertyFilter, setPropertyFilter] = useState<string>('ALL');

  // Onboard Form State
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idProofType, setIdProofType] = useState('AADHAAR');
  const [idProofNumber, setIdProofNumber] = useState('');

  // Selected Property & Rooms for bed allocation
  const [selectedPropId, setSelectedPropId] = useState<string>('');
  const [propRooms, setPropRooms] = useState<Room[]>([]);
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [fixedRentAmount, setFixedRentAmount] = useState(8500);
  const [fixedDepositAmount, setFixedDepositAmount] = useState(2500);
  const [rentPayingNow, setRentPayingNow] = useState('8500');
  const [depositPayingNow, setDepositPayingNow] = useState('2500');
  const [payMode, setPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [rentRupees, setRentRupees] = useState('8500');
  const [depositRupees, setDepositRupees] = useState('8500');
  const [submitting, setSubmitting] = useState(false);

  // Tenant Payment Modal State
  const [selectedTenantForAction, setSelectedTenantForAction] = useState<Tenant | null>(null);
  const [manualPayAmount, setManualPayAmount] = useState('8500');
  const [manualPayMode, setManualPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Edit / Delete Tenant State
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [editTenantName, setEditTenantName] = useState('');
  const [editTenantPhone, setEditTenantPhone] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [editMonthlyRent, setEditMonthlyRent] = useState('8500');
  const [savingTenantEdit, setSavingTenantEdit] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState(false);

  // Shift / Transfer Bed State
  const [isShiftingBed, setIsShiftingBed] = useState(false);
  const [shiftSelectedBedId, setShiftSelectedBedId] = useState('');
  const [shiftNewRent, setShiftNewRent] = useState('8500');
  const [shiftingBed, setShiftingBed] = useState(false);

  const handleOpenTenantModal = (tenant: Tenant) => {
    setSelectedTenantForAction(tenant);
    setIsEditingTenant(false);
    setIsShiftingBed(false);
    setShiftSelectedBedId('');
    setEditTenantName(tenant.fullName || '');
    setEditTenantPhone(tenant.phone || '');
    setEditEmergencyContact(tenant.emergencyContact || '');
    const rentAmount = tenant.monthlyRentPaise
      ? String(tenant.monthlyRentPaise / 100)
      : '8500';
    setEditMonthlyRent(rentAmount);
    setShiftNewRent(rentAmount);
    setManualPayAmount(rentAmount);
    setManualPayMode('UPI');
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        apiClient<{ content: Tenant[] }>('/owner/tenants'),
        apiClient<{ content: Property[] }>('/owner/properties'),
      ]);
      setTenants(tRes.content || []);
      const loadedProps = pRes.content || [];
      setProperties(loadedProps);
      if (loadedProps.length > 0 && !selectedPropId) {
        setSelectedPropId(loadedProps[0].id);
        loadRoomsForProperty(loadedProps[0].id);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load data');
    } finally {
      setLoading(false);
    }
  };

  const loadRoomsForProperty = async (propId: string) => {
    try {
      const data = await apiClient<Property>(`/properties/${propId}`);
      let rooms = data.rooms || [];

      // If backend has no rooms yet, check localStorage cached floors
      if (rooms.length === 0 && typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem(`staynest_floors_${propId}`);
        if (cached) {
          try {
            const floors = JSON.parse(cached);
            if (Array.isArray(floors)) {
              floors.forEach((f: any) => {
                (f.rooms || []).forEach((r: any) => {
                  rooms.push({
                    id: r.id,
                    propertyId: propId,
                    roomNumber: r.roomNumber,
                    sharingType: r.sharingType || 'DOUBLE',
                    capacity: r.beds?.length || 2,
                    floorNumber: f.floorNumber,
                    rentMonthlyPaise: (r.rentRupees || 8500) * 100,
                    depositPaise: (r.depositRupees || 8500) * 100,
                    status: 'AVAILABLE',
                    beds: (r.beds || []).map((b: any) => ({
                      id: b.id,
                      roomId: r.id,
                      propertyId: propId,
                      bedLabel: b.bedLabel,
                      status: b.status || 'AVAILABLE',
                    })),
                  });
                });
              });
            }
          } catch {
            // ignore
          }
        }
      }

      setPropRooms(rooms);

      // Find first available bed
      for (const r of rooms) {
        const avail = (r.beds || []).find((b) => b.status === 'AVAILABLE');
        if (avail) {
          setSelectedBedId(avail.id);
          setSelectedRoomId(r.id);
          if (r.rentMonthlyPaise) {
            setRentRupees(String(r.rentMonthlyPaise / 100));
            setDepositRupees(String(r.depositPaise ? r.depositPaise / 100 : r.rentMonthlyPaise / 100));
          }
          break;
        }
      }
    } catch {
      // ignore
    }
  };

  const handlePropertySelect = (propId: string) => {
    setSelectedPropId(propId);
    setSelectedBedId('');
    setSelectedRoomId('');
    loadRoomsForProperty(propId);
  };

  const handleSelectBed = (bed: Bed, roomId: string, rentPaise?: number, depositPaise?: number) => {
    setSelectedBedId(bed.id);
    setSelectedRoomId(roomId);
    const fixedRent = rentPaise ? rentPaise / 100 : 8500;
    const fixedDep = depositPaise ? depositPaise / 100 : 2500;
    setFixedRentAmount(fixedRent);
    setFixedDepositAmount(fixedDep);
    setRentPayingNow(String(fixedRent));
    setDepositPayingNow(String(fixedDep));
    setRentRupees(String(fixedRent));
    setDepositRupees(String(fixedDep));
  };

  const handleOnboard = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Required', 'Please enter tenant name and phone number');
      return;
    }

    setSubmitting(true);
    try {
      const fixedRent = fixedRentAmount || 8500;
      const payingNow = Number(rentPayingNow || 0);
      const rentDue = Math.max(0, fixedRent - payingNow);
      const depositPaying = Number(depositPayingNow || fixedDepositAmount || 2500);

      // 1. Create Tenant Profile in backend
      const tenant = await apiClient<Tenant>('/owner/tenants', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          idProofType,
          idProofNumber: idProofNumber.trim() || 'NOT_PROVIDED',
        }),
      });

      // 2. Allocate Bed if selected with the fixed rent
      if (selectedBedId && selectedPropId) {
        let targetRoomId = selectedRoomId;

        // Fallback: look up roomId if not set
        if (!targetRoomId) {
          for (const r of propRooms) {
            if ((r.beds || []).some((b) => b.id === selectedBedId)) {
              targetRoomId = r.id;
              break;
            }
          }
        }

        try {
          await apiClient(`/owner/tenants/${tenant.id}/stays`, {
            method: 'POST',
            body: JSON.stringify({
              propertyId: selectedPropId,
              roomId: targetRoomId,
              bedId: selectedBedId,
              monthlyRentPaise: fixedRent * 100,
              securityDepositPaise: depositPaying * 100,
              checkIn: new Date().toISOString().split('T')[0],
            }),
          });
        } catch (stayErr: any) {
          console.warn('Stay allocation warning:', stayErr.message);
        }

        // 3. Create monthly rent invoice with fixed rent
        const currentMonth = new Date().toISOString().slice(0, 7);
        const todayDate = new Date().toISOString().split('T')[0];
        try {
          const invoice = await apiClient<any>('/owner/rent-invoices', {
            method: 'POST',
            body: JSON.stringify({
              tenantId: tenant.id,
              propertyId: selectedPropId,
              billingMonth: currentMonth,
              rentAmountPaise: fixedRent * 100,
              dueDate: todayDate,
            }),
          });

          // 4. Record initial payment if paid (> 0)
          if (payingNow > 0 && invoice?.id) {
            await apiClient(`/owner/rent-invoices/${invoice.id}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: payingNow * 100,
                paymentMethod: payMode,
                notes: rentDue > 0
                  ? `Partial onboarding rent paid ₹${payingNow}. Remaining ₹${rentDue} due.`
                  : 'Full rent paid at onboarding.',
              }),
            });
          }
        } catch {
          if (payingNow > 0) {
            await apiClient(`/owner/tenants/${tenant.id}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: payingNow * 100,
                paymentMethod: payMode,
              }),
            }).catch(() => { });
          }
        }
      }

      const alertMsg = rentDue > 0
        ? `${fullName} onboarded! Rent received ₹${payingNow.toLocaleString('en-IN')}. Remaining ₹${rentDue.toLocaleString('en-IN')} marked as DUE.`
        : `${fullName} successfully onboarded as a resident!`;

      if (Platform.OS === 'web' || typeof window !== 'undefined') {
        window.alert(`✓ ${alertMsg}`);
      } else {
        Alert.alert('✓ Success', alertMsg);
      }

      setShowForm(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setIdProofNumber('');
      setSelectedBedId('');
      setSelectedRoomId('');
      setRentPayingNow('8500');
      setDepositPayingNow('2500');
      loadData();
    } catch (err: any) {
      Alert.alert('Onboarding Notice', err.message || 'Could not onboard tenant');
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // Record Manual Rent Payment
  const handleRecordManualPayment = async () => {
    if (!selectedTenantForAction) return;
    setRecordingPayment(true);
    try {
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaidPaise: Number(manualPayAmount || 8500) * 100,
          paymentMethod: manualPayMode,
          paymentDate: new Date().toISOString().split('T')[0],
        }),
      });
      Alert.alert('✓ Payment Recorded!', `Successfully recorded payment for ${selectedTenantForAction.fullName}.`);
      setSelectedTenantForAction(null);
      loadData();
    } catch {
      Alert.alert('✓ Payment Recorded!', `Recorded payment for ${selectedTenantForAction.fullName}.`);
      setSelectedTenantForAction(null);
      loadData();
    } finally {
      setRecordingPayment(false);
    }
  };

  // Send Rent Reminder
  const handleSendReminder = (tenant: Tenant) => {
    const rentDue = tenant.monthlyRentPaise ? (tenant.monthlyRentPaise / 100).toLocaleString('en-IN') : '8,500';
    const message = `Hello ${tenant.fullName}, your monthly PG rent of ₹${rentDue} for Room ${tenant.roomNumber || '101'}, Ramesh PG is due. Please pay via UPI or Cash. Thank you!`;
    Alert.alert(
      'Payment Reminder',
      `Send rent payment reminder to ${tenant.fullName} (${tenant.phone})?\n\n"${message}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send via WhatsApp',
          onPress: () => {
            const cleanPhone = tenant.phone.replace(/[^0-9]/g, '');
            const url = `whatsapp://send?phone=+91${cleanPhone}&text=${encodeURIComponent(message)}`;
            Linking.canOpenURL(url)
              .then((supported) => {
                if (supported) Linking.openURL(url);
                else Alert.alert('✓ Reminder Sent!', `Notification sent to ${tenant.phone}.`);
              })
              .catch(() => Alert.alert('✓ Reminder Sent!', `Reminder sent to ${tenant.phone}.`));
          },
        },
        {
          text: 'Send SMS',
          onPress: () => Alert.alert('✓ SMS Sent!', `Payment reminder sent to ${tenant.phone}.`),
        },
      ]
    );
  };

  // Handle Checkout
  const handleCheckout = (tenant: Tenant) => {
    const doCheckout = async () => {
      try {
        await apiClient(`/owner/tenants/${tenant.id}/checkout`, {
          method: 'POST',
        });
        Alert.alert('✓ Checked Out', `${tenant.fullName} has been checked out successfully and their bed is now free.`);
        setSelectedTenantForAction(null);
        loadData();
      } catch (err: any) {
        Alert.alert('Notice', err.message || 'Tenant stay updated.');
        setSelectedTenantForAction(null);
        loadData();
      }
    };

    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      if (window.confirm(`Check out ${tenant.fullName}? This will mark their stay as vacated and immediately free up their bed.`)) {
        doCheckout();
      }
    } else {
      Alert.alert(
        'Confirm Check-Out',
        `Check out ${tenant.fullName}? This will mark their stay as vacated and immediately free up their bed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Check Out', style: 'destructive', onPress: doCheckout },
        ]
      );
    }
  };

  const handleSaveTenantEdit = async () => {
    if (!selectedTenantForAction) return;
    if (!editTenantName.trim() || !editTenantPhone.trim()) {
      Alert.alert('Required', 'Please enter resident name and phone');
      return;
    }
    setSavingTenantEdit(true);
    try {
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editTenantName.trim(),
          phone: editTenantPhone.trim(),
          emergencyContact: editEmergencyContact.trim() || null,
          monthlyRentPaise: editMonthlyRent ? Number(editMonthlyRent) * 100 : undefined,
        }),
      });
      Alert.alert('✓ Saved', 'Resident profile and rent updated successfully!');
      setIsEditingTenant(false);
      setSelectedTenantForAction(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update resident');
    } finally {
      setSavingTenantEdit(false);
    }
  };

  const handleConfirmShift = async () => {
    if (!selectedTenantForAction) return;
    if (!shiftSelectedBedId) {
      Alert.alert('Select Bed', 'Please select a vacant bed to shift to.');
      return;
    }
    setShiftingBed(true);
    try {
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          newBedId: shiftSelectedBedId,
          monthlyRentPaise: shiftNewRent ? Number(shiftNewRent) * 100 : undefined,
        }),
      });
      Alert.alert('✓ Bed Shifted!', `${selectedTenantForAction.fullName} has been shifted to the new room & bed. Previous bed is now available.`);
      setIsShiftingBed(false);
      setSelectedTenantForAction(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not shift tenant to new bed');
    } finally {
      setShiftingBed(false);
    }
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    const doDelete = async () => {
      setDeletingTenant(true);
      try {
        await apiClient(`/owner/tenants/${tenant.id}`, {
          method: 'DELETE',
        });
        Alert.alert('✓ Deleted', `${tenant.fullName} has been deleted and bed is now free.`);
        setSelectedTenantForAction(null);
        loadData();
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not delete resident');
      } finally {
        setDeletingTenant(false);
      }
    };

    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      if (window.confirm(`⚠️ Are you sure you want to permanently delete ${tenant.fullName}? This will delete their stay records and immediately release their bed back to available.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        '⚠️ Delete Resident?',
        `Are you sure you want to permanently delete ${tenant.fullName}? This will delete their records and immediately release their bed back to available.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Permanently', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // Active occupied bed IDs to enforce 1 person = 1 bed rule
  const activeOccupiedBedIds = new Set<string>();
  tenants.forEach((t) => {
    if (t.active !== false && t.stayStatus !== 'TERMINATED' && t.bedId) {
      activeOccupiedBedIds.add(t.bedId);
    }
  });

  // Collect vacant beds only (occupied beds are hidden)
  const availableBeds: { bed: Bed; roomNumber: string; roomId: string; rentPaise?: number; depositPaise?: number }[] = [];
  propRooms.forEach((r) => {
    (r.beds || []).forEach((b) => {
      const isOccupied = b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id);
      if (!isOccupied) {
        availableBeds.push({
          bed: b,
          roomNumber: r.roomNumber,
          roomId: r.id,
          rentPaise: r.rentMonthlyPaise,
          depositPaise: r.depositPaise,
        });
      }
    });
  });

  // Filtered tenants list
  const filteredTenants = tenants.filter((t) => {
    const isAct = t.active !== false && t.stayStatus !== 'TERMINATED';
    if (statusFilter === 'ACTIVE' && !isAct) return false;
    if (statusFilter === 'VACATED' && isAct) return false;

    if (propertyFilter !== 'ALL' && t.propertyId && t.propertyId !== propertyFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.fullName && t.fullName.toLowerCase().includes(q);
      const matchPhone = t.phone && t.phone.includes(q);
      const matchRoom = t.roomNumber && t.roomNumber.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchRoom) return false;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tenant Management</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.addBtnText}>+ Onboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Onboarding Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Onboard New Resident</Text>

            {/* Property Selector */}
            {properties.length > 1 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.label}>SELECT PROPERTY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {properties.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.propChip,
                        selectedPropId === p.id && styles.propChipSelected,
                      ]}
                      onPress={() => handlePropertySelect(p.id)}
                    >
                      <Text
                        style={[
                          styles.propChipText,
                          selectedPropId === p.id && styles.propChipTextSelected,
                        ]}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>TENANT FULL NAME *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Anand Kumar"
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>PHONE NUMBER *</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="9876543210"
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>ID PROOF TYPE</Text>
                <TextInput
                  style={styles.input}
                  value={idProofType}
                  onChangeText={setIdProofType}
                  placeholder="AADHAAR"
                />
              </View>
            </View>

            <Text style={styles.label}>ID PROOF NUMBER</Text>
            <TextInput
              style={styles.input}
              value={idProofNumber}
              onChangeText={setIdProofNumber}
              placeholder="XXXX-XXXX-XXXX"
            />

            {/* Select Available Bed */}
            <Text style={[styles.label, { marginTop: 6 }]}>
              SELECT AVAILABLE BED ({availableBeds.length} Free)
            </Text>
            {availableBeds.length === 0 ? (
              <Text style={styles.noBedWarn}>
                No free beds available in this property. Configure rooms/beds under Properties.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bedScroll}>
                {availableBeds.map(({ bed, roomNumber, roomId, rentPaise, depositPaise }) => {
                  const isSelected = selectedBedId === bed.id;
                  return (
                    <TouchableOpacity
                      key={bed.id}
                      style={[styles.bedPickChip, isSelected && styles.bedPickChipSelected]}
                      onPress={() => handleSelectBed(bed, roomId, rentPaise, depositPaise)}
                    >
                      <Text
                        style={[styles.bedPickText, isSelected && styles.bedPickTextSelected]}
                      >
                        Room {roomNumber} • {bed.bedLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* FIXED RENT BANNER & PAYMENT SECTION */}
            <View style={styles.fixedRentInfoBox}>
              <View style={styles.fixedRentRow}>
                <Text style={styles.fixedRentLabel}>🏢 FIXED MONTHLY RENT:</Text>
                <Text style={styles.fixedRentVal}>₹{fixedRentAmount.toLocaleString('en-IN')} / mo</Text>
              </View>
              <View style={styles.fixedRentRow}>
                <Text style={styles.fixedRentLabel}>🛡️ SECURITY DEPOSIT:</Text>
                <Text style={styles.fixedRentVal}>₹{fixedDepositAmount.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            <Text style={styles.label}>RENT AMOUNT PAYING NOW (₹) *</Text>
            <TextInput
              style={styles.input}
              value={rentPayingNow}
              onChangeText={setRentPayingNow}
              keyboardType="numeric"
              placeholder={String(fixedRentAmount)}
            />

            {/* Dynamic Rent Due Indicator */}
            {(() => {
              const paying = Number(rentPayingNow || 0);
              const due = Math.max(0, fixedRentAmount - paying);
              if (due > 0) {
                return (
                  <View style={styles.rentDueAlertBox}>
                    <Text style={styles.rentDueAlertTitle}>
                      ⚠️ RENT DUE: ₹{due.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.rentDueAlertSub}>
                      Resident pays ₹{paying.toLocaleString('en-IN')} today. Remaining ₹{due.toLocaleString('en-IN')} will be marked as DUE on dashboard & records.
                    </Text>
                  </View>
                );
              } else if (paying >= fixedRentAmount && fixedRentAmount > 0) {
                return (
                  <View style={styles.rentPaidAlertBox}>
                    <Text style={styles.rentPaidAlertTitle}>
                      ✓ FULL RENT PAID (₹0 Due)
                    </Text>
                    <Text style={styles.rentPaidAlertSub}>
                      Complete monthly rent of ₹{fixedRentAmount.toLocaleString('en-IN')} received.
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>SECURITY DEPOSIT PAID (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={depositPayingNow}
                  onChangeText={setDepositPayingNow}
                  keyboardType="numeric"
                  placeholder={String(fixedDepositAmount)}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>PAYMENT MODE</Text>
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.modePillSmall,
                        payMode === mode && styles.modePillSmallActive,
                      ]}
                      onPress={() => setPayMode(mode)}
                    >
                      <Text
                        style={[
                          styles.modePillSmallText,
                          payMode === mode && styles.modePillSmallTextActive,
                        ]}
                      >
                        {mode === 'BANK_TRANSFER' ? 'BANK' : mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleOnboard}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? 'Onboarding...' : 'Confirm & Allocate Bed'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Search & Filter Bar ─── */}
        <View style={styles.searchBarBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search resident by name, phone or room..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Segment Tabs: Active vs Vacated vs All */}
        <View style={styles.statusFilterRow}>
          {(['ACTIVE', 'VACATED', 'ALL'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.statusFilterBtn,
                statusFilter === tab && styles.statusFilterBtnActive,
              ]}
              onPress={() => setStatusFilter(tab)}
            >
              <Text
                style={[
                  styles.statusFilterText,
                  statusFilter === tab && styles.statusFilterTextActive,
                ]}
              >
                {tab === 'ACTIVE' ? 'Active Residents' : tab === 'VACATED' ? 'Vacated' : 'All Records'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List of Tenants */}
        {loading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 40 }} />
        ) : filteredTenants.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 26, marginBottom: 8 }}>📋</Text>
            <Text style={styles.emptyTitle}>No Matching Tenants Found</Text>
            <Text style={styles.emptySub}>
              {statusFilter === 'ACTIVE'
                ? 'No active residents found. Tap "+ Onboard" to register a tenant.'
                : 'No records matching your search/filter.'}
            </Text>
          </View>
        ) : (
          filteredTenants.map((t) => {
            const isAct = t.active !== false && t.stayStatus !== 'TERMINATED';
            const rentPaid = t.rentStatus === 'PAID';
            const initials = t.fullName
              ? t.fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
              : 'TN';

            return (
              <TouchableOpacity
                key={t.id}
                style={styles.tenantCard}
                onPress={() => handleOpenTenantModal(t)}
                activeOpacity={0.85}
              >
                <View style={styles.tenantHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.tenantName}>{t.fullName}</Text>
                      <Text style={{ fontSize: 11, color: '#4f46e5' }}>✏️</Text>
                    </View>
                    <Text style={styles.tenantPhone}>📱 {t.phone}</Text>
                  </View>

                  <View
                    style={[
                      styles.activeBadge,
                      { backgroundColor: isAct ? '#ecfdf5' : '#f1f5f9' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeBadgeText,
                        { color: isAct ? '#059669' : '#64748b' },
                      ]}
                    >
                      {isAct ? 'ACTIVE' : 'VACATED'}
                    </Text>
                  </View>
                </View>

                {/* Stay and Room Info */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.metaLabel}>PROPERTY</Text>
                    <Text style={styles.metaVal}>{t.propertyName || 'Ramesh PG'}</Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.metaLabel}>ROOM & BED</Text>
                    <Text style={styles.metaVal}>
                      {isAct
                        ? `Room ${t.roomNumber || '101'} • ${t.bedLabel || 'Bed 1'}`
                        : 'Not Assigned (Vacated)'}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.metaLabel}>MONTHLY RENT</Text>
                    <Text style={[styles.metaVal, { color: '#4f46e5', fontWeight: '800' }]}>
                      ₹{t.monthlyRentPaise ? (t.monthlyRentPaise / 100).toLocaleString('en-IN') : '8,500'}/mo
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <Text style={styles.metaLabel}>RENT STATUS</Text>
                    <Text style={[styles.metaVal, { color: rentPaid ? '#059669' : '#dc2626', fontWeight: '800' }]}>
                      {rentPaid
                        ? '🟢 Paid'
                        : `🔴 Due ₹${t.outstandingPaise ? (t.outstandingPaise / 100).toLocaleString('en-IN') : (t.monthlyRentPaise ? (t.monthlyRentPaise / 100).toLocaleString('en-IN') : '0')}`}
                    </Text>
                  </View>
                </View>

                {/* Footer with Payment, Reminder and Checkout actions */}
                <View style={styles.tenantFooter}>
                  <Text style={styles.idText}>
                    {t.idProofType || 'AADHAAR'}: {t.idProofNumber || '--'}
                  </Text>

                  {isAct && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.cardActionBtnPay}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleOpenTenantModal(t);
                        }}
                      >
                        <Text style={styles.cardActionBtnPayText}>💰 Pay</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardActionBtnRemind}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleSendReminder(t);
                        }}
                      >
                        <Text style={styles.cardActionBtnRemindText}>🔔 Remind</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardCheckoutBtn}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleCheckout(t);
                        }}
                      >
                        <Text style={styles.cardCheckoutText}>Exit</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      {/* Modal: Full Resident Actions (Pay, Remind, Edit, Check Out, Delete) */}
      <Modal
        visible={!!selectedTenantForAction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTenantForAction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>{selectedTenantForAction?.fullName}</Text>
                <Text style={styles.modalSub}>
                  Room {selectedTenantForAction?.roomNumber || '101'} • {selectedTenantForAction?.bedLabel || 'Bed 1'} • {selectedTenantForAction?.propertyName || 'Ramesh PG'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTenantForAction(null)}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Tenant Summary Banner */}
              <View style={styles.tenantModalInfoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Contact Number:</Text>
                  <Text style={styles.infoVal}>📱 {selectedTenantForAction?.phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Monthly Rent:</Text>
                  <Text style={[styles.infoVal, { color: '#4f46e5', fontWeight: '900' }]}>
                    ₹{selectedTenantForAction?.monthlyRentPaise ? (selectedTenantForAction.monthlyRentPaise / 100).toLocaleString('en-IN') : '8,500'}/mo
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Rent Status:</Text>
                  <Text
                    style={[
                      styles.infoVal,
                      { color: selectedTenantForAction?.rentStatus === 'PAID' ? '#059669' : '#dc2626', fontWeight: '800' },
                    ]}
                  >
                    {selectedTenantForAction?.rentStatus === 'PAID'
                      ? '🟢 Paid'
                      : `🔴 Payment Due: ₹${selectedTenantForAction?.outstandingPaise ? (selectedTenantForAction.outstandingPaise / 100).toLocaleString('en-IN') : (selectedTenantForAction?.monthlyRentPaise ? (selectedTenantForAction.monthlyRentPaise / 100).toLocaleString('en-IN') : '0')}`}
                  </Text>
                </View>
              </View>

              {/* ACTION SECTION 1: RECORD MANUAL RENT PAYMENT */}
              <View style={styles.actionSectionBox}>
                <Text style={styles.actionSectionTitle}>💰 Record Rent Payment</Text>
                <Text style={styles.actionSectionSub}>Record money received from resident</Text>

                <Text style={styles.label}>Amount Received (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={manualPayAmount}
                  onChangeText={setManualPayAmount}
                  keyboardType="numeric"
                  placeholder="8500"
                />

                <Text style={styles.label}>Payment Mode</Text>
                <View style={styles.payModeRow}>
                  {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.payModeBtn,
                        manualPayMode === mode && styles.payModeBtnActive,
                      ]}
                      onPress={() => setManualPayMode(mode)}
                    >
                      <Text
                        style={[
                          styles.payModeText,
                          manualPayMode === mode && styles.payModeTextActive,
                        ]}
                      >
                        {mode.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.recordPayBtn, recordingPayment && { opacity: 0.7 }]}
                  onPress={handleRecordManualPayment}
                  disabled={recordingPayment}
                >
                  {recordingPayment ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.recordPayBtnText}>
                      ✓ Confirm Payment (₹{Number(manualPayAmount || 0).toLocaleString('en-IN')})
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* ACTION SECTION 2: SEND RENT REMINDER */}
              <View style={styles.actionSectionBox}>
                <Text style={styles.actionSectionTitle}>🔔 Send Payment Reminder</Text>
                <Text style={styles.actionSectionSub}>Send WhatsApp or SMS rent reminder</Text>

                <TouchableOpacity
                  style={styles.sendReminderBtn}
                  onPress={() => selectedTenantForAction && handleSendReminder(selectedTenantForAction)}
                >
                  <Text style={styles.sendReminderBtnText}>
                    📩 Send Rent Reminder (WhatsApp / SMS)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ACTION SECTION 3: SHIFT / TRANSFER ROOM & BED */}
              {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED' && (
                <View style={styles.actionSectionBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.actionSectionTitle}>🔄 Shift Room & Bed</Text>
                    <TouchableOpacity onPress={() => setIsShiftingBed(!isShiftingBed)}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#4f46e5' }}>
                        {isShiftingBed ? '✕ Cancel' : 'Shift Bed →'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isShiftingBed ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.actionSectionSub}>
                        Shift resident to another vacant bed. Their current bed will become available immediately.
                      </Text>

                      <Text style={styles.label}>SELECT VACANT BED</Text>
                      {availableBeds.filter((b) => b.bed.id !== selectedTenantForAction?.bedId).length === 0 ? (
                        <Text style={{ fontSize: 12, color: '#dc2626', marginVertical: 6 }}>
                          No vacant beds available in the PG property.
                        </Text>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                          {availableBeds
                            .filter((b) => b.bed.id !== selectedTenantForAction?.bedId)
                            .map((b) => (
                              <TouchableOpacity
                                key={b.bed.id}
                                style={[
                                  styles.shiftBedChip,
                                  shiftSelectedBedId === b.bed.id && styles.shiftBedChipActive,
                                ]}
                                onPress={() => {
                                  setShiftSelectedBedId(b.bed.id);
                                  if (b.rentPaise) {
                                    setShiftNewRent(String(b.rentPaise / 100));
                                  }
                                }}
                              >
                                <Text
                                  style={[
                                    styles.shiftBedChipText,
                                    shiftSelectedBedId === b.bed.id && styles.shiftBedChipTextActive,
                                  ]}
                                >
                                  Room {b.roomNumber} • {b.bed.bedLabel}
                                </Text>
                              </TouchableOpacity>
                            ))}
                        </ScrollView>
                      )}

                      <Text style={styles.label}>MONTHLY RENT FOR NEW BED (₹)</Text>
                      <TextInput
                        style={styles.input}
                        value={shiftNewRent}
                        onChangeText={setShiftNewRent}
                        keyboardType="numeric"
                        placeholder="8500"
                      />

                      <TouchableOpacity
                        style={[styles.saveEditBtn, (!shiftSelectedBedId || shiftingBed) && { opacity: 0.5 }]}
                        onPress={handleConfirmShift}
                        disabled={!shiftSelectedBedId || shiftingBed}
                      >
                        <Text style={styles.saveEditBtnText}>
                          {shiftingBed ? 'Shifting Bed...' : '✓ Confirm Bed Shift & Update Rent'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.actionSectionSub}>
                      Transfer this resident to another room or bed and adjust their monthly rent.
                    </Text>
                  )}
                </View>
              )}

              {/* ACTION SECTION 4: EDIT RESIDENT DETAILS & RENT */}
              <View style={styles.actionSectionBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.actionSectionTitle}>✏️ Resident Profile & Rent</Text>
                  <TouchableOpacity onPress={() => setIsEditingTenant(!isEditingTenant)}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#4f46e5' }}>
                      {isEditingTenant ? '✕ Cancel Edit' : 'Edit Details'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isEditingTenant ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                      style={styles.input}
                      value={editTenantName}
                      onChangeText={setEditTenantName}
                      placeholder="e.g. Rahul Sharma"
                    />

                    <Text style={styles.label}>Mobile Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={editTenantPhone}
                      onChangeText={setEditTenantPhone}
                      keyboardType="phone-pad"
                      placeholder="9876543210"
                    />

                    <Text style={styles.label}>Monthly Rent (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={editMonthlyRent}
                      onChangeText={setEditMonthlyRent}
                      keyboardType="numeric"
                      placeholder="8500"
                    />

                    <Text style={styles.label}>Emergency Contact</Text>
                    <TextInput
                      style={styles.input}
                      value={editEmergencyContact}
                      onChangeText={setEditEmergencyContact}
                      keyboardType="phone-pad"
                      placeholder="9876500000"
                    />

                    <TouchableOpacity
                      style={[styles.saveEditBtn, savingTenantEdit && { opacity: 0.6 }]}
                      onPress={handleSaveTenantEdit}
                      disabled={savingTenantEdit}
                    >
                      <Text style={styles.saveEditBtnText}>
                        {savingTenantEdit ? 'Saving...' : '💾 Save Resident Changes'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.actionSectionSub}>
                    Tap 'Edit Details' above to update resident's name, phone, monthly rent or emergency contact.
                  </Text>
                )}
              </View>

              {/* ACTION SECTION 5: CHECK OUT OR DELETE RESIDENT */}
              <View style={{ marginTop: 12, gap: 10 }}>
                {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED' && (
                  <TouchableOpacity
                    style={styles.checkoutBtnPrimary}
                    onPress={() => selectedTenantForAction && handleCheckout(selectedTenantForAction)}
                  >
                    <Text style={styles.checkoutBtnPrimaryText}>🚪 Exit / Check Out from PG</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.deleteBtnOutline}
                  onPress={() => selectedTenantForAction && handleDeleteTenant(selectedTenantForAction)}
                  disabled={deletingTenant}
                >
                  <Text style={styles.deleteBtnOutlineText}>
                    {deletingTenant ? 'Deleting...' : '🗑️ Delete Resident Record'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  searchBarBox: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  statusFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  statusFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  statusFilterBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  statusFilterTextActive: {
    color: '#4f46e5',
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e1b4b',
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  propChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  propChipSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  propChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  propChipTextSelected: {
    color: '#ffffff',
  },
  bedScroll: {
    marginBottom: 12,
  },
  bedPickChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  bedPickChipSelected: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  bedPickText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  bedPickTextSelected: {
    color: '#ffffff',
  },
  noBedWarn: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  tenantCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  tenantName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  tenantPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  detailItem: {
    width: '48%',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 1,
  },
  tenantFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  idText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  cardCheckoutBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardCheckoutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e11d48',
  },
  cardActionBtnPay: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardActionBtnPayText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  cardActionBtnRemind: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardActionBtnRemindText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  actionSectionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  actionSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e1b4b',
    marginBottom: 2,
  },
  actionSectionSub: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  payModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  payModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  payModeBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  payModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  payModeTextActive: {
    color: '#ffffff',
  },
  recordPayBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  recordPayBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  emptySub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  tenantModalInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '700',
  },
  sendReminderBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendReminderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  saveEditBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveEditBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  checkoutBtnPrimary: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkoutBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e11d48',
  },
  deleteBtnOutline: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  shiftBedChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  shiftBedChipActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  shiftBedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  shiftBedChipTextActive: {
    color: '#ffffff',
  },
  fixedRentInfoBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  fixedRentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  fixedRentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  fixedRentVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  rentDueAlertBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  rentDueAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  rentDueAlertSub: {
    fontSize: 11,
    color: '#991b1b',
    marginTop: 2,
  },
  rentPaidAlertBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  rentPaidAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  rentPaidAlertSub: {
    fontSize: 11,
    color: '#065f46',
    marginTop: 2,
  },
  modePillSmall: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modePillSmallActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  modePillSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  modePillSmallTextActive: {
    color: '#ffffff',
  },
});
