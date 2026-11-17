import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { City, Locality } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AVAILABLE_AMENITIES = [
  { code: 'WIFI', name: 'High-speed Wi-Fi', icon: 'fa-wifi' },
  { code: 'AC', name: 'Air Conditioning', icon: 'fa-wind' },
  { code: 'FOOD', name: 'Meals Included', icon: 'fa-utensils' },
  { code: 'WASHING_MACHINE', name: 'Washing Machine', icon: 'fa-shirt' },
  { code: 'POWER_BACKUP', name: '24/7 Power Backup', icon: 'fa-bolt' },
  { code: 'HOUSEKEEPING', name: 'Daily Housekeeping', icon: 'fa-broom' },
  { code: 'CCTV', name: 'CCTV & Biometric Access', icon: 'fa-shield-halved' },
  { code: 'RO_WATER', name: 'RO Drinking Water', icon: 'fa-droplet' },
];

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);

  const [name, setName] = useState('');
  const [cityId, setCityId] = useState('');
  const [localityId, setLocalityId] = useState('');
  const [genderPolicy, setGenderPolicy] = useState('CO_ED');
  const [startingPriceRupees, setStartingPriceRupees] = useState(8500);
  const [foodIncluded, setFoodIncluded] = useState(true);
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode] = useState('560102');
  const [description, setDescription] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'WIFI',
    'FOOD',
    'POWER_BACKUP',
    'RO_WATER',
  ]);

  useEffect(() => {
    if (isOpen) {
      loadCities();
    }
  }, [isOpen]);

  const loadCities = async () => {
    try {
      const data = await propertyApi.getCities();
      setCities(data);
      if (data.length > 0 && !cityId) {
        setCityId(data[0].id);
        loadLocalities(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCityChange = (newCityId: string) => {
    setCityId(newCityId);
    setLocalityId('');
    loadLocalities(newCityId);
  };

  const loadLocalities = async (selectedCityId: string) => {
    try {
      const data = await propertyApi.getLocalities(selectedCityId);
      setLocalities(data);
      if (data.length > 0) {
        setLocalityId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const toggleAmenity = (code: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(code) ? prev.filter((a) => a !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !cityId || !localityId) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const created = await propertyApi.createProperty({
        name: name.trim(),
        propertyType: 'PG',
        genderPolicy,
        cityId,
        localityId,
        addressLine: addressLine.trim() || '#10, Main Road',
        pincode: pincode.trim() || '560102',
        startingPricePaise: Math.round(startingPriceRupees * 100),
        foodIncluded,
        description: description.trim() || `${name} offers premium co-living with modern amenities.`,
        amenities: selectedAmenities,
      });

      // Automatically submit for approval/publish
      try {
        await propertyApi.submitProperty(created.id);
      } catch {
        // ignore if auto-approved
      }

      showToast('New PG onboarded successfully! Now configure floors & rooms.');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to onboard PG', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-lg">
            <i className="fa-solid fa-hotel"></i>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Onboard New PG Property</h3>
            <p className="text-xs text-slate-500">List your property on StayNest</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* PG Name & Gender Policy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Property / PG Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. Sri Venkateswra Luxury PG"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Gender Policy *
              </label>
              <select
                value={genderPolicy}
                onChange={(e) => setGenderPolicy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer"
              >
                <option value="BOYS">Gents / Boys Only</option>
                <option value="GIRLS">Ladies / Girls Only</option>
                <option value="CO_ED">Co-Ed (All Welcome)</option>
              </select>
            </div>
          </div>

          {/* City & Locality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                City *
              </label>
              <select
                required
                value={cityId}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Locality *
              </label>
              <select
                required
                value={localityId}
                onChange={(e) => setLocalityId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer"
              >
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rent & Food Policy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Starting Rent (₹ / Month) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  required
                  min={1000}
                  value={startingPriceRupees}
                  onChange={(e) => setStartingPriceRupees(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Food Policy
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg p-2.5 hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={foodIncluded}
                  onChange={(e) => setFoodIncluded(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="font-bold text-slate-700">Food / 3 Meals Included</span>
              </label>
            </div>
          </div>

          {/* Address Line & Pincode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Address Line *
              </label>
              <input
                type="text"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="#42, 14th Main, Sector 2"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Pincode *
              </label>
              <input
                type="text"
                required
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="560102"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="Premium PG with modern interiors, 24x7 security, chef prepared meals..."
            />
          </div>

          {/* Amenities Selection */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
              Select Available Amenities
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AVAILABLE_AMENITIES.map((amenity) => {
                const isChecked = selectedAmenities.includes(amenity.code);
                return (
                  <button
                    key={amenity.code}
                    type="button"
                    onClick={() => toggleAmenity(amenity.code)}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
                      isChecked
                        ? 'bg-brand-50 border-brand-500 text-brand-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <i className={`fa-solid ${amenity.icon} text-xs`}></i>
                    <span className="truncate text-[11px]">{amenity.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              {loading && <i className="fa-solid fa-spinner fa-spin"></i>}
              <span>Save & Onboard PG</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
