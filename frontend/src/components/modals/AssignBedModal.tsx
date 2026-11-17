import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { tenantApi } from '../../api/tenant.api';
import { PropertySummary, Room, Tenant } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AssignBedModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant | null;
  properties: PropertySummary[];
  onSuccess: () => void;
}

export const AssignBedModal: React.FC<AssignBedModalProps> = ({
  isOpen,
  onClose,
  tenant,
  properties,
  onSuccess,
}) => {
  const { showToast } = useToast();

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
        setSelectedBedId(availableBeds.length > 0 ? availableBeds[0].id : '');
        setRentRupees(String((propRooms[0].rentMonthlyPaise || 0) / 100));
        setDepositRupees(String((propRooms[0].depositPaise || 0) / 100));
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRoomChange = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      const availableBeds = (room.beds || []).filter((b) => b.status === 'AVAILABLE' || !b.status);
      setSelectedBedId(availableBeds.length > 0 ? availableBeds[0].id : '');
      setRentRupees(String((room.rentMonthlyPaise || 0) / 100));
      setDepositRupees(String((room.depositPaise || 0) / 100));
    }
  };

  if (!isOpen || !tenant) return null;

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);
  const availableBeds = (currentRoom?.beds || []).filter((b) => b.status === 'AVAILABLE' || !b.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedId) {
      setError('Please select an available bed');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await tenantApi.recordStay(tenant.id, {
        propertyId: selectedPropertyId,
        roomId: selectedRoomId,
        bedId: selectedBedId,
        checkIn,
        monthlyRentPaise: Math.round(parseFloat(rentRupees || '0') * 100),
        securityDepositPaise: Math.round(parseFloat(depositRupees || '0') * 100),
      });

      showToast(`Bed successfully assigned to ${tenant.fullName}!`);
      onClose();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to assign bed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center text-lg shadow-md shadow-brand-500/30">
            <i className="fa-solid fa-bed"></i>
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Assign Bed to Tenant</h3>
            <p className="text-xs text-brand-600 font-bold">{tenant.fullName} ({tenant.phone})</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Select Property *</label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
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
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
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
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
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
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Monthly Rent (₹) *</label>
              <input
                type="number"
                required
                value={rentRupees}
                onChange={(e) => setRentRupees(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Security Deposit (₹)</label>
              <input
                type="number"
                value={depositRupees}
                onChange={(e) => setDepositRupees(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg font-bold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
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
              <span>Confirm Bed Assignment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
