import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  addressLine?: string;
  cityName?: string;
  stateName?: string;
  pincode?: string;
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
 * Requests runtime Android foreground location permission, fetches GPS coordinates
 * (high-accuracy first, automatic low-accuracy fallback), and reverse-geocodes
 * Full Address, City, State & 6-digit Pincode.
 */
export const fetchCurrentPropertyLocation = async (): Promise<GeocodedLocation | null> => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);
      const fineOk = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      const coarseOk = granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      if (!fineOk && !coarseOk) {
        Alert.alert(
          'Location Permission Required',
          'StayNest needs location access to auto-fill your property address and GPS pin.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
          ]
        );
        return null;
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
    // Retry with low-accuracy / network location fallback
    try {
      coords = await getPositionWithOptions({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000,
      });
    } catch (lowErr: any) {
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
          'Unable to fetch GPS signal. Please enable Location Services on your device or enter the address manually.',
          [
            { text: 'OK', style: 'cancel' },
            ...(Platform.OS !== 'web'
              ? [{ text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) }]
              : []),
          ]
        );
      }
      return null;
    }
  }

  const { latitude, longitude } = coords;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const result: GeocodedLocation = { latitude, longitude, mapsUrl };

  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const addr = data?.address || {};
      const streetParts = [
        addr.house_number,
        addr.road || addr.pedestrian || addr.neighbourhood,
        addr.suburb || addr.locality || addr.city_district,
      ].filter(Boolean);
      if (streetParts.length > 0) {
        result.addressLine = streetParts.join(', ');
      } else if (data?.display_name) {
        result.addressLine = String(data.display_name).split(',').slice(0, 3).join(', ').trim();
      }
      result.cityName = addr.city || addr.town || addr.village || addr.state_district || '';
      result.stateName = addr.state || '';
      const rawPin = String(addr.postcode || '').replace(/\D/g, '').slice(0, 6);
      if (rawPin.length === 6) {
        result.pincode = rawPin;
      }
    }
  } catch {
    // Reverse geocoding failed; coordinates & mapsUrl are still returned
  }

  return result;
};
