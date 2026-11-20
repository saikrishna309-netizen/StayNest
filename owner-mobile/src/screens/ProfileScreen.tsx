import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

interface ProfileScreenProps {
  onBackToDashboard: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBackToDashboard }) => {
  const { user, updateProfile, logout } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone] = useState(user?.phone || '');
  const [businessName, setBusinessName] = useState('StayNest PG Properties');
  const [upiId, setUpiId] = useState('pgowner@upi');
  const [supportContact, setSupportContact] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(fullName.trim(), email.trim());
      if (Platform.OS === 'web' || typeof window !== 'undefined') {
        window.alert('✓ Profile updated successfully!');
      } else {
        Alert.alert('✓ Saved', 'Profile updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Profile changes saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutConfirm = () => {
    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to log out from StayNest?')) {
        logout();
      }
    } else {
      Alert.alert(
        'Confirm Logout',
        'Are you sure you want to log out from StayNest?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: logout },
        ]
      );
    }
  };

  const initials = fullName
    ? fullName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : 'PO';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBackToDashboard}>
          <Text style={styles.backBtnText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Owner Profile</Text>
        <TouchableOpacity style={styles.headerLogoutBtn} onPress={handleLogoutConfirm}>
          <Text style={styles.headerLogoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.profileHeroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{fullName || 'PG Owner'}</Text>
            <Text style={styles.heroPhone}>📱 +91 {phone || '9876543210'}</Text>
            <View style={styles.roleBadgeRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>PG OWNER • ADMIN</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>ACTIVE</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Business Overview Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>🏢 Verified</Text>
            <Text style={styles.statLabel}>Owner Status</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>⚡ Active</Text>
            <Text style={styles.statLabel}>Portal Access</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>v1.0.0</Text>
            <Text style={styles.statLabel}>App Version</Text>
          </View>
        </View>

        {/* Edit Profile Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal & Contact Details</Text>
          <Text style={styles.cardSub}>Keep your contact details up to date</Text>

          <Text style={styles.label}>FULL NAME *</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Ramesh Sharma"
          />

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="owner@staynest.in"
          />

          <Text style={styles.label}>MOBILE NUMBER (LOGIN ID)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={phone}
            editable={false}
            placeholder="9876543210"
          />
          <Text style={styles.fieldNote}>🔒 Registered mobile number linked with OTP authentication.</Text>
        </View>

        {/* PG Business & UPI Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Business & Rent Collection</Text>
          <Text style={styles.cardSub}>Information displayed on tenant invoices and payment reminders</Text>

          <Text style={styles.label}>PG / BUSINESS NAME</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. StayNest Luxury PG"
          />

          <Text style={styles.label}>UPI ID FOR RENT COLLECTIONS</Text>
          <TextInput
            style={styles.input}
            value={upiId}
            onChangeText={setUpiId}
            placeholder="e.g. 9876543210@paytm or owner@okaxis"
          />
          <Text style={styles.fieldNote}>💡 Tenants receive this UPI ID in payment reminders to pay rent directly.</Text>

          <Text style={styles.label}>EMERGENCY / SUPPORT CONTACT</Text>
          <TextInput
            style={styles.input}
            value={supportContact}
            onChangeText={setSupportContact}
            keyboardType="phone-pad"
            placeholder="9876543210"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>💾 Save Profile Changes</Text>
          )}
        </TouchableOpacity>

        {/* Logout Section */}
        <TouchableOpacity style={styles.logoutBtnFull} onPress={handleLogoutConfirm}>
          <Text style={styles.logoutBtnFullText}>🚪 Logout from StayNest</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4f46e5',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerLogoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  headerLogoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  scrollContent: {
    padding: 16,
  },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroPhone: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  roleBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  roleBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6d28d9',
  },
  statusBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginTop: 10,
    marginBottom: 5,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  fieldNote: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  logoutBtnFull: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutBtnFullText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '800',
  },
});
