import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { PropertyDetail, PropertySummary } from '../../types';
import { useToast } from '../../context/ToastContext';

interface EditPropertyModalProps {
  property: PropertySummary | null;
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

export const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  property,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [name, setName] = useState('');
  const [genderPolicy, setGenderPolicy] = useState('CO_ED');
  const [startingPriceRupees, setStartingPriceRupees] = useState(8500);
  const [foodIncluded, setFoodIncluded] = useState(true);
  const [addressLine, setAddressLine] = useState('');
  const [pincode, setPincode] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState(30);
  const [depositMonths, setDepositMonths] = useState(1);
  const [rules, setRules] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && property) {
      loadDetails();
    }
  }, [isOpen, property]);

  const loadDetails = async () => {
    if (!property) return;
    setFetching(true);
    try {
      const detail = await propertyApi.getPropertyDetail(property.id);
      setName(detail.name || '');
      setGenderPolicy(detail.genderPolicy || 'CO_ED');
      setStartingPriceRupees(detail.startingPricePaise ? detail.startingPricePaise / 100 : 8500);
      setFoodIncluded(detail.foodIncluded ?? true);
      setAddressLine(detail.addressLine || '');
      setPincode(detail.pincode || '');
      setNoticePeriodDays(detail.noticePeriodDays || 30);
      setDepositMonths(detail.depositMonths || 1);
      setRules(detail.rules || '');
      setDescription(detail.description || '');
      setSelectedAmenities(detail.amenities || []);
    } catch {
      // Fallback to summary
      setName(property.name);
      setGenderPolicy(property.genderPolicy);
      setStartingPriceRupees(property.startingPricePaise / 100);
      setFoodIncluded(property.foodIncluded);
      setAddressLine(property.addressLine || '');
      setSelectedAmenities(property.amenities || []);
    } finally {
      setFetching(false);
    }
  };

  const toggleAmenity = (code: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(code) ? prev.filter((a) => a !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;

    setLoading(true);
    try {
      await propertyApi.updateProperty(property.id, {
        name: name.trim(),
        genderPolicy,
        startingPricePaise: Math.round(startingPriceRupees * 100),
        foodIncluded,
        addressLine: addressLine.trim(),
        pincode: pincode.trim(),
        description: description.trim(),
        rules: rules.trim(),
        amenities: selectedAmenities,
      });

      showToast('Property details updated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to update property', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !property) return null;

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
            <i className="fa-solid fa-pen-to-square"></i>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Edit Property Details</h3>
            <p className="text-xs text-slate-500">Update rates, amenities, policy, and address</p>
          </div>
        </div>

        {fetching ? (
          <div className="p-12 text-center text-slate-400">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-brand-600 mb-2"></i>
            <p className="text-xs font-bold">Loading property details...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Name & Gender Policy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                  PG Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="e.g. StayNest Serene Living PG"
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

            {/* Starting Price & Food Included */}
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
                  <span className="font-bold text-slate-700">Food / Meals Included in Rent</span>
                </label>
              </div>
            </div>

            {/* Address & Pincode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                  Address Line
                </label>
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="#42, 14th Main, Sector 2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="560102"
                />
              </div>
            </div>

            {/* Description & Rules */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Description / Highlights
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="Comfortable PG accommodation near IT tech parks..."
              />
            </div>

            {/* Amenities Selection */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                Amenities & Services
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

            {/* Buttons */}
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
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
