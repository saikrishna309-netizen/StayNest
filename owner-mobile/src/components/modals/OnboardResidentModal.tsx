import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  SafeAreaView,
} from 'react-native';
import { apiClient } from '../../api/client';
import { safeStorage } from '../../utils/safeStorage';
import { Tenant, Property, Room, Bed } from '../../types';
import { getInitialFloorsForProperty, isValidUuid } from '../../services/propertyDataService';
import { validateVerhoeffAadhaar } from '../../utils/aadhaar';
import { logActivity } from '../../services/activityLogService';
import { emitDataChanged } from '../../utils/appEvents';
import { useLanguage } from '../../context/LanguageContext';
import { fastDataCache } from '../../services/dataCache';
import { GlassBackground } from '../glass/GlassBackground';
import { GLASS_TOKENS } from '../glass/GlassCard';
import { showGlassSuccess } from '../glass/GlassSuccessModal';

export interface OnboardResidentModalProps {
  visible: boolean;
  onClose: () => void;
  properties: Property[];
  tenants: Tenant[];
  initialPropertyId?: string | null;
  initialRoomId?: string;
  initialBedId?: string;
  initialRentRupees?: number;
  initialDepositRupees?: number;
  onSuccess?: (newTenant: Tenant) => void;
}

export const OnboardResidentModal: React.FC<OnboardResidentModalProps> = ({
  visible,
  onClose,
  properties,
  tenants,
  initialPropertyId,
  initialRoomId,
  initialBedId,
  initialRentRupees,
  initialDepositRupees,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idProofType, setIdProofType] = useState<'AADHAAR' | 'PAN'>('AADHAAR');
  const [idProofNumber, setIdProofNumber] = useState('');
  const [showIdDropdown, setShowIdDropdown] = useState(false);

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
  const [startingMeterReading, setStartingMeterReading] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [liveTenants, setLiveTenants] = useState<Tenant[]>(tenants);

  useEffect(() => {
    setLiveTenants(tenants);
  }, [tenants]);

  const formScrollRef = useRef<any>(null);
  const fieldPositions = useRef<Record<string, number>>({});
  const [formErrors, setFormErrors] = useState<{
    fullName?: string;
    phone?: string;
    idProofNumber?: string;
    bedSelection?: string;
  }>({});

  const resetFormFields = () => {
    setFullName('');
    setPhone('');
    setEmail('');
    setIdProofType('AADHAAR');
    setIdProofNumber('');
    setShowIdDropdown(false);
    setStartingMeterReading('0');
    setPayMode('UPI');
    setDateOfJoining(new Date().toISOString().split('T')[0]);
    setRentCycle('1st of every month');
    setFormErrors({});
  };

  const handleClose = () => {
    resetFormFields();
    onClose();
  };

  const loadRoomsForProperty = async (
    propId: string,
    preselectBedId?: string,
    preselectRoomId?: string,
    preselectRent?: number,
    preselectDeposit?: number
  ) => {
    if (!propId) {
      setPropRooms([]);
      setSelectedBedId('');
      setSelectedRoomId('');
      return;
    }

    try {
      let rooms: Room[] = [];

      // Load local custom tenants so locally-assigned beds/rooms are never dropped
      let customTenants: Tenant[] = [];
      try {
        const customRaw = await safeStorage.getItem('@staynest_custom_tenants');
        if (customRaw) {
          const parsed = JSON.parse(customRaw);
          if (Array.isArray(parsed)) customTenants = parsed;
        }
      } catch {
        // ignore
      }

      const mergeTenantLists = (backendList: Tenant[], localLists: Tenant[][]): Tenant[] => {
        const byId = new Map<string, Tenant>();
        const byPhone = new Map<string, string>();
        const normPhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);

        backendList.forEach((t) => {
          byId.set(t.id, t);
          const ph = normPhone(t.phone);
          if (ph) byPhone.set(ph, t.id);
        });

        localLists.flat().forEach((lt) => {
          const ph = normPhone(lt.phone);
          const existingId = byId.has(lt.id) ? lt.id : ph ? byPhone.get(ph) : undefined;
          if (existingId) {
            const existing = byId.get(existingId)!;
            // If backend stay was not linked yet, preserve local room/bed info unless terminated
            if (existing.stayStatus !== 'TERMINATED' && existing.active !== false && !existing.bedId && !existing.roomNumber && (lt.bedId || lt.roomNumber)) {
              byId.set(existingId, {
                ...existing,
                propertyId: existing.propertyId || lt.propertyId,
                roomId: existing.roomId || lt.roomId,
                roomNumber: existing.roomNumber || lt.roomNumber,
                bedId: existing.bedId || lt.bedId,
                bedLabel: existing.bedLabel || lt.bedLabel,
              });
            }
          } else {
            byId.set(lt.id, lt);
            if (ph) byPhone.set(ph, lt.id);
          }
        });

        return Array.from(byId.values());
      };

      let currentTenants = mergeTenantLists([], [tenants, customTenants]);

      // Always fetch fresh backend rooms & tenants first for UUID properties so occupied beds are never shown
      if (isValidUuid(propId)) {
        try {
          const [propDetail, tenantRes] = await Promise.all([
            apiClient<Property>(`/owner/properties/${propId}`),
            apiClient<{ content: Tenant[] }>('/owner/tenants?size=500').catch(() => null),
          ]);
          if (tenantRes?.content) {
            currentTenants = mergeTenantLists(tenantRes.content, [tenants, customTenants]);
          }
          setLiveTenants(currentTenants);
          if (propDetail?.rooms && propDetail.rooms.length > 0) {
            const dedupedMap = new Map<string, Room>();
            propDetail.rooms.forEach((r) => {
              const key = (r.roomNumber || r.id || '').trim().toLowerCase();
              const prev = dedupedMap.get(key);
              const rOcc = (r.beds || []).some((b) => b.status === 'OCCUPIED');
              const prevOcc = prev ? (prev.beds || []).some((b) => b.status === 'OCCUPIED') : false;
              if (!prev || (rOcc && !prevOcc)) {
                const seenLabels = new Set<string>();
                dedupedMap.set(key, {
                  ...r,
                  beds: (r.beds || []).filter((b) => {
                    const lbl = (b.bedLabel || '').trim().toLowerCase();
                    if (!lbl || seenLabels.has(lbl)) return false;
                    seenLabels.add(lbl);
                    return true;
                  }),
                });
              }
            });
            rooms = Array.from(dedupedMap.values());
          }
        } catch {
          rooms = [];
          setLiveTenants(currentTenants);
        }
      } else {
        setLiveTenants(currentTenants);
      }

      // Check locally cached floor/bed occupancy so beds occupied via Rooms screen are always respected
      let cached: string | null = await safeStorage.getItem(`@staynest_floors_${propId}`).catch(() => null);
      if (!cached && typeof window !== 'undefined' && window.localStorage) {
        cached = window.localStorage.getItem(`staynest_floors_${propId}`);
      }
      if (cached) {
        try {
          const floors = JSON.parse(cached);
          if (Array.isArray(floors)) {
            if (rooms.length === 0) {
              floors.forEach((f: any) => {
                (f.rooms || []).forEach((r: any) => {
                  const rawBeds =
                    Array.isArray(r.beds) && r.beds.length > 0
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
            } else {
              const localOccupiedBedIds = new Set<string>();
              const localOccupiedKeys = new Set<string>();
              floors.forEach((f: any) => {
                (f.rooms || []).forEach((r: any) => {
                  (r.beds || []).forEach((b: any) => {
                    if (b.status === 'OCCUPIED') {
                      if (b.id) localOccupiedBedIds.add(b.id);
                      if (r.roomNumber && b.bedLabel) {
                        localOccupiedKeys.add(`${String(r.roomNumber).trim()}-${String(b.bedLabel).trim().toLowerCase()}`);
                      }
                    }
                  });
                });
              });
              if (localOccupiedBedIds.size > 0 || localOccupiedKeys.size > 0) {
                rooms = rooms.map((r) => ({
                  ...r,
                  beds: (r.beds || []).map((b) => {
                    const key = `${String(r.roomNumber || '').trim()}-${String(b.bedLabel || '').trim().toLowerCase()}`;
                    if (localOccupiedBedIds.has(b.id) || localOccupiedKeys.has(key)) {
                      return { ...b, status: 'OCCUPIED' };
                    }
                    return b;
                  }),
                }));
              }
            }
          }
        } catch {
          // ignore
        }
      }

      if (rooms.length === 0 && !isValidUuid(propId)) {
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

      if (preselectBedId || preselectRoomId) {
        const matchedRoom = rooms.find(
          (r) =>
            (preselectRoomId && r.id === preselectRoomId) ||
            (preselectBedId && (r.beds || []).some((b) => b.id === preselectBedId))
        );
        const resolvedBedId = preselectBedId || matchedRoom?.beds?.[0]?.id || (matchedRoom ? `unit-${matchedRoom.id}` : '');
        const resolvedRoomId = preselectRoomId || matchedRoom?.id || '';
        const rentVal = preselectRent ?? (matchedRoom?.rentMonthlyPaise ? matchedRoom.rentMonthlyPaise / 100 : 8500);
        const depVal = preselectDeposit ?? (matchedRoom?.depositPaise ? matchedRoom.depositPaise / 100 : rentVal);
        setSelectedBedId(resolvedBedId);
        setSelectedRoomId(resolvedRoomId);
        setFixedRentAmount(rentVal);
        setFixedDepositAmount(depVal);
        setRentPayingNow(String(rentVal));
        setDepositPayingNow(String(depVal));
        return;
      }

      const occupiedIds = new Set(
        currentTenants
          .filter((t) => t.active !== false && t.stayStatus !== 'TERMINATED' && (!t.propertyId || t.propertyId === propId))
          .map((t) => t.bedId)
      );
      const occupiedRoomBedKeys = new Set(
        currentTenants
          .filter((t) => t.active !== false && t.stayStatus !== 'TERMINATED' && (!t.propertyId || t.propertyId === propId) && t.roomNumber && t.bedLabel)
          .map((t) => `${String(t.roomNumber).trim()}-${String(t.bedLabel).trim().toLowerCase()}`)
      );
      let foundAvail = false;
      for (const r of rooms) {
        const avail = (r.beds || []).find((b) => {
          if (b.status === 'OCCUPIED' || occupiedIds.has(b.id)) return false;
          const key = `${String(r.roomNumber || '').trim()}-${String(b.bedLabel || '').trim().toLowerCase()}`;
          return !occupiedRoomBedKeys.has(key);
        });
        if (avail) {
          setSelectedBedId(avail.id);
          setSelectedRoomId(r.id);
          const rentVal = r.rentMonthlyPaise ? r.rentMonthlyPaise / 100 : 8500;
          const depVal = r.depositPaise ? r.depositPaise / 100 : 2500;
          setFixedRentAmount(rentVal);
          setFixedDepositAmount(depVal);
          setRentPayingNow(String(rentVal));
          setDepositPayingNow(String(depVal));
          foundAvail = true;
          break;
        }
      }
      if (!foundAvail) {
        setSelectedBedId('');
        setSelectedRoomId('');
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!visible) return;
    resetFormFields();
    const targetPropId =
      initialPropertyId && properties.some((p) => p.id === initialPropertyId)
        ? initialPropertyId
        : properties[0]?.id || '';
    setSelectedPropId(targetPropId);
    loadRoomsForProperty(
      targetPropId,
      initialBedId,
      initialRoomId,
      initialRentRupees,
      initialDepositRupees
    );
  }, [visible, initialPropertyId, initialRoomId, initialBedId, initialRentRupees, initialDepositRupees]);

  const handlePropertySelect = (propId: string) => {
    setSelectedPropId(propId);
    setSelectedBedId('');
    setSelectedRoomId('');
    loadRoomsForProperty(propId);
  };

  const handleSelectBed = (bed: Bed, roomId: string, rentPaise?: number, depositPaise?: number) => {
    setSelectedBedId(bed.id);
    setSelectedRoomId(roomId);
    if (formErrors.bedSelection) {
      setFormErrors((prev) => ({ ...prev, bedSelection: undefined }));
    }
    const fixedRent = rentPaise ? rentPaise / 100 : 8500;
    const fixedDep = depositPaise ? depositPaise / 100 : 2500;
    setFixedRentAmount(fixedRent);
    setFixedDepositAmount(fixedDep);
    setRentPayingNow(String(fixedRent));
    setDepositPayingNow(String(fixedDep));
  };

  const selectedAddProperty = properties.find((p) => p.id === selectedPropId);
  const isSelectedAddRentalMode = selectedAddProperty?.propertyType === 'RENTAL_BUILDING';

  const activeOccupiedBedIds = new Set<string>();
  const activeOccupiedRoomNumbers = new Set<string>();
  const activeOccupiedRoomBedKeys = new Set<string>();
  liveTenants.forEach((t) => {
    if (
      t.active !== false &&
      t.stayStatus !== 'TERMINATED' &&
      (!selectedPropId || !t.propertyId || t.propertyId === selectedPropId)
    ) {
      if (t.bedId) activeOccupiedBedIds.add(t.bedId);
      if (t.roomNumber) activeOccupiedRoomNumbers.add(String(t.roomNumber).trim());
      if (t.roomNumber && t.bedLabel) {
        activeOccupiedRoomBedKeys.add(`${String(t.roomNumber).trim()}-${String(t.bedLabel).trim().toLowerCase()}`);
      }
    }
  });

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
      const isFlatOccupied = activeOccupiedRoomNumbers.has(String(r.roomNumber).trim()) || anyBedOccupied;
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
        const key = `${String(r.roomNumber || '').trim()}-${String(b.bedLabel || '').trim().toLowerCase()}`;
        const isOccupied =
          b.status === 'OCCUPIED' ||
          activeOccupiedBedIds.has(b.id) ||
          activeOccupiedRoomBedKeys.has(key);
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
        if (selectedBedId && isValidUuid(selectedBedId)) {
          await apiClient(`/owner/beds/${selectedBedId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'OCCUPIED' }),
          }).catch(() => {});
        }

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

          if (payingNow > 0 && invoice?.id) {
            await apiClient(`/owner/rent-invoices/${invoice.id}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: payingNow * 100,
                paymentMethod: payMode,
                notes:
                  rentDue > 0
                    ? `Partial onboarding rent paid ₹${payingNow}. Remaining ₹${rentDue} due.`
                    : 'Full rent paid at onboarding.',
              }),
            }).catch(() => {});
          }
        } catch {
          if (payingNow > 0) {
            await apiClient(`/owner/tenants/${tenantId}/payments`, {
              method: 'POST',
              body: JSON.stringify({
                amountPaidPaise: payingNow * 100,
                paymentMethod: payMode,
              }),
            }).catch(() => {});
          }
        }
      }

      const createdTenantId = tenantId;
      const isAadhaarValid =
        idProofType === 'AADHAAR' && cleanId.length === 12 && validateVerhoeffAadhaar(cleanId).isValid;
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
          : propRooms.flatMap((r) => r.beds || []).find((b) => b.id === selectedBedId)?.bedLabel || 'Bed 1',
        monthlyRentPaise: fixedRent * 100,
        outstandingPaise: rentDue * 100,
        rentStatus: rentDue === 0 ? 'PAID' : payingNow > 0 ? 'PARTIALLY_PAID' : 'DUE',
        active: true,
        stayStatus: 'ACTIVE',
        checkIn: dateOfJoining || new Date().toISOString().split('T')[0],
        rentCycle: rentCycle || '1st of every month',
        createdAt: new Date().toISOString(),
        ...(startingMeterReading ? { startingMeterReading: Number(startingMeterReading) || 0 } : {}),
      } as Tenant;

      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        const customList: Tenant[] = storedCustomStr ? JSON.parse(storedCustomStr) : [];
        const mergedCustom = [
          newTenantRecord,
          ...customList.filter((ct) => ct.id !== createdTenantId && ct.phone !== phone.trim()),
        ];
        await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(mergedCustom));

        // Keep cached floor/bed occupancy in sync
        if (selectedPropId && (selectedBedId || targetRoomId)) {
          let cachedFloors = await safeStorage.getItem(`@staynest_floors_${selectedPropId}`).catch(() => null);
          if (!cachedFloors && typeof window !== 'undefined' && window.localStorage) {
            cachedFloors = window.localStorage.getItem(`staynest_floors_${selectedPropId}`);
          }
          if (cachedFloors) {
            try {
              const parsedFloors = JSON.parse(cachedFloors);
              if (Array.isArray(parsedFloors)) {
                const updatedFloors = parsedFloors.map((f: any) => ({
                  ...f,
                  rooms: (f.rooms || []).map((r: any) => {
                    const sameRoom =
                      r.id === targetRoomId ||
                      (newTenantRecord.roomNumber &&
                        String(r.roomNumber || '').trim() === String(newTenantRecord.roomNumber).trim());
                    if (!sameRoom) return r;
                    return {
                      ...r,
                      beds: (r.beds || []).map((b: any) => {
                        const sameBed =
                          b.id === selectedBedId ||
                          (newTenantRecord.bedLabel &&
                            String(b.bedLabel || '').trim().toLowerCase() ===
                              String(newTenantRecord.bedLabel).trim().toLowerCase());
                        return sameBed ? { ...b, status: 'OCCUPIED' } : b;
                      }),
                    };
                  }),
                }));
                await safeStorage.setItem(`@staynest_floors_${selectedPropId}`, JSON.stringify(updatedFloors));
                if (typeof window !== 'undefined' && window.localStorage) {
                  window.localStorage.setItem(`staynest_floors_${selectedPropId}`, JSON.stringify(updatedFloors));
                }
              }
            } catch {
              // ignore
            }
          }
        }

        await logActivity({
          propertyId: selectedPropId,
          type: 'TENANT_ADDED',
          title: `${fullName.trim()} added to ${isAddRental ? 'Flat' : 'Room'} ${newTenantRecord.roomNumber}`,
          subtitle: isAddRental ? targetRoomObj?.sharingType || 'Flat Unit' : newTenantRecord.bedLabel || 'Bed 1',
          amountRupees: payingNow > 0 ? payingNow : undefined,
        });

        fastDataCache.invalidateAll();
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
      } catch {
        // ignore
      }

      const alertMsg =
        rentDue > 0
          ? `${fullName} onboarded! Rent received ₹${payingNow.toLocaleString('en-IN')}. Remaining ₹${rentDue.toLocaleString('en-IN')} marked as DUE.`
          : `${fullName} successfully onboarded as a resident!`;

      showGlassSuccess({
        title: 'Tenant Created',
        message: alertMsg,
        buttonText: 'Done',
      });

      onSuccess?.(newTenantRecord);
      handleClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <GlassBackground>
      <SafeAreaView style={styles.separatePageContainer}>
        {/* Top Header with Small Back Button & Centered Title */}
        <View style={styles.separatePageHeader}>
          <TouchableOpacity
            style={styles.separatePageBackBtn}
            onPress={handleClose}
            activeOpacity={0.7}
            accessibilityLabel="Back"
          >
            <Text style={styles.separatePageBackBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.separatePageHeaderCenter}>
            <Text style={styles.separatePageHeaderTitle}>{t('onboard.title')}</Text>
            <Text style={styles.separatePageHeaderSub} numberOfLines={1}>
              {isSelectedAddRentalMode ? t('onboard.subRental') : t('onboard.subPg')}
            </Text>
          </View>
          <View style={styles.separatePageHeaderSpacer} />
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
                    style={[styles.propChip, selectedPropId === p.id && styles.propChipSelected]}
                    onPress={() => handlePropertySelect(p.id)}
                  >
                    <Text style={[styles.propChipText, selectedPropId === p.id && styles.propChipTextSelected]}>
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
                formErrors.phone && { borderColor: '#dc2626', backgroundColor: '#fef2f2', borderWidth: 1.5, marginBottom: 4 },
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
                if (digitsOnly.length > 0 && !/^[6-9]/.test(digitsOnly)) {
                  setFormErrors((prev) => ({ ...prev, phone: 'Mobile number must start with 6, 7, 8, or 9' }));
                } else if (formErrors.phone) {
                  setFormErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              keyboardType="phone-pad"
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94a3b8"
              maxLength={10}
            />
            {formErrors.phone && (
              <Text style={{ color: '#dc2626', fontSize: 11.5, fontWeight: '700', marginTop: 2, marginBottom: 4 }}>
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
                      {isValid ? '✓ Valid PAN' : clean.length < 10 ? `⚠️ ${10 - clean.length} chars needed` : '⚠️ Invalid PAN'}
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

          {/* 5. FIXED DEPOSIT & RENT (READ-ONLY LOCKED BOX) */}
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

          {/* 6. EDITABLE PAYMENTS */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>💵 RENT AMOUNT PAYING NOW (₹) *</Text>
            <View style={styles.currencyInputRow}>
              <Text style={styles.currencyInrLight}>₹</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    borderWidth: 0,
                    paddingHorizontal: 0,
                    paddingVertical: 10,
                    marginBottom: 0,
                    backgroundColor: 'transparent',
                    letterSpacing: 0,
                  },
                ]}
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
                  <Text style={styles.rentPaidAlertTitle}>✓ FULL RENT PAID (₹0 Due)</Text>
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
                style={[
                  styles.input,
                  {
                    flex: 1,
                    borderWidth: 0,
                    paddingHorizontal: 0,
                    paddingVertical: 10,
                    marginBottom: 0,
                    backgroundColor: 'transparent',
                    letterSpacing: 0,
                  },
                ]}
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
                  style={[styles.modePillLarge, payMode === mode && styles.modePillLargeActive]}
                  onPress={() => setPayMode(mode)}
                >
                  <Text style={[styles.modePillLargeText, payMode === mode && styles.modePillLargeTextActive]}>
                    {mode === 'BANK_TRANSFER' ? '🏦 Bank Transfer' : mode === 'UPI' ? '📱 UPI' : '💵 Cash'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 7. DATE OF JOINING & RENT CYCLE */}
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>📅 DATE OF JOINING (CHECK-IN) *</Text>
            <TextInput
              style={styles.input}
              value={dateOfJoining}
              onChangeText={setDateOfJoining}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
            />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {[
                { label: 'Today', val: new Date().toISOString().split('T')[0] },
                { label: 'Tomorrow', val: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
                {
                  label: '1st of Next Month',
                  val: `${new Date().getFullYear()}-${String(new Date().getMonth() + 2).padStart(2, '0')}-01`,
                },
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
                {
                  label: `Same day as joining (${dateOfJoining.split('-')[2] || 'Day'}th of every month)`,
                  val: `Day of joining (${dateOfJoining.split('-')[2] || '1'})`,
                },
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
            <TouchableOpacity style={styles.cancelFormBtn} onPress={handleClose} activeOpacity={0.8}>
              <Text style={styles.cancelFormBtnText} numberOfLines={1}>
                ← Cancel
              </Text>
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
      </SafeAreaView>
      </GlassBackground>
    </Modal>
  );
};

const styles = StyleSheet.create({
  separatePageContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  separatePageHeader: {
    backgroundColor: GLASS_TOKENS.dockBg,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: GLASS_TOKENS.cardBorder,
    ...GLASS_TOKENS.webBlur16,
  },
  separatePageBackBtn: {
    width: 34,
    height: 34,
    backgroundColor: GLASS_TOKENS.apricotBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  separatePageBackBtnText: {
    color: '#ea580c',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 18,
  },
  separatePageHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  separatePageHeaderSpacer: {
    width: 34,
  },
  separatePageHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  separatePageHeaderSub: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
  },
  separatePageContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: GLASS_TOKENS.cardBg,
    borderWidth: 1,
    borderColor: GLASS_TOKENS.cardBorder,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: 0,
    marginBottom: 10,
    ...GLASS_TOKENS.shadow,
    ...GLASS_TOKENS.webBlur16,
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_TOKENS.cardBg,
    borderWidth: 1,
    borderColor: GLASS_TOKENS.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    ...GLASS_TOKENS.shadow,
    ...GLASS_TOKENS.webBlur16,
  },
  currencyInrLight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    marginRight: 4,
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
  rentDueAlertBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
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
    marginBottom: 10,
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
});
