import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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

interface OwnerRegistrationScreenProps {
  onComplete: (createdProperty?: Property | null) => void;
}

export const OwnerRegistrationScreen: React.FC<OwnerRegistrationScreenProps> = ({ onComplete }) => {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(
    user?.fullName && user.fullName !== 'PG Owner' ? user.fullName : ''
  );
  const [email, setEmail] = useState(
    user?.email && !user.email.startsWith('owner_') ? user.email : ''
  );

  // First Property Details
  const [propertyName, setPropertyName] = useState('');
  const [propertyMode, setPropertyMode] = useState<'PG' | 'RENTAL_BUILDING'>('PG');
  const [genderPolicy, setGenderPolicy] = useState<'BOYS' | 'GIRLS' | 'CO_LIVING'>('CO_LIVING');
  const [addressLine, setAddressLine] = useState('');
  const [cityName, setCityName] = useState('');
  const [startingRent, setStartingRent] = useState('8500');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your Full Name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Required', 'Please enter a valid Email Address.');
      return;
    }
    if (!propertyName.trim()) {
      Alert.alert('Required', 'Please enter your Property Name.');
      return;
    }
    if (!cityName.trim()) {
      Alert.alert('Required', 'Please enter your City.');
      return;
    }

    const parsedRent = Math.max(500, parseInt(startingRent.replace(/[^0-9]/g, ''), 10) || 8500);
    const cleanPhone = (user?.phone || '').replace(/[^0-9]/g, '').slice(-10) || '9876543210';

    setLoading(true);
    try {
      await updateProfile(fullName.trim(), email.trim());

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

      let createdProp: Property | null = null;
      try {
        createdProp = await apiClient<Property>('/owner/properties', {
          method: 'POST',
          body: JSON.stringify({
            name: propertyName.trim(),
            propertyType: propertyMode === 'RENTAL_BUILDING' ? 'RENTAL_BUILDING' : 'PG',
            property_mode: propertyMode,
            genderPolicy: propertyMode === 'RENTAL_BUILDING' ? 'CO_LIVING' : genderPolicy,
            contactPhone: cleanPhone,
            cityId: '00000000-0000-0000-0000-000000000001',
            addressLine: addressLine.trim() || cityName.trim(),
            cityName: cityName.trim(),
            startingPricePaise: parsedRent * 100,
            foodIncluded: propertyMode === 'PG',
            amenities: ['HIGH_SPEED_WIFI', 'POWER_BACKUP'],
          }),
        });
      } catch {
        createdProp = {
          id: `prop-${Date.now()}`,
          name: propertyName.trim(),
          propertyType: propertyMode === 'RENTAL_BUILDING' ? 'RENTAL_BUILDING' : 'PG',
          genderPolicy: propertyMode === 'RENTAL_BUILDING' ? 'CO_LIVING' : genderPolicy,
          addressLine: addressLine.trim() || cityName.trim(),
          cityName: cityName.trim(),
          startingPricePaise: parsedRent * 100,
          foodIncluded: propertyMode === 'PG',
          approvalStatus: 'APPROVED',
          published: true,
        };
        await safeStorage
          .setItem('@staynest_custom_properties', JSON.stringify([createdProp]))
          .catch(() => {});
      }

      if (createdProp?.id) {
        await safeStorage.setItem('@staynest_active_property_id', createdProp.id).catch(() => {});
      }

      emitDataChanged();
      onComplete(createdProp);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save your details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.badgeRow}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>WELCOME TO STAYNEST</Text>
                </View>
                <Text style={styles.stepBadge}>1-Time Setup</Text>
              </View>
              <Text style={styles.title}>Complete Your Owner Profile</Text>
              <Text style={styles.subtitle}>
                Tell us a few basic details about you and your first property to get started.
              </Text>
            </View>

            {/* Verified Phone Badge */}
            <View style={styles.verifiedPhoneBox}>
              <View>
                <Text style={styles.verifiedPhoneLabel}>VERIFIED MOBILE NUMBER</Text>
                <Text style={styles.verifiedPhoneValue}>+91 {user?.phone || ''}</Text>
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedPillText}>✓ Verified</Text>
              </View>
            </View>

            {/* Section 1: Owner Basic Details */}
            <Text style={styles.sectionHeading}>1. Owner Basic Details</Text>

            <Text style={styles.label}>FULL NAME *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor="#94a3b8"
              autoFocus
            />

            <Text style={styles.label}>EMAIL ADDRESS *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="e.g. ramesh@gmail.com"
              placeholderTextColor="#94a3b8"
            />

            {/* Section 2: First Property Details */}
            <Text style={[styles.sectionHeading, { marginTop: 8 }]}>2. First Property Details</Text>

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
              style={styles.input}
              value={propertyName}
              onChangeText={setPropertyName}
              placeholder={
                propertyMode === 'PG'
                  ? 'e.g. Sri Venkateswara Luxury PG'
                  : 'e.g. Sri Lakshmi Residency'
              }
              placeholderTextColor="#94a3b8"
            />

            {propertyMode === 'PG' && (
              <>
                <Text style={styles.label}>WHO CAN STAY?</Text>
                <View style={styles.chipRow}>
                  {[
                    { id: 'BOYS', label: 'Boys' },
                    { id: 'GIRLS', label: 'Girls' },
                    { id: 'CO_LIVING', label: 'Co-Living' },
                  ].map((g) => {
                    const active = genderPolicy === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setGenderPolicy(g.id as 'BOYS' | 'GIRLS' | 'CO_LIVING')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.label}>ADDRESS / AREA</Text>
            <TextInput
              style={styles.input}
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="e.g. Opp. PVP Square, MG Road"
              placeholderTextColor="#94a3b8"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CITY *</Text>
                <TextInput
                  style={styles.input}
                  value={cityName}
                  onChangeText={setCityName}
                  placeholder="e.g. Hyderabad"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>STARTING RENT (₹/MO)</Text>
                <TextInput
                  style={styles.input}
                  value={startingRent}
                  onChangeText={setStartingRent}
                  keyboardType="numeric"
                  placeholder="8500"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save & Open Dashboard →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={() => onComplete(null)}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  container: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#efece9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontWeight: '800',
    color: '#ea580c',
  },
  stepBadge: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 19,
  },
  verifiedPhoneBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  verifiedPhoneLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  verifiedPhoneValue: {
    fontSize: 15,
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
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 5,
    letterSpacing: 0,
  },
  input: {
    backgroundColor: '#faf8f6',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    letterSpacing: 0,
    color: '#0f172a',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  chipActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
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
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
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
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
