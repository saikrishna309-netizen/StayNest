import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Property } from '../types';
import { safeStorage } from '../utils/safeStorage';
import { emitDataChanged } from '../utils/appEvents';
import {
  FloorUnitMatrixBuilder,
  MatrixFloor,
  getInitialMatrixFloors,
} from '../components/FloorUnitMatrixBuilder';
import { LocationPickerModal } from '../components/modals/LocationPickerModal';
import { BrandLoader } from '../components/BrandLoader';

interface OwnerRegistrationScreenProps {
  onComplete: (createdProperty?: Property | null) => void;
}

export const OwnerRegistrationScreen: React.FC<OwnerRegistrationScreenProps> = ({ onComplete }) => {
  const { user, updateProfile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Owner Basic Details
  const [fullName, setFullName] = useState(
    user?.fullName && user.fullName !== 'PG Owner' ? user.fullName : ''
  );
  const [email, setEmail] = useState(
    user?.email && !user.email.startsWith('owner_') ? user.email : ''
  );

  // Step 2: Property Basic Details
  const [propertyName, setPropertyName] = useState('');
  const [propertyMode, setPropertyMode] = useState<'PG' | 'RENTAL_BUILDING'>('PG');
  const [genderPolicy, setGenderPolicy] = useState<'BOYS' | 'GIRLS' | 'CO_ED'>('CO_ED');
  const [foodPolicy, setFoodPolicy] = useState<'3_MEALS' | '2_MEALS' | 'BREAKFAST_ONLY' | 'NO_FOOD'>('3_MEALS');
  const [showFoodDropdown, setShowFoodDropdown] = useState(false);
  const [addressLine, setAddressLine] = useState('');
  const [cityName, setCityName] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [startingRent, setStartingRent] = useState('0');
  const [startingDeposit, setStartingDeposit] = useState('0');

  // Input Focus State for Light Orange Highlighting (Requirement 5)
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Step 3: Floors, Rooms & Beds Matrix
  const [matrixFloors, setMatrixFloors] = useState<MatrixFloor[]>(() =>
    getInitialMatrixFloors('PG', 0, 0)
  );
  const [loading, setLoading] = useState(false);

  const cleanPhone = (user?.phone || '').replace(/[^0-9]/g, '').slice(-10) || '9876543210';

  const handleNextFromOwner = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your Full Name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Required', 'Please enter a valid Email Address.');
      return;
    }
    setLoading(true);
    try {
      // Keep isProfileComplete as false so user remains inside the wizard on iPhone/Android
      await updateProfile(fullName.trim(), email.trim(), false);
      await safeStorage
        .setItem(
          '@staynest_owner_custom_profile',
          JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: cleanPhone,
            location: 'India',
          })
        )
        .catch(() => {});
      setStep(2);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleNextFromPropertyBasic = () => {
    if (!propertyName.trim() || propertyName.trim().length < 3) {
      Alert.alert('Required', 'Please enter a Property Name (at least 3 characters).');
      return;
    }
    if (!cityName.trim()) {
      Alert.alert('Required', 'Please enter your City.');
      return;
    }
    const parsedRent = Math.max(500, parseInt(startingRent.replace(/[^0-9]/g, ''), 10) || 8500);
    setMatrixFloors(
      getInitialMatrixFloors(propertyMode === 'RENTAL_BUILDING' ? 'RENTAL' : 'PG', parsedRent, 0)
    );
    setStep(3);
  };

  const handleSubmitProperty = async () => {
    const parsedRent = Math.max(500, parseInt(startingRent.replace(/[^0-9]/g, ''), 10) || 8500);
    const isRentalMode = propertyMode === 'RENTAL_BUILDING';

    const generatedFloors = matrixFloors.map((mFloor) => ({
      floorNumber: mFloor.floor_number,
      label: mFloor.label,
      rooms: mFloor.units.map((mUnit) => {
        const unitRent = Math.max(500, mUnit.monthly_rent || parsedRent);
        const unitCap = isRentalMode ? 1 : Math.max(1, mUnit.sharing_capacity || 2);
        const beds = Array.from({ length: unitCap }, (_, idx) => ({
          id: `bed-${mUnit.unit_number}-${idx + 1}-${Date.now()}`,
          bedLabel: isRentalMode ? 'Unit' : `Bed ${idx + 1}`,
          status: 'AVAILABLE' as const,
        }));
        return {
          id: `room-${mUnit.unit_number}-${Date.now()}`,
          roomNumber: mUnit.unit_number,
          floorNumber: mFloor.floor_number,
          sharingType: mUnit.unit_type || 'DOUBLE',
          rentRupees: unitRent,
          depositRupees: unitRent,
          ac: true,
          attachedBathroom: true,
          beds,
        };
      }),
    }));

    const backendFloorsPayload = generatedFloors.map((fl) => ({
      floorNumber: fl.floorNumber,
      rooms: fl.rooms.map((rm) => ({
        roomNumber: rm.roomNumber,
        sharingType: rm.sharingType,
        capacity: rm.beds.length,
        rentRupees: rm.rentRupees,
        depositRupees: rm.depositRupees,
        beds: rm.beds.map((b) => ({ bedLabel: b.bedLabel })),
      })),
    }));

    setLoading(true);
    try {
      await safeStorage
        .setItem(
          '@staynest_owner_custom_profile',
          JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: cleanPhone,
            location: `${cityName.trim()}, India`,
          })
        )
        .catch(() => {});

      const createdProp = await apiClient<Property>('/owner/properties', {
        method: 'POST',
        body: JSON.stringify({
          name: propertyName.trim(),
          propertyType: isRentalMode ? 'RENTAL_BUILDING' : 'PG',
          genderPolicy: isRentalMode ? 'CO_ED' : genderPolicy,
          cityId: '00000000-0000-0000-0000-000000000001',
          addressLine: addressLine.trim() || cityName.trim(),
          pincode: pincode.replace(/\D/g, '').slice(0, 6) || undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          startingPricePaise: parsedRent * 100,
          foodIncluded: isRentalMode ? false : foodPolicy !== 'NO_FOOD',
          amenities: ['HIGH_SPEED_WIFI', 'POWER_BACKUP'],
          floors: backendFloorsPayload,
        }),
      });

      if (createdProp?.id) {
        await safeStorage
          .setItem('@staynest_custom_properties', JSON.stringify([createdProp]))
          .catch(() => {});
        await safeStorage.setItem('@staynest_active_property_id', createdProp.id).catch(() => {});

        if (createdProp.rooms && createdProp.rooms.length > 0) {
          const byFloor = new Map<number, any[]>();
          createdProp.rooms.forEach((r) => {
            const flNum = r.floorNumber || 1;
            if (!byFloor.has(flNum)) byFloor.set(flNum, []);
            byFloor.get(flNum)!.push({
              id: r.id,
              roomNumber: r.roomNumber,
              floorNumber: flNum,
              sharingType: r.sharingType || 'DOUBLE',
              rentRupees: r.rentMonthlyPaise ? Math.round(r.rentMonthlyPaise / 100) : parsedRent,
              depositRupees: r.depositPaise ? Math.round(r.depositPaise / 100) : parsedRent,
              ac: true,
              attachedBathroom: true,
              beds: (r.beds || []).map((b) => ({
                id: b.id,
                bedLabel: b.bedLabel,
                status: b.status || 'AVAILABLE',
              })),
            });
          });
          const realFloors = Array.from(byFloor.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([floorNumber, rooms]) => ({ floorNumber, rooms }));
          await safeStorage
            .setItem(`@staynest_floors_${createdProp.id}`, JSON.stringify(realFloors))
            .catch(() => {});
        } else {
          await safeStorage
            .setItem(`@staynest_floors_${createdProp.id}`, JSON.stringify(generatedFloors))
            .catch(() => {});
        }
      }

      emitDataChanged();
      await updateProfile(fullName.trim(), email.trim(), true).catch(() => {});
      onComplete(createdProp);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save your property. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipOnboarding = async () => {
    setLoading(true);
    try {
      await updateProfile(fullName.trim(), email.trim(), true).catch(() => {});
    } finally {
      setLoading(false);
      onComplete(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.badgeRow}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>WELCOME TO STAYNEST</Text>
                </View>
                <Text style={styles.stepBadge}>
                  {step === 1 ? 'Step 1 of 2 • Owner' : 'Step 2 of 2 • Property'}
                </Text>
              </View>
              <Text style={styles.title}>
                {step === 1
                  ? 'Complete Your Owner Profile'
                  : step === 2
                    ? 'Add Your First Property'
                    : 'Configure Floors & Rooms'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1
                  ? 'Enter your basic details to set up your owner account.'
                  : step === 2
                    ? 'Enter your PG or rental building details.'
                    : 'Set up your floors, rooms, and beds to start managing residents.'}
              </Text>
            </View>

            {/* Step 1: Owner Basic Details */}
            {step === 1 && (
              <>
                <View style={styles.verifiedPhoneBox}>
                  <View>
                    <Text style={styles.verifiedPhoneLabel}>VERIFIED MOBILE NUMBER</Text>
                    <Text style={styles.verifiedPhoneValue}>+91 {user?.phone || ''}</Text>
                  </View>
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedPillText}>✓ Verified</Text>
                  </View>
                </View>

                <Text style={styles.sectionHeading}>1. Owner Basic Details</Text>

                <Text style={styles.label}>FULL NAME *</Text>
                <TextInput
                  style={[styles.input, focusedInput === 'fullName' && styles.inputFocused]}
                  value={fullName}
                  onChangeText={setFullName}
                  onFocus={() => setFocusedInput('fullName')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor="#94a3b8"
                  autoFocus
                />

                <Text style={styles.label}>EMAIL ADDRESS *</Text>
                <TextInput
                  style={[styles.input, focusedInput === 'email' && styles.inputFocused]}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. ramesh@gmail.com"
                  placeholderTextColor="#94a3b8"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleNextFromOwner}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <BrandLoader variant="inline" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Next: Property Details →</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Property Details */}
            {step === 2 && (
              <>
                <Text style={styles.sectionHeading}>2. Property Details</Text>

                <Text style={styles.label}>PROPERTY TYPE</Text>
                <View style={styles.chipRow}>
                  {[
                    { id: 'PG', label: '🏢 PG / Hostel' },
                    { id: 'RENTAL_BUILDING', label: '🏠 Rental Building' },
                  ].map((opt) => {
                    const active = propertyMode === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setPropertyMode(opt.id as 'PG' | 'RENTAL_BUILDING')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>PROPERTY NAME *</Text>
                <TextInput
                  style={[styles.input, focusedInput === 'propertyName' && styles.inputFocused]}
                  value={propertyName}
                  onChangeText={setPropertyName}
                  onFocus={() => setFocusedInput('propertyName')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder={
                    propertyMode === 'PG'
                      ? 'e.g. Sri Venkateswara Luxury PG'
                      : 'e.g. Sri Lakshmi Residency'
                  }
                  placeholderTextColor="#94a3b8"
                />

                {/* Default Name Suggestions */}
                <View style={styles.quickNameWrap}>
                  <Text style={styles.quickNameLabel}>Quick Suggestions:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickNameScroll}>
                    {(propertyMode === 'PG'
                      ? ['Sri Venkateswara PG', 'Sri Balaji PG', 'Sri Sai Luxury PG', 'StayNest Elite PG', 'Co-Living Hub']
                      : ['Sri Lakshmi Residency', 'Balaji Towers', 'Sai Nilayam', 'Green View Enclave', 'Surya Apartments']
                    ).map((sug) => (
                      <TouchableOpacity
                        key={sug}
                        style={[styles.quickNameChip, propertyName === sug && styles.quickNameChipActive]}
                        onPress={() => setPropertyName(sug)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.quickNameChipText, propertyName === sug && styles.quickNameChipTextActive]}>
                          {sug}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {propertyMode === 'PG' && (
                  <>
                    <Text style={styles.label}>WHO CAN STAY?</Text>
                    <View style={styles.chipRow}>
                      {[
                        { id: 'BOYS', label: 'Boys' },
                        { id: 'GIRLS', label: 'Girls' },
                        { id: 'CO_ED', label: 'Co-Living' },
                      ].map((g) => {
                        const active = genderPolicy === g.id;
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => setGenderPolicy(g.id as 'BOYS' | 'GIRLS' | 'CO_ED')}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Food / Meals Policy Dropdown (Requirement 3) */}
                    <Text style={styles.label}>FOOD / MEALS INCLUDED POLICY</Text>
                    <TouchableOpacity
                      style={[styles.dropdownHeader, showFoodDropdown && styles.dropdownHeaderActive]}
                      onPress={() => setShowFoodDropdown(!showFoodDropdown)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.dropdownHeaderText}>
                        {foodPolicy === '3_MEALS'
                          ? '🍲 3 Meals Daily (All Meals Included)'
                          : foodPolicy === '2_MEALS'
                            ? '🍳 2 Meals Daily (Breakfast & Dinner)'
                            : foodPolicy === 'BREAKFAST_ONLY'
                              ? '☕ Breakfast Only'
                              : '🚫 No Food / Self Cooking'}
                      </Text>
                      <Text style={styles.dropdownArrow}>{showFoodDropdown ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {showFoodDropdown && (
                      <View style={styles.dropdownMenu}>
                        {[
                          { id: '3_MEALS', label: '🍲 3 Meals Daily (Breakfast, Lunch & Dinner)' },
                          { id: '2_MEALS', label: '🍳 2 Meals Daily (Breakfast & Dinner)' },
                          { id: 'BREAKFAST_ONLY', label: '☕ Breakfast Only' },
                          { id: 'NO_FOOD', label: '🚫 No Food / Self-Cooking' },
                        ].map((opt) => (
                          <TouchableOpacity
                            key={opt.id}
                            style={[
                              styles.dropdownItem,
                              foodPolicy === opt.id && styles.dropdownItemActive,
                            ]}
                            onPress={() => {
                              setFoodPolicy(opt.id as any);
                              setShowFoodDropdown(false);
                            }}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                foodPolicy === opt.id && styles.dropdownItemTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}

                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#fff7ed',
                    borderWidth: 1,
                    borderColor: '#fdba74',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginBottom: 12,
                  }}
                  onPress={() => setShowLocationPicker(true)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#9a3412' }}>
                      🗺️ Pick Location on Map / GPS
                    </Text>
                    <Text style={{ fontSize: 10.5, color: '#c2410c', marginTop: 2 }}>
                      {latitude && longitude
                        ? `Pinned: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                        : 'Tap to open map & auto-fill address, city & pincode'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#ea580c' }}>Open ›</Text>
                </TouchableOpacity>

                <Text style={styles.label}>ADDRESS / AREA</Text>
                <TextInput
                  style={[styles.input, focusedInput === 'addressLine' && styles.inputFocused]}
                  value={addressLine}
                  onChangeText={setAddressLine}
                  onFocus={() => setFocusedInput('addressLine')}
                  onBlur={() => setFocusedInput(null)}
                  placeholder="e.g. Opp. PVP Square, MG Road"
                  placeholderTextColor="#94a3b8"
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.equalLabelWrap}>
                      <Text style={styles.label}>CITY *</Text>
                    </View>
                    <TextInput
                      style={[styles.input, focusedInput === 'cityName' && styles.inputFocused]}
                      value={cityName}
                      onChangeText={setCityName}
                      onFocus={() => setFocusedInput('cityName')}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="e.g. Hyderabad"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.equalLabelWrap}>
                      <Text style={styles.label}>PINCODE</Text>
                    </View>
                    <TextInput
                      style={[styles.input, focusedInput === 'pincode' && styles.inputFocused]}
                      value={pincode}
                      onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
                      onFocus={() => setFocusedInput('pincode')}
                      onBlur={() => setFocusedInput(null)}
                      keyboardType="numeric"
                      maxLength={6}
                      placeholder="500081"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                {/* Symmetrical Rent & Deposit Section (Requirement 4) */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.equalLabelWrap}>
                      <Text style={styles.label}>
                        {propertyMode === 'PG' ? 'RENT / BED (₹)' : 'UNIT RENT (₹)'} *
                      </Text>
                    </View>
                    <TextInput
                      style={[styles.input, focusedInput === 'rent' && styles.inputFocused]}
                      value={startingRent}
                      onChangeText={setStartingRent}
                      onFocus={() => setFocusedInput('rent')}
                      onBlur={() => setFocusedInput(null)}
                      keyboardType="numeric"
                      placeholder="8500"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.equalLabelWrap}>
                      <Text style={styles.label}>SECURITY DEPOSIT (₹) *</Text>
                    </View>
                    <TextInput
                      style={[styles.input, focusedInput === 'deposit' && styles.inputFocused]}
                      value={startingDeposit}
                      onChangeText={setStartingDeposit}
                      onFocus={() => setFocusedInput('deposit')}
                      onBlur={() => setFocusedInput(null)}
                      keyboardType="numeric"
                      placeholder="8500"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleNextFromPropertyBasic}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonText}>Next: Floors & Rooms →</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={handleSkipOnboarding}>
                  <Text style={styles.skipText}>Skip & Add Property Later</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 3: Floors & Rooms Builder */}
            {step === 3 && (
              <FloorUnitMatrixBuilder
                propertyMode={propertyMode === 'RENTAL_BUILDING' ? 'RENTAL' : 'PG'}
                floors={matrixFloors}
                defaultMaintenance={0}
                onChangeFloors={setMatrixFloors}
                onBackStep={() => setStep(2)}
                onSubmit={handleSubmitProperty}
                submitting={loading}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <BrandLoader
        variant="overlay"
        visible={loading && step === 3}
        message="Saving property details..."
      />

      <LocationPickerModal
        visible={showLocationPicker}
        initialLat={latitude}
        initialLng={longitude}
        initialAddress={addressLine}
        initialCity={cityName}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(loc) => {
          setLatitude(loc.latitude);
          setLongitude(loc.longitude);
          if (loc.addressLine) setAddressLine(loc.addressLine);
          if (loc.cityName) setCityName(loc.cityName);
          if (loc.pincode) setPincode(loc.pincode);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F4',
    paddingBottom: Platform.OS === 'android' ? 24 : 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#FAF7F4',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 220,
  },
  quickNameWrap: {
    marginTop: -4,
    marginBottom: 12,
  },
  quickNameLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  quickNameScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 2,
  },
  quickNameChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickNameChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
  },
  quickNameChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  quickNameChipTextActive: {
    color: '#ea580c',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  header: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgePill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 0.6,
  },
  stepBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  verifiedPhoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  verifiedPhoneLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  verifiedPhoneValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  verifiedPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 10,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
    justifyContent: 'center',
  },
  inputFocused: {
    borderColor: '#fb923c',
    backgroundColor: '#fffdfb',
    borderWidth: 1.5,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  equalLabelWrap: {
    minHeight: 22,
    justifyContent: 'flex-end',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  dropdownHeaderActive: {
    borderColor: '#fb923c',
    backgroundColor: '#fffdfb',
  },
  dropdownHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#64748b',
  },
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingVertical: 4,
    marginBottom: 14,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#fff7ed',
  },
  dropdownItemText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownItemTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
});
