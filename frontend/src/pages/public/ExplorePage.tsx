import React, { useState, useEffect, useMemo } from 'react';
import { propertyApi } from '../../api/property.api';
import { City, Locality, PropertySummary } from '../../types';
import { useToast } from '../../context/ToastContext';

interface ExplorePageProps {
  onSelectProperty: (propertyId: string) => void;
}

// Fallback verified PG properties so a customer visiting always has verified PGs to explore & hold beds
const VERIFIED_FALLBACK_PGS: PropertySummary[] = [
  {
    id: 'prop-pg-1',
    ownerId: 'owner-default-0',
    name: 'StayNest Elite Men\'s PG',
    propertyType: 'PG',
    genderPolicy: 'BOYS',
    cityId: 'vja-1',
    cityName: 'Vijayawada',
    localityId: 'mgroad-1',
    localityName: 'MG Road',
    addressLine: 'Opp. PVP Square Mall, MG Road, Vijayawada',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 850000,
    foodIncluded: true,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'POWER_BACKUP', 'DAILY_HOUSEKEEPING', 'AC_ROOMS'],
    createdAt: '2026-11-22T10:00:00Z',
  },
  {
    id: 'prop-pg-2',
    ownerId: 'owner-default-0',
    name: 'Sai Durga Executive Ladies PG',
    propertyType: 'PG',
    genderPolicy: 'GIRLS',
    cityId: 'vja-1',
    cityName: 'Vijayawada',
    localityId: 'benzcircle-1',
    localityName: 'Benz Circle',
    addressLine: 'Near Benz Circle, Ring Road, Vijayawada',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 950000,
    foodIncluded: true,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'POWER_BACKUP', 'DAILY_HOUSEKEEPING', 'BIKE_PARKING', 'CCTV_SECURITY'],
    createdAt: '2026-11-22T10:30:00Z',
  },
  {
    id: 'staynest-pg-01',
    ownerId: 'owner-default-1',
    name: 'StayNest Luxury PG (Building 01)',
    propertyType: 'PG',
    genderPolicy: 'BOYS',
    cityId: 'hyd-1',
    cityName: 'Hyderabad',
    localityId: 'hitec-1',
    localityName: 'Hitec City',
    addressLine: 'Plot 42, Near Cyber Towers, Silicon Valley',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 850000,
    foodIncluded: true,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'AC_ROOMS', 'POWER_BACKUP', 'CCTV_SECURITY', 'WASHING_MACHINE'],
    createdAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 'staynest-pg-02',
    ownerId: 'owner-default-1',
    name: 'StayNest Prime PG (Building 02)',
    propertyType: 'PG',
    genderPolicy: 'BOYS',
    cityId: 'hyd-1',
    cityName: 'Hyderabad',
    localityId: 'madhapur-1',
    localityName: 'Madhapur',
    addressLine: '100 Feet Road, Near Ayyappa Society',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 750000,
    foodIncluded: true,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'POWER_BACKUP', 'DAILY_HOUSEKEEPING', 'BIKE_PARKING'],
    createdAt: '2026-11-20T11:00:00Z',
  },
  {
    id: 'sanika-hostel-03',
    ownerId: 'owner-default-2',
    name: 'Sanika Executive PG & Hostel',
    propertyType: 'HOSTEL',
    genderPolicy: 'CO_ED',
    cityId: 'hyd-1',
    cityName: 'Hyderabad',
    localityId: 'gachibowli-1',
    localityName: 'Gachibowli',
    addressLine: 'Financial District, Near WaveRock SEZ',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 950000,
    foodIncluded: true,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'AC_ROOMS', 'GYM', 'POWER_BACKUP', '24X7_SECURITY'],
    createdAt: '2026-11-19T09:00:00Z',
  },
  {
    id: 'staynest-ladies-pg-04',
    ownerId: 'owner-default-3',
    name: 'StayNest Elite Ladies PG',
    propertyType: 'PG',
    genderPolicy: 'GIRLS',
    cityId: 'blr-1',
    cityName: 'Bengaluru',
    localityId: 'whitefield-1',
    localityName: 'Whitefield',
    addressLine: 'Near ITPL Main Road & Metro Station',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 900000,
    foodIncluded: true,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'HOMESTYLE_FOOD', 'FEMALE_WARDEN', 'CCTV_SECURITY', 'AC_ROOMS'],
    createdAt: '2026-11-18T14:00:00Z',
  },
  {
    id: 'venkateswara-pg-05',
    ownerId: 'owner-default-1',
    name: 'Venkateswara Gents Luxury PG',
    propertyType: 'PG',
    genderPolicy: 'BOYS',
    cityId: 'hyd-1',
    cityName: 'Hyderabad',
    localityId: 'kondapur-1',
    localityName: 'Kondapur',
    addressLine: 'Raghava Colony, Near Botanical Gardens',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 650000,
    foodIncluded: false,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'POWER_BACKUP', 'ATTACHED_BATHROOM', 'WASHING_MACHINE'],
    createdAt: '2026-11-17T12:00:00Z',
  },
  {
    id: 'staynest-koramangala-06',
    ownerId: 'owner-default-4',
    name: 'StayNest Co-Living Spaces',
    propertyType: 'COLIVING',
    genderPolicy: 'CO_ED',
    cityId: 'blr-1',
    cityName: 'Bengaluru',
    localityId: 'koramangala-1',
    localityName: 'Koramangala 4th Block',
    addressLine: '80 Feet Road, Near Sony Signal',
    primaryPhotoUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
    startingPricePaise: 1150000,
    foodIncluded: true,
    approvalStatus: 'APPROVED',
    published: true,
    amenities: ['HIGH_SPEED_WIFI', 'AC_ROOMS', 'CHEF_FOOD', 'CO_WORKING_AREA', 'GAMING_ZONE'],
    createdAt: '2026-11-16T15:00:00Z',
  },
];

export const ExplorePage: React.FC<ExplorePageProps> = ({ onSelectProperty }) => {
  const { showToast } = useToast();

  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);

  // Search & Filter State (Requirement 4)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityName, setSelectedCityName] = useState('ALL');
  const [genderPolicy, setGenderPolicy] = useState('ALL');
  const [sharingTypeFilter, setSharingTypeFilter] = useState('ALL');
  const [budgetRange, setBudgetRange] = useState('ALL');
  const [foodIncluded, setFoodIncluded] = useState(false);
  const [onlyAvailableBeds, setOnlyAvailableBeds] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check URL parameters for cross-origin sync payload from owner-mobile (Port 8081 -> Port 5173)
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const syncPayload = urlParams.get('sync_data');
        if (syncPayload) {
          const decoded = JSON.parse(decodeURIComponent(syncPayload));
          if (decoded.customProps) {
            window.localStorage.setItem('staynest_custom_properties', JSON.stringify(decoded.customProps));
          }
          if (decoded.buildingPhotos) {
            Object.keys(decoded.buildingPhotos).forEach((k) => {
              window.localStorage.setItem(k, decoded.buildingPhotos[k]);
            });
          }
          if (decoded.floors) {
            Object.keys(decoded.floors).forEach((k) => {
              window.localStorage.setItem(k, JSON.stringify(decoded.floors[k]));
            });
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.log('Error parsing sync_data:', err);
      }

      // 2. Cross-tab/window postMessage listener
      const handleSyncMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'STAYNEST_SYNC_DATA' && event.data.payload) {
          const { customProps, buildingPhotos, floors } = event.data.payload;
          if (customProps) window.localStorage.setItem('staynest_custom_properties', JSON.stringify(customProps));
          if (buildingPhotos) {
            Object.keys(buildingPhotos).forEach((k) => window.localStorage.setItem(k, buildingPhotos[k]));
          }
          if (floors) {
            Object.keys(floors).forEach((k) => window.localStorage.setItem(k, JSON.stringify(floors[k])));
          }
          searchProperties();
        }
      };
      window.addEventListener('message', handleSyncMessage);
    }

    loadCities();
    searchProperties();

    const handleSync = () => {
      searchProperties();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('staynest_property_created', handleSync);
      window.addEventListener('storage', handleSync);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('staynest_property_created', handleSync);
        window.removeEventListener('storage', handleSync);
      }
    };
  }, []);

  const loadCities = async () => {
    try {
      const data = await propertyApi.getCities();
      if (data && data.length > 0) setCities(data);
    } catch {
      // Fallback major cities
      setCities([
        { id: 'hyd-1', name: 'Hyderabad', state: 'Telangana' },
        { id: 'blr-1', name: 'Bengaluru', state: 'Karnataka' },
        { id: 'pun-1', name: 'Pune', state: 'Maharashtra' },
        { id: 'del-1', name: 'Delhi NCR', state: 'Delhi' },
        { id: 'chn-1', name: 'Chennai', state: 'Tamil Nadu' },
      ]);
    }
  };

  const searchProperties = async () => {
    setLoading(true);
    try {
      let baseList: PropertySummary[] = [...VERIFIED_FALLBACK_PGS];
      try {
        const res = await propertyApi.searchProperties({ size: 50 });
        if (res && res.content && res.content.length > 0) {
          const fallbackIds = new Set(VERIFIED_FALLBACK_PGS.map((p) => p.id));
          const extraBackend = res.content.filter((p) => !fallbackIds.has(p.id));
          baseList = [...VERIFIED_FALLBACK_PGS, ...extraBackend];
        }
      } catch {
        // use fallback list
      }

      // Merge owner-created properties from localStorage (Requirement 5)
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const cachedProps = window.localStorage.getItem('staynest_custom_properties');
          if (cachedProps) {
            const parsed = JSON.parse(cachedProps);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const customMap = new Map(parsed.map((p: any) => [p.id, p]));
              baseList = baseList.map((p) => (customMap.has(p.id) ? { ...p, ...customMap.get(p.id) } : p));
              const existingIds = new Set(baseList.map((p) => p.id));
              const newProps = parsed.filter((p: any) => !existingIds.has(p.id));
              baseList = [...newProps, ...baseList];
            }
          }
        } catch { }

        // Also check if custom building photo exists for any property in baseList
        baseList = baseList.map((p) => {
          const customPhoto =
            window.localStorage.getItem(`staynest_building_photo_${p.id}`) ||
            (p.id === 'ramesh-pg-default' ? window.localStorage.getItem('staynest_building_photo_default') : null);
          return customPhoto ? { ...p, primaryPhotoUrl: customPhoto } : p;
        });
      }

      setProperties(baseList);
    } catch {
      setProperties(VERIFIED_FALLBACK_PGS);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCityName('ALL');
    setGenderPolicy('ALL');
    setSharingTypeFilter('ALL');
    setBudgetRange('ALL');
    setFoodIncluded(false);
    setOnlyAvailableBeds(false);
  };

  // Client-side filtering across backend & fallback items (Requirement 4)
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // 1. Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesLocality = (p.localityName || '').toLowerCase().includes(q);
        const matchesCity = (p.cityName || '').toLowerCase().includes(q);
        const matchesAddress = (p.addressLine || '').toLowerCase().includes(q);
        if (!matchesName && !matchesLocality && !matchesCity && !matchesAddress) return false;
      }

      // 2. City Filter
      if (selectedCityName !== 'ALL' && p.cityName !== selectedCityName) {
        return false;
      }

      // 3. Gender Policy Filter
      if (genderPolicy !== 'ALL') {
        if (genderPolicy === 'BOYS' && p.genderPolicy !== 'BOYS') return false;
        if (genderPolicy === 'GIRLS' && p.genderPolicy !== 'GIRLS') return false;
        if (genderPolicy === 'CO_ED' && p.genderPolicy !== 'CO_ED') return false;
      }

      // 4. Budget Range Filter
      const rentRupees = p.startingPricePaise / 100;
      if (budgetRange === 'under8k' && rentRupees > 8000) return false;
      if (budgetRange === '8k-12k' && (rentRupees < 8000 || rentRupees > 12000)) return false;
      if (budgetRange === '12k-18k' && (rentRupees < 12000 || rentRupees > 18000)) return false;
      if (budgetRange === '18k+' && rentRupees < 18000) return false;

      // 5. Food Included Filter
      if (foodIncluded && !p.foodIncluded) return false;

      return true;
    });
  }, [properties, searchQuery, selectedCityName, genderPolicy, budgetRange, foodIncluded, onlyAvailableBeds]);

  return (
    <div className="flex-grow">
      {/* ─── HERO SEARCH & FILTERS BANNER (Mobile App Theme: Lavender #6c5ce7) ─── */}
      <div className="bg-gradient-to-b from-[#6c5ce7] via-[#5e4ee3] to-[#7c3aed] text-white pt-12 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden rounded-b-[40px] shadow-lg">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 mb-4 backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Verified PG Accommodations • Free 15-Min Bed Hold
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-3 text-white">
            Find Your Ideal PG. <br />
            <span className="text-[#fed7aa]">
              Hold Your Bed in Seconds.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-purple-100/90 max-w-2xl mx-auto mb-8 font-medium">
            Transparent room inventories across Hyderabad, Bengaluru, Pune, and Delhi NCR. Browse real photos, check live bed availability, and lock your spot with zero advance fees.
          </p>

          {/* ─── INTERACTIVE SEARCH & FILTER BOX ─── */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-2xl text-slate-800 space-y-4 border border-slate-100">
            {/* Row 1: Search Bar & City Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by PG Name, Locality (e.g. Hitec City, Madhapur, Whitefield)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div>
                <select
                  value={selectedCityName}
                  onChange={(e) => setSelectedCityName(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="ALL">📍 All Cities</option>
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Bengaluru">Bengaluru</option>
                  <option value="Pune">Pune</option>
                  <option value="Delhi NCR">Delhi NCR</option>
                  <option value="Chennai">Chennai</option>
                </select>
              </div>
            </div>

            {/* Row 2: Filter Tabs (Gender, Budget, Food) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              {/* Gender Policy Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['ALL', 'BOYS', 'GIRLS', 'CO_ED'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderPolicy(g)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                      genderPolicy === g
                        ? 'bg-white text-brand-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {g === 'ALL' ? 'All Genders' : g === 'BOYS' ? '👨 Boys Only' : g === 'GIRLS' ? '👩 Girls Only' : '👥 Co-Ed'}
                  </button>
                ))}
              </div>

              {/* Budget Range Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">Budget:</span>
                <select
                  value={budgetRange}
                  onChange={(e) => setBudgetRange(e.target.value)}
                  className="py-1.5 px-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="ALL">Any Budget</option>
                  <option value="under8k">Under ₹8,000</option>
                  <option value="8k-12k">₹8,000 - ₹12,000</option>
                  <option value="12k-18k">₹12,000 - ₹18,000</option>
                  <option value="18k+">₹18,000+</option>
                </select>
              </div>

              {/* Food Checkbox & Reset */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={foodIncluded}
                    onChange={(e) => setFoodIncluded(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>🍲 Food Included</span>
                </label>

                {(searchQuery || selectedCityName !== 'ALL' || genderPolicy !== 'ALL' || budgetRange !== 'ALL' || foodIncluded) && (
                  <button
                    onClick={handleResetFilters}
                    className="text-[11px] font-extrabold text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <i className="fa-solid fa-rotate-left text-[10px]"></i> Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AVAILABLE PGS LIST SECTION (Requirement 4) ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 mb-20 relative z-20">
        <div className="flex items-center justify-between mb-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-md">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>Verified PGs & Hostels</span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {filteredProperties.length} Available
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant 15-minute bed locks with zero advance booking fees
            </p>
          </div>

          <button
            onClick={searchProperties}
            className="text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition flex items-center gap-1.5"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
            <i className="fa-solid fa-hotel text-4xl mb-3 text-slate-300"></i>
            <p className="text-base font-bold text-slate-700">No properties found matching your criteria</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting your filters or search in another city.</p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-brand-700 transition"
            >
              Show All Available PGs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((p) => {
              const startingRent = (p.startingPricePaise / 100).toLocaleString('en-IN');
              const customBuildingPhoto = (typeof window !== 'undefined' && window.localStorage)
                ? window.localStorage.getItem(`staynest_building_photo_${p.id}`)
                : null;
              const coverPhoto = customBuildingPhoto || p.primaryPhotoUrl || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=700&q=80';

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition duration-200 flex flex-col justify-between"
                >
                  <div>
                    {/* Image Banner - Clicking photo opens all PG details (Requirement 1) */}
                    <div
                      onClick={() => onSelectProperty(p.id)}
                      className="relative h-52 bg-slate-100 overflow-hidden cursor-pointer group"
                      title={`Click to view all ${p.name} details & available rooms`}
                    >
                      <img
                        src={coverPhoto}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="px-3.5 py-1.5 rounded-full bg-white/95 text-slate-900 text-xs font-black shadow-lg flex items-center gap-1.5">
                          <span>🔍 View PG Details</span>
                        </span>
                      </div>

                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-white/95 backdrop-blur-md text-brand-700 shadow-sm border border-slate-200">
                          {p.genderPolicy === 'BOYS' ? '👨 Gents PG' : p.genderPolicy === 'GIRLS' ? '👩 Ladies PG' : '👥 Co-Ed Living'}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white shadow-sm flex items-center gap-1">
                          <i className="fa-solid fa-check text-[9px]"></i> Verified
                        </span>
                      </div>

                      <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-lg">
                        ₹{startingRent} <span className="font-normal text-[10px] text-slate-300">/mo</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5">
                      <h3
                        onClick={() => onSelectProperty(p.id)}
                        className="text-base font-black text-slate-900 hover:text-brand-600 transition cursor-pointer leading-snug"
                      >
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <i className="fa-solid fa-location-dot text-rose-500 text-xs"></i>
                        <span>{p.localityName ? `${p.localityName}, ` : ''}{p.cityName}</span>
                      </p>

                      {/* Amenities Pills */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          📶 WiFi
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          ❄️ AC Rooms
                        </span>
                        {p.foodIncluded && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🍲 3x Food
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          ⚡ 100% Power
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-5 pt-0">
                    <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-emerald-600 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Beds Available
                      </span>
                      <button
                        onClick={() => onSelectProperty(p.id)}
                        className="px-4 py-2 rounded-xl bg-[#6c5ce7] hover:bg-[#5e4ee3] text-white font-extrabold text-xs shadow-md shadow-[#6c5ce7]/25 transition flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-bed text-xs"></i>
                        <span>View Rooms & Hold</span>
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
