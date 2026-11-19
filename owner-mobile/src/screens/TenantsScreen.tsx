import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
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
  const [rentRupees, setRentRupees] = useState('8500');
  const [depositRupees, setDepositRupees] = useState('8500');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSelectBed = (bed: Bed, roomId: string, rentPaise?: number) => {
    setSelectedBedId(bed.id);
    setSelectedRoomId(roomId);
    if (rentPaise) {
      setRentRupees(String(rentPaise / 100));
      setDepositRupees(String(rentPaise / 100));
    }
  };

  const handleOnboard = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Required', 'Please enter tenant name and phone number');
      return;
    }

    setSubmitting(true);
    try {
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

      // 2. Allocate Bed if selected
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
              monthlyRentPaise: Number(rentRupees || 8500) * 100,
              depositPaise: Number(depositRupees || 8500) * 100,
              checkIn: new Date().toISOString().split('T')[0],
            }),
          });
        } catch (stayErr: any) {
          console.warn('Stay allocation warning:', stayErr.message);
        }
      }

      Alert.alert('✓ Success', `${fullName} successfully onboarded as a resident!`);
      setShowForm(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setIdProofNumber('');
      loadData();
    } catch (err: any) {
      Alert.alert('Onboarding Notice', err.message || 'Could not onboard tenant');
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Checkout
  const handleCheckout = (tenant: Tenant) => {
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

  // Active occupied bed IDs to enforce 1 person = 1 bed rule
  const activeOccupiedBedIds = new Set<string>();
  tenants.forEach((t) => {
    if (t.active !== false && t.stayStatus !== 'TERMINATED' && t.bedId) {
      activeOccupiedBedIds.add(t.bedId);
    }
  });

  // Collect vacant beds only (occupied beds are hidden)
  const availableBeds: { bed: Bed; roomNumber: string; roomId: string; rentPaise?: number }[] = [];
  propRooms.forEach((r) => {
    (r.beds || []).forEach((b) => {
      const isOccupied = b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id);
      if (!isOccupied) {
        availableBeds.push({
          bed: b,
          roomNumber: r.roomNumber,
          roomId: r.id,
          rentPaise: r.rentMonthlyPaise,
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
                {availableBeds.map(({ bed, roomNumber, roomId, rentPaise }) => {
                  const isSelected = selectedBedId === bed.id;
                  return (
                    <TouchableOpacity
                      key={bed.id}
                      style={[styles.bedPickChip, isSelected && styles.bedPickChipSelected]}
                      onPress={() => handleSelectBed(bed, roomId, rentPaise)}
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

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>MONTHLY RENT (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={rentRupees}
                  onChangeText={setRentRupees}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>SECURITY DEPOSIT (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={depositRupees}
                  onChangeText={setDepositRupees}
                  keyboardType="numeric"
                />
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
              <View key={t.id} style={styles.tenantCard}>
                <View style={styles.tenantHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.tenantName}>{t.fullName}</Text>
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
                      Room {t.roomNumber || '101'} • {t.bedLabel || 'Bed 1'}
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
                      {rentPaid ? '🟢 Paid' : '🔴 Due'}
                    </Text>
                  </View>
                </View>

                {/* Footer with Checkout action if active */}
                <View style={styles.tenantFooter}>
                  <Text style={styles.idText}>
                    {t.idProofType || 'AADHAAR'}: {t.idProofNumber || '--'}
                  </Text>

                  {isAct && (
                    <TouchableOpacity
                      style={styles.cardCheckoutBtn}
                      onPress={() => handleCheckout(t)}
                    >
                      <Text style={styles.cardCheckoutText}>Check Out</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
});
