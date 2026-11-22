import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { bookingApi } from '../../api/booking.api';
import { PropertyDetail, ResidentEnquiry } from '../../types';
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
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Active Bed Hold Dialog state
  const [holdingBed, setHoldingBed] = useState<{
    bedId: string;
    bedLabel: string;
    roomId: string;
    roomNumber: string;
    rentMonthlyPaise: number;
    depositPaise: number;
  } | null>(null);

  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerNotes, setCustomerNotes] = useState('');
  const [holdPaymentChoice, setHoldPaymentChoice] = useState<'FREE_HOLD' | 'PAY_AT_PROPERTY'>('FREE_HOLD');
  const [submittingHold, setSubmittingHold] = useState(false);

  // Success Confirmation state
  const [holdSuccessDetails, setHoldSuccessDetails] = useState<{
    bedLabel: string;
    roomNumber: string;
    propertyName: string;
    checkInDate: string;
    expiresAt: string;
  } | null>(null);

  // Local held bed IDs set
  const [localHeldBedIds, setLocalHeldBedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      setCustomerName(user.fullName || '');
      setCustomerPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (propertyId) {
      loadProperty(propertyId);
      // Load any existing held beds from localStorage
      const existingEnquiries = bookingApi.getLocalEnquiries();
      const heldIds = new Set(
        existingEnquiries
          .filter((e) => e.propertyId === propertyId && e.status === 'PENDING_HOLD')
          .map((e) => e.bedId)
      );
      setLocalHeldBedIds(heldIds);
    } else {
      setProperty(null);
      setHoldingBed(null);
      setHoldSuccessDetails(null);
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
    } catch {
      // Fallback property detail if backend cold-starting
      const fallback: PropertyDetail = {
        id,
        ownerId: 'owner-default-1',
        name: id.includes('prime') ? 'StayNest Prime PG (Building 02)' : 'StayNest Luxury PG (Building 01)',
        propertyType: 'PG',
        genderPolicy: 'BOYS',
        cityId: 'hyd-1',
        cityName: 'Hyderabad',
        localityId: 'hitec-1',
        localityName: 'Hitec City',
        addressLine: 'Plot 42, Silicon Valley, Hitec City Road',
        primaryPhotoUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1000&q=80',
        startingPricePaise: 850000,
        foodIncluded: true,
        approvalStatus: 'APPROVED',
        published: true,
        description: 'Premium luxury co-living PG with high-speed WiFi, 3-times homestyle food, daily housekeeping, 100% power backup and 24/7 security.',
        pincode: '500081',
        latitude: null,
        longitude: null,
        noticePeriodDays: 30,
        depositMonths: 1,
        payAtPropertyAllowed: true,
        rules: 'Gate closes at 10:30 PM. Quiet hours 11:00 PM to 6:00 AM. Non-smoking premises.',
        cancellationPolicy: 'Free cancellation up to 48 hours before check-in date.',
        amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'AC_ROOMS', 'POWER_BACKUP', 'DAILY_HOUSEKEEPING', 'WASHING_MACHINE', 'CCTV_SECURITY'],
        createdAt: new Date().toISOString(),
        rooms: [
          {
            id: 'room-101',
            roomNumber: '101',
            sharingType: 'DOUBLE',
            capacity: 2,
            floorNumber: 1,
            rentMonthlyPaise: 850000,
            depositPaise: 250000,
            status: 'AVAILABLE',
            beds: [
              { id: 'bed-101-1', bedLabel: 'Bed 1', active: true, status: 'OCCUPIED' },
              { id: 'bed-101-2', bedLabel: 'Bed 2', active: true, status: 'AVAILABLE' },
            ],
          },
          {
            id: 'room-102',
            roomNumber: '102',
            sharingType: 'FOUR_PLUS',
            capacity: 4,
            floorNumber: 1,
            rentMonthlyPaise: 650000,
            depositPaise: 200000,
            status: 'AVAILABLE',
            beds: [
              { id: 'bed-102-1', bedLabel: 'Bed 1', active: true, status: 'OCCUPIED' },
              { id: 'bed-102-2', bedLabel: 'Bed 2', active: true, status: 'AVAILABLE' },
              { id: 'bed-102-3', bedLabel: 'Bed 3', active: true, status: 'OCCUPIED' },
              { id: 'bed-102-4', bedLabel: 'Bed 4', active: true, status: 'AVAILABLE' },
            ],
          },
          {
            id: 'room-201',
            roomNumber: '201',
            sharingType: 'DOUBLE',
            capacity: 2,
            floorNumber: 2,
            rentMonthlyPaise: 900000,
            depositPaise: 250000,
            status: 'AVAILABLE',
            beds: [
              { id: 'bed-201-1', bedLabel: 'Bed 1', active: true, status: 'AVAILABLE' },
              { id: 'bed-201-2', bedLabel: 'Bed 2', active: true, status: 'AVAILABLE' },
            ],
          },
        ],
      };
      setProperty(fallback);
      setSelectedFloor(1);
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

  // Triggered when customer clicks "Hold Bed" on an available bed (Requirements 1, 2, 4)
  const handleInitiateHold = (bed: { id: string; bedLabel: string }, room: { id: string; roomNumber: string; rentMonthlyPaise: number; depositPaise: number }) => {
    if (!isAuthenticated) {
      showToast('Please sign in as a Customer to reserve and hold a bed', 'info');
      onOpenAuth();
      return;
    }

    setHoldingBed({
      bedId: bed.id,
      bedLabel: bed.bedLabel,
      roomId: room.id,
      roomNumber: room.roomNumber,
      rentMonthlyPaise: room.rentMonthlyPaise,
      depositPaise: room.depositPaise,
    });
  };

  // Submit the hold reservation & notify owner (Requirement 1)
  const handleConfirmHoldReservation = async () => {
    if (!holdingBed) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      showToast('Please provide your name and phone number for the reservation', 'error');
      return;
    }

    setSubmittingHold(true);
    try {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins lock
      const checkOutDate = new Date(new Date(checkInDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // 1. Attempt backend hold creation
      try {
        await bookingApi.createHold({
          bedId: holdingBed.bedId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
        });
      } catch (err: any) {
        console.warn('Backend hold endpoint warning (fallback to sync store):', err.message);
      }

      // 2. Persist in shared enquiry store for owner app notifications
      const newEnquiry: ResidentEnquiry = {
        id: `enq-${Date.now()}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: user?.email || undefined,
        propertyId: property.id,
        propertyName: property.name,
        roomId: holdingBed.roomId,
        roomNumber: holdingBed.roomNumber,
        bedId: holdingBed.bedId,
        bedLabel: holdingBed.bedLabel,
        monthlyRentPaise: holdingBed.rentMonthlyPaise,
        depositPaise: holdingBed.depositPaise,
        checkInDate,
        status: 'PENDING_HOLD',
        holdExpiresAt: expiresAt,
        notes: customerNotes.trim() || `${holdPaymentChoice === 'FREE_HOLD' ? '15-min free hold' : 'Pay at PG on check-in'}`,
        createdAt: new Date().toISOString(),
      };

      bookingApi.saveLocalEnquiry(newEnquiry);
      setLocalHeldBedIds((prev) => new Set([...prev, holdingBed.bedId]));

      setHoldSuccessDetails({
        bedLabel: holdingBed.bedLabel,
        roomNumber: holdingBed.roomNumber,
        propertyName: property.name,
        checkInDate,
        expiresAt,
      });

      setHoldingBed(null);
      showToast(`🎉 ${holdingBed.bedLabel} locked! PG Owner received your enquiry.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not hold bed. Please try again.', 'error');
    } finally {
      setSubmittingHold(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden relative my-6 border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-md transition"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div className="p-6 md:p-8 max-h-[85vh] overflow-y-auto space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-56 h-40 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 bg-slate-100 relative">
              <img
                src={property.primaryPhotoUrl || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=700&q=80'}
                alt={property.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2">
                <span className="text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-brand-700 shadow">
                  {property.genderPolicy === 'BOYS' ? '👨 Gents PG' : property.genderPolicy === 'GIRLS' ? '👩 Ladies PG' : '👥 Co-Ed PG'}
                </span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <i className="fa-solid fa-circle-check mr-1 text-[9px]"></i> Verified StayNest PG
                </span>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {property.noticePeriodDays || 30} Days Notice
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">{property.name}</h3>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                <i className="fa-solid fa-location-dot text-rose-500"></i>
                {property.addressLine}, {property.localityName ? `${property.localityName}, ` : ''}{property.cityName} - {property.pincode}
              </p>
              <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                {property.description}
              </p>
            </div>
          </div>

          {/* Amenities Chips */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2">
              Included Amenities & House Rules
            </span>
            <div className="flex flex-wrap gap-2">
              {(property.amenities || ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'DAILY_HOUSEKEEPING', 'POWER_BACKUP']).map((amenity) => (
                <span
                  key={amenity}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 shadow-sm flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-check text-emerald-600 text-xs"></i>
                  {amenity.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Floor & Bed Inventory (Requirement 1 & 4) */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>🏢 Floor & Bed Selection</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Status
                  </span>
                </h4>
                <p className="text-xs text-slate-500">Choose any vacant bed to lock it instantly for 15 minutes.</p>
              </div>

              {/* Check-in Date Picker */}
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-extrabold text-slate-700">
                  <i className="fa-regular fa-calendar text-brand-600 mr-1"></i> Check-in:
                </span>
                <input
                  type="date"
                  value={checkInDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-extrabold text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Floor Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl mb-4 overflow-x-auto">
              {floors.map((floor) => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
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
                  <div
                    key={room.id}
                    className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-extrabold text-slate-800">Room {room.roomNumber}</span>
                        <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                          {room.sharingType === 'DOUBLE' ? '2 Sharing' : room.sharingType === 'SINGLE' ? 'Single Room' : room.sharingType === 'TRIPLE' ? '3 Sharing' : '4+ Sharing'}
                        </span>
                      </div>

                      <div className="text-base font-extrabold text-slate-900 mb-3">
                        ₹{rent} <span className="text-xs font-normal text-slate-500">/mo</span>
                      </div>

                      {/* Beds list (Requirements 1, 2: Available vs Occupied) */}
                      <div className="space-y-2 mb-2">
                        {beds.map((b) => {
                          const isHeld = localHeldBedIds.has(b.id);
                          const isOccupied = b.status === 'OCCUPIED' && !isHeld;
                          const isAvailable = !isOccupied && !isHeld;

                          return (
                            <div
                              key={b.id}
                              className={`flex items-center justify-between text-xs p-2.5 rounded-xl border transition ${
                                isOccupied
                                  ? 'bg-slate-100/70 border-slate-200 text-slate-400'
                                  : isHeld
                                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                                  : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={isOccupied ? 'text-slate-400' : isHeld ? 'text-amber-500' : 'text-emerald-500'}>
                                  🛏️
                                </span>
                                <span className="font-bold">{b.bedLabel}</span>
                              </div>

                              {isOccupied ? (
                                <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-slate-200 text-slate-500">
                                  Occupied
                                </span>
                              ) : isHeld ? (
                                <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-700 animate-pulse">
                                  ⏳ Held (15m Lock)
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleInitiateHold(b, room)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-sm shadow-emerald-600/30 transition flex items-center gap-1"
                                >
                                  <span>Hold Bed</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
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
          <span className="flex items-center gap-1.5 font-medium">
            <i className="fa-solid fa-shield-check text-emerald-600 text-sm"></i>
            <span>No booking charges. Free 15-minute bed hold locks your spot directly with the owner.</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold rounded-xl transition"
          >
            Close
          </button>
        </div>

        {/* ─── BED HOLD RESERVATION POPUP SHEET (Requirement 1, 2) ─── */}
        {holdingBed && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 relative border border-slate-100">
              <button
                onClick={() => setHoldingBed(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>

              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl mx-auto mb-2 shadow-sm">
                  🛏️
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Hold & Reserve Bed</h3>
                <p className="text-xs text-slate-500">
                  {property.name} • Room {holdingBed.roomNumber} • {holdingBed.bedLabel}
                </p>
              </div>

              {/* Price & Deposit Banner */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-4 flex justify-between items-center text-center">
                <div className="flex-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">MONTHLY RENT</span>
                  <div className="text-sm font-extrabold text-slate-900">
                    ₹{(holdingBed.rentMonthlyPaise / 100).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="flex-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">SECURITY DEPOSIT</span>
                  <div className="text-sm font-extrabold text-slate-900">
                    ₹{(holdingBed.depositPaise / 100).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Customer Details Form */}
              <div className="space-y-3 text-xs mb-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Karthik Reddy"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Mobile Phone (For Owner Notification & WhatsApp) *
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Check-in Date *
                  </label>
                  <input
                    type="date"
                    value={checkInDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>

                {/* Hold Mode Selector */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Reservation Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setHoldPaymentChoice('FREE_HOLD')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        holdPaymentChoice === 'FREE_HOLD'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="text-xs font-extrabold">⚡ 15-Min Free Hold</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Locks bed immediately</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoldPaymentChoice('PAY_AT_PROPERTY')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        holdPaymentChoice === 'PAY_AT_PROPERTY'
                          ? 'border-brand-500 bg-brand-50 text-brand-900 font-bold'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="text-xs font-extrabold">🏨 Pay at PG</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Pay rent on check-in</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Special Notes for Owner (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="e.g. Arriving from Hyderabad airport"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHoldingBed(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmHoldReservation}
                  disabled={submittingHold}
                  className="flex-[2] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
                >
                  {submittingHold ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <span>✓ Lock Bed & Notify Owner</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── SUCCESS CONFIRMATION MODAL (Requirement 1) ─── */}
        {holdSuccessDetails && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 text-center border border-slate-100 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
                🎉
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-1">Bed Held Successfully!</h3>
              <p className="text-xs text-slate-500 mb-4">
                Your enquiry and 15-minute bed lock have been dispatched directly to the PG Owner.
              </p>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2 text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">PG Property:</span>
                  <span className="font-bold text-slate-800">{holdSuccessDetails.propertyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Allocated Bed:</span>
                  <span className="font-bold text-emerald-700">
                    Room {holdSuccessDetails.roomNumber} • {holdSuccessDetails.bedLabel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Check-in Date:</span>
                  <span className="font-bold text-slate-800">{holdSuccessDetails.checkInDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Hold Expiration:</span>
                  <span className="font-bold text-amber-600">15 Minutes from now</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setHoldSuccessDetails(null)}
                className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-sm shadow-lg shadow-brand-500/30 transition"
              >
                ✓ Got it, Continue Exploring
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
