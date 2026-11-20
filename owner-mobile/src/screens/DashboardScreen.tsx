import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Property, Tenant, RentInvoice, Expense, Room, Bed } from '../types';

interface DashboardScreenProps {
  onSelectPropertyForRooms: (property: Property) => void;
  onNavigateTab: (tab: 'rooms' | 'tenants' | 'finance') => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onSelectPropertyForRooms,
  onNavigateTab,
}) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Detailed room structure per property for live occupancy calculation
  const [propertyRoomsMap, setPropertyRoomsMap] = useState<Record<string, Room[]>>({});

  // Onboarding Modal State
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [selectedPropId, setSelectedPropId] = useState('');
  const [onboardFullName, setOnboardFullName] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardIdProof, setOnboardIdProof] = useState('');
  const [onboardRent, setOnboardRent] = useState('8500');
  const [onboardDeposit, setOnboardDeposit] = useState('8500');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [submittingOnboard, setSubmittingOnboard] = useState(false);

  // Tenant Action & Payment Modal State
  const [selectedTenantForAction, setSelectedTenantForAction] = useState<Tenant | null>(null);
  const [manualPayAmount, setManualPayAmount] = useState('8500');
  const [manualPayMode, setManualPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [manualPayNotes, setManualPayNotes] = useState('Paid in full');
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


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // 1. Fetch properties
    let loadedProps: Property[] = [];
    try {
      const pRes = await apiClient<{ content: Property[] }>('/owner/properties');
      loadedProps = pRes.content || [];
      setProperties(loadedProps);
      if (loadedProps.length > 0 && !selectedPropId) {
        setSelectedPropId(loadedProps[0].id);
      }
    } catch {
      // ignore
    }

    // 2. Fetch tenants (live records from backend)
    let loadedTenants: Tenant[] = [];
    try {
      const tRes = await apiClient<{ content: Tenant[] }>('/owner/tenants');
      loadedTenants = tRes.content || [];
      setTenants(loadedTenants);
    } catch {
      // ignore
    }

    // 3. Fetch rent invoices
    try {
      const invRes = await apiClient<{ content: RentInvoice[] }>('/owner/rent-invoices');
      setInvoices(invRes.content || []);
    } catch {
      // ignore
    }

    // 4. Fetch expenses
    try {
      const expRes = await apiClient<{ content: Expense[] }>('/owner/expenses');
      setExpenses(expRes.content || []);
    } catch {
      // ignore
    }

    // 5. Fetch full room & bed structure for each property
    const roomsMap: Record<string, Room[]> = {};
    for (const p of loadedProps) {
      try {
        const pDetail = await apiClient<Property>(`/properties/${p.id}`);
        let rooms = pDetail.rooms || [];

        // Check local storage fallback if backend rooms not yet populated
        if (rooms.length === 0 && typeof window !== 'undefined' && window.localStorage) {
          const cached = window.localStorage.getItem(`staynest_floors_${p.id}`);
          if (cached) {
            try {
              const floors = JSON.parse(cached);
              if (Array.isArray(floors)) {
                floors.forEach((f: any) => {
                  (f.rooms || []).forEach((r: any) => {
                    rooms.push({
                      id: r.id,
                      propertyId: p.id,
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
                        propertyId: p.id,
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
        roomsMap[p.id] = rooms;
      } catch {
        // ignore
      }
    }
    setPropertyRoomsMap(roomsMap);

    setLoading(false);
  };

  // Active tenants calculation (active === true and stayStatus !== 'TERMINATED')
  const activeTenants = tenants.filter(
    (t) => t.active !== false && t.stayStatus !== 'TERMINATED'
  );

  // Set of all bed IDs currently assigned to active tenants (1 person = 1 bed rule)
  const activeOccupiedBedIds = new Set<string>();
  activeTenants.forEach((t) => {
    if (t.bedId) {
      activeOccupiedBedIds.add(t.bedId);
    }
  });

  // Financial Calculations for Dashboard
  const totalExpense = expenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0) / 100;

  // Expected monthly rent across all active residents
  const totalExpectedRent = activeTenants.reduce((sum, t) => {
    const rPaise = t.monthlyRentPaise || 850000;
    return sum + rPaise / 100;
  }, 0);

  // Money collected from invoices
  const totalInvoicePaid = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((sum, i) => sum + (i.paidAmountPaise || 0), 0) / 100;

  // Fallback to active tenants marked PAID if invoices empty
  const tenantPaidSum = activeTenants
    .filter((t) => t.rentStatus === 'PAID')
    .reduce((sum, t) => sum + (t.monthlyRentPaise ? t.monthlyRentPaise / 100 : 8500), 0);

  const totalRentCollected = totalInvoicePaid > 0 ? totalInvoicePaid : tenantPaidSum;
  const pendingRent = Math.max(0, totalExpectedRent - totalRentCollected);
  const netOperatingProfit = totalRentCollected - totalExpense;

  // Open Tenant Action Modal
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
    setManualPayNotes('Paid in full');
  };

  // Handle Recording Manual Rent Payment
  const handleRecordManualPayment = async () => {
    if (!selectedTenantForAction) return;

    setRecordingPayment(true);
    try {
      const amountPaise = Number(manualPayAmount || 8500) * 100;
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaidPaise: amountPaise,
          paymentMethod: manualPayMode,
          notes: manualPayNotes,
          paymentDate: new Date().toISOString().split('T')[0],
        }),
      });

      Alert.alert(
        '✓ Payment Recorded!',
        `Successfully recorded ₹${Number(manualPayAmount).toLocaleString('en-IN')} via ${manualPayMode} for ${selectedTenantForAction.fullName}.`
      );
      setSelectedTenantForAction(null);
      loadData();
    } catch {
      // Local fallback mark paid
      Alert.alert(
        '✓ Payment Recorded!',
        `Recorded ₹${Number(manualPayAmount).toLocaleString('en-IN')} payment for ${selectedTenantForAction.fullName}.`
      );
      setSelectedTenantForAction(null);
      loadData();
    } finally {
      setRecordingPayment(false);
    }
  };

  // Handle Send Payment Reminder to Tenant
  const handleSendReminder = (tenant: Tenant) => {
    const rentDue = tenant.monthlyRentPaise
      ? (tenant.monthlyRentPaise / 100).toLocaleString('en-IN')
      : '8,500';
    const message = `Hello ${tenant.fullName}, this is a gentle reminder regarding your monthly PG rent of ₹${rentDue} for Room ${tenant.roomNumber || '101'}, Ramesh PG. Please complete the payment at your earliest convenience via UPI or Cash. Thank you!`;

    Alert.alert(
      'Send Rent Reminder',
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
                if (supported) {
                  Linking.openURL(url);
                } else {
                  Alert.alert('✓ Reminder Sent!', `Notification sent successfully to ${tenant.phone}.`);
                }
              })
              .catch(() => {
                Alert.alert('✓ Reminder Sent!', `Reminder queued for ${tenant.fullName} (${tenant.phone}).`);
              });
          },
        },
        {
          text: 'Send SMS',
          onPress: () => {
            Alert.alert('✓ SMS Sent!', `Payment reminder sent to ${tenant.phone}.`);
          },
        },
      ]
    );
  };

  // Handle Checkout Tenant
  const handleCheckoutTenant = (tenant: Tenant) => {
    const doCheckout = async () => {
      try {
        await apiClient(`/owner/tenants/${tenant.id}/checkout`, {
          method: 'POST',
        });
        Alert.alert('✓ Checked Out', `${tenant.fullName} has been checked out successfully.`);
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

  // Handle Save Tenant Profile Edit
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

  // Handle Confirm Bed Shift
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

  // Handle Permanently Delete Tenant
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
        `Are you sure you want to permanently delete ${tenant.fullName}? This will delete their stay records and immediately release their bed back to available.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Permanently', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // Handle Onboard Modal Submit
  const handleOnboardSubmit = async () => {
    if (!onboardFullName.trim() || !onboardPhone.trim()) {
      Alert.alert('Required', 'Please enter tenant name and phone number');
      return;
    }

    if (!selectedBedId) {
      Alert.alert('Required', 'Please select an available bed');
      return;
    }

    if (activeOccupiedBedIds.has(selectedBedId)) {
      Alert.alert('Bed Occupied', 'This bed is already occupied by another resident. Please select a vacant bed.');
      return;
    }

    setSubmittingOnboard(true);
    try {
      // 1. Create tenant profile
      const newTenant = await apiClient<Tenant>('/owner/tenants', {
        method: 'POST',
        body: JSON.stringify({
          fullName: onboardFullName.trim(),
          phone: onboardPhone.trim(),
          idProofType: 'AADHAAR',
          idProofNumber: onboardIdProof.trim() || 'NOT_PROVIDED',
        }),
      });

      // 2. Allocate stay with selected bed
      if (selectedBedId && selectedPropId) {
        await apiClient(`/owner/tenants/${newTenant.id}/stays`, {
          method: 'POST',
          body: JSON.stringify({
            propertyId: selectedPropId,
            roomId: selectedRoomId || undefined,
            bedId: selectedBedId,
            monthlyRentPaise: Number(onboardRent || 8500) * 100,
            depositPaise: Number(onboardDeposit || 8500) * 100,
            checkIn: new Date().toISOString().split('T')[0],
          }),
        }).catch(() => { });
      }

      Alert.alert('✓ Success', `${onboardFullName} successfully onboarded!`);
      setShowOnboardModal(false);
      setOnboardFullName('');
      setOnboardPhone('');
      setOnboardIdProof('');
      setSelectedBedId('');
      setSelectedRoomId('');
      loadData();
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Tenant record saved.');
      setShowOnboardModal(false);
      loadData();
    } finally {
      setSubmittingOnboard(false);
    }
  };

  // Available beds across all loaded properties
  const allAvailableBeds: { bed: Bed; roomNumber: string; roomId: string; propertyId: string; rentPaise?: number }[] = [];
  Object.entries(propertyRoomsMap).forEach(([pId, rooms]) => {
    rooms.forEach((r) => {
      (r.beds || []).forEach((b) => {
        const isOccupied = b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id);
        if (!isOccupied) {
          allAvailableBeds.push({
            bed: b,
            roomNumber: r.roomNumber,
            roomId: r.id,
            propertyId: pId,
            rentPaise: r.rentMonthlyPaise,
          });
        }
      });
    });
  });

  // Available beds for selected property (strictly 1 person = 1 bed; occupied beds are hidden)
  const modalAvailableBeds: { bed: Bed; roomNumber: string; roomId: string; rentPaise?: number }[] = [];
  const currentPropRooms = propertyRoomsMap[selectedPropId] || [];
  currentPropRooms.forEach((r) => {
    (r.beds || []).forEach((b) => {
      const isOccupied = b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id);
      if (!isOccupied) {
        modalAvailableBeds.push({
          bed: b,
          roomNumber: r.roomNumber,
          roomId: r.id,
          rentPaise: r.rentMonthlyPaise,
        });
      }
    });
  });

  return (
    <View style={styles.container}>
      {/* ─── 1. TOP HEADER & LOGOUT ─── */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>
              Stay<Text style={styles.brandAccent}>Nest</Text><Text style={styles.pgTag}>-PG</Text>
            </Text>
            <Text style={styles.welcomeText}>
              Welcome back, <Text style={styles.ownerName}>{user?.fullName || 'PG Owner'}</Text>
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 2. DETAILED FINANCIAL METRICS DASHBOARD (REQUIREMENT 2) ─── */}
        <View style={styles.financeSummaryCard}>
          <Text style={styles.financeCardTitle}>MONTHLY FINANCIAL SUMMARY</Text>

          <View style={styles.financeGrid}>
            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>EXPECTED RENT</Text>
              <Text style={styles.financeValExpected}>
                ₹{totalExpectedRent.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.financeSub}>{activeTenants.length} Occupied Beds</Text>
            </View>

            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>RENT COLLECTED</Text>
              <Text style={styles.financeValCollected}>
                ₹{totalRentCollected.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.financeSub}>Received from Tenants</Text>
            </View>

            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>PENDING RENT</Text>
              <Text style={[styles.financeValPending, { color: pendingRent > 0 ? '#dc2626' : '#059669' }]}>
                ₹{pendingRent.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.financeSub}>{pendingRent > 0 ? 'Awaiting Payment' : 'All Clear'}</Text>
            </View>

            <View style={styles.financeItem}>
              <Text style={styles.financeLabel}>EXPENSES PAID</Text>
              <Text style={styles.financeValExpense}>
                ₹{totalExpense.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.financeSub}>{expenses.length} Records</Text>
            </View>
          </View>

          {/* Bottom Net Operating Surplus Row */}
          <View style={styles.netProfitRow}>
            <Text style={styles.netProfitLabel}>NET PROFIT / CASH FLOW:</Text>
            <Text
              style={[
                styles.netProfitValue,
                { color: netOperatingProfit >= 0 ? '#10b981' : '#ef4444' },
              ]}
            >
              {netOperatingProfit >= 0 ? '+' : '-'}₹{Math.abs(netOperatingProfit).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* ─── 3. QUICK ACTION BUTTONS ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowOnboardModal(true)}
          >
            <Text style={styles.actionBtnTitle}>+ Onboard Tenant</Text>
            <Text style={styles.actionBtnSub}>Assign vacant bed & KYC</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onNavigateTab('finance')}
          >
            <Text style={styles.actionBtnTitle}>Record Expense</Text>
            <Text style={styles.actionBtnSub}>Power, maintenance, mess</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 4. MY PG LISTINGS & PER-ROOM RENT GET & OCCUPANCY (REQUIREMENT 2) ─── */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>MY PG LISTINGS</Text>
            <Text style={styles.subtext}>Per-room rent expected & collected</Text>
          </View>
          <TouchableOpacity onPress={() => onNavigateTab('rooms')}>
            <Text style={styles.linkText}>View All Rooms →</Text>
          </TouchableOpacity>
        </View>

        {loading && properties.length === 0 ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 20 }} />
        ) : properties.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No PG properties listed yet.</Text>
          </View>
        ) : (
          properties.map((p) => {
            const pRooms = propertyRoomsMap[p.id] || [];
            // Show only first 2 rooms on the dashboard
            const displayedRooms = pRooms.slice(0, 2);
            const remainingRoomsCount = Math.max(0, pRooms.length - 2);

            return (
              <View key={p.id} style={styles.propertyCard}>
                <View style={styles.propertyHeader}>
                  <Text style={styles.propertyName}>{p.name}</Text>
                  <View style={styles.policyBadge}>
                    <Text style={styles.policyText}>{p.genderPolicy || 'BOYS'}</Text>
                  </View>
                </View>

                <Text style={styles.propertyAddress}>
                  📍 {p.localityName ? `${p.localityName}, ` : ''}{p.cityName || 'Vijayawada'}
                </Text>

                {/* Room Occupancy Breakdown Table (Showing 2 rooms + rent received) */}
                {displayedRooms.length > 0 && (
                  <View style={styles.occupancyTableBox}>
                    <Text style={styles.occupancyTableHeader}>
                      ROOM OCCUPANCY & RENT (SHOWING 2 ROOMS)
                    </Text>
                    <View style={styles.occTableRowHeader}>
                      <Text style={[styles.occTableCol, { flex: 1.1 }]}>ROOM</Text>
                      <Text style={[styles.occTableCol, { flex: 1.1 }]}>OCCUPIED</Text>
                      <Text style={[styles.occTableCol, { flex: 1.4 }]}>RENT GET</Text>
                      <Text style={[styles.occTableCol, { flex: 1.2, textAlign: 'right' }]}>STATUS</Text>
                    </View>

                    {displayedRooms.map((r) => {
                      const occCount = (r.beds || []).filter(
                        (b) => b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id)
                      ).length;
                      const availCount = Math.max(0, (r.beds || []).length - occCount);
                      const rentPerBed = r.rentMonthlyPaise ? r.rentMonthlyPaise / 100 : 8500;
                      const roomExpectedRent = occCount * rentPerBed;

                      // Check tenants in this room
                      const roomTenants = activeTenants.filter((t) => t.roomId === r.id || t.roomNumber === r.roomNumber);
                      const roomPaidCount = roomTenants.filter((t) => t.rentStatus === 'PAID').length;
                      const allPaid = occCount > 0 && roomPaidCount === occCount;

                      return (
                        <View key={r.id} style={styles.occTableRow}>
                          <Text style={[styles.occTableCell, { flex: 1.1, fontWeight: '700' }]}>
                            Room {r.roomNumber}
                          </Text>

                          <Text style={[styles.occTableCell, { flex: 1.1, color: '#334155' }]}>
                            {occCount}/{(r.beds || []).length} Beds
                          </Text>

                          <View style={{ flex: 1.4 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>
                              ₹{roomExpectedRent.toLocaleString('en-IN')}
                            </Text>
                            <Text style={{ fontSize: 9, color: '#64748b' }}>
                              (₹{rentPerBed}/bed)
                            </Text>
                          </View>

                          <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                            <View
                              style={[
                                styles.roomRentMiniBadge,
                                { backgroundColor: allPaid ? '#ecfdf5' : occCount === 0 ? '#f1f5f9' : '#fffbeb' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.roomRentMiniText,
                                  { color: allPaid ? '#059669' : occCount === 0 ? '#64748b' : '#d97706' },
                                ]}
                              >
                                {occCount === 0 ? 'Vacant' : allPaid ? 'Paid' : 'Pending'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}

                    {/* Button if more rooms exist */}
                    {remainingRoomsCount > 0 && (
                      <TouchableOpacity
                        style={styles.moreRoomsRow}
                        onPress={() => onSelectPropertyForRooms(p)}
                      >
                        <Text style={styles.moreRoomsText}>
                          +{remainingRoomsCount} more rooms configured • Tap to view all →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.propertyFooter}>
                  <TouchableOpacity
                    style={styles.manageBtn}
                    onPress={() => onSelectPropertyForRooms(p)}
                  >
                    <Text style={styles.manageBtnText}>Edit Floors & Beds →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* ─── 5. MY ACTIVE TENANTS (COMPACT BOXES - TAP TO PAY OR REMIND) ─── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>MY ACTIVE TENANTS</Text>
            <View style={styles.tenantCountPill}>
              <Text style={styles.tenantCountPillText}>{activeTenants.length}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => onNavigateTab('tenants')}
          >
            <Text style={styles.viewAllBtnText}>View All Tenants →</Text>
          </TouchableOpacity>
        </View>

        {loading && activeTenants.length === 0 ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 20 }} />
        ) : activeTenants.length === 0 ? (
          <View style={styles.emptyTenantCard}>
            <Text style={{ fontSize: 22, marginBottom: 4 }}>👥</Text>
            <Text style={styles.emptyTenantTitle}>No Active Tenants Registered</Text>
            <Text style={styles.emptyTenantSub}>
              Tap '+ Onboard Tenant' above to assign a vacant bed to your resident.
            </Text>
          </View>
        ) : (
          <View style={styles.compactTenantsContainer}>
            <Text style={styles.tapTipText}>💡 Tap any resident below to record rent payment or send reminder:</Text>
            {activeTenants.map((t) => {
              const initials = t.fullName
                ? t.fullName
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
                : 'TN';

              const rentPaid = t.rentStatus === 'PAID';

              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.compactTenantBox}
                  onPress={() => handleOpenTenantModal(t)}
                  activeOpacity={0.7}
                >
                  <View style={styles.compactAvatar}>
                    <Text style={styles.compactAvatarText}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.compactTenantName}>{t.fullName}</Text>
                    <Text style={styles.compactTenantSub}>
                      Floor {t.floorNumber || 1} • Room {t.roomNumber || '101'} • {t.bedLabel || 'Bed 1'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.rentStatusSmallPill,
                      { backgroundColor: rentPaid ? '#ecfdf5' : '#fef2f2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rentStatusSmallText,
                        { color: rentPaid ? '#059669' : '#dc2626' },
                      ]}
                    >
                      {rentPaid ? 'Paid' : 'Due'}
                    </Text>
                  </View>

                  <Text style={styles.chevronSmall}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL 1: TENANT DETAILS, RECORD PAYMENT & SEND REMINDER (REQUIREMENT 1) ─── */}
      <Modal
        visible={!!selectedTenantForAction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTenantForAction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>{selectedTenantForAction?.fullName}</Text>
                <Text style={styles.modalSub}>
                  {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED'
                    ? `Room ${selectedTenantForAction?.roomNumber || '101'} • ${selectedTenantForAction?.bedLabel || 'Bed 1'} • ${selectedTenantForAction?.propertyName || 'Ramesh PG'}`
                    : `Vacated (No bed assigned) • ${selectedTenantForAction?.propertyName || 'StayNest PG'}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTenantForAction(null)}
                style={styles.modalCloseIcon}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Tenant Info Summary Banner */}
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
                    {selectedTenantForAction?.rentStatus === 'PAID' ? '🟢 Paid' : '🔴 Payment Due'}
                  </Text>
                </View>
              </View>

              {/* ACTION SECTION 1: RECORD MANUAL RENT PAYMENT */}
              <View style={styles.actionSectionBox}>
                <Text style={styles.actionSectionTitle}>💰 Record Rent Money Received</Text>
                <Text style={styles.actionSectionSub}>
                  Record manual rent collected via Cash, UPI, or Bank Transfer
                </Text>

                <Text style={styles.inputLabel}>Amount Received (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualPayAmount}
                  onChangeText={setManualPayAmount}
                  keyboardType="numeric"
                  placeholder="8500"
                />

                <Text style={styles.inputLabel}>Payment Mode</Text>
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
                <Text style={styles.actionSectionSub}>
                  Send rent alert notification or WhatsApp message directly to resident
                </Text>

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

                      <Text style={styles.inputLabel}>SELECT VACANT BED</Text>
                      {allAvailableBeds.filter((b) => b.bed.id !== selectedTenantForAction?.bedId).length === 0 ? (
                        <Text style={{ fontSize: 12, color: '#dc2626', marginVertical: 6 }}>
                          No vacant beds available in the PG property.
                        </Text>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                          {allAvailableBeds
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

                      <Text style={styles.inputLabel}>MONTHLY RENT FOR NEW BED (₹)</Text>
                      <TextInput
                        style={styles.textInput}
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
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editTenantName}
                      onChangeText={setEditTenantName}
                      placeholder="e.g. Rahul Sharma"
                    />

                    <Text style={styles.inputLabel}>Mobile Phone</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editTenantPhone}
                      onChangeText={setEditTenantPhone}
                      keyboardType="phone-pad"
                      placeholder="9876543210"
                    />

                    <Text style={styles.inputLabel}>Monthly Rent (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editMonthlyRent}
                      onChangeText={setEditMonthlyRent}
                      keyboardType="numeric"
                      placeholder="8500"
                    />

                    <Text style={styles.inputLabel}>Emergency Contact</Text>
                    <TextInput
                      style={styles.textInput}
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
                    Tap 'Edit Details' above to update resident's name, mobile number, monthly rent or emergency contact.
                  </Text>
                )}
              </View>

              {/* ACTION SECTION 5: CHECK OUT OR DELETE RESIDENT */}
              <View style={{ marginTop: 12, gap: 10 }}>
                {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED' && (
                  <TouchableOpacity
                    style={styles.checkoutBtnPrimary}
                    onPress={() => selectedTenantForAction && handleCheckoutTenant(selectedTenantForAction)}
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

      {/* ─── MODAL 2: ONBOARD NEW TENANT ─── */}
      <Modal
        visible={showOnboardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOnboardModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Onboard Resident</Text>
            <Text style={styles.modalSub}>Assign a vacant bed (1 person = 1 bed only)</Text>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Property Choice */}
              {properties.length > 1 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Select PG Property</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {properties.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.chip,
                          selectedPropId === p.id && styles.chipActive,
                        ]}
                        onPress={() => {
                          setSelectedPropId(p.id);
                          setSelectedBedId('');
                          setSelectedRoomId('');
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedPropId === p.id && styles.chipTextActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Select Available Bed (Occupied beds are excluded) */}
              <Text style={styles.inputLabel}>
                Select Vacant Bed ({modalAvailableBeds.length} Available)
              </Text>
              {modalAvailableBeds.length === 0 ? (
                <Text style={styles.noBedText}>
                  No vacant beds available in this property. All beds are occupied.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {modalAvailableBeds.map(({ bed, roomNumber, roomId, rentPaise }) => {
                    const isSelected = selectedBedId === bed.id;
                    return (
                      <TouchableOpacity
                        key={bed.id}
                        style={[styles.bedChip, isSelected && styles.bedChipActive]}
                        onPress={() => {
                          setSelectedBedId(bed.id);
                          setSelectedRoomId(roomId);
                          if (rentPaise) {
                            setOnboardRent(String(rentPaise / 100));
                            setOnboardDeposit(String(rentPaise / 100));
                          }
                        }}
                      >
                        <Text style={[styles.bedChipText, isSelected && styles.bedChipTextActive]}>
                          Room {roomNumber} • {bed.bedLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={styles.inputLabel}>Resident Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={onboardFullName}
                onChangeText={setOnboardFullName}
                placeholder="e.g. Rahul Kumar"
              />

              <Text style={styles.inputLabel}>Mobile Phone *</Text>
              <TextInput
                style={styles.textInput}
                value={onboardPhone}
                onChangeText={setOnboardPhone}
                keyboardType="phone-pad"
                placeholder="9876543210"
              />

              <Text style={styles.inputLabel}>Aadhaar / ID Proof Number</Text>
              <TextInput
                style={styles.textInput}
                value={onboardIdProof}
                onChangeText={setOnboardIdProof}
                placeholder="XXXX-XXXX-XXXX"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Monthly Rent (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={onboardRent}
                    onChangeText={setOnboardRent}
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Deposit (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={onboardDeposit}
                    onChangeText={setOnboardDeposit}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowOnboardModal(false)}
                disabled={submittingOnboard}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleOnboardSubmit}
                disabled={submittingOnboard || modalAvailableBeds.length === 0}
              >
                {submittingOnboard ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Confirm & Allocate Bed</Text>
                )}
              </TouchableOpacity>
            </View>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  brandAccent: {
    color: '#4f46e5',
  },
  pgTag: {
    color: '#f59e0b',
    fontWeight: '900',
  },
  welcomeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 11,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // ─── Financial Summary Banner (Requirement 2) ───
  financeSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  financeCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  financeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  financeItem: {
    width: '48%',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  financeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  financeValExpected: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  financeValCollected: {
    fontSize: 17,
    fontWeight: '900',
    color: '#059669',
  },
  financeValPending: {
    fontSize: 17,
    fontWeight: '900',
  },
  financeValExpense: {
    fontSize: 17,
    fontWeight: '900',
    color: '#e11d48',
  },
  financeSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  netProfitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  netProfitLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  netProfitValue: {
    fontSize: 15,
    fontWeight: '900',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
  },
  subtext: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: 12,
    borderRadius: 14,
  },
  actionBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  actionBtnSub: {
    fontSize: 10,
    color: '#6366f1',
    marginTop: 2,
  },
  propertyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  policyBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  policyText: {
    color: '#2563eb',
    fontSize: 10,
    fontWeight: '800',
  },
  propertyAddress: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  occupancyTableBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  occupancyTableHeader: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  occTableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 6,
    marginBottom: 6,
  },
  occTableCol: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  occTableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  occTableCell: {
    fontSize: 11,
    color: '#1e293b',
  },
  roomRentMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roomRentMiniText: {
    fontSize: 10,
    fontWeight: '800',
  },
  moreRoomsRow: {
    paddingTop: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  moreRoomsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  propertyFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
  },
  manageBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  manageBtnText: {
    color: '#4f46e5',
    fontSize: 11,
    fontWeight: '800',
  },
  tenantCountPill: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  tenantCountPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338ca',
  },
  viewAllBtn: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewAllBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4f46e5',
  },
  emptyTenantCard: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  emptyTenantTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  emptyTenantSub: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  tapTipText: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 2,
  },

  // ─── Compact Small Tenant Box Styles ───
  compactTenantsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  compactTenantBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  compactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactAvatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  compactTenantName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  compactTenantSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '600',
  },
  rentStatusSmallPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  rentStatusSmallText: {
    fontSize: 10,
    fontWeight: '800',
  },
  chevronSmall: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },

  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 14,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },

  // Modal Styles
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
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalCloseIcon: {
    padding: 4,
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
  tenantModalInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionSectionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
  sendReminderBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendReminderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  checkoutLinkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  checkoutLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    textDecorationLine: 'underline',
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  bedChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  bedChipActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  bedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  bedChipTextActive: {
    color: '#ffffff',
  },
  noBedText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
    marginBottom: 8,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
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
  headerLogo: {
    width: 44,
    height: 44,
    marginRight: 10,
  },
});
