import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  RefreshControl,
} from 'react-native';
import { apiClient } from '../api/client';
import { safeStorage } from '../utils/safeStorage';
import { Tenant, Property, Room, Bed } from '../types';
import { getInitialFloorsForProperty, isValidUuid } from '../services/propertyDataService';
import { computeCollectionMetrics } from '../services/financeSummaryService';
import { validateVerhoeffAadhaar } from '../utils/aadhaar';
import { logActivity } from '../services/activityLogService';
import { emitDataChanged, onDataChanged } from '../utils/appEvents';
import {
  buildRentReminderMessage,
  getOwnerPayoutDetails,
  normalizeIndianPhone,
} from '../services/upiPaymentService';
import {
  getAllMonthlyBills,
  getMonthlyBill,
  getPreviousMonthCurrReading,
  saveMonthlyBill,
  MonthlyBillRecord,
} from '../services/monthlyBillService';
import {
  canSendWhatsAppReminder,
  getMonthlyReminderCount,
  getSubscriptionState,
  incrementMonthlyReminderCount,
  isProActive,
  SubscriptionState,
} from '../services/subscriptionService';
import { SubscriptionPaywallModal } from '../components/modals/SubscriptionPaywallModal';
import { MonthlyInvoiceModal } from '../components/modals/MonthlyInvoiceModal';
import Svg, { Path } from 'react-native-svg';

const WhatsAppLogoIcon = ({ size = 13, color = '#25D366' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM17.85 16.12C17.6 16.82 16.41 17.46 15.83 17.54C15.32 17.61 14.67 17.64 13.96 17.41C13.52 17.27 12.96 17.08 12.24 16.77C9.22 15.46 7.25 12.42 7.1 12.22C6.95 12.02 5.87 10.58 5.87 9.1C5.87 7.62 6.64 6.89 6.92 6.59C7.2 6.29 7.53 6.21 7.73 6.21C7.93 6.21 8.13 6.21 8.31 6.22C8.5 6.23 8.75 6.15 9 6.75C9.25 7.36 9.86 8.86 9.94 9.01C10.02 9.16 10.07 9.34 9.96 9.54C9.85 9.74 9.8 9.86 9.65 10.04C9.5 10.22 9.33 10.44 9.19 10.58C9.04 10.73 8.88 10.9 9.06 11.21C9.24 11.52 9.85 12.52 10.76 13.33C11.93 14.37 12.92 14.7 13.23 14.85C13.54 15 13.72 14.97 13.9 14.77C14.08 14.57 14.67 13.87 14.88 13.56C15.09 13.25 15.3 13.3 15.58 13.41C15.87 13.51 17.4 14.27 17.71 14.42C18.02 14.57 18.23 14.65 18.31 14.78C18.39 14.91 18.39 15.53 17.85 16.12Z"
      fill={color}
    />
  </Svg>
);

const PhoneCallIcon = ({ size = 12, color = '#0f172a' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7293C21.7209 20.9845 21.5573 21.2136 21.3521 21.4019C21.1468 21.5901 20.9046 21.7335 20.6407 21.8227C20.3769 21.9119 20.0974 21.9451 19.82 21.92C16.7428 21.5856 13.787 20.5341 11.19 18.85C8.77382 17.3147 6.72533 15.2662 5.18999 12.85C3.49997 10.2412 2.44824 7.27099 2.11999 4.18C2.095 3.90347 2.12787 3.62476 2.21649 3.36162C2.30512 3.09849 2.44756 2.85669 2.63476 2.65162C2.82196 2.44655 3.0498 2.28271 3.30379 2.17052C3.55777 2.05833 3.83233 2.00026 4.10999 2H7.10999C7.5953 1.99522 8.06579 2.16708 8.43376 2.48353C8.80173 2.79999 9.04207 3.23945 9.10999 3.72C9.23662 4.68007 9.47144 5.62273 9.80999 6.53C9.94454 6.88792 9.97366 7.27691 9.8939 7.65088C9.81415 8.02485 9.62886 8.36811 9.35999 8.64L8.08999 9.91C9.51355 12.4135 11.5864 14.4864 14.09 15.91L15.36 14.64C15.6319 14.3711 15.9751 14.1858 16.3491 14.1061C16.7231 14.0263 17.1121 14.0555 17.47 14.19C18.3773 14.5286 19.3199 14.7634 20.28 14.89C20.7658 14.9585 21.2094 15.2032 21.5265 15.5775C21.8437 15.9518 22.0122 16.4296 22 16.92Z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

interface TenantsScreenProps {
  onBack: () => void;
  selectedPropertyId?: string | null;
  onActivePropertyChange?: (property: Property) => void;
  onNavigateToProfile?: () => void;
}

export const TenantsScreen: React.FC<TenantsScreenProps> = ({
  onBack,
  selectedPropertyId,
  onActivePropertyChange,
  onNavigateToProfile,
}) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'ACTIVE' | 'VACATED'>('ALL');
  const [propertyFilter, setPropertyFilter] = useState<string>(() => {
    if (selectedPropertyId) return selectedPropertyId;
    return 'ALL';
  });

  useEffect(() => {
    const unsub = onDataChanged(() => {
      loadData();
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      setPropertyFilter(selectedPropertyId);
      setSelectedPropId(selectedPropertyId);
      loadRoomsForProperty(selectedPropertyId);
      if (!properties.some((p) => p.id === selectedPropertyId)) {
        loadData();
      }
    }
  }, [selectedPropertyId]);

  // Month & Year Selector (Requirements 6 & 7: Month-wise profit and collection)
  const MONTH_OPTIONS = [
    { label: 'November 2026', value: '2026-11', shortLabel: 'Nov 2026' },
    { label: 'October 2026', value: '2026-10', shortLabel: 'Oct 2026' },
    { label: 'September 2026', value: '2026-09', shortLabel: 'Sep 2026' },
    { label: 'August 2026', value: '2026-08', shortLabel: 'Aug 2026' },
    { label: 'July 2026', value: '2026-07', shortLabel: 'Jul 2026' },
    { label: 'June 2026', value: '2026-06', shortLabel: 'Jun 2026' },
    { label: 'May 2026', value: '2026-05', shortLabel: 'May 2026' },
    { label: 'April 2026', value: '2026-04', shortLabel: 'Apr 2026' },
    { label: 'March 2026', value: '2026-03', shortLabel: 'Mar 2026' },
    { label: 'February 2026', value: '2026-02', shortLabel: 'Feb 2026' },
    { label: 'January 2026', value: '2026-01', shortLabel: 'Jan 2026' },
    { label: 'December 2025', value: '2025-12', shortLabel: 'Dec 2025' },
  ];
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const selectedMonthOption = MONTH_OPTIONS.find((m) => m.value === selectedMonth) || MONTH_OPTIONS[0];

  // Onboard Form State
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idProofType, setIdProofType] = useState<'AADHAAR' | 'PAN'>('AADHAAR');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [showIdDropdown, setShowIdDropdown] = useState(false);

  // Selected Property & Rooms for bed allocation
  const [selectedPropId, setSelectedPropId] = useState<string>('');
  const [propRooms, setPropRooms] = useState<Room[]>([]);
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [fixedRentAmount, setFixedRentAmount] = useState(8500);
  const [fixedDepositAmount, setFixedDepositAmount] = useState(2500);
  const [rentPayingNow, setRentPayingNow] = useState('8500');
  const [depositPayingNow, setDepositPayingNow] = useState('2500');
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().split('T')[0]);
  const [rentCycle, setRentCycle] = useState('1st of every month');
  const [payMode, setPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [rentRupees, setRentRupees] = useState('8500');
  const [depositRupees, setDepositRupees] = useState('8500');
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBillRecord[]>([]);
  const [startingMeterReading, setStartingMeterReading] = useState('0');
  const [billTargetTenant, setBillTargetTenant] = useState<Tenant | null>(null);
  const [billEntryMode, setBillEntryMode] = useState<'METER' | 'DIRECT'>('METER');
  const [billPrevReading, setBillPrevReading] = useState('0');
  const [billCurrReading, setBillCurrReading] = useState('');
  const [billRatePerUnit, setBillRatePerUnit] = useState('8');
  const [billDirectAmount, setBillDirectAmount] = useState('');
  const [billBaseRent, setBillBaseRent] = useState(8500);
  const [billMaintenance, setBillMaintenance] = useState(0);
  const [billPaidAmount, setBillPaidAmount] = useState(0);
  const [savingBill, setSavingBill] = useState(false);
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [waRemindersUsed, setWaRemindersUsed] = useState(0);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formScrollRef = useRef<any>(null);
  const fieldPositions = useRef<Record<string, number>>({});
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    phone?: string;
    idProofNumber?: string;
    bedSelection?: string;
  }>({});

  // Tenant Payment Modal State
  const [selectedTenantForAction, setSelectedTenantForAction] = useState<Tenant | null>(null);
  const [invoiceTenant, setInvoiceTenant] = useState<Tenant | null>(null);
  const [manualPayAmount, setManualPayAmount] = useState('8500');
  const [manualPayMode, setManualPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Edit / Delete Tenant State
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [editTenantName, setEditTenantName] = useState('');
  const [editTenantPhone, setEditTenantPhone] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [editMonthlyRent, setEditMonthlyRent] = useState('8500');
  const [editIdProofType, setEditIdProofType] = useState<'AADHAAR' | 'PAN'>('AADHAAR');
  const [editIdProofNumber, setEditIdProofNumber] = useState('');
  const [showEditIdDropdown, setShowEditIdDropdown] = useState(false);
  const [savingTenantEdit, setSavingTenantEdit] = useState(false);
  const [deletingTenant, setDeletingTenant] = useState(false);

  // Shift / Transfer Bed State
  const [isShiftingBed, setIsShiftingBed] = useState(false);
  const [shiftSelectedBedId, setShiftSelectedBedId] = useState('');
  const [shiftNewRent, setShiftNewRent] = useState('8500');
  const [shiftingBed, setShiftingBed] = useState(false);

  const handleOpenTenantModal = (tenant: Tenant) => {
    setSelectedTenantForAction(tenant);
    setIsEditingTenant(false);
    setIsShiftingBed(false);
    setShiftSelectedBedId('');
    setEditTenantName(tenant.fullName || '');
    setEditTenantPhone(tenant.phone || '');
    setEditEmergencyContact(tenant.emergencyContact || '');
    const initialIdType = (tenant.idProofType === 'PAN' || (tenant.idProof && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(tenant.idProof.trim()))) ? 'PAN' : 'AADHAAR';
    setEditIdProofType(initialIdType);
    setEditIdProofNumber(tenant.idProof || tenant.idProofNumber || '');
    const totalRent = tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 8500;
    const dueRent = typeof tenant.outstandingPaise === 'number'
      ? Math.round(tenant.outstandingPaise / 100)
      : (tenant.rentStatus === 'PAID' ? 0 : totalRent);
    const defaultPay = dueRent > 0 ? String(dueRent) : String(totalRent);
    setEditMonthlyRent(String(totalRent));
    setShiftNewRent(String(totalRent));
    setManualPayAmount(defaultPay);
    setManualPayMode('UPI');
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, billsList, loadedSub, usedCount] = await Promise.all([
        apiClient<{ content: Tenant[] }>('/owner/tenants?size=100').catch(() => ({ content: [] })),
        apiClient<{ content: Property[] }>('/owner/properties?size=100').catch(() => ({ content: [] })),
        getAllMonthlyBills(),
        getSubscriptionState(),
        getMonthlyReminderCount(selectedMonth),
      ]);
      setMonthlyBills(billsList);
      setSubState(loadedSub);
      setWaRemindersUsed(usedCount);
      let loadedTenants = tRes.content || [];
      let loadedProps = pRes.content || [];
      try {
        const storedCustom = await safeStorage.getItem('@staynest_custom_properties');
        if (storedCustom) {
          const parsed = JSON.parse(storedCustom);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const seenIds = new Set(loadedProps.map((p) => p.id));
            const unique = parsed.filter((p: any) => !seenIds.has(p.id));
            loadedProps = [...loadedProps, ...unique];
          }
        }
      } catch {}

      setProperties(loadedProps);

      // Merge locally onboarded custom tenants from safeStorage so they remain ACTIVE with assigned room & bed
      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        if (storedCustomStr) {
          const customList: Tenant[] = JSON.parse(storedCustomStr);
          const customIds = new Set(customList.map((ct) => ct.id));
          loadedTenants = [
            ...customList,
            ...loadedTenants.filter((lt) => !customIds.has(lt.id)),
          ];
        }
      } catch {}

      // Ensure every resident without explicit termination is marked ACTIVE
      loadedTenants = loadedTenants.map((t) => ({
        ...t,
        active: t.stayStatus === 'TERMINATED' ? (t.active !== undefined ? t.active : true) : true,
        stayStatus: t.stayStatus === 'TERMINATED' && t.active === false ? 'TERMINATED' : 'ACTIVE',
      }));

      setTenants(loadedTenants);

      const targetPropId = selectedPropertyId || (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('staynest_active_property_id') : '') || loadedProps[0]?.id;
      if (targetPropId) {
        setSelectedPropId(targetPropId);
        if (!propertyFilter) {
          setPropertyFilter('ALL');
        }
        loadRoomsForProperty(targetPropId);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load data');
    } finally {
      setLoading(false);
    }
  };

  // getInitialFloorsForProperty imported from propertyDataService

  const loadRoomsForProperty = async (propId: string) => {
    try {
      let rooms: Room[] = [];
      // 1. Check locally saved floors first (matches Room Management 1:1)
      let cached: string | null = await safeStorage.getItem(`@staynest_floors_${propId}`).catch(() => null);
      if (!cached && typeof window !== 'undefined' && window.localStorage) {
        cached = window.localStorage.getItem(`staynest_floors_${propId}`);
      }
      if (cached) {
        try {
          const floors = JSON.parse(cached);
          if (Array.isArray(floors)) {
            floors.forEach((f: any) => {
              (f.rooms || []).forEach((r: any) => {
                const rawBeds = Array.isArray(r.beds) && r.beds.length > 0
                  ? r.beds
                  : [{ id: `unit-${r.id}`, bedLabel: 'Unit', status: 'AVAILABLE' }];
                rooms.push({
                  id: r.id,
                  propertyId: propId,
                  roomNumber: r.roomNumber,
                  sharingType: r.sharingType || 'DOUBLE',
                  capacity: rawBeds.length,
                  floorNumber: f.floorNumber,
                  rentMonthlyPaise: (r.rentRupees || 8500) * 100,
                  depositPaise: (r.depositRupees || r.rentRupees || 8500) * 100,
                  status: 'AVAILABLE',
                  beds: rawBeds.map((b: any) => ({
                    id: b.id,
                    roomId: r.id,
                    propertyId: propId,
                    bedLabel: b.bedLabel,
                    status: b.status || 'AVAILABLE',
                  })),
                });
              });
            });
          }
        } catch {
          // ignore
        }
      }

      // 2. Fallback to backend property rooms if nothing cached locally
      if (rooms.length === 0) {
        try {
          const data = await apiClient<Property>(`/properties/${propId}`);
          rooms = data.rooms || [];
        } catch {
          rooms = [];
        }
      }

      // If still empty (e.g. on native mobile), load from default multi-PG floors
      if (rooms.length === 0) {
        const fallbackFloors = getInitialFloorsForProperty(propId);
        fallbackFloors.forEach((f: any) => {
          (f.rooms || []).forEach((r: any) => {
            rooms.push({
              id: r.id,
              propertyId: propId,
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
                propertyId: propId,
                bedLabel: b.bedLabel,
                status: b.status || 'AVAILABLE',
              })),
            });
          });
        });
      }

      setPropRooms(rooms);

      // Find first available vacant bed (not occupied by active tenants)
      const occupiedIds = new Set(
        tenants
          .filter((t) => t.active !== false && t.stayStatus !== 'TERMINATED' && t.propertyId === propId)
          .map((t) => t.bedId)
      );
      for (const r of rooms) {
        const avail = (r.beds || []).find((b) => b.status === 'AVAILABLE' && !occupiedIds.has(b.id));
        if (avail) {
          setSelectedBedId(avail.id);
          setSelectedRoomId(r.id);
          const rentVal = r.rentMonthlyPaise ? r.rentMonthlyPaise / 100 : 8500;
          const depVal = r.depositPaise ? r.depositPaise / 100 : 2500;
          setFixedRentAmount(rentVal);
          setFixedDepositAmount(depVal);
          setRentPayingNow(String(rentVal));
          setDepositPayingNow(String(depVal));
          setRentRupees(String(rentVal));
          setDepositRupees(String(depVal));
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
    setSelectedRoomId('');
    loadRoomsForProperty(propId);
  };

  const handleSelectBed = (bed: Bed, roomId: string, rentPaise?: number, depositPaise?: number) => {
    setSelectedBedId(bed.id);
    setSelectedRoomId(roomId);
    const fixedRent = rentPaise ? rentPaise / 100 : 8500;
    const fixedDep = depositPaise ? depositPaise / 100 : 2500;
    setFixedRentAmount(fixedRent);
    setFixedDepositAmount(fixedDep);
    setRentPayingNow(String(fixedRent));
    setDepositPayingNow(String(fixedDep));
    setRentRupees(String(fixedRent));
    setDepositRupees(String(fixedDep));
  };

  const handleOnboard = async () => {
    const nextErrors: {
      fullName?: string;
      phone?: string;
      idProofNumber?: string;
      bedSelection?: string;
    } = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Resident full name is required';
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      nextErrors.phone = '10-digit phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      nextErrors.phone = 'Enter a valid 10-digit Indian mobile number (starts with 6-9)';
    } else {
      const dupTenant = tenants.find(
        (t) =>
          t.active !== false &&
          t.stayStatus !== 'TERMINATED' &&
          (t.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone
      );
      if (dupTenant) {
        nextErrors.phone = `Active tenant ${dupTenant.fullName} already uses +91 ${cleanPhone}`;
      }
    }

    const cleanId = idProofNumber.replace(/\s+/g, '');
    if (idProofType === 'AADHAAR') {
      if (!cleanId) {
        nextErrors.idProofNumber = '12-digit Aadhaar number is required for KYC';
      } else {
        const aadhaarCheck = validateVerhoeffAadhaar(cleanId);
        if (!aadhaarCheck.isValid) {
          nextErrors.idProofNumber = aadhaarCheck.message || 'Invalid 12-digit UIDAI Aadhaar number';
        }
      }
    } else if (idProofType === 'PAN') {
      if (!cleanId) {
        nextErrors.idProofNumber = '10-character PAN number is required';
      } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanId)) {
        nextErrors.idProofNumber = 'Enter valid PAN format (e.g. ABCDE1234F)';
      }
    }

    if (availableBeds.length > 0 && !selectedBedId) {
      nextErrors.bedSelection = isSelectedAddRentalMode
        ? 'Please select an available flat / unit'
        : 'Please select an available bed';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      const firstKey = (['fullName', 'phone', 'idProofNumber', 'bedSelection'] as const).find(
        (k) => Boolean(nextErrors[k])
      );
      if (firstKey) {
        formScrollRef.current?.scrollTo({
          y: Math.max(0, (fieldPositions.current[firstKey] || 0) - 16),
          animated: true,
        });
      }
      return;
    }

    const payingRentCheck = Number(rentPayingNow || 0);
    if (fixedRentAmount > 0 && payingRentCheck > fixedRentAmount) {
      Alert.alert(
        'Invalid Rent Amount',
        `Rent Amount Paying Now (₹${payingRentCheck.toLocaleString('en-IN')}) cannot exceed the locked Monthly Rent (₹${fixedRentAmount.toLocaleString('en-IN')}).`
      );
      return;
    }
    const payingDepositCheck = Number(depositPayingNow || 0);
    if (fixedDepositAmount > 0 && payingDepositCheck > fixedDepositAmount) {
      Alert.alert(
        'Invalid Deposit Amount',
        `Security Deposit Paying Now (₹${payingDepositCheck.toLocaleString('en-IN')}) cannot exceed the locked Security Deposit (₹${fixedDepositAmount.toLocaleString('en-IN')}).`
      );
      return;
    }

    setFormErrors({});

    setSubmitting(true);
    try {
      const fixedRent = fixedRentAmount || 8500;
      const payingNow = Number(rentPayingNow || 0);
      const rentDue = Math.max(0, fixedRent - payingNow);
      const depositPaying = Number(depositPayingNow || fixedDepositAmount || 2500);

      // 1. Create Tenant Profile in backend (with seamless local fallback)
      let tenant: any = null;
      try {
        tenant = await apiClient<Tenant>('/owner/tenants', {
          method: 'POST',
          body: JSON.stringify({
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
            idProofType,
            idProofNumber: idProofNumber.trim() || 'NOT_PROVIDED',
          }),
        });
      } catch (tenantErr: any) {
        console.log('Backend tenant sync notice (using local provision):', tenantErr.message);
      }

      const tenantId = tenant?.id || `tenant-${Date.now()}`;

      let targetRoomId = selectedRoomId;
      if (!targetRoomId && selectedBedId) {
        for (const r of propRooms) {
          if ((r.beds || []).some((b) => b.id === selectedBedId)) {
            targetRoomId = r.id;
            break;
          }
        }
      }

      // 2. Allocate Bed/Unit if selected with the fixed rent (only for real backend UUIDs)
      if ((selectedBedId || targetRoomId) && selectedPropId && isValidUuid(selectedPropId) && isValidUuid(tenantId)) {
        const stayPayload: Record<string, any> = {
          propertyId: selectedPropId,
          monthlyRentPaise: fixedRent * 100,
          securityDepositPaise: depositPaying * 100,
          checkIn: dateOfJoining || new Date().toISOString().split('T')[0],
        };
        if (targetRoomId && isValidUuid(targetRoomId)) stayPayload.roomId = targetRoomId;
        if (selectedBedId && isValidUuid(selectedBedId)) stayPayload.bedId = selectedBedId;

        if (stayPayload.bedId || stayPayload.roomId) {
          try {
            await apiClient(`/owner/tenants/${tenantId}/stays`, {
              method: 'POST',
              body: JSON.stringify(stayPayload),
            });
          } catch (stayErr: any) {
            console.log('Stay allocation notice:', stayErr.message);
          }
        }

        // 3. Create monthly rent invoice with fixed rent
        const currentMonth = new Date().toISOString().slice(0, 7);
        const todayDate = new Date().toISOString().split('T')[0];
        try {
          const invoice = await apiClient<any>('/owner/rent-invoices', {
            method: 'POST',
            body: JSON.stringify({
              tenantId: tenantId,
              propertyId: selectedPropId,
              billingMonth: currentMonth,
              rentAmountPaise: fixedRent * 100,
              dueDate: todayDate,
            }),
          });

          // 4. Record initial payment if paid (> 0)
          if (payingNow > 0 && invoice?.id) {
            await apiClient(`/owner/rent-invoices/${invoice.id}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: payingNow * 100,
                paymentMethod: payMode,
                notes: rentDue > 0
                  ? `Partial onboarding rent paid ₹${payingNow}. Remaining ₹${rentDue} due.`
                  : 'Full rent paid at onboarding.',
              }),
            }).catch(() => { });
          }
        } catch {
          if (payingNow > 0) {
            await apiClient(`/owner/tenants/${tenantId}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: payingNow * 100,
                paymentMethod: payMode,
              }),
            }).catch(() => { });
          }
        }
      }

      const createdTenantId = tenantId;
      const cleanId = idProofNumber.replace(/\s+/g, '');
      const isAadhaarValid = idProofType === 'AADHAAR' && cleanId.length === 12 && validateVerhoeffAadhaar(cleanId).isValid;
      const isPanValid = idProofType === 'PAN' && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(cleanId);
      const isKycVerified = isAadhaarValid || isPanValid;

      const selectedAddProp = properties.find((p) => p.id === selectedPropId);
      const isAddRental = selectedAddProp?.propertyType === 'RENTAL_BUILDING';
      const targetRoomObj = propRooms.find((r) => r.id === targetRoomId);

      const newTenantRecord: Tenant = {
        id: createdTenantId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        idProofType,
        idProofNumber: idProofNumber.trim() || '--',
        idProof: idProofNumber.trim() || undefined,
        aadhaarVerified: isKycVerified,
        kycStatus: isKycVerified ? 'VERIFIED' : 'PENDING',
        propertyId: selectedPropId,
        propertyName: selectedAddProp?.name || 'StayNest PG',
        roomId: targetRoomId,
        roomNumber: targetRoomObj?.roomNumber || '101',
        bedId: selectedBedId || `unit-${targetRoomId}`,
        bedLabel: isAddRental
          ? 'Unit'
          : (propRooms.flatMap((r) => r.beds || []).find((b) => b.id === selectedBedId)?.bedLabel || 'Bed 1'),
        monthlyRentPaise: fixedRent * 100,
        outstandingPaise: rentDue * 100,
        rentStatus: rentDue === 0 ? 'PAID' : (payingNow > 0 ? 'PARTIALLY_PAID' : 'DUE'),
        active: true,
        stayStatus: 'ACTIVE',
        checkIn: dateOfJoining || new Date().toISOString().split('T')[0],
        rentCycle: rentCycle || '1st of every month',
        createdAt: new Date().toISOString(),
        ...(startingMeterReading ? { startingMeterReading: Number(startingMeterReading) || 0 } : {}),
      } as Tenant;

      // Persist newly onboarded resident to local safeStorage
      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        const customList: Tenant[] = storedCustomStr ? JSON.parse(storedCustomStr) : [];
        const mergedCustom = [newTenantRecord, ...customList.filter((ct) => ct.id !== createdTenantId && ct.phone !== phone.trim())];
        await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(mergedCustom));

        await logActivity({
          propertyId: selectedPropId,
          type: 'TENANT_ADDED',
          title: `${fullName.trim()} added to ${isAddRental ? 'Flat' : 'Room'} ${newTenantRecord.roomNumber}`,
          subtitle: isAddRental ? (targetRoomObj?.sharingType || 'Flat Unit') : (newTenantRecord.bedLabel || 'Bed 1'),
          amountRupees: payingNow > 0 ? payingNow : undefined,
        });

        emitDataChanged();

        if (isKycVerified) {
          await safeStorage.setItem(`staynest_kyc_${createdTenantId}`, 'VERIFIED');
          if (idProofType === 'AADHAAR') {
            await safeStorage.setItem(`staynest_aadhaar_${createdTenantId}`, cleanId);
          } else {
            await safeStorage.setItem(`staynest_pan_${createdTenantId}`, cleanId);
          }
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(`staynest_kyc_${createdTenantId}`, 'VERIFIED');
            if (idProofType === 'AADHAAR') {
              window.localStorage.setItem(`staynest_aadhaar_${createdTenantId}`, cleanId);
            } else {
              window.localStorage.setItem(`staynest_pan_${createdTenantId}`, cleanId);
            }
          }
        }
      } catch {}

      setTenants((prev) => [newTenantRecord, ...prev.filter((t) => t.id !== createdTenantId)]);

      const alertMsg = rentDue > 0
        ? `${fullName} onboarded! Rent received ₹${payingNow.toLocaleString('en-IN')}. Remaining ₹${rentDue.toLocaleString('en-IN')} marked as DUE.`
        : `${fullName} successfully onboarded as a resident!`;

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`✓ ${alertMsg}`);
      } else {
        Alert.alert('✓ Success', alertMsg);
      }

      setShowForm(false);
      setFullName('');
      setPhone('');
      setEmail('');
      setIdProofNumber('');
      setSelectedBedId('');
      setSelectedRoomId('');
      setRentPayingNow('8500');
      setDepositPayingNow('2500');
      setDateOfJoining(new Date().toISOString().split('T')[0]);
      setRentCycle('1st of every month');
      loadData();
    } catch (err: any) {
      Alert.alert('Onboarding Notice', err.message || 'Could not onboard tenant');
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  // Record Manual Rent Payment
  const handleRecordManualPayment = async () => {
    if (!selectedTenantForAction) return;
    setRecordingPayment(true);
    const payAmount = Number(manualPayAmount || 0);
    const totalRent = selectedTenantForAction.monthlyRentPaise
      ? Math.round(selectedTenantForAction.monthlyRentPaise / 100)
      : 8500;
    const currentDue = typeof selectedTenantForAction.outstandingPaise === 'number'
      ? Math.round(selectedTenantForAction.outstandingPaise / 100)
      : (selectedTenantForAction.rentStatus === 'PAID' ? 0 : totalRent);
    const newDue = Math.max(0, currentDue - payAmount);
    const newStatus = newDue === 0 ? 'PAID' : (newDue < totalRent ? 'PARTIALLY_PAID' : 'DUE');

    try {
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountPaidPaise: payAmount * 100,
          paymentMethod: manualPayMode,
          paymentDate: new Date().toISOString().split('T')[0],
          notes: newDue > 0 ? `Paid ₹${payAmount}. Remaining ₹${newDue} due.` : `Paid ₹${payAmount} in full.`,
        }),
      }).catch(() => { });

      // Immediately update local state
      setTenants((prev) =>
        prev.map((t) => {
          if (t.id !== selectedTenantForAction.id) return t;
          return {
            ...t,
            outstandingPaise: newDue * 100,
            rentStatus: newStatus,
          };
        })
      );

      const msg = newDue === 0
        ? `Payment of ₹${payAmount.toLocaleString('en-IN')} recorded! Rent for ${selectedTenantForAction.fullName} is fully paid.`
        : `Payment of ₹${payAmount.toLocaleString('en-IN')} recorded! Remaining due for ${selectedTenantForAction.fullName} is ₹${newDue.toLocaleString('en-IN')}.`;

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`✓ ${msg}`);
      } else {
        Alert.alert('✓ Payment Recorded!', msg);
      }

      setSelectedTenantForAction(null);
    } catch {
      setSelectedTenantForAction(null);
    } finally {
      setRecordingPayment(false);
    }
  };

  const openBillModalForTenant = (tenant: Tenant) => {
    const existing = getMonthlyBill(monthlyBills, tenant.id, selectedMonth);
    const baseRent = existing?.baseRent ?? (tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 8500);
    const maint = existing?.maintenanceAmount ?? 0;
    const prevR = existing?.prevReading ?? getPreviousMonthCurrReading(
      monthlyBills,
      tenant.id,
      selectedMonth,
      (tenant as any).startingMeterReading || 0
    );
    const paidAmt = existing?.paidAmount ?? (tenant.rentStatus === 'PAID' ? baseRent : Math.max(0, baseRent - (typeof tenant.outstandingPaise === 'number' ? Math.round(tenant.outstandingPaise / 100) : baseRent)));

    setBillTargetTenant(tenant);
    setBillEntryMode(existing?.isDirectAmount ? 'DIRECT' : 'METER');
    setBillPrevReading(String(prevR));
    setBillCurrReading(existing?.currReading ? String(existing.currReading) : '');
    setBillRatePerUnit(String(existing?.ratePerUnit ?? 8));
    setBillDirectAmount(existing?.electricityAmount ? String(existing.electricityAmount) : '');
    setBillBaseRent(baseRent);
    setBillMaintenance(maint);
    setBillPaidAmount(paidAmt);
  };

  const handleSaveMonthlyBill = async () => {
    if (!billTargetTenant) return;
    setSavingBill(true);
    try {
      const prevR = Number(billPrevReading || 0);
      const currR = Number(billCurrReading || prevR);
      const rate = Number(billRatePerUnit || 8);
      const units = billEntryMode === 'DIRECT' ? 0 : Math.max(0, currR - prevR);
      const elecAmt = billEntryMode === 'DIRECT'
        ? Math.max(0, Number(billDirectAmount || 0))
        : Math.round(units * rate);
      const totalPayable = billBaseRent + elecAmt + billMaintenance;
      const pending = Math.max(0, totalPayable - billPaidAmount);
      const status: 'PAID' | 'PARTIALLY_PAID' | 'DUE' =
        pending === 0 ? 'PAID' : billPaidAmount > 0 ? 'PARTIALLY_PAID' : 'DUE';

      const newBill: MonthlyBillRecord = {
        id: `bill-${billTargetTenant.id}-${selectedMonth}`,
        tenancyId: billTargetTenant.id,
        propertyId: billTargetTenant.propertyId,
        billingMonth: selectedMonth,
        prevReading: prevR,
        currReading: billEntryMode === 'DIRECT' ? prevR : currR,
        units,
        ratePerUnit: rate,
        electricityAmount: elecAmt,
        baseRent: billBaseRent,
        maintenanceAmount: billMaintenance,
        totalPayable,
        paidAmount: billPaidAmount,
        status,
        isDirectAmount: billEntryMode === 'DIRECT',
        updatedAt: new Date().toISOString(),
      };

      const updatedBills = await saveMonthlyBill(newBill);
      setMonthlyBills(updatedBills);

      // Update tenant outstandingPaise & status in local state + storage
      setTenants((prev) =>
        prev.map((t) =>
          t.id === billTargetTenant.id
            ? { ...t, outstandingPaise: pending * 100, rentStatus: status }
            : t
        )
      );
      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        const customList: Tenant[] = storedCustomStr ? JSON.parse(storedCustomStr) : [];
        const target = billTargetTenant;
        const updatedCustom = [
          { ...target, outstandingPaise: pending * 100, rentStatus: status },
          ...customList.filter((ct) => ct.id !== target.id),
        ];
        await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(updatedCustom));
      } catch {}

      setBillTargetTenant(null);
      Alert.alert(
        '✓ Monthly Bill Saved',
        `Electricity: ₹${elecAmt.toLocaleString('en-IN')} • Total Payable: ₹${totalPayable.toLocaleString('en-IN')}`
      );
    } finally {
      setSavingBill(false);
    }
  };

  // Universal WhatsApp Reminder (All PG & Rental Building properties, targets pending_due > 0)
  const handleDirectWhatsAppReminder = async (tenant: Tenant) => {
    const monthBill = getMonthlyBill(monthlyBills, tenant.id, selectedMonth);
    const baseRent = monthBill?.baseRent ?? (tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 8500);
    const electricityAmt = monthBill?.electricityAmount ?? 0;
    const maintenanceAmt = monthBill?.maintenanceAmount ?? 0;
    const totalPayable = monthBill ? monthBill.totalPayable : baseRent;
    const paidAmt = monthBill
      ? monthBill.paidAmount
      : Math.max(
          0,
          baseRent -
            (typeof tenant.outstandingPaise === 'number'
              ? Math.round(tenant.outstandingPaise / 100)
              : tenant.rentStatus === 'PAID'
                ? 0
                : baseRent)
        );
    const dueRent = Math.max(0, totalPayable - paidAmt);

    if (dueRent <= 0) {
      Alert.alert('✓ Fully Paid', `${tenant.fullName} has ₹0 pending due for ${selectedMonthOption?.label || selectedMonth}.`);
      return;
    }

    const currentSub = subState || (await getSubscriptionState());
    const quota = await canSendWhatsAppReminder(currentSub, selectedMonth);
    if (!quota.allowed) {
      setShowPaywallModal(true);
      return;
    }

    const payout = await getOwnerPayoutDetails();
    const clean91Phone = normalizeIndianPhone(tenant.phone);
    const propObj = properties.find((p) => p.id === tenant.propertyId);
    const isRentalProp = propObj?.propertyType === 'RENTAL_BUILDING' || tenant.bedLabel === 'Unit';
    const roomLabel = isRentalProp
      ? `Flat ${tenant.roomNumber || '101'}`
      : `Room ${tenant.roomNumber || '101'} (${tenant.bedLabel || 'Bed 1'})`;

    const dispatchWhatsApp = async (upiIdToUse?: string) => {
      const nextCount = await incrementMonthlyReminderCount(selectedMonth);
      setWaRemindersUsed(nextCount);
      const message = buildRentReminderMessage({
        tenantName: tenant.fullName,
        propertyName: tenant.propertyName || propObj?.name || 'StayNest',
        roomLabel,
        monthYear: selectedMonthOption?.label || 'November 2026',
        roomRent: baseRent,
        units: monthBill?.units || 0,
        electricity: electricityAmt,
        maintenance: maintenanceAmt,
        totalDue: dueRent,
        ownerUpiId: upiIdToUse,
        ownerName: payout.accountHolderName || tenant.propertyName || 'StayNest Owner',
      });

      const waUrl = `https://wa.me/${clean91Phone}?text=${encodeURIComponent(message)}`;
      Linking.openURL(waUrl).catch(() =>
        Alert.alert('WhatsApp Unavailable', `Could not open WhatsApp for +${clean91Phone}.`)
      );
    };

    if (!payout.upiId) {
      Alert.alert(
        'Add Your UPI ID',
        'Add your UPI ID in Profile to include a direct payment link in WhatsApp reminders.',
        [
          ...(onNavigateToProfile
            ? [{ text: 'Go to Profile', onPress: () => onNavigateToProfile() }]
            : []),
          { text: 'Send Anyway', onPress: () => dispatchWhatsApp('') },
        ]
      );
      return;
    }

    dispatchWhatsApp(payout.upiId);
  };

  // Send Rent Reminder Modal / Prompt
  const handleSendReminder = async (tenant: Tenant) => {
    const totalRent = tenant.monthlyRentPaise ? Math.round(tenant.monthlyRentPaise / 100) : 8500;
    const dueRent = typeof tenant.outstandingPaise === 'number'
      ? Math.round(tenant.outstandingPaise / 100)
      : (tenant.rentStatus === 'PAID' ? 0 : totalRent);

    if (dueRent <= 0) {
      Alert.alert('No Pending Due', `${tenant.fullName} has ₹0 pending due. Payment reminders are only sent when due > ₹0.`);
      return;
    }

    const payout = await getOwnerPayoutDetails();
    const propObj = properties.find((p) => p.id === tenant.propertyId);
    const isRentalProp = propObj?.propertyType === 'RENTAL_BUILDING' || tenant.bedLabel === 'Unit';
    const roomLabel = isRentalProp
      ? `Flat ${tenant.roomNumber || '101'}`
      : `Room ${tenant.roomNumber || '101'} (${tenant.bedLabel || 'Bed 1'})`;

    const message = buildRentReminderMessage({
      tenantName: tenant.fullName,
      propertyName: tenant.propertyName || propObj?.name || 'StayNest',
      roomLabel,
      monthYear: selectedMonthOption?.label || 'Nov 2026',
      roomRent: totalRent,
      totalDue: dueRent,
      ownerUpiId: payout.upiId,
      ownerName: payout.accountHolderName || tenant.propertyName || 'StayNest Owner',
    });

    Alert.alert(
      'Payment Reminder',
      `Send ₹${dueRent.toLocaleString('en-IN')} reminder${payout.upiId ? ` (with UPI link to ${payout.upiId})` : ''} to ${tenant.fullName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send via WhatsApp',
          onPress: () => {
            const cleanPhone = tenant.phone.replace(/[^0-9]/g, '');
            const url = `whatsapp://send?phone=+91${cleanPhone}&text=${encodeURIComponent(message)}`;
            Linking.canOpenURL(url)
              .then((supported) => {
                if (supported) Linking.openURL(url);
                else handleDirectWhatsAppReminder(tenant);
              })
              .catch(() => handleDirectWhatsAppReminder(tenant));
          },
        },
        {
          text: 'Send SMS',
          onPress: () => {
            const cleanPhone = tenant.phone.replace(/[^0-9]/g, '');
            const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
            Linking.openURL(smsUrl).catch(() =>
              Alert.alert('✓ SMS Prepared', `Payment reminder ready for ${tenant.phone}.`)
            );
          },
        },
      ]
    );
  };

  // Handle Checkout
  const handleCheckout = (tenant: Tenant) => {
    const doCheckout = async () => {
      // 1. If valid UUID, notify backend (catch errors gracefully without crashing or showing Java error)
      if (isValidUuid(tenant.id)) {
        try {
          await apiClient(`/owner/tenants/${tenant.id}/checkout`, {
            method: 'POST',
          });
        } catch (apiErr: any) {
          console.log('Backend checkout sync note:', apiErr?.message);
        }
      }

      // 2. Seamlessly update local state: mark tenant inactive & vacate bed
      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        if (storedCustomStr) {
          const customList: Tenant[] = JSON.parse(storedCustomStr);
          const updatedCustom = customList.map((ct) =>
            ct.id === tenant.id
              ? { ...ct, active: false, stayStatus: 'TERMINATED', bedId: undefined, roomNumber: undefined }
              : ct
          );
          await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(updatedCustom));
        }
      } catch {}

      setTenants((prev) =>
        prev.map((t) =>
          t.id === tenant.id
            ? { ...t, active: false, stayStatus: 'TERMINATED', bedId: undefined, roomNumber: undefined }
            : t
        )
      );

      // 3. Free up bed in current property room list
      setPropRooms((prevRooms) =>
        prevRooms.map((r) => ({
          ...r,
          beds: (r.beds || []).map((b) =>
            b.id === tenant.bedId ? { ...b, status: 'AVAILABLE' } : b
          ),
        }))
      );

      Alert.alert('✓ Checked Out', `${tenant.fullName} has exited successfully and their bed is now free.`);
      setSelectedTenantForAction(null);
      loadData();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Check out ${tenant.fullName}? This will mark their stay as vacated and immediately free up their bed.`)) {
        doCheckout();
      }
    } else {
      Alert.alert(
        'Confirm Exit / Check-Out',
        `Check out ${tenant.fullName}? This will mark their stay as vacated and immediately free up their bed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Check Out', style: 'destructive', onPress: doCheckout },
        ]
      );
    }
  };

  const handleSaveTenantEdit = async () => {
    if (!selectedTenantForAction) return;
    if (!editTenantName.trim() || !editTenantPhone.trim()) {
      Alert.alert('Required', 'Please enter resident name and phone');
      return;
    }

    const cleanEditId = editIdProofNumber.replace(/\s+/g, '');
    if (editIdProofType === 'AADHAAR' && cleanEditId) {
      const v = validateVerhoeffAadhaar(cleanEditId);
      if (!v.isValid) {
        Alert.alert('Invalid Aadhaar Card', `Aadhaar verification failed: ${v.message}. Please enter a valid 12-digit UIDAI Aadhaar number.`);
        return;
      }
    } else if (editIdProofType === 'PAN' && cleanEditId) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(cleanEditId)) {
        Alert.alert('Invalid PAN Card', 'Please enter a valid 10-character PAN format (e.g. ABCDE1234F).');
        return;
      }
    }

    const isEditAadhaarValid = editIdProofType === 'AADHAAR' && cleanEditId.length === 12 && validateVerhoeffAadhaar(cleanEditId).isValid;
    const isEditPanValid = editIdProofType === 'PAN' && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(cleanEditId);
    const isEditVerified = isEditAadhaarValid || isEditPanValid;

    setSavingTenantEdit(true);
    try {
      await apiClient(`/owner/tenants/${selectedTenantForAction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editTenantName.trim(),
          phone: editTenantPhone.trim(),
          emergencyContact: editEmergencyContact.trim() || null,
          monthlyRentPaise: editMonthlyRent ? Number(editMonthlyRent) * 100 : undefined,
          idProofType: editIdProofType,
          idProofNumber: editIdProofNumber.trim() || undefined,
        }),
      }).catch(() => {});

      if (isEditVerified) {
        try {
          await safeStorage.setItem(`staynest_kyc_${selectedTenantForAction.id}`, 'VERIFIED');
          if (editIdProofType === 'AADHAAR') {
            await safeStorage.setItem(`staynest_aadhaar_${selectedTenantForAction.id}`, cleanEditId);
          } else {
            await safeStorage.setItem(`staynest_pan_${selectedTenantForAction.id}`, cleanEditId);
          }
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(`staynest_kyc_${selectedTenantForAction.id}`, 'VERIFIED');
          }
        } catch {}
      }

      setTenants((prev) =>
        prev.map((t) => {
          if (t.id !== selectedTenantForAction.id) return t;
          return {
            ...t,
            fullName: editTenantName.trim(),
            phone: editTenantPhone.trim(),
            emergencyContact: editEmergencyContact.trim() || undefined,
            monthlyRentPaise: editMonthlyRent ? Number(editMonthlyRent) * 100 : t.monthlyRentPaise,
            idProofType: editIdProofType,
            idProofNumber: editIdProofNumber.trim() || t.idProofNumber,
            idProof: editIdProofNumber.trim() || t.idProof,
            aadhaarVerified: isEditVerified || t.aadhaarVerified,
            kycStatus: isEditVerified ? 'VERIFIED' : t.kycStatus,
          };
        })
      );

      Alert.alert('✓ Saved', 'Resident profile, ID proof and rent updated successfully!');
      setIsEditingTenant(false);
      setSelectedTenantForAction(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update resident');
    } finally {
      setSavingTenantEdit(false);
    }
  };

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

  const handleDeleteTenant = (tenant: Tenant) => {
    const doDelete = async () => {
      setDeletingTenant(true);
      if (isValidUuid(tenant.id)) {
        try {
          await apiClient(`/owner/tenants/${tenant.id}`, {
            method: 'DELETE',
          });
        } catch (apiErr: any) {
          console.log('Backend delete resident note:', apiErr?.message);
        }
      }

      // Seamless local delete
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
      setPropRooms((prevRooms) =>
        prevRooms.map((r) => ({
          ...r,
          beds: (r.beds || []).map((b) =>
            b.id === tenant.bedId ? { ...b, status: 'AVAILABLE' } : b
          ),
        }))
      );

      Alert.alert('✓ Deleted', `${tenant.fullName} has been deleted and bed is now free.`);
      setSelectedTenantForAction(null);
      setDeletingTenant(false);
      loadData();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`⚠️ Are you sure you want to permanently delete ${tenant.fullName}? This will delete their stay records and immediately release their bed back to available.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        '⚠️ Delete Resident?',
        `Are you sure you want to permanently delete ${tenant.fullName}? This will delete their records and immediately release their bed back to available.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Permanently', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const selectedAddPropObj = properties.find((p) => p.id === selectedPropId);
  const isSelectedAddRentalMode = selectedAddPropObj?.propertyType === 'RENTAL_BUILDING';

  // Active occupied bed IDs and room numbers to enforce 1 person = 1 bed (or 1 flat) rule
  const activeOccupiedBedIds = new Set<string>();
  const activeOccupiedRoomNumbers = new Set<string>();
  tenants.forEach((t) => {
    if (
      t.active !== false &&
      t.stayStatus !== 'TERMINATED' &&
      (!selectedPropId || t.propertyId === selectedPropId)
    ) {
      if (t.bedId) activeOccupiedBedIds.add(t.bedId);
      if (t.roomNumber) activeOccupiedRoomNumbers.add(t.roomNumber);
    }
  });

  // Collect vacant beds (PG) or vacant flats/units (Rental Building)
  const availableBeds: {
    bed: Bed;
    roomNumber: string;
    roomId: string;
    unitLabel?: string;
    rentPaise?: number;
    depositPaise?: number;
  }[] = [];
  propRooms.forEach((r) => {
    if (isSelectedAddRentalMode) {
      const anyBedOccupied = (r.beds || []).some(
        (b) => b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id)
      );
      const isFlatOccupied = activeOccupiedRoomNumbers.has(r.roomNumber) || anyBedOccupied;
      if (!isFlatOccupied) {
        const unitBed: Bed = (r.beds && r.beds[0]) || {
          id: `unit-${r.id}`,
          roomId: r.id,
          propertyId: selectedPropId,
          bedLabel: 'Unit',
          status: 'AVAILABLE',
        };
        availableBeds.push({
          bed: unitBed,
          roomNumber: r.roomNumber,
          roomId: r.id,
          unitLabel: r.sharingType || 'Flat',
          rentPaise: r.rentMonthlyPaise,
          depositPaise: r.depositPaise,
        });
      }
    } else {
      (r.beds || []).forEach((b) => {
        const isOccupied = b.status === 'OCCUPIED' || activeOccupiedBedIds.has(b.id);
        if (!isOccupied) {
          availableBeds.push({
            bed: b,
            roomNumber: r.roomNumber,
            roomId: r.id,
            rentPaise: r.rentMonthlyPaise,
            depositPaise: r.depositPaise,
          });
        }
      });
    }
  });

  // Scoped to selected property (matches Dashboard & Room Management 1:1) or ALL
  const propertyScopedTenants = tenants.filter((t) => {
    if (propertyFilter === 'ALL') return true;
    if (t.propertyId === propertyFilter) return true;
    if (!t.propertyId && (properties.length <= 1 || propertyFilter === properties[0]?.id || !properties.some((p) => p.id === propertyFilter))) {
      return true;
    }
    return false;
  });

  // Filtered tenants list
  const filteredTenants = propertyScopedTenants.filter((t) => {
    const isAct = t.active !== false && t.stayStatus !== 'TERMINATED';
    const totalRent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
    const dueRent = typeof t.outstandingPaise === 'number'
      ? Math.round(t.outstandingPaise / 100)
      : (t.rentStatus === 'PAID' ? 0 : totalRent);
    const isDue = dueRent > 0;

    if (statusFilter === 'ACTIVE' && !isAct) return false;
    if (statusFilter === 'VACATED' && isAct) return false;
    if (statusFilter === 'DUE' && (!isAct || !isDue)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.fullName && t.fullName.toLowerCase().includes(q);
      const matchPhone = t.phone && t.phone.includes(q);
      const matchRoom = t.roomNumber && t.roomNumber.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchRoom) return false;
    }

    return true;
  });

  // Single Source of Truth: Month-Wise Collection Calculation
  const activeTenantsList = propertyScopedTenants.filter((t) => t.active !== false && t.stayStatus !== 'TERMINATED');
  const collectionSummary = computeCollectionMetrics(propertyScopedTenants, selectedMonth);
  const monthExpectedRent = collectionSummary.expectedRent;
  const monthCollectedRent = collectionSummary.collectedRent;
  const monthPendingDue = collectionSummary.pendingDue;
  const monthCollectionRate = collectionSummary.collectionRate;

  // Handle Download CSV for Selected Month (Requirements 6 & 7)
  const handleDownloadTenantsCsv = () => {
    try {
      const monthLabel = selectedMonthOption.label;
      const dateStr = new Date().toISOString().split('T')[0];

      let csv = `"STAYNEST PG - RESIDENTS & RENT REPORT"\n`;
      csv += `"Billing Month:","${monthLabel}"\n`;
      csv += `"Exported On:","${dateStr}"\n\n`;

      csv += `"--- MONTH SUMMARY (${monthLabel}) ---"\n`;
      csv += `"Total Active Residents","${activeTenantsList.length}"\n`;
      csv += `"Total Expected Rent (₹)","${monthExpectedRent.toLocaleString('en-IN')}"\n`;
      csv += `"Total Collected (₹)","${monthCollectedRent.toLocaleString('en-IN')}"\n`;
      csv += `"Total Pending Due (₹)","${monthPendingDue.toLocaleString('en-IN')}"\n`;
      csv += `"Collection Rate","${monthCollectionRate}%"\n\n`;

      csv += `"--- RESIDENTS BREAKDOWN ---"\n`;
      csv += `"Tenant Name","Phone","Room Number","Bed","Monthly Rent (₹)","Paid for Month (₹)","Due Amount (₹)","Payment Status","ID Proof"\n`;

      filteredTenants.forEach((t) => {
        const rent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
        const isPaid = selectedMonth === '2026-11' ? t.rentStatus === 'PAID' : true;
        const due = isPaid ? 0 : (t.outstandingPaise ? Math.round(t.outstandingPaise / 100) : rent);
        const paid = Math.max(0, rent - due);
        const status = isPaid ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'DUE');

        csv += `"${t.fullName}","${t.phone}","Room ${t.roomNumber || '101'}","${t.bedLabel || 'Bed 1'}","${rent}","${paid}","${due}","${status}","${t.idProofType || 'AADHAAR'}: ${t.idProofNumber || '--'}"\n`;
      });

      const fileName = `StayNest_Tenants_${selectedMonth}_Report.csv`;

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('✓ Download Complete', `Exported ${fileName} to your downloads!`);
      } else {
        Alert.alert('Download Complete', `File: ${fileName}\n\nSummary for ${monthLabel}:\n• Collected: ₹${monthCollectedRent.toLocaleString('en-IN')}\n• Due: ₹${monthPendingDue.toLocaleString('en-IN')}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not export CSV');
    }
  };

  // ─── SEPARATE PAGE: ONBOARD NEW RESIDENT (WITH BACK BUTTON) ───
  if (showForm) {
    return (
      <View style={styles.separatePageContainer}>
        {/* Top Header with Back Button */}
        <View style={styles.separatePageHeader}>
          <TouchableOpacity
            style={styles.separatePageBackBtn}
            onPress={() => {
              setShowForm(false);
              setFullName('');
              setPhone('');
              setEmail('');
              setIdProofNumber('');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.separatePageBackBtnText}>← Back to Tenants</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center', marginRight: 30 }}>
            <Text style={styles.separatePageHeaderTitle}>Onboard Resident</Text>
            <Text style={styles.separatePageHeaderSub}>
              {isSelectedAddRentalMode ? 'Assign flat, fixed rent & rent cycle' : 'Assign bed, fixed rent & rent cycle'}
            </Text>
          </View>
        </View>

        <ScrollView
          ref={formScrollRef}
          style={styles.separatePageContent}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Property Selector */}
          {properties.length > 1 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>🏢 1. SELECT PG PROPERTY *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {properties.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.propChip,
                      selectedPropId === p.id && styles.propChipSelected,
                    ]}
                    onPress={() => handlePropertySelect(p.id)}
                  >
                    <Text
                      style={[
                        styles.propChipText,
                        selectedPropId === p.id && styles.propChipTextSelected,
                      ]}
                    >
                      🏢 {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 2. Resident Name & Phone */}
          <View
            style={{ marginBottom: 14 }}
            onLayout={(e) => {
              fieldPositions.current.fullName = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.fieldLabel, formErrors.fullName && { color: '#dc2626' }]}>
              👤 RESIDENT FULL NAME *
            </Text>
            <TextInput
              style={[
                styles.input,
                formErrors.fullName && { borderColor: '#dc2626', backgroundColor: '#fef2f2', borderWidth: 1.5 },
              ]}
              value={fullName}
              onChangeText={(val) => {
                setFullName(val);
                if (formErrors.fullName) setFormErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="e.g. Anand Kumar"
              placeholderTextColor="#94a3b8"
            />
            {formErrors.fullName && (
              <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                ⚠️ {formErrors.fullName}
              </Text>
            )}
          </View>

          <View
            style={{ marginBottom: 14 }}
            onLayout={(e) => {
              fieldPositions.current.phone = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.fieldLabel, formErrors.phone && { color: '#dc2626' }]}>
              📱 PHONE NUMBER (10 DIGITS) *
            </Text>
            <TextInput
              style={[
                styles.input,
                formErrors.phone && { borderColor: '#dc2626', backgroundColor: '#fef2f2', borderWidth: 1.5 },
              ]}
              value={phone}
              onChangeText={(val) => {
                const digitsOnly = val.replace(/\D/g, '');
                if (digitsOnly.length > 10) {
                  setPhone(digitsOnly.slice(0, 10));
                  setFormErrors((prev) => ({ ...prev, phone: 'Maximum 10 digits allowed' }));
                  return;
                }
                setPhone(digitsOnly);
                if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              keyboardType="phone-pad"
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94a3b8"
              maxLength={10}
            />
            {formErrors.phone && (
              <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                ⚠️ {formErrors.phone}
              </Text>
            )}
          </View>

          {/* 3. Government ID Proof Type (Dropdown for Aadhaar & PAN) */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>🪪 GOVERNMENT ID PROOF TYPE *</Text>
            <TouchableOpacity
              style={styles.idDropdownTrigger}
              onPress={() => setShowIdDropdown((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16 }}>{idProofType === 'AADHAAR' ? '🪪' : '💳'}</Text>
                <Text style={styles.idDropdownTriggerText}>
                  {idProofType === 'AADHAAR' ? 'Aadhaar Card (12-Digit UIDAI)' : 'PAN Card (10-Char Income Tax ID)'}
                </Text>
              </View>
              <Text style={styles.idDropdownArrow}>{showIdDropdown ? '▴' : '▾'}</Text>
            </TouchableOpacity>

            {showIdDropdown && (
              <View style={styles.idDropdownMenu}>
                <TouchableOpacity
                  style={[styles.idDropdownItem, idProofType === 'AADHAAR' && styles.idDropdownItemActive]}
                  onPress={() => {
                    setIdProofType('AADHAAR');
                    setIdProofNumber('');
                    setShowIdDropdown(false);
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🪪</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.idDropdownItemTitle, idProofType === 'AADHAAR' && styles.idDropdownItemTitleActive]}>
                      Aadhaar Card (Default)
                    </Text>
                    <Text style={styles.idDropdownItemSub}>12-digit UIDAI Government ID</Text>
                  </View>
                  {idProofType === 'AADHAAR' && <Text style={{ color: '#ea580c', fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.idDropdownItem, idProofType === 'PAN' && styles.idDropdownItemActive]}
                  onPress={() => {
                    setIdProofType('PAN');
                    setIdProofNumber('');
                    setShowIdDropdown(false);
                  }}
                >
                  <Text style={{ fontSize: 16 }}>💳</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.idDropdownItemTitle, idProofType === 'PAN' && styles.idDropdownItemTitleActive]}>
                      PAN Card
                    </Text>
                    <Text style={styles.idDropdownItemSub}>10-character Income Tax ID</Text>
                  </View>
                  {idProofType === 'PAN' && <Text style={{ color: '#ea580c', fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ID Number input with validity feedback */}
          <View
            style={{ marginBottom: 14 }}
            onLayout={(e) => {
              fieldPositions.current.idProofNumber = e.nativeEvent.layout.y;
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.fieldLabel, formErrors.idProofNumber && { color: '#dc2626' }]}>
                {idProofType === 'AADHAAR' ? 'AADHAAR NUMBER (12 DIGITS) *' : 'PAN CARD NUMBER (10 CHARS) *'}
              </Text>
              {(() => {
                const clean = idProofNumber.replace(/\s+/g, '');
                if (!clean) return null;
                if (idProofType === 'AADHAAR') {
                  const v = validateVerhoeffAadhaar(clean);
                  return (
                    <Text style={{ fontSize: 11, fontWeight: '800', color: v.isValid ? '#16a34a' : '#ea580c' }}>
                      {v.isValid ? '✓ Valid Aadhaar' : `⚠️ ${v.message}`}
                    </Text>
                  );
                } else {
                  const isValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean);
                  return (
                    <Text style={{ fontSize: 11, fontWeight: '800', color: isValid ? '#16a34a' : '#ea580c' }}>
                      {isValid ? '✓ Valid PAN' : (clean.length < 10 ? `⚠️ ${10 - clean.length} chars needed` : '⚠️ Invalid PAN')}
                    </Text>
                  );
                }
              })()}
            </View>

            <TextInput
              style={[
                styles.input,
                formErrors.idProofNumber && { borderColor: '#dc2626', backgroundColor: '#fef2f2', borderWidth: 1.5 },
              ]}
              value={idProofNumber}
              onChangeText={(val) => {
                if (formErrors.idProofNumber) setFormErrors((prev) => ({ ...prev, idProofNumber: undefined }));
                if (idProofType === 'AADHAAR') {
                  const digits = val.replace(/\D/g, '').slice(0, 12);
                  const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                  setIdProofNumber(formatted);
                } else {
                  const pan = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                  setIdProofNumber(pan);
                }
              }}
              placeholder={idProofType === 'AADHAAR' ? 'e.g. 5489 1234 5678' : 'e.g. ABCDE1234F'}
              placeholderTextColor="#94a3b8"
              keyboardType={idProofType === 'AADHAAR' ? 'number-pad' : 'default'}
              maxLength={idProofType === 'AADHAAR' ? 14 : 10}
              autoCapitalize={idProofType === 'PAN' ? 'characters' : 'none'}
            />
            {formErrors.idProofNumber && (
              <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                ⚠️ {formErrors.idProofNumber}
              </Text>
            )}
          </View>

          {/* 4. Select Available Bed / Flat Unit */}
          <View
            onLayout={(e) => {
              fieldPositions.current.bedSelection = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.fieldLabel, { marginTop: 4 }, formErrors.bedSelection && { color: '#dc2626' }]}>
              {isSelectedAddRentalMode
                ? `🏠 SELECT AVAILABLE FLAT / UNIT (${availableBeds.length} Vacant) *`
                : `🛏️ SELECT AVAILABLE BED (${availableBeds.length} Free) *`}
            </Text>
          {availableBeds.length === 0 ? (
            <Text style={styles.noBedWarn}>
              {isSelectedAddRentalMode
                ? 'No vacant flats or units available in this property. Configure floors/units under Rooms.'
                : 'No free beds available in this property. Configure rooms/beds under Properties.'}
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bedScroll}>
              {availableBeds.map(({ bed, roomNumber, roomId, unitLabel, rentPaise, depositPaise }) => {
                const isSelected = selectedBedId === bed.id;
                return (
                  <TouchableOpacity
                    key={bed.id}
                    style={[styles.bedPickChip, isSelected && styles.bedPickChipSelected]}
                    onPress={() => handleSelectBed(bed, roomId, rentPaise, depositPaise)}
                  >
                    <Text style={[styles.bedPickText, isSelected && styles.bedPickTextSelected]}>
                      {isSelectedAddRentalMode
                        ? `🏠 Flat ${roomNumber}${unitLabel ? ` • ${unitLabel}` : ''}`
                        : `Room ${roomNumber} • ${bed.bedLabel}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {formErrors.bedSelection && (
            <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
              ⚠️ {formErrors.bedSelection}
            </Text>
          )}
          </View>

          {/* 5. FIXED DEPOSIT & RENT (READ-ONLY LOCKED BOX - REQUIREMENT 3) */}
          <View style={styles.lockedRentCard}>
            <View style={styles.lockedRentRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>🔒</Text>
                <Text style={styles.lockedRentTitle}>Fixed Monthly Rent:</Text>
              </View>
              <Text style={styles.lockedRentVal}>₹{fixedRentAmount.toLocaleString('en-IN')} / mo</Text>
            </View>

            <View style={[styles.lockedRentRow, { marginTop: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>🔒</Text>
                <Text style={styles.lockedRentTitle}>Fixed Security Deposit:</Text>
              </View>
              <Text style={styles.lockedRentVal}>₹{fixedDepositAmount.toLocaleString('en-IN')}</Text>
            </View>
            <Text style={styles.lockedRentNotice}>
              {isSelectedAddRentalMode
                ? '🔒 Fixed amounts are locked based on selected Flat / Unit.'
                : '🔒 Fixed amounts are locked based on selected Room & Bed.'}
            </Text>
          </View>

          {/* 6. EDITABLE PAYMENTS - ONLY WHAT HE IS PAYING (REQUIREMENT 3) */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>💵 RENT AMOUNT PAYING NOW (₹) *</Text>
            <View style={styles.currencyInputRow}>
              <Text style={styles.currencyInrLight}>₹</Text>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 10, marginBottom: 0, backgroundColor: 'transparent', letterSpacing: 0 }]}
                value={rentPayingNow}
                onChangeText={(v) => setRentPayingNow(v.replace(/\D/g, ''))}
                keyboardType="numeric"
                placeholder={String(fixedRentAmount)}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* Dynamic Rent Due Indicator */}
          {(() => {
            const paying = Number(rentPayingNow || 0);
            const due = Math.max(0, fixedRentAmount - paying);
            if (fixedRentAmount > 0 && paying > fixedRentAmount) {
              return (
                <View style={[styles.rentDueAlertBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.rentDueAlertTitle, { color: '#dc2626' }]}>
                    ⚠️ AMOUNT EXCEEDS LOCKED RENT (₹{fixedRentAmount.toLocaleString('en-IN')})
                  </Text>
                  <Text style={[styles.rentDueAlertSub, { color: '#b91c1c' }]}>
                    Entered ₹{paying.toLocaleString('en-IN')} is more than the locked rent. Please enter ₹{fixedRentAmount.toLocaleString('en-IN')} or less.
                  </Text>
                </View>
              );
            }
            if (due > 0) {
              return (
                <View style={styles.rentDueAlertBox}>
                  <Text style={styles.rentDueAlertTitle}>
                    ⚠️ REMAINING RENT DUE: ₹{due.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.rentDueAlertSub}>
                    Resident pays ₹{paying.toLocaleString('en-IN')} today. Remaining ₹{due.toLocaleString('en-IN')} will be marked as DUE.
                  </Text>
                </View>
              );
            } else if (paying === fixedRentAmount && fixedRentAmount > 0) {
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

          {/* Security Deposit Paying Now */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>🛡️ SECURITY DEPOSIT PAYING NOW (₹) *</Text>
            <View style={styles.currencyInputRow}>
              <Text style={styles.currencyInrLight}>₹</Text>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 10, marginBottom: 0, backgroundColor: 'transparent', letterSpacing: 0 }]}
                value={depositPayingNow}
                onChangeText={(v) => setDepositPayingNow(v.replace(/\D/g, ''))}
                keyboardType="numeric"
                placeholder={String(fixedDepositAmount)}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* Starting Meter Reading (Optional) */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>⚡ STARTING METER READING (kWh - OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={startingMeterReading}
              onChangeText={(v) => setStartingMeterReading(v.replace(/\D/g, ''))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* Payment Mode */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>💳 INITIAL PAYMENT MODE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.modePillLarge,
                    payMode === mode && styles.modePillLargeActive,
                  ]}
                  onPress={() => setPayMode(mode)}
                >
                  <Text style={[styles.modePillLargeText, payMode === mode && styles.modePillLargeTextActive]}>
                    {mode === 'BANK_TRANSFER' ? '🏦 Bank Transfer' : mode === 'UPI' ? '📱 UPI' : '💵 Cash'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 7. DATE OF JOINING & RENT CYCLE (REQUIREMENT 4) */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>📅 DATE OF JOINING (CHECK-IN) *</Text>
            <TextInput
              style={styles.input}
              value={dateOfJoining}
              onChangeText={setDateOfJoining}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
            {/* Quick date chips */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {[
                { label: 'Today', val: new Date().toISOString().split('T')[0] },
                { label: 'Tomorrow', val: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
                { label: '1st of Next Month', val: `${new Date().getFullYear()}-${String(new Date().getMonth() + 2).padStart(2, '0')}-01` },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  style={[styles.quickDatePill, dateOfJoining === chip.val && styles.quickDatePillActive]}
                  onPress={() => setDateOfJoining(chip.val)}
                >
                  <Text style={[styles.quickDatePillText, dateOfJoining === chip.val && styles.quickDatePillTextActive]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text style={styles.fieldLabel}>🔄 MONTHLY RENT CYCLE (DUE DATE) *</Text>
            <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
              Select which day of the month rent is due for this resident:
            </Text>
            <View style={{ gap: 6 }}>
              {[
                { label: '1st of every month (Standard)', val: '1st of every month' },
                { label: '5th of every month', val: '5th of every month' },
                { label: '10th of every month', val: '10th of every month' },
                { label: `Same day as joining (${dateOfJoining.split('-')[2] || 'Day'}th of every month)`, val: `Day of joining (${dateOfJoining.split('-')[2] || '1'})` },
              ].map((cycle) => (
                <TouchableOpacity
                  key={cycle.val}
                  style={[styles.cycleOptionCard, rentCycle === cycle.val && styles.cycleOptionCardActive]}
                  onPress={() => setRentCycle(cycle.val)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.cycleRadioCircle, rentCycle === cycle.val && styles.cycleRadioCircleActive]}>
                    {rentCycle === cycle.val && <View style={styles.cycleRadioInner} />}
                  </View>
                  <Text style={[styles.cycleOptionText, rentCycle === cycle.val && styles.cycleOptionTextActive]}>
                    {cycle.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={styles.cancelFormBtn}
              onPress={() => {
                setShowForm(false);
                setFormErrors({});
                setFullName('');
                setPhone('');
                setEmail('');
                setIdProofNumber('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelFormBtnText} numberOfLines={1}>← Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, { flex: 2 }, submitting && { opacity: 0.6 }]}
              onPress={handleOnboard}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText} numberOfLines={1}>
                {submitting
                  ? 'Onboarding...'
                  : isSelectedAddRentalMode
                    ? '✓ Onboard & Assign Flat'
                    : '✓ Onboard & Assign Bed'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { flexShrink: 0 }]} onPress={onBack}>
          <Text style={styles.backBtnText}>← Home</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center', marginHorizontal: 8 }]} numberOfLines={1}>
          Tenant Management
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { flexShrink: 0 }]}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.addBtnText}>+ Onboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#ea580c', '#3b82f6']}
            tintColor="#ea580c"
          />
        }
      >
        {/* ─── Month Filter Bar & Executive Summary ─── */}
        <View style={styles.monthHeaderBar}>
          <TouchableOpacity
            style={styles.monthDropdownBtn}
            onPress={() => setShowMonthPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13 }}>📅</Text>
            <Text style={styles.monthDropdownText}>{selectedMonthOption.label}</Text>
            <Text style={styles.monthDropdownArrow}>▾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportReportBtn}
            onPress={handleDownloadTenantsCsv}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13 }}>📥</Text>
            <Text style={styles.exportReportBtnText}>Download CSV</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Month Financial Executive Summary ─── */}
        <View style={styles.monthSummaryCard}>
          <View style={styles.monthSummaryHeader}>
            <Text style={styles.monthSummaryTitle}>
              {selectedMonthOption.label} Collection
            </Text>
            <View style={styles.monthSummaryBadge}>
              <Text style={styles.monthSummaryBadgeText}>
                {monthCollectionRate}% Collected
              </Text>
            </View>
          </View>

          {/* Collection Progress Bar */}
          <View style={styles.collectionProgressBg}>
            <View
              style={[
                styles.collectionProgressFill,
                { width: `${Math.min(100, Math.max(0, monthCollectionRate))}%` },
              ]}
            />
          </View>

          <View style={styles.monthSummaryGrid}>
            <View style={styles.monthSummaryItem}>
              <Text style={styles.monthSummarySub}>EXPECTED</Text>
              <Text style={styles.monthSummaryVal}>₹{monthExpectedRent.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.summaryVerticalDivider} />
            <View style={styles.monthSummaryItem}>
              <Text style={styles.monthSummarySub}>COLLECTED</Text>
              <Text style={styles.monthSummaryVal}>
                ₹{monthCollectedRent.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.summaryVerticalDivider} />
            <View style={styles.monthSummaryItem}>
              <Text style={styles.monthSummarySub}>PENDING DUE</Text>
              <Text style={styles.monthSummaryVal}>
                ₹{monthPendingDue.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Property Scope Selector (Synced with Dashboard) ─── */}
        {properties.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {properties.map((p) => {
              const isSelected = propertyFilter === p.id;
              const propCount = tenants.filter(
                (t) => (t.propertyId === p.id || (!t.propertyId && p.id === 'prop-pg-1')) && t.active !== false && t.stayStatus !== 'TERMINATED'
              ).length;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    setPropertyFilter(p.id);
                    setSelectedPropId(p.id);
                    loadRoomsForProperty(p.id);
                    onActivePropertyChange?.(p);
                  }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isSelected ? '#1e293b' : '#ffffff',
                    borderWidth: 1,
                    borderColor: isSelected ? '#1e293b' : '#e5e7eb',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isSelected ? '#ffffff' : '#374151',
                    }}
                  >
                    {p.name} ({propCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setPropertyFilter('ALL')}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: propertyFilter === 'ALL' ? '#1e293b' : '#ffffff',
                borderWidth: 1,
                borderColor: propertyFilter === 'ALL' ? '#1e293b' : '#e5e7eb',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: propertyFilter === 'ALL' ? '#ffffff' : '#374151',
                }}
              >
                All PGs ({tenants.filter((t) => t.active !== false && t.stayStatus !== 'TERMINATED').length})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ─── Search & Filter Bar ─── */}
        <View style={styles.searchBarBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search resident by name, phone or room..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Segment Tabs: All vs Due vs Active vs Vacated */}
        <View style={styles.statusFilterRow}>
          {(['ALL', 'DUE', 'ACTIVE', 'VACATED'] as const).map((tab) => {
            const count =
              tab === 'ALL'
                ? propertyScopedTenants.length
                : tab === 'DUE'
                  ? collectionSummary.rentDueCount
                  : tab === 'ACTIVE'
                    ? propertyScopedTenants.filter((t) => t.active !== false && t.stayStatus !== 'TERMINATED').length
                    : propertyScopedTenants.filter((t) => t.active === false || t.stayStatus === 'TERMINATED').length;

            const label =
              tab === 'ALL'
                ? `All (${count})`
                : tab === 'DUE'
                  ? `Rent Due (${count})`
                  : tab === 'ACTIVE'
                    ? `Active (${count})`
                    : `Vacated (${count})`;

            const isActiveTab = statusFilter === tab;

            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.statusFilterBtn,
                  isActiveTab ? styles.statusFilterBtnActive : styles.statusFilterBtnInactive,
                ]}
                onPress={() => setStatusFilter(tab)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.statusFilterText,
                    isActiveTab ? styles.statusFilterTextActive : styles.statusFilterTextInactive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Freemium WhatsApp Reminder Usage Pill */}
        {subState && !isProActive(subState) ? (
          <TouchableOpacity
            onPress={() => setShowPaywallModal(true)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: waRemindersUsed >= 5 ? '#fef2f2' : '#fff7ed',
              borderWidth: 1,
              borderColor: waRemindersUsed >= 5 ? '#fecaca' : '#fed7aa',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: waRemindersUsed >= 5 ? '#dc2626' : '#9a3412' }}>
              💬 {Math.min(waRemindersUsed, 5)}/5 Free Reminders Used This Month
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#ea580c' }}>
              Upgrade Pro →
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* List of Tenants */}
        {loading ? (
          <ActivityIndicator color="#ea580c" style={{ marginVertical: 40 }} />
        ) : filteredTenants.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 26, marginBottom: 8 }}>📋</Text>
            <Text style={styles.emptyTitle}>No Matching Tenants Found</Text>
            <Text style={styles.emptySub}>
              {statusFilter === 'DUE'
                ? 'All residents are up-to-date! No pending rent dues.'
                : statusFilter === 'ACTIVE'
                  ? 'No active residents found. Tap "+ Onboard" to register a tenant.'
                  : 'No records matching your search/filter.'}
            </Text>
          </View>
        ) : (
          filteredTenants.map((t) => {
            const isAct = t.active !== false && t.stayStatus !== 'TERMINATED';
            const monthBill = getMonthlyBill(monthlyBills, t.id, selectedMonth);
            const baseRent = monthBill?.baseRent ?? (t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500);
            const electricityAmt = monthBill?.electricityAmount ?? 0;
            const totalRent = monthBill ? monthBill.totalPayable : baseRent;
            const paidRent = monthBill
              ? monthBill.paidAmount
              : Math.max(
                  0,
                  baseRent -
                    (typeof t.outstandingPaise === 'number'
                      ? Math.round(t.outstandingPaise / 100)
                      : t.rentStatus === 'PAID'
                        ? 0
                        : baseRent)
                );
            const dueRent = Math.max(0, totalRent - paidRent);
            const isPaidFull = dueRent === 0;

            const initials = t.fullName
              ? t.fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
              : 'TN';

            return (
              <TouchableOpacity
                key={t.id}
                style={styles.tenantCard}
                onPress={() => handleOpenTenantModal(t)}
                activeOpacity={0.85}
              >
                {/* Zone 1: Header with Avatar, Name, Phone, and Status Pill */}
                <View style={styles.tenantHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.tenantName}>{t.fullName}</Text>
                    <View style={styles.phoneRow}>
                      <Text style={{ fontSize: 13, marginRight: 4 }}>📱</Text>
                      <Text style={styles.tenantPhone}>{t.phone}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.statusPill,
                      isAct
                        ? (isPaidFull ? styles.statusPillPaid : styles.statusPillDue)
                        : styles.statusPillVacated,
                    ]}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      setInvoiceTenant(t);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isAct
                          ? (isPaidFull ? styles.statusPillTextPaid : styles.statusPillTextDue)
                          : styles.statusPillTextVacated,
                      ]}
                    >
                      {isAct ? (isPaidFull ? 'PAID' : 'DUE') : 'VACATED'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Zone 2: Two-column metadata row for Property and Room/Bed */}
                <View style={styles.metaRow}>
                  <View style={[styles.metaCol, { flex: 1.25, paddingRight: 8 }]}>
                    <View style={styles.metaLabelRow}>
                      <Text style={styles.metaLabel}>PROPERTY</Text>
                      <Text style={{ fontSize: 11, marginLeft: 4 }}>🏠</Text>
                    </View>
                    <Text style={styles.metaVal} numberOfLines={2}>
                      {t.propertyName || 'Sai Durga Executive Ladies PG'}
                    </Text>
                  </View>

                  <View style={[styles.metaCol, { flex: 0.9 }]}>
                    {(() => {
                      const tProp = properties.find((p) => p.id === t.propertyId);
                      const isRentalTenant = tProp?.propertyType === 'RENTAL_BUILDING' || t.bedLabel === 'Unit';
                      return (
                        <>
                          <View style={styles.metaLabelRow}>
                            <Text style={styles.metaLabel}>{isRentalTenant ? 'FLAT / UNIT' : 'ROOM & BED'}</Text>
                            <Text style={{ fontSize: 11, marginLeft: 4 }}>{isRentalTenant ? '🏠' : '🛏️'}</Text>
                          </View>
                          <Text style={styles.metaVal} numberOfLines={2}>
                            {isAct
                              ? isRentalTenant
                                ? `Flat ${t.roomNumber || '101'}`
                                : `Room ${t.roomNumber || '101'} • ${t.bedLabel || 'Bed 1'}`
                              : 'Not Assigned (Vacated)'}
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                </View>

                {/* Zone 3: Inset tinted financial summary box (#F9FAFB) */}
                <View style={styles.financialInsetBox}>
                  <View style={styles.financialGrid}>
                    <View style={styles.financialCol}>
                      <Text style={styles.financialLabel}>TOTAL RENT</Text>
                      <Text style={styles.financialVal}>₹{totalRent.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.financialDivider} />
                    <View style={styles.financialCol}>
                      <Text style={styles.financialLabel}>PAID</Text>
                      <Text style={styles.financialVal}>₹{paidRent.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.financialDivider} />
                    <View style={styles.financialCol}>
                      <Text style={styles.financialLabel}>DUE PENDING</Text>
                      <Text
                        style={[
                          styles.financialVal,
                          dueRent > 0 && { color: '#ea580c' },
                        ]}
                      >
                        {isPaidFull ? '₹0 (Clear)' : `₹${dueRent.toLocaleString('en-IN')}`}
                      </Text>
                    </View>
                  </View>

                  {isPaidFull && (
                    <View style={styles.fullyPaidBadge}>
                      <Text style={styles.fullyPaidBadgeText}>✓ Fully Paid</Text>
                    </View>
                  )}

                  {isAct && (
                    <TouchableOpacity
                      style={{
                        marginTop: 8,
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: monthBill ? '#fff7ed' : '#f1f5f9',
                        borderWidth: 1,
                        borderColor: monthBill ? '#fdba74' : '#e2e8f0',
                        alignSelf: 'flex-start',
                      }}
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        openBillModalForTenant(t);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: monthBill ? '#ea580c' : '#334155' }}>
                        {monthBill
                          ? `⚡ Current Bill (${monthBill.units}u): ₹${electricityAmt.toLocaleString('en-IN')} • Edit`
                          : '+ Add Current Bill'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Zone 4: Refined Action Row (No Overlap on Small Phones) */}
                <View style={styles.actionRow}>
                  <Text
                    style={styles.aadhaarText}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    AADHAAR: {t.idProofNumber || '--'}
                  </Text>

                  {isAct && (
                    <View style={styles.actionBtnsGroup}>
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          const cleanNum = (t.phone || '').replace(/[^0-9+]/g, '');
                          if (cleanNum) {
                            Linking.openURL(`tel:${cleanNum}`).catch(() =>
                              Alert.alert('Cannot Call', `Could not open dialer for ${t.phone}`)
                            );
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <PhoneCallIcon size={11} color="#0f172a" />
                        <Text style={styles.callBtnText}>Call</Text>
                      </TouchableOpacity>

                      {dueRent > 0 ? (
                        <TouchableOpacity
                          style={styles.whatsAppCircleBtn}
                          onPress={(e: any) => {
                            e?.stopPropagation?.();
                            handleDirectWhatsAppReminder(t);
                          }}
                          activeOpacity={0.8}
                        >
                          <WhatsAppLogoIcon size={14} color="#ffffff" />
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={{
                            backgroundColor: '#ecfdf5',
                            borderWidth: 1,
                            borderColor: '#a7f3d0',
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#059669' }}>✓ Paid</Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.exitBtn}
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleCheckout(t);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.exitBtnText}>Exit</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      {/* Modal: Full Resident Actions (Pay, Remind, Edit, Check Out, Delete) */}
      <Modal
        visible={!!selectedTenantForAction}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTenantForAction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>{selectedTenantForAction?.fullName}</Text>
                <Text style={styles.modalSub}>
                  Room {selectedTenantForAction?.roomNumber || '101'} • {selectedTenantForAction?.bedLabel || 'Bed 1'} • {selectedTenantForAction?.propertyName || 'Ramesh PG'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedTenantForAction(null)}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Tenant Summary Banner */}
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
                    {selectedTenantForAction?.rentStatus === 'PAID'
                      ? '🟢 Paid'
                      : `🔴 Payment Due: ₹${selectedTenantForAction?.outstandingPaise ? (selectedTenantForAction.outstandingPaise / 100).toLocaleString('en-IN') : (selectedTenantForAction?.monthlyRentPaise ? (selectedTenantForAction.monthlyRentPaise / 100).toLocaleString('en-IN') : '0')}`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: '#ea580c',
                  borderRadius: 12,
                  paddingVertical: 11,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
                onPress={() => {
                  const target = selectedTenantForAction;
                  setSelectedTenantForAction(null);
                  if (target) setInvoiceTenant(target);
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }}>
                  🧾 Open Monthly Rent & Utility Invoice
                </Text>
              </TouchableOpacity>

              {/* ACTION SECTION 1: LOCKED RECEIPT WHEN PAID OR RECORD PAYMENT WHEN DUE > 0 */}
              {(() => {
                const tModalBill = selectedTenantForAction
                  ? getMonthlyBill(monthlyBills, selectedTenantForAction.id, selectedMonth)
                  : undefined;
                const tModalBaseRent = tModalBill?.baseRent ?? (selectedTenantForAction?.monthlyRentPaise
                  ? Math.round(selectedTenantForAction.monthlyRentPaise / 100)
                  : 8500);
                const tModalTotal = tModalBill ? tModalBill.totalPayable : tModalBaseRent;
                const tModalPaid = tModalBill
                  ? tModalBill.paidAmount
                  : Math.max(
                      0,
                      tModalBaseRent -
                        (typeof selectedTenantForAction?.outstandingPaise === 'number'
                          ? Math.round(selectedTenantForAction.outstandingPaise / 100)
                          : selectedTenantForAction?.rentStatus === 'PAID'
                            ? 0
                            : tModalBaseRent)
                    );
                const tModalDue = Math.max(0, tModalTotal - tModalPaid);
                const isSettled = tModalDue === 0;

                if (isSettled) {
                  return (
                    <View
                      style={[
                        styles.actionSectionBox,
                        { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1 },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={[styles.actionSectionTitle, { color: '#065f46' }]}>
                          ✓ Rent Settled (Read-Only)
                        </Text>
                        <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#15803d' }}>LOCKED</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: '#047857', fontWeight: '700', marginBottom: 10 }}>
                        Paid Amount: ₹{tModalTotal.toLocaleString('en-IN')} • Status: Paid in Full
                      </Text>
                      <TouchableOpacity
                        style={[styles.recordPayBtn, { backgroundColor: '#059669' }]}
                        onPress={() => {
                          const target = selectedTenantForAction;
                          setSelectedTenantForAction(null);
                          if (target) setInvoiceTenant(target);
                        }}
                      >
                        <Text style={styles.recordPayBtnText}>🧾 View / Share Receipt</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View style={styles.actionSectionBox}>
                    <Text style={styles.actionSectionTitle}>💰 Record Rent Payment</Text>
                    <Text style={styles.actionSectionSub}>Record money received from resident</Text>

                    <Text style={styles.label}>Amount Received (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={manualPayAmount}
                      onChangeText={setManualPayAmount}
                      keyboardType="numeric"
                      placeholder="8500"
                    />

                    <Text style={styles.label}>Payment Mode</Text>
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
                );
              })()}

              {/* ACTION SECTION 2: SEND RENT REMINDER */}
              <View style={styles.actionSectionBox}>
                <Text style={styles.actionSectionTitle}>🔔 Send Payment Reminder</Text>
                <Text style={styles.actionSectionSub}>Send WhatsApp or SMS rent reminder</Text>

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

                      <Text style={styles.label}>SELECT VACANT BED</Text>
                      {availableBeds.filter((b) => b.bed.id !== selectedTenantForAction?.bedId).length === 0 ? (
                        <Text style={{ fontSize: 12, color: '#dc2626', marginVertical: 6 }}>
                          No vacant beds available in the PG property.
                        </Text>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 12 }}>
                          {availableBeds
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

                      <Text style={styles.label}>MONTHLY RENT FOR NEW BED (₹)</Text>
                      <TextInput
                        style={styles.input}
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
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                      style={styles.input}
                      value={editTenantName}
                      onChangeText={setEditTenantName}
                      placeholder="e.g. Rahul Sharma"
                    />

                    <Text style={styles.label}>Mobile Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={editTenantPhone}
                      onChangeText={setEditTenantPhone}
                      keyboardType="phone-pad"
                      placeholder="9876543210"
                    />

                    <Text style={styles.label}>Monthly Rent (₹)</Text>
                    <TextInput
                      style={styles.input}
                      value={editMonthlyRent}
                      onChangeText={setEditMonthlyRent}
                      keyboardType="numeric"
                      placeholder="8500"
                    />

                    <Text style={styles.label}>Emergency Contact</Text>
                    <TextInput
                      style={styles.input}
                      value={editEmergencyContact}
                      onChangeText={setEditEmergencyContact}
                      keyboardType="phone-pad"
                      placeholder="9876500000"
                    />

                    {/* ID Proof Type Dropdown Selector */}
                    <View style={{ marginBottom: 12 }}>
                      <Text style={styles.label}>GOVERNMENT ID PROOF TYPE</Text>
                      <TouchableOpacity
                        style={styles.idDropdownTrigger}
                        onPress={() => setShowEditIdDropdown((prev) => !prev)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 16 }}>{editIdProofType === 'AADHAAR' ? '🪪' : '💳'}</Text>
                          <Text style={styles.idDropdownTriggerText}>
                            {editIdProofType === 'AADHAAR' ? 'Aadhaar Card (12-Digit UIDAI)' : 'PAN Card (10-Char Income Tax ID)'}
                          </Text>
                        </View>
                        <Text style={styles.idDropdownArrow}>{showEditIdDropdown ? '▴' : '▾'}</Text>
                      </TouchableOpacity>

                      {showEditIdDropdown && (
                        <View style={styles.idDropdownMenu}>
                          <TouchableOpacity
                            style={[
                              styles.idDropdownItem,
                              editIdProofType === 'AADHAAR' && styles.idDropdownItemActive,
                            ]}
                            onPress={() => {
                              setEditIdProofType('AADHAAR');
                              setEditIdProofNumber('');
                              setShowEditIdDropdown(false);
                            }}
                          >
                            <Text style={{ fontSize: 16 }}>🪪</Text>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={[styles.idDropdownItemTitle, editIdProofType === 'AADHAAR' && styles.idDropdownItemTitleActive]}>
                                Aadhaar Card (Default)
                              </Text>
                              <Text style={styles.idDropdownItemSub}>12-digit UIDAI Government ID</Text>
                            </View>
                            {editIdProofType === 'AADHAAR' && <Text style={{ color: '#ea580c', fontWeight: '900' }}>✓</Text>}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.idDropdownItem,
                              editIdProofType === 'PAN' && styles.idDropdownItemActive,
                            ]}
                            onPress={() => {
                              setEditIdProofType('PAN');
                              setEditIdProofNumber('');
                              setShowEditIdDropdown(false);
                            }}
                          >
                            <Text style={{ fontSize: 16 }}>💳</Text>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={[styles.idDropdownItemTitle, editIdProofType === 'PAN' && styles.idDropdownItemTitleActive]}>
                                PAN Card
                              </Text>
                              <Text style={styles.idDropdownItemSub}>10-character Income Tax ID</Text>
                            </View>
                            {editIdProofType === 'PAN' && <Text style={{ color: '#ea580c', fontWeight: '900' }}>✓</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={styles.label}>
                          {editIdProofType === 'AADHAAR' ? 'Aadhaar Number (12 Digits)' : 'PAN Card Number (10 Chars)'}
                        </Text>
                        {(() => {
                          const clean = editIdProofNumber.replace(/\s+/g, '');
                          if (!clean) return null;
                          if (editIdProofType === 'AADHAAR') {
                            const v = validateVerhoeffAadhaar(clean);
                            return (
                              <Text style={{ fontSize: 11, fontWeight: '800', color: v.isValid ? '#16a34a' : '#ea580c' }}>
                                {v.isValid ? '✓ Valid Aadhaar' : `⚠️ ${v.message}`}
                              </Text>
                            );
                          } else {
                            const isValid = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean);
                            return (
                              <Text style={{ fontSize: 11, fontWeight: '800', color: isValid ? '#16a34a' : '#ea580c' }}>
                                {isValid ? '✓ Valid PAN' : (clean.length < 10 ? `⚠️ ${10 - clean.length} chars needed` : '⚠️ Invalid PAN')}
                              </Text>
                            );
                          }
                        })()}
                      </View>
                      <TextInput
                        style={[
                          styles.input,
                          (() => {
                            const clean = editIdProofNumber.replace(/\s+/g, '');
                            if (!clean) return null;
                            if (editIdProofType === 'AADHAAR') {
                              return validateVerhoeffAadhaar(clean).isValid
                                ? { borderColor: '#16a34a', borderWidth: 1.5 }
                                : { borderColor: '#ea580c', borderWidth: 1.5 };
                            } else {
                              return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean)
                                ? { borderColor: '#16a34a', borderWidth: 1.5 }
                                : { borderColor: '#ea580c', borderWidth: 1.5 };
                            }
                          })(),
                        ]}
                        value={editIdProofNumber}
                        onChangeText={(val) => {
                          if (editIdProofType === 'AADHAAR') {
                            const digits = val.replace(/\D/g, '').slice(0, 12);
                            const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
                            setEditIdProofNumber(formatted);
                          } else {
                            const pan = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                            setEditIdProofNumber(pan);
                          }
                        }}
                        placeholder={editIdProofType === 'AADHAAR' ? 'e.g. 5489 1234 5678' : 'e.g. ABCDE1234F'}
                        keyboardType={editIdProofType === 'AADHAAR' ? 'number-pad' : 'default'}
                        maxLength={editIdProofType === 'AADHAAR' ? 14 : 10}
                        autoCapitalize={editIdProofType === 'PAN' ? 'characters' : 'none'}
                      />
                    </View>

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
                    Tap 'Edit Details' above to update resident's name, phone, monthly rent or emergency contact.
                  </Text>
                )}
              </View>

              {/* ACTION SECTION 5: CHECK OUT OR DELETE RESIDENT */}
              <View style={{ marginTop: 12, gap: 10 }}>
                {selectedTenantForAction?.active !== false && selectedTenantForAction?.stayStatus !== 'TERMINATED' && (
                  <TouchableOpacity
                    style={styles.checkoutBtnPrimary}
                    onPress={() => selectedTenantForAction && handleCheckout(selectedTenantForAction)}
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

      {/* ─── MODAL 2: MONTH & YEAR PICKER (Requirements 6 & 7) ─── */}
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
                <Text style={styles.modalSub}>View tenant payment status & download report</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)} style={styles.closeBtn}>
                <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '800' }}>✕</Text>
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
              style={styles.modalDoneBtn}
              onPress={() => setShowMonthPicker(false)}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Monthly Electricity / Current Bill Entry Modal */}
      <Modal
        visible={!!billTargetTenant}
        transparent
        animationType="slide"
        onRequestClose={() => setBillTargetTenant(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View>
                <Text style={styles.modalTitle}>⚡ Current Bill ({selectedMonthOption?.label || selectedMonth})</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {billTargetTenant?.fullName} • {billTargetTenant?.roomNumber || '101'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setBillTargetTenant(null)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.modePillLarge, billEntryMode === 'METER' && styles.modePillLargeActive]}
                onPress={() => setBillEntryMode('METER')}
              >
                <Text style={[styles.modePillLargeText, billEntryMode === 'METER' && styles.modePillLargeTextActive]}>
                  Meter Reading
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modePillLarge, billEntryMode === 'DIRECT' && styles.modePillLargeActive]}
                onPress={() => setBillEntryMode('DIRECT')}
              >
                <Text style={[styles.modePillLargeText, billEntryMode === 'DIRECT' && styles.modePillLargeTextActive]}>
                  Direct Amount (₹)
                </Text>
              </TouchableOpacity>
            </View>

            {billEntryMode === 'METER' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>PREV READING</Text>
                    <TextInput
                      style={styles.input}
                      value={billPrevReading}
                      onChangeText={(v) => setBillPrevReading(v.replace(/\D/g, ''))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>CURR READING *</Text>
                    <TextInput
                      style={styles.input}
                      value={billCurrReading}
                      onChangeText={(v) => setBillCurrReading(v.replace(/\D/g, ''))}
                      keyboardType="numeric"
                      placeholder="e.g. 1355"
                    />
                  </View>
                  <View style={{ flex: 0.8 }}>
                    <Text style={styles.fieldLabel}>RATE (₹/u)</Text>
                    <TextInput
                      style={styles.input}
                      value={billRatePerUnit}
                      onChangeText={(v) => setBillRatePerUnit(v.replace(/[^0-9.]/g, ''))}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.fieldLabel}>ELECTRICITY BILL AMOUNT (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={billDirectAmount}
                  onChangeText={(v) => setBillDirectAmount(v.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 1160"
                />
              </View>
            )}

            {(() => {
              const prevR = Number(billPrevReading || 0);
              const currR = Number(billCurrReading || prevR);
              const rate = Number(billRatePerUnit || 8);
              const units = billEntryMode === 'DIRECT' ? 0 : Math.max(0, currR - prevR);
              const elecAmt = billEntryMode === 'DIRECT'
                ? Math.max(0, Number(billDirectAmount || 0))
                : Math.round(units * rate);
              const totalPayable = billBaseRent + elecAmt + billMaintenance;
              return (
                <View style={styles.lockedRentCard}>
                  <View style={styles.lockedRentRow}>
                    <Text style={styles.lockedRentTitle}>Base Rent (Locked):</Text>
                    <Text style={styles.lockedRentVal}>₹{billBaseRent.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[styles.lockedRentRow, { marginTop: 4 }]}>
                    <Text style={styles.lockedRentTitle}>
                      Electricity {billEntryMode === 'METER' ? `(${units} units)` : '(Direct)'}:
                    </Text>
                    <Text style={styles.lockedRentVal}>₹{elecAmt.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[styles.lockedRentRow, { marginTop: 4 }]}>
                    <Text style={styles.lockedRentTitle}>Maintenance:</Text>
                    <Text style={styles.lockedRentVal}>₹{billMaintenance.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={[styles.lockedRentRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#fed7aa' }]}>
                    <Text style={[styles.lockedRentTitle, { fontWeight: '800', color: '#ea580c' }]}>Total Payable:</Text>
                    <Text style={[styles.lockedRentVal, { color: '#ea580c', fontSize: 16 }]}>
                      ₹{totalPayable.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              );
            })()}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.cancelFormBtn, { flex: 1 }]}
                onPress={() => setBillTargetTenant(null)}
              >
                <Text style={styles.cancelFormBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { flex: 1.5 }, savingBill && { opacity: 0.6 }]}
                onPress={handleSaveMonthlyBill}
                disabled={savingBill}
              >
                <Text style={styles.submitBtnText}>{savingBill ? 'Saving...' : 'Save Monthly Bill'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upgrade to Pro Paywall Sheet */}
      <SubscriptionPaywallModal
        visible={showPaywallModal}
        reason="WHATSAPP_LIMIT"
        onClose={() => setShowPaywallModal(false)}
        onActivated={(nextSub) => setSubState(nextSub)}
      />

      {/* Screen 2: Monthly Rent & Utility Invoice Modal */}
      <MonthlyInvoiceModal
        visible={!!invoiceTenant}
        tenant={invoiceTenant}
        onClose={() => setInvoiceTenant(null)}
        onPaymentSuccess={(tenantId) => {
          setTenants((prev) =>
            prev.map((t) =>
              t.id === tenantId
                ? { ...t, rentStatus: 'PAID', outstandingPaise: 0 }
                : t
            )
          );
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
  header: {
    backgroundColor: '#faf8f6',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#efece9',
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#ea580c',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 130,
  },
  monthHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  monthDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  monthDropdownText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  monthDropdownArrow: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
  },
  exportReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  exportReportBtnText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  monthSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#efece9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  monthSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthSummaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  monthSummaryBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  monthSummaryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  collectionProgressBg: {
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    marginVertical: 12,
    overflow: 'hidden',
  },
  collectionProgressFill: {
    height: '100%',
    backgroundColor: '#ea580c',
    borderRadius: 3,
  },
  monthSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthSummaryItem: {
    alignItems: 'flex-start',
    flex: 1,
  },
  summaryVerticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  monthSummarySub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  monthSummaryVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
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
  modalDoneBtn: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modalDoneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  searchBarBox: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    letterSpacing: 0,
    color: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 2,
  },
  statusFilterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  statusFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  statusFilterBtnActive: {
    backgroundColor: '#ea580c',
    borderWidth: 1,
    borderColor: '#ea580c',
  },
  statusFilterBtnInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusFilterTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  statusFilterTextInactive: {
    color: '#374151',
  },
  formCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#f97316',
    shadowColor: '#ea580c',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  formSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  closeFormCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFormCircleText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '900',
  },
  cancelFormBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelFormBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
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
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  currencyInrLight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    marginRight: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  propChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  propChipSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4338ca',
  },
  propChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  propChipTextSelected: {
    color: '#ffffff',
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
    backgroundColor: '#059669',
    borderColor: '#047857',
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
  idDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  idDropdownTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  idDropdownArrow: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ea580c',
  },
  idDropdownMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  idDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  idDropdownItemActive: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 3,
    borderLeftColor: '#fdba74',
  },
  idDropdownItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  idDropdownItemTitleActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  idDropdownItemSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  idProofDropdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  idProofOptionBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idProofOptionBtnActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  idProofOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  idProofOptionTextActive: {
    color: '#ea580c',
    fontWeight: '900',
  },
  submitBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  tenantCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#efece9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ea580c',
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  tenantPhone: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusPillPaid: {
    backgroundColor: '#ecfdf5',
  },
  statusPillDue: {
    backgroundColor: '#fee2e2',
  },
  statusPillVacated: {
    backgroundColor: '#f1f5f9',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPillTextPaid: {
    color: '#059669',
  },
  statusPillTextDue: {
    color: '#dc2626',
  },
  statusPillTextVacated: {
    color: '#64748b',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 10,
    marginBottom: 12,
  },
  metaCol: {
    flex: 1,
  },
  metaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginTop: 3,
  },
  financialInsetBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 12,
  },
  financialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financialCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  financialDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  financialLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  financialVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  fullyPaidBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  fullyPaidBadgeText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  aadhaarText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.3,
    marginRight: 4,
  },
  actionBtnsGroup: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  callBtnText: {
    color: '#0f172a',
    fontSize: 10.5,
    fontWeight: '700',
  },
  whatsAppCircleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  whatsAppBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
  exitBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exitBtnText: {
    color: '#dc2626',
    fontSize: 10.5,
    fontWeight: '700',
  },
  // Legacy aliases
  activeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  detailItem: {
    width: '48%',
  },
  tenantFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  idText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  cardCheckoutBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardCheckoutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#e11d48',
  },
  cardActionBtnPay: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardActionBtnPayText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  cardActionBtnRemind: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardActionBtnRemindText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
  },
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
  actionSectionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#f97316',
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
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#f97316',
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
  tenantModalInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#f97316',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '700',
  },
  sendReminderBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendReminderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
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
  rentFinancialBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    marginBottom: 10,
  },
  rentFinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rentFinCol: {
    flex: 1,
  },
  rentFinLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rentFinValTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  rentFinValPaid: {
    fontSize: 14,
    fontWeight: '900',
    color: '#16a34a',
  },
  rentFinValDue: {
    fontSize: 14,
    fontWeight: '900',
  },
  rentProgressBarBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  rentProgressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  rentProgressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  rentProgressSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  dueAlertMiniTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dueAlertMiniTagText: {
    fontSize: 9,
    fontWeight: '900',
  },
  cardActionBtnPayDue: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardActionBtnPayDueText: {
    color: '#e11d48',
    fontWeight: '800',
    fontSize: 11,
  },
  // Separate Page Styles
  separatePageContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  separatePageHeader: {
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  separatePageBackBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  separatePageBackBtnText: {
    color: '#ea580c',
    fontWeight: '800',
    fontSize: 13,
  },
  separatePageHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  separatePageHeaderSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  separatePageContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  lockedRentCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    marginBottom: 14,
  },
  lockedRentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockedRentTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#9a3412',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  lockedRentVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ea580c',
  },
  lockedRentNotice: {
    fontSize: 11,
    color: '#9a3412',
    marginTop: 10,
    lineHeight: 15,
    fontWeight: '600',
  },
  modePillLarge: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  modePillLargeActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
    borderWidth: 2,
  },
  modePillLargeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  modePillLargeTextActive: {
    color: '#ea580c',
    fontWeight: '900',
  },
  quickDatePill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickDatePillActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  quickDatePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quickDatePillTextActive: {
    color: '#ea580c',
    fontWeight: '900',
  },
  cycleOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  cycleOptionCardActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
    borderWidth: 1.5,
  },
  cycleRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cycleRadioCircleActive: {
    borderColor: '#ea580c',
  },
  cycleRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ea580c',
  },
  cycleOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#344155',
  },
  cycleOptionTextActive: {
    color: '#0f172a',
    fontWeight: '900',
  },
});
