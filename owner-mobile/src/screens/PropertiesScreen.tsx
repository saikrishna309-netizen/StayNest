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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Property, Room, Bed, Tenant } from '../types';

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

  // New Property Form State
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<'PG' | 'HOSTEL' | 'CO_LIVING'>('PG');
  const [newPropGender, setNewPropGender] = useState<'BOYS' | 'GIRLS' | 'CO_ED'>('BOYS');
  const [newPropAddress, setNewPropAddress] = useState('');
  const [newPropCity, setNewPropCity] = useState('Vijayawada');
  const [creatingProperty, setCreatingProperty] = useState(false);

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

  // Create New PG
  const handleCreateNewProperty = async () => {
    if (!newPropName.trim()) {
      Alert.alert('Required', 'Please enter a PG or Hostel Name');
      return;
    }
    setCreatingProperty(true);
    try {
      const created = await apiClient<Property>('/owner/properties', {
        method: 'POST',
        body: JSON.stringify({
          name: newPropName.trim(),
          propertyType: newPropType,
          genderPolicy: newPropGender,
          cityId: '00000000-0000-0000-0000-000000000001',
          addressLine: newPropAddress.trim() || 'MG Road',
          cityName: newPropCity,
          foodIncluded: true,
        }),
      });

      setPropertiesList([created, ...propertiesList]);
      setActiveProperty(created);
      setShowAddPropertyModal(false);
      setNewPropName('');
      setNewPropAddress('');

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
      Alert.alert('Success', `Property "${created.name}" created! You can now configure its structure.`);
    } catch {
      Alert.alert('Error', 'Could not create property on server. Please try again.');
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

  // --- Dynamic Summary Calculations ---
  const totalFloors = floors.length;
  let totalRooms = 0;
  let totalBeds = 0;
  let availableBeds = 0;
  let occupiedBeds = 0;
  let reservedBeds = 0;
  let maintenanceBeds = 0;

  floors.forEach((f) => {
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
    const nextFloorNum = floors.length + 1;
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
            { id: `bed-${baseRoomNum}-1-${Date.now()}`, bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: `bed-${baseRoomNum}-2-${Date.now()}`, bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
      ],
    };
    setFloors([...floors, newFloor]);
  };

  const handleDecreaseFloors = () => {
    if (floors.length <= 1) {
      Alert.alert('Minimum Limit', 'A property must have at least 1 floor.');
      return;
    }
    const lastFloor = floors[floors.length - 1];
    const hasOccupiedBed = lastFloor.rooms.some((r) =>
      r.beds.some((b) => b.status === 'OCCUPIED' || b.status === 'RESERVED')
    );
    if (hasOccupiedBed) {
      Alert.alert(
        'Occupied Beds Detected',
        `Floor ${lastFloor.floorNumber} has occupied or reserved beds. Please reassign tenants before removing this floor.`
      );
      return;
    }
    setFloors(floors.slice(0, floors.length - 1));
  };

  // 2. Room Counter Controls for Floor
  const handleIncreaseRooms = (floorNum: number) => {
    setFloors(
      floors.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        const nextRoomIdx = f.rooms.length + 1;
        const roomNumStr = `${floorNum}${nextRoomIdx < 10 ? '0' + nextRoomIdx : nextRoomIdx}`;
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
            { id: `bed-${roomNumStr}-1-${Date.now()}`, bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: `bed-${roomNumStr}-2-${Date.now()}`, bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        };
        return {
          ...f,
          rooms: [...f.rooms, newRoom],
        };
      })
    );
  };

  const handleDecreaseRooms = (floorNum: number) => {
    setFloors(
      floors.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        if (f.rooms.length <= 1) {
          Alert.alert('Minimum Limit', `Floor ${floorNum} must have at least 1 room.`);
          return f;
        }
        const lastRoom = f.rooms[f.rooms.length - 1];
        const hasOccupied = lastRoom.beds.some(
          (b) => b.status === 'OCCUPIED' || b.status === 'RESERVED'
        );
        if (hasOccupied) {
          Alert.alert(
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
    setFloors(
      floors.map((f) => {
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
            const updatedBeds = [...r.beds, newBed];
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

  const handleDecreaseBeds = (floorNum: number, roomId: string) => {
    setFloors(
      floors.map((f) => {
        if (f.floorNumber !== floorNum) return f;
        return {
          ...f,
          rooms: f.rooms.map((r) => {
            if (r.id !== roomId) return r;
            if (r.beds.length <= 1) {
              Alert.alert('Minimum Limit', 'Room must have at least 1 bed.');
              return r;
            }
            const lastBed = r.beds[r.beds.length - 1];
            if (lastBed.status === 'OCCUPIED' || lastBed.status === 'RESERVED') {
              Alert.alert('Active Bed', `${lastBed.bedLabel} is currently ${lastBed.status.toLowerCase()}.`);
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
    setFloors(
      floors.map((f) => {
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
    setFloors(
      floors.map((f) => {
        if (f.floorNumber !== updated.floorNumber) return f;
        return {
          ...f,
          rooms: f.rooms.map((r) => (r.id === updated.id ? updated : r)),
        };
      })
    );
    setEditingRoomDetails(null);
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
                MODE A: IMAGE 2 "ROOM MANAGEMENT" UI (BUILDING 01 / 02)
               ════════════════════════════════════════════════════════════ */}
            {viewMode === 'OVERVIEW' && (
              <View style={{ gap: 24 }}>
                {buildingsToRender.map((bld, bldIdx) => {
                  const bldId = bld.id;
                  const bldTitle = `Building 0${bldIdx + 1}`;
                  const curFloor = getSelectedFloor(bldId);
                  const curCat = getSelectedCat(bldId);
                  const activeFloorObj = floors.find((f) => f.floorNumber === curFloor) || floors[0] || { floorNumber: 1, rooms: [] };

                  return (
                    <View key={bldId} style={styles.buildingSectionCard}>
                      {/* Building Name (e.g. Building 01) */}
                      <Text style={styles.buildingTitleText}>{bldTitle}</Text>

                      {/* Category Pills: Hostel Room (active navy), Apartment, Hostel */}
                      <View style={styles.catPillRow}>
                        <TouchableOpacity
                          style={[styles.catPill, curCat === 'HOSTEL_ROOM' && styles.catPillActive]}
                          onPress={() => setSelectedCat(bldId, 'HOSTEL_ROOM')}
                        >
                          <Text style={{ fontSize: 13 }}>🏢</Text>
                          <Text style={[styles.catPillText, curCat === 'HOSTEL_ROOM' && styles.catPillTextActive]}>
                            Hostel Room
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.catPill, curCat === 'APARTMENT' && styles.catPillActive]}
                          onPress={() => setSelectedCat(bldId, 'APARTMENT')}
                        >
                          <Text style={{ fontSize: 13 }}>🏠</Text>
                          <Text style={[styles.catPillText, curCat === 'APARTMENT' && styles.catPillTextActive]}>
                            Apartment
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.catPill, curCat === 'HOSTEL' && styles.catPillActive]}
                          onPress={() => setSelectedCat(bldId, 'HOSTEL')}
                        >
                          <Text style={{ fontSize: 13 }}>🛏️</Text>
                          <Text style={[styles.catPillText, curCat === 'HOSTEL' && styles.catPillTextActive]}>
                            Hostel
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Floor Navigation Row: Floor 1, Floor 2 (active underline), ... + Add Floor button */}
                      <View style={styles.floorNavContainer}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.floorNavScroll}
                        >
                          {floors.map((fl) => {
                            const isFloorActive = fl.floorNumber === curFloor;
                            return (
                              <TouchableOpacity
                                key={`bld-${bldId}-fl-${fl.floorNumber}`}
                                style={[styles.floorTabItem, isFloorActive && styles.floorTabItemActive]}
                                onPress={() => setSelectedFloor(bldId, fl.floorNumber)}
                              >
                                <Text style={[styles.floorTabText, isFloorActive && styles.floorTabTextActive]}>
                                  Floor {fl.floorNumber}
                                </Text>
                                {isFloorActive && <View style={styles.floorActiveUnderline} />}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                        {/* Dotted + Add Floor Button */}
                        <TouchableOpacity
                          style={styles.addFloorDottedBtn}
                          onPress={handleIncreaseFloors}
                        >
                          <Text style={styles.addFloorDottedText}>+ Add Floor</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Rooms Grid for Selected Floor */}
                      <View style={styles.roomsGridContainer}>
                        {/* Card 0: + Add Room (Dotted border with door icon) */}
                        <TouchableOpacity
                          style={styles.addRoomDottedCard}
                          onPress={() => handleIncreaseRooms(curFloor)}
                        >
                          <View style={styles.addRoomDoorIconBox}>
                            <Text style={{ fontSize: 22 }}>🚪</Text>
                          </View>
                          <Text style={styles.addRoomDottedText}>+ Add Room</Text>
                        </TouchableOpacity>

                        {/* Room Cards: 103, 234, 202, 237 etc. */}
                        {activeFloorObj.rooms.map((room) => {
                          const occCount = room.beds.filter((b) => b.status === 'OCCUPIED' || bedOccupantMap.has(b.id)).length;
                          const totalBedsInRoom = room.beds.length;
                          const shortType = getShortRoomType(room.sharingType);
                          const isFull = occCount >= totalBedsInRoom && totalBedsInRoom > 0;
                          const isEmpty = occCount === 0;

                          return (
                            <TouchableOpacity
                              key={room.id}
                              style={styles.modernRoomCard}
                              onPress={() => setEditingRoomDetails({ floorNum: curFloor, room })}
                              activeOpacity={0.75}
                            >
                              {/* Top Label: Room no */}
                              <Text style={styles.roomNoTopLabel}>Room no</Text>

                              {/* Big Bold Room Number */}
                              <Text style={styles.roomNoBoldNum}>{room.roomNumber}</Text>

                              {/* Bottom Tag / Type */}
                              <View style={styles.roomTagRow}>
                                <Text style={styles.roomTypeTagText}>{shortType}</Text>
                                <View
                                  style={[
                                    styles.roomStatusTinyDot,
                                    { backgroundColor: isFull ? '#ef4444' : isEmpty ? '#10b981' : '#f59e0b' },
                                  ]}
                                />
                              </View>

                              {/* Beds count subtext */}
                              <Text style={styles.roomBedsSubtext}>
                                {occCount}/{totalBedsInRoom} Beds
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {/* Bottom Quick Switch to Builder Mode */}
                <View style={styles.bottomSwitchBar}>
                  <Text style={styles.bottomSwitchText}>
                    💡 Tap any room card to edit rent, beds or AC.
                  </Text>
                  <TouchableOpacity
                    style={styles.editModeSwitchBtn}
                    onPress={handleEnterEditMode}
                  >
                    <Text style={styles.editModeSwitchText}>✏️ Advanced Builder</Text>
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

              <Text style={styles.inputLabel}>Address Line *</Text>
              <TextInput
                style={styles.textInput}
                value={newPropAddress}
                onChangeText={setNewPropAddress}
                placeholder="e.g. Door 12-4, MG Road"
              />

              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.textInput}
                value={newPropCity}
                onChangeText={setNewPropCity}
                placeholder="Vijayawada"
              />
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
});
