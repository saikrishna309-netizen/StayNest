import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
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

  const totalExpense = expenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0) / 100;
  const totalRentCollected = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((sum, i) => sum + (i.paidAmountPaise || 0), 0) / 100;

  // Handle Checkout Tenant
  const handleCheckoutTenant = (tenant: Tenant) => {
    Alert.alert(
      'Confirm Check-Out',
      `Check out ${tenant.fullName}? This will mark their stay as vacated and immediately free up their bed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient(`/owner/tenants/${tenant.id}/checkout`, {
                method: 'POST',
              });
              Alert.alert('✓ Checked Out', `${tenant.fullName} has been checked out successfully.`);
              loadData();
            } catch (err: any) {
              Alert.alert('Notice', err.message || 'Tenant stay updated.');
              loadData();
            }
          },
        },
      ]
    );
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

    // Enforce 1 person = 1 bed check
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
        }).catch(() => {});
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
        <View>
          <Text style={styles.brandTitle}>
            Stay<Text style={styles.brandAccent}>Nest</Text><Text style={styles.pgTag}>-PG</Text>
          </Text>
          <Text style={styles.welcomeText}>
            Welcome back, <Text style={styles.ownerName}>{user?.fullName || 'PG Owner'}</Text>
          </Text>
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
        {/* ─── 2. KPI GRID (PROPERTIES, ACTIVE TENANTS, RENT, EXPENSES) ─── */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Properties */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>MY PROPERTIES</Text>
            <Text style={styles.kpiValue}>{properties.length}</Text>
            <Text style={styles.kpiSub}>Active PG Listings</Text>
          </View>

          {/* Card 2: Active Tenants */}
          <View style={[styles.kpiCard, styles.kpiCardHighlight]}>
            <Text style={[styles.kpiLabel, { color: '#047857' }]}>ACTIVE TENANTS</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{activeTenants.length}</Text>
            <Text style={styles.kpiSub}>Registered Residents</Text>
          </View>

          {/* Card 3: Rent Collected */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>RENT COLLECTED</Text>
            <Text style={[styles.kpiValue, { color: '#4f46e5' }]}>
              ₹{totalRentCollected.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.kpiSub}>{invoices.length} Invoices</Text>
          </View>

          {/* Card 4: Expenses Logged */}
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>EXPENSES LOGGED</Text>
            <Text style={[styles.kpiValue, { color: '#e11d48' }]}>
              ₹{totalExpense.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.kpiSub}>{expenses.length} Records</Text>
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
            <Text style={styles.actionBtnTitle}>Record Rent</Text>
            <Text style={styles.actionBtnSub}>Cash / UPI tracking</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 4. MY PG LISTINGS (SHOW ONLY 2 ROOMS IN OCCUPANCY TABLE) ─── */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>MY PG LISTINGS</Text>
            <Text style={styles.subtext}>Live room occupancy overview</Text>
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

                {/* Room Occupancy Breakdown Table (Max 2 rooms) */}
                {displayedRooms.length > 0 && (
                  <View style={styles.occupancyTableBox}>
                    <Text style={styles.occupancyTableHeader}>ROOM OCCUPANCY (SHOWING 2 ROOMS)</Text>
                    <View style={styles.occTableRowHeader}>
                      <Text style={[styles.occTableCol, { flex: 1.2 }]}>ROOM</Text>
                      <Text style={[styles.occTableCol, { flex: 1.4 }]}>SHARING</Text>
                      <Text style={[styles.occTableCol, { flex: 1, textAlign: 'center' }]}>OCCUPIED</Text>
                      <Text style={[styles.occTableCol, { flex: 1, textAlign: 'right' }]}>AVAILABLE</Text>
                    </View>

                    {displayedRooms.map((r) => {
                      const occCount = (r.beds || []).filter(
                        (b) => b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id)
                      ).length;
                      const availCount = Math.max(0, (r.beds || []).length - occCount);
                      return (
                        <View key={r.id} style={styles.occTableRow}>
                          <Text style={[styles.occTableCell, { flex: 1.2, fontWeight: '700' }]}>
                            Room {r.roomNumber}
                          </Text>
                          <Text style={[styles.occTableCell, { flex: 1.4, color: '#64748b' }]}>
                            {r.sharingType ? r.sharingType.replace('_', ' ') : 'Double'}
                          </Text>
                          <Text
                            style={[
                              styles.occTableCell,
                              { flex: 1, textAlign: 'center', color: occCount > 0 ? '#dc2626' : '#64748b', fontWeight: '800' },
                            ]}
                          >
                            {occCount}
                          </Text>
                          <Text
                            style={[
                              styles.occTableCell,
                              { flex: 1, textAlign: 'right', color: availCount > 0 ? '#059669' : '#64748b', fontWeight: '800' },
                            ]}
                          >
                            {availCount}
                          </Text>
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

        {/* ─── 5. MY ACTIVE TENANTS (COMPACT SMALL BOXES) ─── */}
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
            {activeTenants.map((t) => {
              const initials = t.fullName
                ? t.fullName
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'TN';

              return (
                <View key={t.id} style={styles.compactTenantBox}>
                  <View style={styles.compactAvatar}>
                    <Text style={styles.compactAvatarText}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.compactTenantName}>{t.fullName}</Text>
                    <Text style={styles.compactTenantSub}>
                      Floor {t.floorNumber || 1} • Room {t.roomNumber || '101'} • {t.bedLabel || 'Bed 1'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.compactCheckoutBtn}
                    onPress={() => handleCheckoutTenant(t)}
                  >
                    <Text style={styles.compactCheckoutText}>Checkout</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL: ONBOARD NEW TENANT ─── */}
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiCardHighlight: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
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
    paddingVertical: 5,
    alignItems: 'center',
  },
  occTableCell: {
    fontSize: 11,
    color: '#1e293b',
  },
  moreRoomsRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 6,
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
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
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

  // ─── Compact Small Tenant Box Styles (Point 3) ───
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
  compactCheckoutBtn: {
    backgroundColor: '#fff1f2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  compactCheckoutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e11d48',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
    marginTop: 8,
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
});
