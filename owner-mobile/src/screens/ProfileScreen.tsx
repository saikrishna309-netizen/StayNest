import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { GooglePayLogo, PhonePeLogo, PaytmLogo, CardPaymentLogo } from '../components/PaymentLogos';

interface ProfileScreenProps {
  onBackToDashboard: () => void;
  onNavigateTab?: (tab: 'dashboard' | 'properties' | 'tenants' | 'management') => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBackToDashboard, onNavigateTab }) => {
  const { user, updateProfile, logout } = useAuth();

  // Profile data
  const [fullName, setFullName] = useState(user?.fullName || 'Ramesh Kumar');
  const [email, setEmail] = useState(user?.email || 'ramesh@example.com');
  const [phone, setPhone] = useState(user?.phone || '9876543210');
  const [location, setLocation] = useState('Bengaluru, Karnataka');
  const [pgName, setPgName] = useState('Ramesh PG');

  // Custom Editable Images (Requirement 9)
  const defaultAvatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80';
  const defaultBanner = 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1000&q=80';
  const defaultPgPhoto = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';

  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [bannerUrl, setBannerUrl] = useState(defaultBanner);

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(fullName);
  const [editEmail, setEditEmail] = useState(email);
  const [editPhone, setEditPhone] = useState(phone);
  const [editLocation, setEditLocation] = useState(location);
  const [editAvatarUrl, setEditAvatarUrl] = useState(avatarUrl);
  const [editBannerUrl, setEditBannerUrl] = useState(bannerUrl);
  const [savingProfile, setSavingProfile] = useState(false);

  // Subscription Modal & Auto-Pay State (Requirements 6, 7, 8)
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [selectedPlanPeriod, setSelectedPlanPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [autoPayMethod, setAutoPayMethod] = useState<'GPAY' | 'PHONEPE' | 'PAYTM' | 'CARD'>('GPAY');
  const [subscribing, setSubscribing] = useState(false);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);

  // Load custom profile & banner from AsyncStorage
  useEffect(() => {
    const loadSavedProfile = async () => {
      try {
        const savedData = await AsyncStorage.getItem('@staynest_owner_custom_profile');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed.fullName) setFullName(parsed.fullName);
          if (parsed.email) setEmail(parsed.email);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.location) setLocation(parsed.location);
          if (parsed.avatarUrl) setAvatarUrl(parsed.avatarUrl);
          if (parsed.bannerUrl) setBannerUrl(parsed.bannerUrl);
        }
      } catch (e) {
        console.log('Error loading saved profile:', e);
      }
    };
    loadSavedProfile();
  }, []);

  // Save Profile Changes
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }

    setSavingProfile(true);
    try {
      setFullName(editName.trim());
      setEmail(editEmail.trim());
      setPhone(editPhone.trim());
      setLocation(editLocation.trim());
      setAvatarUrl(editAvatarUrl.trim() || defaultAvatar);
      setBannerUrl(editBannerUrl.trim() || defaultBanner);

      const profilePayload = {
        fullName: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        location: editLocation.trim(),
        avatarUrl: editAvatarUrl.trim() || defaultAvatar,
        bannerUrl: editBannerUrl.trim() || defaultBanner,
      };

      await AsyncStorage.setItem('@staynest_owner_custom_profile', JSON.stringify(profilePayload));
      await updateProfile(editName.trim(), editEmail.trim());

      setIsEditModalOpen(false);
      Alert.alert('Profile Updated! 🎉', 'Your profile details and custom photos have been saved successfully.');
    } catch {
      setIsEditModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  // Confirm Auto-Pay Mandate (Direct to payment app, no WhatsApp message)
  const handleConfirmAutoPay = async () => {
    setSubscribing(true);
    try {
      const planName = selectedPlanPeriod === 'MONTHLY' ? 'Monthly Plan (₹99/mo)' : 'Annual Plan (₹1,099/yr)';
      setIsSubscriptionActive(true);
      setIsSubscriptionModalOpen(false);

      // Deep link to direct internal payment application if available
      const upiId = 'staynest.subscription@okaxis';
      const payeeName = encodeURIComponent('StayNest Technologies');
      const note = encodeURIComponent(`StayNest AutoPay ${planName}`);
      let targetUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=0&cu=INR&tn=${note}`;

      if (autoPayMethod === 'PHONEPE') {
        targetUrl = `phonepe://pay?pa=${upiId}&pn=${payeeName}&am=0&cu=INR&tn=${note}`;
      } else if (autoPayMethod === 'GPAY') {
        targetUrl = `gpay://upi/pay?pa=${upiId}&pn=${payeeName}&am=0&cu=INR&tn=${note}`;
      } else if (autoPayMethod === 'PAYTM') {
        targetUrl = `paytmmp://pay?pa=${upiId}&pn=${payeeName}&am=0&cu=INR&tn=${note}`;
      }

      try {
        const canOpen = await Linking.canOpenURL(targetUrl);
        if (canOpen) {
          await Linking.openURL(targetUrl);
        } else {
          const genericUpi = `upi://pay?pa=${upiId}&pn=${payeeName}&am=0&cu=INR&tn=${note}`;
          const canUpi = await Linking.canOpenURL(genericUpi);
          if (canUpi) {
            await Linking.openURL(genericUpi);
          } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.href = genericUpi;
          }
        }
      } catch (e) {
        console.log('Payment app open error:', e);
      }

      const appLabel = autoPayMethod === 'PHONEPE' ? 'PhonePe' : autoPayMethod === 'GPAY' ? 'Google Pay' : autoPayMethod === 'PAYTM' ? 'Paytm' : 'Payment Gateway';
      Alert.alert(
        'Redirecting to ' + appLabel + ' 💳',
        `Opening ${appLabel} to authorize ₹0 Auto-Pay for ${planName}!\n\nYour StayNest Unlimited Plan will activate instantly upon authorization.`
      );
    } finally {
      setSubscribing(false);
    }
  };

  // Logout confirmation
  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to log out from StayNest?')) {
        logout();
      }
    } else {
      Alert.alert('Confirm Logout', 'Are you sure you want to log out from StayNest?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ─── 1. TOP APP BAR ─── */}
        <View style={styles.topBar}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          <View style={styles.topBarRight}>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>2</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={{ fontSize: 18 }}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 2. HERO PROFILE CARD WITH EDITABLE BANNER & AVATAR (EXACT SCREENSHOT) ─── */}
        <View style={styles.profileHeroCard}>
          {/* Background Illustration Banner */}
          <View style={styles.bannerWrapper}>
            <Image
              source={{ uri: bannerUrl }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            {/* Banner Change Pill Button */}
            <TouchableOpacity
              style={styles.editBannerPill}
              onPress={() => {
                setEditBannerUrl(bannerUrl);
                setIsEditModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.editBannerPillText}>📷 Change Banner</Text>
            </TouchableOpacity>
          </View>

          {/* Profile Card Foreground Content */}
          <View style={styles.profileContentRow}>
            {/* Circular Avatar with Crown & Online Indicator */}
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
              />
              {/* Gold Crown Badge */}
              <View style={styles.crownBadge}>
                <Text style={{ fontSize: 11 }}>👑</Text>
              </View>
              {/* Green Online Dot */}
              <View style={styles.onlineDot} />
            </View>

            {/* Profile Info Details */}
            <View style={styles.profileDetailsCol}>
              <Text style={styles.profileName}>{fullName}</Text>

              {/* PG Owner Tag */}
              <View style={styles.ownerTagRow}>
                <View style={styles.ownerTagPill}>
                  <Text style={{ fontSize: 11 }}>👑</Text>
                  <Text style={styles.ownerTagText}>PG Owner</Text>
                </View>
              </View>

              <Text style={styles.profileContactText}>📞 +91 {phone}</Text>
              <Text style={styles.profileContactText} numberOfLines={1}>✉️ {email}</Text>
              <Text style={styles.profileLocationText}>📍 {location}</Text>
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => {
                setEditName(fullName);
                setEditEmail(email);
                setEditPhone(phone);
                setEditLocation(location);
                setEditAvatarUrl(avatarUrl);
                setEditBannerUrl(bannerUrl);
                setIsEditModalOpen(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.editProfileBtnText}>✏️ Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 3. FOUR STAT PILLS (ROW OF 4) ─── */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <View style={[styles.statIconCircle, { backgroundColor: '#e0f2fe' }]}>
              <Text style={{ fontSize: 16 }}>🏠</Text>
            </View>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>Properties</Text>
          </View>

          <View style={styles.statPill}>
            <View style={[styles.statIconCircle, { backgroundColor: '#dcfce7' }]}>
              <Text style={{ fontSize: 16 }}>👥</Text>
            </View>
            <Text style={styles.statNumber}>45</Text>
            <Text style={styles.statLabel}>Total Beds</Text>
          </View>

          <View style={styles.statPill}>
            <View style={[styles.statIconCircle, { backgroundColor: '#ede9fe' }]}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </View>
            <Text style={styles.statNumber}>32</Text>
            <Text style={styles.statLabel}>Occupied</Text>
          </View>

          <View style={styles.statPill}>
            <View style={[styles.statIconCircle, { backgroundColor: '#ffedd5' }]}>
              <Text style={{ fontSize: 16 }}>🛏️</Text>
            </View>
            <Text style={styles.statNumber}>13</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
        </View>

        {/* ─── 4. MIDDLE TWO CARDS (PG DETAILS & SUBSCRIPTION PLAN) ─── */}
        <View style={styles.cardsRow}>
          {/* Card A: PG Details */}
          <View style={styles.halfCard}>
            <TouchableOpacity
              style={styles.cardHeaderNav}
              onPress={() => onNavigateTab && onNavigateTab('properties')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>🏢</Text>
                <Text style={styles.cardHeaderTitle}>PG Details</Text>
              </View>
              <Text style={styles.chevronIcon}>›</Text>
            </TouchableOpacity>

            <View style={styles.pgPhotoContainer}>
              <Image
                source={{ uri: defaultPgPhoto }}
                style={styles.pgPhotoImage}
                resizeMode="cover"
              />
            </View>

            <View style={styles.pgInfoBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.pgCardName}>{pgName}</Text>
                <View style={styles.activeGreenBadge}>
                  <Text style={styles.activeGreenBadgeText}>Active</Text>
                </View>
              </View>

              <Text style={styles.pgCardLocation}>📍 {location}</Text>
              <Text style={styles.pgCardFeature}>🏢 3 Floors | 12 Rooms</Text>
              <Text style={styles.pgCardFeature}>👥 Triple, Double & Single Sharing</Text>
              <Text style={styles.pgCardFeature}>📶 Wi-Fi, AC, Food Included</Text>

              <TouchableOpacity
                style={styles.viewPropertyBtn}
                onPress={() => onNavigateTab && onNavigateTab('properties')}
                activeOpacity={0.8}
              >
                <Text style={styles.viewPropertyBtnText}>View Property Details →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Card B: Subscription Plan */}
          <View style={styles.halfCard}>
            <TouchableOpacity
              style={styles.cardHeaderNav}
              onPress={() => setIsSubscriptionModalOpen(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>👑</Text>
                <Text style={styles.cardHeaderTitle}>Subscription Plan</Text>
              </View>
              <Text style={styles.chevronIcon}>›</Text>
            </TouchableOpacity>

            <View style={styles.subPlanCardContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={styles.starBadgePill}>
                  <Text style={{ fontSize: 11 }}>⭐</Text>
                  <Text style={styles.starBadgeText}>Premium Plan</Text>
                </View>
                <View style={styles.activeGreenBadge}>
                  <Text style={styles.activeGreenBadgeText}>Active</Text>
                </View>
              </View>

              <View style={styles.subPriceWrap}>
                <Text style={styles.subPriceBig}>
                  ₹99 <Text style={styles.subPricePerMonth}>/ month</Text>
                </Text>
                <Text style={styles.subCrownWatermark}>👑</Text>
              </View>

              <View style={styles.subFeatureList}>
                <View style={styles.subFeatureItem}>
                  <Text style={styles.subGreenCheck}>✓</Text>
                  <Text style={styles.subFeatureItemText}>Manage up to 5 PGs</Text>
                </View>
                <View style={styles.subFeatureItem}>
                  <Text style={styles.subGreenCheck}>✓</Text>
                  <Text style={styles.subFeatureItemText}>Unlimited WhatsApp Messages</Text>
                </View>
                <View style={styles.subFeatureItem}>
                  <Text style={styles.subGreenCheck}>✓</Text>
                  <Text style={styles.subFeatureItemText}>Advanced Reports & Analytics</Text>
                </View>
                <View style={styles.subFeatureItem}>
                  <Text style={styles.subGreenCheck}>✓</Text>
                  <Text style={styles.subFeatureItemText}>Priority Support</Text>
                </View>
              </View>

              <Text style={styles.nextBillingText}>📅 Next Billing: 15 Dec 2026</Text>

              <TouchableOpacity
                style={styles.manageSubBtn}
                onPress={() => setIsSubscriptionModalOpen(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.manageSubBtnText}>Manage Subscription</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── 5. LOWER TWO CARDS (MY TENANTS & QUICK ACTIONS) ─── */}
        <View style={styles.cardsRow}>
          {/* Card C: My Tenants */}
          <View style={styles.halfCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>👥</Text>
                <Text style={styles.cardHeaderTitle}>My Tenants</Text>
              </View>
            </View>

            <View style={styles.tenantsRow}>
              {[
                { name: 'Amit Sharma', room: 'Room 101-B', status: 'PAID', photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' },
                { name: 'Rahul Kumar', room: 'Room 101-A', status: 'DUE', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' },
                { name: 'Priya Singh', room: 'Room 102-A', status: 'PAID', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' },
                { name: 'Arjun Reddy', room: 'Room 201-C', status: 'PAID', photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80' },
              ].map((t, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.tenantPillCol}
                  onPress={() => onNavigateTab && onNavigateTab('tenants')}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: t.photo }} style={styles.tenantAvatarThumb} />
                  <Text style={styles.tenantThumbName} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.tenantThumbRoom}>{t.room}</Text>
                  <View style={[styles.statusSmallBadge, t.status === 'PAID' ? styles.statusPaidBg : styles.statusDueBg]}>
                    <Text style={[styles.statusSmallText, t.status === 'PAID' ? styles.statusPaidText : styles.statusDueText]}>
                      {t.status === 'PAID' ? 'Paid' : 'Due'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Card D: Quick Actions (2x2 Grid) */}
          <View style={styles.halfCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>⚡</Text>
                <Text style={styles.cardHeaderTitle}>Quick Actions</Text>
              </View>
            </View>

            <View style={styles.quickGrid}>
              <TouchableOpacity
                style={styles.quickActionTile}
                onPress={() => onNavigateTab && onNavigateTab('tenants')}
                activeOpacity={0.75}
              >
                <Text style={styles.quickTileIcon}>👤+</Text>
                <Text style={styles.quickTileLabel}>Add Tenant</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionTile}
                onPress={() => onNavigateTab && onNavigateTab('tenants')}
                activeOpacity={0.75}
              >
                <Text style={styles.quickTileIcon}>₹</Text>
                <Text style={styles.quickTileLabel}>Record Rent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionTile}
                onPress={() => onNavigateTab && onNavigateTab('management')}
                activeOpacity={0.75}
              >
                <Text style={styles.quickTileIcon}>📄</Text>
                <Text style={styles.quickTileLabel}>Add Expense</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionTile}
                onPress={() => onNavigateTab && onNavigateTab('management')}
                activeOpacity={0.75}
              >
                <Text style={styles.quickTileIcon}>📊</Text>
                <Text style={styles.quickTileLabel}>View Reports</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── MODAL 1: EDIT PROFILE, PHOTO & BACKGROUND BANNER (REQUIREMENT 9) ─── */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Edit Owner Profile</Text>
                <Text style={styles.modalSub}>Update your personal details, profile photo & banner</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Profile Photo URL Input */}
              <Text style={styles.fieldLabel}>PROFILE PHOTO URL</Text>
              <TextInput
                style={styles.inputField}
                value={editAvatarUrl}
                onChangeText={setEditAvatarUrl}
                placeholder="Enter image URL for avatar"
                placeholderTextColor="#94a3b8"
              />

              {/* Background Banner URL Input */}
              <Text style={styles.fieldLabel}>BACKGROUND BANNER URL</Text>
              <TextInput
                style={styles.inputField}
                value={editBannerUrl}
                onChangeText={setEditBannerUrl}
                placeholder="Enter image URL for heritage banner"
                placeholderTextColor="#94a3b8"
              />

              {/* Full Name */}
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <TextInput
                style={styles.inputField}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ramesh Kumar"
                placeholderTextColor="#94a3b8"
              />

              {/* Email Address */}
              <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.inputField}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="ramesh@example.com"
                placeholderTextColor="#94a3b8"
              />

              {/* Phone Number */}
              <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
              <TextInput
                style={styles.inputField}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="number-pad"
                placeholder="9876543210"
                placeholderTextColor="#94a3b8"
              />

              {/* City / Location */}
              <Text style={styles.fieldLabel}>CITY / LOCATION</Text>
              <TextInput
                style={styles.inputField}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Bengaluru, Karnataka"
                placeholderTextColor="#94a3b8"
              />

              <TouchableOpacity
                style={[styles.saveModalBtn, savingProfile && styles.btnDisabled]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveModalBtnText}>Save Profile & Photos</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: SUBSCRIPTION & ₹0 AUTO-PAY SETUP (REQUIREMENTS 6, 7, 8) ─── */}
      <Modal
        visible={isSubscriptionModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSubscriptionModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Setup Auto-Pay Subscription</Text>
                <Text style={styles.modalSub}>First 30 days are 100% free • Cancel anytime</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSubscriptionModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Plan Cards */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[
                    styles.modalPlanCard,
                    selectedPlanPeriod === 'MONTHLY' && styles.modalPlanCardSelected,
                  ]}
                  onPress={() => setSelectedPlanPeriod('MONTHLY')}
                >
                  <View style={styles.modalPlanTopRow}>
                    <Text style={styles.modalPlanTitle}>Monthly Plan</Text>
                    <Text style={styles.modalPlanTag}>POPULAR</Text>
                  </View>
                  <Text style={styles.modalPlanPrice}>₹99 <Text style={{ fontSize: 12, color: '#64748b' }}>/ mo</Text></Text>
                  <Text style={styles.modalPlanSub}>Billed monthly after trial</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalPlanCard,
                    selectedPlanPeriod === 'YEARLY' && styles.modalPlanCardSelected,
                  ]}
                  onPress={() => setSelectedPlanPeriod('YEARLY')}
                >
                  <View style={styles.modalPlanTopRow}>
                    <Text style={styles.modalPlanTitle}>Yearly Plan</Text>
                    <Text style={[styles.modalPlanTag, { backgroundColor: '#dcfce7', color: '#15803d' }]}>SAVE 8%</Text>
                  </View>
                  <Text style={styles.modalPlanPrice}>₹1,099 <Text style={{ fontSize: 12, color: '#64748b' }}>/ yr</Text></Text>
                  <Text style={styles.modalPlanSub}>2 months free included</Text>
                </TouchableOpacity>
              </View>

              {/* Mandate Summary */}
              <View style={styles.mandateSummary}>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateKey}>Initial Charge Today:</Text>
                  <Text style={[styles.mandateVal, { color: '#16a34a', fontWeight: '900' }]}>₹0 (FREE TRIAL)</Text>
                </View>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateKey}>Auto-Pay Recurring:</Text>
                  <Text style={styles.mandateVal}>{selectedPlanPeriod === 'MONTHLY' ? '₹99 / month' : '₹1,099 / year'}</Text>
                </View>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateKey}>First Deduction Date:</Text>
                  <Text style={styles.mandateVal}>15 Dec 2026</Text>
                </View>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateKey}>Unlimited Services:</Text>
                  <Text style={styles.mandateVal}>WhatsApp + Calls + Reports</Text>
                </View>
              </View>

              {/* Auto-Pay UPI Options with Actual Brand SVG Logos */}
              <Text style={styles.fieldLabel}>SELECT AUTO-PAY PAYMENT METHOD</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {[
                  { id: 'GPAY', label: 'Google Pay', logo: <GooglePayLogo size={20} /> },
                  { id: 'PHONEPE', label: 'PhonePe', logo: <PhonePeLogo size={20} /> },
                  { id: 'PAYTM', label: 'Paytm UPI', logo: <PaytmLogo size={20} /> },
                  { id: 'CARD', label: 'Debit / Credit Card', logo: <CardPaymentLogo size={20} /> },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.methodPill,
                      autoPayMethod === m.id && styles.methodPillActive,
                    ]}
                    onPress={() => setAutoPayMethod(m.id as any)}
                    activeOpacity={0.8}
                  >
                    <View style={{ marginRight: 2 }}>{m.logo}</View>
                    <Text
                      style={[
                        styles.methodPillText,
                        autoPayMethod === m.id && styles.methodPillTextActive,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveModalBtn, subscribing && styles.btnDisabled]}
                onPress={handleConfirmAutoPay}
                disabled={subscribing}
              >
                {subscribing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveModalBtnText}>
                    Authorize ₹0 Auto-Pay & Activate Unlimited Plan
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },

  // ─── Top App Bar ───
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logoImage: {
    height: 38,
    width: 140,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },

  // ─── Hero Profile Card with Banner ───
  profileHeroCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  bannerWrapper: {
    height: 130,
    width: '100%',
    position: 'relative',
    backgroundColor: '#fef3c7',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  editBannerPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editBannerPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileContentRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
    marginTop: -38,
  },
  avatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3.5,
    borderColor: '#ffffff',
    backgroundColor: '#cbd5e1',
  },
  crownBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#fef08a',
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#22c55e',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  profileDetailsCol: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  ownerTagRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 6,
  },
  ownerTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  ownerTagText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '900',
  },
  profileContactText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
    fontWeight: '600',
  },
  profileLocationText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  editProfileBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  editProfileBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },

  // ─── 4 Stat Pills ───
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 1,
  },

  // ─── Middle & Lower Cards Row ───
  cardsRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  chevronIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748b',
  },

  // Card A: PG Details
  pgPhotoContainer: {
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  pgPhotoImage: {
    width: '100%',
    height: '100%',
  },
  pgInfoBox: {
    marginTop: 2,
  },
  pgCardName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  activeGreenBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeGreenBadgeText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },
  pgCardLocation: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '600',
  },
  pgCardFeature: {
    fontSize: 11,
    color: '#334155',
    marginBottom: 3,
    fontWeight: '600',
  },
  viewPropertyBtn: {
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  viewPropertyBtnText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '800',
  },

  // Card B: Subscription Plan
  subPlanCardContent: {
    position: 'relative',
  },
  starBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  starBadgeText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '900',
  },
  subPriceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  subPriceBig: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subPricePerMonth: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  subCrownWatermark: {
    fontSize: 36,
    opacity: 0.25,
  },
  subFeatureList: {
    marginBottom: 8,
  },
  subFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  subGreenCheck: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '900',
  },
  subFeatureItemText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  nextBillingText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 10,
    fontWeight: '600',
  },
  manageSubBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  manageSubBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Card C: My Tenants
  tenantsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tenantPillCol: {
    alignItems: 'center',
    width: '23%',
  },
  tenantAvatarThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#cbd5e1',
    marginBottom: 4,
  },
  tenantThumbName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  tenantThumbRoom: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 3,
  },
  statusSmallBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  statusPaidBg: {
    backgroundColor: '#dcfce7',
  },
  statusDueBg: {
    backgroundColor: '#fef3c7',
  },
  statusSmallText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusPaidText: {
    color: '#15803d',
  },
  statusDueText: {
    color: '#b45309',
  },

  // Card D: Quick Actions (2x2 Grid)
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  quickActionTile: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickTileIcon: {
    fontSize: 18,
    color: '#2563eb',
    marginBottom: 4,
  },
  quickTileLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },

  // ─── Modal Styles ───
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 480,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  saveModalBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  saveModalBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Modal Plan Switcher
  modalPlanCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 10,
  },
  modalPlanCardSelected: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  modalPlanTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalPlanTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalPlanTag: {
    fontSize: 8,
    fontWeight: '900',
    color: '#4f46e5',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalPlanPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalPlanSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  mandateSummary: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mandateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mandateKey: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  mandateVal: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '800',
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  methodPillActive: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  methodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  methodPillTextActive: {
    color: '#047857',
  },
});
