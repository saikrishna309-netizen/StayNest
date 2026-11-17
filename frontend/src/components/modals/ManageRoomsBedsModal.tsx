import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { PropertyDetail, PropertySummary, Room } from '../../types';
import { useToast } from '../../context/ToastContext';

interface ManageRoomsBedsModalProps {
  property: PropertySummary | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent: () => void;
}

export const ManageRoomsBedsModal: React.FC<ManageRoomsBedsModalProps> = ({
  property,
  isOpen,
  onClose,
  onRefreshParent,
}) => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [propertyDetail, setPropertyDetail] = useState<PropertyDetail | null>(null);

  // New Room Form State
  const [showAddRoomForm, setShowAddRoomForm] = useState(false);
  const [floorNumber, setFloorNumber] = useState<number>(1);
  const [roomNumber, setRoomNumber] = useState<string>('');
  const [sharingType, setSharingType] = useState<string>('DOUBLE');
  const [capacity, setCapacity] = useState<number>(2);
  const [monthlyRentRupees, setMonthlyRentRupees] = useState<number>(9500);
  const [depositRupees, setDepositRupees] = useState<number>(9500);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  // Adding bed state
  const [addingBedRoomId, setAddingBedRoomId] = useState<string | null>(null);
  const [newBedLabel, setNewBedLabel] = useState<string>('');

  useEffect(() => {
    if (isOpen && property) {
      loadDetails();
    }
  }, [isOpen, property]);

  const loadDetails = async () => {
    if (!property) return;
    setLoading(true);
    try {
      const data = await propertyApi.getPropertyDetail(property.id);
      setPropertyDetail(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load property rooms', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSharingTypeChange = (type: string) => {
    setSharingType(type);
    if (type === 'SINGLE') {
      setCapacity(1);
      setMonthlyRentRupees(15000);
    } else if (type === 'DOUBLE') {
      setCapacity(2);
      setMonthlyRentRupees(9500);
    } else if (type === 'TRIPLE') {
      setCapacity(3);
      setMonthlyRentRupees(7500);
    } else if (type === 'FOUR_PLUS') {
      setCapacity(4);
      setMonthlyRentRupees(6500);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;

    if (!roomNumber.trim()) {
      showToast('Please enter a room number', 'error');
      return;
    }

    setIsSubmittingRoom(true);
    try {
      // 1. Create the room on backend
      const createdRoom = await propertyApi.createRoom(property.id, {
        floorNumber: Number(floorNumber),
        roomNumber: roomNumber.trim(),
        sharingType,
        capacity: Number(capacity),
        rentMonthlyPaise: Math.round(monthlyRentRupees * 100),
        depositPaise: Math.round(depositRupees * 100),
      });

      // 2. Pre-create beds matching the capacity
      for (let i = 1; i <= capacity; i++) {
        try {
          await propertyApi.createBed(createdRoom.id, `Bed ${i}`);
        } catch {
          // ignore bed creation error if already exists
        }
      }

      showToast(`Room ${roomNumber} with ${capacity} beds created successfully!`);
      setRoomNumber('');
      setShowAddRoomForm(false);
      await loadDetails();
      onRefreshParent();
    } catch (err: any) {
      showToast(err.message || 'Failed to create room', 'error');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleAddBedToRoom = async (roomId: string) => {
    if (!newBedLabel.trim()) return;

    try {
      await propertyApi.createBed(roomId, newBedLabel.trim());
      showToast(`Added ${newBedLabel} to room!`);
      setAddingBedRoomId(null);
      setNewBedLabel('');
      await loadDetails();
      onRefreshParent();
    } catch (err: any) {
      showToast(err.message || 'Failed to add bed', 'error');
    }
  };

  if (!isOpen || !property) return null;

  const rooms = propertyDetail?.rooms || [];

  // Group rooms by floor
  const roomsByFloor: Record<number, typeof rooms> = {};
  rooms.forEach((r) => {
    const floor = r.floorNumber || 1;
    if (!roomsByFloor[floor]) {
      roomsByFloor[floor] = [];
    }
    roomsByFloor[floor].push(r);
  });

  const sortedFloors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  const totalBeds = rooms.reduce((acc, r) => acc + (r.beds ? r.beds.length : 0), 0);
  const occupiedBeds = rooms.reduce(
    (acc, r) => acc + (r.beds ? r.beds.filter((b) => b.status === 'OCCUPIED').length : 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl p-6 relative my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-lg">
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{property.name}</h3>
              <p className="text-xs text-slate-500">Manage Floors, Rooms & Bed Inventory</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddRoomForm(!showAddRoomForm)}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <i className="fa-solid fa-plus"></i> Add Floor / Room
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Rooms</span>
            <span className="text-base font-black text-slate-800">{rooms.length} Rooms</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Beds</span>
            <span className="text-base font-black text-brand-600">{totalBeds} Beds</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Bed Occupancy</span>
            <span className="text-base font-black text-emerald-600">
              {occupiedBeds} / {totalBeds} Occupied
            </span>
          </div>
        </div>

        {/* Collapsible Add Room Form */}
        {showAddRoomForm && (
          <div className="bg-brand-50/60 border border-brand-200 rounded-xl p-4 mb-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-extrabold text-brand-900 flex items-center gap-1.5">
                <i className="fa-solid fa-door-open text-brand-600"></i> Onboard New Room & Floor
              </h4>
              <button
                type="button"
                onClick={() => setShowAddRoomForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Floor Number *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={20}
                    value={floorNumber}
                    onChange={(e) => setFloorNumber(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="e.g. 1"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="e.g. 101, 102"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Sharing Type *
                  </label>
                  <select
                    value={sharingType}
                    onChange={(e) => handleSharingTypeChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    <option value="SINGLE">Single (1 Bed)</option>
                    <option value="DOUBLE">Double (2 Beds)</option>
                    <option value="TRIPLE">Triple (3 Beds)</option>
                    <option value="FOUR_PLUS">4+ Sharing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Total Beds (Capacity)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Monthly Rent / Bed (₹) *
                  </label>
                  <input
                    type="number"
                    min={1000}
                    value={monthlyRentRupees}
                    onChange={(e) => setMonthlyRentRupees(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Security Deposit (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={depositRupees}
                    onChange={(e) => setDepositRupees(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddRoomForm(false)}
                  className="px-3 py-1.5 text-slate-500 hover:text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRoom}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  {isSubmittingRoom && <i className="fa-solid fa-spinner fa-spin"></i>}
                  <span>Save Room & Generate Beds</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Room & Floor Inventory List */}
        <div className="flex-grow overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-brand-600 mb-2"></i>
              <p className="text-xs font-bold">Loading floor & room layout...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <i className="fa-solid fa-building-circle-exclamation text-3xl text-slate-300 mb-2"></i>
              <h4 className="font-extrabold text-slate-700 text-sm">No Rooms or Beds Added Yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Configure your floors, rooms, sharing types, and beds so tenants can be assigned.
              </p>
              <button
                onClick={() => setShowAddRoomForm(true)}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <i className="fa-solid fa-plus mr-1"></i> Add First Room
              </button>
            </div>
          ) : (
            sortedFloors.map((floor) => (
              <div key={floor} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-brand-600 text-white flex items-center justify-center font-extrabold text-[11px]">
                      {floor === 0 ? 'G' : floor}
                    </span>
                    <span className="font-extrabold text-slate-800 text-xs">
                      {floor === 0 ? 'Ground Floor' : `Floor ${floor}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">
                    {roomsByFloor[floor].length} Rooms
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {roomsByFloor[floor].map((room) => {
                    const roomBeds = room.beds || [];
                    const isAddingBed = addingBedRoomId === room.id;

                    return (
                      <div
                        key={room.id}
                        className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div>
                            <span className="font-black text-slate-900 text-sm">
                              Room {room.roomNumber}
                            </span>
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                              {room.sharingType}
                            </span>
                          </div>
                          <span className="text-[11px] font-extrabold text-brand-600">
                            ₹{(room.rentMonthlyPaise / 100).toLocaleString('en-IN')}/mo
                          </span>
                        </div>

                        {/* Beds in this Room */}
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              Beds ({roomBeds.length}/{room.capacity})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingBedRoomId(room.id);
                                setNewBedLabel(`Bed ${roomBeds.length + 1}`);
                              }}
                              className="text-[10px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                            >
                              <i className="fa-solid fa-plus text-[8px]"></i> Add Bed
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {roomBeds.map((bed) => {
                              const isOccupied = bed.status === 'OCCUPIED';
                              return (
                                <span
                                  key={bed.id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    isOccupied
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  <i
                                    className={`fa-solid fa-bed text-[9px] ${
                                      isOccupied ? 'text-blue-500' : 'text-emerald-500'
                                    }`}
                                  ></i>
                                  <span>{bed.bedLabel}</span>
                                  <span className="text-[8px] font-normal opacity-70">
                                    ({isOccupied ? 'Occupied' : 'Available'})
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {/* Quick Add Bed Input */}
                          {isAddingBed && (
                            <div className="mt-2 flex items-center gap-1.5 animate-fadeIn">
                              <input
                                type="text"
                                autoFocus
                                value={newBedLabel}
                                onChange={(e) => setNewBedLabel(e.target.value)}
                                placeholder="Bed Label (e.g. Bed C)"
                                className="flex-grow bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddBedToRoom(room.id)}
                                className="px-2 py-1 bg-brand-600 text-white rounded text-xs font-bold"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => setAddingBedRoomId(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 text-xs"
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
