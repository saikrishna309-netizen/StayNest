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
} from 'react-native';
import { useAuth } from '../context/AuthContext';

interface OwnerRegistrationScreenProps {
  onComplete: () => void;
}

export const OwnerRegistrationScreen: React.FC<OwnerRegistrationScreenProps> = ({ onComplete }) => {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName && user.fullName !== 'PG Owner' ? user.fullName : '');
  const [email, setEmail] = useState(user?.email && !user.email.startsWith('owner_') ? user.email : '');
  const [pgBrand, setPgBrand] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your Full Name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Required', 'Please enter a valid Email ID');
      return;
    }

    setLoading(true);
    try {
      await updateProfile(fullName, email);
      Alert.alert('Profile Created', `Welcome to StayNest-PG, ${fullName}! Let's set up your property.`);
      onComplete();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>OWNER REGISTRATION</Text>
              <Text style={styles.stepBadge}>Step 2 of 2</Text>
            </View>
            <Text style={styles.title}>
              Stay<Text style={styles.brandTitle}>Nest</Text><Text style={styles.pgTag}>-PG</Text>
            </Text>
            <Text style={styles.subtitle}>
              Create your owner account & business profile to manage your properties with clarity.
            </Text>
          </View>

          {/* Verified Phone Badge */}
          <View style={styles.verifiedPhoneBox}>
            <View>
              <Text style={styles.verifiedPhoneLabel}>VERIFIED MOBILE NUMBER</Text>
              <Text style={styles.verifiedPhoneValue}>+91 {user?.phone || '9876543210'}</Text>
            </View>
            <View style={styles.verifiedPill}>
              <Text style={styles.verifiedPillText}>✓ Verified</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>OWNER FULL NAME *</Text>
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

            <Text style={styles.label}>PRIMARY PG / HOSTEL BRAND NAME</Text>
            <TextInput
              style={styles.input}
              value={pgBrand}
              onChangeText={setPgBrand}
              placeholder="e.g. Sri Venkateswara Luxury PG"
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Profile & Continue →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
              <Text style={styles.skipText}>Skip to Dashboard for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    letterSpacing: 1,
  },
  stepBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandTitle: {
    color: '#4f46e5',
  },
  pgTag: {
    color: '#f59e0b',
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  verifiedPhoneBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  verifiedPhoneLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  verifiedPhoneValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  verifiedPill: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  form: {
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
});
