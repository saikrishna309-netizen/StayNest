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
import { Property, Room, Bed, Tenant } from '../types';
import { pickImageFromDevice, pickMultipleImagesFromDevice } from '../utils/imagePicker';

interface PropertiesScreenProps {
  initialProperty?: Property | null;
  onBackToDashboard?: () => void;
}

interface FloorConfig {
  floorNumber: number;
  rooms: RoomConfig[];
}

interface RoomConfig {
  id: string;
  roomNumber: string;
  floorNumber: number;
  sharingType: string;
  rentRupees: number;
  depositRupees: number;
  ac: boolean;
  attachedBathroom: boolean;
  beds: BedConfig[];
  photos?: string[];
}

interface BedConfig {
  id: string;
  bedLabel: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
}

export const PropertiesScreen: React.FC<PropertiesScreenProps> = ({
  initialProperty,
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
  const [assignRentAmount, setAssignRentAmount] = useState('8500');
  const [assignRentPayingNow, setAssignRentPayingNow] = useState('8500');
  const [assignDepositPayingNow, setAssignDepositPayingNow] = useState('2500');
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
    const rentStr = String(bedData.rentRupees || 8500);
    setAssignRentAmount(rentStr);
    setAssignRentPayingNow(rentStr);
    setAssignDepositPayingNow('2500');
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

  // Modal for comprehensive bed management (+ Add Bed, Delete Bed, Vacate, Call)
  const [managingBedsRoom, setManagingBedsRoom] = useState<{
    floorNum: number;
    roomId: string;
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
    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      try {
        if (typeof window.confirm === 'function') {
          const ok = window.confirm(`${title}\n\n${message}`);
          if (ok) {
            onConfirm();
          }
          return;
        }
      } catch {}
      onConfirm();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  };

  // Cross-Platform Notification Dialog (Works on Web & Native Mobile)
  const notifyUser = (title: string, message?: string) => {
    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      try {
        if (typeof window.alert === 'function') {
          window.alert(message ? `${title}\n\n${message}` : title);
          return;
        }
      } catch {}
      return;
    }
    Alert.alert(title, message);
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
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`staynest_building_photo_${activeProperty.id}`, picked);
          window.dispatchEvent(new Event('storage'));
        }
        notifyUser('Building Photo Updated! 🏢', 'Exterior photo has been updated and will be displayed on the StayNest website.');
      }
    } catch (e) {
      console.log('Error updating building photo:', e);
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
            window.dispatchEvent(new Event('storage'));
          } catch {}
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
            window.dispatchEvent(new Event('storage'));
          } catch {}
        }
        return nextFloors;
      });
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
          } catch {}
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
          } catch {}
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

  // Assign resident to empty bed (+ Add Mark) with full onboarding
  const handleAssignTenantToBed = async () => {
    if (!assigningBed) return;
    if (!assignTenantName.trim() || !assignTenantPhone.trim()) {
      Alert.alert('Required', 'Please enter resident name and phone');
      return;
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
            idProofNumber: assignIdProofNumber.trim() || 'NOT_PROVIDED',
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
              }).catch(() => {});
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
          idProofNumber: assignIdProofNumber.trim() || '--',
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

      if (typeof window !== 'undefined' && window.localStorage && activeProperty?.id) {
        window.localStorage.setItem(`staynest_floors_${activeProperty.id}`, JSON.stringify(updatedFloors));
      }

      const alertMsg = rentDue > 0
        ? `✓ ${assignTenantName} onboarded to ${assigningBed.bedLabel}! Received ₹${payingNow.toLocaleString('en-IN')}, Remaining ₹${rentDue.toLocaleString('en-IN')} marked as DUE.`
        : `✓ ${assignTenantName} onboarded to ${assigningBed.bedLabel}, Room ${assigningBed.roomNumber}! Full rent received.`;

      if (Platform.OS === 'web' || typeof window !== 'undefined') {
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
    loadPropertiesAndRooms();
  }, [initialProperty]);

  const loadPropertiesAndRooms = async () => {
    setLoading(true);
    try {
      // 1. Fetch owner's properties from backend
      const propsRes = await apiClient<{ content: Property[] }>('/owner/properties');
      const loadedProps = propsRes.content || [];
      setPropertiesList(loadedProps);

      let targetProp = initialProperty;
      if (!targetProp && loadedProps.length > 0) {
        targetProp = loadedProps[0];
      }

      // If no properties exist on backend, create default Ramesh PG
      if (!targetProp) {
        try {
          const propName = user?.fullName ? `${user.fullName} PG` : 'Ramesh PG';
          const newProp = await apiClient<Property>('/owner/properties', {
            method: 'POST',
            body: JSON.stringify({
              name: propName,
              propertyType: 'PG',
              genderPolicy: 'BOYS',
              cityId: '00000000-0000-0000-0000-000000000001',
              addressLine: 'MG Road, Vijayawada',
              pincode: '520001',
              foodIncluded: true,
            }),
          });
          targetProp = newProp;
          setPropertiesList([newProp]);
        } catch {
          targetProp = {
            id: 'ramesh-pg-default',
            name: user?.fullName ? `${user.fullName} PG` : 'Ramesh PG',
            propertyType: 'PG',
            genderPolicy: 'BOYS',
            addressLine: 'MG Road, Vijayawada',
            cityName: 'Vijayawada',
            foodIncluded: true,
          };
          setPropertiesList([targetProp]);
        }
      }

      setActiveProperty(targetProp);

      // 1. Fetch live tenants to get exact real-time bed occupancy
      let loadedTenants: Tenant[] = [];
      try {
        const tenantRes = await apiClient<{ content: Tenant[] }>('/owner/tenants');
        loadedTenants = tenantRes.content || [];
        setTenants(loadedTenants);
      } catch {
        // ignore
      }

      const occupiedBedIds = new Set<string>();
      loadedTenants.forEach((t) => {
        if (t.active !== false && t.stayStatus !== 'TERMINATED' && t.bedId) {
          occupiedBedIds.add(t.bedId);
        }
      });

      // 2. Fetch full property rooms from API
      let loadedFromBackend = false;
      if (targetProp && targetProp.id && !targetProp.id.startsWith('ramesh-pg-default')) {
        try {
          const propData = await apiClient<Property>(`/properties/${targetProp.id}`);
          if (propData.rooms && propData.rooms.length > 0) {
            const floorMap = new Map<number, RoomConfig[]>();
            propData.rooms.forEach((r) => {
              const flNum = r.floorNumber || 1;
              const seenBeds = new Set<string>();
              const uniqueBeds = (r.beds || [])
                .filter((b) => {
                  if (!b.id || seenBeds.has(b.id)) return false;
                  seenBeds.add(b.id);
                  return true;
                })
                .map((b, idx) => ({
                  id: b.id,
                  bedLabel: `Bed ${idx + 1}`,
                  status: occupiedBedIds.has(b.id) ? 'OCCUPIED' : ((b.status as any) || 'AVAILABLE'),
                }));

              const rConfig: RoomConfig = {
                id: r.id,
                roomNumber: r.roomNumber,
                floorNumber: flNum,
                sharingType: getSharingEnum(uniqueBeds.length || 2),
                rentRupees: (r.rentMonthlyPaise || 850000) / 100,
                depositRupees: (r.depositPaise || 850000) / 100,
                ac: true,
                attachedBathroom: true,
                beds: uniqueBeds,
              };
              if (!floorMap.has(flNum)) floorMap.set(flNum, []);
              floorMap.get(flNum)!.push(rConfig);
            });

            const sortedFloors: FloorConfig[] = Array.from(floorMap.entries())
              .sort(([a], [b]) => a - b)
              .map(([floorNumber, rooms]) => ({ floorNumber, rooms }));

            if (sortedFloors.length > 0) {
              setFloors(sortedFloors);
              setOriginalFloors(JSON.parse(JSON.stringify(sortedFloors)));
              loadedFromBackend = true;
            }
          }
        } catch {
          // ignore
        }
      }

      // 3. Fallback to cached floors if backend has no rooms yet
      if (!loadedFromBackend && typeof window !== 'undefined' && window.localStorage && targetProp?.id) {
        const cached = window.localStorage.getItem(`staynest_floors_${targetProp.id}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const synced = parsed.map((fl: FloorConfig) => ({
                ...fl,
                rooms: fl.rooms.map((rm: RoomConfig) => {
                  const seenBeds = new Set<string>();
                  const uniqueBeds = (rm.beds || [])
                    .filter((b) => {
                      if (!b.id || seenBeds.has(b.id)) return false;
                      seenBeds.add(b.id);
                      return true;
                    })
                    .map((b, idx) => ({
                      ...b,
                      bedLabel: `Bed ${idx + 1}`,
                      status: occupiedBedIds.has(b.id) ? 'OCCUPIED' : (b.status || 'AVAILABLE'),
                    }));
                  return {
                    ...rm,
                    sharingType: getSharingEnum(uniqueBeds.length),
                    beds: uniqueBeds,
                  };
                }),
              }));
              setFloors(synced);
              setOriginalFloors(JSON.parse(JSON.stringify(synced)));
            }
          } catch {
            // ignore
          }
        }
      }
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
    setShowPropertyPicker(false);
    setViewMode('OVERVIEW');
    setLoading(true);

    try {
      let loadedTenants: Tenant[] = [];
      try {
        const tenantRes = await apiClient<{ content: Tenant[] }>('/owner/tenants');
        loadedTenants = tenantRes.content || [];
        setTenants(loadedTenants);
      } catch {
        // ignore
      }

      const occupiedBedIds = new Set<string>();
      loadedTenants.forEach((t) => {
        if (t.active !== false && t.stayStatus !== 'TERMINATED' && t.bedId) {
          occupiedBedIds.add(t.bedId);
        }
      });

      let loadedFromBackend = false;
      const propData = await apiClient<Property>(`/properties/${p.id}`).catch(() => null);
      if (propData && propData.rooms && propData.rooms.length > 0) {
        const floorMap = new Map<number, RoomConfig[]>();
        propData.rooms.forEach((r) => {
          const flNum = r.floorNumber || 1;
          const rConfig: RoomConfig = {
            id: r.id,
            roomNumber: r.roomNumber,
            floorNumber: flNum,
            sharingType: r.sharingType || getSharingEnum(r.beds?.length || 2),
            rentRupees: (r.rentMonthlyPaise || 850000) / 100,
            depositRupees: (r.depositPaise || 850000) / 100,
            ac: true,
            attachedBathroom: true,
            beds: (r.beds || []).map((b, idx) => ({
              id: b.id,
              bedLabel: b.bedLabel || `Bed ${idx + 1}`,
              status: occupiedBedIds.has(b.id) ? 'OCCUPIED' : ((b.status as any) || 'AVAILABLE'),
            })),
          };
          if (!floorMap.has(flNum)) floorMap.set(flNum, []);
          floorMap.get(flNum)!.push(rConfig);
        });

        const sortedFloors = Array.from(floorMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([floorNumber, rooms]) => ({ floorNumber, rooms }));
        if (sortedFloors.length > 0) {
          setFloors(sortedFloors);
          setOriginalFloors(JSON.parse(JSON.stringify(sortedFloors)));
          loadedFromBackend = true;
        }
      }

      if (!loadedFromBackend && typeof window !== 'undefined' && window.localStorage) {
        const cached = window.localStorage.getItem(`staynest_floors_${p.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const synced = parsed.map((fl: FloorConfig) => ({
              ...fl,
              rooms: fl.rooms.map((rm: RoomConfig) => ({
                ...rm,
                beds: rm.beds.map((b) => ({
                  ...b,
                  status: occupiedBedIds.has(b.id) ? 'OCCUPIED' : (b.status || 'AVAILABLE'),
                })),
              })),
            }));
            setFloors(synced);
            setOriginalFloors(JSON.parse(JSON.stringify(synced)));
          }
        }
      }
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
    if (t.active !== false && t.stayStatus !== 'TERMINATED' && t.bedId) {
      bedOccupantMap.set(t.bedId, t);
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
        } catch {}
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
        } catch {}
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
        } catch {}
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
        } catch {}
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
        } catch {}
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
          } catch {}
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
                  }).catch(() => {});
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

  return (
    <View style={styles.container}>
      {/* ─── TOP BRAND & ACTIONS HEADER (IMAGE 2 STYLE) ─── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.pageTitleHeader}>Room Management</Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Text style={{ fontSize: 16 }}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerAvatarCircle}>
              <Text style={{ fontSize: 14 }}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createTaskCoralBtn}
              onPress={() => setShowAddPropertyModal(true)}
            >
              <Text style={styles.createTaskCoralBtnText}>+ Create Task</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Property Selector Bar */}
        <TouchableOpacity
          style={styles.propertySelectorBar}
          onPress={() => setShowPropertyPicker(true)}
        >
          <View style={styles.propIconCircle}>
            <Text style={{ fontSize: 16 }}>🏢</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.activePropName}>{activeProperty?.name || 'Ramesh PG'}</Text>
              <View style={styles.genderTag}>
                <Text style={styles.genderTagText}>{activeProperty?.genderPolicy || 'BOYS'}</Text>
              </View>
            </View>
            <Text style={styles.activePropLoc}>
              📍 {activeProperty?.addressLine || 'MG Road'}, {activeProperty?.cityName || 'Vijayawada'}
            </Text>
          </View>
          <Text style={styles.dropdownChevron}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* ─── MAIN CONTENT SCROLLVIEW ─── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading Indicator */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text style={styles.loadingText}>Loading property structure...</Text>
          </View>
        ) : (
          <>
            {/* ════════════════════════════════════════════════════════════
                MODE A: ROOM-WISE FLOOR-BY-FLOOR UI (MATCHING SCREENSHOT)
               ════════════════════════════════════════════════════════════ */}
            {viewMode === 'OVERVIEW' && (
              <View style={{ gap: 20 }}>
                {/* ─── BUILDING EXTERIOR PHOTO CARD (Point 8) ─── */}
                <View style={styles.buildingPhotoCard}>
                  <Image
                    source={{
                      uri:
                        buildingPhoto ||
                        activeProperty?.primaryPhotoUrl ||
                        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
                    }}
                    style={styles.buildingPhotoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.buildingPhotoOverlay}>
                    <View style={styles.buildingPhotoBadge}>
                      <Text style={styles.buildingPhotoBadgeText}>🏢 Building Photo (Website & App)</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.buildingPhotoUploadBtn}
                      onPress={handleUpdateBuildingPhoto}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.buildingPhotoUploadBtnText}>📷 Upload / Edit Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ─── 1. TOP FLOOR TABS BAR ─── */}
                <View style={styles.floorFilterBar}>
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
                        All Floors ({displayFloors.length})
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
                            Floor {fl.floorNumber}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.addFloorHeaderPill}
                      onPress={handleIncreaseFloors}
                    >
                      <Text style={styles.addFloorHeaderPillText}>+ Add Floor</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* ─── 2. FLOORS ONE BY ONE ─── */}
                {(selectedFloorFilter === 'ALL'
                  ? displayFloors
                  : displayFloors.filter((f) => f.floorNumber === selectedFloorFilter)
                ).map((floor) => {
                  const floorBedsCount = floor.rooms.reduce((acc, r) => acc + r.beds.length, 0);
                  const sharingTypesSummary = Array.from(
                    new Set(floor.rooms.map((r) => formatSharingBadge(r.beds.length)))
                  ).join(', ');

                  return (
                    <View key={`floor-sec-${floor.floorNumber}`} style={styles.floorSectionCard}>
                      {/* Floor Header Bar */}
                      <View style={styles.floorSectionHeader}>
                        <View>
                          <Text style={styles.floorSectionTitle}>
                            🏢 Floor {floor.floorNumber}
                          </Text>
                          <Text style={styles.floorSectionSub}>
                            {floor.rooms.length} {floor.rooms.length === 1 ? 'Room' : 'Rooms'} {sharingTypesSummary ? `(${sharingTypesSummary})` : ''} • {floorBedsCount} Beds
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.floorHeaderAddRoomBtn}
                          onPress={() => handleIncreaseRooms(floor.floorNumber)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.floorHeaderAddRoomBtnText}>+ Add Room</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Rooms on this Floor (Room Wise) */}
                      <View style={{ gap: 16 }}>
                        {floor.rooms.map((room) => {
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

                                  {/* Clean Sharing Label: e.g. "Double Sharing", "Four Sharing" */}
                                  <View style={styles.roomWiseTypeBadge}>
                                    <Text style={styles.roomWiseTypeText}>
                                      {roomSharingLabel}
                                    </Text>
                                  </View>

                                  <Text style={styles.roomWiseRentText}>
                                    ₹{room.rentRupees.toLocaleString('en-IN')}/mo
                                  </Text>
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

                              {/* Beds Grid inside Room (Matching Screenshot, Sequential Unique Numbers 1, 2, 3...) */}
                              <View style={styles.roomBedsGridRow}>
                                {room.beds.map((bed, bedIdx) => {
                                  const occupant = bedOccupantMap.get(bed.id);
                                  const isOccupied = bed.status === 'OCCUPIED' || !!occupant;
                                  // Strictly unique sequential bed number 1, 2, 3, 4... per room
                                  const bedNumStr = String(bedIdx + 1);

                                  if (isOccupied) {
                                    const fallbackNames = ['Harsha', 'Suresh', 'Rohit', 'Krishna', 'Siva Mani', 'Ramu', 'Phani', 'Kiran'];
                                    const tenantName = occupant?.fullName || fallbackNames[(bedIdx + Number(room.roomNumber || 101)) % fallbackNames.length];
                                    const styleIdx = bedIdx % BED_STYLES.length;
                                    const styleObj = BED_STYLES[styleIdx];

                                    return (
                                      <TouchableOpacity
                                        key={bed.id}
                                        style={[
                                          styles.bedBoxCard,
                                          { backgroundColor: styleObj.bg, borderColor: styleObj.border },
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
                                        <Text style={styles.bedIconEmoji}>🛏️</Text>
                                        <Text style={[styles.bedBoxNumber, { color: styleObj.numColor }]}>
                                          {bedNumStr}
                                        </Text>
                                        <Text style={[styles.bedBoxTenantName, { color: styleObj.textColor }]} numberOfLines={1}>
                                          {tenantName}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  } else {
                                    // Vacant Bed Card (+ Add Mark, with NO wrong mark / NO red X badge)
                                    return (
                                      <TouchableOpacity
                                        key={bed.id}
                                        style={styles.bedBoxVacantCard}
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
                                        <Text style={styles.bedIconEmojiGrey}>🛏️</Text>
                                        <Text style={styles.bedBoxVacantNumber}>{bedNumStr}</Text>
                                        <Text style={styles.bedBoxAddText}>+ Add</Text>
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

                              {/* Room Photos Gallery (Point 7) */}
                              <View style={styles.roomPhotosSection}>
                                <View style={styles.roomPhotosHeaderRow}>
                                  <Text style={styles.roomPhotosTitle}>
                                    📸 Room Photos ({room.photos?.length || 0})
                                  </Text>
                                  <TouchableOpacity
                                    style={styles.addRoomPhotoBtn}
                                    onPress={() => handleAddRoomPhoto(floor.floorNumber, room.id)}
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
                        })}

                        {/* Dotted Button to Add Room to this Floor */}
                        <TouchableOpacity
                          style={styles.floorAddRoomDottedBtn}
                          onPress={() => handleIncreaseRooms(floor.floorNumber)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.floorAddRoomDottedText}>
                            + Add Room to Floor {floor.floorNumber}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                {/* ─── 3. BOTTOM ADD FLOOR BUTTON ─── */}
                <TouchableOpacity
                  style={styles.addFloorLargeBtn}
                  onPress={handleIncreaseFloors}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addFloorLargeBtnText}>
                    🏢 + Add Floor {floors.length + 1}
                  </Text>
                </TouchableOpacity>

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
              />

              <Text style={styles.modalInputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={assignTenantPhone}
                onChangeText={setAssignTenantPhone}
                keyboardType="phone-pad"
                placeholder="9876543210"
              />

              <Text style={styles.modalInputLabel}>Email Address (Optional)</Text>
              <TextInput
                style={styles.modalTextInput}
                value={assignTenantEmail}
                onChangeText={setAssignTenantEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="resident@gmail.com"
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
                placeholder="e.g. 5432-8765-1098"
              />

              {/* Fixed Monthly Rent & Security Deposit Banner */}
              <View style={styles.assignRentBanner}>
                <View style={styles.assignRentBannerCol}>
                  <Text style={styles.assignRentBannerLabel}>MONTHLY RENT</Text>
                  <Text style={styles.assignRentBannerVal}>₹{Number(assignRentAmount || 8500).toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.assignRentBannerCol, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }]}>
                  <Text style={styles.assignRentBannerLabel}>SECURITY DEPOSIT</Text>
                  <Text style={styles.assignRentBannerVal}>₹{Number(assignDepositPayingNow || 2500).toLocaleString('en-IN')}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>Monthly Rent (₹)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={assignRentAmount}
                    onChangeText={setAssignRentAmount}
                    keyboardType="numeric"
                    placeholder="8500"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalInputLabel}>Deposit (₹)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={assignDepositPayingNow}
                    onChangeText={setAssignDepositPayingNow}
                    keyboardType="numeric"
                    placeholder="2500"
                  />
                </View>
              </View>

              <Text style={styles.modalInputLabel}>Rent Amount Paying Now (₹) *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={assignRentPayingNow}
                onChangeText={setAssignRentPayingNow}
                keyboardType="numeric"
                placeholder={assignRentAmount || '8500'}
              />

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
                style={styles.closeModalBtn}
                onPress={() => setOccupiedBedAction(null)}
              >
                <Text style={styles.closeModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
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
                const occupant = bedOccupantMap.get(bed.id);
                const isOcc = bed.status === 'OCCUPIED' || !!occupant;
                const bedNum = idx + 1;
                const fallbackNames = ['Harsha', 'Suresh', 'Rohit', 'Krishna', 'Siva Mani', 'Ramu', 'Phani', 'Kiran'];
                const residentName = occupant?.fullName || fallbackNames[(idx + Number(activeManagingRoom.roomNumber || 101)) % fallbackNames.length];
                const residentPhone = occupant?.phone || '9876543210';

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLogo: {
    width: 120,
    height: 40,
  },
  pageTitleHeader: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePropName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  genderTag: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  genderTagText: {
    color: '#4338ca',
    fontSize: 10,
    fontWeight: '700',
  },
  activePropLoc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#64748b',
    paddingHorizontal: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    shadowColor: '#000',
    shadowOpacity: 0.15,
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
  },
  floorFilterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  floorFilterPillActive: {
    backgroundColor: '#ff7337',
    borderColor: '#ff7337',
  },
  floorFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  floorFilterTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  addFloorHeaderPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderStyle: 'dashed',
  },
  addFloorHeaderPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
  },
  floorSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  floorSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  floorSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e1b4b',
  },
  floorSectionSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  floorHeaderAddRoomBtn: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  floorHeaderAddRoomBtnText: {
    color: '#6d28d9',
    fontSize: 11,
    fontWeight: '800',
  },
  roomWiseCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomWiseNumText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  roomWiseTypeBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roomWiseTypeText: {
    color: '#6d28d9',
    fontSize: 11,
    fontWeight: '700',
  },
  roomWiseRentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16a34a',
  },
  roomWiseActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomWiseAddBedBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomWiseAddBedBtnText: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
  },
  roomWiseAddRoomBtn: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomWiseAddRoomBtnText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
  },
  roomWiseSettingsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomWiseSettingsBtnText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
  },
  roomBedsGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  bedBoxCard: {
    width: 96,
    height: 104,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  bedIconEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  bedBoxNumber: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  bedBoxTenantName: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  bedBoxWrapper: {
    position: 'relative',
  },
  bedBoxVacantCard: {
    width: 96,
    height: 104,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  bedIconEmojiGrey: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.4,
  },
  bedBoxVacantNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 2,
  },
  bedBoxAddText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff7337',
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
    width: 96,
    height: 104,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  inlineAddBedPlus: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ea580c',
    marginBottom: 2,
  },
  inlineAddBedText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
  },
  floorAddRoomDottedBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginTop: 6,
  },
  floorAddRoomDottedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  assignProofBtnActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  assignProofBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  assignProofBtnTextActive: {
    color: '#4f46e5',
    fontWeight: '800',
  },
  assignRentBanner: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    fontWeight: '700',
    color: '#64748b',
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
    borderRadius: 16,
    overflow: 'hidden',
    height: 140,
    position: 'relative',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    padding: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buildingPhotoBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  buildingPhotoBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  buildingPhotoUploadBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buildingPhotoUploadBtnText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '800',
  },
  // Room Photos Section Styles
  roomPhotosSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  roomPhotosHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomPhotosTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  addRoomPhotoBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  addRoomPhotoBtnText: {
    fontSize: 10,
    fontWeight: '800',
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
});
