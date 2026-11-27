import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import {
  fetchCurrentPropertyLocation,
  GeocodedLocation,
  reverseGeocodeCoords,
  searchAddressPlaces,
} from '../../utils/locationHelper';
import { BrandLoader } from '../BrandLoader';

interface LocationPickerModalProps {
  visible: boolean;
  initialLat?: number | null;
  initialLng?: number | null;
  onClose: () => void;
  onConfirm: (location: GeocodedLocation) => void;
}

const INDIA_CENTER_LAT = 20.5937;
const INDIA_CENTER_LNG = 78.9629;
const TILE_SIZE = 120;

const latLonToTileFloat = (lat: number, lon: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
};

const tileFloatToLatLon = (x: number, y: number, zoom: number) => {
  const n = Math.pow(2, zoom);
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
};

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  initialLat,
  initialLng,
  onClose,
  onConfirm,
}) => {
  const [lat, setLat] = useState<number>(initialLat || INDIA_CENTER_LAT);
  const [lng, setLng] = useState<number>(initialLng || INDIA_CENTER_LNG);
  const [zoom, setZoom] = useState<number>(initialLat && initialLng ? 16 : 5);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodedLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const [addressLine, setAddressLine] = useState('');
  const [locality, setLocality] = useState('');
  const [cityName, setCityName] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [mapBoxWidth, setMapBoxWidth] = useState(320);

  const applyGeocoded = (loc: GeocodedLocation) => {
    setLat(Number(loc.latitude.toFixed(6)));
    setLng(Number(loc.longitude.toFixed(6)));
    if (loc.addressLine) setAddressLine(loc.addressLine);
    if (loc.locality) setLocality(loc.locality);
    if (loc.cityName) setCityName(loc.cityName);
    if (loc.stateName) setStateName(loc.stateName);
    if (loc.pincode) setPincode(loc.pincode);
  };

  useEffect(() => {
    if (!visible) return;
    setSearchResults([]);
    setSearchQuery('');
    if (initialLat && initialLng) {
      setLat(initialLat);
      setLng(initialLng);
      setZoom(16);
      void reverseGeocodeCoords(initialLat, initialLng).then(applyGeocoded);
    } else {
      setLat(INDIA_CENTER_LAT);
      setLng(INDIA_CENTER_LNG);
      setZoom(5);
      // Silently try centering on user's live GPS if permission is already granted
      void fetchCurrentPropertyLocation(true).then((loc) => {
        if (loc) {
          applyGeocoded(loc);
          setZoom(17);
        }
      });
    }
  }, [visible, initialLat, initialLng]);

  const handleUseCurrentGps = async () => {
    setLocating(true);
    try {
      const loc = await fetchCurrentPropertyLocation();
      if (loc) {
        applyGeocoded(loc);
        setZoom(17);
      }
    } finally {
      setLocating(false);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchAddressPlaces(q);
      setSearchResults(res);
    } finally {
      setSearching(false);
    }
  };

  const handleMapTap = async (evt: any) => {
    const tapX = evt?.nativeEvent?.locationX;
    const tapY = evt?.nativeEvent?.locationY;
    if (typeof tapX !== 'number' || typeof tapY !== 'number') return;

    const mapHeight = 250;
    const dxPx = tapX - mapBoxWidth / 2;
    const dyPx = tapY - mapHeight / 2;

    const centerTile = latLonToTileFloat(lat, lng, zoom);
    const newTileX = centerTile.x + dxPx / TILE_SIZE;
    const newTileY = centerTile.y + dyPx / TILE_SIZE;
    const { lat: nextLat, lon: nextLng } = tileFloatToLatLon(newTileX, newTileY, zoom);

    setLat(Number(nextLat.toFixed(6)));
    setLng(Number(nextLng.toFixed(6)));
    setLocating(true);
    try {
      const loc = await reverseGeocodeCoords(nextLat, nextLng);
      applyGeocoded(loc);
    } finally {
      setLocating(false);
    }
  };

  const centerTile = latLonToTileFloat(lat, lng, zoom);
  const centerTileX = Math.floor(centerTile.x);
  const centerTileY = Math.floor(centerTile.y);
  const fracX = (centerTile.x - centerTileX) * TILE_SIZE;
  const fracY = (centerTile.y - centerTileY) * TILE_SIZE;

  const gridOffsets = [-1, 0, 1];
  const mapHeight = 250;
  const gridLeft = mapBoxWidth / 2 - (TILE_SIZE + fracX);
  const gridTop = mapHeight / 2 - (TILE_SIZE + fracY);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Pick Property Location</Text>
            <Text style={styles.headerSub}>Tap map, search, or fetch live GPS</Text>
          </View>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Search Input */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="🔍 Search street, area, landmark, city..."
              placeholderTextColor="#94a3b8"
            />
            {searching && <BrandLoader variant="inline" style={{ marginLeft: 8 }} />}
          </View>

          {searchResults.length > 0 && (
            <View style={styles.resultsBox}>
              {searchResults.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.latitude}-${item.longitude}-${idx}`}
                  style={styles.resultItem}
                  onPress={() => {
                    applyGeocoded(item);
                    setSearchResults([]);
                    setSearchQuery(item.addressLine || '');
                    setZoom(16);
                  }}
                >
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    📍 {item.addressLine || item.cityName}
                  </Text>
                  <Text style={styles.resultSub} numberOfLines={1}>
                    {item.displayName || `${item.cityName || ''} ${item.pincode || ''}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Interactive OpenStreetMap Tile Canvas */}
          <View
            style={styles.mapContainer}
            onLayout={(e) => setMapBoxWidth(e.nativeEvent.layout.width)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleMapTap}
              style={{ width: '100%', height: mapHeight, overflow: 'hidden', position: 'relative' }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: gridLeft,
                  top: gridTop,
                  width: TILE_SIZE * 3,
                  height: TILE_SIZE * 3,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                }}
              >
                {gridOffsets.map((dy) =>
                  gridOffsets.map((dx) => {
                    const tx = centerTileX + dx;
                    const ty = centerTileY + dy;
                    const uri = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${ty}/${tx}`;
                    return (
                      <Image
                        key={`${zoom}-${tx}-${ty}`}
                        source={{ uri }}
                        style={{ width: TILE_SIZE, height: TILE_SIZE }}
                      />
                    );
                  })
                )}
              </View>

              {/* Center Pin */}
              <View pointerEvents="none" style={styles.centerPinWrap}>
                <Text style={{ fontSize: 32 }}>📍</Text>
              </View>
            </TouchableOpacity>

            {/* Map Overlay Controls */}
            <View style={styles.zoomCol}>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setZoom((z) => Math.min(18, z + 1))}
              >
                <Text style={styles.zoomBtnText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zoomBtn}
                onPress={() => setZoom((z) => Math.max(11, z - 1))}
              >
                <Text style={styles.zoomBtnText}>−</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.gpsFloatingBtn}
              onPress={handleUseCurrentGps}
              disabled={locating}
              activeOpacity={0.85}
            >
              {locating ? (
                <BrandLoader variant="inline" color="#FFFFFF" />
              ) : (
                <Text style={styles.gpsFloatingBtnText}>📍 Fetch Current Location</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.coordsBar}>
            <Text style={styles.coordsText}>
              Lat: {lat.toFixed(5)} • Lng: {lng.toFixed(5)}
            </Text>
            <TouchableOpacity
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {})
              }
            >
              <Text style={styles.openMapsLink}>Open Google Maps ↗</Text>
            </TouchableOpacity>
          </View>

          {/* Editable Fetched Address Fields */}
          <View style={styles.fieldsCard}>
            <Text style={styles.fieldLabel}>FULL ADDRESS / STREET *</Text>
            <TextInput
              style={styles.input}
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="House/Plot No, Street, Landmark"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.fieldLabel}>LOCALITY / AREA</Text>
            <TextInput
              style={styles.input}
              value={locality}
              onChangeText={setLocality}
              placeholder="e.g. Madhapur"
              placeholderTextColor="#94a3b8"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>CITY *</Text>
                <TextInput
                  style={styles.input}
                  value={cityName}
                  onChangeText={setCityName}
                  placeholder="e.g. Hyderabad"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>PINCODE</Text>
                <TextInput
                  style={styles.input}
                  value={pincode}
                  onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="numeric"
                  maxLength={6}
                  placeholder="500081"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>STATE</Text>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              value={stateName}
              onChangeText={setStateName}
              placeholder="e.g. Telangana"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => {
              onConfirm({
                latitude: lat,
                longitude: lng,
                addressLine: addressLine.trim(),
                locality: locality.trim(),
                cityName: cityName.trim(),
                stateName: stateName.trim(),
                pincode: pincode.trim() || undefined,
                mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
              });
              onClose();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmBtnText}>✓ Confirm & Fill Address Details</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F4',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ea580c',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a',
  },
  resultsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  resultSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  mapContainer: {
    height: 250,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    backgroundColor: '#e2e8f0',
    position: 'relative',
  },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -32,
  },
  zoomCol: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 6,
  },
  zoomBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  gpsFloatingBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#ea580c',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 99,
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  gpsFloatingBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  coordsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  coordsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  openMapsLink: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  fieldsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 10,
  },
  confirmBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
