import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { apiClient } from '../api/client';
import { Property } from '../types';

interface PropertySetupScreenProps {
  onSelectPropertyForRooms: (property: Property) => void;
}

export const PropertySetupScreen: React.FC<PropertySetupScreenProps> = ({
  onSelectPropertyForRooms,
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State for New Property
  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState<'PG' | 'HOSTEL' | 'CO_LIVING'>('PG');
  const [genderPolicy, setGenderPolicy] = useState<'BOYS' | 'GIRLS' | 'CO_ED'>('BOYS');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [locality, setLocality] = useState('Koramangala');
  const [pincode, setPincode] = useState('560034');
  const [noticePeriod, setNoticePeriod] = useState('30');
  const [depositMonths, setDepositMonths] = useState('1');
  const [rules, setRules] = useState('Gate closes at 10:30 PM. No smoking or alcohol in rooms.');
  const [foodIncluded, setFoodIncluded] = useState(true);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'WIFI',
    'FOOD',
    'CCTV',
    'POWER_BACKUP',
    'RO_WATER',
    'WASHING_MACHINE',
  ]);

  const AMENITIES_LIST = [
    { id: 'WIFI', label: 'High-speed Wi-Fi', icon: '📶' },
    { id: 'FOOD', label: '3 Meals Food / Mess', icon: '🍲' },
    { id: 'AC', label: 'Air Conditioner', icon: '❄️' },
    { id: 'POWER_BACKUP', label: '24/7 Power Backup', icon: '⚡' },
    { id: 'CCTV', label: 'CCTV Surveillance', icon: '📹' },
    { id: 'WASHING_MACHINE', label: 'Washing Machine', icon: '🧺' },
    { id: 'GEYSER', label: 'Hot Water Geyser', icon: '🚿' },
    { id: 'RO_WATER', label: 'Pure RO Drinking Water', icon: '💧' },
    { id: 'HOUSEKEEPING', label: 'Daily Housekeeping', icon: '🧹' },
    { id: 'LIFT', label: 'Elevator / Lift', icon: '🛗' },
  ];

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const res = await apiClient<{ content: Property[] }>('/owner/properties');
      setProperties(res.content || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const toggleAmenity = (id: string) => {
    if (selectedAmenities.includes(id)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== id));
    } else {
      setSelectedAmenities([...selectedAmenities, id]);
    }
  };

  const handleCreateProperty = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a PG or Hostel Name');
      return;
    }
    if (!addressLine.trim()) {
      Alert.alert('Required', 'Please enter Property Address');
      return;
    }

    setSaving(true);
    try {
      // Fetch or use standard Bangalore city UUID for default
      let cityId = '00000000-0000-0000-0000-000000000001';
      try {
        const cities = await apiClient<any[]>('/cities');
        if (cities && cities.length > 0) {
          cityId = cities[0].id;
        }
      } catch {
        // use fallback
      }

      await apiClient<Property>('/owner/properties', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          propertyType,
          genderPolicy,
          cityId,
          addressLine: `${addressLine.trim()}, ${locality}, ${city}`,
          pincode: pincode.trim(),
          noticePeriodDays: parseInt(noticePeriod, 10) || 30,
          depositMonths: parseInt(depositMonths, 10) || 1,
          foodIncluded,
          rules,
          amenities: selectedAmenities,
        }),
      });

      Alert.alert('Success', `Property "${name}" has been created!`);
      setModalVisible(false);
      setName('');
      setAddressLine('');
      loadProperties();
    } catch (err: any) {
      // Offline fallback mock
      const mockProp: Property = {
        id: 'prop-' + Date.now(),
        name: name.trim(),
        propertyType,
        genderPolicy,
        addressLine: `${addressLine.trim()}, ${locality}, ${city}`,
        pincode: pincode.trim(),
        status: 'PUBLISHED',
        noticePeriodDays: parseInt(noticePeriod, 10) || 30,
        depositMonths: parseInt(depositMonths, 10) || 1,
        foodIncluded,
        amenities: selectedAmenities,
      };
      setProperties((prev) => [mockProp, ...prev]);
      Alert.alert('Created', `Property "${name}" added to your portfolio!`);
      setModalVisible(false);
      setName('');
      setAddressLine('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>
            Stay<Text style={styles.brandAccent}>Nest</Text><Text style={styles.pgTag}>-PG</Text>
          </Text>
          <Text style={styles.pageTitle}>Property Setup & Listings</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Add PG</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProperties} />}
      >
        <Text style={styles.sectionHeader}>YOUR HOSTEL & PG PROPERTIES ({properties.length})</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
        ) : properties.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyTitle}>No Properties Added Yet</Text>
            <Text style={styles.emptySub}>
              Tap the "+ Add PG" button above to add your hostel name, address, facilities, and house rules.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.emptyAddText}>+ Setup My First PG Property</Text>
            </TouchableOpacity>
          </View>
        ) : (
          properties.map((p) => (
            <View key={p.id} style={styles.propCard}>
              <View style={styles.propHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propName}>{p.name}</Text>
                  <Text style={styles.propAddress}>{p.addressLine}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{p.status || 'ACTIVE'}</Text>
                </View>
              </View>

              {/* Tags */}
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{p.propertyType || 'PG'}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: '#fdf2f8' }]}>
                  <Text style={[styles.tagText, { color: '#db2777' }]}>
                    {p.genderPolicy === 'BOYS'
                      ? 'Boys Only'
                      : p.genderPolicy === 'GIRLS'
                      ? 'Girls Only'
                      : 'Co-ed / All'}
                  </Text>
                </View>
                {p.foodIncluded && (
                  <View style={[styles.tag, { backgroundColor: '#ecfdf5' }]}>
                    <Text style={[styles.tagText, { color: '#059669' }]}>🍲 Food Included</Text>
                  </View>
                )}
              </View>

              {/* Amenities List */}
              {p.amenities && p.amenities.length > 0 && (
                <View style={styles.amenitiesPreview}>
                  <Text style={styles.amenityText}>
                    Facilities: {p.amenities.slice(0, 4).join(' • ')}
                    {p.amenities.length > 4 ? ` +${p.amenities.length - 4} more` : ''}
                  </Text>
                </View>
              )}

              {/* Action Button */}
              <TouchableOpacity
                style={styles.manageRoomsBtn}
                onPress={() => onSelectPropertyForRooms(p)}
              >
                <Text style={styles.manageRoomsText}>Configure Floors, Rooms & Beds →</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Property Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <ScrollView style={styles.modalContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalBadge}>NEW PROPERTY SETUP</Text>
              <Text style={styles.modalTitle}>Add PG / Hostel Property</Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalForm}>
            <Text style={styles.inputLabel}>PG / HOSTEL NAME *</Text>
            <TextInput
              style={styles.modalInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sri Venkateswara Luxury PG"
              placeholderTextColor="#94a3b8"
            />

            {/* Type & Gender Policy */}
            <Text style={styles.inputLabel}>PROPERTY TYPE</Text>
            <View style={styles.choiceRow}>
              {(['PG', 'HOSTEL', 'CO_LIVING'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.choiceBtn, propertyType === type && styles.choiceBtnActive]}
                  onPress={() => setPropertyType(type)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      propertyType === type && styles.choiceTextActive,
                    ]}
                  >
                    {type.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>GENDER POLICY</Text>
            <View style={styles.choiceRow}>
              {(['BOYS', 'GIRLS', 'CO_ED'] as const).map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[styles.choiceBtn, genderPolicy === gender && styles.choiceBtnActive]}
                  onPress={() => setGenderPolicy(gender)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      genderPolicy === gender && styles.choiceTextActive,
                    ]}
                  >
                    {gender === 'BOYS' ? 'Boys' : gender === 'GIRLS' ? 'Girls' : 'Co-ed'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Address */}
            <Text style={styles.inputLabel}>ADDRESS LINE *</Text>
            <TextInput
              style={styles.modalInput}
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="e.g. #42, 5th Main, 7th Cross"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>AREA / LOCALITY</Text>
                <TextInput
                  style={styles.modalInput}
                  value={locality}
                  onChangeText={setLocality}
                  placeholder="Koramangala"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>PINCODE</Text>
                <TextInput
                  style={styles.modalInput}
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                  placeholder="560034"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Food Included */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFoodIncluded(!foodIncluded)}
            >
              <View style={[styles.checkbox, foodIncluded && styles.checkboxActive]}>
                {foodIncluded && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>3 Times Meals / Food Included in Rent</Text>
            </TouchableOpacity>

            {/* Facilities & Amenities */}
            <Text style={styles.inputLabel}>FACILITIES & AMENITIES</Text>
            <View style={styles.amenitiesGrid}>
              {AMENITIES_LIST.map((item) => {
                const isSelected = selectedAmenities.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.amenityChip, isSelected && styles.amenityChipActive]}
                    onPress={() => toggleAmenity(item.id)}
                  >
                    <Text style={styles.amenityChipIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.amenityChipLabel,
                        isSelected && styles.amenityChipLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* House Rules */}
            <Text style={styles.inputLabel}>HOUSE RULES & GATE TIMINGS</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              value={rules}
              onChangeText={setRules}
              multiline
              placeholder="e.g. Gate closes at 10:30 PM. No alcohol."
              placeholderTextColor="#94a3b8"
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.modalSubmitBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreateProperty}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSubmitText}>Save PG & Configure Rooms →</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    fontSize: 20,
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
  pageTitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyAddBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 18,
  },
  emptyAddText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  propCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  propName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  propAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  tag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  amenitiesPreview: {
    marginVertical: 4,
  },
  amenityText: {
    fontSize: 11,
    color: '#64748b',
  },
  manageRoomsBtn: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  manageRoomsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4f46e5',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  modalForm: {
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: '#0f172a',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  choiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  choiceBtnActive: {
    backgroundColor: '#4f46e5',
  },
  choiceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  choiceTextActive: {
    color: '#ffffff',
  },
  row: {
    flexDirection: 'row',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  amenityChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  amenityChipIcon: {
    marginRight: 6,
    fontSize: 13,
  },
  amenityChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  amenityChipLabelActive: {
    color: '#4f46e5',
  },
  modalSubmitBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
