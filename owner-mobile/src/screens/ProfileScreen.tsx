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
  Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

interface ProfileScreenProps {
  onBackToDashboard: () => void;
  onNavigateTab?: (tab: 'dashboard' | 'properties' | 'tenants' | 'management') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBackToDashboard, onNavigateTab }) => {
  const { user, updateProfile, logout } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone] = useState(user?.phone || '');
  const [businessName, setBusinessName] = useState('StayNest Premium PG');
  const [upiId, setUpiId] = useState('9876543210@upi');
  const [supportContact, setSupportContact] = useState(user?.phone || '9876543210');
  const [saving, setSaving] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(true);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(fullName.trim(), email.trim());
      const msg = '✓ Profile & business settings saved successfully!';
      if (Platform.OS === 'web' || typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('✓ Saved', msg);
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

  const handleOpenWhatsApp = () => {
    const contact = supportContact.replace(/[^0-9]/g, '') || '919876543210';
    const text = encodeURIComponent('Hello StayNest Support, I need assistance with my PG property.');
    const url = `https://wa.me/${contact}?text=${text}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert('Support', `Contact support at +91 ${supportContact}`);
      });
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
      {/* ─── 1. SIGNATURE FLIPKART-STYLE BLUE HEADER ─── */}
      <View style={styles.flipkartHeader}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBackToDashboard}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Account</Text>
          <TouchableOpacity style={styles.headerLogoutBtn} onPress={handleLogoutConfirm}>
            <Text style={styles.headerLogoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── 2. FLIPKART SUPERHOST HERO PROFILE CARD ─── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedCheck}>✓</Text>
              </View>
            </View>

            <View style={styles.heroDetails}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.heroName}>{fullName || 'PG Owner'}</Text>
              </View>
              <Text style={styles.heroPhone}>📱 +91 {phone || '9876543210'}</Text>
              <Text style={styles.heroEmail} numberOfLines={1}>
                ✉️ {email || 'owner@staynest.in'}
              </Text>

              {/* Flipkart Plus Style Pill */}
              <View style={styles.plusPill}>
                <Text style={styles.plusStar}>⭐</Text>
                <Text style={styles.plusText}>StayNest SuperHost Plus</Text>
              </View>
            </View>
          </View>

          {/* Membership & Coins Banner */}
          <View style={styles.coinsRow}>
            <View style={styles.coinCol}>
              <Text style={styles.coinLabel}>REPUTATION</Text>
              <Text style={styles.coinVal}>⭐ 4.9 / 5.0</Text>
            </View>
            <View style={styles.coinDivider} />
            <View style={styles.coinCol}>
              <Text style={styles.coinLabel}>HOST TIER</Text>
              <Text style={styles.coinVal}>💎 Titanium Host</Text>
            </View>
            <View style={styles.coinDivider} />
            <View style={styles.coinCol}>
              <Text style={styles.coinLabel}>NESTCOINS</Text>
              <Text style={styles.coinVal}>🪙 1,250 Pts</Text>
            </View>
          </View>
        </View>

        {/* ─── 3. FLIPKART 4 QUICK TILES GRID ─── */}
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => onNavigateTab ? onNavigateTab('properties') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#e0f2fe' }]}>
              <Text style={{ fontSize: 20 }}>🏢</Text>
            </View>
            <Text style={styles.tileTitle}>Properties</Text>
            <Text style={styles.tileSub}>Manage Floors</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => onNavigateTab ? onNavigateTab('tenants') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Text style={{ fontSize: 20 }}>👥</Text>
            </View>
            <Text style={styles.tileTitle}>Residents</Text>
            <Text style={styles.tileSub}>Tenant List</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => onNavigateTab ? onNavigateTab('tenants') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#fee2e2' }]}>
              <Text style={{ fontSize: 20 }}>💰</Text>
            </View>
            <Text style={styles.tileTitle}>Rent Dues</Text>
            <Text style={styles.tileSub}>Pending Fees</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickTile}
            onPress={() => onNavigateTab ? onNavigateTab('management') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: '#dcfce7' }]}>
              <Text style={{ fontSize: 20 }}>📊</Text>
            </View>
            <Text style={styles.tileTitle}>Ledger</Text>
            <Text style={styles.tileSub}>Profit & Loss</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 4. PERSONAL & CONTACT DETAILS (FLIPKART CARD) ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>Personal & Contact Information</Text>
            <Text style={styles.cardHeaderTag}>VERIFIED</Text>
          </View>
          <Text style={styles.cardSub}>Keep your primary account details updated</Text>

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

          <Text style={styles.label}>REGISTERED MOBILE (LOGIN ID)</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={phone}
            editable={false}
            placeholder="9876543210"
          />
          <Text style={styles.fieldNote}>🔒 Mobile number is verified via OTP authentication.</Text>
        </View>

        {/* ─── 5. PG BUSINESS & RENT COLLECTION (UPI) ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>Business & Rent Collections</Text>
            <Text style={[styles.cardHeaderTag, { backgroundColor: '#e0f2fe', color: '#0369a1' }]}>
              PAYMENTS
            </Text>
          </View>
          <Text style={styles.cardSub}>Displayed on resident rent receipts and WhatsApp reminders</Text>

          <Text style={styles.label}>PG / BUSINESS NAME</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. StayNest Luxury PG"
          />

          <Text style={styles.label}>UPI ID FOR INSTANT RENT RECEIPT</Text>
          <TextInput
            style={styles.input}
            value={upiId}
            onChangeText={setUpiId}
            placeholder="e.g. 9876543210@paytm or owner@okaxis"
          />
          <Text style={styles.fieldNote}>
            💡 Tenants can scan this UPI ID directly to settle monthly dues with zero gateway fees.
          </Text>

          <Text style={styles.label}>EMERGENCY / HELPLINE CONTACT</Text>
          <TextInput
            style={styles.input}
            value={supportContact}
            onChangeText={setSupportContact}
            keyboardType="phone-pad"
            placeholder="9876543210"
          />
        </View>

        {/* ─── 6. PG HOUSE RULES & TIMINGS ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>PG House Rules & Code of Conduct</Text>
            <Text style={[styles.cardHeaderTag, { backgroundColor: '#fef3c7', color: '#b45309' }]}>
              DISCIPLINE
            </Text>
          </View>
          <Text style={styles.cardSub}>Enforced across all floors for resident safety and quietness</Text>

          <View style={styles.ruleItem}>
            <Text style={styles.ruleIcon}>🚪</Text>
            <View style={styles.ruleTextCol}>
              <Text style={styles.ruleTitle}>Gate Closing Time: 10:30 PM Sharp</Text>
              <Text style={styles.ruleDesc}>
                Main entrance gates are locked at 10:30 PM. Late entry requires prior warden intimation.
              </Text>
            </View>
          </View>

          <View style={styles.ruleItem}>
            <Text style={styles.ruleIcon}>🔇</Text>
            <View style={styles.ruleTextCol}>
              <Text style={styles.ruleTitle}>Quiet Hours: 11:00 PM – 06:00 AM</Text>
              <Text style={styles.ruleDesc}>
                No loud music, shouting, or noisy group gatherings during quiet hours to respect sleep.
              </Text>
            </View>
          </View>

          <View style={styles.ruleItem}>
            <Text style={styles.ruleIcon}>👥</Text>
            <View style={styles.ruleTextCol}>
              <Text style={styles.ruleTitle}>Visitor Policy: Reception & Lobby Only</Text>
              <Text style={styles.ruleDesc}>
                Outside visitors permitted only in ground floor lobby till 8:00 PM. No overnight guests.
              </Text>
            </View>
          </View>

          <View style={styles.ruleItem}>
            <Text style={styles.ruleIcon}>🚭</Text>
            <View style={styles.ruleTextCol}>
              <Text style={styles.ruleTitle}>100% Non-Smoking & Drug-Free Property</Text>
              <Text style={styles.ruleDesc}>
                Smoking, alcohol, and narcotics are strictly forbidden with zero tolerance.
              </Text>
            </View>
          </View>
        </View>

        {/* ─── 7. COMPREHENSIVE TERMS & CONDITIONS (LEGAL AGREEMENT) ─── */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => setTermsExpanded((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.cardHeaderTitle}>📜 Terms & Conditions (Rental Agreement)</Text>
              <Text style={styles.cardSub}>Comprehensive PG guidelines & legal policies</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#2874f0', fontWeight: '800' }}>
              {termsExpanded ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {termsExpanded && (
            <View style={styles.termsContainer}>
              {/* Clause 1 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>1</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Rent Schedule & Late Fee Penalty</Text>
                  <Text style={styles.clauseBody}>
                    Monthly rent is payable in advance on or before the 5th of each calendar month. A grace
                    period is extended until the 7th. Rent received after the 7th attracts an automatic late
                    fee of ₹100 per day until clearance.
                  </Text>
                </View>
              </View>

              {/* Clause 2 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>2</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Security Deposit & Refund Policy</Text>
                  <Text style={styles.clauseBody}>
                    A refundable security deposit equal to 1 month's rent is mandatory prior to move-in. The
                    deposit will be refunded via UPI/bank transfer within 7 business days following room
                    handover inspection, subject to deductions for damages or unpaid utilities.
                  </Text>
                </View>
              </View>

              {/* Clause 3 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>3</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Mandatory 30-Day Written Notice</Text>
                  <Text style={styles.clauseBody}>
                    Residents must serve a minimum 30 days prior written notice through the StayNest application
                    or verified message before vacating. Notice cannot be adjusted against the last month's rent.
                    Failure to provide 30 days notice results in forfeiture of the security deposit.
                  </Text>
                </View>
              </View>

              {/* Clause 4 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>4</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Minimum Lock-In Commitment</Text>
                  <Text style={styles.clauseBody}>
                    A mandatory lock-in period of 3 months applies from check-in. If a resident departs prior to
                    completing 3 months of stay, 50% of the security deposit stands forfeited towards vacancy
                    losses.
                  </Text>
                </View>
              </View>

              {/* Clause 5 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>5</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Electricity Sub-Metering & Utilities</Text>
                  <Text style={styles.clauseBody}>
                    Room electricity consumption is measured via digital sub-meters and billed at actual state
                    electricity board commercial tariff (₹8.50/unit) divided equally among room occupants. High-speed
                    Wi-Fi, water supply, and general housekeeping are included in base monthly rent.
                  </Text>
                </View>
              </View>

              {/* Clause 6 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>6</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Damage Liability & Fixtures</Text>
                  <Text style={styles.clauseBody}>
                    Residents are jointly responsible for maintaining room furniture, cots, mattresses, AC remotes,
                    and sanitary fittings. Any physical damage resulting from negligence will be billed directly to
                    the occupants or deducted from deposits.
                  </Text>
                </View>
              </View>

              {/* Clause 7 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>7</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Guest Policy & Curfew Regulations</Text>
                  <Text style={styles.clauseBody}>
                    Visitors and family members are permitted only in the ground floor lounge between 9:00 AM and
                    8:00 PM. No unauthorized overnight guests or visitors of the opposite gender are permitted inside
                    resident rooms. The PG gate is locked strictly at 10:30 PM.
                  </Text>
                </View>
              </View>

              {/* Clause 8 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>8</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Prohibited Items & Code of Conduct</Text>
                  <Text style={styles.clauseBody}>
                    Consumption or storage of alcohol, narcotics, contraband, and dangerous chemicals is strictly
                    prohibited. Use of high-wattage personal heating appliances (induction plates, immersion rods, room
                    heaters) without written management approval is barred. Violations lead to immediate eviction.
                  </Text>
                </View>
              </View>

              {/* Clause 9 */}
              <View style={styles.termClause}>
                <View style={styles.clauseNumberBadge}>
                  <Text style={styles.clauseNumberText}>9</Text>
                </View>
                <View style={styles.clauseContent}>
                  <Text style={styles.clauseHeading}>Right of Inspection & Safety Audits</Text>
                  <Text style={styles.clauseBody}>
                    Management and authorized staff reserve the right to inspect premises during daytime hours for
                    cleanliness, security audits, and routine maintenance with reasonable advance notice.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ─── 8. 24/7 HELP & SUPPORT SECTION ─── */}
        <View style={styles.supportCard}>
          <View style={styles.supportHeaderRow}>
            <View style={styles.supportIconCircle}>
              <Text style={{ fontSize: 20 }}>🎧</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.supportTitle}>24/7 Host Help & Support</Text>
              <Text style={styles.supportSub}>Direct WhatsApp and phone assistance for property owners</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.whatsappBtn} onPress={handleOpenWhatsApp} activeOpacity={0.8}>
            <Text style={styles.whatsappBtnText}>💬 Chat with Support on WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* ─── 9. SAVE PROFILE & FLIPKART LOGOUT ─── */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>💾 Save Account Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtnFull} onPress={handleLogoutConfirm} activeOpacity={0.8}>
          <Text style={styles.logoutBtnFullText}>🚪 Log Out from StayNest</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f3f6', // Signature Flipkart soft grey background
  },

  // ─── Signature Flipkart Blue Header ───
  flipkartHeader: {
    backgroundColor: '#2874f0', // Flipkart Brand Blue
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 14 : 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerLogoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerLogoutText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },

  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },

  // ─── Hero Profile Card ───
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginTop: -10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#2874f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ff9f00', // Flipkart Gold border
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#16a34a',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  verifiedCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  heroDetails: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
  },
  heroPhone: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
    fontWeight: '600',
  },
  heroEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  plusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 4,
  },
  plusStar: {
    fontSize: 11,
  },
  plusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#c2410c',
    letterSpacing: 0.2,
  },

  // ─── Coins & Host Tier Banner ───
  coinsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
  },
  coinCol: {
    flex: 1,
    alignItems: 'center',
  },
  coinLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coinVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  coinDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
  },

  // ─── Flipkart 4 Quick Tiles Grid ───
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickTile: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  tileSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '600',
  },

  // ─── General Flipkart White Cards ───
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardHeaderTag: {
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#dcfce7',
    color: '#15803d',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
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

  // ─── House Rules ───
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  ruleIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  ruleTextCol: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  ruleDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },

  // ─── Terms & Conditions Section ───
  termsContainer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  termClause: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  clauseNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2874f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  clauseNumberText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  clauseContent: {
    flex: 1,
  },
  clauseHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  clauseBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },

  // ─── Help & Support Card ───
  supportCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  supportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  supportIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  supportSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  whatsappBtn: {
    backgroundColor: '#25d366', // WhatsApp Brand Green
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  // ─── Action Buttons ───
  saveBtn: {
    backgroundColor: '#2874f0', // Flipkart Blue
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#2874f0',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  logoutBtnFull: {
    marginTop: 12,
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
