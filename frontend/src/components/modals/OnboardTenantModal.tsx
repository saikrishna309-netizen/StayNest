import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { tenantApi } from '../../api/tenant.api';
import { PropertySummary, Room } from '../../types';
import { useToast } from '../../context/ToastContext';

interface OnboardTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: PropertySummary[];
  onSuccess: () => void;
}

export const OnboardTenantModal: React.FC<OnboardTenantModalProps> = ({
  isOpen,
  onClose,
  properties,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [idProofType, setIdProofType] = useState('AADHAAR');
  const [idProofNumber, setIdProofNumber] = useState('');

  const [assignBed, setAssignBed] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [checkIn, setCheckIn] = useState(new Date().toISOString().split('T')[0]);
  const [rentRupees, setRentRupees] = useState('');
  const [depositRupees, setDepositRupees] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  useEffect(() => {
    if (selectedPropertyId && isOpen) {
      loadPropertyRooms(selectedPropertyId);
    }
  }, [selectedPropertyId, isOpen]);

  const loadPropertyRooms = async (propId: string) => {
    try {
      const prop = await propertyApi.getPropertyDetail(propId);
      const propRooms = prop.rooms || [];
      setRooms(propRooms);

      if (propRooms.length > 0) {
        setSelectedRoomId(propRooms[0].id);
        const availableBeds = (propRooms[0].beds || []).filter(
          (b) => b.status === 'AVAILABLE' || !b.status
        );
        if (availableBeds.length > 0) {
          setSelectedBedId(availableBeds[0].id);
        } else {
          setSelectedBedId('');
        }
        setRentRupees(String((propRooms[0].rentMonthlyPaise || 0) / 100));
        setDepositRupees(String((propRooms[0].depositPaise || 0) / 100));
      } else {
        setSelectedRoomId('');
        setSelectedBedId('');
      }
    } catch (err: any) {
      console.error('Failed to load rooms:', err);
    }
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      const availableBeds = (room.beds || []).filter((b) => b.status === 'AVAILABLE' || !b.status);
      if (availableBeds.length > 0) {
        setSelectedBedId(availableBeds[0].id);
      } else {
        setSelectedBedId('');
      }
      setRentRupees(String((room.rentMonthlyPaise || 0) / 100));
      setDepositRupees(String((room.depositPaise || 0) / 100));
    }
  };

  if (!isOpen) return null;

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);
  const availableBeds = (currentRoom?.beds || []).filter((b) => b.status === 'AVAILABLE' || !b.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create Tenant Profile
      const tenant = await tenantApi.createTenant({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        emergencyContact: emergencyContact.trim() || null,
        idProofType,
        idProofNumber: idProofNumber.trim() || 'NOT_PROVIDED',
      });

      // 2. Assign Bed & Record Stay if toggled
      if (assignBed) {
        if (!selectedBedId) {
          throw new Error('Please select an available bed to allocate');
        }

        await tenantApi.recordStay(tenant.id, {
          propertyId: selectedPropertyId,
          roomId: selectedRoomId,
          bedId: selectedBedId,
          checkIn,
          monthlyRentPaise: Math.round(parseFloat(rentRupees || '0') * 100),
          securityDepositPaise: Math.round(parseFloat(depositRupees || '0') * 100),
        });
      }

      showToast(`Tenant ${fullName} onboarded & bed allocated!`);
      onClose();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to onboard tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl p-6 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center text-lg shadow-md shadow-brand-500/30">
            <i className="fa-solid fa-user-plus"></i>
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Onboard Tenant & Allocate Bed</h3>
            <p className="text-xs text-slate-500">Record tenant profile and immediately assign an available PG bed</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Tenant Personal Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <span className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              1. Tenant Profile
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Emergency Contact</label>
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Parent / Guardian phone"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ID Proof Type</label>
                <select
                  value={idProofType}
                  onChange={(e) => setIdProofType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="AADHAAR">Aadhaar Card</option>
                  <option value="PAN">PAN Card</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ID Proof Number</label>
                <input
                  type="text"
                  value={idProofNumber}
                  onChange={(e) => setIdProofNumber(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Bed Allocation */}
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-brand-900 uppercase tracking-wider">
                2. Room & Bed Allocation
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-brand-700">
                <input
                  type="checkbox"
                  checked={assignBed}
                  onChange={(e) => setAssignBed(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span>Allocate Bed Now</span>
              </label>
            </div>

            {assignBed && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Select Property *</label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.localityName || p.cityName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Room *</label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => handleRoomChange(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.roomNumber} (Floor {r.floorNumber} - {r.sharingType})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select Available Bed *</label>
                    <select
                      value={selectedBedId}
                      onChange={(e) => setSelectedBedId(e.target.value)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {availableBeds.length === 0 ? (
                        <option value="">No available beds</option>
                      ) : (
                        availableBeds.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bedLabel} (Available)
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Check-in Date *</label>
                    <input
                      type="date"
                      required
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Monthly Rent (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        value={rentRupees}
                        onChange={(e) => setRentRupees(e.target.value)}
                        placeholder="INR 8,500"
                        className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-7 pr-3 font-semibold outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Security Deposit (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        value={depositRupees}
                        onChange={(e) => setDepositRupees(e.target.value)}
                        placeholder="INR 2,500"
                        className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-7 pr-3 font-semibold outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-2.5 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg font-bold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm shadow-brand-500/30 transition flex items-center gap-1.5"
            >
              {loading && <i className="fa-solid fa-spinner fa-spin"></i>}
              <span>Onboard & Allocate</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

