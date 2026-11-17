import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { PropertyDetail } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface PropertyDetailModalProps {
  propertyId: string | null;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  propertyId,
  onClose,
  onOpenAuth,
}) => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (propertyId) {
      loadProperty(propertyId);
    } else {
      setProperty(null);
    }
  }, [propertyId]);

  const loadProperty = async (id: string) => {
    setLoading(true);
    try {
      const data = await propertyApi.getPropertyDetail(id);
      setProperty(data);
      const floors = Array.from(new Set((data.rooms || []).map((r) => r.floorNumber || 1))).sort(
        (a, b) => a - b
      );
      if (floors.length > 0) setSelectedFloor(floors[0]);
    } catch (err: any) {
      showToast(err.message || 'Failed to load property details', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!propertyId || !property) return null;

  const floors = Array.from(new Set((property.rooms || []).map((r) => r.floorNumber || 1))).sort(
    (a, b) => a - b
  );

  const roomsOnFloor = (property.rooms || []).filter(
    (r) => (r.floorNumber || 1) === selectedFloor
  );

  const handleHoldBed = async (bedLabel: string, roomNumber: string) => {
    if (!isAuthenticated) {
      showToast('Please sign in as a Customer to reserve a bed', 'info');
      onOpenAuth();
      return;
    }

    showToast(`Bed ${bedLabel} in Room ${roomNumber} locked for 15 minutes! Check-in: ${checkInDate}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 shadow"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="p-6 md:p-8 max-h-[85vh] overflow-y-auto space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-700">
                {property.genderPolicy}
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {property.approvalStatus}
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">{property.name}</h3>
            <p className="text-xs text-slate-500 mt-1">
              <i className="fa-solid fa-location-dot text-slate-400 mr-1"></i>
              {property.addressLine}, {property.localityName ? `${property.localityName}, ` : ''}{property.cityName} - {property.pincode}
            </p>
          </div>

          {/* Amenities */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Included Amenities & Facilities
            </span>
            <div className="flex flex-wrap gap-2">
              {(property.amenities || []).map((amenity) => (
                <span
                  key={amenity}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                >
                  <i className="fa-solid fa-check text-emerald-600 mr-1.5"></i>
                  {amenity.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Floor & Bed Inventory */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">Floor-Wise Room & Bed Inventory</h4>
                <p className="text-xs text-slate-500">Pick an available bed to lock it instantly for 15 minutes.</p>
              </div>

              {/* Check-in Date Picker */}
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 pl-2">
                  <i className="fa-regular fa-calendar text-brand-600 mr-1"></i> Check-in:
                </span>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Floor Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl mb-4 overflow-x-auto">
              {floors.map((floor) => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    selectedFloor === floor
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Floor {floor}
                </button>
              ))}
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roomsOnFloor.map((room) => {
                const rent = (room.rentMonthlyPaise / 100).toLocaleString('en-IN');
                const beds = room.beds || [];

                return (
                  <div key={room.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-extrabold text-slate-800">Room {room.roomNumber}</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-700">
                          {room.sharingType}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-slate-900 mb-3">
                        ₹{rent} <span className="text-xs font-normal text-slate-400">/mo</span>
                      </div>

                      {/* Beds list */}
                      <div className="space-y-1.5 mb-2">
                        {beds.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between text-xs p-2 rounded-lg bg-white border border-slate-200"
                          >
                            <span className="font-semibold text-slate-700">
                              <i className="fa-solid fa-bed text-slate-400 mr-1.5"></i>
                              {b.bedLabel}
                            </span>
                            {b.status === 'AVAILABLE' || !b.status ? (
                              <button
                                onClick={() => handleHoldBed(b.bedLabel, room.roomNumber)}
                                className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-bold text-[11px] transition"
                              >
                                Hold Bed
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400">
                                Occupied
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            <i className="fa-solid fa-shield-check text-emerald-600 mr-1.5"></i> Verified StayNest PG Listing
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
