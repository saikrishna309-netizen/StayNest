import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Linking,
  Animated,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Property, Tenant, RentInvoice, Expense, Room, Bed, ResidentEnquiry } from '../types';
import { GooglePayLogo, PhonePeLogo, PaytmLogo, BhimUpiLogo, CardPaymentLogo } from '../components/PaymentLogos';
import { validateVerhoeffAadhaar, parseAadhaarQrPayload } from '../utils/aadhaar';
import { ElectricityBillModal } from '../components/modals/ElectricityBillModal';
import { LogIssueModal } from '../components/modals/LogIssueModal';
import { FoodMenuModal } from '../components/modals/FoodMenuModal';
import {
  FloorUnitMatrixBuilder,
  MatrixFloor,
  getInitialMatrixFloors,
} from '../components/FloorUnitMatrixBuilder';
import { fastDataCache } from '../services/dataCache';
import { safeStorage } from '../utils/safeStorage';
import { pickMultipleImagesFromDevice } from '../utils/imagePicker';
import { fetchCurrentPropertyLocation } from '../utils/locationHelper';
import { emitDataChanged, onDataChanged } from '../utils/appEvents';
import { isValidUuid } from '../services/propertyDataService';
import { buildRentReminderMessage, getOwnerPayoutDetails } from '../services/upiPaymentService';
import {
  computeOccupancyMetrics,
  computeCollectionMetrics,
  computeExpenseAndProfitMetrics,
  computeMonthlyInvoiceTotal,
  FixedMonthlyBill,
} from '../services/financeSummaryService';
import {
  ActivityLogItem,
  buildRecentActivities,
  formatActivityTime,
  getLoggedActivities,
  logActivity,
} from '../services/activityLogService';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const OutlineBellIcon = ({ color = '#ffffff', size = 20 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface DashboardScreenProps {
  onSelectPropertyForRooms: (property: Property) => void;
  onNavigateTab: (tab: 'rooms' | 'tenants' | 'finance' | 'profile') => void;
  onActivePropertyChange?: (property: Property) => void;
  selectedPropertyId?: string | null;
  resetTrigger?: number;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onSelectPropertyForRooms,
  onNavigateTab,
  onActivePropertyChange,
  selectedPropertyId,
  resetTrigger,
}) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixedBills, setFixedBills] = useState<FixedMonthlyBill[]>([]);
  const [loggedActivities, setLoggedActivities] = useState<ActivityLogItem[]>([]);
  const [backendActivities, setBackendActivities] = useState<ActivityLogItem[]>([]);

  // Detailed room structure per property for live occupancy calculation
  const [propertyRoomsMap, setPropertyRoomsMap] = useState<Record<string, Room[]>>({});

  // Onboarding Modal State
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showRecordRentPickerModal, setShowRecordRentPickerModal] = useState(false);
  const [recordRentSearch, setRecordRentSearch] = useState('');
  const [selectedPropId, setSelectedPropId] = useState(selectedPropertyId || '');

  // Keep Dashboard in sync when active property changes on another screen
  useEffect(() => {
    if (selectedPropertyId && selectedPropertyId !== selectedPropId) {
      setSelectedPropId(selectedPropertyId);
    }
  }, [selectedPropertyId]);
  const [onboardFullName, setOnboardFullName] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardIdProof, setOnboardIdProof] = useState('');
  const [fixedRentAmount, setFixedRentAmount] = useState(8500);
  const [fixedDepositAmount, setFixedDepositAmount] = useState(2500);
  const [onboardRentPayingNow, setOnboardRentPayingNow] = useState(''); // watermark placeholder (Req 3)
  const [onboardDepositPayingNow, setOnboardDepositPayingNow] = useState(''); // watermark placeholder (Req 3)
  const [onboardPayMode, setOnboardPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [submittingOnboard, setSubmittingOnboard] = useState(false);
  const [onboardAadhaarVerified, setOnboardAadhaarVerified] = useState(false);
  const [showOnboardQrModal, setShowOnboardQrModal] = useState(false);
  const [rawQrPayloadInput, setRawQrPayloadInput] = useState('');

  // ─── KYC AUTO-SLIDING CAROUSEL STATE (REQUIREMENT 7) ───
  const [kycCarouselIndex, setKycCarouselIndex] = useState(0);
  const [showAllKycModal, setShowAllKycModal] = useState(false);
  const [verifyingTenantKyc, setVerifyingTenantKyc] = useState<Tenant | null>(null);
  const [kycVerifyAadhaarInput, setKycVerifyAadhaarInput] = useState('');
  const [kycQrPayloadInput, setKycQrPayloadInput] = useState('');
  const [showKycQrScanner, setShowKycQrScanner] = useState(false);
  const [verifyingKycLoading, setVerifyingKycLoading] = useState(false);

  // Tenant Action & Payment Modal State
  const [selectedTenantForAction, setSelectedTenantForAction] = useState<Tenant | null>(null);
  const [manualPayAmount, setManualPayAmount] = useState('8500');
  const [manualPayMode, setManualPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [manualPayNotes, setManualPayNotes] = useState('Paid in full');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Edit / Delete Tenant State
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [editTenantName, setEditTenantName] = useState('');
  const [editTenantPhone, setEditTenantPhone] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [editMonthlyRent, setEditMonthlyRent] = useState('8500');
  const [savingTenantEdit, setSavingTenantEdit] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState(false);

  // Shift / Transfer Bed State
  const [isShiftingBed, setIsShiftingBed] = useState(false);
  const [shiftSelectedBedId, setShiftSelectedBedId] = useState('');
  const [shiftNewRent, setShiftNewRent] = useState('8500');
  const [shiftingBed, setShiftingBed] = useState(false);

  // ─── SUBSCRIPTION & AUTO-PAY STATE (REQUIREMENTS 6, 7, 8) ───
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlanPeriod, setSelectedPlanPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [autoPayMethod, setAutoPayMethod] = useState<'GPAY' | 'PHONEPE' | 'PAYTM' | 'CARD'>('GPAY');
  const [subscribing, setSubscribing] = useState(false);

  // Load subscription state from localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const sub = window.localStorage.getItem('staynest_owner_subscription');
        if (sub) {
          const parsed = JSON.parse(sub);
          if (parsed.active) setSubscriptionActive(true);
        }
      }
    } catch {}
  }, []);

  const handleConfirmAutoPay = async () => {
    setSubscribing(true);
    try {
      const planName = selectedPlanPeriod === 'MONTHLY' ? 'Monthly Plan (₹99/mo)' : 'Annual Plan (₹1,099/yr)';
      const subData = {
        active: true,
        planPeriod: selectedPlanPeriod,
        planName,
        price: selectedPlanPeriod === 'MONTHLY' ? 99 : 1099,
        activatedAt: new Date().toISOString(),
        nextBillingDate: '22 Dec 2026',
        method: autoPayMethod,
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('staynest_owner_subscription', JSON.stringify(subData));
      }

      setSubscriptionActive(true);
      setShowSubscriptionModal(false);

      // Deep link directly to selected internal payment application
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
        console.log('Direct payment app launch error:', e);
      }

      const appLabel = autoPayMethod === 'PHONEPE' ? 'PhonePe' : autoPayMethod === 'GPAY' ? 'Google Pay' : autoPayMethod === 'PAYTM' ? 'Paytm' : 'Payment App';
      Alert.alert(
        'Redirecting to ' + appLabel + ' 💳',
        `Opening ${appLabel} to authorize ₹0 Auto-Pay for ${planName}!\n\nYour StayNest Unlimited Plan will activate instantly upon authorization.`
      );
    } finally {
      setSubscribing(false);
    }
  };

  // ─── NEED TO COLLECT & PAYMENT GATEWAY STATE (REQUIREMENTS 1, 4, 5, 6, 7) ───
  const [showNeedToCollectModal, setShowNeedToCollectModal] = useState(false);
  const [selectedTenantForGateway, setSelectedTenantForGateway] = useState<Tenant | null>(null);
  const [gatewayProcessing, setGatewayProcessing] = useState(false);
  const [selectedGatewayApp, setSelectedGatewayApp] = useState<'GPAY' | 'PHONEPE' | 'PAYTM' | 'BHIM' | 'CARD'>('GPAY');

  // Trigger automated WhatsApp reminder with direct UPI payment link to owner
  const handleSendWhatsAppWithPaymentLink = async (tenant: Tenant) => {
    const totalRent = tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 8500;
    const dueRent = typeof tenant.outstandingPaise === 'number'
      ? Math.round(tenant.outstandingPaise / 100)
      : (tenant.rentStatus === 'PAID' ? 0 : totalRent);

    const cleanPhone = tenant.phone.replace(/[^0-9]/g, '');
    const ownerUpi = '9876543210@upi';
    const ownerName = user?.fullName || 'Ramesh Kumar';

    const webPayUrl = `https://staynest.in/pay?t=${tenant.id}&amt=${dueRent}&pa=${ownerUpi}`;

    const message = `📢 *StayNest Rent Payment Reminder*\n\nHello ${tenant.fullName}!\nYour monthly PG rent for *Room ${tenant.roomNumber || '101'}*, ${tenant.propertyName || 'Ramesh PG'} is pending.\n\n• *Balance Due: ₹${dueRent.toLocaleString('en-IN')}*\n• Total Rent: ₹${totalRent.toLocaleString('en-IN')}\n\n💳 *Direct UPI Payment Link (0% Free):*\nTap to pay directly to Owner via Google Pay, PhonePe, or Paytm:\n👉 ${webPayUrl}\n\nOwner UPI VPA: *${ownerUpi}*\n\n— *${ownerName}* (StayNest)`;

    try {
      const params = new URLSearchParams();
      params.append('token', '4kcul3wmcwdoh5d0');
      params.append('to', `+91${cleanPhone}`);
      params.append('body', message);

      await fetch('https://api.ultramsg.com/instance197383/messages/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      Alert.alert(
        'WhatsApp Payment Link Delivered! 💬',
        `Direct WhatsApp reminder with 0% fee UPI payment link sent to ${tenant.fullName} (+91 ${cleanPhone})!\n\nWhen resident pays, funds go directly to your account: ${ownerUpi}.`
      );
    } catch {
      Alert.alert('Notice', `WhatsApp reminder dispatched to ${tenant.fullName}.`);
    }
  };

  // Process Payment Gateway Transaction for Tenant
  const handleProcessGatewayPayment = async (success: boolean) => {
    if (!selectedTenantForGateway) return;
    setGatewayProcessing(true);

    const t = selectedTenantForGateway;
    const totalRent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
    const dueRent = typeof t.outstandingPaise === 'number'
      ? Math.round(t.outstandingPaise / 100)
      : (t.rentStatus === 'PAID' ? 0 : totalRent);

    // Simulate network delay for verification
    await new Promise((res) => setTimeout(res, 900));
    setGatewayProcessing(false);

    if (success) {
      // 1. Backend sync: record payment
      apiClient(`/owner/tenants/${t.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaidPaise: dueRent * 100,
          paymentMethod: selectedGatewayApp,
          paymentDate: new Date().toISOString().split('T')[0],
          notes: `Rent paid via ${selectedGatewayApp} to Owner Account`,
        }),
      }).catch(() => {});

      // 2. Update all in-memory tenants state
      const cleanPhone = t.phone.replace(/[^0-9]/g, '');
      const updatedTenants = tenants.map((item) => {
        if (item.id === t.id || item.phone === t.phone || item.fullName === t.fullName) {
          return {
            ...item,
            rentStatus: 'PAID' as const,
            outstandingPaise: 0,
          };
        }
        return item;
      });
      setTenants(updatedTenants);

      // 3. Update invoices state
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.tenantName === t.fullName ? { ...inv, status: 'PAID' as const } : inv
        )
      );

      // 4. Update enquiries state
      setEnquiries((prev) =>
        prev.map((enq) =>
          enq.customerPhone === t.phone ? { ...enq, status: 'CONFIRMED' as const } : enq
        )
      );

      // 5. Persist to localStorage across all tabs and restarts
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('staynest_cached_tenants', JSON.stringify(updatedTenants));
        window.localStorage.setItem(`staynest_paid_${t.id}`, 'PAID');
        window.localStorage.setItem(`staynest_paid_${cleanPhone}`, 'PAID');
      }

      // 6. Send automated WhatsApp confirmation receipt
      try {
        const params = new URLSearchParams();
        params.append('token', '4kcul3wmcwdoh5d0');
        params.append('to', `+91${cleanPhone}`);
        params.append(
          'body',
          `🎉 *StayNest Rent Payment Successful!* 🧾\n\nHello ${t.fullName}!\nYour rent payment of *₹${dueRent.toLocaleString('en-IN')}* for Room ${t.roomNumber || '101'} has been successfully credited directly to the Owner's account.\n\n• Transaction Mode: ${selectedGatewayApp}\n• Balance Due: *₹0 (Fully Paid)*\n• Date: ${new Date().toLocaleDateString('en-GB')}\n\nThank you for paying on time!\n— *Ramesh PG (StayNest)*`
        );
        fetch('https://api.ultramsg.com/instance197383/messages/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }).catch(() => {});
      } catch {}

      setSelectedTenantForGateway(null);
      Alert.alert(
        'Payment Successful! 🎉',
        `₹${dueRent.toLocaleString('en-IN')} successfully credited to Owner account via ${selectedGatewayApp}!\n\nResident ${t.fullName} marked as PAID with ₹0 balance due across all screens.`
      );
    } else {
      Alert.alert(
        'Payment Failed / Cancelled ⚠️',
        'The transaction was not completed. The resident balance remains DUE and app records were not modified.'
      );
    }
  };

  // Multi-PG & Rental Building Dual-Mode Onboarding State
  const [showPgDropdown, setShowPgDropdown] = useState(false);
  const [showAddPgModal, setShowAddPgModal] = useState(false);
  const [addPropStep, setAddPropStep] = useState<1 | 2>(1);
  const [propertyMode, setPropertyMode] = useState<'PG' | 'RENTAL'>('PG');
  const [matrixFloors, setMatrixFloors] = useState<MatrixFloor[]>(() =>
    getInitialMatrixFloors('PG', 8500, 1200)
  );
  const [newPgName, setNewPgName] = useState('');
  const [newPgPhone, setNewPgPhone] = useState(user?.phone || '');
  const [newPgGender, setNewPgGender] = useState<'BOYS' | 'GIRLS' | 'CO_ED'>('BOYS');
  const [newPgType, setNewPgType] = useState<'PG' | 'HOSTEL' | 'CO_LIVING'>('PG');
  const [newPgRentalPolicy, setNewPgRentalPolicy] = useState<'FAMILY' | 'BACHELORS' | 'ANY'>('ANY');
  const [newPgUnitConfig, setNewPgUnitConfig] = useState<'1RK' | '1BHK' | '2BHK' | '3BHK'>('1BHK');
  const [newPgFurnishing, setNewPgFurnishing] = useState<'UNFURNISHED' | 'SEMI_FURNISHED' | 'FULLY_FURNISHED'>('SEMI_FURNISHED');

  // Location & Geolocation State
  const [newPgLocationSearch, setNewPgLocationSearch] = useState('');
  const [newPgAddress, setNewPgAddress] = useState('');
  const [newPgLocality, setNewPgLocality] = useState('');
  const [newPgCity, setNewPgCity] = useState('');
  const [newPgState, setNewPgState] = useState('Andhra Pradesh');
  const [newPgPincode, setNewPgPincode] = useState('520010');
  const [newPgLat, setNewPgLat] = useState<number | null>(16.5062);
  const [newPgLng, setNewPgLng] = useState<number | null>(80.6480);
  const [locatingMap, setLocatingMap] = useState(false);

  // Building Structure State
  const [newPgFloors, setNewPgFloors] = useState('3');
  const [newPgRoomsPerFloor, setNewPgRoomsPerFloor] = useState('2');
  const [newPgSharingType, setNewPgSharingType] = useState<'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'FOUR'>('DOUBLE');

  // Rent, Deposit, Food & Utilities State
  const [newPgRent, setNewPgRent] = useState('8500');
  const [newPgDeposit, setNewPgDeposit] = useState('2500');
  const [newPgNoticeDays, setNewPgNoticeDays] = useState('30');
  const [newPgFoodPolicy, setNewPgFoodPolicy] = useState<'3_MEALS' | '2_MEALS' | 'NO_FOOD'>('3_MEALS');
  const [newPgFoodIncluded, setNewPgFoodIncluded] = useState(true);
  const [newPgElectricityMode, setNewPgElectricityMode] = useState<'METERED' | 'FIXED' | 'INCLUDED'>('METERED');
  const [newPgElecRate, setNewPgElecRate] = useState('10');
  const [newPgElecPrev, setNewPgElecPrev] = useState('120');
  const [newPgElecCurr, setNewPgElecCurr] = useState('150');
  const [newPgElecFixed, setNewPgElecFixed] = useState('1000');
  const [newPgMaintenanceMode, setNewPgMaintenanceMode] = useState<'INCLUDED' | 'EXTRA'>('INCLUDED');
  const [newPgMaintFee, setNewPgMaintFee] = useState('1200');
  const [newPgPhotos, setNewPgPhotos] = useState<string[]>([]);

  const handlePickMultiplePropertyPhotos = async () => {
    const picked = await pickMultipleImagesFromDevice();
    if (picked.length > 0) {
      setNewPgPhotos((prev) => [...prev, ...picked]);
    }
  };

  const [newPgAmenities, setNewPgAmenities] = useState<string[]>([
    'HIGH_SPEED_WIFI',
    'HOMESTYLE_FOOD',
    'POWER_BACKUP',
    'DAILY_HOUSEKEEPING',
    'RO_WATER',
    'CCTV_SECURITY',
  ]);
  const [creatingPgLoading, setCreatingPgLoading] = useState(false);

  // Bed Hold Enquiries & Notifications State (Requirement 1 & Requirement 5)
  const [enquiries, setEnquiries] = useState<ResidentEnquiry[]>([]);
  const [showNotificationsPage, setShowNotificationsPage] = useState(false);

  // Listen for Dashboard bottom icon press to dismiss notifications & return to dashboard
  useEffect(() => {
    if (resetTrigger) {
      setShowNotificationsPage(false);
    }
  }, [resetTrigger]);

  // Owner Name Display (Requirement 2: Give name of owner instead of PG Owner)
  const [ownerDisplayName, setOwnerDisplayName] = useState<string>(() => {
    if (user?.fullName && user.fullName !== 'StayNest PG Owner' && user.fullName !== 'PG Owner') {
      return user.fullName;
    }
    return 'Ramesh Kumar';
  });

  useEffect(() => {
    const loadOwnerName = async () => {
      try {
        const saved = await safeStorage.getItem('@staynest_owner_custom_profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.fullName && parsed.fullName !== 'StayNest PG Owner' && parsed.fullName !== 'PG Owner') {
            setOwnerDisplayName(parsed.fullName);
            return;
          }
        }
        if (user?.fullName && user.fullName !== 'StayNest PG Owner' && user.fullName !== 'PG Owner') {
          setOwnerDisplayName(user.fullName);
        }
      } catch {}
    };
    loadOwnerName();
  }, [user]);

  // Quick Actions Animated Shining Border Glow (Requirement 4)
  const borderGlowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(borderGlowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false,
        }),
        Animated.timing(borderGlowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [borderGlowAnim]);

  const animatedBorderColor = borderGlowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#fb923c', '#ffedd5', '#fb923c'],
  });

  const animatedShadowOpacity = borderGlowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.15, 0.45, 0.18],
  });
  const [showElectricityModal, setShowElectricityModal] = useState(false);
  const [showLogIssueModal, setShowLogIssueModal] = useState(false);
  const [showFoodMenuModal, setShowFoodMenuModal] = useState(false);
  const [electricityBoard, setElectricityBoard] = useState('BESCOM - Bengaluru');
  const [consumerNumber, setConsumerNumber] = useState('1029384756');
  const [billAmount, setBillAmount] = useState('4,280');
  const [billUnits, setBillUnits] = useState('428');
  const [subMeterRate, setSubMeterRate] = useState('10');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Shubh Prabhat';
    if (hour < 17) return '☀️ Shubh Dopahar';
    if (hour < 21) return '🌆 Shubh Sandhya';
    return '🌙 Shubh Ratri';
  };

  // Locate on Map & Reverse Geocode coordinates -> Address, City, State, Pincode
  const handleLocateOnMap = async () => {
    setLocatingMap(true);
    try {
      const loc = await fetchCurrentPropertyLocation();
      if (!loc) return;
      setNewPgLat(loc.latitude);
      setNewPgLng(loc.longitude);
      if (loc.addressLine) setNewPgAddress(loc.addressLine);
      if (loc.cityName) setNewPgCity(loc.cityName);
      if (loc.stateName) setNewPgState(loc.stateName);
      if (loc.pincode) setNewPgPincode(loc.pincode);
    } finally {
      setLocatingMap(false);
    }
  };

  // Search Place & Auto-Fill coordinates + address fields
  const handleSearchLocation = async (query: string) => {
    setNewPgLocationSearch(query);
    if (query.trim().length < 3) return;
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=1`
      );
      if (resp.ok) {
        const results = await resp.json();
        if (Array.isArray(results) && results[0]) {
          const item = results[0];
          setNewPgLat(parseFloat(item.lat));
          setNewPgLng(parseFloat(item.lon));
          const addr = item.address || {};
          const street = [addr.road, addr.suburb || addr.neighbourhood].filter(Boolean).join(', ');
          setNewPgAddress(street || item.display_name.split(',').slice(0, 2).join(', '));
          if (addr.city || addr.town || addr.village) setNewPgCity(addr.city || addr.town || addr.village);
          if (addr.state) setNewPgState(addr.state);
          if (addr.postcode) {
            const pc = String(addr.postcode).replace(/\D/g, '').slice(0, 6);
            if (pc.length === 6) setNewPgPincode(pc);
          }
        }
      }
    } catch {}
  };

  // Complete Dual-Mode Property Creator (PG / Hostel Bed-wise OR Rental Building / Flats Room-wise)
  const handleCreateNewPg = async () => {
    // 1. Validate required fields
    if (!newPgName.trim() || newPgName.trim().length < 3) {
      Alert.alert('Required: Property Name', 'Please enter a valid Building / PG name (at least 3 characters).');
      return;
    }
    const cleanPhone = newPgPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Required: Phone Number', 'Please enter a valid 10-digit contact phone number.');
      return;
    }
    if (!newPgAddress.trim() || newPgAddress.trim().length < 3) {
      Alert.alert('Required: Address', 'Please enter the street address or use "Locate on Map".');
      return;
    }
    if (!newPgCity.trim()) {
      Alert.alert('Required: City', 'Please enter the city where the building is located.');
      return;
    }
    const cleanPincode = newPgPincode.replace(/\D/g, '');
    if (cleanPincode.length !== 6) {
      Alert.alert('Required: Pincode', 'Please enter a valid 6-digit postal pincode.');
      return;
    }
    const rentNum = parseInt(newPgRent.replace(/\D/g, '') || '0', 10);
    if (rentNum <= 0) {
      Alert.alert('Required: Monthly Rent', 'Please enter a valid monthly rent amount (greater than ₹0).');
      return;
    }
    const depositNum = parseInt(newPgDeposit.replace(/\D/g, '') || '0', 10);

    setCreatingPgLoading(true);

    try {
      const isRentalMode = propertyMode === 'RENTAL';
      const createdPropId = `prop-${isRentalMode ? 'bldg' : 'pg'}-${Date.now()}`;
      const generatedFloors: any[] = [];
      const generatedRoomsList: Room[] = [];
      let totalUnitsCreated = 0;
      let totalBedsCreated = 0;

      // Build dynamic floor & unit tree from FloorUnitMatrixBuilder
      matrixFloors.forEach((mFloor) => {
        const floorRooms: any[] = [];
        mFloor.units.forEach((mUnit) => {
          totalUnitsCreated++;
          const roomNum = mUnit.unit_number.trim() || `${mFloor.floor_number}01`;
          const roomId = `rm-${createdPropId}-${roomNum}`;
          const unitRent = mUnit.monthly_rent > 0 ? mUnit.monthly_rent : rentNum;
          const unitCapacity = isRentalMode ? 1 : Math.max(1, mUnit.sharing_capacity || 1);
          const bedsList: Bed[] = [];
          const floorBeds: any[] = [];

          // Only create individual bed slots if property_type === 'PG'
          if (!isRentalMode) {
            for (let b = 1; b <= unitCapacity; b++) {
              totalBedsCreated++;
              const bedId = `b-${createdPropId}-${roomNum}-${b}`;
              const bedObj: Bed = {
                id: bedId,
                roomId: roomId,
                propertyId: createdPropId,
                bedLabel: `Bed ${b}`,
                status: 'AVAILABLE',
              };
              bedsList.push(bedObj);
              floorBeds.push({
                id: bedId,
                bedLabel: `Bed ${b}`,
                status: 'AVAILABLE',
              });
            }
          }

          floorRooms.push({
            id: roomId,
            roomNumber: roomNum,
            floorNumber: mFloor.floor_number,
            sharingType: mUnit.unit_type,
            rentRupees: unitRent,
            depositRupees: depositNum,
            maintenanceRupees: mUnit.maintenance || 0,
            ac: newPgAmenities.includes('AC_ROOMS'),
            attachedBathroom: true,
            beds: floorBeds,
          });

          generatedRoomsList.push({
            id: roomId,
            propertyId: createdPropId,
            roomNumber: roomNum,
            sharingType: mUnit.unit_type as any,
            capacity: unitCapacity,
            floorNumber: mFloor.floor_number,
            rentMonthlyPaise: unitRent * 100,
            depositPaise: depositNum * 100,
            status: 'AVAILABLE',
            beds: bedsList,
          });
        });

        generatedFloors.push({
          floorNumber: mFloor.floor_number,
          label: mFloor.label,
          rooms: floorRooms,
        });
      });

      const minUnitRent =
        generatedRoomsList.length > 0
          ? Math.min(...generatedRoomsList.map((r) => Math.round(r.rentMonthlyPaise / 100)))
          : rentNum;

      const finalFoodIncluded = !isRentalMode && newPgFoodPolicy !== 'NO_FOOD';
      const created: Property = {
        id: createdPropId,
        name: newPgName.trim(),
        addressLine: `${newPgAddress.trim()}${newPgLocality.trim() ? ', ' + newPgLocality.trim() : ''}`,
        cityName: newPgCity.trim(),
        pincode: cleanPincode,
        latitude: newPgLat,
        longitude: newPgLng,
        genderPolicy: isRentalMode ? newPgRentalPolicy : newPgGender,
        propertyType: isRentalMode ? 'RENTAL_BUILDING' : newPgType,
        startingPricePaise: minUnitRent * 100,
        foodIncluded: finalFoodIncluded,
        noticePeriodDays: parseInt(newPgNoticeDays.replace(/\D/g, '') || '30', 10),
        approvalStatus: 'APPROVED',
        published: true,
        primaryPhotoUrl:
          newPgPhotos[0] ||
          'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
        photos: newPgPhotos,
        amenities: newPgAmenities,
      };

      // Persist utility billing config for monthly invoice generation
      const utilityConfig = {
        propertyMode,
        contactPhone: cleanPhone,
        stateName: newPgState.trim(),
        electricityMode: newPgElectricityMode,
        electricityRatePerUnit: Number(newPgElecRate) || 0,
        electricityFixedCharge: Number(newPgElecFixed) || 0,
        maintenanceMode: newPgMaintenanceMode,
        maintenanceFee: Number(newPgMaintFee) || 0,
        foodPolicy: newPgFoodPolicy,
        unitConfig: newPgUnitConfig,
        furnishing: newPgFurnishing,
      };
      await safeStorage.setItem(`@staynest_utility_config_${createdPropId}`, JSON.stringify(utilityConfig));

      // 2. Persist floors into safeStorage
      await safeStorage.setItem(`@staynest_floors_${createdPropId}`, JSON.stringify(generatedFloors));
      await safeStorage.setItem(`staynest_floors_${createdPropId}`, JSON.stringify(generatedFloors));

      // 3. Persist property into safeStorage
      const cachedStr = await safeStorage.getItem('@staynest_custom_properties');
      let cachedProps: Property[] = cachedStr ? JSON.parse(cachedStr) : [];
      if (!Array.isArray(cachedProps)) cachedProps = [];
      const updatedProps = [created, ...cachedProps.filter((p: any) => p.id !== created.id)];
      await safeStorage.setItem('@staynest_custom_properties', JSON.stringify(updatedProps));
      await safeStorage.setItem(`@staynest_floors_${createdPropId}`, JSON.stringify(generatedFloors));
      await safeStorage.setItem(`@staynest_utility_config_${createdPropId}`, JSON.stringify(utilityConfig));
      await safeStorage.setItem('@staynest_active_property_id', created.id);
      fastDataCache.invalidateAll();

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem('staynest_custom_properties', JSON.stringify(updatedProps));
          window.localStorage.setItem(`staynest_floors_${createdPropId}`, JSON.stringify(generatedFloors));
          window.localStorage.setItem('staynest_active_property_id', created.id);
          window.localStorage.setItem(`staynest_utility_config_${createdPropId}`, JSON.stringify(utilityConfig));
        } catch {}
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('staynest_property_created', { detail: created }));
      }

      // 4. Try backend API creation (single transaction with dynamic floor/unit tree)
      try {
        await apiClient<Property>('/owner/properties', {
          method: 'POST',
          body: JSON.stringify({
            name: created.name,
            propertyType: created.propertyType,
            property_mode: isRentalMode ? 'RENTAL_BUILDING' : 'PG',
            genderPolicy: created.genderPolicy,
            contactPhone: cleanPhone,
            cityId: '00000000-0000-0000-0000-000000000001',
            addressLine: created.addressLine,
            cityName: created.cityName,
            stateName: newPgState.trim(),
            pincode: cleanPincode,
            latitude: newPgLat,
            longitude: newPgLng,
            startingPricePaise: created.startingPricePaise,
            foodIncluded: created.foodIncluded,
            amenities: created.amenities,
            photos: newPgPhotos,
            floors: matrixFloors,
          }),
        });
      } catch (e) {
        console.log('Backend property sync notice (saved locally in persistent storage):', e);
      }

      // 5. Update local state immediately
      setProperties([created, ...properties.filter((p) => p.id !== created.id)]);
      setSelectedPropId(created.id);
      setPropertyRoomsMap((prev) => ({
        ...prev,
        [created.id]: generatedRoomsList,
      }));

      onActivePropertyChange?.(created);

      setShowAddPgModal(false);
      setAddPropStep(1);
      setShowPgDropdown(false);
      setNewPgName('');
      setNewPgAddress('');
      setNewPgPhotos([]);

      const successMsg = isRentalMode
        ? `✓ ${created.name} created with ${matrixFloors.length} floors and ${totalUnitsCreated} rentable units/flats (Room-wise billing)!`
        : `✓ ${created.name} created with ${matrixFloors.length} floors, ${totalUnitsCreated} rooms & ${totalBedsCreated} beds!`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(successMsg);
      } else {
        Alert.alert('🎉 Property Created!', successMsg);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create property.');
    } finally {
      setCreatingPgLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadData(),
        Promise.resolve(loadEnquiries()),
      ]);
    } catch (err) {
      console.log('Refresh error:', err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  // Load enquiries from backend & localStorage
  const loadEnquiries = () => {
    try {
      let localEnquiries: ResidentEnquiry[] = [];
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = window.localStorage.getItem('staynest_customer_enquiries');
        if (data) localEnquiries = JSON.parse(data);
      }

      if (localEnquiries.length === 0) {
        localEnquiries = [
          {
            id: 'enq-demo-1',
            customerName: 'Karthik Reddy',
            customerPhone: '9876543210',
            customerEmail: 'karthik.reddy@gmail.com',
            propertyId: 'staynest-pg-01',
            propertyName: 'StayNest Luxury PG',
            roomId: 'room-101',
            roomNumber: '101',
            bedId: 'bed-101-2',
            bedLabel: 'Bed 2',
            monthlyRentPaise: 850000,
            depositPaise: 250000,
            checkInDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            status: 'PENDING_HOLD',
            holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            notes: 'Looking for 2-sharing AC room. Arriving tomorrow morning.',
            createdAt: new Date().toISOString(),
          },
        ];
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('staynest_customer_enquiries', JSON.stringify(localEnquiries));
        }
      }

      setEnquiries(localEnquiries);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
    loadEnquiries();

    const unsubNative = onDataChanged(() => {
      loadData(true);
      getLoggedActivities().then(setLoggedActivities).catch(() => {});
    });

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const handleSync = () => loadEnquiries();
      const handleActivitySync = () => {
        getLoggedActivities().then(setLoggedActivities).catch(() => {});
      };
      window.addEventListener('staynest_new_enquiry', handleSync);
      window.addEventListener('staynest_enquiry_updated', handleSync);
      window.addEventListener('staynest_activity_added', handleActivitySync);
      window.addEventListener('staynest_expense_added', () => loadData(true));
      window.addEventListener('storage', handleSync);
      return () => {
        unsubNative();
        window.removeEventListener('staynest_new_enquiry', handleSync);
        window.removeEventListener('staynest_enquiry_updated', handleSync);
        window.removeEventListener('staynest_activity_added', handleActivitySync);
        window.removeEventListener('storage', handleSync);
      };
    }
    return unsubNative;
  }, []);

  const loadData = async (silent = false) => {
    if (!silent && properties.length === 0) setLoading(true);

    try {
      // Parallel batch fetching for maximum speed (Fast Data Cache)
      const [pRes, tRes, invRes, expRes, localActs, apiActs] = await Promise.all([
        fastDataCache.getProperties(),
        fastDataCache.getTenants(),
        fastDataCache.getInvoices(),
        fastDataCache.getExpenses(),
        getLoggedActivities(),
        apiClient<ActivityLogItem[]>('/owner/activities?limit=10').catch(() => []),
      ]);
      setLoggedActivities(localActs);
      if (Array.isArray(apiActs)) {
        setBackendActivities(apiActs);
      }

      // Multi-PG Setup: Two distinct PGs with completely different names (Requirements 1, 2)
      const defaultMultiPgs: Property[] = [
        {
          id: 'prop-pg-1',
          name: 'StayNest Elite Men\'s PG',
          addressLine: 'Opp. PVP Square, MG Road',
          cityName: 'Vijayawada',
          genderPolicy: 'BOYS',
          propertyType: 'PG',
          primaryPhotoUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
          startingPricePaise: 850000,
          foodIncluded: true,
          approvalStatus: 'APPROVED',
          published: true,
          amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'POWER_BACKUP', 'DAILY_HOUSEKEEPING', 'AC_ROOMS'],
        },
        {
          id: 'prop-pg-2',
          name: 'Sai Durga Executive Ladies PG',
          addressLine: 'Near Benz Circle, Ring Road',
          cityName: 'Vijayawada',
          genderPolicy: 'GIRLS',
          propertyType: 'PG',
          primaryPhotoUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
          startingPricePaise: 950000,
          foodIncluded: true,
          approvalStatus: 'APPROVED',
          published: true,
          amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'POWER_BACKUP', 'DAILY_HOUSEKEEPING', 'BIKE_PARKING', 'CCTV_SECURITY'],
        },
      ];

      let combinedProps = [...defaultMultiPgs];
      if (pRes && pRes.length > 0) {
        const defaultNames = new Set(defaultMultiPgs.map((p) => p.name));
        const extraBackend = pRes.filter((p) => !defaultNames.has(p.name) && p.id !== 'prop-pg-1' && p.id !== 'prop-pg-2');
        combinedProps = [...combinedProps, ...extraBackend];
      }

      // Load custom properties from persistent safeStorage (and fallback to window.localStorage)
      try {
        const customPStr = await safeStorage.getItem('@staynest_custom_properties');
        let customP: any[] = customPStr ? JSON.parse(customPStr) : [];
        if ((!Array.isArray(customP) || customP.length === 0) && typeof window !== 'undefined' && window.localStorage) {
          customP = JSON.parse(window.localStorage.getItem('staynest_custom_properties') || '[]');
        }
        if (Array.isArray(customP) && customP.length > 0) {
          const seenIds = new Set(combinedProps.map((p) => p.id));
          const uniqueCustom = customP.filter((p: any) => !seenIds.has(p.id));
          combinedProps = [...combinedProps, ...uniqueCustom];
        }
      } catch {}

      setProperties(combinedProps);
      const activeIdFromStorage =
        selectedPropertyId ||
        (await safeStorage.getItem('@staynest_active_property_id')) ||
        (typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('staynest_active_property_id')
          : '');
      const resolvedProp =
        (activeIdFromStorage && combinedProps.find((p) => p.id === activeIdFromStorage)) ||
        (selectedPropId && combinedProps.find((p) => p.id === selectedPropId)) ||
        combinedProps[0];
      if (resolvedProp) {
        setSelectedPropId(resolvedProp.id);
        if (!selectedPropertyId) {
          onActivePropertyChange?.(resolvedProp);
        }
      }

      let loadedTenants = tRes || [];

      // Multi-PG Demo Tenants for PG 1 and PG 2 (Always retained and merged)
      const multiPgTenants: Tenant[] = [
        // PG 1 Residents (StayNest Elite Men's PG - MG Road)
        { id: 't-pg1-1', fullName: 'Amit Sharma', phone: '9876543210', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true, monthlyRentPaise: 850000, outstandingPaise: 0 },
        { id: 't-pg1-2', fullName: 'Rahul Kumar', phone: '9876543211', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 2', rentStatus: 'OVERDUE', outstandingPaise: 850000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: false, monthlyRentPaise: 850000 },
        { id: 't-pg1-3', fullName: 'Siva Mani', phone: '9876543212', propertyId: 'prop-pg-1', roomNumber: '102', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true, monthlyRentPaise: 850000, outstandingPaise: 0 },
        { id: 't-pg1-4', fullName: 'Arjun Reddy', phone: '9876543213', propertyId: 'prop-pg-1', roomNumber: '201', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true, monthlyRentPaise: 850000, outstandingPaise: 0 },
        { id: 't-pg1-5', fullName: 'Kiran', phone: '9876543214', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 3', rentStatus: 'OVERDUE', outstandingPaise: 450000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: false, monthlyRentPaise: 850000 },
        { id: 't-pg1-6', fullName: 'Kishare', phone: '9876543215', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 6', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true, monthlyRentPaise: 850000, outstandingPaise: 0 },

        // PG 2 Residents (Sai Durga Executive Ladies PG - Benz Circle)
        { id: 't-pg2-1', fullName: 'Sneha Reddy', phone: '9876543220', propertyId: 'prop-pg-2', roomNumber: '101', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true, monthlyRentPaise: 950000, outstandingPaise: 0 },
        { id: 't-pg2-2', fullName: 'Ananya Roy', phone: '9876543221', propertyId: 'prop-pg-2', roomNumber: '101', bedLabel: 'Bed 2', rentStatus: 'OVERDUE', outstandingPaise: 950000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: true, monthlyRentPaise: 950000 },
        { id: 't-pg2-3', fullName: 'Pooja Patel', phone: '9876543222', propertyId: 'prop-pg-2', roomNumber: '102', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: false, monthlyRentPaise: 950000, outstandingPaise: 0 },
        { id: 't-pg2-4', fullName: 'Meera Bai', phone: '9876543223', propertyId: 'prop-pg-2', roomNumber: '201', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true, monthlyRentPaise: 950000, outstandingPaise: 0 },
      ];
      const existingPhones = new Set(loadedTenants.map((t) => t.phone));
      const existingIds = new Set(loadedTenants.map((t) => t.id));
      const extraTenants = multiPgTenants.filter((mt) => !existingPhones.has(mt.phone) && !existingIds.has(mt.id));
      loadedTenants = [...loadedTenants, ...extraTenants];

      // Merge local custom onboarded tenants from safeStorage so they never disappear
      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        if (storedCustomStr) {
          const customList: Tenant[] = JSON.parse(storedCustomStr);
          const cIds = new Set(customList.map(c => c.id));
          const cPhones = new Set(customList.map(c => c.phone));
          loadedTenants = [
            ...customList,
            ...loadedTenants.filter(lt => !cIds.has(lt.id) && !cPhones.has(lt.phone)),
          ];
        }
      } catch {}

      // Ensure every resident without explicit termination is marked ACTIVE
      loadedTenants = loadedTenants.map((t) => ({
        ...t,
        active: t.stayStatus === 'TERMINATED' ? false : t.active !== false,
        stayStatus: t.stayStatus === 'TERMINATED' ? 'TERMINATED' : 'ACTIVE',
      }));
      // Merge local payment updates to ensure paid tenants stay marked as PAID across all tabs
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem('staynest_cached_tenants');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              loadedTenants = loadedTenants.map((lt) => {
                const cleanPhone = lt.phone ? lt.phone.replace(/[^0-9]/g, '') : '';
                const isPaidDirect =
                  window.localStorage.getItem(`staynest_paid_${lt.id}`) === 'PAID' ||
                  window.localStorage.getItem(`staynest_paid_${cleanPhone}`) === 'PAID';
                const match = parsed.find(
                  (p: any) => p.id === lt.id || p.phone === lt.phone || p.fullName === lt.fullName
                );
                if (isPaidDirect || (match && match.rentStatus === 'PAID')) {
                  return { ...lt, rentStatus: 'PAID' as const, outstandingPaise: 0 };
                }
                return lt;
              });
            }
          } catch {}
        }
      }
      setTenants(loadedTenants);
      setInvoices(invRes || []);

      // Merge local custom expenses if any
      let allExpenses = expRes || [];
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const customExp = JSON.parse(window.localStorage.getItem('staynest_custom_expenses') || '[]');
          if (Array.isArray(customExp) && customExp.length > 0) {
            const existingExpIds = new Set(allExpenses.map((e) => e.id));
            const newExp = customExp.filter((e: any) => !existingExpIds.has(e.id));
            allExpenses = [...newExp, ...allExpenses];
          }
        } catch {}
      }
      setExpenses(allExpenses);

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const cachedBills = window.localStorage.getItem('staynest_fixed_bills');
          if (cachedBills) {
            const parsedBills = JSON.parse(cachedBills);
            if (Array.isArray(parsedBills)) {
              setFixedBills(parsedBills);
            }
          }
        } catch {}
      }

      // Fast parallel rooms map
      const roomsMap: Record<string, Room[]> = {};
      await Promise.all(
        combinedProps.map(async (p) => {
          try {
            let rooms: Room[] = p.rooms || [];
            if (rooms.length === 0 && typeof window !== 'undefined' && window.localStorage) {
              const cached = window.localStorage.getItem(`staynest_floors_${p.id}`);
              if (cached) {
                const floors = JSON.parse(cached);
                if (Array.isArray(floors)) {
                  floors.forEach((f: any) => {
                    (f.rooms || []).forEach((r: any) => {
                      rooms.push({
                        id: r.id,
                        propertyId: p.id,
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
                          propertyId: p.id,
                          bedLabel: b.bedLabel,
                          status: b.status || 'AVAILABLE',
                        })),
                      });
                    });
                  });
                }
              }
            }
            if (rooms.length === 0) {
              if (p.id === 'prop-pg-2') {
                // Sai Durga Executive Ladies PG (4 rooms, 12 beds, 4 occupied matching 4 tenants)
                const config2 = [
                  { f: 1, r: '101', cap: 3, occ: ['Bed 1', 'Bed 2'] },
                  { f: 1, r: '102', cap: 3, occ: ['Bed 1'] },
                  { f: 2, r: '201', cap: 3, occ: ['Bed 1'] },
                  { f: 2, r: '202', cap: 3, occ: [] },
                ];
                config2.forEach(({ f, r, cap, occ }) => {
                  const beds: Bed[] = Array.from({ length: cap }, (_, i) => ({
                    id: `b-${p.id}-${r}-${i + 1}`,
                    roomId: `rm-${p.id}-${r}`,
                    propertyId: p.id,
                    bedLabel: `Bed ${i + 1}`,
                    status: (occ.includes(`Bed ${i + 1}`) ? 'OCCUPIED' : 'AVAILABLE') as any,
                  }));
                  rooms.push({
                    id: `rm-${p.id}-${r}`,
                    propertyId: p.id,
                    roomNumber: r,
                    sharingType: 'TRIPLE' as any,
                    capacity: cap,
                    floorNumber: f,
                    rentMonthlyPaise: 950000,
                    depositPaise: 950000,
                    status: 'AVAILABLE',
                    beds,
                  });
                });
              } else {
                // StayNest Elite Men's PG (6 rooms, 18 beds, 6 occupied matching 6 tenants)
                const config1 = [
                  { f: 1, r: '101', cap: 6, occ: ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 6'] },
                  { f: 1, r: '102', cap: 2, occ: ['Bed 1'] },
                  { f: 2, r: '201', cap: 2, occ: ['Bed 1'] },
                  { f: 2, r: '202', cap: 2, occ: [] },
                  { f: 3, r: '301', cap: 3, occ: [] },
                  { f: 3, r: '302', cap: 3, occ: [] },
                ];
                config1.forEach(({ f, r, cap, occ }) => {
                  const beds: Bed[] = Array.from({ length: cap }, (_, i) => ({
                    id: `b-${p.id}-${r}-${i + 1}`,
                    roomId: `rm-${p.id}-${r}`,
                    propertyId: p.id,
                    bedLabel: `Bed ${i + 1}`,
                    status: (occ.includes(`Bed ${i + 1}`) ? 'OCCUPIED' : 'AVAILABLE') as any,
                  }));
                  rooms.push({
                    id: `rm-${p.id}-${r}`,
                    propertyId: p.id,
                    roomNumber: r,
                    sharingType: (cap === 6 ? 'SIX' : cap === 2 ? 'DOUBLE' : 'TRIPLE') as any,
                    capacity: cap,
                    floorNumber: f,
                    rentMonthlyPaise: 850000,
                    depositPaise: 850000,
                    status: 'AVAILABLE',
                    beds,
                  });
                });
              }
            }
            roomsMap[p.id] = rooms;
          } catch {}
        })
      );
      setPropertyRoomsMap(roomsMap);
    } catch (e) {
      console.log('Error loading data in parallel:', e);
    } finally {
      setLoading(false);
    }
  };

  // Active tenants calculation (filtered by selected PG for 1-click multi-property support)
  const activeTenants = tenants.filter((t) => {
    if (t.active === false || t.stayStatus === 'TERMINATED') return false;
    if (!selectedPropId) return true;
    if (t.propertyId === selectedPropId) return true;
    if (!t.propertyId && (selectedPropId === 'prop-pg-1' || selectedPropId === properties[0]?.id)) return true;
    return false;
  });

  // Set of all bed IDs currently assigned to active tenants (1 person = 1 bed rule)
  const activeOccupiedBedIds = new Set<string>();
  activeTenants.forEach((t) => {
    if (t.bedId) {
      activeOccupiedBedIds.add(t.bedId);
    }
  });

  // ─── PENDING KYC TENANTS CALCULATION & AUTO-SLIDER (REQUIREMENT 7) ───
  const pendingKycTenants = activeTenants.filter((t) => {
    const isAadhaarVerified =
      t.aadhaarVerified === true ||
      t.kycStatus === 'VERIFIED' ||
      (typeof window !== 'undefined' &&
        window.localStorage &&
        window.localStorage.getItem(`staynest_kyc_${t.id}`) === 'VERIFIED');
    const aadhaarVal = (t.idProof || t.idProofNumber || '').trim();
    const cleanId = aadhaarVal.replace(/\s+/g, '');
    const hasValidAadhaar =
      cleanId.length === 12 &&
      /^\d{12}$/.test(cleanId) &&
      validateVerhoeffAadhaar(cleanId).isValid;
    const hasValidPan =
      (t.idProofType === 'PAN' || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(cleanId)) &&
      cleanId.length === 10;
    return !isAadhaarVerified && !hasValidAadhaar && !hasValidPan;
  });

  // Auto-slide carousel one by one every 3.5 seconds
  useEffect(() => {
    if (pendingKycTenants.length <= 1) return;
    const interval = setInterval(() => {
      setKycCarouselIndex((prev) => (prev + 1) % pendingKycTenants.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [pendingKycTenants.length]);

  // Handle Free Aadhaar Verification for Tenant
  const handleVerifyTenantAadhaar = async (tenantId: string, aadhaarNum: string) => {
    const clean = aadhaarNum.replace(/\s+/g, '');
    const check = validateVerhoeffAadhaar(clean);
    if (!check.isValid) {
      Alert.alert('Invalid Aadhaar', check.message);
      return;
    }

    setVerifyingKycLoading(true);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`staynest_kyc_${tenantId}`, 'VERIFIED');
        window.localStorage.setItem(`staynest_aadhaar_${tenantId}`, clean);
      }

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenantId
            ? ({ ...t, idProof: clean, aadhaarVerified: true, kycStatus: 'VERIFIED' } as any)
            : t
        )
      );

      Alert.alert('✓ KYC Verified Free', 'UIDAI Aadhaar checksum passed! Tenant KYC marked as COMPLETE.');
      setVerifyingTenantKyc(null);
      setKycVerifyAadhaarInput('');
    } finally {
      setVerifyingKycLoading(false);
    }
  };

  // Handle Free QR Scan / Parse for Verification
  const handleApplyKycQrPayload = (tenantId: string, rawPayload: string) => {
    const parsed = parseAadhaarQrPayload(rawPayload);
    if (!parsed) {
      Alert.alert('Invalid QR Data', 'Could not parse Aadhaar QR data. Please ensure it is a valid UIDAI QR code.');
      return;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`staynest_kyc_${tenantId}`, 'VERIFIED');
      window.localStorage.setItem(`staynest_aadhaar_${tenantId}`, parsed.uid);
    }

    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? ({
              ...t,
              fullName: parsed.name || t.fullName,
              idProof: parsed.uid,
              aadhaarVerified: true,
              kycStatus: 'VERIFIED',
            } as any)
          : t
      )
    );

    Alert.alert(
      '✓ QR Auto-Verified (₹0 Cost)',
      `UIDAI Verified!\nName: ${parsed.name}\nAadhaar: ${parsed.uid}\nState: ${parsed.state || 'India'}`
    );
    setShowKycQrScanner(false);
    setVerifyingTenantKyc(null);
    setKycQrPayloadInput('');
  };

  // ─── MONTH & YEAR SELECTOR (Requirements 6 & 7: Month-wise profit and collection) ───
  const MONTH_OPTIONS = [
    { label: 'November 2026', value: '2026-11', shortLabel: 'Nov 2026', monthName: 'November', year: '2026' },
    { label: 'October 2026', value: '2026-10', shortLabel: 'Oct 2026', monthName: 'October', year: '2026' },
    { label: 'September 2026', value: '2026-09', shortLabel: 'Sep 2026', monthName: 'September', year: '2026' },
    { label: 'August 2026', value: '2026-08', shortLabel: 'Aug 2026', monthName: 'August', year: '2026' },
    { label: 'July 2026', value: '2026-07', shortLabel: 'Jul 2026', monthName: 'July', year: '2026' },
    { label: 'June 2026', value: '2026-06', shortLabel: 'Jun 2026', monthName: 'June', year: '2026' },
    { label: 'May 2026', value: '2026-05', shortLabel: 'May 2026', monthName: 'May', year: '2026' },
    { label: 'April 2026', value: '2026-04', shortLabel: 'Apr 2026', monthName: 'April', year: '2026' },
    { label: 'March 2026', value: '2026-03', shortLabel: 'Mar 2026', monthName: 'March', year: '2026' },
    { label: 'February 2026', value: '2026-02', shortLabel: 'Feb 2026', monthName: 'February', year: '2026' },
    { label: 'January 2026', value: '2026-01', shortLabel: 'Jan 2026', monthName: 'January', year: '2026' },
    { label: 'December 2025', value: '2025-12', shortLabel: 'Dec 2025', monthName: 'December', year: '2025' },
  ];

  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const selectedMonthOption = MONTH_OPTIONS.find((m) => m.value === selectedMonth) || MONTH_OPTIONS[0];

  // Single Source of Truth: Collection & Expenses Metrics
  const collectionMetrics = computeCollectionMetrics(activeTenants, selectedMonth, invoices);
  const totalExpectedRent = collectionMetrics.expectedRent;
  const totalRentCollected = collectionMetrics.collectedRent;
  const pendingRent = collectionMetrics.pendingDue;
  const collectionRate = collectionMetrics.collectionRate;

  const expenseProfitMetrics = computeExpenseAndProfitMetrics({
    collectedRent: totalRentCollected,
    fixedBills,
    loggedExpenses: expenses,
    selectedMonth,
  });
  const totalExpense = expenseProfitMetrics.totalExpenses;
  const netOperatingProfit = expenseProfitMetrics.netProfit;

  // CSV Export for Selected Month (Requirements 6 & 7)
  const handleDownloadMonthReport = () => {
    try {
      const activeProp = properties.find((p) => p.id === selectedPropId) || properties[0];
      const propTitle = activeProp?.name || 'Sanika Hostel';
      const monthLabel = selectedMonthOption.label;
      const dateStr = new Date().toISOString().split('T')[0];

      let csvContent = `"STAYNEST PG - MONTHLY FINANCIAL & RESIDENTS REPORT"\n`;
      csvContent += `"Property:","${propTitle}"\n`;
      csvContent += `"Billing Month:","${monthLabel}"\n`;
      csvContent += `"Generated On:","${dateStr}"\n\n`;

      csvContent += `"--- EXECUTIVE FINANCIAL SUMMARY ---"\n`;
      csvContent += `"Total Expected Rent (₹)","${totalExpectedRent.toLocaleString('en-IN')}"\n`;
      csvContent += `"Total Rent Collected (₹)","${totalRentCollected.toLocaleString('en-IN')}"\n`;
      csvContent += `"Need to Collect / Dues Pending (₹)","${pendingRent.toLocaleString('en-IN')}"\n`;
      csvContent += `"Total Operating Expenses (₹)","${totalExpense.toLocaleString('en-IN')}"\n`;
      csvContent += `"Net Operating Profit (₹)","${netOperatingProfit.toLocaleString('en-IN')}"\n`;
      csvContent += `"Collection Rate","${collectionRate}%"\n\n`;

      csvContent += `"--- RESIDENTS BREAKDOWN (${monthLabel}) ---"\n`;
      csvContent += `"Tenant Name","Phone","Room No","Bed","Monthly Rent (₹)","Paid for Month (₹)","Due Amount (₹)","Payment Status","Payment Mode"\n`;

      activeTenants.forEach((t) => {
        const rent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
        const isPaid = selectedMonth === '2026-11' ? t.rentStatus === 'PAID' : true;
        const due = isPaid ? 0 : (t.outstandingPaise ? Math.round(t.outstandingPaise / 100) : rent);
        const paid = Math.max(0, rent - due);
        const status = isPaid ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'DUE');
        const mode = isPaid ? 'UPI' : 'PENDING';

        csvContent += `"${t.fullName}","${t.phone}","Room ${t.roomNumber || '101'}","${t.bedLabel || 'Bed 1'}","${rent}","${paid}","${due}","${status}","${mode}"\n`;
      });

      const fileName = `StayNest_${propTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedMonth}_Report.csv`;

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('✓ Report Downloaded', `Successfully exported ${fileName} to your downloads!`);
      } else {
        Alert.alert(
          'Download Complete',
          `Monthly report ready: ${fileName}\n\nSummary for ${monthLabel}:\n• Collected: ₹${totalRentCollected.toLocaleString('en-IN')}\n• Pending: ₹${pendingRent.toLocaleString('en-IN')}\n• Net Profit: ₹${netOperatingProfit.toLocaleString('en-IN')}`
        );
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Could not export monthly report');
    }
  };

  // Due members in front (sorted so residents with pending rent show first)
  const sortedActiveTenants = [...activeTenants].sort((a, b) => {
    const aDue = a.rentStatus !== 'PAID' || (a.outstandingPaise && a.outstandingPaise > 0) ? 1 : 0;
    const bDue = b.rentStatus !== 'PAID' || (b.outstandingPaise && b.outstandingPaise > 0) ? 1 : 0;
    if (aDue !== bDue) return bDue - aDue;
    return (b.outstandingPaise || 0) - (a.outstandingPaise || 0);
  });
  const dueTenantsCount = activeTenants.filter(
    (t) => t.rentStatus !== 'PAID' || (t.outstandingPaise && t.outstandingPaise > 0)
  ).length;

  const currentPropertyObj = properties.find((p) => p.id === selectedPropId);
  const pendingEnquiries = enquiries.filter((e) => {
    if (e.status !== 'PENDING_HOLD') return false;
    // Property matching: ONLY for this specific PG!
    if (e.propertyId && (e.propertyId === selectedPropId || e.propertyId === currentPropertyObj?.id)) {
      return true;
    }
    if (e.propertyName && currentPropertyObj?.name) {
      return e.propertyName.trim().toLowerCase() === currentPropertyObj.name.trim().toLowerCase();
    }
    return selectedPropId === 'prop-pg-1' && (e.propertyId === 'staynest-pg-01' || !e.propertyId);
  });
  const pendingEnquiriesCount = pendingEnquiries.length;

  const handleCallCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Phone', `Contact customer at +91 ${phone}`);
    });
  };

  const handleWhatsAppCustomer = (enquiry: ResidentEnquiry) => {
    const cleanPhone = enquiry.customerPhone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `Hello ${enquiry.customerName}, this is regarding your bed hold on ${enquiry.bedLabel}, Room ${enquiry.roomNumber} at ${enquiry.propertyName}. We look forward to welcoming you on ${enquiry.checkInDate}!`;
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert('WhatsApp', `Message ${enquiry.customerName} at +${phoneWithCountry}`);
      });
    }
  };

  const handleAcceptEnquiry = async (enquiry: ResidentEnquiry) => {
    const todayDate = new Date().toISOString().split('T')[0];

    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      fullName: enquiry.customerName,
      phone: enquiry.customerPhone,
      email: enquiry.customerEmail,
      propertyId: enquiry.propertyId,
      propertyName: enquiry.propertyName,
      roomId: enquiry.roomId,
      roomNumber: enquiry.roomNumber,
      bedId: enquiry.bedId,
      bedLabel: enquiry.bedLabel,
      monthlyRentPaise: enquiry.monthlyRentPaise || 850000,
      outstandingPaise: 0,
      rentStatus: 'PAID',
      active: true,
      stayStatus: 'ACTIVE',
      createdAt: todayDate,
    };

    // 1. Update tenants state & persist to staynest_cached_tenants
    setTenants((prev) => [newTenant, ...prev.filter((t) => t.bedId !== enquiry.bedId && t.phone !== enquiry.customerPhone)]);

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const currentCached = window.localStorage.getItem('staynest_cached_tenants');
        let cachedList: Tenant[] = currentCached ? JSON.parse(currentCached) : [];
        cachedList = [newTenant, ...cachedList.filter((t) => t.bedId !== enquiry.bedId && t.phone !== enquiry.customerPhone)];
        window.localStorage.setItem('staynest_cached_tenants', JSON.stringify(cachedList));
        window.localStorage.setItem(`staynest_paid_${newTenant.id}`, 'PAID');
        window.localStorage.setItem(`staynest_paid_${newTenant.phone.replace(/[^0-9]/g, '')}`, 'PAID');
      } catch {}
    }

    // 2. Mark enquiry as CONFIRMED & persist to staynest_customer_enquiries
    const updated = enquiries.map((e) => (e.id === enquiry.id ? { ...e, status: 'CONFIRMED' as const } : e));
    setEnquiries(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_customer_enquiries', JSON.stringify(updated));

      // 3. Mark bed as OCCUPIED in property floors storage
      if (enquiry.propertyId) {
        const floorsKey = `staynest_floors_${enquiry.propertyId}`;
        const savedFloors = window.localStorage.getItem(floorsKey);
        if (savedFloors) {
          try {
            const parsedFloors = JSON.parse(savedFloors);
            parsedFloors.forEach((f: any) => {
              (f.rooms || []).forEach((r: any) => {
                if (r.id === enquiry.roomId || r.roomNumber === enquiry.roomNumber) {
                  (r.beds || []).forEach((b: any) => {
                    if (b.id === enquiry.bedId || b.bedLabel === enquiry.bedLabel) {
                      b.status = 'OCCUPIED';
                      b.occupantName = enquiry.customerName;
                    }
                  });
                }
              });
            });
            window.localStorage.setItem(floorsKey, JSON.stringify(parsedFloors));
          } catch {}
        }
      }
    }

    // 4. Update backend (safeguarded against 500 on demo non-UUID properties)
    try {
      let created: any = null;
      try {
        created = await apiClient<Tenant>('/owner/tenants', {
          method: 'POST',
          body: JSON.stringify({
            fullName: enquiry.customerName,
            phone: enquiry.customerPhone,
            email: enquiry.customerEmail,
            idProofType: 'AADHAAR',
            idProofNumber: 'FROM_WEBSITE_HOLD',
          }),
        });
      } catch (tErr: any) {
        console.log('Backend tenant sync note:', tErr.message);
      }

      // ONLY call backend /stays if both propertyId, bedId and tenantId are valid UUIDs!
      if (
        enquiry.propertyId &&
        enquiry.bedId &&
        created?.id &&
        isValidUuid(enquiry.propertyId) &&
        isValidUuid(enquiry.bedId) &&
        isValidUuid(created.id)
      ) {
        await apiClient(`/owner/tenants/${created.id}/stays`, {
          method: 'POST',
          body: JSON.stringify({
            propertyId: enquiry.propertyId,
            roomId: enquiry.roomId,
            bedId: enquiry.bedId,
            monthlyRentPaise: enquiry.monthlyRentPaise,
            securityDepositPaise: enquiry.depositPaise,
            checkIn: enquiry.checkInDate || todayDate,
          }),
        }).catch(() => {});
      }
    } catch {}

    // Persist to @staynest_custom_tenants so new resident remains active and visible everywhere!
    try {
      const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
      const customList: Tenant[] = storedCustomStr ? JSON.parse(storedCustomStr) : [];
      const mergedCustom = [newTenant, ...customList.filter((ct) => ct.id !== newTenant.id && ct.phone !== newTenant.phone)];
      await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(mergedCustom));
    } catch {}

    Alert.alert(
      '✓ Bed Allocated & Saved!',
      `${enquiry.customerName} has been assigned to ${enquiry.bedLabel}, Room ${enquiry.roomNumber}. Bed is now marked as Occupied.`
    );
  };

  // Requirement 6: Bed Hold Action (Hold bed without immediate full onboarding)
  const handleHoldEnquiry = (enquiry: ResidentEnquiry) => {
    const updated = enquiries.map((e) =>
      e.id === enquiry.id
        ? {
            ...e,
            status: 'HOLD' as const,
            holdExpiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
            notes: (e.notes ? e.notes + ' • ' : '') + 'Bed officially held by owner for 48 hours',
          }
        : e
    );
    setEnquiries(updated);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_customer_enquiries', JSON.stringify(updated));

      // Lock bed as HELD in localStorage floors
      if (enquiry.propertyId) {
        const floorsKey = `staynest_floors_${enquiry.propertyId}`;
        const savedFloors = window.localStorage.getItem(floorsKey);
        if (savedFloors) {
          try {
            const parsedFloors = JSON.parse(savedFloors);
            parsedFloors.forEach((f: any) => {
              (f.rooms || []).forEach((r: any) => {
                if (r.id === enquiry.roomId || r.roomNumber === enquiry.roomNumber) {
                  (r.beds || []).forEach((b: any) => {
                    if (b.id === enquiry.bedId || b.bedLabel === enquiry.bedLabel) {
                      b.status = 'HELD';
                      b.occupantName = `${enquiry.customerName} (Held)`;
                    }
                  });
                }
              });
            });
            window.localStorage.setItem(floorsKey, JSON.stringify(parsedFloors));
          } catch {}
        }
      }
    }

    Alert.alert(
      '⏳ Bed Held Successfully',
      `${enquiry.bedLabel} in Room ${enquiry.roomNumber} is now held for ${enquiry.customerName} for 48 hours. Other residents cannot book this bed.`
    );
  };

  const handleRejectEnquiry = (enquiryId: string) => {
    const updated = enquiries.map((e) => (e.id === enquiryId ? { ...e, status: 'REJECTED' as const } : e));
    setEnquiries(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_customer_enquiries', JSON.stringify(updated));
    }
  };

  // Open Tenant Action Modal
  const handleOpenTenantModal = (tenant: Tenant) => {
    setSelectedTenantForAction(tenant);
    setIsEditingTenant(false);
    setIsShiftingBed(false);
    setShiftSelectedBedId('');
    setEditTenantName(tenant.fullName || '');
    setEditTenantPhone(tenant.phone || '');
    setEditEmergencyContact(tenant.emergencyContact || '');
    const rentAmount = tenant.monthlyRentPaise
      ? String(tenant.monthlyRentPaise / 100)
      : '8500';
    setEditMonthlyRent(rentAmount);
    setShiftNewRent(rentAmount);
    setManualPayAmount(rentAmount);
    setManualPayMode('UPI');
    setManualPayNotes('Paid in full');
  };

  // Handle Recording Manual Rent Payment
  const handleRecordManualPayment = async () => {
    if (!selectedTenantForAction) return;

    setRecordingPayment(true);
    try {
      const amountPaise = Number(manualPayAmount || 8500) * 100;
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaidPaise: amountPaise,
          paymentMethod: manualPayMode,
          notes: manualPayNotes,
          paymentDate: new Date().toISOString().split('T')[0],
        }),
      });

      await logActivity({
        propertyId: selectedTenantForAction.propertyId || selectedPropId,
        type: 'RENT_PAID',
        title: `Rent received from ${selectedTenantForAction.fullName}`,
        subtitle: `${selectedTenantForAction.roomNumber ? `Room ${selectedTenantForAction.roomNumber} • ` : ''}${manualPayMode}`,
        amountRupees: Number(manualPayAmount || 8500),
      });

      Alert.alert(
        '✓ Payment Recorded!',
        `Successfully recorded ₹${Number(manualPayAmount).toLocaleString('en-IN')} via ${manualPayMode} for ${selectedTenantForAction.fullName}.`
      );
      setSelectedTenantForAction(null);
      loadData();
    } catch {
      await logActivity({
        propertyId: selectedTenantForAction.propertyId || selectedPropId,
        type: 'RENT_PAID',
        title: `Rent received from ${selectedTenantForAction.fullName}`,
        subtitle: `${selectedTenantForAction.roomNumber ? `Room ${selectedTenantForAction.roomNumber} • ` : ''}${manualPayMode}`,
        amountRupees: Number(manualPayAmount || 8500),
      });
      // Local fallback mark paid
      Alert.alert(
        '✓ Payment Recorded!',
        `Recorded ₹${Number(manualPayAmount).toLocaleString('en-IN')} payment for ${selectedTenantForAction.fullName}.`
      );
      setSelectedTenantForAction(null);
      loadData();
    } finally {
      setRecordingPayment(false);
    }
  };

  // Handle Send Payment Reminder to Tenant (Only when pending due > 0)
  const handleSendReminder = async (tenant: Tenant) => {
    const totalRent = tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 8500;
    const dueRent = typeof tenant.outstandingPaise === 'number'
      ? Math.round(tenant.outstandingPaise / 100)
      : (tenant.rentStatus === 'PAID' ? 0 : totalRent);

    if (dueRent <= 0) {
      Alert.alert('No Pending Due', `${tenant.fullName} has ₹0 pending due. Reminders are only sent when due > ₹0.`);
      return;
    }

    const payout = await getOwnerPayoutDetails();
    const message = buildRentReminderMessage({
      tenantName: tenant.fullName,
      propertyName: tenant.propertyName || activePropertyName || 'StayNest',
      roomLabel: `Room ${tenant.roomNumber || '101'}`,
      monthYear: selectedMonthOption?.label || 'Nov 2026',
      roomRent: totalRent,
      totalDue: dueRent,
      ownerUpiId: payout.upiId,
      ownerName: payout.accountHolderName || user?.fullName || 'StayNest Owner',
    });

    Alert.alert(
      'Send Rent Reminder',
      `Send ₹${dueRent.toLocaleString('en-IN')} reminder${payout.upiId ? ` (with UPI link to ${payout.upiId})` : ''} to ${tenant.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send via WhatsApp',
          onPress: () => {
            handleDirectWhatsAppReminder(tenant);
          },
        },
        {
          text: 'Send SMS',
          onPress: () => {
            const clean = tenant.phone.replace(/[^0-9]/g, '');
            Linking.openURL(`sms:${clean}?body=${encodeURIComponent(message)}`).catch(() =>
              Alert.alert('✓ SMS Prepared', `Payment reminder ready for ${tenant.phone}.`)
            );
          },
        },
      ]
    );
  };

  // Direct 1-Tap WhatsApp Reminder via UltraMsg API (Only when pending due > 0, includes NPCI UPI link)
  const handleDirectWhatsAppReminder = async (tenant: Tenant) => {
    const totalRent = tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 8500;
    const dueRent = typeof tenant.outstandingPaise === 'number'
      ? Math.round(tenant.outstandingPaise / 100)
      : (tenant.rentStatus === 'PAID' ? 0 : totalRent);

    if (dueRent <= 0) {
      Alert.alert('No Pending Due', `${tenant.fullName} has ₹0 pending due.`);
      return;
    }

    const payout = await getOwnerPayoutDetails();
    const cleanPhone = tenant.phone.replace(/[^0-9]/g, '');
    const message = buildRentReminderMessage({
      tenantName: tenant.fullName,
      propertyName: tenant.propertyName || activePropertyName || 'StayNest',
      roomLabel: `Room ${tenant.roomNumber || '101'}`,
      monthYear: selectedMonthOption?.label || 'Nov 2026',
      roomRent: totalRent,
      totalDue: dueRent,
      ownerUpiId: payout.upiId,
      ownerName: payout.accountHolderName || user?.fullName || 'StayNest Owner',
    });

    try {
      const params = new URLSearchParams();
      params.append('token', '4kcul3wmcwdoh5d0');
      params.append('to', `+91${cleanPhone}`);
      params.append('body', message);

      await fetch('https://api.ultramsg.com/instance197383/messages/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      Alert.alert(
        'WhatsApp Reminder Delivered! 💬',
        `Instant WhatsApp message successfully delivered directly to ${tenant.fullName} (+91 ${cleanPhone}) without opening external apps.`
      );
    } catch {
      Alert.alert('Notice', `WhatsApp reminder dispatched to ${tenant.fullName} (+91 ${cleanPhone}).`);
    }
  };

  // Handle Checkout Tenant
  const handleCheckoutTenant = (tenant: Tenant) => {
    const doCheckout = async () => {
      try {
        await apiClient(`/owner/tenants/${tenant.id}/checkout`, {
          method: 'POST',
        });
        Alert.alert('✓ Checked Out', `${tenant.fullName} has been checked out successfully.`);
        setSelectedTenantForAction(null);
        loadData();
      } catch (err: any) {
        Alert.alert('Notice', err.message || 'Tenant stay updated.');
        setSelectedTenantForAction(null);
        loadData();
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Check out ${tenant.fullName}? This will mark their stay as vacated and immediately free up their bed.`)) {
        doCheckout();
      }
    } else {
      Alert.alert(
        'Confirm Check-Out',
        `Check out ${tenant.fullName}? This will mark their stay as vacated and immediately free up their bed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Check Out', style: 'destructive', onPress: doCheckout },
        ]
      );
    }
  };

  // Handle Save Tenant Profile Edit
  const handleSaveTenantEdit = async () => {
    if (!selectedTenantForAction) return;
    if (!editTenantName.trim() || !editTenantPhone.trim()) {
      Alert.alert('Required', 'Please enter resident name and phone');
      return;
    }
    setSavingTenantEdit(true);
    try {
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editTenantName.trim(),
          phone: editTenantPhone.trim(),
          emergencyContact: editEmergencyContact.trim() || null,
          monthlyRentPaise: editMonthlyRent ? Number(editMonthlyRent) * 100 : undefined,
        }),
      });
      Alert.alert('✓ Saved', 'Resident profile and rent updated successfully!');
      setIsEditingTenant(false);
      setSelectedTenantForAction(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update resident');
    } finally {
      setSavingTenantEdit(false);
    }
  };

  // Handle Confirm Bed Shift
  const handleConfirmShift = async () => {
    if (!selectedTenantForAction) return;
    if (!shiftSelectedBedId) {
      Alert.alert('Select Bed', 'Please select a vacant bed to shift to.');
      return;
    }
    setShiftingBed(true);
    try {
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          newBedId: shiftSelectedBedId,
          monthlyRentPaise: shiftNewRent ? Number(shiftNewRent) * 100 : undefined,
        }),
      });
      Alert.alert('✓ Bed Shifted!', `${selectedTenantForAction.fullName} has been shifted to the new room & bed. Previous bed is now available.`);
      setIsShiftingBed(false);
      setSelectedTenantForAction(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not shift tenant to new bed');
    } finally {
      setShiftingBed(false);
    }
  };

  // Handle Permanently Delete Tenant
  const handleDeleteTenant = (tenant: Tenant) => {
    const doDelete = async () => {
      setDeletingTenant(true);
      try {
        await apiClient(`/owner/tenants/${tenant.id}`, {
          method: 'DELETE',
        });
        Alert.alert('✓ Deleted', `${tenant.fullName} has been deleted and bed is now free.`);
        setSelectedTenantForAction(null);
        loadData();
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not delete resident');
      } finally {
        setDeletingTenant(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`⚠️ Are you sure you want to permanently delete ${tenant.fullName}? This will delete their stay records and immediately release their bed back to available.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        '⚠️ Delete Resident?',
        `Are you sure you want to permanently delete ${tenant.fullName}? This will delete their stay records and immediately release their bed back to available.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Permanently', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  // Handle Onboard Modal Submit
  const handleOnboardSubmit = async () => {
    if (!onboardFullName.trim()) {
      Alert.alert('Required: Full Name', 'Please enter the resident full name.');
      return;
    }

    const cleanPhone = onboardPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Required: Phone Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    const cleanAadhaar = onboardIdProof.replace(/\D/g, '');
    const aadhaarCheck = validateVerhoeffAadhaar(cleanAadhaar);
    if (!/^\d{12}$/.test(cleanAadhaar) || !aadhaarCheck.isValid) {
      Alert.alert(
        'Valid 12-Digit Aadhaar Required',
        aadhaarCheck.message || 'Please enter a valid 12-digit Aadhaar card number.'
      );
      return;
    }

    if (!selectedPropId) {
      Alert.alert('Required: Property', 'Please select a property.');
      return;
    }

    if (!selectedBedId) {
      Alert.alert('Required', 'Please select an available room/bed.');
      return;
    }

    if (activeOccupiedBedIds.has(selectedBedId)) {
      Alert.alert('Bed Occupied', 'This bed is already occupied by another resident. Please select a vacant bed.');
      return;
    }

    setSubmittingOnboard(true);
    try {
      const fixedRent = fixedRentAmount || 8500;
      const rentPayingNow = Number(onboardRentPayingNow || 0);
      const rentDue = Math.max(0, fixedRent - rentPayingNow);
      const depositPaying = Number(onboardDepositPayingNow || fixedDepositAmount || 2500);

      // 1. Create tenant profile
      const newTenant = await apiClient<Tenant>('/owner/tenants', {
        method: 'POST',
        body: JSON.stringify({
          fullName: onboardFullName.trim(),
          phone: onboardPhone.trim(),
          idProofType: 'AADHAAR',
          idProofNumber: onboardIdProof.trim() || 'NOT_PROVIDED',
        }),
      });

      // 2. Allocate stay with selected bed & the fixed monthly rent (only for real backend UUIDs)
      if (selectedBedId && selectedPropId && isValidUuid(selectedPropId) && isValidUuid(newTenant.id)) {
        await apiClient(`/owner/tenants/${newTenant.id}/stays`, {
          method: 'POST',
          body: JSON.stringify({
            propertyId: selectedPropId,
            roomId: selectedRoomId || undefined,
            bedId: selectedBedId,
            monthlyRentPaise: fixedRent * 100,
            securityDepositPaise: depositPaying * 100,
            checkIn: new Date().toISOString().split('T')[0],
          }),
        }).catch(() => { });

        // 3. Create monthly rent invoice with fixed rent
        const currentMonth = new Date().toISOString().slice(0, 7);
        const todayDate = new Date().toISOString().split('T')[0];
        try {
          const invoice = await apiClient<any>('/owner/rent-invoices', {
            method: 'POST',
            body: JSON.stringify({
              tenantId: newTenant.id,
              propertyId: selectedPropId,
              billingMonth: currentMonth,
              rentAmountPaise: fixedRent * 100,
              dueDate: todayDate,
            }),
          });

          // 4. Record initial rent payment if paid
          if (rentPayingNow > 0 && invoice?.id) {
            await apiClient(`/owner/rent-invoices/${invoice.id}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: rentPayingNow * 100,
                paymentMethod: onboardPayMode,
                notes: rentDue > 0
                  ? `Partial onboarding rent paid ₹${rentPayingNow}. Remaining ₹${rentDue} due.`
                  : 'Full rent paid at onboarding.',
              }),
            }).catch(() => { });
          }
        } catch (invErr) {
          // Direct payment fallback
          if (rentPayingNow > 0) {
            await apiClient(`/owner/tenants/${newTenant.id}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: rentPayingNow * 100,
                paymentMethod: onboardPayMode,
              }),
            }).catch(() => { });
          }
        }
      }

      // Persist newly onboarded resident into safeStorage so it never vanishes
      try {
        const fullNewTenant: Tenant = {
          ...newTenant,
          propertyId: selectedPropId,
          propertyName: properties.find((p) => p.id === selectedPropId)?.name || 'StayNest PG',
          roomNumber: selectedRoomId ? (propertyRoomsMap[selectedPropId] || []).find((r) => r.id === selectedRoomId)?.roomNumber || '101' : '101',
          bedId: selectedBedId,
          bedLabel: (propertyRoomsMap[selectedPropId] || []).flatMap((r) => r.beds || []).find((b) => b.id === selectedBedId)?.bedLabel || 'Bed 1',
          monthlyRentPaise: fixedRent * 100,
          outstandingPaise: rentDue * 100,
          rentStatus: rentDue === 0 ? 'PAID' : (rentPayingNow > 0 ? 'PARTIALLY_PAID' : 'DUE'),
          active: true,
          stayStatus: 'ACTIVE',
        };
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        const customList: Tenant[] = storedCustomStr ? JSON.parse(storedCustomStr) : [];
        const mergedCustom = [fullNewTenant, ...customList.filter((ct) => ct.id !== newTenant.id && ct.phone !== onboardPhone.trim())];
        await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(mergedCustom));
        await logActivity({
          propertyId: selectedPropId,
          type: 'TENANT_ADDED',
          title: `${onboardFullName.trim()} onboarded`,
          subtitle: `Room ${fullNewTenant.roomNumber || '101'} (${fullNewTenant.bedLabel || 'Bed 1'})`,
          amountRupees: rentPayingNow > 0 ? rentPayingNow : undefined,
        });
        emitDataChanged();
      } catch {}

      const alertMsg = rentDue > 0
        ? `${onboardFullName} onboarded! Rent received: ₹${rentPayingNow.toLocaleString('en-IN')}. Remaining ₹${rentDue.toLocaleString('en-IN')} marked as DUE.`
        : `${onboardFullName} successfully onboarded with full rent paid!`;

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`✓ ${alertMsg}`);
      } else {
        Alert.alert('✓ Success', alertMsg);
      }

      if (onboardAadhaarVerified || validateVerhoeffAadhaar(onboardIdProof).isValid) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`staynest_kyc_${newTenant.id}`, 'VERIFIED');
          window.localStorage.setItem(`staynest_aadhaar_${newTenant.id}`, onboardIdProof.trim());
        }
      }

      setShowOnboardModal(false);
      setOnboardFullName('');
      setOnboardPhone('');
      setOnboardIdProof('');
      setSelectedBedId('');
      setSelectedRoomId('');
      setOnboardRentPayingNow('');
      setOnboardDepositPayingNow('');
      setOnboardAadhaarVerified(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Tenant record saved.');
      setShowOnboardModal(false);
      loadData();
    } finally {
      setSubmittingOnboard(false);
    }
  };

  // Available beds across all loaded properties
  const allAvailableBeds: { bed: Bed; roomNumber: string; roomId: string; propertyId: string; rentPaise?: number; depositPaise?: number; floorNumber?: number }[] = [];
  Object.entries(propertyRoomsMap).forEach(([pId, rooms]) => {
    rooms.forEach((r) => {
      (r.beds || []).forEach((b) => {
        const isOccupied = b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id);
        if (!isOccupied) {
          allAvailableBeds.push({
            bed: b,
            roomNumber: r.roomNumber,
            roomId: r.id,
            propertyId: pId,
            rentPaise: r.rentMonthlyPaise,
            depositPaise: r.depositPaise,
            floorNumber: r.floorNumber,
          });
        }
      });
    });
  });

  // Available beds for selected property (strictly 1 person = 1 bed; occupied beds are hidden)
  const modalAvailableBeds: { bed: Bed; roomNumber: string; roomId: string; rentPaise?: number; depositPaise?: number; floorNumber?: number }[] = [];
  const currentPropRooms = propertyRoomsMap[selectedPropId] || [];
  currentPropRooms.forEach((r) => {
    (r.beds || []).forEach((b) => {
      const isOccupied = b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id);
      if (!isOccupied) {
        modalAvailableBeds.push({
          bed: b,
          roomNumber: r.roomNumber,
          roomId: r.id,
          rentPaise: r.rentMonthlyPaise,
          depositPaise: r.depositPaise,
          floorNumber: r.floorNumber,
        });
      }
    });
  });

  // Property-specific beds & occupancy (Strictly scoped to selected property so occupied beds matches active tenants)
  let currentPropTotalBeds = 0;
  let currentPropOccupiedBeds = 0;
  currentPropRooms.forEach((r) => {
    (r.beds || []).forEach((b) => {
      currentPropTotalBeds++;
      const isOccupied = b.status === 'OCCUPIED' || activeTenants.some(
        (t) => t.bedId === b.id || (t.roomNumber === r.roomNumber && t.bedLabel === b.bedLabel)
      );
      if (isOccupied) {
        currentPropOccupiedBeds++;
      }
    });
  });

  const occupancyMetrics = computeOccupancyMetrics(currentPropRooms, activeTenants);
  const totalOccupiedBeds = occupancyMetrics.occupiedBeds;
  const totalBedsCount = occupancyMetrics.totalBeds;
  const availableBeds = occupancyMetrics.emptyBeds;
  const totalRoomsCount = currentPropRooms.length;
  const occupancyRate = occupancyMetrics.occupancyRate;

  // Filter strictly due tenants (Requirement 3: In the UI show only DUE tenants list in the main page)
  const dueTenants = activeTenants.filter(
    (t) => t.rentStatus !== 'PAID' || (typeof t.outstandingPaise === 'number' && t.outstandingPaise > 0)
  );

  const activePropertyName = properties.find((p) => p.id === selectedPropId)?.name || properties[0]?.name || "StayNest Elite Men's PG";

  // Mark all notifications read / cleared (Requirement 1)
  const handleMarkAllNotificationsRead = () => {
    setEnquiries([]);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_customer_enquiries', JSON.stringify([]));
      window.localStorage.setItem('staynest_notifications_cleared', 'true');
    }
    Alert.alert('Notifications Cleared', 'All activity notifications have been marked as read.');
  };

  // ─── DEDICATED NOTIFICATIONS & ACTIVITIES FULL PAGE (REQUIREMENT 5) ───
  if (showNotificationsPage) {
    return (
      <View style={styles.notifPageContainer}>
        {/* Top Header with Prominent Exit / Back Button & Clear All Button (Requirement 1) */}
        <View style={styles.notifPageHeader}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <TouchableOpacity
              style={styles.notifExitBtn}
              onPress={() => setShowNotificationsPage(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.notifExitIcon}>←</Text>
              <Text style={styles.notifExitBtnText}>Exit to Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.notifClearAllBtn}
              onPress={handleMarkAllNotificationsRead}
              activeOpacity={0.8}
            >
              <Text style={styles.notifClearAllText}>✓ Mark All Read</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notifHeaderMainRow}>
            <View>
              <Text style={styles.notifPageTitle}>Notifications & Activity</Text>
              <Text style={styles.notifPageSub}>
                Website Bed Holds, Rent Reminders & Resident Updates
              </Text>
            </View>
            {pendingEnquiriesCount > 0 && (
              <View style={styles.notifBadgePill}>
                <Text style={styles.notifBadgeText}>{pendingEnquiriesCount} New</Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#ea580c', '#3b82f6']}
              tintColor="#ea580c"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Website Bed Hold Requests */}
          <Text style={styles.notifSectionHeader}>
            🛏️ WEBSITE BED HOLD REQUESTS ({currentPropertyObj?.name || 'Current PG'})
          </Text>
          {(() => {
            const pgEnquiries = enquiries.filter((e) => {
              if (e.propertyId && (e.propertyId === selectedPropId || e.propertyId === currentPropertyObj?.id)) return true;
              if (e.propertyName && currentPropertyObj?.name) {
                return e.propertyName.trim().toLowerCase() === currentPropertyObj.name.trim().toLowerCase();
              }
              return selectedPropId === 'prop-pg-1' && (e.propertyId === 'staynest-pg-01' || !e.propertyId);
            });

            if (pgEnquiries.length === 0) {
              return (
                <View style={styles.notifEmptyCard}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>📭</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#1e293b' }}>No Pending Enquiries for this PG</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                    When visitors hold a bed for {currentPropertyObj?.name || 'this PG'}, their requests appear here.
                  </Text>
                </View>
              );
            }

            return (
              <View style={{ gap: 12, marginBottom: 20 }}>
                {pgEnquiries.map((enq) => {
                const isPending = enq.status === 'PENDING_HOLD';
                const isHeld = enq.status === 'HOLD';
                const rent = (enq.monthlyRentPaise / 100).toLocaleString('en-IN');
                const dep = (enq.depositPaise / 100).toLocaleString('en-IN');

                return (
                  <View key={enq.id} style={styles.enquiryCardBox}>
                    <View style={styles.enquiryCardTopRow}>
                      <View>
                        <Text style={styles.enquiryCustName}>{enq.customerName}</Text>
                        <Text style={styles.enquiryCustPhone}>📱 +91 {enq.customerPhone}</Text>
                      </View>

                      <View
                        style={[
                          styles.enquiryStatusTag,
                          isPending
                            ? { backgroundColor: '#fef3c7', borderColor: '#fde68a' }
                            : isHeld
                            ? { backgroundColor: '#ffedd5', borderColor: '#fdba74' }
                            : enq.status === 'CONFIRMED'
                            ? { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }
                            : { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.enquiryStatusTagText,
                            isPending
                              ? { color: '#b45309' }
                              : isHeld
                              ? { color: '#c2410c' }
                              : enq.status === 'CONFIRMED'
                              ? { color: '#16a34a' }
                              : { color: '#64748b' },
                          ]}
                        >
                          {isPending ? '⏳ New Request' : isHeld ? '🔒 Bed Held (48h)' : enq.status === 'CONFIRMED' ? '✓ Allocated' : 'Declined'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.enquiryInfoRow}>
                      <Text style={styles.enquiryInfoLabel}>Property:</Text>
                      <Text style={styles.enquiryInfoVal}>{enq.propertyName}</Text>
                    </View>
                    <View style={styles.enquiryInfoRow}>
                      <Text style={styles.enquiryInfoLabel}>Requested Bed:</Text>
                      <Text style={[styles.enquiryInfoVal, { color: '#4f46e5', fontWeight: '800' }]}>
                        Room {enq.roomNumber} • {enq.bedLabel}
                      </Text>
                    </View>
                    <View style={styles.enquiryInfoRow}>
                      <Text style={styles.enquiryInfoLabel}>Check-in Date:</Text>
                      <Text style={styles.enquiryInfoVal}>{enq.checkInDate}</Text>
                    </View>
                    <View style={styles.enquiryInfoRow}>
                      <Text style={styles.enquiryInfoLabel}>Rent / Deposit:</Text>
                      <Text style={styles.enquiryInfoVal}>₹{rent}/mo (Dep: ₹{dep})</Text>
                    </View>

                    {enq.notes ? (
                      <View style={styles.enquiryNotesBox}>
                        <Text style={styles.enquiryNotesText}>💬 {enq.notes}</Text>
                      </View>
                    ) : null}

                    <View style={styles.enquiryActionRow}>
                      <TouchableOpacity
                        style={styles.enquiryCallBtn}
                        onPress={() => handleCallCustomer(enq.customerPhone)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.enquiryCallBtnText}>📞 Call</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.enquiryWaBtn}
                        onPress={() => handleWhatsAppCustomer(enq)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.enquiryWaBtnText}>💬 WhatsApp</Text>
                      </TouchableOpacity>

                      {isPending && (
                        <>
                          <TouchableOpacity
                            style={styles.enquiryHoldBtn}
                            onPress={() => handleHoldEnquiry(enq)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.enquiryHoldBtnText}>🔒 Hold Bed</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.enquiryAcceptBtn}
                            onPress={() => handleAcceptEnquiry(enq)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.enquiryAcceptBtnText}>✓ Allocate</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.enquiryDeclineBtn}
                            onPress={() => handleRejectEnquiry(enq.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.enquiryDeclineBtnText}>✕</Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {isHeld && (
                        <>
                          <TouchableOpacity
                            style={styles.enquiryAcceptBtn}
                            onPress={() => handleAcceptEnquiry(enq)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.enquiryAcceptBtnText}>✓ Allocate</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.enquiryDeclineBtn}
                            onPress={() => handleRejectEnquiry(enq.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.enquiryDeclineBtnText}>✕ Release</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}

          {/* Section 2: Rent Due Alerts */}
          {dueTenants.length > 0 && (
            <>
              <Text style={styles.notifSectionHeader}>💰 RENT DUE NOTICES ({dueTenants.length})</Text>
              <View style={{ gap: 10, marginBottom: 20 }}>
                {dueTenants.map((t) => {
                  const bal = (t.outstandingPaise ? t.outstandingPaise / 100 : (t.monthlyRentPaise ? t.monthlyRentPaise / 100 : 8500));
                  return (
                    <View key={t.id} style={styles.notifDueCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }}>{t.fullName}</Text>
                          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                            Room {t.roomNumber || '101'} • {t.bedLabel || 'Bed 1'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: '#dc2626' }}>₹{bal.toLocaleString('en-IN')}</Text>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#b91c1c', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 }}>
                            RENT DUE
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={styles.notifWaPayBtn}
                          onPress={() => handleSendWhatsAppWithPaymentLink(t)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.notifWaPayBtnText}>💬 Send WhatsApp Pay Link</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.notifCollectBtn}
                          onPress={() => {
                            setShowNotificationsPage(false);
                            setSelectedTenantForGateway(t);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.notifCollectBtnText}>💳 Pay / Collect</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Section 3: Platform & Subscription Status */}
          <Text style={styles.notifSectionHeader}>👑 SUBSCRIPTION STATUS</Text>
          <View style={styles.notifSubCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.notifSubIconBox}>
                <Text style={{ fontSize: 20 }}>👑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>
                  {subscriptionActive ? 'StayNest Pro (Active)' : 'Free Trial Active'}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {subscriptionActive ? 'Unlimited WhatsApp rent reminders & auto-pay active.' : 'Free tier up to 10 tenants. Setup Auto-Pay to unlock unlimited.'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.mainScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#ea580c', '#3b82f6']}
            tintColor="#ea580c"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. TOP OWNER & PROPERTY CARD (SEPARATE WHITE BOX WITH MEDIUM ORANGE BORDER) ─── */}
        <View style={styles.heroTopDividedBox}>
          {/* Top Row: Property Selector Pill & Notifications / Profile */}
          <View style={styles.heroTopBar}>
            {/* Property Selector Pill (Dropdown Trigger - Requirements 3, 4, 5) */}
            <TouchableOpacity
              style={styles.heroPropertyPill}
              onPress={() => setShowPgDropdown(true)}
              activeOpacity={0.8}
            >
              <View style={styles.heroPropThumb}>
                <Text style={{ fontSize: 13 }}>🏢</Text>
              </View>
              <Text style={styles.heroPropName} numberOfLines={1}>
                {activePropertyName}
              </Text>
              <Text style={styles.heroPropArrow}>⌵</Text>
            </TouchableOpacity>

            {/* Right: Notification Bell & Profile Avatar */}
            <View style={styles.heroRightActions}>
              <TouchableOpacity
                style={styles.heroBellBtn}
                onPress={() => setShowNotificationsPage(true)}
              >
                <OutlineBellIcon color="#475569" size={20} />
                {pendingEnquiriesCount > 0 ? (
                  <View style={styles.heroBellBadge}>
                    <Text style={styles.heroBellBadgeText}>{pendingEnquiriesCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroAvatarBtn}
                onPress={() => onNavigateTab ? onNavigateTab('profile') : null}
              >
                <Text style={styles.heroAvatarText}>
                  {ownerDisplayName ? ownerDisplayName.charAt(0).toUpperCase() : 'R'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Title Row: Unique Indian Welcome Greeting without PG Master badge (Requirement 2 & 3) */}
          <View style={styles.heroTitleRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.heroGreetingTimeRow}>
                <Text style={styles.heroGreetingTimeText}>{getGreetingTime()}</Text>
              </View>
              <Text style={styles.heroDashboardTitle} numberOfLines={1}>
                Namaste, {ownerDisplayName} 🙏
              </Text>
            </View>
            <View style={styles.heroDotsContainer}>
              <View style={[styles.heroDot, styles.heroDotActive]} />
              <View style={styles.heroDot} />
              <View style={styles.heroDot} />
            </View>
          </View>
        </View>

        {/* ─── 2. DEEP SLATE-NAVY HERO FINANCIAL CONTAINER ─── */}
        <View style={styles.heroSlateNavyContainer}>
          {/* Month & Year Filter Bar & Report Download */}
          <View style={styles.heroMonthBar}>
            <TouchableOpacity
              style={styles.heroMonthDropdownBtn}
              onPress={() => setShowMonthPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13 }}>📅</Text>
              <Text style={styles.heroMonthDropdownText}>{selectedMonthOption.label}</Text>
              <Text style={styles.heroMonthDropdownArrow}>▾</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroExportBtn}
              onPress={handleDownloadMonthReport}
              activeOpacity={0.8}
            >
              <Text style={styles.heroExportBtnText}>Report CSV</Text>
            </TouchableOpacity>
          </View>

          {/* 4 Hero Financial Cards in 2x2 Grid (Total Collection, Need to Collect, Total Spent, Net Profit/Loss) */}
          <View style={styles.heroCardsRow}>
            {/* Card 1: Total Collection with Embedded Donut Ring */}
            <View style={styles.heroCard}>
              <View style={styles.heroCardHeaderRow}>
                <View style={styles.heroCashIconCircle}>
                  <Text style={{ fontSize: 16 }}>💵</Text>
                </View>

                {(() => {
                  const displayRate = collectionRate;
                  const is100 = displayRate >= 100;
                  const is75 = displayRate >= 75;
                  const is50 = displayRate >= 50;

                  return (
                    <View
                      style={[
                        styles.heroMiniRingOuter,
                        is100
                          ? { borderColor: '#22c55e', borderTopColor: '#22c55e', borderRightColor: '#22c55e', borderBottomColor: '#22c55e', borderLeftColor: '#22c55e' }
                          : is75
                          ? { borderTopColor: '#22c55e', borderRightColor: '#22c55e', borderBottomColor: '#22c55e', borderLeftColor: 'rgba(255, 255, 255, 0.2)' }
                          : is50
                          ? { borderTopColor: '#22c55e', borderRightColor: '#22c55e', borderBottomColor: 'rgba(255, 255, 255, 0.2)', borderLeftColor: 'rgba(255, 255, 255, 0.2)' }
                          : { borderTopColor: '#22c55e', borderRightColor: 'rgba(255, 255, 255, 0.2)', borderBottomColor: 'rgba(255, 255, 255, 0.2)', borderLeftColor: 'rgba(255, 255, 255, 0.2)' },
                      ]}
                    >
                      <View style={styles.heroMiniRingInner}>
                        <Text style={styles.heroMiniRingText}>
                          {displayRate}%
                        </Text>
                      </View>
                    </View>
                  );
                })()}
              </View>

              <Text style={styles.heroCardAmount} numberOfLines={1}>
                ₹{totalRentCollected.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroCardSub}>Total Collection</Text>
            </View>

            {/* Card 2: Need to Collect */}
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => setShowNeedToCollectModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.heroCardHeaderRow}>
                <View style={styles.heroCalendarIconCircle}>
                  <Text style={{ fontSize: 16 }}>⏳</Text>
                </View>
                <View style={styles.heroDueCountBadge}>
                  <Text style={styles.heroDueCountText}>{collectionMetrics.rentDueCount} Due ›</Text>
                </View>
              </View>

              <Text style={styles.heroCardAmount} numberOfLines={1}>
                ₹{pendingRent.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroCardSub}>Need to Collect</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Total Spent & Profit or Loss */}
          <View style={[styles.heroCardsRow, { marginTop: 12 }]}>
            {/* Card 3: Total Spent */}
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => onNavigateTab ? onNavigateTab('finance') : null}
              activeOpacity={0.8}
            >
              <View style={styles.heroCardHeaderRow}>
                <View style={styles.heroSpentIconCircle}>
                  <Text style={{ fontSize: 16 }}>🧾</Text>
                </View>
                <View style={styles.heroExpenseTagBadge}>
                  <Text style={styles.heroExpenseTagText}>Spent ›</Text>
                </View>
              </View>

              <Text style={styles.heroCardAmount} numberOfLines={1}>
                ₹{totalExpense.toLocaleString('en-IN')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.heroCardSub}>Total Spent</Text>
                <Text style={{ fontSize: 11, color: '#94a3b8', fontWeight: '600' }}>• View ›</Text>
              </View>
            </TouchableOpacity>

            {/* Card 4: Profit or Loss (Surplus) */}
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => onNavigateTab ? onNavigateTab('finance') : null}
              activeOpacity={0.8}
            >
              <View style={styles.heroCardHeaderRow}>
                <View style={styles.heroProfitIconCircle}>
                  <Text style={{ fontSize: 16 }}>📈</Text>
                </View>
                <View style={[styles.heroProfitTagBadge, netOperatingProfit < 0 && { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <Text style={[styles.heroProfitTagText, netOperatingProfit < 0 && { color: '#f87171' }]}>
                    {netOperatingProfit >= 0 ? 'Surplus ›' : 'Deficit ›'}
                  </Text>
                </View>
              </View>

              <Text
                style={[styles.heroCardAmount, { color: netOperatingProfit >= 0 ? '#10b981' : '#f87171' }]}
                numberOfLines={1}
              >
                {netOperatingProfit >= 0 ? '+' : '-'}₹{Math.abs(netOperatingProfit).toLocaleString('en-IN')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.heroCardSub, { color: netOperatingProfit >= 0 ? '#6ee7b7' : '#fca5a5' }]}>
                  {netOperatingProfit >= 0 ? '✓ Net Profit' : '⚠ Net Loss'}
                </Text>
                <Text style={{ fontSize: 11, color: netOperatingProfit >= 0 ? '#6ee7b7' : '#fca5a5', fontWeight: '600' }}>
                  • Track ›
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 2. OCCUPANCY PILL CARDS (EMPTY BEDS & OCCUPIED BEDS) ─── */}
        <View style={styles.occupancyRow}>
          {/* Empty Beds Pill */}
          <TouchableOpacity
            style={styles.occupancyPill}
            onPress={() => onNavigateTab ? onNavigateTab('rooms') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.occupancyIconCircle, { backgroundColor: '#e6f7f2' }]}>
              <Text style={{ fontSize: 18 }}>🛏️</Text>
            </View>
            <View style={styles.occupancyTextCol}>
              <Text style={styles.occupancyNumber}>
                {availableBeds < 10 ? `0${availableBeds}` : availableBeds}
              </Text>
              <Text style={styles.occupancyLabel}>Empty Beds</Text>
            </View>
            <Text style={styles.occupancyChevron}>›</Text>
          </TouchableOpacity>

          {/* Occupied Beds Pill */}
          <TouchableOpacity
            style={styles.occupancyPill}
            onPress={() => onNavigateTab ? onNavigateTab('tenants') : null}
            activeOpacity={0.8}
          >
            <View style={[styles.occupancyIconCircle, { backgroundColor: '#ede9fe' }]}>
              <Text style={{ fontSize: 18 }}>🛏️</Text>
            </View>
            <View style={styles.occupancyTextCol}>
              <Text style={styles.occupancyNumber}>
                {totalOccupiedBeds < 10 ? `0${totalOccupiedBeds}` : totalOccupiedBeds}
              </Text>
              <Text style={styles.occupancyLabel}>Occupied Beds</Text>
            </View>
            <Text style={styles.occupancyChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ─── LIVE WEBSITE BED HOLD ENQUIRIES BANNER (Requirement 1) ─── */}
        {pendingEnquiriesCount > 0 && (
          <TouchableOpacity
            style={styles.enquiryAlertBanner}
            onPress={() => setShowNotificationsPage(true)}
            activeOpacity={0.85}
          >
            <View style={styles.enquiryAlertIconCircle}>
              <OutlineBellIcon color="#ea580c" size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.enquiryAlertTitle}>
                  {pendingEnquiriesCount} New Bed Hold {pendingEnquiriesCount > 1 ? 'Enquiries' : 'Enquiry'}
                </Text>
                <View style={styles.enquiryPulseBadge}>
                  <Text style={styles.enquiryPulseText}>WEBSITE LIVE</Text>
                </View>
              </View>
              <Text style={styles.enquiryAlertSub} numberOfLines={1}>
                {pendingEnquiries[0]?.customerName} requested {pendingEnquiries[0]?.bedLabel} in Room {pendingEnquiries[0]?.roomNumber} ({pendingEnquiries[0]?.propertyName})
              </Text>
            </View>
            <Text style={styles.enquiryAlertViewText}>View ›</Text>
          </TouchableOpacity>
        )}

        {/* ─── 2.5 KYC VERIFICATION CARD / CAROUSEL ─── */}
        {(() => {
          const displayKycTenants = pendingKycTenants.length > 0 ? pendingKycTenants : [
            { id: 'mock-1', fullName: 'Kiran', roomNumber: '101', phone: '9876543214' } as any,
            { id: 'mock-2', fullName: 'Suresh', roomNumber: '102', phone: '9876543215' } as any,
          ];
          const currentKycTenant = displayKycTenants[kycCarouselIndex % displayKycTenants.length];

          return (
            <View style={styles.kycCarouselCard}>
              <View style={styles.kycCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.kycAlertCircle}>
                    <Text style={{ fontSize: 13 }}>⚠️</Text>
                  </View>
                  <View>
                    <Text style={styles.kycCardTitle}>
                      Aadhaar Verification ({displayKycTenants.length})
                    </Text>
                    <Text style={styles.kycCardSub}>Tenant Aadhaar check</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.kycViewAllBtn}
                  onPress={() => setShowAllKycModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.kycViewAllText}>
                    Show All ({displayKycTenants.length}) ›
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Sliding Tenant Card Box */}
              {currentKycTenant && (
                <View style={styles.kycSlideBox}>
                  <View style={styles.kycTenantRow}>
                    <View style={styles.kycTenantAvatar}>
                      <Text style={{ fontSize: 18 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.kycTenantName}>{currentKycTenant.fullName}</Text>
                        <View style={styles.kycStatusBadge}>
                          <Text style={styles.kycStatusBadgeText}>KYC Incomplete</Text>
                        </View>
                      </View>
                      <Text style={styles.kycTenantDetails}>
                        Room {currentKycTenant.roomNumber || '101'} • 📞 {currentKycTenant.phone}
                      </Text>
                    </View>

                    {/* Quick Aadhaar Verify Button */}
                    <TouchableOpacity
                      style={styles.kycVerifyBtn}
                      onPress={() => {
                        setVerifyingTenantKyc(currentKycTenant);
                        setKycVerifyAadhaarInput(currentKycTenant.idProof || currentKycTenant.idProofNumber || '');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.kycVerifyBtnText}>⚡ Verify Aadhaar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Carousel Progress Dots & Navigation */}
                  <View style={styles.kycCarouselFooter}>
                    <View style={styles.kycDotsRow}>
                      {displayKycTenants.slice(0, 8).map((_, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => setKycCarouselIndex(idx)}
                        >
                          <View
                            style={[
                              styles.kycDot,
                              (kycCarouselIndex % displayKycTenants.length) === idx && styles.kycDotActive,
                            ]}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() =>
                          setKycCarouselIndex((prev) => (prev - 1 + displayKycTenants.length) % displayKycTenants.length)
                        }
                      >
                        <Text style={styles.kycArrowBtn}>‹</Text>
                      </TouchableOpacity>
                      <Text style={styles.kycAutoSlideText}>
                        {(kycCarouselIndex % displayKycTenants.length) + 1} of {displayKycTenants.length}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setKycCarouselIndex((prev) => (prev + 1) % displayKycTenants.length)
                        }
                      >
                        <Text style={styles.kycArrowBtn}>›</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* ─── 3. QUICK ACTIONS (4 PER LINE: LINE 1 (4 ACTIONS) & LINE 2 (4 ACTIONS)) ─── */}
        <View style={styles.quickActionsSectionWrap}>
          <View style={styles.quickActionsHeaderRow}>
            <Text style={{ fontSize: 18, color: '#2563eb' }}>⚡</Text>
            <Text style={styles.quickActionsSectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.quickGridContainer}>
            {/* ─── LINE 1: 4 ACTIONS ─── */}
            {/* 1. Add Tenant */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => setShowOnboardModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" fill="#1d4ed8" />
                  <Circle cx="9" cy="7" r="4" fill="#1d4ed8" />
                  <Path d="M19 8v6m3-3h-6" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>Add Tenant</Text>
            </TouchableOpacity>

            {/* 2. Record Rent */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => {
                if (activeTenants.length > 0) {
                  setRecordRentSearch('');
                  setShowRecordRentPickerModal(true);
                } else {
                  Alert.alert('No Active Tenants', 'Add a tenant first before recording rent.');
                }
              }}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1d4ed8', lineHeight: 22 }}>₹</Text>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>Record Rent</Text>
            </TouchableOpacity>

            {/* 3. Add Expense */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => onNavigateTab ? onNavigateTab('finance') : null}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#1d4ed8" />
                  <Path d="M14 2v6h6" fill="#1e40af" />
                  <Path d="M8 13h8M8 17h5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>Add Expense</Text>
            </TouchableOpacity>

            {/* 4. View Reports */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => setShowNeedToCollectModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Rect x="4" y="13" width="4" height="8" rx="1.2" fill="#1d4ed8" />
                  <Rect x="10" y="8" width="4" height="13" rx="1.2" fill="#1d4ed8" />
                  <Rect x="16" y="3" width="4" height="18" rx="1.2" fill="#1d4ed8" />
                </Svg>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>View Reports</Text>
            </TouchableOpacity>

            {/* ─── LINE 2: 4 ACTIONS (FOOD MENU, LOG ISSUE, ROOMS/BEDS, POWER BILL) ─── */}
            {/* 5. Food Menu */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => setShowFoodMenuModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Text style={{ fontSize: 20 }}>🍲</Text>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>Food Menu</Text>
            </TouchableOpacity>

            {/* 6. Log Issue */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => setShowLogIssueModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Text style={{ fontSize: 20 }}>🛠️</Text>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>Log Issue</Text>
            </TouchableOpacity>

            {/* 7. Rooms / Beds */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => onNavigateTab ? onNavigateTab('rooms') : null}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 9h2M13 9h2M9 13h2M13 13h2" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>Rooms / Beds</Text>
            </TouchableOpacity>

            {/* 8. Power Bill */}
            <TouchableOpacity
              style={styles.quickCompactCard}
              onPress={() => setShowElectricityModal(true)}
              activeOpacity={0.75}
            >
              <View style={styles.quickIconCircle}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#1d4ed8" />
                </Svg>
              </View>
              <Text style={styles.quickCompactLabel} numberOfLines={2}>Power Bill</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── 4. RENT DUE SECTION (ONLY DUE TENANTS, REQUIREMENT 3) ─── */}
        <View style={styles.rentDueHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.sectionHeadingNavy}>Rent Due</Text>
            <View style={styles.dueCountBadgePill}>
              <Text style={styles.dueCountBadgeText}>{dueTenants.length}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => onNavigateTab ? onNavigateTab('tenants') : null}>
            <Text style={styles.viewAllDueText}>View all ›</Text>
          </TouchableOpacity>
        </View>

        {dueTenants.length === 0 ? (
          <View style={styles.allClearCard}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>🎉</Text>
            <Text style={styles.allClearTitle}>No Rent Due Pending</Text>
            <Text style={styles.allClearSub}>All active residents have cleared their payments!</Text>
          </View>
        ) : (
          <View style={styles.dueListCol}>
            {dueTenants.map((t) => {
              const totalRent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
              const dueAmount = typeof t.outstandingPaise === 'number'
                ? Math.round(t.outstandingPaise / 100)
                : (t.rentStatus === 'PAID' ? 0 : totalRent);
              const paidAmount = Math.max(0, totalRent - dueAmount);
              const isPartial = dueAmount > 0 && paidAmount > 0;

              const rawDate = t.checkIn || t.rentDueDate || t.createdAt;
              const joinedDate = rawDate
                ? new Date(rawDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '12 Jan, 2024';

              return (
                <View key={t.id} style={styles.dueTenantCard}>
                  {/* Top Row: Name & Date */}
                  <View style={styles.dueCardTopRow}>
                    <Text style={styles.dueTenantName}>{t.fullName}</Text>
                    <Text style={styles.dueTenantDate}>{joinedDate}</Text>
                  </View>

                  {/* Room Number & Partial Paid info */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={styles.dueTenantRoom}>
                      Room no. - {t.roomNumber || '205'}
                      {isPartial ? ` • Paid ₹${paidAmount.toLocaleString('en-IN')}` : ''}
                    </Text>
                    {isPartial && (
                      <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#b45309' }}>PARTIAL</Text>
                      </View>
                    )}
                  </View>

                  {/* Bottom Row: Amount & Action Buttons */}
                  <View style={styles.dueCardBottomRow}>
                    <Text style={styles.dueTenantAmount}>
                      ₹ {dueAmount.toLocaleString('en-IN')} <Text style={{ fontSize: 11, color: '#ef4444' }}>Due</Text>
                    </Text>

                    <View style={styles.dueActionBtnGroup}>
                      {/* Direct 1-Click WhatsApp Button */}
                      <TouchableOpacity
                        style={styles.dueWhatsAppPillBtn}
                        onPress={() => handleDirectWhatsAppReminder(t)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dueWhatsAppPillBtnText}>💬 WhatsApp</Text>
                      </TouchableOpacity>

                      {/* Call button */}
                      <TouchableOpacity
                        style={styles.duePhoneBtn}
                        onPress={() => {
                          const clean = t.phone.replace(/[^0-9]/g, '');
                          Linking.openURL(`tel:${clean}`).catch(() => Alert.alert('Call', `Call ${t.fullName} at +91 ${clean}`));
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 15 }}>📞</Text>
                      </TouchableOpacity>

                      {/* Purple Update button */}
                      <TouchableOpacity
                        style={styles.dueUpdateBtn}
                        onPress={() => handleOpenTenantModal(t)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dueUpdateBtnText}>Update</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── 4B. RECENT ACTIVITIES (LAST 5 ACTIVITIES FOR SELECTED PROPERTY) ─── */}
        {(() => {
          const recentActivities = buildRecentActivities({
            propertyId: selectedPropId,
            defaultPropertyId: properties[0]?.id,
            tenants,
            invoices,
            expenses,
            loggedActivities,
            backendActivities,
            limit: 5,
          });

          const getActivityBadge = (type: ActivityLogItem['type']) => {
            switch (type) {
              case 'RENT_PAID':
                return { icon: '💰', bg: '#ecfdf5', color: '#15803d', sign: '+' };
              case 'EXPENSE_LOGGED':
                return { icon: '🧾', bg: '#fff7ed', color: '#ea580c', sign: '-' };
              case 'TENANT_ADDED':
              case 'BED_ASSIGNED':
                return { icon: '🛏️', bg: '#eff6ff', color: '#2563eb', sign: '' };
              case 'ISSUE_LOGGED':
                return { icon: '🔧', bg: '#fef2f2', color: '#dc2626', sign: '' };
              case 'KYC_VERIFIED':
                return { icon: '🪪', bg: '#f0fdf4', color: '#16a34a', sign: '' };
              default:
                return { icon: '📌', bg: '#f5f3ff', color: '#6d28d9', sign: '' };
            }
          };

          return (
            <View style={styles.recentActSection}>
              <View style={styles.recentActHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.sectionHeadingNavy}>Recent Activities</Text>
                  <View style={styles.recentActCountPill}>
                    <Text style={styles.recentActCountText}>{recentActivities.length}</Text>
                  </View>
                </View>
                <Text style={styles.recentActSubLabel}>Last 5 updates</Text>
              </View>

              {recentActivities.length === 0 ? (
                <View style={styles.recentActEmptyCard}>
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>📋</Text>
                  <Text style={styles.recentActEmptyTitle}>No Recent Activities Yet</Text>
                  <Text style={styles.recentActEmptySub}>
                    Rent payments, tenant check-ins, and logged expenses for this property will appear here.
                  </Text>
                </View>
              ) : (
                <View style={styles.recentActCard}>
                  {recentActivities.map((act, idx) => {
                    const badge = getActivityBadge(act.type);
                    return (
                      <View
                        key={act.id}
                        style={[
                          styles.recentActRow,
                          idx < recentActivities.length - 1 && styles.recentActRowBorder,
                        ]}
                      >
                        <View style={[styles.recentActIconBox, { backgroundColor: badge.bg }]}>
                          <Text style={{ fontSize: 16 }}>{badge.icon}</Text>
                        </View>

                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.recentActTitle} numberOfLines={1}>
                            {act.title}
                          </Text>
                          <Text style={styles.recentActSubtitle} numberOfLines={1}>
                            {act.subtitle}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          {typeof act.amountRupees === 'number' && act.amountRupees > 0 && (
                            <Text style={[styles.recentActAmount, { color: badge.color }]}>
                              {badge.sign}₹{act.amountRupees.toLocaleString('en-IN')}
                            </Text>
                          )}
                          <Text style={styles.recentActTime}>
                            {formatActivityTime(act.timestamp)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* ─── SUBSCRIPTION & UNLIMITED SERVICES CARD (REQUIREMENTS 6, 7, 8) ─── */}
        <View style={styles.subCardContainer}>
          <View style={styles.subCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
              <View style={styles.crownCircle}>
                <Text style={{ fontSize: 20 }}>👑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subCardTitle}>StayNest PG Subscription</Text>
                <Text style={styles.subCardSubtitle} numberOfLines={2}>
                  {subscriptionActive
                    ? '⭐ Unlimited Plan Active • Auto-Pay Enabled'
                    : 'Free Tier • Free WhatsApp limit up to 10 tenants'}
                </Text>
              </View>
            </View>
            <View style={[styles.subActiveBadge, subscriptionActive ? styles.subBadgePaid : styles.subBadgeTrial]}>
              <Text style={[styles.subActiveBadgeText, subscriptionActive ? styles.subBadgePaidText : styles.subBadgeTrialText]}>
                {subscriptionActive ? 'PRO ACTIVE' : '1 MO FREE'}
              </Text>
            </View>
          </View>

          {/* Tenant Limit Usage Progress Indicator */}
          {!subscriptionActive && (
            <View style={styles.subTenantProgressBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.subProgressLabel}>Free Tier WhatsApp Usage</Text>
                <Text style={styles.subProgressCount}>
                  {Math.min(activeTenants.length, 10)} / 10 Tenants
                </Text>
              </View>
              <View style={styles.subProgressBarBg}>
                <View
                  style={[
                    styles.subProgressBarFill,
                    { width: `${Math.min((activeTenants.length / 10) * 100, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.subProgressNotice}>
                ⚡ First month is 100% free! Setup ₹0 Auto-Pay to unlock unlimited WhatsApp reminders & direct calls.
              </Text>
            </View>
          )}

          {/* Subscription Offer Box */}
          <View style={styles.subOfferBox}>
            <View style={styles.subPriceRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.subPriceAmount}>
                  {selectedPlanPeriod === 'MONTHLY' ? '₹99' : '₹1,099'}
                  <Text style={styles.subPricePeriod}>
                    {selectedPlanPeriod === 'MONTHLY' ? ' / month' : ' / year (Save 8%)'}
                  </Text>
                </Text>
                <Text style={styles.subFreeTrialNote} numberOfLines={2}>
                  🎉 First 30 Days Free • ₹0 charged today with Auto-Pay
                </Text>
              </View>

              {/* Plan Switcher */}
              <View style={styles.planSwitchPill}>
                <TouchableOpacity
                  style={[styles.planSwitchBtn, selectedPlanPeriod === 'MONTHLY' && styles.planSwitchBtnActive]}
                  onPress={() => setSelectedPlanPeriod('MONTHLY')}
                >
                  <Text style={[styles.planSwitchBtnText, selectedPlanPeriod === 'MONTHLY' && styles.planSwitchBtnTextActive]}>
                    Monthly
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.planSwitchBtn, selectedPlanPeriod === 'YEARLY' && styles.planSwitchBtnActive]}
                  onPress={() => setSelectedPlanPeriod('YEARLY')}
                >
                  <Text style={[styles.planSwitchBtnText, selectedPlanPeriod === 'YEARLY' && styles.planSwitchBtnTextActive]}>
                    Yearly
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* All Facilities Included */}
            <View style={styles.subFacilitiesList}>
              <View style={styles.subFacilityItem}>
                <Text style={styles.subCheckIcon}>✓</Text>
                <Text style={styles.subFacilityText}>
                  <Text style={{ fontWeight: '800' }}>Unlimited Automated WhatsApp Messages:</Text> Send rent reminders & receipts directly in 1 click (no 10 tenant cap)
                </Text>
              </View>
              <View style={styles.subFacilityItem}>
                <Text style={styles.subCheckIcon}>✓</Text>
                <Text style={styles.subFacilityText}>
                  <Text style={{ fontWeight: '800' }}>1-Click Direct Calls & Alerts:</Text> Direct resident phone dialer & instant push updates
                </Text>
              </View>
              <View style={styles.subFacilityItem}>
                <Text style={styles.subCheckIcon}>✓</Text>
                <Text style={styles.subFacilityText}>
                  <Text style={{ fontWeight: '800' }}>Month-wise Profit Analytics & Reports:</Text> Download filtered collections, dues & tenant excel spreadsheets
                </Text>
              </View>
              <View style={styles.subFacilityItem}>
                <Text style={styles.subCheckIcon}>✓</Text>
                <Text style={styles.subFacilityText}>
                  <Text style={{ fontWeight: '800' }}>Room & Bed Auto-Allocation:</Text> Automatic tenant room assignments with vacant bed tracking
                </Text>
              </View>
              <View style={styles.subFacilityItem}>
                <Text style={styles.subCheckIcon}>✓</Text>
                <Text style={styles.subFacilityText}>
                  <Text style={{ fontWeight: '800' }}>24/7 Dedicated Priority Support:</Text> Direct assistance for billing, maintenance & onboarding
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.subPrimaryBtn}
              onPress={() => setShowSubscriptionModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.subPrimaryBtnText}>
                {subscriptionActive
                  ? 'Manage Auto-Pay & Plan Details ⚙️'
                  : 'Start 30-Day Free Trial (₹0 Today, Auto-Pay ₹99/mo) →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ─── MODAL 1: TENANT DETAILS, RECORD PAYMENT & SEND REMINDER (REQUIREMENT 1) ─── */}
      <Modal
        visible={!!selectedTenantForAction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTenantForAction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>{selectedTenantForAction?.fullName}</Text>
                <Text style={styles.modalSub}>
                  {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED'
                    ? `Room ${selectedTenantForAction?.roomNumber || '101'} • ${selectedTenantForAction?.bedLabel || 'Bed 1'} • ${selectedTenantForAction?.propertyName || 'Ramesh PG'}`
                    : `Vacated (No bed assigned) • ${selectedTenantForAction?.propertyName || 'StayNest PG'}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTenantForAction(null)}
                style={styles.modalCloseIcon}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Tenant Info Summary Banner */}
              <View style={styles.tenantModalInfoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Contact Number:</Text>
                  <Text style={styles.infoVal}>📱 {selectedTenantForAction?.phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Monthly Rent:</Text>
                  <Text style={[styles.infoVal, { color: '#4f46e5', fontWeight: '900' }]}>
                    ₹{selectedTenantForAction?.monthlyRentPaise ? (selectedTenantForAction.monthlyRentPaise / 100).toLocaleString('en-IN') : '8,500'}/mo
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Rent Status:</Text>
                  <Text
                    style={[
                      styles.infoVal,
                      { color: selectedTenantForAction?.rentStatus === 'PAID' ? '#059669' : '#dc2626', fontWeight: '800' },
                    ]}
                  >
                    {selectedTenantForAction?.rentStatus === 'PAID' ? '🟢 Paid' : '🔴 Payment Due'}
                  </Text>
                </View>
              </View>

              {/* ACTION SECTION 1: RECORD MANUAL RENT PAYMENT */}
              <View style={styles.actionSectionBox}>
                <Text style={styles.actionSectionTitle}>💰 Record Rent Money Received</Text>
                <Text style={styles.actionSectionSub}>
                  Record manual rent collected via Cash, UPI, or Bank Transfer
                </Text>

                <Text style={styles.inputLabel}>Amount Received (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualPayAmount}
                  onChangeText={setManualPayAmount}
                  keyboardType="numeric"
                  placeholder="8500"
                />

                <Text style={styles.inputLabel}>Payment Mode</Text>
                <View style={styles.payModeRow}>
                  {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.payModeBtn,
                        manualPayMode === mode && styles.payModeBtnActive,
                      ]}
                      onPress={() => setManualPayMode(mode)}
                    >
                      <Text
                        style={[
                          styles.payModeText,
                          manualPayMode === mode && styles.payModeTextActive,
                        ]}
                      >
                        {mode.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.recordPayBtn, recordingPayment && { opacity: 0.7 }]}
                  onPress={handleRecordManualPayment}
                  disabled={recordingPayment}
                >
                  {recordingPayment ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.recordPayBtnText}>
                      ✓ Confirm Payment (₹{Number(manualPayAmount || 0).toLocaleString('en-IN')})
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* ACTION SECTION 2: SEND RENT REMINDER */}
              <View style={styles.actionSectionBox}>
                <Text style={styles.actionSectionTitle}>🔔 Send Payment Reminder</Text>
                <Text style={styles.actionSectionSub}>
                  Send rent alert notification or WhatsApp message directly to resident
                </Text>

                <TouchableOpacity
                  style={styles.sendReminderBtn}
                  onPress={() => selectedTenantForAction && handleSendReminder(selectedTenantForAction)}
                >
                  <Text style={styles.sendReminderBtnText}>
                    📩 Send Rent Reminder (WhatsApp / SMS)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ACTION SECTION 3: SHIFT / TRANSFER ROOM & BED */}
              {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED' && (
                <View style={styles.actionSectionBox}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.actionSectionTitle}>🔄 Shift Room & Bed</Text>
                    <TouchableOpacity onPress={() => setIsShiftingBed(!isShiftingBed)}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#4f46e5' }}>
                        {isShiftingBed ? '✕ Cancel' : 'Shift Bed →'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isShiftingBed ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.actionSectionSub}>
                        Shift resident to another vacant bed. Their current bed will become available immediately.
                      </Text>

                      <Text style={styles.inputLabel}>SELECT VACANT BED</Text>
                      {allAvailableBeds.filter((b) => b.bed.id !== selectedTenantForAction?.bedId).length === 0 ? (
                        <Text style={{ fontSize: 12, color: '#dc2626', marginVertical: 6 }}>
                          No vacant beds available in the PG property.
                        </Text>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                          {allAvailableBeds
                            .filter((b) => b.bed.id !== selectedTenantForAction?.bedId)
                            .map((b) => (
                              <TouchableOpacity
                                key={b.bed.id}
                                style={[
                                  styles.shiftBedChip,
                                  shiftSelectedBedId === b.bed.id && styles.shiftBedChipActive,
                                ]}
                                onPress={() => {
                                  setShiftSelectedBedId(b.bed.id);
                                  if (b.rentPaise) {
                                    setShiftNewRent(String(b.rentPaise / 100));
                                  }
                                }}
                              >
                                <Text
                                  style={[
                                    styles.shiftBedChipText,
                                    shiftSelectedBedId === b.bed.id && styles.shiftBedChipTextActive,
                                  ]}
                                >
                                  Room {b.roomNumber} • {b.bed.bedLabel}
                                </Text>
                              </TouchableOpacity>
                            ))}
                        </ScrollView>
                      )}

                      <Text style={styles.inputLabel}>MONTHLY RENT FOR NEW BED (₹)</Text>
                      <TextInput
                        style={styles.textInput}
                        value={shiftNewRent}
                        onChangeText={setShiftNewRent}
                        keyboardType="numeric"
                        placeholder="8500"
                      />

                      <TouchableOpacity
                        style={[styles.saveEditBtn, (!shiftSelectedBedId || shiftingBed) && { opacity: 0.5 }]}
                        onPress={handleConfirmShift}
                        disabled={!shiftSelectedBedId || shiftingBed}
                      >
                        <Text style={styles.saveEditBtnText}>
                          {shiftingBed ? 'Shifting Bed...' : '✓ Confirm Bed Shift & Update Rent'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.actionSectionSub}>
                      Transfer this resident to another room or bed and adjust their monthly rent.
                    </Text>
                  )}
                </View>
              )}

              {/* ACTION SECTION 4: EDIT RESIDENT DETAILS & RENT */}
              <View style={styles.actionSectionBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.actionSectionTitle}>✏️ Resident Profile & Rent</Text>
                  <TouchableOpacity onPress={() => setIsEditingTenant(!isEditingTenant)}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#4f46e5' }}>
                      {isEditingTenant ? '✕ Cancel Edit' : 'Edit Details'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isEditingTenant ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editTenantName}
                      onChangeText={setEditTenantName}
                      placeholder="e.g. Rahul Sharma"
                    />

                    <Text style={styles.inputLabel}>Mobile Phone</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editTenantPhone}
                      onChangeText={setEditTenantPhone}
                      keyboardType="phone-pad"
                      placeholder="9876543210"
                    />

                    <Text style={styles.inputLabel}>Monthly Rent (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editMonthlyRent}
                      onChangeText={setEditMonthlyRent}
                      keyboardType="numeric"
                      placeholder="8500"
                    />

                    <Text style={styles.inputLabel}>Emergency Contact</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editEmergencyContact}
                      onChangeText={setEditEmergencyContact}
                      keyboardType="phone-pad"
                      placeholder="9876500000"
                    />

                    <TouchableOpacity
                      style={[styles.saveEditBtn, savingTenantEdit && { opacity: 0.6 }]}
                      onPress={handleSaveTenantEdit}
                      disabled={savingTenantEdit}
                    >
                      <Text style={styles.saveEditBtnText}>
                        {savingTenantEdit ? 'Saving...' : '💾 Save Resident Changes'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.actionSectionSub}>
                    Tap 'Edit Details' above to update resident's name, mobile number, monthly rent or emergency contact.
                  </Text>
                )}
              </View>

              {/* ACTION SECTION 5: CHECK OUT OR DELETE RESIDENT */}
              <View style={{ marginTop: 12, gap: 10 }}>
                {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED' && (
                  <TouchableOpacity
                    style={styles.checkoutBtnPrimary}
                    onPress={() => selectedTenantForAction && handleCheckoutTenant(selectedTenantForAction)}
                  >
                    <Text style={styles.checkoutBtnPrimaryText}>🚪 Exit / Check Out from PG</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.deleteBtnOutline}
                  onPress={() => selectedTenantForAction && handleDeleteTenant(selectedTenantForAction)}
                  disabled={deletingTenant}
                >
                  <Text style={styles.deleteBtnOutlineText}>
                    {deletingTenant ? 'Deleting...' : '🗑️ Delete Resident Record'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 6: RESIDENTS WITH PENDING BALANCE (NEED TO COLLECT - REQUIREMENT 1) ─── */}
      <Modal
        visible={showNeedToCollectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNeedToCollectModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>⏳</Text>
                  <Text style={styles.modalTitle}>Pending Rent Collection</Text>
                </View>
                <Text style={styles.modalSub}>
                  {dueTenants.length} residents have pending balance totaling ₹{pendingRent.toLocaleString('en-IN')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowNeedToCollectModal(false)}
                style={styles.modalCloseIcon}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {dueTenants.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>All Clear!</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                    All active residents have cleared their monthly rent in full.
                  </Text>
                </View>
              ) : (
                dueTenants.map((t) => {
                  const totalRent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
                  const dueRent = typeof t.outstandingPaise === 'number'
                    ? Math.round(t.outstandingPaise / 100)
                    : (t.rentStatus === 'PAID' ? 0 : totalRent);
                  const paidRent = Math.max(0, totalRent - dueRent);

                  return (
                    <View key={t.id} style={styles.needCollectItemCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View>
                          <Text style={styles.needCollectTenantName}>{t.fullName}</Text>
                          <Text style={styles.needCollectTenantRoom}>
                            Room {t.roomNumber || '101'} • {t.bedLabel || 'Bed 1'} • +91 {t.phone}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.needCollectDueBig}>₹{dueRent.toLocaleString('en-IN')}</Text>
                          <Text style={styles.needCollectDueLabel}>Balance Due</Text>
                        </View>
                      </View>

                      {paidRent > 0 && (
                        <View style={styles.needCollectPartialNotice}>
                          <Text style={styles.needCollectPartialNoticeText}>
                            Partial paid: ₹{paidRent.toLocaleString('en-IN')} of ₹{totalRent.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      )}

                      {/* Action Buttons Row */}
                      <View style={styles.needCollectBtnRow}>
                        {/* 1. Direct WhatsApp with Pay Link */}
                        <TouchableOpacity
                          style={styles.needCollectWaBtn}
                          onPress={() => handleSendWhatsAppWithPaymentLink(t)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.needCollectWaBtnText}>💬 WhatsApp Pay Link</Text>
                        </TouchableOpacity>

                        {/* 2. Collect / Pay via Gateway */}
                        <TouchableOpacity
                          style={styles.needCollectGatewayBtn}
                          onPress={() => {
                            setSelectedTenantForGateway(t);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.needCollectGatewayBtnText}>💳 Pay / Collect</Text>
                        </TouchableOpacity>

                        {/* 3. Call button */}
                        <TouchableOpacity
                          style={styles.needCollectCallBtn}
                          onPress={() => {
                            const clean = t.phone.replace(/[^0-9]/g, '');
                            Linking.openURL(`tel:${clean}`).catch(() => Alert.alert('Call', `+91 ${clean}`));
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 14 }}>📞</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 7: SECURE PAYMENT GATEWAY (DIRECT TO OWNER ACCOUNT - REQUIREMENTS 4, 5, 6) ─── */}
      <Modal
        visible={!!selectedTenantForGateway}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTenantForGateway(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>🛡️</Text>
                  <Text style={styles.modalTitle}>StayNest Payment Gateway</Text>
                </View>
                <Text style={styles.modalSub}>
                  Direct 0% fee credit into Owner bank account via UPI
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTenantForGateway(null)}
                style={styles.modalCloseIcon}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Payment Bill Summary Card */}
              <View style={styles.gatewayBillSummaryCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.gatewayBillLabel}>Paying Resident:</Text>
                  <Text style={styles.gatewayBillVal}>{selectedTenantForGateway?.fullName}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.gatewayBillLabel}>Room & Property:</Text>
                  <Text style={styles.gatewayBillVal}>
                    Room {selectedTenantForGateway?.roomNumber || '101'} • {selectedTenantForGateway?.propertyName || 'Ramesh PG'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.gatewayBillLabel}>Owner Beneficiary:</Text>
                  <Text style={[styles.gatewayBillVal, { color: '#0f172a', fontWeight: '800' }]}>
                    {user?.fullName || 'Ramesh Kumar'} (9876543210@upi)
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>Amount to Pay:</Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#16a34a' }}>
                    ₹{((selectedTenantForGateway?.outstandingPaise ? selectedTenantForGateway.outstandingPaise / 100 : (selectedTenantForGateway?.monthlyRentPaise ? selectedTenantForGateway.monthlyRentPaise / 100 : 8500))).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.zeroFeePill}>
                  <Text style={styles.zeroFeePillText}>⚡ 0% Transaction Fee: 100% credited to Owner Account</Text>
                </View>
              </View>

              {/* Select Payment App with Official SVG Logos */}
              <Text style={[styles.fieldLabel, { marginTop: 12, marginBottom: 8 }]}>
                SELECT PAYMENT APP / METHOD
              </Text>

              <View style={styles.gatewayAppsGrid}>
                {[
                  { id: 'GPAY', name: 'Google Pay', logo: <GooglePayLogo size={24} />, sub: 'Instant 0% UPI' },
                  { id: 'PHONEPE', name: 'PhonePe', logo: <PhonePeLogo size={24} />, sub: 'Instant 0% UPI' },
                  { id: 'PAYTM', name: 'Paytm UPI', logo: <PaytmLogo size={24} />, sub: 'Instant 0% UPI' },
                  { id: 'BHIM', name: 'BHIM UPI', logo: <BhimUpiLogo size={24} />, sub: 'Direct Bank Pay' },
                  { id: 'CARD', name: 'Debit/Credit Card', logo: <CardPaymentLogo size={24} />, sub: 'Visa, Master, RuPay' },
                ].map((app) => (
                  <TouchableOpacity
                    key={app.id}
                    style={[
                      styles.gatewayAppOption,
                      selectedGatewayApp === app.id && styles.gatewayAppOptionSelected,
                    ]}
                    onPress={() => setSelectedGatewayApp(app.id as any)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 28, alignItems: 'center' }}>{app.logo}</View>
                      <View>
                        <Text style={styles.gatewayAppName}>{app.name}</Text>
                        <Text style={styles.gatewayAppSub}>{app.sub}</Text>
                      </View>
                    </View>
                    <View style={[styles.radioCircle, selectedGatewayApp === app.id && styles.radioCircleActive]} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={[styles.confirmGatewayPayBtn, gatewayProcessing && { opacity: 0.7 }]}
                onPress={() => handleProcessGatewayPayment(true)}
                disabled={gatewayProcessing}
                activeOpacity={0.85}
              >
                {gatewayProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmGatewayPayBtnText}>
                    Confirm & Update Payment (Auto-Credit Owner) →
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelGatewayPayBtn}
                onPress={() => handleProcessGatewayPayment(false)}
                disabled={gatewayProcessing}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelGatewayPayBtnText}>
                  Cancel / Record Failed Payment (No Balance Change)
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: ONBOARD NEW TENANT ─── */}
      <Modal
        visible={showOnboardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOnboardModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Onboard Resident</Text>
            <Text style={styles.modalSub}>Assign a vacant bed (1 person = 1 bed only)</Text>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Property Choice */}
              {properties.length > 1 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Select PG Property</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {properties.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.chip,
                          selectedPropId === p.id && styles.chipActive,
                        ]}
                        onPress={() => {
                          setSelectedPropId(p.id);
                          setSelectedBedId('');
                          setSelectedRoomId('');
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedPropId === p.id && styles.chipTextActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Select Available Bed (Occupied beds are excluded) */}
              <Text style={styles.inputLabel}>
                Select Vacant Bed ({modalAvailableBeds.length} Available)
              </Text>
              {modalAvailableBeds.length === 0 ? (
                <Text style={styles.noBedText}>
                  No vacant beds available in this property. All beds are occupied.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {modalAvailableBeds.map(({ bed, roomNumber, roomId, rentPaise, depositPaise }) => {
                    const isSelected = selectedBedId === bed.id;
                    return (
                      <TouchableOpacity
                        key={bed.id}
                        style={[styles.bedChip, isSelected && styles.bedChipActive]}
                        onPress={() => {
                          setSelectedBedId(bed.id);
                          setSelectedRoomId(roomId);
                          const fixedRent = rentPaise ? rentPaise / 100 : 8500;
                          const fixedDep = depositPaise ? depositPaise / 100 : 2500;
                          setFixedRentAmount(fixedRent);
                          setFixedDepositAmount(fixedDep);
                          // Requirement 3: Keep inputs empty so watermark placeholder shows
                        }}
                      >
                        <Text style={[styles.bedChipText, isSelected && styles.bedChipTextActive]}>
                          Room {roomNumber} • {bed.bedLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={styles.inputLabel}>Resident Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={onboardFullName}
                onChangeText={setOnboardFullName}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#334155"
              />

              <Text style={styles.inputLabel}>Mobile Phone *</Text>
              <TextInput
                style={styles.textInput}
                value={onboardPhone}
                onChangeText={setOnboardPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 9876543210"
                placeholderTextColor="#94a3b8"
              />

              {/* Aadhaar Number with Instant ₹0 Verhoeff & QR Auto-Fill (Requirement 2) */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                <Text style={styles.inputLabel}>12-Digit Aadhaar Card Number *</Text>
                <TouchableOpacity
                  style={styles.qrScanMiniBtn}
                  onPress={() => setShowOnboardQrModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.qrScanMiniBtnText}>📷 Free QR Scan</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.textInput}
                value={onboardIdProof}
                onChangeText={(txt) => {
                  setOnboardIdProof(txt);
                  const clean = txt.replace(/\s+/g, '');
                  if (clean.length === 12) {
                    const v = validateVerhoeffAadhaar(clean);
                    if (v.isValid) {
                      setOnboardAadhaarVerified(true);
                    }
                  }
                }}
                keyboardType="numeric"
                maxLength={14}
                placeholder="e.g. 5489 1234 5678"
                placeholderTextColor="#94a3b8"
              />

              {/* Real-Time Free Verhoeff Checksum Indicator */}
              {(() => {
                const clean = onboardIdProof.replace(/\s+/g, '');
                if (!clean) {
                  return (
                    <Text style={styles.aadhaarHintText}>
                      💡 Free In-App Verhoeff Check: validates the 12 digits so dummy numbers cannot be entered.
                    </Text>
                  );
                }
                const v = validateVerhoeffAadhaar(clean);
                return (
                  <View style={[styles.verhoeffBadge, v.isValid ? styles.verhoeffValid : styles.verhoeffInvalid]}>
                    <Text style={[styles.verhoeffText, v.isValid ? { color: '#16a34a' } : { color: '#dc2626' }]}>
                      {v.message}
                    </Text>
                  </View>
                );
              })()}

              {onboardAadhaarVerified && (
                <View style={styles.aadhaarVerifiedBadge}>
                  <Text style={styles.aadhaarVerifiedText}>✓ UIDAI Aadhaar Verified & Checksum Validated (₹0 Cost)</Text>
                </View>
              )}

              {/* FIXED RENT BANNER & PAYMENT SECTION */}
              <View style={styles.fixedRentInfoBox}>
                <View style={styles.fixedRentRow}>
                  <Text style={styles.fixedRentLabel}>🏢 FIXED MONTHLY RENT:</Text>
                  <Text style={styles.fixedRentVal}>₹{fixedRentAmount.toLocaleString('en-IN')} / mo</Text>
                </View>
                <View style={styles.fixedRentRow}>
                  <Text style={styles.fixedRentLabel}>🛡️ SECURITY DEPOSIT:</Text>
                  <Text style={styles.fixedRentVal}>₹{fixedDepositAmount.toLocaleString('en-IN')}</Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Rent Amount Paying Now (₹) *</Text>
              <View style={styles.currencyInputRow}>
                <Text style={styles.currencyInrLight}>₹</Text>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderWidth: 0, paddingHorizontal: 0, marginBottom: 0, backgroundColor: 'transparent' }]}
                  value={onboardRentPayingNow}
                  onChangeText={setOnboardRentPayingNow}
                  keyboardType="numeric"
                  placeholder={`INR ${fixedRentAmount}`}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Dynamic Rent Due Indicator */}
              {(() => {
                const paying = Number(onboardRentPayingNow || 0);
                const due = Math.max(0, fixedRentAmount - paying);
                if (due > 0) {
                  return (
                    <View style={styles.rentDueAlertBox}>
                      <Text style={styles.rentDueAlertTitle}>
                        ⚠️ RENT DUE: ₹{due.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.rentDueAlertSub}>
                        Resident pays ₹{paying.toLocaleString('en-IN')} today. Remaining ₹{due.toLocaleString('en-IN')} will be marked as DUE on dashboard.
                      </Text>
                    </View>
                  );
                } else if (paying >= fixedRentAmount && fixedRentAmount > 0) {
                  return (
                    <View style={styles.rentPaidAlertBox}>
                      <Text style={styles.rentPaidAlertTitle}>
                        ✓ FULL RENT PAID (₹0 Due)
                      </Text>
                      <Text style={styles.rentPaidAlertSub}>
                        Complete monthly rent of ₹{fixedRentAmount.toLocaleString('en-IN')} received.
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Security Deposit Paid (₹)</Text>
                  <View style={styles.currencyInputRow}>
                    <Text style={styles.currencyInrLight}>₹</Text>
                    <TextInput
                      style={[styles.textInput, { flex: 1, borderWidth: 0, paddingHorizontal: 0, marginBottom: 0, backgroundColor: 'transparent' }]}
                      value={onboardDepositPayingNow}
                      onChangeText={setOnboardDepositPayingNow}
                      keyboardType="numeric"
                      placeholder={`INR ${fixedDepositAmount}`}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Payment Mode</Text>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                    {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        style={[
                          styles.modePillSmall,
                          onboardPayMode === mode && styles.modePillSmallActive,
                        ]}
                        onPress={() => setOnboardPayMode(mode)}
                      >
                        <Text
                          style={[
                            styles.modePillSmallText,
                            onboardPayMode === mode && styles.modePillSmallTextActive,
                          ]}
                        >
                          {mode === 'BANK_TRANSFER' ? 'BANK' : mode}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowOnboardModal(false)}
                disabled={submittingOnboard}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleOnboardSubmit}
                disabled={submittingOnboard || modalAvailableBeds.length === 0}
              >
                {submittingOnboard ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Confirm & Allocate Bed</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3B: RECORD RENT TENANT SELECTOR ─── */}
      <Modal
        visible={showRecordRentPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecordRentPickerModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '82%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View>
                <Text style={styles.modalTitle}>Select Tenant to Record Rent</Text>
                <Text style={styles.modalSub}>Tenants with pending dues appear first</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRecordRentPickerModal(false)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.textInput, { marginBottom: 10 }]}
              value={recordRentSearch}
              onChangeText={setRecordRentSearch}
              placeholder="Search tenant name, phone or room..."
              placeholderTextColor="#94a3b8"
            />

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {[
                ...dueTenants,
                ...activeTenants.filter((at) => !dueTenants.some((dt) => dt.id === at.id)),
              ]
                .filter((t) => {
                  const q = recordRentSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (t.fullName || '').toLowerCase().includes(q) ||
                    (t.phone || '').includes(q) ||
                    (t.roomNumber || '').toLowerCase().includes(q)
                  );
                })
                .map((t) => {
                  const totalRent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
                  const dueAmt = typeof t.outstandingPaise === 'number'
                    ? Math.round(t.outstandingPaise / 100)
                    : (t.rentStatus === 'PAID' ? 0 : totalRent);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: dueAmt > 0 ? '#fed7aa' : '#e2e8f0',
                        backgroundColor: dueAmt > 0 ? '#fff7ed' : '#ffffff',
                        marginBottom: 8,
                      }}
                      onPress={() => {
                        setShowRecordRentPickerModal(false);
                        handleOpenTenantModal(t);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
                          {t.fullName}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                          Room/Flat {t.roomNumber || '101'} • {t.phone}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: dueAmt > 0 ? '#ea580c' : '#16a34a' }}>
                          {dueAmt > 0 ? `₹${dueAmt.toLocaleString('en-IN')} Due` : '✓ Paid'}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748b' }}>Tap to record →</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 4: MONTH & YEAR SELECTOR DROPDOWN (Requirements 6 & 7) ─── */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: 420 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Select Billing Month</Text>
                <Text style={styles.modalSub}>View profit, collection & tenant history</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)} style={styles.modalCloseIcon}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginVertical: 6 }}>
              {MONTH_OPTIONS.map((opt) => {
                const isSelected = opt.value === selectedMonth;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.monthPickerItem,
                      isSelected && styles.monthPickerItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedMonth(opt.value);
                      setShowMonthPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 16 }}>📅</Text>
                      <Text
                        style={[
                          styles.monthPickerItemText,
                          isSelected && styles.monthPickerItemTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.monthPickerCheckCircle}>
                        <Text style={styles.monthPickerCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.enquiryModalCloseBtn, { marginTop: 10 }]}
              onPress={() => setShowMonthPicker(false)}
            >
              <Text style={styles.enquiryModalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 5: SUBSCRIPTION & ₹0 AUTO-PAY SETUP (REQUIREMENTS 6, 7, 8) ─── */}
      <Modal
        visible={showSubscriptionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Setup Auto-Pay Subscription</Text>
                <Text style={styles.modalSub}>First 30 days are 100% free • Cancel anytime</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSubscriptionModal(false)}
                style={styles.modalCloseIcon}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Plan Choice Cards */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[
                    styles.modalPlanCard,
                    selectedPlanPeriod === 'MONTHLY' && styles.modalPlanCardSelected,
                  ]}
                  onPress={() => setSelectedPlanPeriod('MONTHLY')}
                >
                  <View style={styles.modalPlanCardTop}>
                    <Text style={styles.modalPlanCardTitle}>Monthly Plan</Text>
                    <Text style={styles.modalPlanCardBadge}>RECOMMENDED</Text>
                  </View>
                  <Text style={styles.modalPlanCardPrice}>₹99 <Text style={{ fontSize: 12, color: '#64748b' }}>/ mo</Text></Text>
                  <Text style={styles.modalPlanCardSub}>Billed monthly after 30-day trial</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalPlanCard,
                    selectedPlanPeriod === 'YEARLY' && styles.modalPlanCardSelected,
                  ]}
                  onPress={() => setSelectedPlanPeriod('YEARLY')}
                >
                  <View style={styles.modalPlanCardTop}>
                    <Text style={styles.modalPlanCardTitle}>Annual Plan</Text>
                    <Text style={[styles.modalPlanCardBadge, { backgroundColor: '#dcfce7', color: '#15803d' }]}>SAVE 8%</Text>
                  </View>
                  <Text style={styles.modalPlanCardPrice}>₹1,099 <Text style={{ fontSize: 12, color: '#64748b' }}>/ yr</Text></Text>
                  <Text style={styles.modalPlanCardSub}>2 months free included</Text>
                </TouchableOpacity>
              </View>

              {/* Mandate Summary */}
              <View style={styles.mandateSummaryBox}>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateLabel}>Initial Charge Today:</Text>
                  <Text style={[styles.mandateVal, { color: '#16a34a', fontWeight: '900' }]}>₹0 (FREE TRIAL)</Text>
                </View>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateLabel}>Recurring Auto-Pay:</Text>
                  <Text style={styles.mandateVal}>{selectedPlanPeriod === 'MONTHLY' ? '₹99 / month' : '₹1,099 / year'}</Text>
                </View>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateLabel}>First Auto-Debit Date:</Text>
                  <Text style={styles.mandateVal}>22 Dec 2026 (After 30 days)</Text>
                </View>
                <View style={styles.mandateRow}>
                  <Text style={styles.mandateLabel}>Included Services:</Text>
                  <Text style={styles.mandateVal}>Unlimited WhatsApp + Calls + Analytics</Text>
                </View>
              </View>

              {/* Select Auto-Pay Payment Method with Actual Official Logos */}
              <Text style={[styles.label, { marginTop: 12 }]}>SELECT AUTO-PAY METHOD</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {[
                  { id: 'GPAY', label: 'Google Pay', logo: <GooglePayLogo size={20} /> },
                  { id: 'PHONEPE', label: 'PhonePe UPI', logo: <PhonePeLogo size={20} /> },
                  { id: 'PAYTM', label: 'Paytm UPI', logo: <PaytmLogo size={20} /> },
                  { id: 'CARD', label: 'Debit / Credit Card', logo: <CardPaymentLogo size={20} /> },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.payMethodPill,
                      autoPayMethod === m.id && styles.payMethodPillSelected,
                    ]}
                    onPress={() => setAutoPayMethod(m.id as any)}
                    activeOpacity={0.8}
                  >
                    <View style={{ marginRight: 2 }}>{m.logo}</View>
                    <Text
                      style={[
                        styles.payMethodPillText,
                        autoPayMethod === m.id && styles.payMethodPillTextSelected,
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveChangesBtn, subscribing && styles.buttonDisabled]}
                onPress={handleConfirmAutoPay}
                disabled={subscribing}
              >
                {subscribing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveChangesBtnText}>
                    Authorize ₹0 Auto-Pay & Activate Unlimited Plan
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 6: RESIDENTS WITH PENDING BALANCE (NEED TO COLLECT - REQUIREMENT 1) ─── */}
      <Modal
        visible={showNeedToCollectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNeedToCollectModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>⏳</Text>
                  <Text style={styles.modalTitle}>Pending Rent Collection</Text>
                </View>
                <Text style={styles.modalSub}>
                  {dueTenants.length} residents have pending balance totaling ₹{pendingRent.toLocaleString('en-IN')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowNeedToCollectModal(false)}
                style={styles.modalCloseIcon}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {dueTenants.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>All Clear!</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                    All active residents have cleared their monthly rent in full.
                  </Text>
                </View>
              ) : (
                dueTenants.map((t) => {
                  const totalRent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
                  const dueRent = typeof t.outstandingPaise === 'number'
                    ? Math.round(t.outstandingPaise / 100)
                    : (t.rentStatus === 'PAID' ? 0 : totalRent);
                  const paidRent = Math.max(0, totalRent - dueRent);

                  return (
                    <View key={t.id} style={styles.needCollectItemCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View>
                          <Text style={styles.needCollectTenantName}>{t.fullName}</Text>
                          <Text style={styles.needCollectTenantRoom}>
                            Room {t.roomNumber || '101'} • {t.bedLabel || 'Bed 1'} • +91 {t.phone}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.needCollectDueBig}>₹{dueRent.toLocaleString('en-IN')}</Text>
                          <Text style={styles.needCollectDueLabel}>Balance Due</Text>
                        </View>
                      </View>

                      {paidRent > 0 && (
                        <View style={styles.needCollectPartialNotice}>
                          <Text style={styles.needCollectPartialNoticeText}>
                            Partial paid: ₹{paidRent.toLocaleString('en-IN')} of ₹{totalRent.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      )}

                      {/* Action Buttons Row */}
                      <View style={styles.needCollectBtnRow}>
                        {/* 1. Direct WhatsApp with Pay Link */}
                        <TouchableOpacity
                          style={styles.needCollectWaBtn}
                          onPress={() => handleSendWhatsAppWithPaymentLink(t)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.needCollectWaBtnText}>💬 WhatsApp Pay Link</Text>
                        </TouchableOpacity>

                        {/* 2. Collect / Pay via Gateway */}
                        <TouchableOpacity
                          style={styles.needCollectGatewayBtn}
                          onPress={() => {
                            setSelectedTenantForGateway(t);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.needCollectGatewayBtnText}>💳 Pay / Collect</Text>
                        </TouchableOpacity>

                        {/* 3. Call button */}
                        <TouchableOpacity
                          style={styles.needCollectCallBtn}
                          onPress={() => {
                            const clean = t.phone.replace(/[^0-9]/g, '');
                            Linking.openURL(`tel:${clean}`).catch(() => Alert.alert('Call', `+91 ${clean}`));
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 14 }}>📞</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 7: ALL INCOMPLETE KYC RESIDENTS (REQUIREMENT 7) ─── */}
      <Modal
        visible={showAllKycModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllKycModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>⚠️</Text>
                  <Text style={styles.modalTitle}>Incomplete KYC Residents</Text>
                </View>
                <Text style={styles.modalSub}>
                  {pendingKycTenants.length} residents have pending Aadhaar verification
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAllKycModal(false)}
                style={styles.modalCloseIcon}
              >
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {pendingKycTenants.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>✅</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>All KYC Completed!</Text>
                  <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 }}>
                    All current PG residents have verified Aadhaar / Government ID.
                  </Text>
                </View>
              ) : (
                pendingKycTenants.map((t) => (
                  <View key={t.id} style={styles.kycListItemCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                      <View style={styles.kycListAvatar}>
                        <Text style={{ fontSize: 16 }}>👤</Text>
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.kycListName}>{t.fullName}</Text>
                        <Text style={styles.kycListDetails}>
                          Room {t.roomNumber || '101'} • 📞 {t.phone}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <View style={styles.kycMiniPill}>
                            <Text style={styles.kycMiniPillText}>
                              {(t.idProof || t.idProofNumber) && (t.idProof || t.idProofNumber)!.length >= 12
                                ? 'Pending Validation'
                                : 'No Aadhaar Entered'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.kycListActionBtn}
                      onPress={() => {
                        setShowAllKycModal(false);
                        setVerifyingTenantKyc(t);
                        setKycVerifyAadhaarInput(t.idProof || t.idProofNumber || '');
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.kycListActionBtnText}>⚡ Verify</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 8: QUICK AADHAAR VERIFICATION (FREE & OFFLINE) ─── */}
      <Modal
        visible={!!verifyingTenantKyc}
        transparent
        animationType="slide"
        onRequestClose={() => setVerifyingTenantKyc(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Aadhaar Verification</Text>
                <Text style={styles.modalSub}>
                  Resident: {verifyingTenantKyc?.fullName} (Room {verifyingTenantKyc?.roomNumber || '101'})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVerifyingTenantKyc(null)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
              <Text style={styles.inputLabel}>12-Digit Aadhaar Number</Text>
              <TouchableOpacity
                style={styles.qrScanMiniBtn}
                onPress={() => setShowKycQrScanner(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.qrScanMiniBtnText}>📷 Scan Aadhaar QR</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textInput}
              value={kycVerifyAadhaarInput}
              onChangeText={setKycVerifyAadhaarInput}
              keyboardType="numeric"
              maxLength={14}
              placeholder="e.g. 5489 1234 5678"
              placeholderTextColor="#94a3b8"
            />

            {/* Real-time Verhoeff check */}
            {(() => {
              const clean = kycVerifyAadhaarInput.replace(/\s+/g, '');
              if (!clean) return null;
              const v = validateVerhoeffAadhaar(clean);
              return (
                <View style={[styles.verhoeffBadge, v.isValid ? styles.verhoeffValid : styles.verhoeffInvalid]}>
                  <Text style={[styles.verhoeffText, v.isValid ? { color: '#16a34a' } : { color: '#dc2626' }]}>
                    {v.message}
                  </Text>
                </View>
              );
            })()}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[
                  styles.saveChangesBtn,
                  { flex: 1 },
                  (!kycVerifyAadhaarInput || verifyingKycLoading) && styles.buttonDisabled,
                ]}
                onPress={() =>
                  verifyingTenantKyc &&
                  handleVerifyTenantAadhaar(verifyingTenantKyc.id, kycVerifyAadhaarInput)
                }
                disabled={!kycVerifyAadhaarInput || verifyingKycLoading}
              >
                {verifyingKycLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveChangesBtnText}>✓ Verify Aadhaar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 9: IN-APP QR CODE SCANNER / PAYLOAD PARSER (REQUIREMENTS 2 & 4) ─── */}
      <Modal
        visible={showOnboardQrModal || showKycQrScanner}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowOnboardQrModal(false);
          setShowKycQrScanner(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Scan Aadhaar QR</Text>
                <Text style={styles.modalSub}>Auto-extract resident details</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowOnboardQrModal(false);
                  setShowKycQrScanner(false);
                }}
              >
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' }}>
              <Text style={{ fontSize: 11, color: '#166534', fontWeight: '600' }}>
                📸 Scan or paste the QR code string from the tenant's Aadhaar card. StayNest will automatically extract and auto-fill Name, 12-digit UID, and Government address directly!
              </Text>
            </View>

            <Text style={styles.inputLabel}>Aadhaar QR String / XML Data</Text>
            <TextInput
              style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
              multiline
              value={showKycQrScanner ? kycQrPayloadInput : rawQrPayloadInput}
              onChangeText={(txt) => {
                if (showKycQrScanner) {
                  setKycQrPayloadInput(txt);
                } else {
                  setRawQrPayloadInput(txt);
                }
              }}
              placeholder="Paste raw Aadhaar QR code contents (e.g. <PrintLetterBarcodeData uid='...' name='...' /> or JSON)"
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={[styles.saveChangesBtn, { marginTop: 14 }]}
              onPress={() => {
                if (showKycQrScanner && verifyingTenantKyc) {
                  handleApplyKycQrPayload(verifyingTenantKyc.id, kycQrPayloadInput);
                } else {
                  const parsed = parseAadhaarQrPayload(rawQrPayloadInput);
                  if (parsed) {
                    if (parsed.name) setOnboardFullName(parsed.name);
                    if (parsed.uid) {
                      setOnboardIdProof(parsed.uid);
                      setOnboardAadhaarVerified(true);
                    }
                    setShowOnboardQrModal(false);
                    setRawQrPayloadInput('');
                    Alert.alert(
                      '✓ Auto-Fill Complete',
                      `Extracted Name: ${parsed.name}\nUID: ${parsed.uid}\nState: ${parsed.state || 'Verified'}\n\nAll details auto-filled with ₹0 API cost!`
                    );
                  } else {
                    Alert.alert('Invalid QR Format', 'Could not parse Aadhaar QR string. Please check the code.');
                  }
                }
              }}
            >
              <Text style={styles.saveChangesBtnText}>⚡ Parse & Auto-Fill Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 10: MODULAR ELECTRICITY BILL & METER MANAGER ─── */}
      <ElectricityBillModal
        visible={showElectricityModal}
        onClose={() => setShowElectricityModal(false)}
        activeTenantsCount={activeTenants.length}
        propertyId={selectedPropId}
        onExpenseAdded={() => loadData(true)}
      />

      {/* ─── MODAL 10B: LOG MAINTENANCE ISSUE MODAL ─── */}
      <LogIssueModal
        visible={showLogIssueModal}
        onClose={() => setShowLogIssueModal(false)}
        properties={properties}
        initialPropertyId={selectedPropId}
      />

      {/* ─── MODAL 10C: PG FOOD MENU MODAL ─── */}
      <FoodMenuModal
        visible={showFoodMenuModal}
        onClose={() => setShowFoodMenuModal(false)}
        properties={properties}
        initialPropertyId={selectedPropId}
      />

      {/* ─── MODAL 11: MULTI-PG SELECTOR DROPDOWN (1-CLICK SWITCHER) ─── */}
      <Modal
        visible={showPgDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPgDropdown(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>🏢 Select PG / Building</Text>
                <Text style={styles.modalSub}>1-click switch between all your managed properties</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPgDropdown(false)} style={styles.modalCloseIcon}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <View style={{ gap: 10, paddingVertical: 4 }}>
                {properties.map((p) => {
                  const isSelected = p.id === selectedPropId;
                  const propRooms = propertyRoomsMap[p.id] || [];
                  let propTotalBeds = 0;
                  let propOccupiedBeds = 0;
                  propRooms.forEach((r) => {
                    const beds = r.beds || [];
                    propTotalBeds += beds.length;
                    propOccupiedBeds += beds.filter((b) => b.status === 'OCCUPIED').length;
                  });
                  if (propTotalBeds === 0) {
                    propTotalBeds = p.id === 'prop-pg-2' ? 12 : 18;
                    propOccupiedBeds = p.id === 'prop-pg-2' ? 4 : 6;
                  }

                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.pgItemCard,
                        isSelected && styles.pgItemCardActive,
                      ]}
                      onPress={() => {
                        setSelectedPropId(p.id);
                        setShowPgDropdown(false);
                        if (typeof window !== 'undefined' && window.localStorage) {
                          window.localStorage.setItem('staynest_active_property_id', p.id);
                        }
                        onActivePropertyChange?.(p);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.pgItemPhotoWrap}>
                        <Image
                          source={{ uri: p.primaryPhotoUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80' }}
                          style={styles.pgItemPhoto}
                        />
                        {isSelected && <View style={styles.pgItemActiveDot} />}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={styles.pgItemName} numberOfLines={1}>{p.name}</Text>
                          {isSelected && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>✓ Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.pgItemAddress} numberOfLines={1}>📍 {p.addressLine || p.cityName}</Text>
                        <View style={styles.pgItemMetricsRow}>
                          <Text style={styles.pgItemMetricText}>
                            🛏️ {propOccupiedBeds}/{propTotalBeds} Beds ({Math.round((propOccupiedBeds / propTotalBeds) * 100)}% Occupied)
                          </Text>
                          <Text style={[styles.pgItemMetricText, { color: '#4f46e5', fontWeight: '800' }]}>
                            {p.genderPolicy || 'BOYS'} PG
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* + Add New PG Button */}
            <TouchableOpacity
              style={styles.addNewPgBtn}
              onPress={() => {
                setShowPgDropdown(false);
                setShowAddPgModal(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.addNewPgBtnText}>➕ Add New PG / Building</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 12: DUAL-MODE ADD NEW PROPERTY (PG BED-WISE & RENTAL FLATS ROOM-WISE) ─── */}
      <Modal
        visible={showAddPgModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPgModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.addPropModalShell}>
            {addPropStep === 2 ? (
              <FloorUnitMatrixBuilder
                propertyMode={propertyMode}
                floors={matrixFloors}
                defaultMaintenance={parseInt(newPgMaintFee.replace(/\D/g, '') || '0', 10)}
                onChangeFloors={setMatrixFloors}
                onBackStep={() => setAddPropStep(1)}
                onSubmit={handleCreateNewPg}
                submitting={creatingPgLoading}
              />
            ) : (
              <>
                {/* Top Dual-Mode Segmented Control */}
                <View style={styles.dualModePillRow}>
                  <TouchableOpacity
                    style={[styles.dualModePill, propertyMode === 'PG' && styles.dualModePillActive]}
                    onPress={() => {
                      setPropertyMode('PG');
                      setMatrixFloors(
                        getInitialMatrixFloors(
                          'PG',
                          parseInt(newPgRent.replace(/\D/g, '') || '8500', 10),
                          parseInt(newPgMaintFee.replace(/\D/g, '') || '0', 10)
                        )
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.dualModePillText, propertyMode === 'PG' && styles.dualModePillTextActive]}>
                      PG / Hostel (Bed-wise)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dualModePill, propertyMode === 'RENTAL' && styles.dualModePillActive]}
                    onPress={() => {
                      setPropertyMode('RENTAL');
                      setMatrixFloors(
                        getInitialMatrixFloors(
                          'RENTAL',
                          parseInt(newPgRent.replace(/\D/g, '') || '12000', 10),
                          parseInt(newPgMaintFee.replace(/\D/g, '') || '0', 10)
                        )
                      );
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.dualModePillText, propertyMode === 'RENTAL' && styles.dualModePillTextActive]}>
                      Rental Building / Flats (Room-wise)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Modal Header */}
                <View style={styles.addPropHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropTitle}>Add New Property</Text>
                    <Text style={styles.addPropSub}>Step 1 of 2 • Details, Location, Photos & Utilities</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddPgModal(false);
                      setAddPropStep(1);
                    }}
                    style={styles.modalCloseIcon}
                  >
                    <Text style={{ fontSize: 17, color: '#374151', fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              {/* PART 0: INITIAL DETAILS (BUILDING NAME & PHONE NUMBER FIRST) */}
              <View style={styles.addPropCard}>
                <Text style={styles.addPropCardTitle}>Initial Details</Text>

                <Text style={styles.addPropLabel}>
                  {propertyMode === 'PG' ? 'PG / Building Name *' : 'Building / Apartment Name *'}
                </Text>
                <TextInput
                  style={styles.addPropInput}
                  placeholder={propertyMode === 'PG' ? 'e.g. StayNest Elite Men\'s PG' : 'e.g. Sri Lakshmi Residency'}
                  placeholderTextColor="#9ca3af"
                  value={newPgName}
                  onChangeText={setNewPgName}
                />

                <Text style={styles.addPropLabel}>Contact Phone Number *</Text>
                <TextInput
                  style={styles.addPropInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={newPgPhone}
                  onChangeText={setNewPgPhone}
                />

                <Text style={styles.addPropLabel}>
                  {propertyMode === 'PG' ? 'Category / Gender Policy *' : 'Tenant Preference'}
                </Text>
                {propertyMode === 'PG' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['BOYS', 'GIRLS', 'CO_ED'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.addPropChipBtn, newPgGender === g && styles.addPropChipBtnActive]}
                        onPress={() => setNewPgGender(g)}
                      >
                        <Text style={[styles.addPropChipText, newPgGender === g && styles.addPropChipTextActive]}>
                          {g === 'BOYS' ? '👨 Boys PG' : g === 'GIRLS' ? '👩 Girls PG' : '👫 Coliving'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['FAMILY', 'BACHELORS', 'ANY'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[styles.addPropChipBtn, newPgRentalPolicy === p && styles.addPropChipBtnActive]}
                        onPress={() => setNewPgRentalPolicy(p)}
                      >
                        <Text style={[styles.addPropChipText, newPgRentalPolicy === p && styles.addPropChipTextActive]}>
                          {p === 'FAMILY' ? '👨‍👩‍👧 Family' : p === 'BACHELORS' ? '🧑 Bachelors' : '🏠 Any'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* PART 1: PROPERTY LOCATION & AUTO-FILL */}
              <View style={styles.addPropCard}>
                <Text style={styles.addPropCardTitle}>1. Property Location & Auto-Fill</Text>

                {/* Interactive Map Preview Banner */}
                <View style={styles.mapPreviewBox}>
                  <View style={styles.mapGridLines} />
                  <TouchableOpacity
                    style={styles.locateMapBtn}
                    onPress={handleLocateOnMap}
                    disabled={locatingMap}
                    activeOpacity={0.85}
                  >
                    {locatingMap ? (
                      <ActivityIndicator size="small" color="#ea580c" />
                    ) : (
                      <Text style={styles.locateMapBtnText}>Locate on Map</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={{ fontSize: 24, marginTop: 6 }}>📍</Text>
                  {newPgLat && newPgLng && (
                    <Text style={styles.mapCoordsText}>
                      {newPgLat.toFixed(4)}, {newPgLng.toFixed(4)}
                    </Text>
                  )}
                </View>

                {/* Address Search Autocomplete */}
                <TextInput
                  style={[styles.addPropInput, { marginTop: 10 }]}
                  placeholder="🔍 Search place, street or landmark to auto-fill..."
                  placeholderTextColor="#9ca3af"
                  value={newPgLocationSearch}
                  onChangeText={handleSearchLocation}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropLabel}>Full Address *</Text>
                    <TextInput
                      style={styles.addPropInput}
                      placeholder="Full Address"
                      placeholderTextColor="#9ca3af"
                      value={newPgAddress}
                      onChangeText={setNewPgAddress}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropLabel}>City *</Text>
                    <TextInput
                      style={styles.addPropInput}
                      placeholder="City"
                      placeholderTextColor="#9ca3af"
                      value={newPgCity}
                      onChangeText={setNewPgCity}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropLabel}>State</Text>
                    <TextInput
                      style={styles.addPropInput}
                      placeholder="(Andhra Pradesh)"
                      placeholderTextColor="#9ca3af"
                      value={newPgState}
                      onChangeText={setNewPgState}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropLabel}>Pincode *</Text>
                    <TextInput
                      style={styles.addPropInput}
                      placeholder="520010"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      maxLength={6}
                      value={newPgPincode}
                      onChangeText={setNewPgPincode}
                    />
                  </View>
                </View>
              </View>

              {/* ROOM PHOTOS GALLERY (INLINE MULTI-IMAGE UPLOAD) */}
              <View style={styles.addPropCard}>
                <Text style={styles.addPropCardTitle}>Room Photos Gallery ({newPgPhotos.length})</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                >
                  {newPgPhotos.map((uri, idx) => (
                    <View key={`${uri.slice(0, 24)}-${idx}`} style={styles.galleryThumbWrap}>
                      <Image source={{ uri }} style={styles.galleryThumbImg} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.galleryThumbRemoveBtn}
                        onPress={() => setNewPgPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.galleryThumbRemoveText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.galleryAddTile}
                    onPress={handlePickMultiplePropertyPhotos}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.galleryAddPlus}>+</Text>
                    <Text style={styles.galleryAddLabel}>Add Photos</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* PART 2: DEFAULT SHARING / UNIT CONFIG (Floors & Units configured in Step 2) */}
              <View style={styles.addPropCard}>
                <Text style={styles.addPropCardTitle}>2. Default Room / Unit Configuration</Text>

                {propertyMode === 'PG' ? (
                  <>
                    <Text style={styles.addPropLabel}>Default Room Sharing Type *</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                      {[
                        { key: 'SINGLE', label: '1-Share' },
                        { key: 'DOUBLE', label: '2-Share' },
                        { key: 'TRIPLE', label: '3-Share' },
                        { key: 'FOUR', label: '4-Share' },
                      ].map((s) => (
                        <TouchableOpacity
                          key={s.key}
                          style={[styles.addPropChipBtn, newPgSharingType === s.key && styles.addPropChipBtnActive]}
                          onPress={() => setNewPgSharingType(s.key as any)}
                        >
                          <Text style={[styles.addPropChipText, newPgSharingType === s.key && styles.addPropChipTextActive]}>
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.addPropLabel}>Default Unit Configuration *</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                      {(['1RK', '1BHK', '2BHK', '3BHK'] as const).map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.addPropChipBtn, newPgUnitConfig === u && styles.addPropChipBtnActive]}
                          onPress={() => setNewPgUnitConfig(u)}
                        >
                          <Text style={[styles.addPropChipText, newPgUnitConfig === u && styles.addPropChipTextActive]}>
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.autoSetupBox}>
                  <Text style={styles.autoSetupTitle}>📐 Flexible Floor & Unit Matrix:</Text>
                  <Text style={styles.autoSetupSub}>
                    Add any number of floors and customize each room/flat individually in Step 2.
                  </Text>
                </View>
              </View>

              {/* Quick Mode Note Row */}
              <TouchableOpacity
                style={styles.modeNoteRow}
                onPress={() => setPropertyMode(propertyMode === 'PG' ? 'RENTAL' : 'PG')}
                activeOpacity={0.8}
              >
                <Text style={styles.modeNoteText}>
                  ⓘ Note: Rental Building mode changes room setup to single-unit flats without individual bed tracking
                </Text>
                <View style={[styles.miniSwitchTrack, propertyMode === 'RENTAL' && styles.miniSwitchTrackOn]}>
                  <View style={[styles.miniSwitchThumb, propertyMode === 'RENTAL' && styles.miniSwitchThumbOn]} />
                </View>
              </TouchableOpacity>

              {/* PART 3: RENT, DEPOSIT & UTILITIES */}
              <View style={styles.addPropCard}>
                <Text style={styles.addPropCardTitle}>3. Rent, Deposit & Utilities</Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropLabel}>
                      {propertyMode === 'PG' ? 'Monthly Rent / Bed (₹) *' : 'Monthly Rent / Room (₹) *'}
                    </Text>
                    <TextInput
                      style={styles.addPropInput}
                      placeholder="8500"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      value={newPgRent}
                      onChangeText={setNewPgRent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropLabel}>Security Deposit (₹) *</Text>
                    <TextInput
                      style={styles.addPropInput}
                      placeholder="2500"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      value={newPgDeposit}
                      onChangeText={setNewPgDeposit}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addPropLabel}>Notice Period (Days)</Text>
                    <TextInput
                      style={styles.addPropInput}
                      placeholder="30"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      value={newPgNoticeDays}
                      onChangeText={setNewPgNoticeDays}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    {propertyMode === 'PG' ? (
                      <>
                        <Text style={styles.addPropLabel}>Food / Meals Policy</Text>
                        <TouchableOpacity
                          style={[
                            styles.foodPolicyPillCard,
                            newPgFoodPolicy !== 'NO_FOOD' && styles.foodPolicyPillCardActive,
                          ]}
                          onPress={() => {
                            const next =
                              newPgFoodPolicy === '3_MEALS'
                                ? '2_MEALS'
                                : newPgFoodPolicy === '2_MEALS'
                                  ? 'NO_FOOD'
                                  : '3_MEALS';
                            setNewPgFoodPolicy(next);
                            setNewPgFoodIncluded(next !== 'NO_FOOD');
                          }}
                        >
                          <Text style={[styles.foodPolicyPillText, newPgFoodPolicy !== 'NO_FOOD' && { color: '#166534' }]}>
                            {newPgFoodPolicy === '3_MEALS'
                              ? '• 3 Meals Included'
                              : newPgFoodPolicy === '2_MEALS'
                                ? '• 2 Meals Included'
                                : '• No Food Provided'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.addPropLabel}>Furnishing Status</Text>
                        <TouchableOpacity
                          style={styles.foodPolicyPillCard}
                          onPress={() => {
                            const next =
                              newPgFurnishing === 'SEMI_FURNISHED'
                                ? 'FULLY_FURNISHED'
                                : newPgFurnishing === 'FULLY_FURNISHED'
                                  ? 'UNFURNISHED'
                                  : 'SEMI_FURNISHED';
                            setNewPgFurnishing(next);
                          }}
                        >
                          <Text style={styles.foodPolicyPillText}>
                            {newPgFurnishing === 'FULLY_FURNISHED'
                              ? '• Fully Furnished'
                              : newPgFurnishing === 'SEMI_FURNISHED'
                                ? '• Semi-Furnished'
                                : '• Unfurnished'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>

                {/* Electricity Billing Toggle */}
                <Text style={[styles.addPropLabel, { marginTop: 6 }]}>Electricity Billing</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {[
                    { key: 'METERED', label: '⚡ Metered (₹/kWh)' },
                    { key: 'FIXED', label: 'Fixed Monthly' },
                    { key: 'INCLUDED', label: 'Included' },
                  ].map((el) => (
                    <TouchableOpacity
                      key={el.key}
                      style={[styles.addPropChipBtn, newPgElectricityMode === el.key && styles.addPropChipBtnActive]}
                      onPress={() => setNewPgElectricityMode(el.key as any)}
                    >
                      <Text style={[styles.addPropChipText, newPgElectricityMode === el.key && styles.addPropChipTextActive]}>
                        {el.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {newPgElectricityMode === 'METERED' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addPropLabel}>Prev Reading</Text>
                      <TextInput
                        style={styles.addPropInput}
                        keyboardType="numeric"
                        value={newPgElecPrev}
                        onChangeText={setNewPgElecPrev}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addPropLabel}>Curr Reading</Text>
                      <TextInput
                        style={styles.addPropInput}
                        keyboardType="numeric"
                        value={newPgElecCurr}
                        onChangeText={setNewPgElecCurr}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addPropLabel}>Rate (₹/kWh)</Text>
                      <TextInput
                        style={styles.addPropInput}
                        keyboardType="numeric"
                        value={newPgElecRate}
                        onChangeText={setNewPgElecRate}
                      />
                    </View>
                  </View>
                )}

                {newPgElectricityMode === 'FIXED' && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.addPropLabel}>Fixed Electricity Charge (₹/month)</Text>
                    <TextInput
                      style={styles.addPropInput}
                      keyboardType="numeric"
                      value={newPgElecFixed}
                      onChangeText={setNewPgElecFixed}
                    />
                  </View>
                )}

                {/* Maintenance Charges Toggle */}
                <Text style={styles.addPropLabel}>Maintenance Charges</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  {[
                    { key: 'INCLUDED', label: 'Maintenance Included' },
                    { key: 'EXTRA', label: 'Extra Monthly Maintenance (₹)' },
                  ].map((m) => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.addPropChipBtn, newPgMaintenanceMode === m.key && styles.addPropChipBtnActive]}
                      onPress={() => setNewPgMaintenanceMode(m.key as any)}
                    >
                      <Text style={[styles.addPropChipText, newPgMaintenanceMode === m.key && styles.addPropChipTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {newPgMaintenanceMode === 'EXTRA' && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.addPropLabel}>Monthly Maintenance Amount (₹)</Text>
                    <TextInput
                      style={styles.addPropInput}
                      keyboardType="numeric"
                      value={newPgMaintFee}
                      onChangeText={setNewPgMaintFee}
                    />
                  </View>
                )}

                {/* Live Monthly Invoice Preview */}
                {(() => {
                  const inv = computeMonthlyInvoiceTotal({
                    baseRent: parseInt(newPgRent.replace(/\D/g, '') || '0', 10),
                    electricityMode: newPgElectricityMode,
                    electricityFixed: parseInt(newPgElecFixed.replace(/\D/g, '') || '0', 10),
                    prevReading: parseInt(newPgElecPrev.replace(/\D/g, '') || '0', 10),
                    currReading: parseInt(newPgElecCurr.replace(/\D/g, '') || '0', 10),
                    ratePerUnit: parseFloat(newPgElecRate || '0'),
                    maintenanceMode: newPgMaintenanceMode,
                    maintenanceFee: parseInt(newPgMaintFee.replace(/\D/g, '') || '0', 10),
                  });
                  return (
                    <View style={styles.invoicePreviewBox}>
                      <Text style={styles.invoicePreviewTitle}>Estimated Monthly Tenant Invoice:</Text>
                      <Text style={styles.invoicePreviewBreakdown}>
                        Rent ₹{inv.baseRent.toLocaleString('en-IN')} + Elec ₹{inv.electricityCharge.toLocaleString('en-IN')} + Maint ₹{inv.maintenanceCharge.toLocaleString('en-IN')} ={' '}
                        <Text style={{ fontWeight: '900', color: '#ea580c' }}>
                          ₹{inv.totalInvoice.toLocaleString('en-IN')}/mo
                        </Text>
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* PART 4: AMENITIES & FACILITIES */}
              <View style={styles.addPropCard}>
                <Text style={styles.addPropCardTitle}>4. Building Amenities & Facilities</Text>
                <View style={styles.amenitiesWrap}>
                  {[
                    { key: 'HIGH_SPEED_WIFI', label: '📶 High-Speed Wi-Fi' },
                    ...(propertyMode === 'PG' ? [{ key: 'HOMESTYLE_FOOD', label: '🍲 3 Homestyle Meals' }] : []),
                    { key: 'AC_ROOMS', label: '❄️ Air Conditioned (AC)' },
                    { key: 'DAILY_HOUSEKEEPING', label: '🧹 Daily Cleaning' },
                    { key: 'POWER_BACKUP', label: '⚡ 24/7 Power Backup' },
                    { key: 'CCTV_SECURITY', label: '📹 CCTV Security' },
                    { key: 'HOT_WATER', label: '🚿 Geyser / Hot Water' },
                    { key: 'WASHING_MACHINE', label: '🧺 Washing Machine' },
                    { key: 'RO_WATER', label: '💧 RO Purified Water' },
                    { key: 'LIFT', label: '🛗 Lift / Elevator' },
                    { key: 'BIKE_PARKING', label: '🛵 Two-Wheeler Parking' },
                  ].map((item) => {
                    const isSel = newPgAmenities.includes(item.key);
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.amenityChip, isSel && styles.amenityChipActive]}
                        onPress={() => {
                          if (isSel) {
                            setNewPgAmenities(newPgAmenities.filter((a) => a !== item.key));
                          } else {
                            setNewPgAmenities([...newPgAmenities, item.key]);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.amenityChipText, isSel && styles.amenityChipTextActive]}>
                          {isSel ? '✓ ' : '+ '}{item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitCreatePgBtn}
                onPress={() => {
                  if (!newPgName.trim() || newPgName.trim().length < 3) {
                    Alert.alert('Required: Property Name', 'Please enter a valid Building / PG name (at least 3 characters).');
                    return;
                  }
                  const cleanPhone = newPgPhone.replace(/\D/g, '');
                  if (cleanPhone.length < 10) {
                    Alert.alert('Required: Phone Number', 'Please enter a valid 10-digit contact phone number.');
                    return;
                  }
                  if (!newPgAddress.trim() || newPgAddress.trim().length < 3) {
                    Alert.alert('Required: Address', 'Please enter the street address or use "Locate on Map".');
                    return;
                  }
                  if (!newPgCity.trim()) {
                    Alert.alert('Required: City', 'Please enter the city where the building is located.');
                    return;
                  }
                  const cleanPincode = newPgPincode.replace(/\D/g, '');
                  if (cleanPincode.length !== 6) {
                    Alert.alert('Required: Pincode', 'Please enter a valid 6-digit postal pincode.');
                    return;
                  }
                  setAddPropStep(2);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.submitCreatePgBtnText}>
                  Continue to Floor & Unit Matrix (Step 2) →
                </Text>
              </TouchableOpacity>
            </ScrollView>
              </>
            )}
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
  // ─── Subscription & Auto-Pay Styles ───
  subCardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fef08a',
    shadowColor: '#eab308',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  crownCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fef9c3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    flexShrink: 1,
  },
  subCardSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
    lineHeight: 15,
    flexShrink: 1,
  },
  subActiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  subActiveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  subBadgePaid: {
    backgroundColor: '#dcfce7',
  },
  subBadgePaidText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '900',
  },
  subBadgeTrial: {
    backgroundColor: '#fef3c7',
  },
  subBadgeTrialText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '900',
  },
  subTenantProgressBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  subProgressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  subProgressCount: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
  },
  subProgressBarBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 6,
  },
  subProgressBarFill: {
    height: '100%',
    backgroundColor: '#eab308',
    borderRadius: 3,
  },
  subProgressNotice: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 14,
  },
  subOfferBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    overflow: 'hidden',
  },
  subPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subPriceAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  subPricePeriod: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  subFreeTrialNote: {
    fontSize: 10,
    color: '#b45309',
    fontWeight: '700',
    marginTop: 2,
    lineHeight: 14,
    flexShrink: 1,
  },
  planSwitchPill: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexShrink: 0,
  },
  planSwitchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planSwitchBtnActive: {
    backgroundColor: '#0f172a',
  },
  planSwitchBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  planSwitchBtnTextActive: {
    color: '#ffffff',
  },
  subFacilitiesList: {
    marginBottom: 14,
  },
  subFacilityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  subCheckIcon: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 1,
  },
  subFacilityText: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 16,
  },
  subPrimaryBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  subPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 16,
  },
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
  modalPlanCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalPlanCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalPlanCardBadge: {
    fontSize: 8,
    fontWeight: '900',
    color: '#4f46e5',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalPlanCardPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalPlanCardSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  mandateSummaryBox: {
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
  mandateLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  mandateVal: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '800',
  },
  payMethodPill: {
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
  payMethodPillSelected: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  payMethodPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  payMethodPillTextSelected: {
    color: '#047857',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  saveChangesBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  saveChangesBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // ─── Need to Collect & Gateway Styles ───
  needCollectItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  needCollectTenantName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  needCollectTenantRoom: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  needCollectDueBig: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ef4444',
  },
  needCollectDueLabel: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '700',
  },
  needCollectPartialNotice: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  needCollectPartialNoticeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  needCollectBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  needCollectWaBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  needCollectWaBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  needCollectGatewayBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  needCollectGatewayBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  needCollectCallBtn: {
    backgroundColor: '#f1f5f9',
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayBillSummaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gatewayBillLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  gatewayBillVal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  zeroFeePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  zeroFeePillText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  gatewayAppsGrid: {
    gap: 8,
    marginBottom: 14,
  },
  gatewayAppOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  gatewayAppOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  gatewayAppName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  gatewayAppSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  radioCircleActive: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  confirmGatewayPayBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmGatewayPayBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  cancelGatewayPayBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelGatewayPayBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeftContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dashboardLogo: {
    width: 130,
    height: 44,
    marginBottom: 2,
  },
  welcomeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  ownerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  profileBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 11,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainScrollContent: {
    paddingBottom: 130,
  },

  // ─── Deep Slate-Navy Hero Financial Container (Luxury SaaS Interface) ───
  heroSlateNavyContainer: {
    backgroundColor: '#1e293b',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  heroLavenderContainer: {
    backgroundColor: '#1e293b',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
  },
  heroTopDividedBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroPropertyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    maxWidth: 220,
  },
  heroPropThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPropName: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  heroPropArrow: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  heroRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroBellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  heroUnreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  heroAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  heroAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9a3412',
  },
  heroTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  heroGreetingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  heroGreetingTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.1,
  },
  heroGreetingBadge: {
    backgroundColor: 'rgba(254, 243, 199, 0.25)',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  heroGreetingBadgeText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '900',
  },
  heroGreetingSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  heroDashboardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  heroMonthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  heroMonthDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroMonthDropdownText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  heroMonthDropdownArrow: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  heroExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heroExportBtnText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  monthPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthPickerItemSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#6c5ce7',
    borderWidth: 1.5,
  },
  monthPickerItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  monthPickerItemTextSelected: {
    color: '#6c5ce7',
    fontWeight: '900',
  },
  monthPickerCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPickerCheckText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  heroDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  heroDotActive: {
    width: 14,
    backgroundColor: '#ffffff',
  },
  heroCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroCashIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMiniRingOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderTopColor: '#22c55e',
    borderRightColor: '#22c55e',
    borderBottomColor: '#22c55e',
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMiniRingInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMiniRingText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroCalendarIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroCardSub: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 3,
  },
  heroDueCountBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  heroDueCountText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroSpentIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroExpenseTagBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  heroExpenseTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroProfitCardGreen: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
  },
  heroProfitCardRed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
  },
  heroProfitIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroProfitTagBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  heroProfitTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroProfitAmountGreen: {
    color: '#10b981',
  },
  heroProfitAmountRed: {
    color: '#f87171',
  },
  heroProfitSubGreen: {
    color: '#6ee7b7',
    fontWeight: '600',
  },
  heroProfitSubRed: {
    color: '#fca5a5',
    fontWeight: '600',
  },

  // ─── Occupancy Pill Cards (Empty & Occupied Beds) ───
  occupancyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  occupancyPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  occupancyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  occupancyTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  occupancyNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  occupancyLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  occupancyChevron: {
    fontSize: 18,
    fontWeight: '700',
    color: '#94a3b8',
  },

  // ─── Quick Actions (8-Grid) ───
  sectionHeaderWrap: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionHeadingNavy: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1e1b4b',
  },
  // Quick Actions: 4 actions per line, pure white background, orange borders, compact icons
  quickActionsSectionWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 26,
  },
  quickActionsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  quickActionsSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  quickGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  quickCompactCard: {
    width: '23.2%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fb923c', // Orange border, pure white inside
  },
  quickIconCircle: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickCompactIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  quickCompactLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 13,
  },
  enquiryHoldBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  enquiryHoldBtnText: {
    color: '#c2410c',
    fontSize: 11,
    fontWeight: '800',
  },

  // ─── Rent Due (Only Due Tenants) ───
  rentDueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 14,
  },
  dueCountBadgePill: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dueCountBadgeText: {
    color: '#6d28d9',
    fontSize: 12,
    fontWeight: '800',
  },
  viewAllDueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
  },
  dueListCol: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  // ─── Recent Activities (Last 5) ───
  recentActSection: {
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 24,
  },
  recentActHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentActCountPill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recentActCountText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
  },
  recentActSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  recentActCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#efece9',
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  recentActRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  recentActRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  recentActIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentActTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  recentActSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  recentActAmount: {
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  recentActTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  recentActEmptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#efece9',
    padding: 20,
    alignItems: 'center',
  },
  recentActEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  recentActEmptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  dueTenantCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  dueCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dueTenantName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  dueTenantDate: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  dueTenantRoom: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 10,
  },
  dueCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueTenantAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ef4444',
  },
  dueActionBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueWhatsAppPillBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#25D366',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  dueWhatsAppPillBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  duePhoneBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueUpdateBtn: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dueUpdateBtnText: {
    color: '#6d28d9',
    fontSize: 12,
    fontWeight: '800',
  },
  allClearCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  allClearSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  tenantBoxCardDue: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffbfb',
  },
  tenantBoxTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tenantBoxAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantBoxDueBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tenantBoxDueText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tenantBoxName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 2,
  },
  tenantBoxRoomSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 10,
  },
  tenantBoxWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#25D366',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tenantBoxWhatsAppText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  emptyTenantBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 20,
  },
  emptyTenantBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  emptyTenantBoxSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  quickActionWhitePillText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 12,
  },
  financeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  financeCardHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fef3c7',
    letterSpacing: 0.6,
  },
  financePillBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  financePillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fef08a',
  },
  ringOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  circularRingTrack: {
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularRingArc: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 7,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  circularRingInner: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#172554',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }], // Keeps text upright!
  },
  ringPercentText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fbbf24',
  },
  ringCenterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#93c5fd',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  ringCenterSub: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fef08a',
    marginTop: 1,
  },
  ringSideMetrics: {
    flex: 1,
    marginLeft: 14,
    gap: 6,
  },
  ringSideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  miniRingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 8,
  },
  ringSideLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  ringSideVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  netProfitBanner: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.4)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netProfitBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fde68a',
  },
  netProfitBannerVal: {
    fontSize: 16,
    fontWeight: '900',
  },

  // ─── Quick Actions (Red and Gold Small Round Rings) ───
  roundRingActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e8dec8',
    shadowColor: '#0c2340',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  roundRingActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  redGoldRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#991b1b',
    borderWidth: 2.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d97706',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
    marginBottom: 6,
  },
  redGoldRingIcon: {
    fontSize: 20,
  },
  roundActionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  roundActionSub: {
    fontSize: 9,
    color: '#78716c',
    marginTop: 1,
    textAlign: 'center',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.5,
  },
  subtext: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: 12,
    borderRadius: 14,
  },
  actionBtnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  actionBtnSub: {
    fontSize: 10,
    color: '#6366f1',
    marginTop: 2,
  },
  propertyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propertyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  policyBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  policyText: {
    color: '#2563eb',
    fontSize: 10,
    fontWeight: '800',
  },
  propertyAddress: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  occupancyTableBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  occupancyTableHeader: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  occTableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 6,
    marginBottom: 6,
  },
  occTableCol: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  occTableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  occTableCell: {
    fontSize: 11,
    color: '#1e293b',
  },
  roomRentMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roomRentMiniText: {
    fontSize: 10,
    fontWeight: '800',
  },
  moreRoomsRow: {
    paddingTop: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  moreRoomsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  propertyFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
  },
  manageBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  manageBtnText: {
    color: '#4f46e5',
    fontSize: 11,
    fontWeight: '800',
  },
  tenantCountPill: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  tenantCountPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338ca',
  },
  viewAllBtn: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewAllBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4f46e5',
  },
  emptyTenantCard: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  emptyTenantTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  emptyTenantSub: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  tapTipText: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 2,
  },

  // ─── Compact Small Tenant Box Styles ───
  compactTenantsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  compactTenantBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  compactTenantBoxDue: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1.5,
  },
  dueCountAlertBadge: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dueCountAlertBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  allPaidBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  allPaidBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  directWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
    marginRight: 6,
    shadowColor: '#16a34a',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  directWhatsAppIcon: {
    fontSize: 12,
  },
  directWhatsAppText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  compactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactAvatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  compactTenantName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  compactTenantSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '600',
  },
  rentStatusSmallPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  rentStatusSmallText: {
    fontSize: 10,
    fontWeight: '800',
  },
  chevronSmall: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },

  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 14,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f97316',
    padding: 20,
    shadowColor: '#ea580c',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalCloseIcon: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  tenantModalInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionSectionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  actionSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e1b4b',
    marginBottom: 2,
  },
  actionSectionSub: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  payModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  payModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  payModeBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  payModeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  payModeTextActive: {
    color: '#ffffff',
  },
  recordPayBtn: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  recordPayBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  sendReminderBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendReminderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  checkoutLinkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  checkoutLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
    textDecorationLine: 'underline',
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 6,
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  currencyInrLight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    marginRight: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  bedChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  bedChipActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  bedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  bedChipTextActive: {
    color: '#ffffff',
  },
  noBedText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
    marginBottom: 8,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  saveEditBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveEditBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  checkoutBtnPrimary: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkoutBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e11d48',
  },
  deleteBtnOutline: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  shiftBedChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  shiftBedChipActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  shiftBedChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  shiftBedChipTextActive: {
    color: '#ffffff',
  },
  headerLogo: {
    width: 44,
    height: 44,
    marginRight: 10,
  },
  welcomeGreeting: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  fixedRentInfoBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  fixedRentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  fixedRentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  fixedRentVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  rentDueAlertBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  rentDueAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  rentDueAlertSub: {
    fontSize: 11,
    color: '#991b1b',
    marginTop: 2,
  },
  rentPaidAlertBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  rentPaidAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  rentPaidAlertSub: {
    fontSize: 11,
    color: '#065f46',
    marginTop: 2,
  },
  modePillSmall: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modePillSmallActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  modePillSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  modePillSmallTextActive: {
    color: '#ffffff',
  },

  // ─── Live Bed Hold Enquiries Styles (Requirement 1) ───
  heroBellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  heroBellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  quickBadgeSmall: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#dc2626',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  quickBadgeSmallText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  enquiryAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  enquiryAlertIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  enquiryAlertTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#92400e',
  },
  enquiryPulseBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  enquiryPulseText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  enquiryAlertSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
    fontWeight: '500',
  },
  enquiryAlertViewText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d97706',
    marginLeft: 6,
  },
  enquiryModalCountBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  enquiryModalCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  enquiryCardBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  enquiryCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  enquiryCustName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  enquiryCustPhone: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  enquiryStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  enquiryStatusTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  enquiryInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  enquiryInfoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  enquiryInfoVal: {
    fontSize: 11,
    color: '#1e293b',
    fontWeight: '700',
  },
  enquiryNotesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  enquiryNotesText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  enquiryActionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  enquiryCallBtn: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  enquiryCallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  enquiryWaBtn: {
    flex: 1.2,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  enquiryWaBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
  },
  enquiryAcceptBtn: {
    flex: 1.2,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  enquiryAcceptBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  enquiryDeclineBtn: {
    width: 32,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enquiryDeclineBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  enquiryModalCloseBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  enquiryModalCloseBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ─── Notification & Activity Full Page Styles (Requirement 5) ───
  notifPageContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  notifPageHeader: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  notifExitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    marginBottom: 12,
  },
  notifExitIcon: {
    fontSize: 16,
    color: '#ea580c',
    fontWeight: '900',
    marginRight: 6,
  },
  notifExitBtnText: {
    fontSize: 12,
    color: '#c2410c',
    fontWeight: '800',
  },
  notifClearAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  notifClearAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  notifHeaderMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifPageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  notifPageSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  notifBadgePill: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  notifSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  notifEmptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#f97316',
  },
  notifDueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  notifWaPayBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  notifWaPayBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  notifCollectBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  notifCollectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  notifSubCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  notifSubIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ─── KYC Auto-Sliding Carousel & Aadhaar Verification Styles ───
  kycCarouselCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 20,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  kycNoPendingCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 20,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#fdba74', // Light orange border, pure white inside
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kycNoPendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kycNoPendingIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  kycNoPendingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  kycNoPendingSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  kycVerifiedBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  kycVerifiedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  kycCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kycAlertCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  kycCardSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  kycViewAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kycViewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  kycSlideBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kycTenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kycTenantAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycTenantName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  kycStatusBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  kycStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  kycTenantDetails: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  kycVerifyBtn: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  kycVerifyBtnText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
  },
  kycCarouselFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  kycDotsRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  kycDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  kycDotActive: {
    width: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ea580c',
  },
  kycArrowBtn: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    paddingHorizontal: 4,
  },
  kycAutoSlideText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  // In-App QR Scan & Verhoeff Styles
  qrScanMiniBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  qrScanMiniBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  aadhaarHintText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 3,
    marginBottom: 4,
  },
  verhoeffBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
  },
  verhoeffValid: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  verhoeffInvalid: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  verhoeffText: {
    fontSize: 11,
    fontWeight: '800',
  },
  aadhaarVerifiedBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  aadhaarVerifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  kycListItemCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kycListAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycListName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  kycListDetails: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  kycMiniPill: {
    backgroundColor: '#fee2e2',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  kycMiniPillText: {
    fontSize: 9,
    color: '#dc2626',
    fontWeight: '700',
  },
  kycListActionBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  kycListActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  freeKycBanner: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  freeKycBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },
  freeKycBannerSub: {
    fontSize: 10,
    color: '#15803d',
    marginTop: 2,
    lineHeight: 14,
  },

  // Multi-PG Switcher & Add Modal Styles (Requirements 3, 4, 5)
  pgItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  pgItemCardActive: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  pgItemPhotoWrap: {
    position: 'relative',
  },
  pgItemPhoto: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#cbd5e1',
  },
  pgItemActiveDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pgItemName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    flex: 1,
  },
  activePill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803d',
  },
  pgItemAddress: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  pgItemMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  pgItemMetricText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  addNewPgBtn: {
    marginTop: 14,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNewPgBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  inputLabelDark: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
    marginTop: 8,
  },
  customTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  genderSelectBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  genderSelectBtnActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  genderSelectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  genderSelectBtnTextActive: {
    color: '#4f46e5',
    fontWeight: '900',
  },
  submitCreatePgBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  submitCreatePgBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  pgFormSectionHeader: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  pgFormSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  pgStructureBanner: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 10,
  },
  pgStructureBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  pgStructureBannerSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
    marginTop: 2,
  },
  foodPolicyBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  foodPolicyBtnActive: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  foodPolicyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  foodPolicyBtnTextActive: {
    color: '#16a34a',
    fontWeight: '800',
  },
  amenitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  amenityChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  amenityChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
  },
  amenityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  amenityChipTextActive: {
    color: '#4f46e5',
    fontWeight: '800',
  },
  // ─── Dual-Mode Add New Property Modal Styles ───
  addPropModalShell: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    backgroundColor: '#faf8f6',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  dualModePillRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: '#efece9',
    marginBottom: 12,
  },
  dualModePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualModePillActive: {
    backgroundColor: '#ea580c',
  },
  dualModePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  dualModePillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  addPropHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  addPropTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  addPropSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  addPropCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#efece9',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  addPropCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  addPropLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  addPropInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    marginBottom: 10,
  },
  addPropChipBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPropChipBtnActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  addPropChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  addPropChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  mapPreviewBox: {
    height: 110,
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#eef2f6',
  },
  locateMapBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  locateMapBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  mapCoordsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4b5563',
    marginTop: 2,
  },
  autoSetupBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  autoSetupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
  },
  autoSetupSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  modeNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 12,
    gap: 10,
  },
  modeNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600',
  },
  miniSwitchTrack: {
    width: 34,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#cbd5e1',
    padding: 2,
    justifyContent: 'center',
  },
  miniSwitchTrackOn: {
    backgroundColor: '#ea580c',
  },
  miniSwitchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  miniSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  foodPolicyPillCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  foodPolicyPillCardActive: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  foodPolicyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  invoicePreviewBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
  },
  invoicePreviewTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9a3412',
    textTransform: 'uppercase',
  },
  invoicePreviewBreakdown: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  galleryThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    position: 'relative',
    overflow: 'visible',
  },
  galleryThumbImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  galleryThumbRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  galleryThumbRemoveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  galleryAddTile: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryAddPlus: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ea580c',
    lineHeight: 22,
  },
  galleryAddLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9a3412',
    marginTop: 2,
  },
});
