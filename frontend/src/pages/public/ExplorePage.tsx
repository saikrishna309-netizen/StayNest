import React, { useState, useEffect } from 'react';
import { propertyApi } from '../../api/property.api';
import { City, Locality, PropertySummary } from '../../types';
import { useToast } from '../../context/ToastContext';

interface ExplorePageProps {
  onSelectProperty: (propertyId: string) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ onSelectProperty }) => {
  const { showToast } = useToast();

  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);

  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedLocalityId, setSelectedLocalityId] = useState('');
  const [genderPolicy, setGenderPolicy] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [foodIncluded, setFoodIncluded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load cities on mount
  useEffect(() => {
    loadCities();
  }, []);

  // Automatically fetch properties whenever ANY filter changes
  useEffect(() => {
    searchProperties();
  }, [selectedCityId, selectedLocalityId, genderPolicy, budgetRange, foodIncluded]);

  const loadCities = async () => {
    try {
      const data = await propertyApi.getCities();
      setCities(data);
    } catch (err: any) {
      console.error('Failed to load cities:', err);
    }
  };

  const handleCityChange = async (cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedLocalityId('');
    if (cityId) {
      try {
        const data = await propertyApi.getLocalities(cityId);
        setLocalities(data);
      } catch (err: any) {
        console.error('Failed to load localities:', err);
      }
    } else {
      setLocalities([]);
    }
  };

  const handleResetFilters = () => {
    setSelectedCityId('');
    setSelectedLocalityId('');
    setGenderPolicy('');
    setBudgetRange('');
    setFoodIncluded(false);
    setLocalities([]);
  };

  const searchProperties = async () => {
    setLoading(true);
    try {
      let minRent: number | undefined = undefined;
      let maxRent: number | undefined = undefined;

      if (budgetRange === 'under8k') {
        maxRent = 800000;
      } else if (budgetRange === '8k-12k') {
        minRent = 800000;
        maxRent = 1200000;
      } else if (budgetRange === '12k-18k') {
        minRent = 1200000;
        maxRent = 1800000;
      } else if (budgetRange === '18k+') {
        minRent = 1800000;
      }

      const res = await propertyApi.searchProperties({
        cityId: selectedCityId || undefined,
        localityId: selectedLocalityId || undefined,
        genderPolicy: genderPolicy || undefined,
        minRent,
        maxRent,
        foodIncluded: foodIncluded ? true : undefined,
        size: 50,
      });
      setProperties(res.content || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to search properties', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow">
      {/* Hero Search Banner */}
      <div className="bg-gradient-to-b from-brand-950 via-indigo-900 to-slate-900 text-white pt-12 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-200 border border-brand-400/30 mb-4 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            India's Smart PG & Co-Living Ecosystem
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
            Find a PG. Manage a PG. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-brand-200 to-emerald-300">
              Pay with clarity.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-indigo-200/90 max-w-2xl mx-auto mb-8 font-normal">
            Explore verified hostels across Bengaluru, Hyderabad, Pune, and Delhi NCR with floor-wise room visibility and instant 15-minute bed locks.
          </p>

          {/* Interactive Multi-Filter Bar (Auto-filters instantly on click) */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xl text-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-left">
            {/* 1. City Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <i className="fa-solid fa-city text-brand-600"></i> City
              </label>
              <select
                value={selectedCityId}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer"
              >
                <option value="">All Supported Cities</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Locality Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <i className="fa-solid fa-location-dot text-brand-600"></i> Locality
              </label>
              <select
                value={selectedLocalityId}
                onChange={(e) => setSelectedLocalityId(e.target.value)}
                disabled={!selectedCityId || localities.length === 0}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50 cursor-pointer"
              >
                <option value="">{selectedCityId ? 'All Localities' : 'Select City First'}</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Gender Policy Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <i className="fa-solid fa-venus-mars text-brand-600"></i> Gender Policy
              </label>
              <select
                value={genderPolicy}
                onChange={(e) => setGenderPolicy(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer"
              >
                <option value="">Any Policy (All PGs)</option>
                <option value="BOYS">Gents / Boys Only</option>
                <option value="GIRLS">Ladies / Girls Only</option>
                <option value="CO_ED">Co-Ed Living</option>
              </select>
            </div>

            {/* 4. Budget Range Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <i className="fa-solid fa-indian-rupee-sign text-brand-600"></i> Monthly Budget
              </label>
              <select
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer"
              >
                <option value="">Any Budget</option>
                <option value="under8k">Under ₹8,000 / mo</option>
                <option value="8k-12k">₹8,000 – ₹12,000 / mo</option>
                <option value="12k-18k">₹12,000 – ₹18,000 / mo</option>
                <option value="18k+">Above ₹18,000 / mo</option>
              </select>
            </div>

            {/* 5. Food & Reset Controls */}
            <div className="flex flex-col justify-end gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 border border-slate-200 bg-white">
                <input
                  type="checkbox"
                  checked={foodIncluded}
                  onChange={(e) => setFoodIncluded(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <i className="fa-solid fa-utensils text-brand-600 text-[10px]"></i> Food Included Only
                </span>
              </label>

              {(selectedCityId || selectedLocalityId || genderPolicy || budgetRange || foodIncluded) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  <i className="fa-solid fa-xmark text-[10px]"></i> Reset Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Property Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 mb-20 relative z-20">
        <div className="flex items-center justify-between mb-6 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Available PGs & Hostels</h2>
            <p className="text-xs text-slate-500">{properties.length} verified accommodations found</p>
          </div>
          <button
            onClick={searchProperties}
            className="text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition flex items-center gap-1.5"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>

        {properties.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
            <i className="fa-solid fa-hotel text-4xl mb-3 text-slate-300"></i>
            <p className="text-base font-bold text-slate-700">No properties found matching criteria</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting your filters or deploy a new PG via the Owner Portal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((p) => {
              const startingRent = (p.startingPricePaise / 100).toLocaleString('en-IN');
              const coverPhoto = p.primaryPhotoUrl || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=700&q=80';

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-48 bg-slate-100 overflow-hidden">
                      <img src={coverPhoto} alt={p.name} className="w-full h-full object-cover" />
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-brand-700 border border-slate-200">
                          {p.genderPolicy === 'BOYS' ? 'Gents PG' : p.genderPolicy === 'GIRLS' ? 'Ladies PG' : 'Co-Ed Living'}
                        </span>
                      </div>
                      <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-lg">
                        ₹{startingRent} <span className="font-normal text-[10px] text-slate-300">/mo</span>
                      </div>
                    </div>

                    <div className="p-5">
                      <h3
                        onClick={() => onSelectProperty(p.id)}
                        className="text-base font-extrabold text-slate-900 hover:text-brand-600 transition cursor-pointer"
                      >
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <i className="fa-solid fa-location-dot text-slate-400"></i>
                        {p.localityName ? `${p.localityName}, ` : ''}{p.cityName}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-semibold">
                        <i className="fa-solid fa-utensils text-emerald-600 mr-1"></i>
                        {p.foodIncluded ? 'Food Included' : 'No Food'}
                      </span>
                      <button
                        onClick={() => onSelectProperty(p.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white font-bold text-xs transition"
                      >
                        View Rooms & Beds
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

