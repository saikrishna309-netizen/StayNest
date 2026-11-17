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
  const [rentRupees, setRentRupees] = useState('9500');
  const [depositRupees, setDepositRupees] = useState('9500');
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
      if (loadedProps.length > 0) {
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
      const rooms = data.rooms || [];
      setPropRooms(rooms);

      // Find first available bed
      for (const r of rooms) {
        const avail = (r.beds || []).find((b) => b.status === 'AVAILABLE');
        if (avail) {
          setSelectedBedId(avail.id);
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
    loadRoomsForProperty(propId);
  };

  const handleOnboard = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Required', 'Please enter tenant name and phone');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Tenant Profile
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
        await apiClient(`/owner/tenants/${tenant.id}/stays`, {
          method: 'POST',
          body: JSON.stringify({
            bedId: selectedBedId,
            propertyId: selectedPropId,
            monthlyRentPaise: Number(rentRupees) * 100,
            depositPaise: Number(depositRupees) * 100,
            checkIn: new Date().toISOString().split('T')[0],
          }),
        });
      }

      Alert.alert('Success', `${fullName} onboarded and bed assigned!`);
      setShowForm(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setIdProofNumber('');
      loadData();
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not onboard tenant');
    } finally {
      setSubmitting(false);
    }
  };

  // Collect available beds
  const availableBeds: { bed: Bed; roomNumber: string }[] = [];
  propRooms.forEach((r) => {
    (r.beds || []).forEach((b) => {
      if (b.status === 'AVAILABLE') {
        availableBeds.push({ bed: b, roomNumber: r.roomNumber });
      }
    });
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tenants & Bed Allocation</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.addBtnText}>+ Onboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Onboarding Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Onboard New Resident</Text>

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
                No free beds available. Add rooms/beds first.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bedScroll}>
                {availableBeds.map(({ bed, roomNumber }) => {
                  const isSelected = selectedBedId === bed.id;
                  return (
                    <TouchableOpacity
                      key={bed.id}
                      style={[styles.bedPickChip, isSelected && styles.bedPickChipSelected]}
                      onPress={() => setSelectedBedId(bed.id)}
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

        {loading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 40 }} />
        ) : tenants.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Tenants Onboarded Yet</Text>
            <Text style={styles.emptySub}>
              Tap '+ Onboard' to register a tenant and allocate a bed in real-time.
            </Text>
          </View>
        ) : (
          tenants.map((t) => (
            <View key={t.id} style={styles.tenantCard}>
              <View style={styles.tenantHeader}>
                <View>
                  <Text style={styles.tenantName}>{t.fullName}</Text>
                  <Text style={styles.tenantPhone}>{t.phone}</Text>
                </View>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>

              <View style={styles.tenantFooter}>
                <Text style={styles.idText}>
                  {t.idProofType}: {t.idProofNumber || '--'}
                </Text>
                <Text style={styles.stayText}>Registered in PostgreSQL</Text>
              </View>
            </View>
          ))
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
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
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
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tenantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    backgroundColor: '#ecfdf5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  tenantFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  idText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  stayText: {
    fontSize: 11,
    color: '#4f46e5',
    fontWeight: '700',
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
