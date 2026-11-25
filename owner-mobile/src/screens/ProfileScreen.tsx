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
import { safeStorage } from '../utils/safeStorage';
import { fastDataCache } from '../services/dataCache';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Property } from '../types';
import { getInitialFloorsForProperty } from '../services/propertyDataService';
import { GooglePayLogo, PhonePeLogo, PaytmLogo, CardPaymentLogo } from '../components/PaymentLogos';
import { pickImageFromDevice } from '../utils/imagePicker';
import {
  getOwnerPayoutDetails,
  saveOwnerPayoutDetails,
  validateUpiId,
} from '../services/upiPaymentService';
import {
  cancelProAutoPay,
  formatDisplayDate,
  getSubscriptionState,
  isProActive,
  SubscriptionState,
} from '../services/subscriptionService';
import { SubscriptionPaywallModal } from '../components/modals/SubscriptionPaywallModal';
import { onDataChanged } from '../utils/appEvents';
import Svg, { Path, Circle } from 'react-native-svg';

interface ProfileScreenProps {
  onBackToDashboard: () => void;
  onNavigateTab?: (tab: 'dashboard' | 'properties' | 'tenants' | 'management') => void;
  selectedPropertyId?: string | null;
  onActivePropertyChange?: (property: Property) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBackToDashboard,
  onNavigateTab,
  selectedPropertyId,
  onActivePropertyChange,
}) => {
  const { user, updateProfile, logout } = useAuth();

  // Profile data
  const [fullName, setFullName] = useState(user?.fullName || 'Saikrishna Naraharisetti');
  const [email, setEmail] = useState(user?.email || 'saikrishnakrishna235@gmail.com');
  const [phone, setPhone] = useState(user?.phone || '9866250918');
  const [location, setLocation] = useState('Bengaluru, Karnataka');
  const [pgName, setPgName] = useState('Ramesh PG');
  const [properties, setProperties] = useState<Property[]>([]);
  const [propStats, setPropStats] = useState({ floors: 3, rooms: 6, beds: 18 });

  // Custom Editable Images (empty by default so new owners see clean uploaders)
  const defaultPgPhoto = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';

  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(fullName);
  const [editEmail, setEditEmail] = useState(email);
  const [editPhone, setEditPhone] = useState(phone);
  const [editLocation, setEditLocation] = useState(location);
  const [editAvatarUrl, setEditAvatarUrl] = useState(avatarUrl);
  const [editBannerUrl, setEditBannerUrl] = useState(bannerUrl);
  const [savingProfile, setSavingProfile] = useState(false);

  // Subscription Modal & Auto-Pay State
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [selectedPlanPeriod, setSelectedPlanPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [autoPayMethod, setAutoPayMethod] = useState<'GPAY' | 'PHONEPE' | 'PAYTM' | 'CARD'>('GPAY');
  const [subscribing, setSubscribing] = useState(false);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [showProPaywall, setShowProPaywall] = useState(false);

  useEffect(() => {
    const syncSub = () => {
      getSubscriptionState().then((s) => {
        setSubState(s);
        setIsSubscriptionActive(isProActive(s));
      }).catch(() => {});
    };
    syncSub();
    return onDataChanged(syncSub);
  }, []);

  // Bank & UPI Payout Details State
  const [upiId, setUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiError, setUpiError] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);
  const [isEditingUpi, setIsEditingUpi] = useState(false);

  // Load custom profile, banner & live properties from safeStorage / API
  useEffect(() => {
    const loadSavedProfileAndProperties = async () => {
      try {
        const savedData = await safeStorage.getItem('@staynest_owner_custom_profile');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (parsed.fullName) setFullName(parsed.fullName);
          if (parsed.email) setEmail(parsed.email);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.location) setLocation(parsed.location);
          if (parsed.avatarUrl) setAvatarUrl(parsed.avatarUrl);
          if (parsed.bannerUrl) setBannerUrl(parsed.bannerUrl);
        }
        const savedPayout = await getOwnerPayoutDetails();
        if (savedPayout.upiId) {
          setUpiId(savedPayout.upiId);
          setUpiVerified(savedPayout.upiVerified);
        }
        if (savedPayout.accountHolderName) setAccountHolderName(savedPayout.accountHolderName);
        if (savedPayout.bankName) setBankName(savedPayout.bankName);
        if (savedPayout.accountNumber) setAccountNumber(savedPayout.accountNumber);
        if (savedPayout.ifscCode) setIfscCode(savedPayout.ifscCode);
      } catch (e) {
        console.log('Error loading saved profile:', e);
      }

      try {
        const propRes = await apiClient<{ content: Property[] }>('/owner/properties').catch(() => ({ content: [] }));
        let loadedProps: Property[] = propRes.content || [];
        if (loadedProps.length === 0) {
          loadedProps = [
            {
              id: 'prop-pg-1',
              name: "StayNest Elite Men's PG",
              propertyType: 'HOSTEL',
              genderPolicy: 'MALE',
              addressLine: 'Opp. PVP Square, MG Road, Vijayawada',
              cityName: 'Vijayawada, Andhra Pradesh',
              foodIncluded: true,
              primaryPhotoUrl: defaultPgPhoto,
            },
            {
              id: 'prop-pg-2',
              name: 'Sai Durga Executive Ladies PG',
              propertyType: 'PG',
              genderPolicy: 'FEMALE',
              addressLine: 'Near Benz Circle, Vijayawada',
              cityName: 'Vijayawada, Andhra Pradesh',
              foodIncluded: true,
              primaryPhotoUrl: defaultPgPhoto,
            },
          ];
        }

        // Merge custom properties saved in safeStorage / localStorage
        try {
          const customPropsRaw = await safeStorage.getItem('@staynest_custom_properties');
          if (customPropsRaw) {
            const parsedCustom: Property[] = JSON.parse(customPropsRaw);
            if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
              const seenIds = new Set(loadedProps.map((p) => p.id));
              const uniqueCustom = parsedCustom.filter((p) => p?.id && !seenIds.has(p.id));
              loadedProps = [...loadedProps, ...uniqueCustom];
            }
          }
        } catch {}

        setProperties(loadedProps);

        const activeId =
          selectedPropertyId ||
          (typeof window !== 'undefined' && window.localStorage
            ? window.localStorage.getItem('staynest_active_property_id')
            : '') ||
          loadedProps[0]?.id;
        const activeProp = loadedProps.find((p) => p.id === activeId) || loadedProps[0];
        if (activeProp) {
          setPgName(activeProp.name);
          const floors = getInitialFloorsForProperty(activeProp.id);
          const roomsCount = floors.reduce((s, f) => s + f.rooms.length, 0);
          const bedsCount = floors.reduce(
            (s, f) => s + f.rooms.reduce((rs, r) => rs + r.beds.length, 0),
            0
          );
          setPropStats({ floors: floors.length, rooms: roomsCount, beds: bedsCount });
        }
      } catch {}
    };
    loadSavedProfileAndProperties();
  }, [selectedPropertyId]);

  useEffect(() => {
    const activeProp = properties.find((p) => p.id === selectedPropertyId) || properties[0];
    if (activeProp) {
      setPgName(activeProp.name);
      const floors = getInitialFloorsForProperty(activeProp.id);
      const roomsCount = floors.reduce((s, f) => s + f.rooms.length, 0);
      const bedsCount = floors.reduce(
        (s, f) => s + f.rooms.reduce((rs, r) => rs + r.beds.length, 0),
        0
      );
      setPropStats({ floors: floors.length, rooms: roomsCount, beds: bedsCount });
    }
  }, [selectedPropertyId, properties]);

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
      setAvatarUrl(editAvatarUrl.trim());
      setBannerUrl(editBannerUrl.trim());

      const profilePayload = {
        fullName: editName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        location: editLocation.trim(),
        avatarUrl: editAvatarUrl.trim(),
        bannerUrl: editBannerUrl.trim(),
      };

      await safeStorage.setItem('@staynest_owner_custom_profile', JSON.stringify(profilePayload));
      await updateProfile(editName.trim(), editEmail.trim());

      setIsEditModalOpen(false);
      Alert.alert('Profile Updated! 🎉', 'Your profile details and custom photos have been saved successfully.');
    } catch {
      setIsEditModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  // Upload Avatar directly from local machine or device camera (Point 10)
  const handleUploadAvatarFromDevice = async () => {
    try {
      const picked = await pickImageFromDevice();
      if (picked) {
        setAvatarUrl(picked);
        setEditAvatarUrl(picked);
        const savedData = await safeStorage.getItem('@staynest_owner_custom_profile');
        const parsed = savedData ? JSON.parse(savedData) : {};
        await safeStorage.setItem(
          '@staynest_owner_custom_profile',
          JSON.stringify({ ...parsed, avatarUrl: picked })
        );
        Alert.alert('Profile Photo Updated! 📸', 'Your avatar has been updated from your local machine.');
      }
    } catch (err) {
      console.log('Error uploading avatar:', err);
    }
  };

  // Upload Heritage / Background Banner directly from local machine (Point 10)
  const handleUploadBannerFromDevice = async () => {
    try {
      const picked = await pickImageFromDevice();
      if (picked) {
        setBannerUrl(picked);
        setEditBannerUrl(picked);
        const savedData = await safeStorage.getItem('@staynest_owner_custom_profile');
        const parsed = savedData ? JSON.parse(savedData) : {};
        await safeStorage.setItem(
          '@staynest_owner_custom_profile',
          JSON.stringify({ ...parsed, bannerUrl: picked })
        );
        Alert.alert('Banner Updated! 🖼️', 'Your profile banner has been updated from your local machine.');
      }
    } catch (err) {
      console.log('Error uploading banner:', err);
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
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
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

  const activeProperty = properties.find((p) => p.id === selectedPropertyId) || properties[0];
  const propLocation =
    activeProperty?.cityName || activeProperty?.addressLine || location;
  const propPhotoUrl = activeProperty?.primaryPhotoUrl || defaultPgPhoto;

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

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setEditName(fullName);
              setEditEmail(email);
              setEditPhone(phone);
              setEditLocation(location);
              setEditAvatarUrl(avatarUrl);
              setEditBannerUrl(bannerUrl);
              setIsEditModalOpen(true);
            }}
            activeOpacity={0.7}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="8" r="4" stroke="#374151" strokeWidth="1.8" />
              <Path
                d="M4 20c0-3.8 3.6-6 8-6s8 2.2 8 6"
                stroke="#374151"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* ─── 2. HERO PROFILE CARD (MATCHING FIRST PHOTO) ─── */}
        <View style={styles.profileHeroCard}>
          {/* Background Banner (Empty State vs Uploaded Banner) */}
          <View style={styles.bannerWrapper}>
            {bannerUrl ? (
              <>
                <Image
                  source={{ uri: bannerUrl }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.editBannerPill}
                  onPress={handleUploadBannerFromDevice}
                  activeOpacity={0.85}
                >
                  <Text style={styles.editBannerPillText}>🖼️ Change Banner</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={{
                  width: '100%',
                  height: 140,
                  backgroundColor: '#f5efe6',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                }}
                onPress={handleUploadBannerFromDevice}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 22 }}>📷</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#78716c' }}>
                  + Add Cover Banner
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Foreground Row */}
          <View style={styles.profileContentRow}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleUploadAvatarFromDevice}
              activeOpacity={0.85}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <View
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: '#e7ddd0',
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="8.5" r="4" stroke="#78716c" strokeWidth="1.8" />
                    <Path
                      d="M4.5 19.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
                      stroke="#78716c"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </Svg>
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: '#ea580c',
                      borderWidth: 2,
                      borderColor: '#ffffff',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900', lineHeight: 15 }}>+</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.profileDetailsCol}>
              {/* Name + Edit Profile Pill */}
              <View style={styles.nameAndEditRow}>
                <Text style={styles.profileName} numberOfLines={2}>
                  {fullName}
                </Text>
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

              {/* PG Owner Badge */}
              <View style={styles.ownerTagPill}>
                <Text style={{ fontSize: 11 }}>👑</Text>
                <Text style={styles.ownerTagText}>PG Owner</Text>
              </View>

              {/* Contact Info */}
              <View style={styles.contactStack}>
                <Text style={styles.profileContactText}>📞 +91 {phone}</Text>
                <View style={styles.emailRow}>
                  <Text style={[styles.profileContactText, { flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                    ✉️ {email}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(email).catch(() => {});
                      }
                      Alert.alert('Copied', `${email} copied to clipboard.`);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>📋</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.profileContactText}>📍 {location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── 3. MY PROPERTIES CARD (MATCHING FIRST PHOTO) ─── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>
            My Properties ({properties.length || 1})
          </Text>

          {(properties.length > 0 ? properties : activeProperty ? [activeProperty] : []).map((prop, idx) => {
            const isPropActive = activeProperty ? prop.id === activeProperty.id : idx === 0;
            const isRental = prop.propertyType === 'RENTAL_BUILDING';
            const propFl = getInitialFloorsForProperty(prop.id);
            const roomsCount = propFl.reduce((s, f) => s + f.rooms.length, 0);
            const bedsCount = propFl.reduce(
              (s, f) => s + f.rooms.reduce((rs, r) => rs + r.beds.length, 0),
              0
            );
            const pLoc = prop.cityName || prop.addressLine || location;
            const pPhoto = prop.primaryPhotoUrl || defaultPgPhoto;

            return (
              <View
                key={prop.id}
                style={{
                  marginTop: idx > 0 ? 14 : 0,
                  paddingTop: idx > 0 ? 14 : 0,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: '#f1f5f9',
                }}
              >
                <TouchableOpacity
                  style={styles.propertyPreviewRow}
                  onPress={() => onActivePropertyChange?.(prop)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: pPhoto }}
                    style={styles.propertyThumb}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.propertyTitleRow}>
                      <Text style={styles.pgCardName} numberOfLines={1}>
                        {prop.name}
                      </Text>
                      {isPropActive ? (
                        <View style={styles.activeGreenBadge}>
                          <Text style={styles.activeGreenBadgeText}>Active</Text>
                        </View>
                      ) : (
                        <View style={[styles.activeGreenBadge, { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' }]}>
                          <Text style={[styles.activeGreenBadgeText, { color: '#ea580c' }]}>Select</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.pgCardLocation} numberOfLines={1}>
                      📍 {pLoc}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.propertyStatsSummary}>
                  <Text style={styles.propertyStatsBold}>
                    {isRental
                      ? `${propFl.length} Floors • ${roomsCount} Flats`
                      : `${propFl.length} Floors • ${roomsCount} Rooms • ${bedsCount} Beds`}
                  </Text>
                  <Text style={styles.propertyStatsSub}>
                    {isRental ? '(Rental Building / Flats)' : '(PG / Hostel Sharing)'}
                  </Text>
                </View>

                {isPropActive && (
                  <View style={styles.amenityGridRow}>
                    {[
                      { icon: '🏢', label: 'Floors' },
                      { icon: '🚪', label: isRental ? 'Flats' : 'Rooms' },
                      { icon: isRental ? '🏠' : '🛏️', label: isRental ? 'Units' : 'Beds' },
                      { icon: '📶', label: 'Wi-Fi' },
                      { icon: '❄️', label: 'AC' },
                      { icon: '🍽️', label: isRental ? 'Maint.' : 'Food' },
                    ].map((item) => (
                      <View key={item.label} style={styles.amenityTile}>
                        <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                        <Text style={styles.amenityTileLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.managePropertyBtn,
                    !isPropActive && { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
                  ]}
                  onPress={() => {
                    onActivePropertyChange?.(prop);
                    onNavigateTab && onNavigateTab('properties');
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.managePropertyBtnText,
                      !isPropActive && { color: '#ea580c' },
                    ]}
                  >
                    Manage Property →
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ─── 3B. SIMPLIFIED UPI PAYMENT ID CARD (DISPLAY MODE VS EDIT MODE) ─── */}
        <View style={styles.sectionCard}>
          {upiId.trim().length > 0 && upiVerified && !isEditingUpi ? (
            /* State A: Display Mode (Save button & input hidden) */
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 3 }}>
                  UPI Payment ID
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
                  {upiId}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    backgroundColor: '#dcfce7',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 99,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#15803d' }}>
                    ✓ Verified
                  </Text>
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#faf8f6',
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                  }}
                  onPress={() => setIsEditingUpi(true)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>✏️ Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* State B: Edit / Empty Mode */
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.sectionCardTitle, { marginBottom: 0 }]}>
                  💳 UPI Payment ID
                </Text>
                {upiVerified && upiId.trim() ? (
                  <TouchableOpacity onPress={() => { setIsEditingUpi(false); setUpiError(''); }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Auto-included with a quick PhonePe / GPay / Paytm pay link in tenant WhatsApp rent reminders.
              </Text>

              <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                OWNER UPI ID *
              </Text>
              <TextInput
                style={{
                  backgroundColor: upiError ? '#fef2f2' : '#faf8f6',
                  borderWidth: 1,
                  borderColor: upiError ? '#dc2626' : '#e2e8f0',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: '#0f172a',
                  marginBottom: upiError ? 4 : 12,
                }}
                value={upiId}
                onChangeText={(val) => {
                  setUpiId(val);
                  if (upiError) setUpiError('');
                }}
                placeholder="Enter UPI ID (e.g., name@okaxis)"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              {upiError ? (
                <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700', marginBottom: 12 }}>
                  ⚠️ {upiError}
                </Text>
              ) : null}

              <TouchableOpacity
                style={[styles.managePropertyBtn, savingPayout && { opacity: 0.6 }]}
                disabled={savingPayout}
                onPress={async () => {
                  const trimmedUpi = upiId.trim();
                  if (!trimmedUpi || !validateUpiId(trimmedUpi)) {
                    setUpiError('Enter a valid UPI ID (e.g., name@okaxis or owner@ybl)');
                    return;
                  }
                  setUpiError('');
                  setSavingPayout(true);
                  try {
                    await saveOwnerPayoutDetails({
                      upiId: trimmedUpi,
                      upiVerified: true,
                      accountHolderName: fullName,
                      bankName: '',
                      accountNumber: '',
                      ifscCode: '',
                    });
                    apiClient('/users/profile', {
                      method: 'PATCH',
                      body: JSON.stringify({ upiId: trimmedUpi }),
                    }).catch(() => {});
                    setUpiId(trimmedUpi);
                    setUpiVerified(true);
                    setIsEditingUpi(false);
                    Alert.alert('✓ UPI ID Saved', `${trimmedUpi} will now be included in WhatsApp rent reminders.`);
                  } finally {
                    setSavingPayout(false);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.managePropertyBtnText}>
                  {savingPayout ? 'Saving...' : 'Save UPI ID'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ─── 3C. SUBSCRIPTION & AUTOPAY CARD ─── */}
        <View style={styles.sectionCard}>
          {subState && isProActive(subState) ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.sectionCardTitle, { marginBottom: 0 }]}>
                  👑 Pro Plan • {subState.autopayStatus === 'CANCELLED' ? 'Cancels at Period End' : 'AutoPay Active'}
                </Text>
                <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#15803d' }}>
                    {subState.plan === 'PRO_TRIAL' ? 'PRO TRIAL' : 'PRO ACTIVE'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: '#475569', marginBottom: 12 }}>
                {subState.autopayStatus === 'CANCELLED'
                  ? `Pro access remains active until ${formatDisplayDate(subState.nextBillingDate)}.`
                  : `Next Auto-Debit: ₹99 on ${formatDisplayDate(subState.nextBillingDate)}`}
              </Text>
              {subState.autopayStatus !== 'CANCELLED' && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#fef2f2',
                    borderWidth: 1,
                    borderColor: '#fecaca',
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    const doCancel = async () => {
                      const updated = await cancelProAutoPay();
                      setSubState(updated);
                      Alert.alert('AutoPay Cancelled', `You won't be charged ₹99. Pro stays active until ${formatDisplayDate(updated.nextBillingDate)}.`);
                    };
                    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
                      if (window.confirm('Cancel ₹99/mo UPI AutoPay?')) doCancel();
                    } else {
                      Alert.alert('Cancel AutoPay', 'Stop recurring ₹99/mo auto-debit? Your Pro access continues until the end of the current period.', [
                        { text: 'Keep Pro', style: 'cancel' },
                        { text: 'Cancel AutoPay', style: 'destructive', onPress: doCancel },
                      ]);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>Cancel AutoPay</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.sectionCardTitle, { marginBottom: 0 }]}>
                  👑 StayNest Plan
                </Text>
                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#475569' }}>FREE PLAN</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                Includes 1 Property & 5 WhatsApp reminders/month. Start your 1-Month Free Trial (₹0 today, ₹99/mo after).
              </Text>
              <TouchableOpacity
                style={styles.managePropertyBtn}
                onPress={() => setShowProPaywall(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.managePropertyBtnText}>Start 1-Month Free Trial (₹0 Today)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ─── 4. SETTINGS & ACCOUNT ACTIONS CARD (MATCHING FIRST PHOTO) ─── */}
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={async () => {
              try {
                await safeStorage.removeItem('@staynest_custom_tenants');
                await safeStorage.removeItem('@staynest_custom_properties');
                fastDataCache.invalidateAll();
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.localStorage.removeItem('staynest_custom_properties');
                  window.localStorage.removeItem('staynest_customer_enquiries');
                }
                Alert.alert(
                  'Live Data Synced! 🔄',
                  'Local cache cleared. The app is fetching fresh live data from the backend.'
                );
              } catch (err: any) {
                Alert.alert('Error', err.message || 'Could not clear cache');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsRowText}>Sync Live Backend Data (Clear Cache)</Text>
            <Text style={styles.settingsChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => setIsSubscriptionModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsRowText}>App Preferences & Subscription</Text>
            <Text style={styles.settingsChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutRowText}>Log Out</Text>
          </TouchableOpacity>
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
              {/* Profile Photo with Local Machine Upload Button */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                <Text style={styles.fieldLabel}>PROFILE PHOTO</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const picked = await pickImageFromDevice();
                    if (picked) setEditAvatarUrl(picked);
                  }}
                  style={styles.pickDeviceBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickDeviceBtnText}>📁 Upload from Device</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.inputField}
                value={editAvatarUrl}
                onChangeText={setEditAvatarUrl}
                placeholder="Image URL or local file path"
                placeholderTextColor="#94a3b8"
              />

              {/* Background Banner with Local Machine Upload Button */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                <Text style={styles.fieldLabel}>BACKGROUND BANNER</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const picked = await pickImageFromDevice();
                    if (picked) setEditBannerUrl(picked);
                  }}
                  style={styles.pickDeviceBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickDeviceBtnText}>📁 Upload from Device</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.inputField}
                value={editBannerUrl}
                onChangeText={setEditBannerUrl}
                placeholder="Image URL or local file path"
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
      <SubscriptionPaywallModal
        visible={showProPaywall}
        reason="UPGRADE"
        onClose={() => setShowProPaywall(false)}
        onActivated={(nextSub) => {
          setSubState(nextSub);
          setIsSubscriptionActive(isProActive(nextSub));
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f6',
  },
  scrollContent: {
    paddingBottom: 130,
  },

  // ─── Top App Bar ───
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 42 : 12,
    paddingBottom: 12,
    backgroundColor: '#faf8f6',
  },
  logoImage: {
    height: 34,
    width: 128,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#efece9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  // ─── Hero Profile Card with Banner ───
  profileHeroCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#efece9',
  },
  bannerWrapper: {
    height: 115,
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
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  editBannerPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  profileContentRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrapper: {
    position: 'relative',
    marginTop: -42,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3.5,
    borderColor: '#ffffff',
    backgroundColor: '#e5e7eb',
  },
  nameAndEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  contactStack: {
    marginTop: 8,
    gap: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ─── My Properties Card ───
  sectionCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#efece9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  propertyPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  propertyThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  propertyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  propertyStatsSummary: {
    marginTop: 12,
  },
  propertyStatsBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  propertyStatsSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  amenityGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 12,
  },
  amenityTile: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  amenityTileLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  managePropertyBtn: {
    backgroundColor: '#d96b27',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  managePropertyBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  // ─── Settings & Account Actions Card ───
  settingsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#efece9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingsRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  settingsChevron: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
  logoutRowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991b1b',
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
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: '#3b82f6',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  pickDeviceBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pickDeviceBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
  },
  profileDetailsCol: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.2,
  },
  ownerTagRow: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 6,
  },
  ownerTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 5,
  },
  ownerTagText: {
    color: '#9a3412',
    fontSize: 11,
    fontWeight: '800',
  },
  profileContactText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 1,
    fontWeight: '500',
  },
  profileLocationText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  editProfileBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  editProfileBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
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
    borderWidth: 1.5,
    borderColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOpacity: 0.05,
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
    borderWidth: 1.5,
    borderColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOpacity: 0.05,
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
  quickActionsCardWarm: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#f97316',
  },
  quickActionsIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionsCardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#9a3412',
  },
  quickActionTileWarm: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  quickTileIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickTileIconWarm: {
    fontSize: 15,
    fontWeight: '900',
  },
  quickTileLabelWarm: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7c2d12',
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
    shadowColor: '#ea580c',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#f97316',
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
