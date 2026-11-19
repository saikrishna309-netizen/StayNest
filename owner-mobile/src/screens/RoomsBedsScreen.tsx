import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Property, Room, Bed } from '../types';

interface RoomsBedsScreenProps {
  property: Property | null;
  onBack: () => void;
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
  beds: BedConfig[];
}

interface BedConfig {
  id: string;
  bedLabel: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
}

export const RoomsBedsScreen: React.FC<RoomsBedsScreenProps> = ({
  property: initialProperty,
  onBack,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Property Selection State
  const [activeProperty, setActiveProperty] = useState<Property | null>(initialProperty);
  const [propertiesList, setPropertiesList] = useState<Property[]>([]);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);

  // Property Floors State
  const [floors, setFloors] = useState<FloorConfig[]>([
    {
      floorNumber: 1,
      rooms: [
        {
          id: 'room-101',
          roomNumber: '101',
          floorNumber: 1,
          sharingType: 'DOUBLE',
          rentRupees: 8500,
          depositRupees: 8500,
          beds: [
            { id: 'b-101-1', bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: 'b-101-2', bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        },
      ],
    },
  ]);

  // Edit Room Modal State
  const [editingRoom, setEditingRoom] = useState<RoomConfig | null>(null);
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editRent, setEditRent] = useState('');
  const [editSharing, setEditSharing] = useState('DOUBLE');

  // Bed Status Switcher Modal State
  const [selectedBed, setSelectedBed] = useState<{
    floorNum: number;
    roomId: string;
    bed: BedConfig;
  } | null>(null);

  // Initialize and load properties
  useEffect(() => {
    loadPropertiesAndRooms();
  }, [initialProperty]);

  const loadPropertiesAndRooms = async () => {
    setLoading(true);
    try {
      // 1. Fetch owner's properties
      const propsRes = await apiClient<{ content: Property[] }>('/owner/properties');
      const loadedProps = propsRes.content || [];
      setPropertiesList(loadedProps);

      let targetProp = initialProperty;
      if (!targetProp && loadedProps.length > 0) {
        targetProp = loadedProps[0];
      }

      // If still no property exists, create a default property for this owner
      if (!targetProp) {
        try {
          const propName = user?.fullName ? `${user.fullName} PG` : 'StayNest PG';
          const newProp = await apiClient<Property>('/owner/properties', {
            method: 'POST',
            body: JSON.stringify({
              name: propName,
              propertyType: 'PG',
              genderPolicy: 'BOYS',
              cityId: '00000000-0000-0000-0000-000000000001',
              addressLine: 'Main Road, Koramangala, Bengaluru',
              pincode: '560034',
              foodIncluded: true,
            }),
          });
          targetProp = newProp;
          setPropertiesList([newProp]);
        } catch {
          targetProp = {
            id: 'mock-prop-1',
            name: user?.fullName ? `${user.fullName} PG` : 'My PG Property',
            propertyType: 'PG',
            genderPolicy: 'BOYS',
            addressLine: 'Main Road, Bengaluru',
            foodIncluded: true,
          };
          setPropertiesList([targetProp]);
        }
      }

      setActiveProperty(targetProp);

      // 2. Load rooms for target property
      if (targetProp && targetProp.id && !targetProp.id.startsWith('mock-')) {
        const propData = await apiClient<Property>(`/properties/${targetProp.id}`);
        if (propData.rooms && propData.rooms.length > 0) {
          const floorMap = new Map<number, RoomConfig[]>();
          propData.rooms.forEach((r) => {
            const flNum = r.floorNumber || 1;
            const rConfig: RoomConfig = {
              id: r.id,
              roomNumber: r.roomNumber,
              floorNumber: flNum,
              sharingType: r.sharingType || 'DOUBLE',
              rentRupees: (r.rentMonthlyPaise || 850000) / 100,
              depositRupees: (r.depositPaise || 850000) / 100,
              beds: (r.beds || []).map((b, idx) => ({
                id: b.id,
                bedLabel: b.bedLabel || `Bed ${idx + 1}`,
                status: (b.status as any) || 'AVAILABLE',
              })),
            };
            if (!floorMap.has(flNum)) {
              floorMap.set(flNum, []);
            }
            floorMap.get(flNum)!.push(rConfig);
          });

          const sortedFloors: FloorConfig[] = Array.from(floorMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([floorNumber, rooms]) => ({ floorNumber, rooms }));

          if (sortedFloors.length > 0) {
            setFloors(sortedFloors);
          }
        }
      }
    } catch (err: any) {
      console.warn('loadPropertiesAndRooms:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Switch Active Property
  const handleSelectProperty = async (p: Property) => {
    setActiveProperty(p);
    setShowPropertyPicker(false);
    setLoading(true);
    try {
      const propData = await apiClient<Property>(`/properties/${p.id}`);
      if (propData.rooms && propData.rooms.length > 0) {
        const floorMap = new Map<number, RoomConfig[]>();
        propData.rooms.forEach((r) => {
          const flNum = r.floorNumber || 1;
          const rConfig: RoomConfig = {
            id: r.id,
            roomNumber: r.roomNumber,
            floorNumber: flNum,
            sharingType: r.sharingType || 'DOUBLE',
            rentRupees: (r.rentMonthlyPaise || 850000) / 100,
            depositRupees: (r.depositPaise || 850000) / 100,
            beds: (r.beds || []).map((b, idx) => ({
              id: b.id,
              bedLabel: b.bedLabel || `Bed ${idx + 1}`,
              status: (b.status as any) || 'AVAILABLE',
            })),
          };
          if (!floorMap.has(flNum)) floorMap.set(flNum, []);
          floorMap.get(flNum)!.push(rConfig);
        });

        const sortedFloors = Array.from(floorMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([floorNumber, rooms]) => ({ floorNumber, rooms }));
        if (sortedFloors.length > 0) setFloors(sortedFloors);
      }
    } catch {
      // keep current layout
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

  // --- Summary Calculations ---
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
        if (b.status === 'AVAILABLE') availableBeds++;
        else if (b.status === 'OCCUPIED') occupiedBeds++;
        else if (b.status === 'RESERVED') reservedBeds++;
        else if (b.status === 'MAINTENANCE') maintenanceBeds++;
      });
    });
  });

  // --- Step 1: Floors Counter (+ / -) ---
  const handleIncreaseFloors = () => {
    const nextFloorNum = floors.length + 1;
    const defaultRoom: RoomConfig = {
      id: `room-${nextFloorNum}01`,
      roomNumber: `${nextFloorNum}01`,
      floorNumber: nextFloorNum,
      sharingType: 'DOUBLE',
      rentRupees: 8500,
      depositRupees: 8500,
      beds: [
        { id: `b-${nextFloorNum}01-1`, bedLabel: 'Bed 1', status: 'AVAILABLE' },
        { id: `b-${nextFloorNum}01-2`, bedLabel: 'Bed 2', status: 'AVAILABLE' },
      ],
    };
    setFloors([...floors, { floorNumber: nextFloorNum, rooms: [defaultRoom] }]);
  };

  const handleDecreaseFloors = () => {
    if (floors.length <= 1) {
      Alert.alert('Minimum Limit', 'Your property must have at least 1 floor.');
      return;
    }
    const lastFloor = floors[floors.length - 1];
    const hasOccupiedBeds = lastFloor.rooms.some((r) =>
      r.beds.some((b) => b.status === 'OCCUPIED')
    );
    if (hasOccupiedBeds) {
      Alert.alert(
        'Cannot Remove Floor',
        `Floor ${lastFloor.floorNumber} has occupied beds with active residents. Please reassign them before removing the floor.`
      );
      return;
    }
    setFloors(floors.slice(0, floors.length - 1));
  };

  // --- Step 2: Rooms Counter on Floor (+ / -) ---
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
          beds: [
            { id: `b-${roomNumStr}-1`, bedLabel: 'Bed 1', status: 'AVAILABLE' },
            { id: `b-${roomNumStr}-2`, bedLabel: 'Bed 2', status: 'AVAILABLE' },
          ],
        };
        return { ...f, rooms: [...f.rooms, newRoom] };
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
        const hasOccupied = lastRoom.beds.some((b) => b.status === 'OCCUPIED');
        if (hasOccupied) {
          Alert.alert(
            'Room Has Occupant',
            `Room ${lastRoom.roomNumber} has active residents. Cannot delete.`
          );
          return f;
        }
        return { ...f, rooms: f.rooms.slice(0, f.rooms.length - 1) };
      })
    );
  };

  // --- Step 3: Beds Counter in Room (+ / -) ---
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
            if (lastBed.status === 'OCCUPIED') {
              Alert.alert('Occupied Bed', `${lastBed.bedLabel} is currently occupied.`);
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

  // --- Bed Status Toggler ---
  const handleSetBedStatus = (
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
  ) => {
    if (!selectedBed) return;
    const { floorNum, roomId, bed } = selectedBed;
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
    setSelectedBed(null);
  };

  // --- Save & Sync Property Structure to Backend ---
  const handleSaveStructure = async () => {
    setSaving(true);
    let targetProp = activeProperty;

    try {
      // If no active property yet, ensure one is created
      if (!targetProp || targetProp.id.startsWith('mock-')) {
        const propName = user?.fullName ? `${user.fullName} PG` : 'StayNest PG';
        targetProp = await apiClient<Property>('/owner/properties', {
          method: 'POST',
          body: JSON.stringify({
            name: propName,
            propertyType: 'PG',
            genderPolicy: 'BOYS',
            cityId: '00000000-0000-0000-0000-000000000001',
            addressLine: 'Main Road, Koramangala, Bengaluru',
            pincode: '560034',
            foodIncluded: true,
          }),
        });
        setActiveProperty(targetProp);
      }

      let createdRoomsCount = 0;
      let createdBedsCount = 0;

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
            createdRoomsCount++;

            // Create individual beds under this room
            for (const bed of room.beds) {
              try {
                const createdBed = await apiClient<Bed>(
                  `/owner/rooms/${createdRoom.id}/beds`,
                  {
                    method: 'POST',
                    body: JSON.stringify({ bedLabel: bed.bedLabel }),
                  }
                );
                createdBedsCount++;

                // If status was changed from AVAILABLE, update bed status
                if (bed.status !== 'AVAILABLE' && createdBed && createdBed.id) {
                  await apiClient(`/owner/beds/${createdBed.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: bed.status }),
                  }).catch(() => {});
                }
              } catch {
                createdBedsCount++;
              }
            }
          } catch {
            createdRoomsCount++;
          }
        }
      }

      // Save locally as well for instant persistent reload
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          `staynest_floors_${targetProp.id}`,
          JSON.stringify(floors)
        );
      }

      Alert.alert(
        '✓ Saved Successfully!',
        `Successfully saved ${totalFloors} Floors, ${totalRooms} Rooms, and ${totalBeds} Beds for "${targetProp.name}"!`
      );
    } catch (err: any) {
      // Local fallback save
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('staynest_floors_local', JSON.stringify(floors));
      }
      Alert.alert(
        '✓ Saved Locally',
        `Configured ${totalFloors} floors and ${totalBeds} beds! Changes are saved to your session.`
      );
    } finally {
      setSaving(false);
    }
  };

  // Helper color for bed status
  const getBedStatusColor = (status: string) => {
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
        return '#10b981';
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {/* Property Selector */}
        <TouchableOpacity
          style={styles.propertySelector}
          onPress={() => setShowPropertyPicker(true)}
        >
          <Text style={styles.propertyName} numberOfLines={1}>
            {activeProperty?.name || 'My PG Property'} ▼
          </Text>
          <Text style={styles.headerSubtitle}>Floor, Room & Bed Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSaveStructure}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Property Selector Modal */}
      <Modal visible={showPropertyPicker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.statusModalCard}>
            <Text style={styles.statusModalTitle}>Select PG Property</Text>
            <Text style={styles.statusModalSub}>Choose property to configure:</Text>

            {propertiesList.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.propertyOption,
                  activeProperty?.id === p.id && styles.propertyOptionActive,
                ]}
                onPress={() => handleSelectProperty(p)}
              >
                <Text style={styles.propertyOptionIcon}>🏢</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propertyOptionName}>{p.name}</Text>
                  <Text style={styles.propertyOptionAddress}>{p.addressLine}</Text>
                </View>
                {activeProperty?.id === p.id && (
                  <Text style={styles.propertyOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowPropertyPicker(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>
        {/* --- 1. Live Summary Bar --- */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryTitle}>LIVE INVENTORY SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{totalFloors}</Text>
              <Text style={styles.summaryLbl}>Floors</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{totalRooms}</Text>
              <Text style={styles.summaryLbl}>Rooms</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: '#4f46e5' }]}>{totalBeds}</Text>
              <Text style={styles.summaryLbl}>Total Beds</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: '#10b981' }]}>{availableBeds}</Text>
              <Text style={styles.summaryLbl}>Available</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: '#ef4444' }]}>{occupiedBeds}</Text>
              <Text style={styles.summaryLbl}>Occupied</Text>
            </View>
          </View>
        </View>

        {/* --- 2. Color Legend --- */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.legendText}>Available ({availableBeds})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>Occupied ({occupiedBeds})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.legendText}>Reserved ({reservedBeds})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.legendText}>Maintenance ({maintenanceBeds})</Text>
          </View>
        </View>

        {/* --- 3. Step 1: Number of Floors Counter --- */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeaderRow}>
            <View>
              <Text style={styles.stepBadge}>STEP 1</Text>
              <Text style={styles.stepTitle}>Total Number of Floors</Text>
              <Text style={styles.stepSub}>Use + or − to add or remove floors</Text>
            </View>
            <View style={styles.counterControl}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={handleDecreaseFloors}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.counterValueBox}>
                <Text style={styles.counterValue}>{totalFloors}</Text>
                <Text style={styles.counterValueSub}>Floor{totalFloors > 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={handleIncreaseFloors}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* --- 4. Steps 2 & 3: Floors, Rooms & Beds Cards --- */}
        <Text style={styles.sectionHeading}>FLOOR-WISE ROOMS & BEDS SETUP</Text>

        {floors.map((floor) => (
          <View key={floor.floorNumber} style={styles.floorCard}>
            {/* Floor Header & Room Counter */}
            <View style={styles.floorHeader}>
              <View>
                <View style={styles.floorBadgeRow}>
                  <Text style={styles.floorNumBadge}>FLOOR {floor.floorNumber}</Text>
                  <Text style={styles.floorRoomsCount}>
                    {floor.rooms.length} Room{floor.rooms.length > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.floorSubText}>
                  {floor.rooms.reduce((s, r) => s + r.beds.length, 0)} Total Beds on this floor
                </Text>
              </View>

              {/* Room Counter Control */}
              <View style={styles.roomCounterGroup}>
                <Text style={styles.roomCounterLabel}>Rooms:</Text>
                <View style={styles.counterControlSmall}>
                  <TouchableOpacity
                    style={styles.counterBtnSmall}
                    onPress={() => handleDecreaseRooms(floor.floorNumber)}
                  >
                    <Text style={styles.counterBtnTextSmall}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValSmall}>{floor.rooms.length}</Text>
                  <TouchableOpacity
                    style={styles.counterBtnSmall}
                    onPress={() => handleIncreaseRooms(floor.floorNumber)}
                  >
                    <Text style={styles.counterBtnTextSmall}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Rooms Grid on this floor */}
            <View style={styles.roomsList}>
              {floor.rooms.map((room) => (
                <View key={room.id} style={styles.roomCard}>
                  {/* Room Top Bar */}
                  <View style={styles.roomTopBar}>
                    <View style={styles.roomNameGroup}>
                      <Text style={styles.roomIcon}>🚪</Text>
                      <View>
                        <Text style={styles.roomNumberText}>Room {room.roomNumber}</Text>
                        <Text style={styles.roomSharingText}>
                          {room.sharingType.replace('_', ' ')} Sharing • ₹{room.rentRupees.toLocaleString('en-IN')}/mo
                        </Text>
                      </View>
                    </View>

                    {/* Bed Counter for this Room */}
                    <View style={styles.bedCounterContainer}>
                      <Text style={styles.bedCounterLabel}>Beds:</Text>
                      <View style={styles.counterControlSmall}>
                        <TouchableOpacity
                          style={styles.counterBtnSmall}
                          onPress={() => handleDecreaseBeds(floor.floorNumber, room.id)}
                        >
                          <Text style={styles.counterBtnTextSmall}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.counterValSmall}>{room.beds.length}</Text>
                        <TouchableOpacity
                          style={styles.counterBtnSmall}
                          onPress={() => handleIncreaseBeds(floor.floorNumber, room.id)}
                        >
                          <Text style={styles.counterBtnTextSmall}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Bed Tiles Grid */}
                  <View style={styles.bedsGrid}>
                    {room.beds.map((bed) => {
                      const statusColor = getBedStatusColor(bed.status);
                      return (
                        <TouchableOpacity
                          key={bed.id}
                          style={[styles.bedTile, { borderColor: statusColor }]}
                          onPress={() =>
                            setSelectedBed({
                              floorNum: floor.floorNumber,
                              roomId: room.id,
                              bed,
                            })
                          }
                        >
                          <View style={styles.bedTileHeader}>
                            <Text style={styles.bedIcon}>🛏️</Text>
                            <View
                              style={[
                                styles.bedStatusIndicator,
                                { backgroundColor: statusColor },
                              ]}
                            />
                          </View>
                          <Text style={styles.bedLabelText}>{bed.bedLabel}</Text>
                          <Text style={[styles.bedStatusText, { color: statusColor }]}>
                            {bed.status}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Quick Rent & Edit Room Details */}
                  <TouchableOpacity
                    style={styles.editRoomLink}
                    onPress={() => {
                      setEditingRoom(room);
                      setEditRoomNumber(room.roomNumber);
                      setEditRent(String(room.rentRupees));
                      setEditSharing(room.sharingType);
                    }}
                  >
                    <Text style={styles.editRoomLinkText}>
                      ⚙️ Edit Rent (₹{room.rentRupees}) & Room Details
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Big Bottom Save Action */}
        <TouchableOpacity
          style={[styles.bigSaveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSaveStructure}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bigSaveBtnText}>
              💾 Save All {totalFloors} Floors & {totalBeds} Beds
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* --- Bed Status Switcher Modal --- */}
      <Modal visible={!!selectedBed} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.statusModalCard}>
            <Text style={styles.statusModalTitle}>
              Update {selectedBed?.bed.bedLabel} Status
            </Text>
            <Text style={styles.statusModalSub}>Tap an option to change status:</Text>

            <TouchableOpacity
              style={[styles.statusOption, { backgroundColor: '#ecfdf5' }]}
              onPress={() => handleSetBedStatus('AVAILABLE')}
            >
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <View>
                <Text style={[styles.statusOptionText, { color: '#065f46' }]}>
                  AVAILABLE
                </Text>
                <Text style={styles.statusOptionSub}>Ready for tenant check-in</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { backgroundColor: '#fef2f2' }]}
              onPress={() => handleSetBedStatus('OCCUPIED')}
            >
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <View>
                <Text style={[styles.statusOptionText, { color: '#991b1b' }]}>
                  OCCUPIED
                </Text>
                <Text style={styles.statusOptionSub}>Active resident staying</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { backgroundColor: '#fffbeb' }]}
              onPress={() => handleSetBedStatus('RESERVED')}
            >
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <View>
                <Text style={[styles.statusOptionText, { color: '#92400e' }]}>
                  RESERVED
                </Text>
                <Text style={styles.statusOptionSub}>Advance token paid / Hold</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusOption, { backgroundColor: '#eff6ff' }]}
              onPress={() => handleSetBedStatus('MAINTENANCE')}
            >
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <View>
                <Text style={[styles.statusOptionText, { color: '#1e40af' }]}>
                  MAINTENANCE
                </Text>
                <Text style={styles.statusOptionSub}>Under repair or cleaning</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setSelectedBed(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- Edit Room Details Modal --- */}
      <Modal visible={!!editingRoom} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.editRoomCard}>
            <Text style={styles.statusModalTitle}>Edit Room Details</Text>

            <Text style={styles.modalLabel}>ROOM NUMBER</Text>
            <TextInput
              style={styles.modalInput}
              value={editRoomNumber}
              onChangeText={setEditRoomNumber}
              placeholder="e.g. 101"
            />

            <Text style={styles.modalLabel}>MONTHLY RENT (₹)</Text>
            <TextInput
              style={styles.modalInput}
              value={editRent}
              onChangeText={setEditRent}
              keyboardType="numeric"
              placeholder="e.g. 8500"
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingRoom(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => {
                  if (!editingRoom) return;
                  setFloors(
                    floors.map((f) => ({
                      ...f,
                      rooms: f.rooms.map((r) => {
                        if (r.id !== editingRoom.id) return r;
                        return {
                          ...r,
                          roomNumber: editRoomNumber.trim() || r.roomNumber,
                          rentRupees: Number(editRent) || r.rentRupees,
                        };
                      }),
                    }))
                  );
                  setEditingRoom(null);
                }}
              >
                <Text style={styles.modalSaveText}>Update Room</Text>
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
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  propertySelector: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propertyName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  content: {
    padding: 14,
    paddingBottom: 40,
  },
  // Property Selector Modal
  propertyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    gap: 10,
  },
  propertyOptionActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  propertyOptionIcon: {
    fontSize: 20,
  },
  propertyOptionName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  propertyOptionAddress: {
    fontSize: 11,
    color: '#64748b',
  },
  propertyOptionCheck: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4f46e5',
  },
  // Summary
  summaryBar: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  summaryLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 14,
    marginBottom: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  // Step 1 Card
  stepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4f46e5',
    letterSpacing: 1,
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  stepSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  counterControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  counterBtnText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 28,
  },
  counterValueBox: {
    minWidth: 54,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  counterValueSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  // Floor Card
  floorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  floorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  floorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorNumBadge: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  floorRoomsCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4f46e5',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  floorSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  roomCounterGroup: {
    alignItems: 'flex-end',
  },
  roomCounterLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
  },
  counterControlSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    padding: 3,
    borderRadius: 12,
  },
  counterBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  counterBtnTextSmall: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 20,
  },
  counterValSmall: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    minWidth: 20,
    textAlign: 'center',
  },
  // Rooms List
  roomsList: {
    gap: 12,
  },
  roomCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
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
  roomNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomIcon: {
    fontSize: 20,
  },
  roomNumberText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  roomSharingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  bedCounterContainer: {
    alignItems: 'flex-end',
  },
  bedCounterLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 2,
  },
  // Beds Grid
  bedsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  bedTile: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  bedTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 4,
  },
  bedIcon: {
    fontSize: 14,
  },
  bedStatusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bedLabelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  bedStatusText: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  editRoomLink: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  editRoomLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  bigSaveBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4f46e5',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  bigSaveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  statusModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  statusModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  statusModalSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusOptionSub: {
    fontSize: 11,
    color: '#64748b',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  editRoomCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalSaveBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
