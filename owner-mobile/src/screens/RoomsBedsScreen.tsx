import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiClient } from '../api/client';
import { Property, Room, Bed } from '../types';

interface RoomsBedsScreenProps {
  property: Property | null;
  onBack: () => void;
}

export const RoomsBedsScreen: React.FC<RoomsBedsScreenProps> = ({ property, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showAddRoom, setShowAddRoom] = useState(false);

  // New Room Form
  const [floorNumber, setFloorNumber] = useState('1');
  const [roomNumber, setRoomNumber] = useState('');
  const [sharingType, setSharingType] = useState('DOUBLE');
  const [capacity, setCapacity] = useState('2');
  const [rentRupees, setRentRupees] = useState('9500');
  const [depositRupees, setDepositRupees] = useState('9500');
  const [submitting, setSubmitting] = useState(false);

  // Quick Add Bed
  const [addingBedRoomId, setAddingBedRoomId] = useState<string | null>(null);
  const [bedLabel, setBedLabel] = useState('');

  useEffect(() => {
    if (property) {
      loadRooms();
    }
  }, [property]);

  const loadRooms = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const data = await apiClient<Property>(`/properties/${property.id}`);
      setRooms(data.rooms || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!property || !roomNumber.trim()) {
      Alert.alert('Required', 'Please enter room number');
      return;
    }

    setSubmitting(true);
    try {
      const cap = Number(capacity) || 2;
      const created = await apiClient<Room>(`/owner/properties/${property.id}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          floorNumber: Number(floorNumber) || 1,
          roomNumber: roomNumber.trim(),
          sharingType,
          capacity: cap,
          rentMonthlyPaise: Number(rentRupees) * 100,
          depositPaise: Number(depositRupees) * 100,
        }),
      });

      // Pre-create beds
      for (let i = 1; i <= cap; i++) {
        try {
          await apiClient(`/owner/rooms/${created.id}/beds`, {
            method: 'POST',
            body: JSON.stringify({ bedLabel: `Bed ${i}` }),
          });
        } catch {
          // ignore
        }
      }

      Alert.alert('Success', `Room ${roomNumber} added with ${cap} beds!`);
      setRoomNumber('');
      setShowAddRoom(false);
      loadRooms();
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBed = async (roomId: string) => {
    if (!bedLabel.trim()) return;
    try {
      await apiClient(`/owner/rooms/${roomId}/beds`, {
        method: 'POST',
        body: JSON.stringify({ bedLabel: bedLabel.trim() }),
      });
      setAddingBedRoomId(null);
      setBedLabel('');
      loadRooms();
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not add bed');
    }
  };

  // Group rooms by floor
  const roomsByFloor: Record<number, Room[]> = {};
  rooms.forEach((r) => {
    const floor = r.floorNumber || 1;
    if (!roomsByFloor[floor]) roomsByFloor[floor] = [];
    roomsByFloor[floor].push(r);
  });

  const sortedFloors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {property?.name || 'Floors & Rooms'}
        </Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddRoom(!showAddRoom)}
        >
          <Text style={styles.addBtnText}>+ Room</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Collapsible Form */}
        {showAddRoom && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add New Floor / Room</Text>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>FLOOR #</Text>
                <TextInput
                  style={styles.input}
                  value={floorNumber}
                  onChangeText={setFloorNumber}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>ROOM #</Text>
                <TextInput
                  style={styles.input}
                  value={roomNumber}
                  onChangeText={setRoomNumber}
                  placeholder="e.g. 101"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>BEDS (CAPACITY)</Text>
                <TextInput
                  style={styles.input}
                  value={capacity}
                  onChangeText={setCapacity}
                  keyboardType="numeric"
                  placeholder="2"
                />
              </View>

              <View style={styles.col}>
                <Text style={styles.label}>MONTHLY RENT (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={rentRupees}
                  onChangeText={setRentRupees}
                  keyboardType="numeric"
                  placeholder="9500"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreateRoom}
              disabled={submitting}
            >
              <Text style={styles.saveBtnText}>
                {submitting ? 'Generating Beds...' : 'Save Room & Create Beds'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#4f46e5" style={{ marginVertical: 40 }} />
        ) : rooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Floors or Rooms Added</Text>
            <Text style={styles.emptySub}>
              Tap '+ Room' at the top to configure floors, rooms, and bed capacity.
            </Text>
          </View>
        ) : (
          sortedFloors.map((floor) => (
            <View key={floor} style={styles.floorCard}>
              <View style={styles.floorHeader}>
                <Text style={styles.floorTitle}>
                  {floor === 0 ? 'Ground Floor' : `Floor ${floor}`}
                </Text>
                <Text style={styles.floorCount}>
                  {roomsByFloor[floor].length} Rooms
                </Text>
              </View>

              {roomsByFloor[floor].map((room) => {
                const roomBeds = room.beds || [];
                const isAdding = addingBedRoomId === room.id;

                return (
                  <View key={room.id} style={styles.roomItem}>
                    <View style={styles.roomHeader}>
                      <View>
                        <Text style={styles.roomNumber}>Room {room.roomNumber}</Text>
                        <Text style={styles.roomSharing}>
                          {room.sharingType} • {room.capacity} Beds
                        </Text>
                      </View>
                      <Text style={styles.roomRent}>
                        ₹{(room.rentMonthlyPaise / 100).toLocaleString('en-IN')}/mo
                      </Text>
                    </View>

                    {/* Bed Chips */}
                    <View style={styles.bedRow}>
                      {roomBeds.map((b) => (
                        <View
                          key={b.id}
                          style={[
                            styles.bedChip,
                            b.status === 'OCCUPIED'
                              ? styles.bedOccupied
                              : styles.bedAvailable,
                          ]}
                        >
                          <Text
                            style={[
                              styles.bedChipText,
                              b.status === 'OCCUPIED'
                                ? styles.bedOccupiedText
                                : styles.bedAvailableText,
                            ]}
                          >
                            {b.bedLabel} ({b.status === 'OCCUPIED' ? 'Booked' : 'Available'})
                          </Text>
                        </View>
                      ))}

                      <TouchableOpacity
                        style={styles.addBedChip}
                        onPress={() => {
                          setAddingBedRoomId(room.id);
                          setBedLabel(`Bed ${roomBeds.length + 1}`);
                        }}
                      >
                        <Text style={styles.addBedChipText}>+ Add Bed</Text>
                      </TouchableOpacity>
                    </View>

                    {isAdding && (
                      <View style={styles.inlineAddBed}>
                        <TextInput
                          style={styles.inlineInput}
                          value={bedLabel}
                          onChangeText={setBedLabel}
                          placeholder="Bed Label (e.g. Bed C)"
                        />
                        <TouchableOpacity
                          style={styles.inlineSaveBtn}
                          onPress={() => handleAddBed(room.id)}
                        >
                          <Text style={styles.inlineSaveBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
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
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4f46e5',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  addBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  content: {
    padding: 16,
  },
  formCard: {
    backgroundColor: '#eef2ff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#312e81',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338ca',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#4f46e5',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  floorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  floorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  floorTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e293b',
  },
  floorCount: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  roomItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roomNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  roomSharing: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  roomRent: {
    fontSize: 13,
    fontWeight: '900',
    color: '#4f46e5',
  },
  bedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  bedChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  bedAvailable: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  bedOccupied: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  bedChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  bedAvailableText: {
    color: '#059669',
  },
  bedOccupiedText: {
    color: '#2563eb',
  },
  addBedChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#ffffff',
  },
  addBedChipText: {
    fontSize: 10,
    color: '#4f46e5',
    fontWeight: '800',
  },
  inlineAddBed: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  inlineInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 12,
  },
  inlineSaveBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  inlineSaveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
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
});
