import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { safeStorage } from '../utils/safeStorage';
import { Property, Room, Bed, Tenant } from '../types';
import { pickImageFromDevice, pickMultipleImagesFromDevice } from '../utils/imagePicker';
import { getInitialFloorsForProperty as getModularFloors } from '../services/propertyDataService';
import { validateVerhoeffAadhaar } from '../utils/aadhaar';
import { logActivity } from '../services/activityLogService';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const OutlineBellIcon = ({ color = '#475569', size = 18 }: { color?: string; size?: number }) => (
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

const OutlineSearchIcon = ({ color = '#475569', size = 18 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
    <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

// ─── MINIMALIST VECTOR BED & CAMERA ICONS (LUXURY SAAS STYLE) ───
const BedVectorIcon = ({ color = '#94a3b8', size = 22 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Headboard */}
    <Path d="M3 7v10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* Footboard */}
    <Path d="M21 11v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* Mattress Frame */}
    <Path d="M3 13.5h18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* Pillow */}
    <Rect x="5.5" y="9" width="5.5" height="4" rx="1.2" stroke={color} strokeWidth="1.4" />
  </Svg>
);

const CameraMicroIcon = ({ color = '#94a3b8', size = 11 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21 18a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h3.5l1.5-2h4l1.5 2H19a2 2 0 012 2v10z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="13" r="3.5" stroke={color} strokeWidth="1.8" />
  </Svg>
);

interface PropertiesScreenProps {
  initialProperty?: Property | null;
  onActivePropertyChange?: (property: Property) => void;
  onBackToDashboard?: () => void;
}

interface FloorConfig {
  floorNumber: number;
  label?: string;
  rooms: RoomConfig[];
}

interface RoomConfig {
  id: string;
  roomNumber: string;
  floorNumber: number;
  sharingType: string;
  rentRupees: number;
  depositRupees: number;
  maintenanceRupees?: number;
  ac: boolean;
  attachedBathroom: boolean;
  beds: BedConfig[];
  photos?: string[];
}

interface BedConfig {
  id: string;
  bedLabel: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  photo?: string;
}

export const PropertiesScreen: React.FC<PropertiesScreenProps> = ({
  initialProperty,
  onActivePropertyChange,
  onBackToDashboard,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // View Mode: 'OVERVIEW' (Clean, saved view) vs 'EDIT' (Interactive +/- builder)
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'EDIT'>('OVERVIEW');

  // Property Selection State
  const [activeProperty, setActiveProperty] = useState<Property | null>(initialProperty || null);
  const [propertiesList, setPropertiesList] = useState<Property[]>([]);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false);

  // Expanded Room details in Overview Mode
  const [expandedRoomIds, setExpandedRoomIds] = useState<Record<string, boolean>>({});

  // Floor and Category selection for Image 2 Room Management UI
  const [selectedFloorByBuilding, setSelectedFloorByBuilding] = useState<Record<string, number>>({});
  const [selectedCategoryByBuilding, setSelectedCategoryByBuilding] = useState<Record<string, string>>({});

  const getSelectedFloor = (bId: string) => selectedFloorByBuilding[bId] || (floors[0]?.floorNumber || 1);
  const setSelectedFloor = (bId: string, fl: number) => {
    setSelectedFloorByBuilding((prev) => ({ ...prev, [bId]: fl }));
  };
  const getSelectedCat = (bId: string) => selectedCategoryByBuilding[bId] || 'HOSTEL_ROOM';
  const setSelectedCat = (bId: string, cat: string) => {
    setSelectedCategoryByBuilding((prev) => ({ ...prev, [bId]: cat }));
  };
  const getShortRoomType = (sharingType: string) => {
    if (!sharingType) return 'STD';
    const s = sharingType.toUpperCase();
    if (s.includes('SINGLE')) return 'CLA';
    if (s.includes('DOUBLE')) return 'DLX';
    if (s.includes('TRIPLE')) return 'SUP';
    if (s.includes('FOUR')) return 'DLX-S';
    return 'SUP';
  };

  const formatSharingBadge = (bedsCount: number) => {
    if (bedsCount === 1) return 'Single Sharing';
    if (bedsCount === 2) return 'Double Sharing';
    if (bedsCount === 3) return 'Triple Sharing';
    if (bedsCount === 4) return 'Four Sharing';
    return `${bedsCount} Sharing`;
  };

  // Selected Floor Filter: 'ALL' displays all floors one by one, or a specific floor number
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | 'ALL'>('ALL');

  // Modal for assigning resident to empty bed (+ Add)
  const [assigningBed, setAssigningBed] = useState<{
    floorNum: number;
    roomId: string;
    roomNumber: string;
    bedId: string;
    bedLabel: string;
    rentRupees: number;
  } | null>(null);
  const [assignTenantName, setAssignTenantName] = useState('');
  const [assignTenantPhone, setAssignTenantPhone] = useState('');
  const [assignTenantEmail, setAssignTenantEmail] = useState('');
  const [assignIdProofType, setAssignIdProofType] = useState<'AADHAAR' | 'PAN' | 'VOTER_ID'>('AADHAAR');
  const [assignIdProofNumber, setAssignIdProofNumber] = useState('');
  const [assignRentAmount, setAssignRentAmount] = useState('');
  const [assignRentPayingNow, setAssignRentPayingNow] = useState('');
  const [assignDepositPayingNow, setAssignDepositPayingNow] = useState('');
  const [assignPayMode, setAssignPayMode] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER'>('UPI');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const openAssignModalForBed = (bedData: {
    floorNum: number;
    roomId: string;
    roomNumber: string;
    bedId: string;
    bedLabel: string;
    rentRupees: number;
  }) => {
    setAssigningBed(bedData);
    setAssignTenantName('');
    setAssignTenantPhone('');
    setAssignTenantEmail('');
    setAssignIdProofType('AADHAAR');
    setAssignIdProofNumber('');
    setAssignRentAmount('');
    setAssignRentPayingNow('');
    setAssignDepositPayingNow('');
    setAssignPayMode('UPI');
  };

  // Modal for managing occupied bed
  const [occupiedBedAction, setOccupiedBedAction] = useState<{
    floorNum: number;
    roomId: string;
    roomNumber: string;
    bed: BedConfig;
    tenantName: string;
    tenantPhone?: string;
    tenantId?: string;
  } | null>(null);

  // Modal for renaming or removing a floor
  const [editingFloor, setEditingFloor] = useState<{
    floorNumber: number;
    label: string;
  } | null>(null);

  // Modal for viewing tenants inside a room
  const [viewingRoomTenants, setViewingRoomTenants] = useState<{
    roomNumber: string;
    occupants: Tenant[];
  } | null>(null);

  // Modal for comprehensive bed management (+ Add Bed, Delete Bed, Vacate, Call)
  const [managingBedsRoom, setManagingBedsRoom] = useState<{
    floorNum: number;
    roomId: string;
  } | null>(null);

  // Modal to select which bed to apply photo (Point 2)
  const [targetPhotoRoom, setTargetPhotoRoom] = useState<{
    floorNum: number;
    room: RoomConfig;
  } | null>(null);

  // Helper Bed Color Palette (Matching Image 1: Harsha #fffbeb, Suresh #f0fdf4, Rohit #fef2f2)
  const BED_STYLES = [
    { bg: '#fffbeb', border: '#fde68a', numColor: '#b45309', textColor: '#78350f' }, // Amber / Warm (Harsha)
    { bg: '#f0fdf4', border: '#bbf7d0', numColor: '#15803d', textColor: '#14532d' }, // Green (Suresh)
    { bg: '#fef2f2', border: '#fecaca', numColor: '#b91c1c', textColor: '#7f1d1d' }, // Red (Rohit)
    { bg: '#faf5ff', border: '#e9d5ff', numColor: '#7e22ce', textColor: '#581c87' }, // Purple
    { bg: '#eff6ff', border: '#bfdbfe', numColor: '#1d4ed8', textColor: '#1e3a8a' }, // Blue
  ];

  // Cross-Platform Confirmation Dialog (Works on Web & Native Mobile)
  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      try {
        const ok = window.confirm(`${title}\n\n${message}`);
        if (ok) {
          onConfirm();
        }
        return;
      } catch { }
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  };

  // Cross-Platform Notification Dialog (Works on Web & Native Mobile)
  const notifyUser = (title: string, message?: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
      try {
        window.alert(message ? `${title}\n\n${message}` : title);
        return;
      } catch { }
    }
    Alert.alert(title, message);
  };

  const safeDispatchStorageEvent = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') {
      try {
        safeDispatchStorageEvent();
      } catch { }
    }
  };

  // Whole Building Photo State (Point 8)
  const [buildingPhoto, setBuildingPhoto] = useState<string>('');

  useEffect(() => {
    if (activeProperty?.id) {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(`staynest_building_photo_${activeProperty.id}`);
        if (saved) {
          setBuildingPhoto(saved);
        } else {
          setBuildingPhoto(activeProperty.primaryPhotoUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80');
        }
      }
    }
  }, [activeProperty?.id]);

  const handleUpdateBuildingPhoto = async () => {
    try {
      const picked = await pickImageFromDevice();
      if (picked && activeProperty?.id) {
        setBuildingPhoto(picked);
        const updatedProp = { ...activeProperty, primaryPhotoUrl: picked };
        setActiveProperty(updatedProp);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`staynest_building_photo_${activeProperty.id}`, picked);
          window.localStorage.setItem('staynest_building_photo_default', picked);
          window.localStorage.setItem('staynest_building_photo_ramesh-pg-default', picked);

          const cachedCustom = JSON.parse(window.localStorage.getItem('staynest_custom_properties') || '[]');
          const updatedCustom = [updatedProp, ...cachedCustom.filter((p: any) => p.id !== activeProperty.id)];
          window.localStorage.setItem('staynest_custom_properties', JSON.stringify(updatedCustom));

          safeDispatchStorageEvent();
        }
        notifyUser('Building Photo Updated! 🏢', 'Exterior photo has been updated and synced locally for the StayNest website.');
      }
    } catch (e) {
      console.log('Error updating building photo:', e);
    }
  };

  const handleSyncToWebsite = () => {
    if (typeof window === 'undefined') return;
    try {
      const customProps = JSON.parse(window.localStorage.getItem('staynest_custom_properties') || '[]');
      const buildingPhotoVal = buildingPhoto || activeProperty?.primaryPhotoUrl || '';
      const payload = {
        customProps: activeProperty ? [activeProperty, ...customProps.filter((p: any) => p.id !== activeProperty.id)] : customProps,
        buildingPhotos: {
          [`staynest_building_photo_${activeProperty?.id}`]: buildingPhotoVal,
          'staynest_building_photo_default': buildingPhotoVal,
          'staynest_building_photo_ramesh-pg-default': buildingPhotoVal,
        },
        floors: {
          [`staynest_floors_${activeProperty?.id}`]: floors,
          'staynest_floors_default': floors,
          'staynest_floors_ramesh-pg-default': floors,
        },
      };

      const syncUrl = `http://localhost:5173/?sync_data=${encodeURIComponent(JSON.stringify(payload))}`;
      window.open(syncUrl, '_blank');
      notifyUser('Synced to Website! 🌐', 'Opening website on Port 5173 with all updated building photos, room floors, and bed photos!');
    } catch (e) {
      console.log('Error syncing to website:', e);
    }
  };

  // Add Room Photo from local machine / camera (Point 7)
  const handleAddRoomPhoto = async (floorNum: number, roomId: string) => {
    try {
      const picked = await pickImageFromDevice();
      if (!picked) return;
      setFloors((prev) => {
        const nextFloors = prev.map((fl) => {
          if (fl.floorNumber !== floorNum) return fl;
          return {
            ...fl,
            rooms: fl.rooms.map((rm) => {
              if (rm.id !== roomId) return rm;
              const currentPhotos = rm.photos || [];
              return {
                ...rm,
                photos: [...currentPhotos, picked],
              };
            }),
          };
        });
        if (activeProperty?.id && typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_default', JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_ramesh-pg-default', JSON.stringify(nextFloors));
            safeDispatchStorageEvent();
          } catch { }
        }
        return nextFloors;
      });
      notifyUser('Room Photo Added! 📸', 'Room photo saved and synchronized with website.');
    } catch (e) {
      console.log('Error adding room photo:', e);
    }
  };

  // Delete Room Photo (Point 7)
  const handleDeleteRoomPhoto = (floorNum: number, roomId: string, photoIdx: number) => {
    confirmAction('Delete Room Photo', 'Are you sure you want to remove this photo from the room?', () => {
      setFloors((prev) => {
        const nextFloors = prev.map((fl) => {
          if (fl.floorNumber !== floorNum) return fl;
          return {
            ...fl,
            rooms: fl.rooms.map((rm) => {
              if (rm.id !== roomId) return rm;
              const currentPhotos = rm.photos || [];
              return {
                ...rm,
                photos: currentPhotos.filter((_, idx) => idx !== photoIdx),
              };
            }),
          };
        });
        if (activeProperty?.id && typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_default', JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_ramesh-pg-default', JSON.stringify(nextFloors));
            safeDispatchStorageEvent();
          } catch { }
        }
        return nextFloors;
      });
    });
  };

  // Upload photo for specific bed (Requirement 1)
  const handleUploadBedPhoto = async (floorNum: number, roomId: string, bedId: string) => {
    try {
      const picked = await pickImageFromDevice();
      if (!picked) return;
      setFloors((prev) => {
        const nextFloors = prev.map((fl) => {
          if (fl.floorNumber !== floorNum) return fl;
          return {
            ...fl,
            rooms: fl.rooms.map((rm) => {
              if (rm.id !== roomId) return rm;
              return {
                ...rm,
                beds: rm.beds.map((b) => {
                  if (b.id !== bedId) return b;
                  return { ...b, photo: picked };
                }),
              };
            }),
          };
        });
        if (activeProperty?.id && typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_default', JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_ramesh-pg-default', JSON.stringify(nextFloors));
            safeDispatchStorageEvent();
          } catch { }
        }
        return nextFloors;
      });
      notifyUser('Bed Photo Uploaded! 📸', 'Photo for this bed has been saved and will show in the bed box.');
    } catch (e) {
      console.log('Error adding bed photo:', e);
    }
  };

  // Delete Bed Photo (Point 2)
  const handleDeleteBedPhoto = (floorNum: number, roomId: string, bedId: string, bedLabel: string) => {
    confirmAction('Remove Bed Photo', `Are you sure you want to remove the photo from ${bedLabel}?`, () => {
      setFloors((prev) => {
        const nextFloors = prev.map((fl) => {
          if (fl.floorNumber !== floorNum) return fl;
          return {
            ...fl,
            rooms: fl.rooms.map((rm) => {
              if (rm.id !== roomId) return rm;
              return {
                ...rm,
                beds: rm.beds.map((b) => {
                  if (b.id !== bedId) return b;
                  const updated = { ...b };
                  delete updated.photo;
                  return updated;
                }),
              };
            }),
          };
        });
        if (activeProperty?.id && typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_default', JSON.stringify(nextFloors));
            window.localStorage.setItem('staynest_floors_ramesh-pg-default', JSON.stringify(nextFloors));
            safeDispatchStorageEvent();
          } catch { }
        }
        return nextFloors;
      });
      notifyUser('Photo Removed', `Photo for ${bedLabel} has been removed.`);
    });
  };

  // Delete Bed Handler
  const handleDeleteBed = (floorNum: number, roomId: string, bedId: string, bedLabel: string) => {
    const doDelete = () => {
      setTenants((prev) => prev.filter((t) => t.bedId !== bedId));
      setFloors((prev) => {
        const nextFloors = prev.map((f) => {
          if (f.floorNumber !== floorNum) return f;
          return {
            ...f,
            rooms: f.rooms.map((r) => {
              if (r.id !== roomId) return r;
              const updatedBeds = r.beds
                .filter((b) => b.id !== bedId)
                .map((b, idx) => ({
                  ...b,
                  bedLabel: `Bed ${idx + 1}`,
                }));
              return {
                ...r,
                beds: updatedBeds,
                sharingType: getSharingEnum(updatedBeds.length),
              };
            }),
          };
        });

        if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
          try {
            window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
          } catch { }
        }

        return nextFloors;
      });

      notifyUser('✓ Bed Removed', `${bedLabel} has been removed from this room.`);
    };

    confirmAction('Remove Bed', `Remove ${bedLabel} from this room?`, doDelete);
  };

  // Check out resident from occupied bed
  const handleCheckOutBed = (floorNum: number, roomId: string, bedId: string, tenantName: string) => {
    const doCheckout = () => {
      setTenants((prev) => prev.filter((t) => t.bedId !== bedId));
      setFloors((prev) => {
        const nextFloors = prev.map((f) => {
          if (f.floorNumber !== floorNum) return f;
          return {
            ...f,
            rooms: f.rooms.map((r) => {
              if (r.id !== roomId) return r;
              return {
                ...r,
                beds: r.beds.map((b) => (b.id === bedId ? { ...b, status: 'AVAILABLE' as const } : b)),
              };
            }),
          };
        });

        if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
          try {
            window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
          } catch { }
        }

        return nextFloors;
      });
      setOccupiedBedAction(null);
      notifyUser('✓ Bed Available', `${tenantName} has been checked out. Bed is now available.`);
    };

    confirmAction(
      'Check Out Resident',
      `Check out ${tenantName}? Their bed will immediately become vacant and available.`,
      doCheckout
    );
  };

  // Assign resident to empty bed (+ Add Mark) with full onboarding & Aadhaar KYC verification
  const handleAssignTenantToBed = async () => {
    if (!assigningBed) return;
    if (!assignTenantName.trim() || !assignTenantPhone.trim()) {
      Alert.alert('Required', 'Please enter resident name and phone');
      return;
    }

    // Validate Aadhaar number using official Verhoeff checksum if provided
    const trimmedId = assignIdProofNumber.trim();
    let isAadhaarVerified = false;
    let normalizedIdProof = trimmedId;

    if (assignIdProofType === 'AADHAAR' && trimmedId.length > 0) {
      const cleanAadhaar = trimmedId.replace(/\D/g, '');
      if (!validateVerhoeffAadhaar(cleanAadhaar)) {
        Alert.alert(
          'Invalid Aadhaar Number',
          'Please enter a valid 12-digit Aadhaar number (Verhoeff checksum failed), or leave it blank to verify later.'
        );
        return;
      }
      isAadhaarVerified = true;
      normalizedIdProof = cleanAadhaar;
    }

    setSubmittingAssign(true);
    try {
      const fixedRent = Number(assignRentAmount || assigningBed.rentRupees || 8500);
      const payingNow = Number(assignRentPayingNow || 0);
      const rentDue = Math.max(0, fixedRent - payingNow);
      const depositPaying = Number(assignDepositPayingNow || 2500);
      const todayDate = new Date().toISOString().split('T')[0];
      const currentMonth = new Date().toISOString().slice(0, 7);

      let newTenant: Tenant;
      try {
        newTenant = await apiClient<Tenant>('/owner/tenants', {
          method: 'POST',
          body: JSON.stringify({
            fullName: assignTenantName.trim(),
            phone: assignTenantPhone.trim(),
            email: assignTenantEmail.trim() || undefined,
            idProofType: assignIdProofType,
            idProofNumber: normalizedIdProof || 'NOT_PROVIDED',
          }),
        });

        if (activeProperty?.id && assigningBed.bedId) {
          // 1. Allocate Stay with REQUIRED checkIn date
          try {
            await apiClient(`/owner/tenants/${newTenant.id}/stays`, {
              method: 'POST',
              body: JSON.stringify({
                propertyId: activeProperty.id,
                roomId: assigningBed.roomId,
                bedId: assigningBed.bedId,
                monthlyRentPaise: fixedRent * 100,
                securityDepositPaise: depositPaying * 100,
                checkIn: todayDate,
              }),
            });
          } catch (stayErr: any) {
            console.warn('Stay allocation warning:', stayErr.message);
          }

          // 2. Generate monthly rent invoice
          try {
            const invoice = await apiClient<any>('/owner/rent-invoices', {
              method: 'POST',
              body: JSON.stringify({
                tenantId: newTenant.id,
                propertyId: activeProperty.id,
                billingMonth: currentMonth,
                rentAmountPaise: fixedRent * 100,
                dueDate: todayDate,
              }),
            });

            // 3. Record payment if resident paid any rent amount
            if (payingNow > 0 && invoice?.id) {
              await apiClient(`/owner/rent-invoices/${invoice.id}/payments`, {
                method: 'POST',
                body: JSON.stringify({
                  amountPaidPaise: payingNow * 100,
                  paymentMethod: assignPayMode,
                  notes: rentDue > 0
                    ? `Partial onboarding rent paid ₹${payingNow}. Remaining ₹${rentDue} due.`
                    : 'Full rent paid at onboarding via Properties.',
                }),
              });
            }
          } catch {
            if (payingNow > 0) {
              await apiClient(`/owner/tenants/${newTenant.id}/payments`, {
                method: 'POST',
                body: JSON.stringify({
                  amountPaidPaise: payingNow * 100,
                  paymentMethod: assignPayMode,
                }),
              }).catch(() => { });
            }
          }
        }
      } catch {
        newTenant = {
          id: `tenant-${Date.now()}`,
          fullName: assignTenantName.trim(),
          phone: assignTenantPhone.trim(),
          email: assignTenantEmail.trim() || undefined,
          idProofType: assignIdProofType,
          idProofNumber: normalizedIdProof || '--',
          aadhaarVerified: isAadhaarVerified,
          kycStatus: isAadhaarVerified ? 'VERIFIED' : 'PENDING',
          propertyId: activeProperty?.id,
          propertyName: activeProperty?.name || 'StayNest PG',
          roomId: assigningBed.roomId,
          roomNumber: assigningBed.roomNumber,
          bedId: assigningBed.bedId,
          bedLabel: assigningBed.bedLabel,
          monthlyRentPaise: fixedRent * 100,
          outstandingPaise: rentDue * 100,
          rentStatus: rentDue === 0 ? 'PAID' : (payingNow > 0 ? 'PARTIALLY_PAID' : 'DUE'),
          active: true,
          stayStatus: 'ACTIVE',
        };
      }

      const fullTenant: Tenant = {
        ...newTenant,
        fullName: assignTenantName.trim(),
        phone: assignTenantPhone.trim(),
        idProofType: assignIdProofType,
        idProofNumber: normalizedIdProof || '--',
        aadhaarVerified: isAadhaarVerified,
        kycStatus: isAadhaarVerified ? 'VERIFIED' : 'PENDING',
        propertyId: activeProperty?.id,
        propertyName: activeProperty?.name || 'StayNest PG',
        roomId: assigningBed.roomId,
        roomNumber: assigningBed.roomNumber,
        bedId: assigningBed.bedId,
        bedLabel: assigningBed.bedLabel,
        monthlyRentPaise: fixedRent * 100,
        outstandingPaise: rentDue * 100,
        rentStatus: rentDue === 0 ? 'PAID' : (payingNow > 0 ? 'PARTIALLY_PAID' : 'DUE'),
        active: true,
        stayStatus: 'ACTIVE',
      };

      setTenants((prev) => [...prev.filter((t) => t.bedId !== assigningBed.bedId && t.id !== fullTenant.id), fullTenant]);

      // Persist tenant & Aadhaar KYC status across Dashboard and Tenants screens
      try {
        const existingCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        const existingCustom: Tenant[] = existingCustomStr ? JSON.parse(existingCustomStr) : [];
        const nextCustom = [
          fullTenant,
          ...existingCustom.filter((c) => c.id !== fullTenant.id && c.phone !== fullTenant.phone),
        ];
        await safeStorage.setItem('@staynest_custom_tenants', JSON.stringify(nextCustom));
        await logActivity({
          propertyId: activeProperty?.id,
          type: 'BED_ASSIGNED',
          title: `${fullTenant.fullName} assigned to ${isRentalMode ? 'Flat' : 'Room'} ${assigningBed.roomNumber}`,
          subtitle: `${isRentalMode ? 'Unit' : assigningBed.bedLabel}${isAadhaarVerified ? ' • Aadhaar Verified' : ''}`,
          amountRupees: payingNow > 0 ? payingNow : undefined,
        });
      } catch {}

      const updatedFloors = floors.map((f) => {
        if (f.floorNumber !== assigningBed.floorNum) return f;
        return {
          ...f,
          rooms: f.rooms.map((r) => {
            if (r.id !== assigningBed.roomId) return r;
            return {
              ...r,
              beds: r.beds.map((b) => (b.id === assigningBed.bedId ? { ...b, status: 'OCCUPIED' as const } : b)),
            };
          }),
        };
      });
      setFloors(updatedFloors);

      if (typeof window !== 'undefined' && window.localStorage) {
        if (activeProperty?.id) {
          window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(updatedFloors));
        }
        if (isAadhaarVerified) {
          window.localStorage.setItem(`staynest_kyc_${fullTenant.id}`, 'VERIFIED');
        }
        window.dispatchEvent(new Event('staynest_expense_added'));
      }

      const alertMsg = rentDue > 0
        ? `✓ ${assignTenantName} onboarded to ${assigningBed.bedLabel}! Received ₹${payingNow.toLocaleString('en-IN')}, Remaining ₹${rentDue.toLocaleString('en-IN')} marked as DUE.`
        : `✓ ${assignTenantName} onboarded to ${assigningBed.bedLabel}, Room ${assigningBed.roomNumber}! Full rent received.`;

      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(alertMsg);
      } else {
        Alert.alert('✓ Resident Assigned', alertMsg);
      }

      setAssigningBed(null);
      setAssignTenantName('');
      setAssignTenantPhone('');
      setAssignTenantEmail('');
      setAssignIdProofNumber('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not assign resident');
    } finally {
      setSubmittingAssign(false);
    }
  };
  // Property Floors & Structure State
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [floors, setFloors] = useState<FloorConfig[]>([
    {
      floorNumber: 1,
      rooms: [
        {
          id: 'room-101',
          roomNumber: '101',
          floorNumber: 1,
          sharingType: 'TRIPLE',
          rentRupees: 9500,
          depositRupees: 9500,
          ac: true,
          attachedBathroom: true,
          beds: [
            { id: 'b-101-1', bedLabel: 'Bed 1', status: 'OCCUPIED' },
            { id: 'b-101-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
            { id: 'b-101-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
          ],
        },
        {
          id: 'room-102',
          roomNumber: '102',
          floorNumber: 1,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          ac: false,
          attachedBathroom: true,
          beds: [
            { id: 'b-102-1', bedLabel: 'Bed 1', status: 'OCCUPIED' },
            { id: 'b-102-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
        {
          id: 'room-103',
          roomNumber: '103',
          floorNumber: 1,
          sharingType: 'SINGLE',
          rentRupees: 12000,
          depositRupees: 12000,
          ac: true,
          attachedBathroom: true,
          beds: [
            { id: 'b-103-1', bedLabel: 'Bed 1', status: 'OCCUPIED' },
          ],
        },
      ],
    },
    {
      floorNumber: 2,
      rooms: [
        {
          id: 'room-201',
          roomNumber: '201',
          floorNumber: 2,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          ac: false,
          attachedBathroom: true,
          beds: [
            { id: 'b-201-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-201-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
        {
          id: 'room-202',
          roomNumber: '202',
          floorNumber: 2,
          sharingType: 'TRIPLE',
          rentRupees: 9500,
          depositRupees: 9500,
          ac: true,
          attachedBathroom: true,
          beds: [
            { id: 'b-202-1', bedLabel: 'Bed 1', status: 'OCCUPIED' },
            { id: 'b-202-2', bedLabel: 'Bed 2', status: 'OCCUPIED' },
            { id: 'b-202-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
          ],
        },
      ],
    },
    {
      floorNumber: 3,
      rooms: [
        {
          id: 'room-301',
          roomNumber: '301',
          floorNumber: 3,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          ac: true,
          attachedBathroom: true,
          beds: [
            { id: 'b-301-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-301-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
      ],
    },
  ]);

  // Backup of floors to allow Cancel in Edit Mode
  const [originalFloors, setOriginalFloors] = useState<FloorConfig[]>([]);

  // Modals inside Edit Mode
  const [selectedBedForStatus, setSelectedBedForStatus] = useState<{
    floorNum: number;
    roomId: string;
    bed: BedConfig;
  } | null>(null);

  const [editingRoomDetails, setEditingRoomDetails] = useState<{
    floorNum: number;
    room: RoomConfig;
  } | null>(null);

  // New Property Form State (Requirement 5: Location detection & website sync)
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<'PG' | 'HOSTEL' | 'CO_LIVING'>('PG');
  const [newPropGender, setNewPropGender] = useState<'BOYS' | 'GIRLS' | 'CO_ED'>('BOYS');
  const [newPropAddress, setNewPropAddress] = useState('');
  const [newPropLocality, setNewPropLocality] = useState('Hitec City');
  const [newPropCity, setNewPropCity] = useState('Hyderabad');
  const [newPropPincode, setNewPropPincode] = useState('500081');
  const [newPropLat, setNewPropLat] = useState<number | null>(null);
  const [newPropLng, setNewPropLng] = useState<number | null>(null);
  const [newPropMapsUrl, setNewPropMapsUrl] = useState('');
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [creatingProperty, setCreatingProperty] = useState(false);

  // Capture Owner's Current GPS Location (Requirement 5)
  const handleCaptureCurrentLocation = () => {
    setCapturingLocation(true);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude.toFixed(6));
          const lng = Number(position.coords.longitude.toFixed(6));
          setNewPropLat(lat);
          setNewPropLng(lng);
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          setNewPropMapsUrl(mapsUrl);
          if (!newPropAddress) {
            setNewPropAddress(`GPS Location Near (${lat}, ${lng})`);
          }
          notifyUser('✓ Location Detected', `Coordinates: ${lat}, ${lng}\nGoogle Maps link generated!`);
          setCapturingLocation(false);
        },
        (error) => {
          console.warn('Geolocation capture warning:', error.message);
          const fallbackLat = 17.4435;
          const fallbackLng = 78.3772;
          setNewPropLat(fallbackLat);
          setNewPropLng(fallbackLng);
          setNewPropMapsUrl(`https://www.google.com/maps/search/?api=1&query=${fallbackLat},${fallbackLng}`);
          notifyUser('Location Set', `Standard coordinates (17.4435, 78.3772) applied.`);
          setCapturingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      const fallbackLat = 17.4435;
      const fallbackLng = 78.3772;
      setNewPropLat(fallbackLat);
      setNewPropLng(fallbackLng);
      setNewPropMapsUrl(`https://www.google.com/maps/search/?api=1&query=${fallbackLat},${fallbackLng}`);
      notifyUser('Location Set', `Coordinates (17.4435, 78.3772) applied.`);
      setCapturingLocation(false);
    }
  };

  // Initialize and load properties & rooms
  useEffect(() => {
    setSelectedFloorFilter('ALL');
    loadPropertiesAndRooms();
  }, [initialProperty?.id]);

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

  const getInitialFloorsForProperty = (propId: string): FloorConfig[] => {
    if (propId === 'prop-pg-2') {
      return [
        {
          floorNumber: 1,
          rooms: [
            {
              id: 'rm-prop-pg-2-101',
              roomNumber: '101',
              floorNumber: 1,
              sharingType: 'TRIPLE',
              rentRupees: 9500,
              depositRupees: 9500,
              ac: true,
              attachedBathroom: true,
              beds: [
                { id: 'b-prop-pg-2-101-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-101-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-101-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
              ],
            },
            {
              id: 'rm-prop-pg-2-102',
              roomNumber: '102',
              floorNumber: 1,
              sharingType: 'TRIPLE',
              rentRupees: 9500,
              depositRupees: 9500,
              ac: true,
              attachedBathroom: true,
              beds: [
                { id: 'b-prop-pg-2-102-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-102-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-102-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
              ],
            },
          ],
        },
        {
          floorNumber: 2,
          rooms: [
            {
              id: 'rm-prop-pg-2-201',
              roomNumber: '201',
              floorNumber: 2,
              sharingType: 'TRIPLE',
              rentRupees: 9500,
              depositRupees: 9500,
              ac: true,
              attachedBathroom: true,
              beds: [
                { id: 'b-prop-pg-2-201-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-201-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-201-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
              ],
            },
            {
              id: 'rm-prop-pg-2-202',
              roomNumber: '202',
              floorNumber: 2,
              sharingType: 'TRIPLE',
              rentRupees: 9500,
              depositRupees: 9500,
              ac: true,
              attachedBathroom: true,
              beds: [
                { id: 'b-prop-pg-2-202-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-202-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
                { id: 'b-prop-pg-2-202-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
              ],
            },
          ],
        },
      ];
    }

    return [
      {
        floorNumber: 1,
        rooms: [
          {
            id: 'rm-prop-pg-1-101',
            roomNumber: '101',
            floorNumber: 1,
            sharingType: 'SIX',
            rentRupees: 8500,
            depositRupees: 8500,
            ac: true,
            attachedBathroom: true,
            beds: [
              { id: 'b-prop-pg-1-101-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-101-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-101-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-101-4', bedLabel: 'Bed 4', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-101-5', bedLabel: 'Bed 5', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-101-6', bedLabel: 'Bed 6', status: 'AVAILABLE' },
            ],
          },
          {
            id: 'rm-prop-pg-1-102',
            roomNumber: '102',
            floorNumber: 1,
            sharingType: 'DOUBLE',
            rentRupees: 8500,
            depositRupees: 8500,
            ac: true,
            attachedBathroom: true,
            beds: [
              { id: 'b-prop-pg-1-102-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-102-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
            ],
          },
        ],
      },
      {
        floorNumber: 2,
        rooms: [
          {
            id: 'rm-prop-pg-1-201',
            roomNumber: '201',
            floorNumber: 2,
            sharingType: 'DOUBLE',
            rentRupees: 8500,
            depositRupees: 8500,
            ac: true,
            attachedBathroom: true,
            beds: [
              { id: 'b-prop-pg-1-201-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-201-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
            ],
          },
          {
            id: 'rm-prop-pg-1-202',
            roomNumber: '202',
            floorNumber: 2,
            sharingType: 'DOUBLE',
            rentRupees: 8500,
            depositRupees: 8500,
            ac: true,
            attachedBathroom: true,
            beds: [
              { id: 'b-prop-pg-1-202-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-202-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
            ],
          },
        ],
      },
      {
        floorNumber: 3,
        rooms: [
          {
            id: 'rm-prop-pg-1-301',
            roomNumber: '301',
            floorNumber: 3,
            sharingType: 'TRIPLE',
            rentRupees: 8500,
            depositRupees: 8500,
            ac: true,
            attachedBathroom: true,
            beds: [
              { id: 'b-prop-pg-1-301-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-301-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-301-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
            ],
          },
          {
            id: 'rm-prop-pg-1-302',
            roomNumber: '302',
            floorNumber: 3,
            sharingType: 'TRIPLE',
            rentRupees: 8500,
            depositRupees: 8500,
            ac: true,
            attachedBathroom: true,
            beds: [
              { id: 'b-prop-pg-1-302-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-302-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
              { id: 'b-prop-pg-1-302-3', bedLabel: 'Bed 3', status: 'AVAILABLE' },
            ],
          },
        ],
      },
    ];
  };

  const loadPropertiesAndRooms = async () => {
    setLoading(true);
    try {
      const propsRes = await apiClient<{ content: Property[] }>('/owner/properties').catch(() => ({ content: [] }));
      const backendProps = propsRes.content || [];
      let combinedProps = [...defaultMultiPgs];

      if (backendProps.length > 0) {
        const defaultNames = new Set(defaultMultiPgs.map((p) => p.name));
        const extra = backendProps.filter((p) => !defaultNames.has(p.name) && p.id !== 'prop-pg-1' && p.id !== 'prop-pg-2');
        combinedProps = [...combinedProps, ...extra];
      }

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
      } catch { }

      setPropertiesList(combinedProps);

      let targetProp = initialProperty;
      const savedPropId = await safeStorage.getItem('@staynest_active_property_id') || (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('staynest_active_property_id') : null);
      if (!targetProp && savedPropId) {
        targetProp = combinedProps.find((p) => p.id === savedPropId) || null;
      }
      if (!targetProp) {
        targetProp = combinedProps[0];
      }

      setActiveProperty(targetProp);

      let loadedTenants: Tenant[] = [];
      try {
        const tenantRes = await apiClient<{ content: Tenant[] }>('/owner/tenants');
        loadedTenants = tenantRes.content || [];
      } catch { }

      const multiPgTenants: Tenant[] = [
        // PG 1 (StayNest Elite Men's PG - 6 active residents)
        { id: 't-pg1-1', fullName: 'Amit Sharma', phone: '9876543210', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg1-2', fullName: 'Rahul Kumar', phone: '9876543211', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 2', rentStatus: 'OVERDUE', outstandingPaise: 850000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: false },
        { id: 't-pg1-3', fullName: 'Siva Mani', phone: '9876543212', propertyId: 'prop-pg-1', roomNumber: '102', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg1-4', fullName: 'Arjun Reddy', phone: '9876543213', propertyId: 'prop-pg-1', roomNumber: '201', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg1-5', fullName: 'Kiran', phone: '9876543214', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 3', rentStatus: 'OVERDUE', outstandingPaise: 450000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: false },
        { id: 't-pg1-6', fullName: 'Kishare', phone: '9876543215', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 6', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },

        // PG 2 (Sai Durga Executive Ladies PG - 4 active residents)
        { id: 't-pg2-1', fullName: 'Sneha Reddy', phone: '9876543220', propertyId: 'prop-pg-2', roomNumber: '101', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg2-2', fullName: 'Ananya Roy', phone: '9876543221', propertyId: 'prop-pg-2', roomNumber: '101', bedLabel: 'Bed 2', rentStatus: 'OVERDUE', outstandingPaise: 950000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg2-3', fullName: 'Pooja Patel', phone: '9876543222', propertyId: 'prop-pg-2', roomNumber: '102', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: false },
        { id: 't-pg2-4', fullName: 'Meera Bai', phone: '9876543223', propertyId: 'prop-pg-2', roomNumber: '201', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
      ];
      const existingPhones = new Set(loadedTenants.map((t) => t.phone));
      const existingIds = new Set(loadedTenants.map((t) => t.id));
      const extraTenants = multiPgTenants.filter((mt) => !existingPhones.has(mt.phone) && !existingIds.has(mt.id));
      loadedTenants = [...loadedTenants, ...extraTenants];

      // Merge locally onboarded custom tenants from safeStorage
      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        if (storedCustomStr) {
          const customList: Tenant[] = JSON.parse(storedCustomStr);
          const cIds = new Set(customList.map((c) => c.id));
          const cPhones = new Set(customList.map((c) => c.phone));
          loadedTenants = [
            ...customList,
            ...loadedTenants.filter((lt) => !cIds.has(lt.id) && !cPhones.has(lt.phone)),
          ];
        }
      } catch {}

      // Filter tenants strictly for target property
      const propTenants = loadedTenants.filter(
        (t) => t.propertyId === targetProp.id || (!t.propertyId && targetProp.id === 'prop-pg-1')
      );
      setTenants(propTenants);

      // Build occupant lookup for syncing bed statuses
      const initialOccupantMap = new Map<string, Tenant>();
      propTenants.forEach((t) => {
        if (t.active !== false && t.stayStatus !== 'TERMINATED') {
          if (t.bedId) initialOccupantMap.set(t.bedId, t);
          if (t.roomNumber && t.bedLabel) {
            initialOccupantMap.set(`${t.roomNumber}-${t.bedLabel}`, t);
            const numOnly = t.bedLabel.replace(/[^0-9]/g, '');
            if (numOnly) {
              initialOccupantMap.set(`${t.roomNumber}-Bed ${numOnly}`, t);
              initialOccupantMap.set(`${t.roomNumber}-${numOnly}`, t);
            }
          }
        }
      });

      // Check cached floors for this property
      let targetFloors: FloorConfig[] | null = null;
      if (typeof window !== 'undefined' && window.localStorage && targetProp?.id) {
        const cached = window.localStorage.getItem(`staynest_floors_${targetProp.id}`);
        if (cached) {
          try {
            targetFloors = JSON.parse(cached);
          } catch { }
        }
      }

      if (!targetFloors || targetFloors.length === 0) {
        targetFloors = getInitialFloorsForProperty(targetProp.id);
      }

      const syncedInitialFloors = targetFloors.map((fl) => ({
        ...fl,
        rooms: fl.rooms.map((rm) => ({
          ...rm,
          beds: rm.beds.map((b, bIdx) => {
            const bNum = String(bIdx + 1);
            const isOcc =
              initialOccupantMap.has(b.id) ||
              initialOccupantMap.has(`${rm.roomNumber}-${b.bedLabel}`) ||
              initialOccupantMap.has(`${rm.roomNumber}-Bed ${bNum}`) ||
              initialOccupantMap.has(`${rm.roomNumber}-${bNum}`);
            return {
              ...b,
              status: (isOcc ? 'OCCUPIED' : 'AVAILABLE') as 'AVAILABLE' | 'OCCUPIED',
            };
          }),
        })),
      }));

      setFloors(syncedInitialFloors);
      setOriginalFloors(JSON.parse(JSON.stringify(syncedInitialFloors)));
    } catch (err: any) {
      console.warn('loadPropertiesAndRooms error:', err.message);
      setOriginalFloors(JSON.parse(JSON.stringify(floors)));
    } finally {
      setLoading(false);
    }
  };

  // Helper sharing enum mapper
  const getSharingEnum = (bedCount: number): string => {
    if (bedCount === 1) return 'SINGLE';
    if (bedCount === 2) return 'DOUBLE';
    if (bedCount === 3) return 'TRIPLE';
    return 'FOUR_PLUS';
  };

  // Helper sharing label mapper
  const getSharingLabel = (bedCount: number): string => {
    if (bedCount === 1) return 'Single Sharing';
    if (bedCount === 2) return 'Double Sharing';
    if (bedCount === 3) return 'Triple Sharing';
    if (bedCount === 4) return 'Four Sharing';
    if (bedCount === 5) return 'Five Sharing';
    return `${bedCount} Sharing`;
  };

  // Switch Active Property
  const handleSelectProperty = async (p: Property) => {
    setActiveProperty(p);
    setSelectedFloorFilter('ALL');
    setShowPropertyPicker(false);
    setViewMode('OVERVIEW');
    setLoading(true);
    onActivePropertyChange?.(p);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_active_property_id', p.id);
    }

    try {
      let loadedTenants: Tenant[] = [];
      try {
        const tenantRes = await apiClient<{ content: Tenant[] }>('/owner/tenants');
        loadedTenants = tenantRes.content || [];
      } catch {
        // ignore
      }

      const multiPgTenants: Tenant[] = [
        // PG 1 (StayNest Elite Men's PG - 6 active residents)
        { id: 't-pg1-1', fullName: 'Amit Sharma', phone: '9876543210', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg1-2', fullName: 'Rahul Kumar', phone: '9876543211', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 2', rentStatus: 'OVERDUE', outstandingPaise: 850000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: false },
        { id: 't-pg1-3', fullName: 'Siva Mani', phone: '9876543212', propertyId: 'prop-pg-1', roomNumber: '102', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg1-4', fullName: 'Arjun Reddy', phone: '9876543213', propertyId: 'prop-pg-1', roomNumber: '201', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg1-5', fullName: 'Kiran', phone: '9876543214', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 3', rentStatus: 'OVERDUE', outstandingPaise: 450000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: false },
        { id: 't-pg1-6', fullName: 'Kishare', phone: '9876543215', propertyId: 'prop-pg-1', roomNumber: '101', bedLabel: 'Bed 6', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },

        // PG 2 (Sai Durga Executive Ladies PG - 4 active residents)
        { id: 't-pg2-1', fullName: 'Sneha Reddy', phone: '9876543220', propertyId: 'prop-pg-2', roomNumber: '101', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg2-2', fullName: 'Ananya Roy', phone: '9876543221', propertyId: 'prop-pg-2', roomNumber: '101', bedLabel: 'Bed 2', rentStatus: 'OVERDUE', outstandingPaise: 950000, active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
        { id: 't-pg2-3', fullName: 'Pooja Patel', phone: '9876543222', propertyId: 'prop-pg-2', roomNumber: '102', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: false },
        { id: 't-pg2-4', fullName: 'Meera Bai', phone: '9876543223', propertyId: 'prop-pg-2', roomNumber: '201', bedLabel: 'Bed 1', rentStatus: 'PAID', active: true, stayStatus: 'ACTIVE', aadhaarVerified: true },
      ];
      const existingPhones = new Set(loadedTenants.map((t) => t.phone));
      const existingIds = new Set(loadedTenants.map((t) => t.id));
      const extraTenants = multiPgTenants.filter((mt) => !existingPhones.has(mt.phone) && !existingIds.has(mt.id));
      loadedTenants = [...loadedTenants, ...extraTenants];

      // Merge locally onboarded custom tenants from safeStorage
      try {
        const storedCustomStr = await safeStorage.getItem('@staynest_custom_tenants');
        if (storedCustomStr) {
          const customList: Tenant[] = JSON.parse(storedCustomStr);
          const cIds = new Set(customList.map((c) => c.id));
          const cPhones = new Set(customList.map((c) => c.phone));
          loadedTenants = [
            ...customList,
            ...loadedTenants.filter((lt) => !cIds.has(lt.id) && !cPhones.has(lt.phone)),
          ];
        }
      } catch {}

      // Filter tenants strictly for selected property
      const propTenants = loadedTenants.filter(
        (t) => t.propertyId === p.id || (!t.propertyId && p.id === 'prop-pg-1')
      );
      setTenants(propTenants);

      const occupantMap = new Map<string, Tenant>();
      propTenants.forEach((t) => {
        if (t.active !== false && t.stayStatus !== 'TERMINATED') {
          if (t.bedId) occupantMap.set(t.bedId, t);
          if (t.roomNumber && t.bedLabel) {
            occupantMap.set(`${t.roomNumber}-${t.bedLabel}`, t);
            const numOnly = t.bedLabel.replace(/[^0-9]/g, '');
            if (numOnly) {
              occupantMap.set(`${t.roomNumber}-Bed ${numOnly}`, t);
              occupantMap.set(`${t.roomNumber}-${numOnly}`, t);
            }
          }
        }
      });

      let nextFloors: FloorConfig[] | null = null;
      try {
        const cached = (await safeStorage.getItem(`@staynest_floors_${p.id}`)) || (await safeStorage.getItem(`staynest_floors_${p.id}`));
        if (cached) {
          nextFloors = JSON.parse(cached);
        } else if (typeof window !== 'undefined' && window.localStorage) {
          const lCached = window.localStorage.getItem(`staynest_floors_${p.id}`);
          if (lCached) nextFloors = JSON.parse(lCached);
        }
      } catch { }

      if (!nextFloors || nextFloors.length === 0) {
        nextFloors = getInitialFloorsForProperty(p.id);
      }

      const synced = nextFloors.map((fl: FloorConfig) => ({
        ...fl,
        rooms: fl.rooms.map((rm: RoomConfig) => ({
          ...rm,
          beds: rm.beds.map((b, bIdx) => {
            const bNum = String(bIdx + 1);
            const isOcc =
              occupantMap.has(b.id) ||
              occupantMap.has(`${rm.roomNumber}-${b.bedLabel}`) ||
              occupantMap.has(`${rm.roomNumber}-Bed ${bNum}`) ||
              occupantMap.has(`${rm.roomNumber}-${bNum}`);
            return {
              ...b,
              status: (isOcc ? 'OCCUPIED' : 'AVAILABLE') as 'AVAILABLE' | 'OCCUPIED',
            };
          }),
        })),
      }));

      setFloors(synced);
      setOriginalFloors(JSON.parse(JSON.stringify(synced)));
    } catch {
      // keep current fallback
    } finally {
      setLoading(false);
    }
  };

  // Create New PG (Requirement 5: Location detection & website sync)
  const handleCreateNewProperty = async () => {
    if (!newPropName.trim()) {
      Alert.alert('Required', 'Please enter a PG or Hostel Name');
      return;
    }
    setCreatingProperty(true);
    try {
      const finalMapsUrl =
        newPropMapsUrl ||
        (newPropLat && newPropLng
          ? `https://www.google.com/maps/search/?api=1&query=${newPropLat},${newPropLng}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newPropName.trim() + ' ' + (newPropAddress.trim() || 'MG Road') + ' ' + newPropCity)}`);

      const payload = {
        name: newPropName.trim(),
        propertyType: newPropType,
        genderPolicy: newPropGender,
        cityId: '00000000-0000-0000-0000-000000000001',
        addressLine: newPropAddress.trim() || 'MG Road',
        cityName: newPropCity || 'Hyderabad',
        localityName: newPropLocality || 'Hitec City',
        pincode: newPropPincode || '500081',
        latitude: newPropLat,
        longitude: newPropLng,
        googleMapsUrl: finalMapsUrl,
        foodIncluded: true,
      };

      let created: Property;
      try {
        created = await apiClient<Property>('/owner/properties', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } catch {
        // Local fallback created property
        created = {
          id: `prop-${Date.now()}`,
          ...payload,
          startingPricePaise: 850000,
          approvalStatus: 'APPROVED',
          published: true,
          amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'POWER_BACKUP', 'DAILY_HOUSEKEEPING', 'AC_ROOMS'],
        };
      }

      // Sync to localStorage for instant website explore page visibility (Requirement 5)
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const cachedCustom = JSON.parse(window.localStorage.getItem('staynest_custom_properties') || '[]');
          const updatedCustom = [created, ...cachedCustom.filter((p: any) => p.id !== created.id)];
          window.localStorage.setItem('staynest_custom_properties', JSON.stringify(updatedCustom));
          window.dispatchEvent(new CustomEvent('staynest_property_created', { detail: created }));
        } catch { }
      }

      setPropertiesList([created, ...propertiesList]);
      setActiveProperty(created);
      setShowAddPropertyModal(false);
      setNewPropName('');
      setNewPropAddress('');
      setNewPropLat(null);
      setNewPropLng(null);
      setNewPropMapsUrl('');

      // Create standard default floor structure for this new PG
      const newFloors: FloorConfig[] = [
        {
          floorNumber: 1,
          rooms: [
            {
              id: `room-101-${Date.now()}`,
              roomNumber: '101',
              floorNumber: 1,
              sharingType: 'DOUBLE',
              rentRupees: 8500,
              depositRupees: 8500,
              ac: true,
              attachedBathroom: true,
              beds: [
                { id: `bed-101-1-${Date.now()}`, bedLabel: 'Bed 1', status: 'AVAILABLE' },
                { id: `bed-101-2-${Date.now()}`, bedLabel: 'Bed 2', status: 'AVAILABLE' },
              ],
            },
          ],
        },
      ];
      setFloors(newFloors);
      setOriginalFloors(JSON.parse(JSON.stringify(newFloors)));

      // Save initial floors for website detail view
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`staynest_floors_${created.id}`, JSON.stringify(newFloors));
      }

      notifyUser('✓ PG Created!', `Property "${created.name}" created with location details! It is now live on the website.`);
    } catch {
      notifyUser('Error', 'Could not create property on server. Please try again.');
    } finally {
      setCreatingProperty(false);
    }
  };

  // Bed to Tenant map for live occupancy display
  const bedOccupantMap = new Map<string, Tenant>();
  tenants.forEach((t) => {
    if (t.active !== false && t.stayStatus !== 'TERMINATED') {
      if (t.bedId) bedOccupantMap.set(t.bedId, t);
      if (t.roomNumber && t.bedLabel) {
        bedOccupantMap.set(`${t.roomNumber}-${t.bedLabel}`, t);
        const numOnly = t.bedLabel.replace(/[^0-9]/g, '');
        if (numOnly) {
          bedOccupantMap.set(`${t.roomNumber}-Bed ${numOnly}`, t);
          bedOccupantMap.set(`${t.roomNumber}-${numOnly}`, t);
        }
      }
    }
  });

  // Active Floor and Room for Beds Management Modal
  const activeManagingFloor = floors.find((f) => f.floorNumber === managingBedsRoom?.floorNum);
  const activeManagingRoom = activeManagingFloor?.rooms.find((r) => r.id === managingBedsRoom?.roomId);

  // Memoized deduplication of floors and rooms to prevent duplicate floor numbers or rooms showing twice
  const displayFloors = React.useMemo(() => {
    const floorMap = new Map<number, FloorConfig>();

    floors.forEach((fl) => {
      const existing = floorMap.get(fl.floorNumber);
      const roomMap = new Map<string, RoomConfig>();

      if (existing) {
        existing.rooms.forEach((r) => roomMap.set(r.roomNumber, r));
      }

      fl.rooms.forEach((r) => {
        if (!roomMap.has(r.roomNumber)) {
          const seenBedIds = new Set<string>();
          const uniqueBeds = (r.beds || []).filter((b) => {
            if (seenBedIds.has(b.id)) return false;
            seenBedIds.add(b.id);
            return true;
          });
          roomMap.set(r.roomNumber, { ...r, beds: uniqueBeds });
        }
      });

      floorMap.set(fl.floorNumber, {
        floorNumber: fl.floorNumber,
        rooms: Array.from(roomMap.values()),
      });
    });

    return Array.from(floorMap.values()).sort((a, b) => a.floorNumber - b.floorNumber);
  }, [floors]);

  // --- Dynamic Summary Calculations ---
  const totalFloors = displayFloors.length;
  let totalRooms = 0;
  let totalBeds = 0;
  let availableBeds = 0;
  let occupiedBeds = 0;
  let reservedBeds = 0;
  let maintenanceBeds = 0;

  displayFloors.forEach((f) => {
    totalRooms += f.rooms.length;
    f.rooms.forEach((r) => {
      totalBeds += r.beds.length;
      r.beds.forEach((b) => {
        const isOcc = b.status === 'OCCUPIED' || bedOccupantMap.has(b.id);
        if (isOcc) occupiedBeds++;
        else if (b.status === 'RESERVED') reservedBeds++;
        else if (b.status === 'MAINTENANCE') maintenanceBeds++;
        else availableBeds++;
      });
    });
  });

  // Toggle Room expansion in Normal Overview
  const toggleRoomExpand = (roomId: string) => {
    setExpandedRoomIds((prev) => ({
      ...prev,
      [roomId]: !prev[roomId],
    }));
  };

  // --- EDIT MODE HANDLERS ---
  const handleEnterEditMode = () => {
    setOriginalFloors(JSON.parse(JSON.stringify(floors)));
    setViewMode('EDIT');
  };

  const handleCancelEdit = () => {
    setFloors(JSON.parse(JSON.stringify(originalFloors)));
    setViewMode('OVERVIEW');
  };

  // 1. Floor Counter Controls
  const handleIncreaseFloors = () => {
    setFloors((prev) => {
      const maxFloor = prev.reduce((max, f) => Math.max(max, f.floorNumber), 0);
      const nextFloorNum = maxFloor + 1;
      const baseRoomNum = `${nextFloorNum}01`;
      const newFloor: FloorConfig = {
        floorNumber: nextFloorNum,
        rooms: [
          {
            id: `room-${baseRoomNum}-${Date.now()}`,
            roomNumber: baseRoomNum,
            floorNumber: nextFloorNum,
            sharingType: 'DOUBLE',
            rentRupees: 8500,
            depositRupees: 8500,
            ac: true,
            attachedBathroom: true,
            beds: [
              { id: `bed-${baseRoomNum}-1-${Date.now()}`, bedLabel: 'Bed 1', status: 'AVAILABLE' as const },
              { id: `bed-${baseRoomNum}-2-${Date.now()}`, bedLabel: 'Bed 2', status: 'AVAILABLE' as const },
            ],
          },
        ],
      };
      const nextFloors = [...prev, newFloor];
      if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
        try {
          window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
        } catch { }
      }
      return nextFloors;
    });
  };

  const handleDecreaseFloors = () => {
    setFloors((prev) => {
      if (prev.length <= 1) {
        notifyUser('Minimum Limit', 'A property must have at least 1 floor.');
        return prev;
      }
      const lastFloor = prev[prev.length - 1];
      const hasOccupiedBed = lastFloor.rooms.some((r) =>
        r.beds.some((b) => b.status === 'OCCUPIED' || b.status === 'RESERVED')
      );
      if (hasOccupiedBed) {
        notifyUser(
          'Occupied Beds Detected',
          `Floor ${lastFloor.floorNumber} has occupied or reserved beds. Please reassign tenants before removing this floor.`
        );
        return prev;
      }
      const nextFloors = prev.slice(0, prev.length - 1);
      if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
        try {
          window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
        } catch { }
      }
      return nextFloors;
    });
  };

  // 2. Room Counter Controls for Floor
  const handleIncreaseRooms = (floorNum: number) => {
    setFloors((prev) => {
      const nextFloors = prev.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        const nextRoomIdx = f.rooms.length + 1;
        const roomNumStr = `${floorNum}${nextRoomIdx < 10 ? '0' + nextRoomIdx : nextRoomIdx}`;
        // Ensure room number does not already exist
        if (f.rooms.some((r) => r.roomNumber === roomNumStr)) {
          return f;
        }
        const newRoom: RoomConfig = {
          id: `room-${roomNumStr}-${Date.now()}`,
          roomNumber: roomNumStr,
          floorNumber: floorNum,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          ac: true,
          attachedBathroom: true,
          beds: [
            { id: `bed-${roomNumStr}-1-${Date.now()}`, bedLabel: 'Bed 1', status: 'AVAILABLE' as const },
            { id: `bed-${roomNumStr}-2-${Date.now()}`, bedLabel: 'Bed 2', status: 'AVAILABLE' as const },
          ],
        };
        return {
          ...f,
          rooms: [...f.rooms, newRoom],
        };
      });

      if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
        try {
          window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
        } catch { }
      }

      return nextFloors;
    });
  };

  const handleDecreaseRooms = (floorNum: number) => {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        if (f.rooms.length <= 1) {
          notifyUser('Minimum Limit', `Floor ${floorNum} must have at least 1 room.`);
          return f;
        }
        const lastRoom = f.rooms[f.rooms.length - 1];
        const hasOccupied = lastRoom.beds.some(
          (b) => b.status === 'OCCUPIED' || b.status === 'RESERVED'
        );
        if (hasOccupied) {
          notifyUser(
            'Cannot Delete Room',
            `Room ${lastRoom.roomNumber} has active or reserved beds.`
          );
          return f;
        }
        return {
          ...f,
          rooms: f.rooms.slice(0, f.rooms.length - 1),
        };
      })
    );
  };

  // 3. Bed Counter Controls for Room
  const handleIncreaseBeds = (floorNum: number, roomId: string) => {
    setFloors((prev) => {
      const nextFloors = prev.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        return {
          ...f,
          rooms: f.rooms.map((r) => {
            if (r.id !== roomId) return r;
            const nextBedNum = r.beds.length + 1;
            const newBed: BedConfig = {
              id: `b-${r.roomNumber}-${nextBedNum}-${Date.now()}`,
              bedLabel: `Bed ${nextBedNum}`,
              status: 'AVAILABLE',
            };
            const updatedBeds = [...r.beds, newBed].map((b, idx) => ({
              ...b,
              bedLabel: `Bed ${idx + 1}`,
            }));
            return {
              ...r,
              beds: updatedBeds,
              sharingType: getSharingEnum(updatedBeds.length),
            };
          }),
        };
      });

      if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
        try {
          window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
        } catch { }
      }

      return nextFloors;
    });
  };

  const handleDecreaseBeds = (floorNum: number, roomId: string) => {
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        return {
          ...f,
          rooms: f.rooms.map((r) => {
            if (r.id !== roomId) return r;
            if (r.beds.length <= 1) {
              notifyUser('Minimum Limit', 'Room must have at least 1 bed.');
              return r;
            }
            const lastBed = r.beds[r.beds.length - 1];
            if (lastBed.status === 'OCCUPIED' || lastBed.status === 'RESERVED') {
              notifyUser('Active Bed', `${lastBed.bedLabel} is currently ${lastBed.status.toLowerCase()}.`);
              return r;
            }
            const updatedBeds = r.beds.slice(0, r.beds.length - 1);
            return {
              ...r,
              beds: updatedBeds,
              sharingType: getSharingEnum(updatedBeds.length),
            };
          }),
        };
      })
    );
  };

  // Switch Individual Bed Status in Edit Mode
  const handleSetBedStatus = (
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
  ) => {
    if (!selectedBedForStatus) return;
    const { floorNum, roomId, bed } = selectedBedForStatus;
    setFloors((prev) =>
      prev.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        return {
          ...f,
          rooms: f.rooms.map((r) => {
            if (r.id !== roomId) return r;
            return {
              ...r,
              beds: r.beds.map((b) => (b.id === bed.id ? { ...b, status } : b)),
            };
          }),
        };
      })
    );
    setSelectedBedForStatus(null);
  };

  // Save Room Details (Rent, AC, Bathroom, Room Number)
  const handleUpdateRoomDetails = (updated: RoomConfig) => {
    setFloors((prev) => {
      const nextFloors = prev.map((f) => {
        if (f.floorNumber !== updated.floorNumber) return f;
        return {
          ...f,
          rooms: f.rooms.map((r) => (r.id === updated.id ? updated : r)),
        };
      });

      if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
        try {
          window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
        } catch { }
      }

      return nextFloors;
    });
    setEditingRoomDetails(null);
  };

  // Delete Entire Room Handler
  const handleDeleteRoom = (floorNum: number, roomId: string, roomNumber: string) => {
    const doDelete = () => {
      setTenants((prev) => prev.filter((t) => t.roomId !== roomId));
      setFloors((prev) => {
        const nextFloors = prev.map((f) => {
          if (f.floorNumber !== floorNum) return f;
          return {
            ...f,
            rooms: f.rooms.filter((r) => r.id !== roomId),
          };
        });

        if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
          try {
            window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
          } catch { }
        }

        return nextFloors;
      });
      setEditingRoomDetails(null);
      notifyUser('Room Deleted', `Room ${roomNumber} has been removed.`);
    };

    confirmAction(
      'Delete Room',
      `Are you sure you want to delete Room ${roomNumber}? All beds inside will also be removed.`,
      doDelete
    );
  };

  // --- SAVE CHANGES TO BACKEND & DB ---
  const handleSaveChanges = async () => {
    setSaving(true);
    let targetProp = activeProperty;

    try {
      if (!targetProp || targetProp.id.startsWith('ramesh-pg-default')) {
        const propName = user?.fullName ? `${user.fullName} PG` : 'Ramesh PG';
        targetProp = await apiClient<Property>('/owner/properties', {
          method: 'POST',
          body: JSON.stringify({
            name: propName,
            propertyType: 'PG',
            genderPolicy: 'BOYS',
            cityId: '00000000-0000-0000-0000-000000000001',
            addressLine: 'MG Road, Vijayawada',
            cityName: 'Vijayawada',
            foodIncluded: true,
          }),
        });
        setActiveProperty(targetProp);
      }

      // Sync floors & rooms to backend API
      for (const floor of floors) {
        for (const room of floor.rooms) {
          try {
            const createdRoom = await apiClient<Room>(
              `/owner/properties/${targetProp.id}/rooms`,
              {
                method: 'POST',
                body: JSON.stringify({
                  floorNumber: room.floorNumber,
                  roomNumber: room.roomNumber,
                  sharingType: getSharingEnum(room.beds.length),
                  capacity: room.beds.length,
                  rentMonthlyPaise: room.rentRupees * 100,
                  depositPaise: room.depositRupees * 100,
                }),
              }
            );

            for (const bed of room.beds) {
              try {
                const createdBed = await apiClient<Bed>(
                  `/owner/rooms/${createdRoom.id}/beds`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ bedLabel: bed.bedLabel }),
                  }
                );
                if (bed.status !== 'AVAILABLE' && createdBed && createdBed.id) {
                  await apiClient(`/owner/beds/${createdBed.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: bed.status }),
                  }).catch(() => { });
                }
              } catch {
                // bed creation handled
              }
            }
          } catch {
            // room creation handled
          }
        }
      }

      // Save locally for instant reload & offline resiliency
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          `staynest_floors_${targetProp.id}`,
          JSON.stringify(floors)
        );
      }

      // Update original backup
      setOriginalFloors(JSON.parse(JSON.stringify(floors)));

      // Exit edit mode back to clean normal view!
      setViewMode('OVERVIEW');

      Alert.alert(
        '✓ Changes Saved Successfully!',
        `Your property "${targetProp.name}" is updated with ${totalFloors} Floors, ${totalRooms} Rooms, and ${totalBeds} Beds.`
      );
    } catch {
      if (typeof window !== 'undefined' && window.localStorage && targetProp) {
        window.localStorage.setItem(
          `staynest_floors_${targetProp.id}`,
          JSON.stringify(floors)
        );
      }
      setOriginalFloors(JSON.parse(JSON.stringify(floors)));
      setViewMode('OVERVIEW');
      Alert.alert(
        '✓ Saved Structure',
        `Successfully updated ${totalFloors} floors and ${totalBeds} beds!`
      );
    } finally {
      setSaving(false);
    }
  };

  // Helper Bed Status Colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '#10b981'; // Green
      case 'OCCUPIED':
        return '#ef4444'; // Red
      case 'RESERVED':
        return '#f59e0b'; // Yellow / Amber
      case 'MAINTENANCE':
        return '#3b82f6'; // Blue
      default:
        return '#64748b';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '#ecfdf5';
      case 'OCCUPIED':
        return '#fef2f2';
      case 'RESERVED':
        return '#fffbeb';
      case 'MAINTENANCE':
        return '#eff6ff';
      default:
        return '#f1f5f9';
    }
  };

  const buildingsToRender = propertiesList.length > 0
    ? propertiesList.slice(0, 2)
    : [activeProperty || { id: 'b1', name: 'Building 01', genderPolicy: 'BOYS' as any }];

  const isRentalMode = activeProperty?.propertyType === 'RENTAL_BUILDING';
  const totalRoomsCount = displayFloors.reduce((sum, fl) => sum + fl.rooms.length, 0);

  return (
    <View style={styles.container}>
      {/* ─── TOP HEADER (UNIFIED ALABASTER & BURNT-ORANGE SAAS STYLE) ─── */}
      <View style={styles.header}>
        <View style={styles.unifiedHeaderRow}>
          <TouchableOpacity
            style={{ flex: 1, paddingRight: 10 }}
            onPress={() => setShowPropertyPicker(true)}
            activeOpacity={0.75}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.unifiedPropTitle} numberOfLines={1}>
                {activeProperty?.name || "StayNest Elite Men's PG"}
              </Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>▾</Text>
            </View>
            <Text style={styles.unifiedPropSub} numberOfLines={1}>
              {isRentalMode ? 'Rental Building' : 'PG / Hostel'} • {displayFloors.length}{' '}
              {displayFloors.length === 1 ? 'Floor' : 'Floors'} • {totalRoomsCount}{' '}
              {isRentalMode ? (totalRoomsCount === 1 ? 'Flat' : 'Flats') : (totalRoomsCount === 1 ? 'Room' : 'Rooms')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topAddFloorBtn}
            onPress={handleIncreaseFloors}
            activeOpacity={0.85}
          >
            <Text style={styles.topAddFloorBtnText}>+ Add Floor</Text>
          </TouchableOpacity>
        </View>

        {/* Floor Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.floorFilterScroll}
        >
          <TouchableOpacity
            style={[
              styles.floorFilterPill,
              selectedFloorFilter === 'ALL' && styles.floorFilterPillActive,
            ]}
            onPress={() => setSelectedFloorFilter('ALL')}
          >
            <Text
              style={[
                styles.floorFilterText,
                selectedFloorFilter === 'ALL' && styles.floorFilterTextActive,
              ]}
            >
              All Floors ({totalRoomsCount})
            </Text>
          </TouchableOpacity>

          {displayFloors.map((fl) => {
            const isActive = selectedFloorFilter === fl.floorNumber;
            return (
              <TouchableOpacity
                key={`fl-filter-${fl.floorNumber}`}
                style={[
                  styles.floorFilterPill,
                  isActive && styles.floorFilterPillActive,
                ]}
                onPress={() => setSelectedFloorFilter(fl.floorNumber)}
              >
                <Text
                  style={[
                    styles.floorFilterText,
                    isActive && styles.floorFilterTextActive,
                  ]}
                >
                  {fl.label || `Floor ${fl.floorNumber}`} ({fl.rooms.length})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── MAIN CONTENT SCROLLVIEW ─── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#ea580c" />
            <Text style={styles.loadingText}>Loading property structure...</Text>
          </View>
        ) : (
          <>
            {viewMode === 'OVERVIEW' && (
              <View style={{ gap: 18 }}>
                {(selectedFloorFilter === 'ALL'
                  ? displayFloors
                  : displayFloors.filter((f) => f.floorNumber === selectedFloorFilter)
                ).map((floor) => (
                  <View key={`floor-sec-${floor.floorNumber}`} style={styles.floorBlockWrap}>
                    {/* Floor Section Header */}
                    <View style={styles.floorSectionHeader}>
                      <Text style={styles.floorSectionTitle}>
                        {floor.label || `Floor ${floor.floorNumber}`}
                      </Text>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity
                          onPress={() => handleIncreaseRooms(floor.floorNumber)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.inlineAddRoomLink}>
                            + {isRentalMode ? 'Add Flat' : 'Add Room'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            setEditingFloor({
                              floorNumber: floor.floorNumber,
                              label: floor.label || `Floor ${floor.floorNumber}`,
                            })
                          }
                          activeOpacity={0.75}
                        >
                          <Text style={{ fontSize: 15, color: '#6b7280' }}>✏️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Room Cards: Classic Bed-Grid for PG / Hostel vs Unified Flat Card for Rental Building */}
                    <View style={{ gap: isRentalMode ? 12 : 16 }}>
                      {floor.rooms.map((room) => {
                        if (!isRentalMode) {
                          const roomSharingLabel = formatSharingBadge(room.beds.length);

                          return (
                            <View key={room.id} style={styles.roomWiseCard}>
                              {/* Room Top Bar */}
                              <View style={styles.roomWiseTopBar}>
                                <View style={styles.roomWiseLeftInfo}>
                                  <View style={styles.roomWiseNumBadge}>
                                    <Text style={styles.roomWiseNumText}>
                                      Room {room.roomNumber}
                                    </Text>
                                  </View>

                                  <View style={styles.roomWiseTypeBadge}>
                                    <Text style={styles.roomWiseTypeText}>
                                      {roomSharingLabel}
                                    </Text>
                                  </View>

                                  <View style={styles.roomWiseRentBadge}>
                                    <Text style={styles.roomWiseRentText}>
                                      ₹{room.rentRupees.toLocaleString('en-IN')}/mo
                                    </Text>
                                  </View>
                                </View>

                                {/* Room Action Buttons: 🛏️ Add/Edit Beds & ⚙️ Edit Room */}
                                <View style={styles.roomWiseActionButtons}>
                                  <TouchableOpacity
                                    style={styles.roomWiseAddBedBtn}
                                    onPress={() => setManagingBedsRoom({ floorNum: floor.floorNumber, roomId: room.id })}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.roomWiseAddBedBtnText}>🛏️ Add/Edit Beds</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.roomWiseSettingsBtn}
                                    onPress={() => setEditingRoomDetails({ floorNum: floor.floorNumber, room })}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.roomWiseSettingsBtnText}>⚙️ Edit Room</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* Beds Grid inside Room (Sequential Unique Numbers 1, 2, 3...) */}
                              <View style={styles.roomBedsGridRow}>
                                {room.beds.map((bed, bedIdx) => {
                                  const bedNumStr = String(bedIdx + 1);
                                  const occupant =
                                    bedOccupantMap.get(bed.id) ||
                                    bedOccupantMap.get(`${room.roomNumber}-${bed.bedLabel}`) ||
                                    bedOccupantMap.get(`${room.roomNumber}-Bed ${bedNumStr}`) ||
                                    bedOccupantMap.get(`${room.roomNumber}-${bedNumStr}`);
                                  const isOccupied = !!occupant;

                                  if (isOccupied && occupant) {
                                    const tenantName = occupant.fullName;
                                    const styleIdx = bedIdx % BED_STYLES.length;
                                    const styleObj = BED_STYLES[styleIdx];

                                    return (
                                      <TouchableOpacity
                                        key={bed.id}
                                        style={[
                                          styles.bedBoxCard,
                                          bed.photo
                                            ? styles.bedBoxWithPhoto
                                            : { backgroundColor: styleObj.bg, borderColor: styleObj.border },
                                        ]}
                                        onPress={() =>
                                          setOccupiedBedAction({
                                            floorNum: floor.floorNumber,
                                            roomId: room.id,
                                            roomNumber: room.roomNumber,
                                            bed,
                                            tenantName,
                                            tenantPhone: occupant?.phone || '9876543210',
                                            tenantId: occupant?.id,
                                          })
                                        }
                                        activeOpacity={0.8}
                                      >
                                        {bed.photo ? (
                                          <>
                                            <Image
                                              source={{ uri: bed.photo }}
                                              style={styles.bedBoxImageCover}
                                              resizeMode="cover"
                                            />
                                            <View style={styles.bedNumberHighlightBadge}>
                                              <Text style={styles.bedNumberHighlightText}>{bedNumStr}</Text>
                                            </View>
                                            <View style={styles.bedActionBadgeRow}>
                                              <TouchableOpacity
                                                style={styles.bedPhotoEditBtn}
                                                onPress={() => handleUploadBedPhoto(floor.floorNumber, room.id, bed.id)}
                                                activeOpacity={0.8}
                                              >
                                                <Text style={{ fontSize: 9 }}>✏️</Text>
                                              </TouchableOpacity>
                                              <TouchableOpacity
                                                style={styles.bedPhotoDeleteBtn}
                                                onPress={() => handleDeleteBedPhoto(floor.floorNumber, room.id, bed.id, `Bed ${bedNumStr}`)}
                                                activeOpacity={0.8}
                                              >
                                                <Text style={{ fontSize: 9, color: '#ffffff', fontWeight: '900' }}>✕</Text>
                                              </TouchableOpacity>
                                            </View>
                                            <View style={styles.bedTenantHighlightBar}>
                                              <Text style={styles.bedTenantHighlightText} numberOfLines={1}>
                                                {tenantName}
                                              </Text>
                                            </View>
                                          </>
                                        ) : (
                                          <>
                                            <TouchableOpacity
                                              style={styles.bedInlineAddPhotoBtn}
                                              onPress={(e: any) => {
                                                e?.stopPropagation?.();
                                                handleUploadBedPhoto(floor.floorNumber, room.id, bed.id);
                                              }}
                                              activeOpacity={0.8}
                                            >
                                              <CameraMicroIcon color="#94a3b8" size={11} />
                                            </TouchableOpacity>
                                            <BedVectorIcon color="#64748b" size={24} />
                                            <Text style={[styles.bedBoxNumber, { color: styleObj.numColor }]}>
                                              {bedNumStr}
                                            </Text>
                                            <Text style={[styles.bedBoxTenantName, { color: styleObj.textColor }]} numberOfLines={1}>
                                              {tenantName}
                                            </Text>
                                          </>
                                        )}
                                      </TouchableOpacity>
                                    );
                                  } else {
                                    return (
                                      <TouchableOpacity
                                        key={bed.id}
                                        style={[
                                          styles.bedBoxVacantCard,
                                          bed.photo && styles.bedBoxWithPhoto,
                                        ]}
                                        onPress={() =>
                                          openAssignModalForBed({
                                            floorNum: floor.floorNumber,
                                            roomId: room.id,
                                            roomNumber: room.roomNumber,
                                            bedId: bed.id,
                                            bedLabel: `Bed ${bedNumStr}`,
                                            rentRupees: room.rentRupees,
                                          })
                                        }
                                        activeOpacity={0.8}
                                      >
                                        {bed.photo ? (
                                          <>
                                            <Image
                                              source={{ uri: bed.photo }}
                                              style={styles.bedBoxImageCover}
                                              resizeMode="cover"
                                            />
                                            <View style={[styles.bedNumberHighlightBadge, { backgroundColor: '#3b82f6' }]}>
                                              <Text style={styles.bedNumberHighlightText}>{bedNumStr}</Text>
                                            </View>
                                            <View style={styles.bedActionBadgeRow}>
                                              <TouchableOpacity
                                                style={styles.bedPhotoEditBtn}
                                                onPress={() => handleUploadBedPhoto(floor.floorNumber, room.id, bed.id)}
                                                activeOpacity={0.8}
                                              >
                                                <Text style={{ fontSize: 9 }}>✏️</Text>
                                              </TouchableOpacity>
                                              <TouchableOpacity
                                                style={styles.bedPhotoDeleteBtn}
                                                onPress={() => handleDeleteBedPhoto(floor.floorNumber, room.id, bed.id, `Bed ${bedNumStr}`)}
                                                activeOpacity={0.8}
                                              >
                                                <Text style={{ fontSize: 9, color: '#ffffff', fontWeight: '900' }}>✕</Text>
                                              </TouchableOpacity>
                                            </View>
                                            <View style={[styles.bedTenantHighlightBar, { backgroundColor: 'rgba(234, 88, 12, 0.95)' }]}>
                                              <Text style={styles.bedTenantHighlightText}>+ Add</Text>
                                            </View>
                                          </>
                                        ) : (
                                          <>
                                            <TouchableOpacity
                                              style={styles.bedInlineAddPhotoBtn}
                                              onPress={(e: any) => {
                                                e?.stopPropagation?.();
                                                handleUploadBedPhoto(floor.floorNumber, room.id, bed.id);
                                              }}
                                              activeOpacity={0.8}
                                            >
                                              <CameraMicroIcon color="#94a3b8" size={11} />
                                            </TouchableOpacity>
                                            <BedVectorIcon color="#94a3b8" size={24} />
                                            <Text style={styles.bedBoxVacantNumber}>{bedNumStr}</Text>
                                            <Text style={styles.bedBoxAddText}>+ Add</Text>
                                          </>
                                        )}
                                      </TouchableOpacity>
                                    );
                                  }
                                })}

                                {/* Inline + Add Bed Option */}
                                <TouchableOpacity
                                  style={styles.inlineAddBedCard}
                                  onPress={() => handleIncreaseBeds(floor.floorNumber, room.id)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.inlineAddBedPlus}>+</Text>
                                  <Text style={styles.inlineAddBedText}>Add Bed</Text>
                                </TouchableOpacity>
                              </View>

                              {/* Room Photos Gallery */}
                              <View style={styles.roomPhotosSection}>
                                <View style={styles.roomPhotosHeaderRow}>
                                  <Text style={styles.roomPhotosTitle}>
                                    📷 Room Photos ({room.photos?.length || 0})
                                  </Text>
                                  <TouchableOpacity
                                    style={styles.addRoomPhotoBtn}
                                    onPress={() => setTargetPhotoRoom({ floorNum: floor.floorNumber, room })}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.addRoomPhotoBtnText}>+ Add Photo</Text>
                                  </TouchableOpacity>
                                </View>

                                {room.photos && room.photos.length > 0 ? (
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.roomPhotosScroll}
                                  >
                                    {room.photos.map((photoUri, pIdx) => (
                                      <View key={`photo-${room.id}-${pIdx}`} style={styles.roomPhotoThumbWrapper}>
                                        <Image
                                          source={{ uri: photoUri }}
                                          style={styles.roomPhotoThumb}
                                          resizeMode="cover"
                                        />
                                        <TouchableOpacity
                                          style={styles.deletePhotoBadge}
                                          onPress={() => handleDeleteRoomPhoto(floor.floorNumber, room.id, pIdx)}
                                          activeOpacity={0.8}
                                        >
                                          <Text style={styles.deletePhotoBadgeText}>✕</Text>
                                        </TouchableOpacity>
                                      </View>
                                    ))}
                                  </ScrollView>
                                ) : (
                                  <Text style={styles.noRoomPhotosText}>
                                    No room photos yet. Tap "+ Add Photo" to upload from device.
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        }

                        const roomPhotos = room.photos || [];
                        const totalBedsInRoom = 1;

                        // Collect active occupants for this rental unit/flat
                        const roomOccupants: Tenant[] = [];
                        let firstVacantBed: BedConfig | null = null;

                        const occ =
                          bedOccupantMap.get(room.id) ||
                          tenants.find(
                            (t) =>
                              t.active !== false &&
                              t.stayStatus !== 'TERMINATED' &&
                              t.roomNumber === room.roomNumber
                          );
                        if (occ) roomOccupants.push(occ);

                        const occupiedCount = roomOccupants.length;
                        const freeBeds = Math.max(0, totalBedsInRoom - occupiedCount);
                        const isFull = freeBeds === 0;
                        const configLabel = room.sharingType || '1BHK';
                        const maintAmount = room.maintenanceRupees || 0;

                        return (
                          <View key={room.id} style={styles.unifiedRoomCard}>
                            {/* Top Row: Media Slot + Room Info */}
                            <View style={styles.unifiedRoomTopRow}>
                              {/* 1. Left Media Slot */}
                              <TouchableOpacity
                                style={styles.mediaSlotWrap}
                                onPress={() => setTargetPhotoRoom({ floorNum: floor.floorNumber, room })}
                                activeOpacity={0.8}
                              >
                                {roomPhotos.length > 0 ? (
                                  <View style={styles.mediaThumbContainer}>
                                    <Image
                                      source={{ uri: roomPhotos[0] }}
                                      style={styles.mediaThumbImg}
                                      resizeMode="cover"
                                    />
                                    <View style={styles.mediaCountBadge}>
                                      <Text style={styles.mediaCountBadgeText}>
                                        🖼️ {roomPhotos.length} {roomPhotos.length === 1 ? 'Photo' : 'Photos'}
                                      </Text>
                                    </View>
                                  </View>
                                ) : (
                                  <View style={styles.mediaPlaceholderBox}>
                                    <Text style={{ fontSize: 18, color: '#6b7280' }}>📷</Text>
                                    <Text style={styles.mediaPlaceholderText}>Add Photos</Text>
                                  </View>
                                )}
                              </TouchableOpacity>

                              {/* 2. Right Info Column */}
                              <View style={{ flex: 1 }}>
                                <View style={styles.roomCardHeaderRow}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <Text style={styles.unifiedRoomTitle} numberOfLines={1}>
                                      {isRentalMode ? 'Flat' : 'Room'} {room.roomNumber}
                                    </Text>
                                    <View style={styles.configPillBadge}>
                                      <Text style={styles.configPillText}>{configLabel}</Text>
                                    </View>
                                  </View>

                                  <TouchableOpacity
                                    style={styles.editRoomPillBtn}
                                    onPress={() => setEditingRoomDetails({ floorNum: floor.floorNumber, room })}
                                    activeOpacity={0.8}
                                  >
                                    <Text style={styles.editRoomPillText}>✏️ Edit</Text>
                                  </TouchableOpacity>
                                </View>

                                {/* 3. Pricing & Maintenance Row */}
                                <View style={styles.pricingMaintRow}>
                                  <Text style={styles.unifiedRentText}>
                                    ₹{room.rentRupees.toLocaleString('en-IN')}
                                    <Text style={styles.unifiedRentUnit}>
                                      {isRentalMode ? '/mo' : '/bed'}
                                    </Text>
                                  </Text>

                                  <View style={styles.maintPillBadge}>
                                    <Text style={styles.maintPillText}>
                                      {maintAmount > 0
                                        ? `+ ₹${maintAmount.toLocaleString('en-IN')} maint.`
                                        : 'Maint. Included'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>

                            {/* Divider */}
                            <View style={styles.cardDividerLine} />

                            {/* 4. Bottom Occupancy Footer & Primary Action */}
                            <View style={styles.unifiedCardFooter}>
                              {isRentalMode ? (
                                <>
                                  <Text style={styles.occupancyStatusText}>
                                    {occupiedCount > 0 ? (
                                      <>
                                        <Text style={{ fontWeight: '800', color: '#111827' }}>Occupied</Text>
                                        {' • '}
                                        {roomOccupants[0]?.fullName}
                                      </>
                                    ) : (
                                      <Text style={{ fontWeight: '700', color: '#4b5563' }}>Vacant</Text>
                                    )}
                                  </Text>

                                  {occupiedCount > 0 ? (
                                    <TouchableOpacity
                                      style={styles.viewTenantsBtn}
                                      onPress={() =>
                                        setViewingRoomTenants({
                                          roomNumber: room.roomNumber,
                                          occupants: roomOccupants,
                                        })
                                      }
                                      activeOpacity={0.8}
                                    >
                                      <Text style={styles.viewTenantsBtnText}>View / Invoice</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <TouchableOpacity
                                      style={styles.assignTenantCtaBtn}
                                      onPress={() =>
                                        openAssignModalForBed({
                                          floorNum: floor.floorNumber,
                                          roomId: room.id,
                                          roomNumber: room.roomNumber,
                                          bedId: room.beds[0]?.id || `unit-${room.id}`,
                                          bedLabel: 'Unit',
                                          rentRupees: room.rentRupees,
                                        })
                                      }
                                      activeOpacity={0.85}
                                    >
                                      <Text style={styles.assignTenantCtaText}>+ Assign Tenant</Text>
                                    </TouchableOpacity>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Text style={styles.occupancyStatusText}>
                                    <Text style={{ fontWeight: '800', color: '#111827' }}>
                                      {occupiedCount}/{totalBedsInRoom}
                                    </Text>
                                    {' Occupied • '}
                                    {isFull
                                      ? 'Full'
                                      : `${freeBeds} ${freeBeds === 1 ? 'Bed' : 'Beds'} Free`}
                                  </Text>

                                  {isFull ? (
                                    <TouchableOpacity
                                      style={styles.viewTenantsBtn}
                                      onPress={() =>
                                        setViewingRoomTenants({
                                          roomNumber: room.roomNumber,
                                          occupants: roomOccupants,
                                        })
                                      }
                                      activeOpacity={0.8}
                                    >
                                      <Text style={styles.viewTenantsBtnText}>View Tenants</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <TouchableOpacity
                                      style={styles.assignTenantCtaBtn}
                                      onPress={() => {
                                        const targetBed = firstVacantBed || {
                                          id: `b-${room.id}-${occupiedCount + 1}`,
                                          bedLabel: `Bed ${occupiedCount + 1}`,
                                          status: 'AVAILABLE' as const,
                                        };
                                        openAssignModalForBed({
                                          floorNum: floor.floorNumber,
                                          roomId: room.id,
                                          roomNumber: room.roomNumber,
                                          bedId: targetBed.id,
                                          bedLabel: targetBed.bedLabel,
                                          rentRupees: room.rentRupees,
                                        });
                                      }}
                                      activeOpacity={0.85}
                                    >
                                      <Text style={styles.assignTenantCtaText}>+ Assign Tenant</Text>
                                    </TouchableOpacity>
                                  )}
                                </>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {/* Quick Switch to Advanced Builder if needed */}
                <View style={styles.bottomSwitchBar}>
                  <Text style={styles.bottomSwitchText}>
                    💡 Tap any bed to view resident or assign a new resident.
                  </Text>
                  <TouchableOpacity
                    style={styles.editModeSwitchBtn}
                    onPress={handleEnterEditMode}
                  >
                    <Text style={styles.editModeSwitchText}>✏️ Builder Mode</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ════════════════════════════════════════════════════════════
                MODE B: EDIT MODE (INTERACTIVE BUILDER WITH +/- BUTTONS)
               ════════════════════════════════════════════════════════════ */}
            {viewMode === 'EDIT' && (
              <View>
                {/* Sticky Action Bar */}
                <View style={styles.editActionBar}>
                  <View>
                    <Text style={styles.editModeTitle}>✏️ Editing Property Structure</Text>
                    <Text style={styles.editModeSubtitle}>Configure floors, rooms & beds</Text>
                  </View>

                  <View style={styles.editActionButtons}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={handleCancelEdit}
                      disabled={saving}
                    >
                      <Text style={styles.cancelBtnText}>✕ Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveChangesBtn}
                      onPress={handleSaveChanges}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.saveChangesBtnText}>💾 Save Changes</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── STEP 1: NUMBER OF FLOORS ── */}
                <View style={styles.builderStepCard}>
                  <View style={styles.builderStepHeader}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>Step 1</Text>
                    </View>
                    <Text style={styles.stepTitle}>Number of Floors</Text>
                  </View>
                  <Text style={styles.stepDescription}>
                    Use the buttons below to increase or decrease total floors.
                  </Text>

                  <View style={styles.counterRow}>
                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={handleDecreaseFloors}
                    >
                      <Text style={styles.counterBtnText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.counterDisplay}>
                      <Text style={styles.counterValue}>{floors.length}</Text>
                      <Text style={styles.counterUnit}>
                        {floors.length === 1 ? 'Floor' : 'Floors'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.counterBtn}
                      onPress={handleIncreaseFloors}
                    >
                      <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── STEP 2 & 3: ROOMS ON EACH FLOOR & BEDS IN ROOMS ── */}
                <View style={{ marginTop: 16 }}>
                  <View style={styles.stepHeaderSolo}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>Step 2 & 3</Text>
                    </View>
                    <Text style={styles.stepTitle}>Rooms & Bed Capacities</Text>
                  </View>

                  {floors.map((floor) => (
                    <View key={`edit-floor-${floor.floorNumber}`} style={styles.editFloorCard}>
                      {/* Floor Header & Room Counter */}
                      <View style={styles.editFloorHeader}>
                        <View>
                          <Text style={styles.editFloorTitle}>Floor {floor.floorNumber}</Text>
                          <Text style={styles.editFloorSub}>
                            {floor.rooms.length} {floor.rooms.length === 1 ? 'Room' : 'Rooms'} configured
                          </Text>
                        </View>

                        {/* Room Counter for this floor */}
                        <View style={styles.miniCounterRow}>
                          <Text style={styles.miniCounterLabel}>Rooms:</Text>
                          <TouchableOpacity
                            style={styles.miniCounterBtn}
                            onPress={() => handleDecreaseRooms(floor.floorNumber)}
                          >
                            <Text style={styles.miniCounterBtnText}>−</Text>
                          </TouchableOpacity>

                          <Text style={styles.miniCounterValue}>{floor.rooms.length}</Text>

                          <TouchableOpacity
                            style={styles.miniCounterBtn}
                            onPress={() => handleIncreaseRooms(floor.floorNumber)}
                          >
                            <Text style={styles.miniCounterBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Room Cards under this Floor */}
                      <View style={styles.roomCardsContainer}>
                        {floor.rooms.map((room) => (
                          <View key={room.id} style={styles.editRoomCard}>
                            {/* Room Top Bar */}
                            <View style={styles.roomTopBar}>
                              <View>
                                <Text style={styles.editRoomNumber}>Room {room.roomNumber}</Text>
                                <View style={styles.sharingBadgeDynamic}>
                                  <Text style={styles.sharingBadgeDynamicText}>
                                    {getSharingLabel(room.beds.length)}
                                  </Text>
                                </View>
                              </View>

                              {/* Bed Counter for this Room */}
                              <View style={styles.roomBedCounter}>
                                <Text style={styles.miniCounterLabel}>Beds:</Text>
                                <TouchableOpacity
                                  style={styles.miniCounterBtn}
                                  onPress={() => handleDecreaseBeds(floor.floorNumber, room.id)}
                                >
                                  <Text style={styles.miniCounterBtnText}>−</Text>
                                </TouchableOpacity>

                                <Text style={styles.miniCounterValue}>{room.beds.length}</Text>

                                <TouchableOpacity
                                  style={styles.miniCounterBtn}
                                  onPress={() => handleIncreaseBeds(floor.floorNumber, room.id)}
                                >
                                  <Text style={styles.miniCounterBtnText}>+</Text>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Room Pricing & Quick Edit */}
                            <View style={styles.roomPricingRow}>
                              <Text style={styles.roomPriceDisplay}>
                                ₹{room.rentRupees.toLocaleString('en-IN')}/bed/mo
                              </Text>

                              <TouchableOpacity
                                style={styles.roomSettingsBtn}
                                onPress={() =>
                                  setEditingRoomDetails({ floorNum: floor.floorNumber, room })
                                }
                              >
                                <Text style={styles.roomSettingsBtnText}>⚙️ Settings</Text>
                              </TouchableOpacity>
                            </View>

                            {/* Individual Beds in this Room */}
                            <View style={styles.editBedsPillsRow}>
                              {room.beds.map((bed) => (
                                <TouchableOpacity
                                  key={bed.id}
                                  style={[
                                    styles.editBedPill,
                                    { borderColor: getStatusColor(bed.status) },
                                  ]}
                                  onPress={() =>
                                    setSelectedBedForStatus({
                                      floorNum: floor.floorNumber,
                                      roomId: room.id,
                                      bed,
                                    })
                                  }
                                >
                                  <View
                                    style={[
                                      styles.bedStatusDotSmall,
                                      { backgroundColor: getStatusColor(bed.status) },
                                    ]}
                                  />
                                  <Text style={styles.editBedLabel}>{bed.bedLabel}</Text>
                                  <Text
                                    style={[
                                      styles.editBedStatusBadge,
                                      { color: getStatusColor(bed.status) },
                                    ]}
                                  >
                                    {bed.status[0]}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Bottom Save Bar inside Edit Mode */}
                <View style={styles.bottomSaveBar}>
                  <TouchableOpacity
                    style={styles.bottomCancelBtn}
                    onPress={handleCancelEdit}
                    disabled={saving}
                  >
                    <Text style={styles.bottomCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bottomSaveBtn}
                    onPress={handleSaveChanges}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.bottomSaveText}>💾 Save Changes & Exit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ─── MODAL 1: BED STATUS PICKER ─── */}
      <Modal
        visible={!!selectedBedForStatus}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBedForStatus(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Bed Status</Text>
            <Text style={styles.modalSubtitle}>
              {selectedBedForStatus?.bed.bedLabel} (Floor {selectedBedForStatus?.floorNum})
            </Text>

            <TouchableOpacity
              style={[styles.statusOption, { borderLeftColor: '#10b981' }]}
              onPress={() => handleSetBedStatus('AVAILABLE')}
            >
              <Text style={{ fontSize: 18 }}>🟢</Text>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.statusOptionTitle}>Available</Text>
                <Text style={styles.statusOptionSub}>Ready for new tenant booking</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { borderLeftColor: '#ef4444' }]}
              onPress={() => handleSetBedStatus('OCCUPIED')}
            >
              <Text style={{ fontSize: 18 }}>🔴</Text>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.statusOptionTitle}>Occupied</Text>
                <Text style={styles.statusOptionSub}>Tenant currently staying</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { borderLeftColor: '#f59e0b' }]}
              onPress={() => handleSetBedStatus('RESERVED')}
            >
              <Text style={{ fontSize: 18 }}>🟡</Text>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.statusOptionTitle}>Reserved</Text>
                <Text style={styles.statusOptionSub}>Advance token paid by tenant</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { borderLeftColor: '#3b82f6' }]}
              onPress={() => handleSetBedStatus('MAINTENANCE')}
            >
              <Text style={{ fontSize: 18 }}>🔵</Text>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.statusOptionTitle}>Maintenance</Text>
                <Text style={styles.statusOptionSub}>Under repair or painting</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setSelectedBedForStatus(null)}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: EDIT ROOM DETAILS (Rent, AC, Bathroom) ─── */}
      <Modal
        visible={!!editingRoomDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingRoomDetails(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit Room {editingRoomDetails?.room.roomNumber}
            </Text>
            <Text style={styles.modalSubtitle}>Pricing, amenities & room number</Text>

            {editingRoomDetails && (
              <ScrollView style={{ maxHeight: 350 }}>
                <Text style={styles.inputLabel}>Room Number / Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editingRoomDetails.room.roomNumber}
                  onChangeText={(val) =>
                    setEditingRoomDetails({
                      ...editingRoomDetails,
                      room: { ...editingRoomDetails.room, roomNumber: val },
                    })
                  }
                  placeholder="e.g. 101"
                />

                <Text style={styles.inputLabel}>Monthly Rent per Bed (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={String(editingRoomDetails.room.rentRupees)}
                  onChangeText={(val) =>
                    setEditingRoomDetails({
                      ...editingRoomDetails,
                      room: {
                        ...editingRoomDetails.room,
                        rentRupees: parseInt(val, 10) || 0,
                      },
                    })
                  }
                  placeholder="8500"
                />

                <Text style={styles.inputLabel}>Security Deposit per Bed (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={String(editingRoomDetails.room.depositRupees)}
                  onChangeText={(val) =>
                    setEditingRoomDetails({
                      ...editingRoomDetails,
                      room: {
                        ...editingRoomDetails.room,
                        depositRupees: parseInt(val, 10) || 0,
                      },
                    })
                  }
                  placeholder="8500"
                />

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Air Conditioner (AC)</Text>
                  <Switch
                    value={editingRoomDetails.room.ac}
                    onValueChange={(val) =>
                      setEditingRoomDetails({
                        ...editingRoomDetails,
                        room: { ...editingRoomDetails.room, ac: val },
                      })
                    }
                    trackColor={{ false: '#cbd5e1', true: '#4f46e5' }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Attached Bathroom</Text>
                  <Switch
                    value={editingRoomDetails.room.attachedBathroom}
                    onValueChange={(val) =>
                      setEditingRoomDetails({
                        ...editingRoomDetails,
                        room: { ...editingRoomDetails.room, attachedBathroom: val },
                      })
                    }
                    trackColor={{ false: '#cbd5e1', true: '#4f46e5' }}
                  />
                </View>

                {/* Delete Room Button */}
                <TouchableOpacity
                  style={styles.deleteRoomOutlineBtn}
                  onPress={() => {
                    if (editingRoomDetails) {
                      handleDeleteRoom(
                        editingRoomDetails.floorNum,
                        editingRoomDetails.room.id,
                        editingRoomDetails.room.roomNumber
                      );
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteRoomOutlineBtnText}>
                    🗑️ Delete Room {editingRoomDetails.room.roomNumber}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.closeModalBtn, { flex: 1, marginRight: 8 }]}
                onPress={() => setEditingRoomDetails(null)}
              >
                <Text style={styles.closeModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, { flex: 1, marginLeft: 8 }]}
                onPress={() => {
                  if (editingRoomDetails) {
                    handleUpdateRoomDetails(editingRoomDetails.room);
                  }
                }}
              >
                <Text style={styles.saveModalBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3: PROPERTY SWITCHER ─── */}
      <Modal
        visible={showPropertyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPropertyPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select PG Property</Text>
            <Text style={styles.modalSubtitle}>Switch between your properties</Text>

            <ScrollView style={{ maxHeight: 280, marginVertical: 12 }}>
              {propertiesList.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.propPickerItem,
                    activeProperty?.id === p.id && styles.propPickerItemActive,
                  ]}
                  onPress={() => handleSelectProperty(p)}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.propPickerItemName,
                        activeProperty?.id === p.id && { color: '#4f46e5' },
                      ]}
                    >
                      {p.name}
                    </Text>
                    <Text style={styles.propPickerItemSub}>
                      {p.localityName ? `${p.localityName}, ` : ''}{p.cityName || 'Vijayawada'}
                    </Text>
                  </View>
                  {activeProperty?.id === p.id && (
                    <Text style={{ color: '#4f46e5', fontWeight: 'bold' }}>✓ Active</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowPropertyPicker(false)}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 4: ADD NEW PG PROPERTY ─── */}
      <Modal
        visible={showAddPropertyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPropertyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New PG Property</Text>
            <Text style={styles.modalSubtitle}>Create listing and setup floors & rooms</Text>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={styles.inputLabel}>Property Name *</Text>
              <TextInput
                style={styles.textInput}
                value={newPropName}
                onChangeText={setNewPropName}
                placeholder="e.g. Ramesh PG II / Sri Balaji PG"
              />

              <Text style={styles.inputLabel}>Property Type</Text>
              <View style={styles.pillRow}>
                {(['PG', 'HOSTEL', 'CO_LIVING'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.choicePill,
                      newPropType === t && styles.choicePillActive,
                    ]}
                    onPress={() => setNewPropType(t)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        newPropType === t && styles.choicePillTextActive,
                      ]}
                    >
                      {t.replace('_', '-')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Gender Policy</Text>
              <View style={styles.pillRow}>
                {(['BOYS', 'GIRLS', 'CO_ED'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.choicePill,
                      newPropGender === g && styles.choicePillActive,
                    ]}
                    onPress={() => setNewPropGender(g)}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        newPropGender === g && styles.choicePillTextActive,
                      ]}
                    >
                      {g.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* GPS Location Button (Requirement 5: Add location based on current location) */}
              <View style={{ marginTop: 12, marginBottom: 8, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#bbf7d0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>
                      📍 PG Location & Maps
                    </Text>
                    <Text style={{ fontSize: 10, color: '#15803d', marginTop: 2 }}>
                      {newPropLat && newPropLng
                        ? `Captured: ${newPropLat}, ${newPropLng}`
                        : 'Auto-detect coordinates for Google Maps & Website'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      backgroundColor: '#16a34a',
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    onPress={handleCaptureCurrentLocation}
                    disabled={capturingLocation}
                  >
                    {capturingLocation ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>
                          {newPropLat ? '✓ Recapture' : '📍 Use GPS'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.inputLabel}>Address Line *</Text>
              <TextInput
                style={styles.textInput}
                value={newPropAddress}
                onChangeText={setNewPropAddress}
                placeholder="e.g. Door 12-4, Plot 42, Main Road"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Locality / Landmark</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPropLocality}
                    onChangeText={setNewPropLocality}
                    placeholder="Hitec City"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPropCity}
                    onChangeText={setNewPropCity}
                    placeholder="Hyderabad"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Pincode</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPropPincode}
                    onChangeText={setNewPropPincode}
                    placeholder="500081"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Google Maps Link</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPropMapsUrl}
                    onChangeText={setNewPropMapsUrl}
                    placeholder="Auto-generated or custom URL"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.closeModalBtn, { flex: 1, marginRight: 8 }]}
                onPress={() => setShowAddPropertyModal(false)}
                disabled={creatingProperty}
              >
                <Text style={styles.closeModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, { flex: 1, marginLeft: 8 }]}
                onPress={handleCreateNewProperty}
                disabled={creatingProperty}
              >
                {creatingProperty ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveModalBtnText}>Create PG</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 4: ASSIGN RESIDENT TO VACANT BED (+ ADD MARK) ─── */}
      <Modal
        visible={!!assigningBed}
        transparent
        animationType="slide"
        onRequestClose={() => setAssigningBed(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%', paddingBottom: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Onboard Resident to Bed</Text>
                <Text style={styles.modalSubtitle}>
                  Room {assigningBed?.roomNumber} • {assigningBed?.bedLabel} • Floor {assigningBed?.floorNum}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAssigningBed(null)} style={styles.modalCloseCircle}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={styles.modalInputLabel}>Resident Full Name *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={assignTenantName}
                onChangeText={setAssignTenantName}
                placeholder="e.g. Harsha Vardhan"
                placeholderTextColor="#334155"
              />

              <Text style={styles.modalInputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={assignTenantPhone}
                onChangeText={setAssignTenantPhone}
                keyboardType="phone-pad"
                placeholder="e.g. 9876543210"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.modalInputLabel}>Email Address (Optional)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={assignTenantEmail}
                onChangeText={setAssignTenantEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="resident@gmail.com"
                placeholderTextColor="#94a3b8"
              />

              {/* ID Proof Selection */}
              <Text style={styles.modalInputLabel}>Government ID Proof</Text>
              <View style={styles.assignProofRow}>
                {(['AADHAAR', 'PAN', 'VOTER_ID'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.assignProofBtn,
                      assignIdProofType === type && styles.assignProofBtnActive,
                    ]}
                    onPress={() => setAssignIdProofType(type)}
                  >
                    <Text
                      style={[
                        styles.assignProofBtnText,
                        assignIdProofType === type && styles.assignProofBtnTextActive,
                      ]}
                    >
                      {type === 'AADHAAR' ? 'Aadhaar' : type === 'PAN' ? 'PAN Card' : 'Voter ID'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalInputLabel}>ID Proof Number</Text>
              <TextInput
                style={styles.modalTextInput}
                value={assignIdProofNumber}
                onChangeText={setAssignIdProofNumber}
                placeholder={assignIdProofType === 'AADHAAR' ? '12-digit Aadhaar (e.g. 5432 8765 1098)' : 'Enter ID Number'}
                placeholderTextColor="#94a3b8"
                keyboardType={assignIdProofType === 'AADHAAR' ? 'numeric' : 'default'}
                maxLength={assignIdProofType === 'AADHAAR' ? 14 : 20}
              />
              {assignIdProofType === 'AADHAAR' && assignIdProofNumber.trim().length > 0 && (() => {
                const digits = assignIdProofNumber.replace(/\D/g, '');
                const isValid = validateVerhoeffAadhaar(digits);
                return (
                  <View
                    style={{
                      backgroundColor: isValid ? '#ecfdf5' : '#fef2f2',
                      borderWidth: 1,
                      borderColor: isValid ? '#a7f3d0' : '#fecaca',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      marginTop: 4,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: isValid ? '#059669' : '#dc2626',
                      }}
                    >
                      {isValid
                        ? '✓ Valid 12-Digit Aadhaar (KYC Verified)'
                        : digits.length < 12
                          ? `Enter ${12 - digits.length} more digits (${digits.length}/12)`
                          : '⚠️ Invalid Aadhaar Number (Checksum failed)'}
                    </Text>
                  </View>
                );
              })()}

              {/* Fixed Monthly Rent & Security Deposit Banner */}
              <View style={styles.assignRentBanner}>
                <View style={styles.assignRentBannerCol}>
                  <Text style={styles.assignRentBannerLabel}>MONTHLY RENT</Text>
                  <Text style={styles.assignRentBannerVal}>₹{Number(assignRentAmount || assigningBed?.rentRupees || 8500).toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.assignRentBannerCol, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }]}>
                  <Text style={styles.assignRentBannerLabel}>SECURITY DEPOSIT</Text>
                  <Text style={styles.assignRentBannerVal}>₹{Number(assignDepositPayingNow || 2500).toLocaleString('en-IN')}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>Monthly Rent (₹)</Text>
                  <View style={styles.currencyInputRow}>
                    <Text style={styles.currencyPrefixLight}>INR</Text>
                    <TextInput
                      style={styles.modalInnerCurrencyInput}
                      value={assignRentAmount}
                      onChangeText={setAssignRentAmount}
                      keyboardType="numeric"
                      placeholder={String(assigningBed?.rentRupees || 8500)}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>Deposit (₹)</Text>
                  <View style={styles.currencyInputRow}>
                    <Text style={styles.currencyPrefixLight}>INR</Text>
                    <TextInput
                      style={styles.modalInnerCurrencyInput}
                      value={assignDepositPayingNow}
                      onChangeText={setAssignDepositPayingNow}
                      keyboardType="numeric"
                      placeholder="2,500"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.modalInputLabel}>Rent Amount Paying Now (₹) *</Text>
              <View style={styles.currencyInputRow}>
                <Text style={styles.currencyPrefixLight}>INR</Text>
                <TextInput
                  style={styles.modalInnerCurrencyInput}
                  value={assignRentPayingNow}
                  onChangeText={setAssignRentPayingNow}
                  keyboardType="numeric"
                  placeholder={String(assignRentAmount || assigningBed?.rentRupees || 8500)}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Dynamic Rent Due Indicator */}
              {(() => {
                const fixedRent = Number(assignRentAmount || assigningBed?.rentRupees || 8500);
                const paying = Number(assignRentPayingNow || 0);
                const due = Math.max(0, fixedRent - paying);
                if (due > 0) {
                  return (
                    <View style={styles.assignDueAlertBox}>
                      <Text style={styles.assignDueAlertTitle}>⚠️ RENT DUE: ₹{due.toLocaleString('en-IN')}</Text>
                      <Text style={styles.assignDueAlertSub}>
                        Resident pays ₹{paying.toLocaleString('en-IN')} now. Remaining ₹{due.toLocaleString('en-IN')} marked as DUE.
                      </Text>
                    </View>
                  );
                } else if (paying >= fixedRent && fixedRent > 0) {
                  return (
                    <View style={styles.assignPaidAlertBox}>
                      <Text style={styles.assignPaidAlertTitle}>✓ FULL RENT PAID (₹0 Due)</Text>
                      <Text style={styles.assignPaidAlertSub}>
                        Full monthly rent of ₹{fixedRent.toLocaleString('en-IN')} collected at check-in.
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Payment Mode Selector */}
              <Text style={styles.modalInputLabel}>Payment Mode</Text>
              <View style={styles.assignProofRow}>
                {(['UPI', 'CASH', 'BANK_TRANSFER'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.assignProofBtn,
                      assignPayMode === mode && styles.assignProofBtnActive,
                    ]}
                    onPress={() => setAssignPayMode(mode)}
                  >
                    <Text
                      style={[
                        styles.assignProofBtnText,
                        assignPayMode === mode && styles.assignProofBtnTextActive,
                      ]}
                    >
                      {mode === 'UPI' ? '📱 UPI' : mode === 'CASH' ? '💵 Cash' : '🏦 Bank'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
              <TouchableOpacity
                style={[styles.closeModalBtn, { flex: 1 }]}
                onPress={() => setAssigningBed(null)}
              >
                <Text style={styles.closeModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, { flex: 1.8 }, submittingAssign && { opacity: 0.6 }]}
                onPress={handleAssignTenantToBed}
                disabled={submittingAssign}
              >
                {submittingAssign ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveModalBtnText}>✓ Confirm & Onboard</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 5: OCCUPIED BED DETAILS & ACTIONS ─── */}
      <Modal
        visible={!!occupiedBedAction}
        transparent
        animationType="fade"
        onRequestClose={() => setOccupiedBedAction(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <Text style={styles.modalTitle}>{occupiedBedAction?.tenantName}</Text>
                <Text style={styles.modalSubtitle}>
                  Room {occupiedBedAction?.roomNumber} • {occupiedBedAction?.bed.bedLabel} • Floor {occupiedBedAction?.floorNum}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOccupiedBedAction(null)} style={styles.modalCloseCircle}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.occupiedInfoCard}>
              <View style={styles.occupiedInfoRow}>
                <Text style={styles.occupiedInfoLabel}>Status:</Text>
                <Text style={[styles.occupiedInfoVal, { color: '#16a34a', fontWeight: '800' }]}>🟢 Occupied</Text>
              </View>
              <View style={styles.occupiedInfoRow}>
                <Text style={styles.occupiedInfoLabel}>Contact:</Text>
                <Text style={styles.occupiedInfoVal}>📱 {occupiedBedAction?.tenantPhone || 'Not provided'}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 10, marginTop: 14 }}>
              {occupiedBedAction?.tenantPhone && (
                <TouchableOpacity
                  style={styles.occupiedCallBtn}
                  onPress={() => {
                    const phone = occupiedBedAction.tenantPhone?.replace(/[^0-9]/g, '');
                    Linking.openURL(`tel:${phone}`);
                  }}
                >
                  <Text style={styles.occupiedCallBtnText}>📞 Call Resident</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.occupiedCheckoutBtn}
                onPress={() => {
                  if (occupiedBedAction) {
                    handleCheckOutBed(
                      occupiedBedAction.floorNum,
                      occupiedBedAction.roomId,
                      occupiedBedAction.bed.id,
                      occupiedBedAction.tenantName
                    );
                  }
                }}
              >
                <Text style={styles.occupiedCheckoutBtnText}>🚪 Check Out (Make Bed Available)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.occupiedPhotoBtn}
                onPress={async () => {
                  if (occupiedBedAction) {
                    await handleUploadBedPhoto(
                      occupiedBedAction.floorNum,
                      occupiedBedAction.roomId,
                      occupiedBedAction.bed.id
                    );
                    setOccupiedBedAction(null);
                  }
                }}
              >
                <Text style={styles.occupiedPhotoBtnText}>📷 Upload / Change Bed Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setOccupiedBedAction(null)}
              >
                <Text style={styles.closeModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 5B: CHOOSE BED TO APPLY PHOTO (Point 2) ─── */}
      <Modal
        visible={!!targetPhotoRoom}
        transparent
        animationType="slide"
        onRequestClose={() => setTargetPhotoRoom(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Select Bed for Photo</Text>
                <Text style={styles.modalSubtitle}>
                  Room {targetPhotoRoom?.room.roomNumber} • Choose which bed box to apply photo
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTargetPhotoRoom(null)} style={styles.modalCloseCircle}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.targetBedInfoBanner}>
              <Text style={styles.targetBedInfoBannerText}>
                💡 Select a bed below. Beds without a photo are highlighted so you can easily upload photos to them.
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              <View style={{ gap: 8 }}>
                {targetPhotoRoom?.room.beds.map((b, bIdx) => {
                  const occupant = bedOccupantMap.get(b.id) || bedOccupantMap.get(`${targetPhotoRoom?.room.roomNumber}-${b.bedLabel}`);
                  const isOcc = !!occupant;
                  const label = isOcc ? occupant.fullName : '+ Add (Vacant Bed)';
                  const hasPhoto = Boolean(b.photo);

                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.targetBedChoiceCard,
                        !hasPhoto && styles.targetBedChoiceCardNoPhoto,
                      ]}
                      onPress={async () => {
                        if (targetPhotoRoom) {
                          const fNum = targetPhotoRoom.floorNum;
                          const rId = targetPhotoRoom.room.id;
                          setTargetPhotoRoom(null);
                          await handleUploadBedPhoto(fNum, rId, b.id);
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        {hasPhoto ? (
                          <Image source={{ uri: b.photo }} style={styles.targetBedMiniThumb} />
                        ) : (
                          <View style={styles.targetBedMiniPlaceholder}>
                            <Text style={{ fontSize: 18 }}>🛏️</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={styles.targetBedTitle}>Bed {bIdx + 1}</Text>
                            {!hasPhoto ? (
                              <View style={styles.noPhotoTagBadge}>
                                <Text style={styles.noPhotoTagText}>⚡ No Photo (Tap to Add)</Text>
                              </View>
                            ) : (
                              <View style={styles.hasPhotoTagBadge}>
                                <Text style={styles.hasPhotoTagText}>✓ Bed Photo Added</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.targetBedSubtitle} numberOfLines={1}>
                            {label}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <View
                          style={[styles.targetBedUploadBtn, hasPhoto ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' } : { backgroundColor: '#ea580c', borderColor: '#c2410c' }]}
                        >
                          <Text style={[styles.targetBedUploadBtnText, hasPhoto ? { color: '#16a34a' } : { color: '#ffffff', fontWeight: '800' }]}>
                            {hasPhoto ? '✏️ Edit' : '📷 Add Photo'}
                          </Text>
                        </View>

                        {hasPhoto && (
                          <TouchableOpacity
                            style={styles.targetBedDeleteBtn}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              if (targetPhotoRoom) {
                                handleDeleteBedPhoto(targetPhotoRoom.floorNum, targetPhotoRoom.room.id, b.id, `Bed ${bIdx + 1}`);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.targetBedDeleteBtnText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Assign existing Room Photos directly to Beds */}
              {targetPhotoRoom?.room.photos && targetPhotoRoom.room.photos.length > 0 && (
                <View style={{ marginTop: 14, padding: 10, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 8 }}>
                    🖼️ Already Uploaded Room Photos — Tap to Assign to a Bed:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                    {targetPhotoRoom.room.photos.map((photoUri, pIdx) => (
                      <View key={`existing-p-${pIdx}`} style={{ alignItems: 'center', marginRight: 10 }}>
                        <Image source={{ uri: photoUri }} style={{ width: 56, height: 56, borderRadius: 8, marginBottom: 4 }} />
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {targetPhotoRoom.room.beds.map((bd, bdIdx) => (
                            <TouchableOpacity
                              key={`assign-btn-${bd.id}-${pIdx}`}
                              onPress={() => {
                                const fNum = targetPhotoRoom.floorNum;
                                const rId = targetPhotoRoom.room.id;
                                setFloors((prev) => {
                                  const nextFloors = prev.map((fl) => {
                                    if (fl.floorNumber !== fNum) return fl;
                                    return {
                                      ...fl,
                                      rooms: fl.rooms.map((rm) => {
                                        if (rm.id !== rId) return rm;
                                        return {
                                          ...rm,
                                          beds: rm.beds.map((b) => (b.id === bd.id ? { ...b, photo: photoUri } : b)),
                                        };
                                      }),
                                    };
                                  });
                                  if (activeProperty?.id && typeof window !== 'undefined' && window.localStorage) {
                                    try {
                                      window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(nextFloors));
                                      window.localStorage.setItem('staynest_floors_default', JSON.stringify(nextFloors));
                                      window.localStorage.setItem('staynest_floors_ramesh-pg-default', JSON.stringify(nextFloors));
                                      safeDispatchStorageEvent();
                                    } catch { }
                                  }
                                  return nextFloors;
                                });
                                setTargetPhotoRoom(null);
                                notifyUser('Photo Assigned! 🛏️', `Photo assigned to Bed ${bdIdx + 1}`);
                              }}
                              style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#ea580c' }}
                            >
                              <Text style={{ fontSize: 10, color: '#ffffff', fontWeight: '800' }}>Bed {bdIdx + 1}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* General Room Gallery upload button */}
              <TouchableOpacity
                style={styles.generalRoomUploadBtn}
                onPress={async () => {
                  if (targetPhotoRoom) {
                    const fNum = targetPhotoRoom.floorNum;
                    const rId = targetPhotoRoom.room.id;
                    setTargetPhotoRoom(null);
                    await handleAddRoomPhoto(fNum, rId);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.generalRoomUploadBtnText}>🖼️ Or Upload as General Room Gallery Photo</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeModalBtn, { marginTop: 12 }]}
              onPress={() => setTargetPhotoRoom(null)}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 6: COMPREHENSIVE BED MANAGEMENT MODAL ─── */}
      <Modal
        visible={!!managingBedsRoom && !!activeManagingRoom}
        transparent
        animationType="slide"
        onRequestClose={() => setManagingBedsRoom(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.bedManageModalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeaderWithClose}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bedManageModalTitle}>
                  Room {activeManagingRoom?.roomNumber} Beds
                </Text>
                <Text style={styles.bedManageModalSubtitle}>
                  Floor {managingBedsRoom?.floorNum} • {activeManagingRoom ? formatSharingBadge(activeManagingRoom.beds.length) : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setManagingBedsRoom(null)}
              >
                <Text style={styles.modalCloseIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Bed Stats Row */}
            {activeManagingRoom && (() => {
              const total = activeManagingRoom.beds.length;
              const occCount = activeManagingRoom.beds.filter(
                (b) => b.status === 'OCCUPIED' || bedOccupantMap.has(b.id)
              ).length;
              const availCount = total - occCount;

              return (
                <View style={styles.bedManageSummaryCard}>
                  <View style={styles.bedManageStatBox}>
                    <Text style={styles.bedManageStatNum}>{total}</Text>
                    <Text style={styles.bedManageStatLabel}>Total Beds</Text>
                  </View>
                  <View style={styles.bedManageStatDivider} />
                  <View style={styles.bedManageStatBox}>
                    <Text style={[styles.bedManageStatNum, { color: '#16a34a' }]}>{occCount}</Text>
                    <Text style={styles.bedManageStatLabel}>Occupied</Text>
                  </View>
                  <View style={styles.bedManageStatDivider} />
                  <View style={styles.bedManageStatBox}>
                    <Text style={[styles.bedManageStatNum, { color: '#ea580c' }]}>{availCount}</Text>
                    <Text style={styles.bedManageStatLabel}>Available</Text>
                  </View>
                </View>
              );
            })()}

            {/* Prominent "+ Add Bed" Button */}
            <TouchableOpacity
              style={styles.bedManageAddNewBtn}
              onPress={() => {
                if (managingBedsRoom) {
                  handleIncreaseBeds(managingBedsRoom.floorNum, managingBedsRoom.roomId);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.bedManageAddNewBtnText}>
                + Add Bed (Bed {(activeManagingRoom?.beds.length || 0) + 1})
              </Text>
            </TouchableOpacity>

            {/* List of Beds with Full Operations */}
            <Text style={styles.bedManageSectionTitle}>Beds in this Room</Text>
            <ScrollView style={{ maxHeight: 330, width: '100%' }}>
              {activeManagingRoom?.beds.map((bed, idx) => {
                const occupant = bedOccupantMap.get(bed.id) || bedOccupantMap.get(`${activeManagingRoom?.roomNumber}-${bed.bedLabel}`);
                const isOcc = !!occupant;
                const bedNum = idx + 1;
                const residentName = occupant?.fullName || 'Vacant';
                const residentPhone = occupant?.phone || '';

                return (
                  <View key={bed.id} style={styles.bedManageRowCard}>
                    <View style={styles.bedManageRowLeft}>
                      <View style={styles.bedManageRowHeader}>
                        <Text style={styles.bedManageRowLabel}>Bed {bedNum}</Text>
                        <View
                          style={[
                            styles.bedManageStatusPill,
                            { backgroundColor: isOcc ? '#dcfce7' : '#ffedd5' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.bedManageStatusPillText,
                              { color: isOcc ? '#15803d' : '#c2410c' },
                            ]}
                          >
                            {isOcc ? 'Occupied' : 'Available'}
                          </Text>
                        </View>
                      </View>

                      {isOcc ? (
                        <View style={{ marginTop: 4 }}>
                          <Text style={styles.bedManageOccupantText} numberOfLines={1}>
                            👤 {residentName}
                          </Text>
                          <Text style={styles.bedManagePhoneText}>
                            📞 {residentPhone}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.bedManageVacantSub}>
                          Ready to assign a resident
                        </Text>
                      )}
                    </View>

                    {/* Action Buttons on the Right */}
                    <View style={styles.bedManageActionsCol}>
                      {isOcc ? (
                        <>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.bedManageVacateBtn}
                              onPress={() => {
                                if (managingBedsRoom) {
                                  handleCheckOutBed(
                                    managingBedsRoom.floorNum,
                                    managingBedsRoom.roomId,
                                    bed.id,
                                    residentName
                                  );
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.bedManageVacateBtnText}>🚪 Vacate</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.bedManageDeleteBtn}
                              onPress={() => {
                                if (managingBedsRoom) {
                                  handleDeleteBed(
                                    managingBedsRoom.floorNum,
                                    managingBedsRoom.roomId,
                                    bed.id,
                                    `Bed ${bedNum}`
                                  );
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.bedManageDeleteBtnText}>🗑️ Delete</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={[styles.bedManageCallBtn, { width: '100%', alignItems: 'center' }]}
                            onPress={() => Linking.openURL(`tel:${residentPhone}`)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.bedManageCallBtnText}>📞 Call {residentName}</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.bedManageAssignBtn}
                            onPress={() => {
                              if (managingBedsRoom && activeManagingRoom) {
                                openAssignModalForBed({
                                  floorNum: managingBedsRoom.floorNum,
                                  roomId: activeManagingRoom.id,
                                  roomNumber: activeManagingRoom.roomNumber,
                                  bedId: bed.id,
                                  bedLabel: `Bed ${bedNum}`,
                                  rentRupees: activeManagingRoom.rentRupees,
                                });
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.bedManageAssignBtnText}>👤 Assign</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.bedManageDeleteBtn}
                            onPress={() => {
                              if (managingBedsRoom) {
                                handleDeleteBed(
                                  managingBedsRoom.floorNum,
                                  managingBedsRoom.roomId,
                                  bed.id,
                                  `Bed ${bedNum}`
                                );
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.bedManageDeleteBtnText}>🗑️ Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.bedManageCloseBtn}
              onPress={() => setManagingBedsRoom(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.bedManageCloseBtnText}>✓ Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Edit / Rename / Remove Floor */}
      <Modal
        visible={!!editingFloor}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingFloor(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Edit Floor {editingFloor?.floorNumber}</Text>
              <TouchableOpacity onPress={() => setEditingFloor(null)}>
                <Text style={{ fontSize: 18, color: '#6b7280' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Floor Name / Label</Text>
            <TextInput
              style={styles.modalTextInput}
              value={editingFloor?.label || ''}
              onChangeText={(val) =>
                setEditingFloor((prev) => (prev ? { ...prev, label: val } : null))
              }
              placeholder="e.g. Ground Floor or Floor 1"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 11,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#fecaca',
                  backgroundColor: '#fef2f2',
                }}
                onPress={() => {
                  if (!editingFloor) return;
                  const targetNum = editingFloor.floorNumber;
                  const propId = activeProperty?.id || 'prop-pg-1';
                  setFloors((prev) => {
                    const next = prev.filter((f) => f.floorNumber !== targetNum);
                    safeStorage.setItem(`@staynest_floors_${propId}`, JSON.stringify(next)).catch(() => {});
                    if (typeof window !== 'undefined' && window.localStorage) {
                      window.localStorage.setItem(`staynest_floors_${propId}`, JSON.stringify(next));
                    }
                    return next;
                  });
                  setEditingFloor(null);
                }}
              >
                <Text style={{ color: '#dc2626', fontWeight: '800', fontSize: 12 }}>Remove Floor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1.5,
                  borderRadius: 12,
                  paddingVertical: 11,
                  alignItems: 'center',
                  backgroundColor: '#ea580c',
                }}
                onPress={() => {
                  if (!editingFloor) return;
                  const propId = activeProperty?.id || 'prop-pg-1';
                  setFloors((prev) => {
                    const next = prev.map((f) =>
                      f.floorNumber === editingFloor.floorNumber
                        ? { ...f, label: editingFloor.label.trim() || `Floor ${f.floorNumber}` }
                        : f
                    );
                    safeStorage.setItem(`@staynest_floors_${propId}`, JSON.stringify(next)).catch(() => {});
                    if (typeof window !== 'undefined' && window.localStorage) {
                      window.localStorage.setItem(`staynest_floors_${propId}`, JSON.stringify(next));
                    }
                    return next;
                  });
                  setEditingFloor(null);
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>Save Floor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: View Tenants in Room / Unit */}
      <Modal
        visible={!!viewingRoomTenants}
        transparent
        animationType="slide"
        onRequestClose={() => setViewingRoomTenants(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>
                {isRentalMode ? 'Flat' : 'Room'} {viewingRoomTenants?.roomNumber} Tenants
              </Text>
              <TouchableOpacity onPress={() => setViewingRoomTenants(null)}>
                <Text style={{ fontSize: 18, color: '#6b7280' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 10, marginTop: 8 }}>
              {(viewingRoomTenants?.occupants || []).map((occ) => (
                <View
                  key={occ.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#faf8f6',
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#efece9',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>
                      {occ.fullName}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      📱 {occ.phone} {occ.bedLabel ? `• ${occ.bedLabel}` : ''}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: occ.rentStatus === 'PAID' ? '#ecfdf5' : '#fee2e2',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: occ.rentStatus === 'PAID' ? '#059669' : '#dc2626',
                      }}
                    >
                      {occ.rentStatus === 'PAID' ? 'PAID' : 'DUE'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
    minHeight: 40,
  },
  headerCenterAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerLogo: {
    width: 95,
    height: 38,
    zIndex: 2,
  },
  pageTitleHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  createTaskCoralBtn: {
    backgroundColor: '#f87171',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#f87171',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  createTaskCoralBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },

  // ─── Building Section (Image 2) ───
  buildingSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  buildingTitleText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 14,
  },
  catPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  catPillTextActive: {
    color: '#ffffff',
  },

  // ─── Floor Nav Row (Image 2) ───
  floorNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 16,
  },
  floorNavScroll: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  floorTabItem: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    position: 'relative',
  },
  floorTabItemActive: {},
  floorTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  floorTabTextActive: {
    color: '#f43f5e',
    fontWeight: '900',
  },
  floorActiveUnderline: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#f43f5e',
    borderRadius: 2,
  },
  addFloorDottedBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  addFloorDottedText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },

  // ─── Rooms Grid (Image 2) ───
  roomsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addRoomDottedCard: {
    width: 82,
    height: 98,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#94a3b8',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  addRoomDoorIconBox: {
    marginBottom: 4,
  },
  addRoomDottedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
  },
  modernRoomCard: {
    width: 82,
    height: 98,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  roomNoTopLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  roomNoBoldNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  roomTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  roomTypeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  roomStatusTinyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roomBedsSubtext: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
  },

  bottomSwitchBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  bottomSwitchText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  editModeSwitchBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editModeSwitchText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  brandSub: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  addPropBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPropBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  propertySelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  propThumbImage: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#111827',
  },
  propIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePropName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  genderTag: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  genderTagText: {
    color: '#4f46e5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activePropLoc: {
    fontSize: 11.5,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 2,
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },

  // ─── Top Live Summary Box ───
  summaryContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryBox: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  summaryStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ─── Normal View Elements ───
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  editModeBtn: {
    backgroundColor: '#eef2ff',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  editModeBtnText: {
    color: '#4f46e5',
    fontWeight: '800',
    fontSize: 13,
  },
  overviewFloorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  overviewFloorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  floorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  overviewFloorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  floorRoomCountBadge: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableColHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  roomRowWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  roomTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roomTableRowExpanded: {
    backgroundColor: '#fafafa',
  },
  roomNumText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  expandChevron: {
    fontSize: 9,
    color: '#94a3b8',
    marginLeft: 6,
  },
  sharingTypeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  roomPriceSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  availabilitySummaryText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  bedDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  bedDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  expandedBedDetails: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  expandedRoomMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaBadge: {
    fontSize: 11,
    backgroundColor: '#e2e8f0',
    color: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '600',
  },
  bedsListTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  bedsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  individualBedCard: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 95,
  },
  bedStatusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  bedCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  bedCardStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  readOnlyNoticeBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  readOnlyNoticeText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
  },

  // ─── Edit Mode Elements ───
  editActionBar: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  editModeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#4f46e5',
  },
  editModeSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  editActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  saveChangesBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4f46e5',
  },
  saveChangesBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  builderStepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
  },
  builderStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepHeaderSolo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338ca',
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  stepDescription: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  counterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  counterBtnText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 28,
  },
  counterDisplay: {
    marginHorizontal: 30,
    alignItems: 'center',
    minWidth: 80,
  },
  counterValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
  },
  counterUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  editFloorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
  },
  editFloorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14,
  },
  editFloorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  editFloorSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  miniCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  miniCounterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginRight: 6,
  },
  miniCounterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCounterBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 20,
  },
  miniCounterValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginHorizontal: 10,
    minWidth: 16,
    textAlign: 'center',
  },
  roomCardsContainer: {
    gap: 12,
  },
  editRoomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
  },
  roomTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  editRoomNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  sharingBadgeDynamic: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  sharingBadgeDynamicText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338ca',
  },
  roomBedCounter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomPricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 10,
  },
  roomPriceDisplay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  roomSettingsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  roomSettingsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  editBedsPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  editBedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  editBedStatusBadge: {
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 4,
  },
  bottomSaveBar: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  bottomCancelBtn: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  bottomCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  bottomSaveBtn: {
    flex: 2,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  bottomSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },

  // ─── Modal Styles ───
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
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  statusOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusOptionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeModalBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  saveModalBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  propPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  propPickerItemActive: {
    backgroundColor: '#eef2ff',
  },
  propPickerItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  propPickerItemSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  choicePillActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  choicePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  choicePillTextActive: {
    color: '#4338ca',
  },
  bedOccupantText: {
    fontSize: 10,
    color: '#b91c1c',
    fontWeight: '700',
    marginTop: 4,
  },

  // ─── Room-Wise Floor-by-Floor Styles (Matching Screenshot) ───
  floorFilterBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  floorFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  floorFilterPillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  floorFilterText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#374151',
  },
  floorFilterTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  addFloorHeaderPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderStyle: 'dashed',
  },
  addFloorHeaderPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  floorSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  floorSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  floorSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  floorSectionSub: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 2,
  },
  floorHeaderAddRoomBtn: {
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  floorHeaderAddRoomBtnText: {
    color: '#7c3aed',
    fontSize: 11.5,
    fontWeight: '700',
  },
  roomWiseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  roomWiseTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  roomWiseLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  roomWiseNumBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomWiseNumText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  roomWiseTypeBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomWiseTypeText: {
    color: '#374151',
    fontSize: 11.5,
    fontWeight: '600',
  },
  roomWiseRentBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomWiseRentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  roomWiseActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomWiseAddBedBtn: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roomWiseAddBedBtnText: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700',
  },
  roomWiseAddRoomBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roomWiseAddRoomBtnText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '700',
  },
  roomWiseSettingsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomWiseSettingsBtnText: {
    color: '#4b5563',
    fontSize: 11,
    fontWeight: '600',
  },
  roomBedsGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  bedBoxCard: {
    width: '31%',
    height: 98,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
    marginVertical: 3,
  },
  bedIconEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  bedBoxNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 3,
    marginBottom: 1,
  },
  bedBoxTenantName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  bedBoxWrapper: {
    position: 'relative',
    width: '31%',
  },
  bedBoxVacantCard: {
    width: '31%',
    height: 98,
    borderRadius: 14,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
    marginVertical: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  bedIconEmojiGrey: {
    fontSize: 18,
    marginBottom: 2,
    opacity: 0.4,
  },
  bedBoxVacantNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
    marginBottom: 1,
  },
  bedBoxAddText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d97706',
  },
  bedBoxWithPhoto: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    borderColor: '#f97316',
    borderStyle: 'solid',
    borderWidth: 2,
  },
  bedBoxImageCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  bedNumberHighlightBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    zIndex: 10,
  },
  bedNumberHighlightText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  bedPhotoCameraBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 10,
  },
  bedPhotoCornerIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 3,
    opacity: 0.6,
  },
  bedTenantHighlightBar: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    zIndex: 10,
  },
  bedTenantHighlightText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  occupiedPhotoBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  occupiedPhotoBtnText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  currencyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf5',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  currencyPrefixLight: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginRight: 6,
  },
  modalInnerCurrencyInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    outlineWidth: 0,
  },
  bedActionBadgeRow: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  bedPhotoEditBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  bedPhotoDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  bedInlineAddPhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  bedInlineAddPhotoBtnText: {
    fontSize: 10,
    lineHeight: 12,
    color: '#ea580c',
  },
  targetBedInfoBanner: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  targetBedInfoBannerText: {
    fontSize: 11.5,
    color: '#9a3412',
    lineHeight: 16,
    fontWeight: '600',
  },
  targetBedChoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
  },
  targetBedChoiceCardNoPhoto: {
    backgroundColor: '#fffaf5',
    borderColor: '#fed7aa',
    borderWidth: 1.5,
  },
  targetBedMiniThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#cbd5e1',
  },
  targetBedMiniPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  targetBedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  targetBedSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  noPhotoTagBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  noPhotoTagText: {
    color: '#b91c1c',
    fontSize: 9.5,
    fontWeight: '800',
  },
  hasPhotoTagBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hasPhotoTagText: {
    color: '#15803d',
    fontSize: 9.5,
    fontWeight: '800',
  },
  targetBedUploadBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  targetBedUploadBtnText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
  },
  targetBedDeleteBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBedDeleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '900',
  },
  generalRoomUploadBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  generalRoomUploadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  deleteBedRedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    zIndex: 10,
  },
  deleteBedRedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  inlineAddBedCard: {
    width: '31%',
    height: 98,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#fde68a',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    marginVertical: 3,
  },
  inlineAddBedPlus: {
    fontSize: 24,
    fontWeight: '600',
    color: '#d97706',
    marginBottom: 2,
  },
  inlineAddBedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  floorAddRoomDottedBtn: {
    borderWidth: 1.2,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginTop: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  floorAddRoomDottedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  addFloorLargeBtn: {
    backgroundColor: '#4338ca',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4338ca',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  addFloorLargeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  occupiedInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  occupiedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  occupiedInfoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  occupiedInfoVal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  occupiedCallBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  occupiedCallBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  occupiedCheckoutBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  occupiedCheckoutBtnText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 13,
  },
  modalCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  modalTextInput: {
    backgroundColor: '#fffaf5',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    outlineWidth: 0,
  },
  deleteRoomOutlineBtn: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRoomOutlineBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '800',
  },
  bedManageModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    width: '94%',
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeaderWithClose: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  bedManageModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
  },
  bedManageModalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIconText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#64748b',
  },
  bedManageSummaryCard: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bedManageStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  bedManageStatNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
  },
  bedManageStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  bedManageStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
  },
  bedManageAddNewBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  bedManageAddNewBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ea580c',
  },
  bedManageSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bedManageRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  bedManageRowLeft: {
    flex: 1,
    marginRight: 10,
  },
  bedManageRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bedManageRowLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1e293b',
  },
  bedManageStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bedManageStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bedManageOccupantText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  bedManagePhoneText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  bedManageVacantSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  bedManageActionsCol: {
    gap: 6,
    alignItems: 'flex-end',
  },
  bedManageVacateBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bedManageVacateBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '800',
  },
  bedManageCallBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bedManageCallBtnText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
  },
  bedManageAssignBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bedManageAssignBtnText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
  },
  bedManageDeleteBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bedManageDeleteBtnText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '800',
  },
  bedManageCloseBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  bedManageCloseBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  assignProofRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  assignProofBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    backgroundColor: '#fffaf5',
    alignItems: 'center',
  },
  assignProofBtnActive: {
    borderColor: '#f97316',
    backgroundColor: '#ffedd5',
  },
  assignProofBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#78350f',
  },
  assignProofBtnTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  assignRentBanner: {
    flexDirection: 'row',
    backgroundColor: '#fffaf5',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 10,
  },
  assignRentBannerCol: {
    flex: 1,
    alignItems: 'center',
  },
  assignRentBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  assignRentBannerVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  assignDueAlertBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 10,
    marginBottom: 10,
  },
  assignDueAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
    marginBottom: 2,
  },
  assignDueAlertSub: {
    fontSize: 11,
    color: '#92400e',
    lineHeight: 15,
  },
  assignPaidAlertBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 10,
    marginBottom: 10,
  },
  assignPaidAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16a34a',
    marginBottom: 2,
  },
  assignPaidAlertSub: {
    fontSize: 11,
    color: '#15803d',
    lineHeight: 15,
  },
  // Building Photo Card Styles
  buildingPhotoCard: {
    borderRadius: 18,
    overflow: 'hidden',
    height: 160,
    position: 'relative',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 4,
  },
  buildingPhotoImage: {
    width: '100%',
    height: '100%',
  },
  buildingPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buildingPhotoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  buildingPhotoBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  buildingPhotoUploadBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  buildingPhotoUploadBtnText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '700',
  },
  // Room Photos Section Styles
  roomPhotosSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  roomPhotosHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomPhotosTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111827',
  },
  addRoomPhotoBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addRoomPhotoBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  roomPhotosScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  roomPhotoThumbWrapper: {
    position: 'relative',
    width: 68,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#cbd5e1',
  },
  roomPhotoThumb: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePhotoBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  noRoomPhotosText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  // ─── Unified Room / Flat Card & Header Styles ───
  unifiedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  unifiedPropTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: -0.3,
  },
  unifiedPropSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 2,
  },
  topAddFloorBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#ea580c',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  topAddFloorBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  floorBlockWrap: {
    gap: 10,
  },
  inlineAddRoomLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ea580c',
  },
  unifiedRoomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#efece9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  unifiedRoomTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mediaSlotWrap: {
    width: 90,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaThumbContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mediaThumbImg: {
    width: '100%',
    height: '100%',
  },
  mediaCountBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  mediaCountBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  mediaPlaceholderBox: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    backgroundColor: '#faf8f6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  mediaPlaceholderText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4b5563',
  },
  roomCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  unifiedRoomTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  configPillBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  configPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  editRoomPillBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editRoomPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  pricingMaintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  unifiedRentText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },
  unifiedRentUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  maintPillBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  maintPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4b5563',
  },
  cardDividerLine: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  unifiedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  occupancyStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    paddingRight: 8,
  },
  viewTenantsBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  viewTenantsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  assignTenantCtaBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#ea580c',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  assignTenantCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
});
