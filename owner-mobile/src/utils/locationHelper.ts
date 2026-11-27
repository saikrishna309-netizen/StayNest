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
 * Reverse-geocodes coordinates using OpenStreetMap Nominatim + BigDataCloud fallback
 * so Address Line, Locality, City, State, and 6-digit Pincode fill reliably on iOS/Android/Web.
 */
export const reverseGeocodeCoords = async (
  latitude: number,
  longitude: number
): Promise<GeocodedLocation> => {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const result: GeocodedLocation = { latitude, longitude, mapsUrl };

  // 1. Primary: BigDataCloud free client reverse geocoder (CORS-friendly, no rate limit)
  try {
    const bdcResp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (bdcResp.ok) {
      const bdc = await bdcResp.json();
      if (bdc?.locality) result.locality = String(bdc.locality).trim();
      if (bdc?.city || bdc?.locality) {
        result.cityName = String(bdc.city || bdc.locality).trim();
      }
      if (bdc?.principalSubdivision) {
        result.stateName = String(bdc.principalSubdivision).trim();
      }
      const bdcPin = String(bdc?.postcode || '').replace(/\D/g, '').slice(0, 6);
      if (bdcPin.length === 6) result.pincode = bdcPin;
      const bdcStreet = [bdc?.locality, bdc?.city].filter(Boolean).join(', ');
      if (bdcStreet) result.addressLine = bdcStreet;
    }
  } catch {
    // fallback to Nominatim below
  }

  // 2. Enrichment: Photon Komoot (OSM-based, mobile-friendly, no 403)
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
      if (streetParts.length > 0) {
        result.addressLine = streetParts.join(', ');
      }
      if (props.district || props.suburb || props.locality) {
        result.locality = String(props.district || props.suburb || props.locality).trim();
      }
      if (props.city || props.town || props.village || props.county) {
        result.cityName = String(props.city || props.town || props.village || props.county).trim();
      }
      if (props.state) {
        result.stateName = String(props.state).trim();
      }
      const rawPin = String(props.postcode || '').replace(/\D/g, '').slice(0, 6);
      if (rawPin.length === 6) {
        result.pincode = rawPin;
      }
      const disp = [result.addressLine, result.cityName, result.stateName, result.pincode]
        .filter(Boolean)
        .join(', ');
      if (disp) result.displayName = disp;
    }
  } catch {
    // BigDataCloud fields or coordinates are still returned
  }

  return result;
};

/**
 * Search places / streets / landmarks via Photon (OSM-based, no 403 on mobile).
 */
export const searchAddressPlaces = async (query: string): Promise<GeocodedLocation[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  try {
    const resp = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=5&lang=en`
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    return features.map((f: any) => {
      const coords = f?.geometry?.coordinates || [78.4867, 17.385];
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      const props = f?.properties || {};
      const streetParts = [
        props.housenumber,
        props.street || props.name,
        props.district || props.suburb || props.locality,
      ].filter(Boolean);
      const rawPin = String(props.postcode || '').replace(/\D/g, '').slice(0, 6);
      const city = props.city || props.town || props.village || props.county || '';
      const state = props.state || '';
      return {
        latitude: lat,
        longitude: lon,
        addressLine: streetParts.join(', ') || props.name || city,
        locality: props.district || props.suburb || props.locality || '',
        cityName: city,
        stateName: state,
        pincode: rawPin.length === 6 ? rawPin : undefined,
        displayName: [props.name, props.street, city, state, rawPin].filter(Boolean).join(', '),
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
      };
    });
  } catch {
    return [];
  }
};

/**
 * Requests runtime Android foreground location permission, fetches GPS coordinates
 * (high-accuracy first, automatic low-accuracy fallback), and reverse-geocodes
 * Full Address, Locality, City, State & 6-digit Pincode.
 */
export const fetchCurrentPropertyLocation = async (
  silent = false
): Promise<GeocodedLocation | null> => {
  if (Platform.OS === 'android') {
    try {
      const hasFine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const hasCoarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
      if (!hasFine && !hasCoarse) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        const fineOk = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        const coarseOk = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        if (!fineOk && !coarseOk) {
          if (!silent) {
            Alert.alert(
              'Location Permission Required',
              'StayNest needs location access to auto-fill your property address and GPS pin.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
              ]
            );
          }
          return null;
        }
      }
    } catch {
      // Proceed to geolocation attempt
    }
  }

  let coords: { latitude: number; longitude: number } | null = null;
  try {
    coords = await getPositionWithOptions({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });
  } catch (highErr: any) {
    try {
      coords = await getPositionWithOptions({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000,
      });
    } catch (lowErr: any) {
      if (!silent) {
        const code = lowErr?.code ?? highErr?.code;
        if (code === 1) {
          Alert.alert(
            'Location Permission Denied',
            'Please allow location access in App Settings to locate your property.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
            ]
          );
        } else {
          Alert.alert(
            'Turn On Device Location (GPS)',
            'Unable to fetch GPS signal. Please enable Location Services on your device or search your address on the map.',
            [
              { text: 'OK', style: 'cancel' },
              ...(Platform.OS !== 'web'
                ? [{ text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) }]
                : []),
            ]
          );
        }
      }
      return null;
    }
  }

  return reverseGeocodeCoords(coords.latitude, coords.longitude);
};
