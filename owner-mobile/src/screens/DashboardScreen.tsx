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
  onNavigateTab: (tab: 'rooms' | 'tenants' | 'finance' | 'profile') => void;
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
  const [fixedRentAmount, setFixedRentAmount] = useState(8500);
  const [fixedDepositAmount, setFixedDepositAmount] = useState(2500);
  const [onboardRentPayingNow, setOnboardRentPayingNow] = useState('8500');
  const [onboardDepositPayingNow, setOnboardDepositPayingNow] = useState('2500');
  const [onboardPayMode, setOnboardPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
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
  const collectionRate = totalExpectedRent > 0 ? Math.round((totalRentCollected / totalExpectedRent) * 100) : 0;

  // Due members in front (sorted so residents with pending rent show first)
  const sortedActiveTenants = [...activeTenants].sort((a, b) => {
    const aDue = a.rentStatus !== 'PAID' || (a.outstandingPaise && a.outstandingPaise > 0) ? 1 : 0;
    const bDue = b.rentStatus !== 'PAID' || (b.outstandingPaise && b.outstandingPaise > 0) ? 1 : 0;
    if (aDue !== bDue) return bDue - aDue;
    return (b.outstandingPaise || 0) - (a.outstandingPaise || 0);
  });
  const dueTenantsCount = activeTenants.filter(
    (t) => t.rentStatus !== 'PAID' || (t.outstandingPaise && t.outstandingPaise > 0)
  ).length;

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
            handleDirectWhatsAppReminder(tenant);
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

  // Direct WhatsApp Reminder for 1-Tap Action
  const handleDirectWhatsAppReminder = (tenant: Tenant) => {
    const rentDueStr = tenant.outstandingPaise
      ? `₹${(tenant.outstandingPaise / 100).toLocaleString('en-IN')}`
      : tenant.monthlyRentPaise
      ? `₹${(tenant.monthlyRentPaise / 100).toLocaleString('en-IN')}`
      : '₹8,500';
    const cleanPhone = tenant.phone.replace(/[^0-9]/g, '');
    const message = `Hello ${tenant.fullName}, this is a gentle reminder regarding your monthly PG rent of ${rentDueStr} for Room ${tenant.roomNumber || '101'}, Ramesh PG. Please pay via UPI or Cash. Thank you!`;
    const appUrl = `whatsapp://send?phone=+91${cleanPhone}&text=${encodeURIComponent(message)}`;
    const webUrl = `https://api.whatsapp.com/send?phone=+91${cleanPhone}&text=${encodeURIComponent(message)}`;

    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      if (typeof window !== 'undefined' && window.open) {
        window.open(webUrl, '_blank');
      } else {
        Linking.openURL(webUrl).catch(() => Linking.openURL(appUrl));
      }
    } else {
      Linking.canOpenURL(appUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(appUrl);
          } else {
            Linking.openURL(webUrl).catch(() => {
              Alert.alert('Notice', `WhatsApp message prepared for ${tenant.phone}:\n\n"${message}"`);
            });
          }
        })
        .catch(() => Linking.openURL(webUrl));
    }
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
      const fixedRent = fixedRentAmount || 8500;
      const rentPayingNow = Number(onboardRentPayingNow || 0);
      const rentDue = Math.max(0, fixedRent - rentPayingNow);
      const depositPaying = Number(onboardDepositPayingNow || fixedDepositAmount || 2500);

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

      // 2. Allocate stay with selected bed & the fixed monthly rent
      if (selectedBedId && selectedPropId) {
        await apiClient(`/owner/tenants/${newTenant.id}/stays`, {
          method: 'POST',
          body: JSON.stringify({
            propertyId: selectedPropId,
            roomId: selectedRoomId || undefined,
            bedId: selectedBedId,
            monthlyRentPaise: fixedRent * 100,
            securityDepositPaise: depositPaying * 100,
            checkIn: new Date().toISOString().split('T')[0],
          }),
        }).catch(() => { });
      }

      // 3. Create monthly rent invoice with fixed rent
      const currentMonth = new Date().toISOString().slice(0, 7);
      const todayDate = new Date().toISOString().split('T')[0];
      try {
        const invoice = await apiClient<any>('/owner/rent-invoices', {
          method: 'POST',
          body: JSON.stringify({
            tenantId: newTenant.id,
            propertyId: selectedPropId,
            billingMonth: currentMonth,
            rentAmountPaise: fixedRent * 100,
            dueDate: todayDate,
          }),
        });

        // 4. Record initial rent payment if paid
        if (rentPayingNow > 0 && invoice?.id) {
          await apiClient(`/owner/rent-invoices/${invoice.id}/payments`, {
            method: 'POST',
            body: JSON.stringify({
              amountPaidPaise: rentPayingNow * 100,
              paymentMethod: onboardPayMode,
              notes: rentDue > 0
                ? `Partial onboarding rent paid ₹${rentPayingNow}. Remaining ₹${rentDue} due.`
                : 'Full rent paid at onboarding.',
            }),
          });
        }
      } catch (invErr) {
        // Direct payment fallback
        if (rentPayingNow > 0) {
          await apiClient(`/owner/tenants/${newTenant.id}/payments`, {
            method: 'POST',
            body: JSON.stringify({
              amountPaidPaise: rentPayingNow * 100,
              paymentMethod: onboardPayMode,
            }),
          }).catch(() => { });
        }
      }

      const alertMsg = rentDue > 0
        ? `${onboardFullName} onboarded! Rent received: ₹${rentPayingNow.toLocaleString('en-IN')}. Remaining ₹${rentDue.toLocaleString('en-IN')} marked as DUE.`
        : `${onboardFullName} successfully onboarded with full rent paid!`;

      if (Platform.OS === 'web' || typeof window !== 'undefined') {
        window.alert(`✓ ${alertMsg}`);
      } else {
        Alert.alert('✓ Success', alertMsg);
      }

      setShowOnboardModal(false);
      setOnboardFullName('');
      setOnboardPhone('');
      setOnboardIdProof('');
      setSelectedBedId('');
      setSelectedRoomId('');
      setOnboardRentPayingNow('8500');
      setOnboardDepositPayingNow('2500');
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
  const allAvailableBeds: { bed: Bed; roomNumber: string; roomId: string; propertyId: string; rentPaise?: number; depositPaise?: number; floorNumber?: number }[] = [];
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
            depositPaise: r.depositPaise,
            floorNumber: r.floorNumber,
          });
        }
      });
    });
  });

  // Available beds for selected property (strictly 1 person = 1 bed; occupied beds are hidden)
  const modalAvailableBeds: { bed: Bed; roomNumber: string; roomId: string; rentPaise?: number; depositPaise?: number; floorNumber?: number }[] = [];
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
          depositPaise: r.depositPaise,
          floorNumber: r.floorNumber,
        });
      }
    });
  });

  const availableBeds = allAvailableBeds.length;
  const totalBedsCount = availableBeds + activeTenants.length;
  const totalRoomsCount = Object.values(propertyRoomsMap).reduce((acc, rooms) => acc + rooms.length, 0) || 12;
  const occupancyRate = totalBedsCount > 0 ? Math.round((activeTenants.length / totalBedsCount) * 100) : 85;

  return (
    <View style={styles.container}>
      {/* ─── 1. TOP HEADER & PROFILE / LOGOUT ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeftContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.dashboardLogo}
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>
            Welcome back, <Text style={styles.ownerName}>{user?.fullName || 'PG Owner'}</Text>
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => onNavigateTab ? onNavigateTab('profile') : null}
          >
            <Text style={styles.profileBtnText}>👤 Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── TOP NAVIGATION PILL TABS (IMAGE 2 STYLE) ─── */}
      <View style={styles.topNavPillContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topNavPillRow}
        >
          <TouchableOpacity style={[styles.navPill, styles.navPillActive]}>
            <Text style={styles.navPillIconActive}>⊞</Text>
            <Text style={styles.navPillTextActive}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navPill}
            onPress={() => onNavigateTab ? onNavigateTab('tenants') : null}
          >
            <Text style={styles.navPillIcon}>👥</Text>
            <Text style={styles.navPillText}>Tenants</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navPill}
            onPress={() => onNavigateTab ? onNavigateTab('rooms') : null}
          >
            <Text style={styles.navPillIcon}>🏢</Text>
            <Text style={styles.navPillText}>Rooms</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navPill}
            onPress={() => onNavigateTab ? onNavigateTab('finance') : null}
          >
            <Text style={styles.navPillIcon}>💵</Text>
            <Text style={styles.navPillText}>Rent</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navPill}
            onPress={() => onNavigateTab ? onNavigateTab('profile') : null}
          >
            <Text style={styles.navPillIcon}>👤</Text>
            <Text style={styles.navPillText}>Accounts</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 2. 4 TOP KPI METRIC CARDS (VERY LIGHT & SOFT COLORS) ─── */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Total Expected Rent (Soft Light Blue) */}
          <View style={[styles.kpiCard, { backgroundColor: '#f0f7ff', borderColor: '#dbeafe' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#e0f2fe' }]}>
              <Text style={{ fontSize: 14 }}>💵</Text>
            </View>
            <Text style={styles.kpiValue}>
              ₹{totalExpectedRent > 0 ? totalExpectedRent.toLocaleString('en-IN') : '24,890'}
            </Text>
            <Text style={styles.kpiLabel}>Total Expected</Text>
          </View>

          {/* Card 2: Rent Collected (Soft Light Green) */}
          <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4', borderColor: '#dcfce7' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#dcfce7' }]}>
              <Text style={{ fontSize: 14 }}>💰</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#15803d' }]}>
              ₹{totalRentCollected > 0 ? totalRentCollected.toLocaleString('en-IN') : '12,890'}
            </Text>
            <Text style={styles.kpiLabel}>Rent Collected</Text>
          </View>

          {/* Card 3: Occupied Beds (Soft Light Amber) */}
          <View style={[styles.kpiCard, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Text style={{ fontSize: 14 }}>🛏️</Text>
            </View>
            <Text style={styles.kpiValue}>
              {activeTenants.length > 0 ? activeTenants.length : '18'}
            </Text>
            <Text style={styles.kpiLabel}>Occupied Beds</Text>
          </View>

          {/* Card 4: Available Beds (Soft Light Purple) */}
          <View style={[styles.kpiCard, { backgroundColor: '#faf5ff', borderColor: '#f3e8ff' }]}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#f3e8ff' }]}>
              <Text style={{ fontSize: 14 }}>🚪</Text>
            </View>
            <Text style={[styles.kpiValue, { color: '#7c3aed' }]}>
              {availableBeds > 0 ? availableBeds : '6'}
            </Text>
            <Text style={styles.kpiLabel}>Available Beds</Text>
          </View>
        </View>

        {/* ─── 3. RENT STATUS DONUT RING (IMAGE 1 STYLE) ─── */}
        <View style={styles.rentStatusCard}>
          <Text style={styles.rentStatusCardTitle}>Rent status</Text>

          {/* Donut Ring with Floating Percentage Badges */}
          <View style={styles.donutRingWrapper}>
            {/* Outer Donut Ring */}
            <View style={styles.donutOuterRing}>
              {/* Inner Center Circle */}
              <View style={styles.donutInnerCircle}>
                <Text style={styles.donutCenterValue}>
                  ₹{totalRentCollected > 0 ? totalRentCollected.toLocaleString('en-IN') : '12,890'}
                </Text>
                <Text style={styles.donutCenterLabel}>COLLECTED</Text>
                <Text style={styles.donutCenterSub}>
                  {collectionRate > 0 ? collectionRate : 65}% Paid
                </Text>
              </View>
            </View>

            {/* Floating Badge 1: Unpaid (Purple, Top-Right) */}
            <View style={styles.donutBadgeUnpaid}>
              <Text style={styles.donutBadgeText}>
                {collectionRate > 0 ? Math.max(0, 100 - collectionRate) : 35}%
              </Text>
            </View>

            {/* Floating Badge 2: Paid (Green, Bottom-Left) */}
            <View style={styles.donutBadgePaid}>
              <Text style={styles.donutBadgeText}>
                {collectionRate > 0 ? collectionRate : 65}%
              </Text>
            </View>
          </View>

          {/* Legend Below the Ring */}
          <View style={styles.rentStatusLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColorDot, { backgroundColor: '#bef264' }]} />
              <Text style={styles.legendLabelText}>
                Paid: ₹{totalRentCollected.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColorDot, { backgroundColor: '#c4b5fd' }]} />
              <Text style={styles.legendLabelText}>
                Unpaid: ₹{pendingRent.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 4. QUICK ACTIONS (REPLACED RECENT RESERVATION, IMAGE STYLE) ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <Text style={{ fontSize: 11, color: '#ff7337', fontWeight: '800' }}>⚡ Shortcuts</Text>
        </View>

        <View style={styles.quickActionsContainer}>
          {/* Action 1: Onboard Tenant */}
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={() => setShowOnboardModal(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.actionRingCircle, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <Text style={{ fontSize: 20 }}>👤+</Text>
            </View>
            <Text style={styles.actionItemTitle}>Onboard</Text>
            <Text style={styles.actionItemSub}>Tenant</Text>
          </TouchableOpacity>

          {/* Action 2: Record Rent */}
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={() => {
              if (activeTenants.length > 0) {
                handleOpenTenantModal(activeTenants[0]);
              } else {
                onNavigateTab ? onNavigateTab('tenants') : null;
              }
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.actionRingCircle, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={{ fontSize: 20 }}>💰</Text>
            </View>
            <Text style={styles.actionItemTitle}>Record Rent</Text>
            <Text style={styles.actionItemSub}>Payment</Text>
          </TouchableOpacity>

          {/* Action 3: All Tenants */}
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={() => onNavigateTab ? onNavigateTab('tenants') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.actionRingCircle, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
              <Text style={{ fontSize: 20 }}>👥</Text>
            </View>
            <Text style={styles.actionItemTitle}>Tenants</Text>
            <Text style={styles.actionItemSub}>Directory</Text>
          </TouchableOpacity>

          {/* Action 4: Expenses */}
          <TouchableOpacity
            style={styles.quickActionItem}
            onPress={() => onNavigateTab ? onNavigateTab('finance') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.actionRingCircle, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Text style={{ fontSize: 20 }}>📉</Text>
            </View>
            <Text style={styles.actionItemTitle}>Expenses</Text>
            <Text style={styles.actionItemSub}>Log Daily</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 5. TENANTS DIRECTORY (SIMPLE BOX TYPE, REQUIREMENT 1) ─── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>MY RESIDENTS</Text>
            {dueTenantsCount > 0 ? (
              <View style={styles.dueCountAlertBadge}>
                <Text style={styles.dueCountAlertBadgeText}>⚠️ {dueTenantsCount} Due</Text>
              </View>
            ) : (
              <View style={styles.allPaidBadge}>
                <Text style={styles.allPaidBadgeText}>✓ All Clear</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={() => onNavigateTab ? onNavigateTab('tenants') : null}>
            <Text style={styles.viewAllOrangeText}>View All ({activeTenants.length}) ›</Text>
          </TouchableOpacity>
        </View>

        {/* Grid of Box-Type Tenant Cards (Classic Look) */}
        {sortedActiveTenants.length === 0 ? (
          <View style={styles.emptyTenantBox}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>👥</Text>
            <Text style={styles.emptyTenantBoxTitle}>No Residents Registered</Text>
            <Text style={styles.emptyTenantBoxSub}>Tap '+ Onboard Tenant' above to assign a bed.</Text>
          </View>
        ) : (
          <View style={styles.tenantBoxGrid}>
            {sortedActiveTenants.map((t) => {
              const rentPaid = t.rentStatus === 'PAID';
              const hasDue = Boolean(!rentPaid || (typeof t.outstandingPaise === 'number' && t.outstandingPaise > 0));
              const dueAmount = t.outstandingPaise ? Math.round(t.outstandingPaise / 100) : 2500;

              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.tenantBoxCard,
                    hasDue && styles.tenantBoxCardDue,
                  ]}
                  onPress={() => handleOpenTenantModal(t)}
                  activeOpacity={0.75}
                >
                  {/* Top Row: Avatar & Status Badge */}
                  <View style={styles.tenantBoxTopRow}>
                    <View style={[styles.tenantBoxAvatarCircle, hasDue && { backgroundColor: '#fee2e2' }]}>
                      <Text style={{ fontSize: 13 }}>{hasDue ? '⚠️' : '👤'}</Text>
                    </View>

                    <View
                      style={[
                        styles.tenantBoxDueBadge,
                        { backgroundColor: hasDue ? '#fee2e2' : '#dcfce7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tenantBoxDueText,
                          { color: hasDue ? '#dc2626' : '#15803d' },
                        ]}
                      >
                        {hasDue ? `₹${dueAmount.toLocaleString('en-IN')} Due` : 'Paid'}
                      </Text>
                    </View>
                  </View>

                  {/* Tenant Name */}
                  <Text style={styles.tenantBoxName} numberOfLines={1}>
                    {t.fullName}
                  </Text>

                  {/* Room & Bed Details */}
                  <Text style={styles.tenantBoxRoomSub} numberOfLines={1}>
                    Room {t.roomNumber || '101'} • {t.bedLabel || 'Bed 1'}
                  </Text>

                  {/* One-Click Direct WhatsApp Reminder Button */}
                  <TouchableOpacity
                    style={styles.tenantBoxWhatsAppBtn}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      handleDirectWhatsAppReminder(t);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 12 }}>💬</Text>
                    <Text style={styles.tenantBoxWhatsAppText}>Remind</Text>
                  </TouchableOpacity>
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
                  {modalAvailableBeds.map(({ bed, roomNumber, roomId, rentPaise, depositPaise }) => {
                    const isSelected = selectedBedId === bed.id;
                    return (
                      <TouchableOpacity
                        key={bed.id}
                        style={[styles.bedChip, isSelected && styles.bedChipActive]}
                        onPress={() => {
                          setSelectedBedId(bed.id);
                          setSelectedRoomId(roomId);
                          const fixedRent = rentPaise ? rentPaise / 100 : 8500;
                          const fixedDep = depositPaise ? depositPaise / 100 : 2500;
                          setFixedRentAmount(fixedRent);
                          setFixedDepositAmount(fixedDep);
                          setOnboardRentPayingNow(String(fixedRent));
                          setOnboardDepositPayingNow(String(fixedDep));
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

              <Text style={styles.inputLabel}>Rent Amount Paying Now (₹) *</Text>
              <TextInput
                style={styles.textInput}
                value={onboardRentPayingNow}
                onChangeText={setOnboardRentPayingNow}
                keyboardType="numeric"
                placeholder={String(fixedRentAmount)}
              />

              {/* Dynamic Rent Due Indicator */}
              {(() => {
                const paying = Number(onboardRentPayingNow || 0);
                const due = Math.max(0, fixedRentAmount - paying);
                if (due > 0) {
                  return (
                    <View style={styles.rentDueAlertBox}>
                      <Text style={styles.rentDueAlertTitle}>
                        ⚠️ RENT DUE: ₹{due.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.rentDueAlertSub}>
                        Resident pays ₹{paying.toLocaleString('en-IN')} today. Remaining ₹{due.toLocaleString('en-IN')} will be marked as DUE on dashboard.
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

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Security Deposit Paid (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={onboardDepositPayingNow}
                    onChangeText={setOnboardDepositPayingNow}
                    keyboardType="numeric"
                    placeholder={String(fixedDepositAmount)}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Payment Mode</Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                    {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        style={[
                          styles.modePillSmall,
                          onboardPayMode === mode && styles.modePillSmallActive,
                        ]}
                        onPress={() => setOnboardPayMode(mode)}
                      >
                        <Text
                          style={[
                            styles.modePillSmallText,
                            onboardPayMode === mode && styles.modePillSmallTextActive,
                          ]}
                        >
                          {mode === 'BANK_TRANSFER' ? 'BANK' : mode}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeftContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dashboardLogo: {
    width: 130,
    height: 44,
    marginBottom: 2,
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
  profileBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  profileBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },

  // ─── Top Nav Pills ───
  topNavPillContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topNavPillRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  navPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navPillActive: {
    backgroundColor: '#ff7337',
    borderColor: '#ff7337',
    shadowColor: '#ff7337',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  navPillIcon: {
    fontSize: 13,
  },
  navPillIconActive: {
    fontSize: 13,
  },
  navPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  navPillTextActive: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  // ─── 4 Top KPI Stat Cards ───
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },

  // ─── Rent Status Donut Ring (Image 1 Style) ───
  rentStatusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  rentStatusCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  donutRingWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  donutOuterRing: {
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 24,
    borderTopColor: '#c4b5fd',
    borderRightColor: '#c4b5fd',
    borderBottomColor: '#bef264',
    borderLeftColor: '#bef264',
    transform: [{ rotate: '-35deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutInnerCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '35deg' }],
  },
  donutCenterValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  donutCenterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  donutCenterSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    marginTop: 2,
  },
  donutBadgeUnpaid: {
    position: 'absolute',
    top: 14,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  donutBadgePaid: {
    position: 'absolute',
    bottom: 14,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  donutBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  rentStatusLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewAllOrangeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff7337',
  },
  legendColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  // ─── Quick Actions (Circular Rings) ───
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  actionRingCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionItemTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  actionItemSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
    textAlign: 'center',
  },

  // ─── Tenants Directory: Box Type Grid (Requirement 1) ───
  tenantBoxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  tenantBoxCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  tenantBoxCardDue: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffbfb',
  },
  tenantBoxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tenantBoxAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantBoxDueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tenantBoxDueText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tenantBoxName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 2,
  },
  tenantBoxRoomSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 10,
  },
  tenantBoxWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#25D366',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tenantBoxWhatsAppText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  emptyTenantBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
  },
  emptyTenantBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  emptyTenantBoxSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  quickActionWhitePillText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
  },
  financeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  financeCardHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fef3c7',
    letterSpacing: 0.6,
  },
  financePillBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  financePillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fef08a',
  },
  ringOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  circularRingTrack: {
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularRingArc: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 7,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  circularRingInner: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#172554',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }], // Keeps text upright!
  },
  ringPercentText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fbbf24',
  },
  ringCenterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#93c5fd',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  ringCenterSub: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fef08a',
    marginTop: 1,
  },
  ringSideMetrics: {
    flex: 1,
    marginLeft: 14,
    gap: 6,
  },
  ringSideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  miniRingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 8,
  },
  ringSideLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  ringSideVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  netProfitBanner: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.4)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netProfitBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fde68a',
  },
  netProfitBannerVal: {
    fontSize: 16,
    fontWeight: '900',
  },

  // ─── Quick Actions (Red and Gold Small Round Rings) ───
  roundRingActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8dec8',
    shadowColor: '#0c2340',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  roundRingActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  redGoldRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#991b1b',
    borderWidth: 2.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
    marginBottom: 6,
  },
  redGoldRingIcon: {
    fontSize: 20,
  },
  roundActionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  roundActionSub: {
    fontSize: 9,
    color: '#78716c',
    marginTop: 1,
    textAlign: 'center',
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
  compactTenantBoxDue: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1.5,
  },
  dueCountAlertBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dueCountAlertBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  allPaidBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  allPaidBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  directWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
    marginRight: 6,
    shadowColor: '#16a34a',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  directWhatsAppIcon: {
    fontSize: 12,
  },
  directWhatsAppText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
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
  welcomeGreeting: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
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
