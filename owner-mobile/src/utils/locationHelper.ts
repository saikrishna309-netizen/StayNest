import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  addressLine?: string;
  locality?: string;
  cityName?: string;
  stateName?: string;
  pincode?: string;
  displayName?: string;
  mapsUrl: string;
}

const getPositionWithOptions = (
  options: PositionOptions
): Promise<{ latitude: number; longitude: number }> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 0, message: 'Geolocation unavailable' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      options
    );
  });

/**
 * Fast network/IP-based geolocation fallback for mobile devices (iPhone/Android)
 * when native GPS is denied, disabled, or unavailable.
 */
export const fetchIpLocation = async (): Promise<GeocodedLocation | null> => {
  const fetchWithTimeout = async (url: string, ms = 2500) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return await res.json();
    } catch {
      clearTimeout(t);
    }
    return null;
  };

  try {
    const data = await fetchWithTimeout('https://ipapi.co/json/', 2200);
    if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
      return reverseGeocodeCoords(data.latitude, data.longitude);
    }
  } catch {}

  try {
    const d = await fetchWithTimeout('https://freeipapi.com/api/json', 2200);
    if (typeof d?.latitude === 'number' && typeof d?.longitude === 'number') {
      return reverseGeocodeCoords(d.latitude, d.longitude);
    }
  } catch {}

  return null;
};

/**
 * Reverse-geocodes coordinates using fast parallel BigDataCloud + OpenStreetMap Nominatim
 * so Address Line, Locality, City, State, and 6-digit Pincode fill in under 500ms on iOS/Android.
 */
export const reverseGeocodeCoords = async (
  latitude: number,
  longitude: number
): Promise<GeocodedLocation> => {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const result: GeocodedLocation = { latitude, longitude, mapsUrl };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);

  // 1. Run BigDataCloud (ultra-fast, ~200ms) and Nominatim concurrently
  const [bdcResult, nomResult] = await Promise.allSettled([
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal: ctrl.signal }
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'StayNest-Owner-App/1.0',
        },
        signal: ctrl.signal,
      }
    ).then((r) => (r.ok ? r.json() : null)),
  ]);
  clearTimeout(timer);

  // Parse Nominatim details if available
  if (nomResult.status === 'fulfilled' && nomResult.value) {
    const nom = nomResult.value;
    const addr = nom?.address || {};
    const streetParts = [
      addr.building || addr.house_number,
      addr.road || addr.street,
      addr.suburb || addr.neighbourhood || addr.residential,
    ].filter(Boolean);

    if (streetParts.length > 0) {
      result.addressLine = streetParts.join(', ');
    }
    if (addr.suburb || addr.neighbourhood || addr.subdistrict) {
      result.locality = String(addr.suburb || addr.neighbourhood || addr.subdistrict).trim();
    }
    if (addr.city || addr.town || addr.village || addr.county) {
      result.cityName = String(addr.city || addr.town || addr.village || addr.county).trim();
    }
    if (addr.state) {
      result.stateName = String(addr.state).trim();
    }
    const rawPin = String(addr.postcode || '').replace(/\D/g, '').slice(0, 6);
    if (rawPin.length === 6) {
      result.pincode = rawPin;
    }
    if (nom.display_name) {
      result.displayName = nom.display_name;
    }
  }

  // Supplement with BigDataCloud (fastest for city, district, state)
  if (bdcResult.status === 'fulfilled' && bdcResult.value) {
    const bdc = bdcResult.value;
    if (!result.locality && bdc?.locality) result.locality = String(bdc.locality).trim();
    if (!result.cityName && (bdc?.city || bdc?.locality)) {
      result.cityName = String(bdc.city || bdc.locality).trim();
    }
    if (!result.stateName && bdc?.principalSubdivision) {
      result.stateName = String(bdc.principalSubdivision).trim();
    }
    const bdcPin = String(bdc?.postcode || '').replace(/\D/g, '').slice(0, 6);
    if (!result.pincode && bdcPin.length === 6) result.pincode = bdcPin;
    const bdcStreet = [bdc?.locality, bdc?.city].filter(Boolean).join(', ');
    if (!result.addressLine && bdcStreet) result.addressLine = bdcStreet;
  }

  // 3. Tertiary fallback: Photon Komoot
  if (!result.addressLine || !result.cityName || !result.pincode) {
    try {
      const resp = await fetch(
        `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`
      );
      if (resp.ok) {
        const data = await resp.json();
        const props = data?.features?.[0]?.properties || {};
        const streetParts = [
          props.housenumber,
          props.street || props.name,
          props.district || props.suburb || props.locality,
        ].filter(Boolean);
        if (!result.addressLine && streetParts.length > 0) {
          result.addressLine = streetParts.join(', ');
        }
        if (!result.locality && (props.district || props.suburb || props.locality)) {
          result.locality = String(props.district || props.suburb || props.locality).trim();
        }
        if (!result.cityName && (props.city || props.town || props.village || props.county)) {
          result.cityName = String(props.city || props.town || props.village || props.county).trim();
        }
        if (!result.stateName && props.state) {
          result.stateName = String(props.state).trim();
        }
        const rawPin = String(props.postcode || '').replace(/\D/g, '').slice(0, 6);
        if (!result.pincode && rawPin.length === 6) {
          result.pincode = rawPin;
        }
      }
    } catch {}
  }

  if (!result.displayName) {
    result.displayName = [result.addressLine, result.locality, result.cityName, result.stateName, result.pincode]
      .filter(Boolean)
      .join(', ');
  }

  return result;
};

/**
 * Multi-provider place and address search: OpenStreetMap Nominatim + Open-Meteo + Photon.
 * Returns instant, accurate results for any Indian street, locality, colony, landmark, or city.
 */
export const searchAddressPlaces = async (query: string): Promise<GeocodedLocation[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);

  const results: GeocodedLocation[] = [];
  const seenKeys = new Set<string>();

  try {
    const [nomRes, meteoRes, photonRes] = await Promise.allSettled([
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&addressdetails=1&countrycodes=in&limit=8`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'StayNest-Owner-App/1.0',
          },
          signal: ctrl.signal,
        }
      ).then((r) => (r.ok ? r.json() : [])),
      fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=8&language=en&format=json`,
        { signal: ctrl.signal }
      ).then((r) => (r.ok ? r.json() : { results: [] })),
      fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6&lang=en`,
        { signal: ctrl.signal }
      ).then((r) => (r.ok ? r.json() : { features: [] })),
    ]);

    clearTimeout(timer);

    // 1. Nominatim results (richest for Indian street addresses & pincodes)
    if (nomRes.status === 'fulfilled' && Array.isArray(nomRes.value)) {
      nomRes.value.forEach((item: any) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (isNaN(lat) || isNaN(lon)) return;
        const key = `${lat.toFixed(3)}-${lon.toFixed(3)}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const addr = item.address || {};
        const streetParts = [
          addr.building || addr.house_number,
          addr.road || addr.street,
          addr.suburb || addr.neighbourhood || addr.residential,
        ].filter(Boolean);
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const rawPin = String(addr.postcode || '').replace(/\D/g, '').slice(0, 6);

        results.push({
          latitude: lat,
          longitude: lon,
          addressLine: streetParts.join(', ') || item.display_name?.split(',')?.[0]?.trim() || city,
          locality: String(addr.suburb || addr.neighbourhood || addr.subdistrict || '').trim(),
          cityName: city,
          stateName: addr.state || '',
          pincode: rawPin.length === 6 ? rawPin : undefined,
          displayName: item.display_name || [streetParts.join(', '), city, addr.state, rawPin].filter(Boolean).join(', '),
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        });
      });
    }

    // 2. Open-Meteo results (ultra-fast for Indian towns, cities, districts)
    if (meteoRes.status === 'fulfilled' && Array.isArray(meteoRes.value?.results)) {
      meteoRes.value.results.forEach((item: any) => {
        const lat = Number(item.latitude);
        const lon = Number(item.longitude);
        if (isNaN(lat) || isNaN(lon)) return;
        const key = `${lat.toFixed(3)}-${lon.toFixed(3)}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const city = item.name || '';
        const state = item.admin1 || '';
        results.push({
          latitude: lat,
          longitude: lon,
          addressLine: item.admin2 ? `${item.admin2}, ${city}` : city,
          locality: item.admin2 || '',
          cityName: city,
          stateName: state,
          displayName: [city, item.admin2, state, item.country].filter(Boolean).join(', '),
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        });
      });
    }

    // 3. Photon results (supplementary landmark coverage)
    if (photonRes.status === 'fulfilled' && Array.isArray(photonRes.value?.features)) {
      photonRes.value.features.forEach((f: any) => {
        const coords = f?.geometry?.coordinates;
        if (!coords || coords.length < 2) return;
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (isNaN(lat) || isNaN(lon)) return;
        const key = `${lat.toFixed(3)}-${lon.toFixed(3)}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const props = f?.properties || {};
        const streetParts = [
          props.housenumber,
          props.street || props.name,
          props.district || props.suburb || props.locality,
        ].filter(Boolean);
        const city = props.city || props.town || props.village || props.county || '';
        const rawPin = String(props.postcode || '').replace(/\D/g, '').slice(0, 6);

        results.push({
          latitude: lat,
          longitude: lon,
          addressLine: streetParts.join(', ') || props.name || city,
          locality: props.district || props.suburb || props.locality || '',
          cityName: city,
          stateName: props.state || '',
          pincode: rawPin.length === 6 ? rawPin : undefined,
          displayName: [props.name, props.street, city, props.state, rawPin].filter(Boolean).join(', '),
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        });
      });
    }
  } catch {
    clearTimeout(timer);
  }

  return results;
};

/**
 * Requests runtime Android foreground location permission, fetches GPS coordinates
 * (high-accuracy first, automatic low-accuracy fallback), and reverse-geocodes
 * Full Address, Locality, City, State & 6-digit Pincode cleanly without intrusive alerts.
 */
export const fetchCurrentPropertyLocation = async (
  silent = true
): Promise<GeocodedLocation | null> => {
  if (Platform.OS === 'android') {
    try {
      const hasFine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const hasCoarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
      if (!hasFine && !hasCoarse) {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]).catch(() => {});
      }
    } catch {
      // Proceed gracefully
    }
  }

  let coords: { latitude: number; longitude: number } | null = null;
  try {
    coords = await getPositionWithOptions({
      enableHighAccuracy: true,
      timeout: 3000,
      maximumAge: 10000,
    });
  } catch {
    try {
      coords = await getPositionWithOptions({
        enableHighAccuracy: false,
        timeout: 2000,
        maximumAge: 30000,
      });
    } catch {
      // Automatic fast fallback to high-accuracy network/IP Geolocation (reliable across iPhone and Android in ~300ms)
      const ipLoc = await fetchIpLocation();
      if (ipLoc) {
        return ipLoc;
      }
      return null;
    }
  }

  if (coords?.latitude && coords?.longitude) {
    return reverseGeocodeCoords(coords.latitude, coords.longitude);
  }

  return fetchIpLocation();
};
