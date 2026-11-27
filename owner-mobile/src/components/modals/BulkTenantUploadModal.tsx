import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient } from '../../api/client';
import { Property, Room, Tenant } from '../../types';
import { isValidUuid } from '../../services/propertyDataService';
import { fastDataCache } from '../../services/dataCache';
import { emitDataChanged } from '../../utils/appEvents';
import { AmbientOrangeBackground } from '../AmbientOrangeBackground';
import { GlassCard } from '../GlassCard';
import { BrandLoader } from '../BrandLoader';
import { showGlassSuccess } from '../glass/GlassSuccessModal';

export interface BulkTenantUploadModalProps {
  visible: boolean;
  onClose: () => void;
  properties: Property[];
  initialPropertyId?: string | null;
  onSuccess?: () => void;
}

interface ParsedRow {
  rowNumber: number;
  fullName: string;
  phone: string;
  email?: string;
  idProofType: string;
  idProofNumber: string;
  roomNumber: string;
  bedLabel?: string;
  monthlyRentPaise: number;
  securityDepositPaise: number;
  checkIn?: string;
  rentPaidNowPaise: number;
  paymentMethod: string;
  valid: boolean;
  errorReason?: string;
}

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
};

export const BulkTenantUploadModal: React.FC<BulkTenantUploadModalProps> = ({
  visible,
  onClose,
  properties,
  initialPropertyId,
  onSuccess,
}) => {
  const [selectedPropId, setSelectedPropId] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTenants, setActiveTenants] = useState<Tenant[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);

  const selectedProp = properties.find((p) => p.id === selectedPropId) || properties[0];
  const isRental = selectedProp?.propertyType === 'RENTAL_BUILDING';

  useEffect(() => {
    if (!visible) return;
    const targetId =
      initialPropertyId && properties.some((p) => p.id === initialPropertyId)
        ? initialPropertyId
        : properties[0]?.id || '';
    setSelectedPropId(targetId);
    setCsvText('');
    setParsedRows([]);
    setShowPasteBox(false);
  }, [visible, initialPropertyId]);

  useEffect(() => {
    if (!visible || !selectedPropId || !isValidUuid(selectedPropId)) {
      setRooms([]);
      setActiveTenants([]);
      return;
    }
    let active = true;
    setLoadingRooms(true);
    Promise.all([
      apiClient<Property>(`/owner/properties/${selectedPropId}`),
      apiClient<{ content: Tenant[] }>('/owner/tenants?size=500').catch(() => null),
    ])
      .then(([detail, tenantRes]) => {
        if (!active) return;
        const tenantsList = (tenantRes?.content || []).filter(
          (t) => t.active !== false && t.stayStatus !== 'TERMINATED' && (!t.propertyId || t.propertyId === selectedPropId)
        );
        setActiveTenants(tenantsList);
        const occBedIds = new Set(tenantsList.map((t) => t.bedId).filter(Boolean));
        const occRoomBedKeys = new Set(
          tenantsList
            .filter((t) => t.roomNumber && t.bedLabel)
            .map((t) => `${String(t.roomNumber).trim().toLowerCase()}-${String(t.bedLabel).trim().toLowerCase()}`)
        );
        const syncedRooms = (detail?.rooms || []).map((r) => ({
          ...r,
          beds: (r.beds || []).map((b) => {
            const key = `${String(r.roomNumber || '').trim().toLowerCase()}-${String(b.bedLabel || '').trim().toLowerCase()}`;
            if (b.status === 'OCCUPIED' || occBedIds.has(b.id) || occRoomBedKeys.has(key)) {
              return { ...b, status: 'OCCUPIED' as const };
            }
            return b;
          }),
        }));
        setRooms(syncedRooms);
      })
      .catch(() => {
        if (active) {
          setRooms([]);
          setActiveTenants([]);
        }
      })
      .finally(() => {
        if (active) setLoadingRooms(false);
      });
    return () => {
      active = false;
    };
  }, [visible, selectedPropId]);

  const occRoomNumbers = new Set(
    activeTenants.map((t) => String(t.roomNumber || '').trim().toLowerCase()).filter(Boolean)
  );

  const generateTemplateCsv = (): { csv: string; availableCount: number } => {
    const lines: string[] = [];
    let added = 0;
    if (isRental) {
      lines.push(
        'Floor,Flat / Unit No,Unit Type,Monthly Rent (Rs),Deposit (Rs),Tenant Full Name,Mobile (10-digit),Email,ID Type (AADHAAR/PAN),ID Number,Move-In (YYYY-MM-DD),Rent Paid Now (Rs),Payment Mode (UPI/CASH)'
      );
      rooms.forEach((r) => {
        const anyOcc =
          occRoomNumbers.has(String(r.roomNumber || '').trim().toLowerCase()) ||
          (r.beds || []).some((b) => b.status === 'OCCUPIED');
        if (!anyOcc) {
          const rent = r.rentMonthlyPaise ? Math.round(r.rentMonthlyPaise / 100) : 15000;
          const dep = r.depositPaise ? Math.round(r.depositPaise / 100) : rent * 2;
          lines.push(
            `${r.floorNumber || 1},${r.roomNumber},${r.sharingType || '2BHK'},${rent},${dep},,,,,,${new Date().toISOString().split('T')[0]},0,UPI`
          );
          added++;
        }
      });
    } else {
      lines.push(
        'Floor,Room Number,Bed Label,Monthly Rent (Rs),Deposit (Rs),Tenant Full Name,Mobile (10-digit),Email,ID Type (AADHAAR/PAN),ID Number,Check-In (YYYY-MM-DD),Rent Paid Now (Rs),Payment Mode (UPI/CASH)'
      );
      rooms.forEach((r) => {
        (r.beds || []).forEach((b) => {
          if (b.status !== 'OCCUPIED') {
            const rent = r.rentMonthlyPaise ? Math.round(r.rentMonthlyPaise / 100) : 8500;
            const dep = r.depositPaise ? Math.round(r.depositPaise / 100) : rent;
            lines.push(
              `${r.floorNumber || 1},${r.roomNumber},${b.bedLabel},${rent},${dep},,,,,,${new Date().toISOString().split('T')[0]},0,UPI`
            );
            added++;
          }
        });
      });
    }
    return { csv: lines.join('\n'), availableCount: added };
  };

  const handleDownloadTemplate = () => {
    if (rooms.length === 0) {
      Alert.alert(
        'No Rooms Available',
        `${selectedProp?.name || 'This property'} has no rooms configured yet. Please add rooms first.`
      );
      return;
    }
    const { csv, availableCount } = generateTemplateCsv();
    if (availableCount === 0) {
      Alert.alert(
        'No Vacant Beds / Flats',
        `All ${isRental ? 'flats' : 'beds'} in ${selectedProp?.name || 'this property'} are already occupied. Create more rooms or vacate a bed first.`
      );
      return;
    }
    const safeName = (selectedProp?.name || 'Property').replace(/[^a-zA-Z0-9]+/g, '_');
    const fileName = `${safeName}_${isRental ? 'Rental_Flats' : 'PG_Beds'}_Available_Only.csv`;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showGlassSuccess({
        title: 'Template Downloaded',
        message: `Open ${fileName} in Excel or Google Sheets, fill tenant names & mobile numbers next to vacant ${isRental ? 'flats' : 'beds'}, and upload it back.`,
        buttonText: 'Done',
      });
    } else {
      setCsvText(csv);
      setShowPasteBox(true);
      Alert.alert('Template Ready', 'Template pre-loaded below! You can edit or paste CSV rows directly.');
    }
  };

  const parseAndValidateCsv = (rawText: string) => {
    const clean = rawText.replace(/^\uFEFF/, '').trim();
    if (!clean) {
      setParsedRows([]);
      return;
    }
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      Alert.alert('Empty Sheet', 'Please include the header row and at least one tenant row.');
      return;
    }

    const roomLookup = new Map<string, Room>();
    rooms.forEach((r) => {
      if (r.roomNumber) roomLookup.set(r.roomNumber.trim().toLowerCase(), r);
    });

    const seenPhones = new Set<string>();
    const seenBeds = new Set<string>();
    const out: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const roomNum = (cols[1] || '').trim();
      const bedOrUnitType = (cols[2] || '').trim();
      const rentRs = Number((cols[3] || '0').replace(/[^0-9.]/g, '')) || 0;
      const depRs = Number((cols[4] || '0').replace(/[^0-9.]/g, '')) || 0;
      const fullName = (cols[5] || '').trim();
      const rawPhone = (cols[6] || '').replace(/\D/g, '').slice(-10);
      const email = (cols[7] || '').trim();
      const idType = ((cols[8] || 'AADHAAR').trim().toUpperCase() === 'PAN' ? 'PAN' : 'AADHAAR');
      const idNum = (cols[9] || '').trim();
      const checkIn = (cols[10] || '').trim() || new Date().toISOString().split('T')[0];
      const paidRs = Number((cols[11] || '0').replace(/[^0-9.]/g, '')) || 0;
      const payMode = (cols[12] || 'UPI').trim().toUpperCase();

      // Skip blank template rows where owner did not enter a tenant name or phone
      if (!fullName && !rawPhone) continue;

      let errorReason: string | undefined;
      if (!fullName) errorReason = 'Missing tenant name';
      else if (!/^[6-9]\d{9}$/.test(rawPhone)) errorReason = 'Invalid 10-digit mobile';
      else if (seenPhones.has(rawPhone)) errorReason = 'Duplicate mobile in sheet';
      else if (!roomNum) errorReason = isRental ? 'Missing flat number' : 'Missing room number';
      else if (rooms.length > 0) {
        const matchedRoom = roomLookup.get(roomNum.toLowerCase());
        if (!matchedRoom) {
          errorReason = `${isRental ? 'Flat' : 'Room'} ${roomNum} not found`;
        } else if (isRental) {
          const occupied = (matchedRoom.beds || []).some((b) => b.status === 'OCCUPIED');
          const key = roomNum.toLowerCase();
          if (occupied) errorReason = `Flat ${roomNum} is already occupied`;
          else if (seenBeds.has(key)) errorReason = `Flat ${roomNum} assigned twice in sheet`;
          else seenBeds.add(key);
        } else {
          const matchedBed = bedOrUnitType
            ? (matchedRoom.beds || []).find((b) => b.bedLabel.trim().toLowerCase() === bedOrUnitType.toLowerCase())
            : (matchedRoom.beds || []).find((b) => b.status !== 'OCCUPIED');
          if (!matchedBed) {
            errorReason = `Bed ${bedOrUnitType || ''} not found in Room ${roomNum}`;
          } else if (matchedBed.status === 'OCCUPIED') {
            errorReason = `Room ${roomNum} • ${matchedBed.bedLabel} is already occupied`;
          } else {
            const key = `${roomNum.toLowerCase()}-${matchedBed.bedLabel.trim().toLowerCase()}`;
            if (seenBeds.has(key)) errorReason = `Room ${roomNum} • ${matchedBed.bedLabel} assigned twice`;
            else seenBeds.add(key);
          }
        }
      }

      if (rawPhone && /^[6-9]\d{9}$/.test(rawPhone)) seenPhones.add(rawPhone);

      out.push({
        rowNumber: i + 1,
        fullName,
        phone: rawPhone,
        email: email || undefined,
        idProofType: idType,
        idProofNumber: idNum || 'NOT_PROVIDED',
        roomNumber: roomNum,
        bedLabel: isRental ? undefined : bedOrUnitType || undefined,
        monthlyRentPaise: Math.round(rentRs * 100),
        securityDepositPaise: Math.round(depRs * 100),
        checkIn,
        rentPaidNowPaise: Math.round(paidRs * 100),
        paymentMethod: ['UPI', 'CASH', 'BANK_TRANSFER'].includes(payMode) ? payMode : 'UPI',
        valid: !errorReason,
        errorReason,
      });
    }

    setParsedRows(out);
  };

  const handlePickWebFile = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setShowPasteBox(true);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = (e: any) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = String(ev?.target?.result || '');
        setCsvText(text);
        parseAndValidateCsv(text);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const validRows = parsedRows.filter((r) => r.valid);

  const handleBulkImport = async () => {
    if (!selectedPropId || !isValidUuid(selectedPropId)) {
      Alert.alert('Select Property', 'Please select a synced property first.');
      return;
    }
    if (validRows.length === 0) {
      Alert.alert('No Valid Rows', 'Please upload a CSV with at least one valid tenant row.');
      return;
    }

    setImporting(true);
    try {
      const res = await apiClient<{
        totalRows: number;
        importedCount: number;
        skippedCount: number;
        errors: { rowNumber: number; identifier: string; reason: string }[];
      }>('/owner/tenants/bulk', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: selectedPropId,
          rows: validRows.map((r) => ({
            rowNumber: r.rowNumber,
            fullName: r.fullName,
            phone: r.phone,
            email: r.email,
            idProofType: r.idProofType,
            idProofNumber: r.idProofNumber,
            roomNumber: r.roomNumber,
            bedLabel: r.bedLabel,
            monthlyRentPaise: r.monthlyRentPaise,
            securityDepositPaise: r.securityDepositPaise,
            checkIn: r.checkIn,
            rentPaidNowPaise: r.rentPaidNowPaise,
            paymentMethod: r.paymentMethod,
          })),
        }),
      });

      fastDataCache.invalidateAll();
      emitDataChanged();

      const errNote =
        res.skippedCount > 0 && res.errors?.length
          ? `\n\nSkipped ${res.skippedCount}: ${res.errors.map((e) => `Row ${e.rowNumber} (${e.reason})`).join('; ')}`
          : '';

      showGlassSuccess({
        title: `${res.importedCount} Tenants Imported`,
        message: `Successfully onboarded ${res.importedCount} ${res.importedCount === 1 ? 'resident' : 'residents'} into ${selectedProp?.name || 'property'}.${errNote}`,
        buttonText: 'Done',
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Bulk Import Failed', err?.message || 'Could not import tenants.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <AmbientOrangeBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bulk Upload Tenants</Text>
            <View style={{ width: 64 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Step 1: Select Property */}
            <GlassCard borderRadius={22} padding={16} style={{ marginBottom: 14 }}>
              <Text style={styles.stepLabel}>1. SELECT PROPERTY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {properties.map((p) => {
                  const active = p.id === selectedPropId;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.propChip, active && styles.propChipActive]}
                      onPress={() => {
                        setSelectedPropId(p.id);
                        setParsedRows([]);
                      }}
                    >
                      <Text style={[styles.propChipText, active && styles.propChipTextActive]}>
                        {p.propertyType === 'RENTAL_BUILDING' ? '🏠 ' : '🏢 '}
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.modeHint}>
                Detected Type: {isRental ? 'Rental Building (Flat-wise template)' : 'PG / Hostel (Bed-wise template)'}
              </Text>
            </GlassCard>

            {/* Step 2: Download Template */}
            <GlassCard borderRadius={22} padding={16} style={{ marginBottom: 14 }}>
              <Text style={styles.stepLabel}>2. DOWNLOAD PRE-FILLED EXCEL / CSV SHEET</Text>
              <Text style={styles.stepDesc}>
                Pre-filled with your vacant {isRental ? 'flats & rents' : 'rooms, beds & rents'}. Just enter Tenant Name & 10-digit Mobile in Excel.
              </Text>
              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  (loadingRooms || rooms.length === 0 || generateTemplateCsv().availableCount === 0) && { opacity: 0.5 },
                ]}
                onPress={handleDownloadTemplate}
                disabled={loadingRooms || rooms.length === 0 || generateTemplateCsv().availableCount === 0}
              >
                {loadingRooms ? (
                  <BrandLoader variant="inline" />
                ) : rooms.length === 0 || generateTemplateCsv().availableCount === 0 ? (
                  <Text style={styles.secondaryBtnText}>
                    No Vacant {isRental ? 'Flats' : 'Beds'} Available
                  </Text>
                ) : (
                  <Text style={styles.secondaryBtnText}>
                    ⬇️ Download {isRental ? 'Rental Flats' : 'PG Beds'} Template (.csv)
                  </Text>
                )}
              </TouchableOpacity>
            </GlassCard>

            {/* Step 3: Upload & Validate */}
            <GlassCard borderRadius={22} padding={16} style={{ marginBottom: 14 }}>
              <Text style={styles.stepLabel}>3. UPLOAD FILLED SHEET</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity style={[styles.primaryOutlineBtn, { flex: 1 }]} onPress={handlePickWebFile}>
                  <Text style={styles.primaryOutlineText}>📄 Choose CSV File</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pasteToggleBtn}
                  onPress={() => setShowPasteBox((v) => !v)}
                >
                  <Text style={styles.pasteToggleText}>{showPasteBox ? 'Hide Paste' : 'Paste CSV'}</Text>
                </TouchableOpacity>
              </View>

              {showPasteBox && (
                <View style={{ marginTop: 12 }}>
                  <TextInput
                    style={styles.pasteInput}
                    multiline
                    value={csvText}
                    onChangeText={setCsvText}
                    placeholder="Paste CSV rows here..."
                    placeholderTextColor="#94A3B8"
                  />
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { marginTop: 8 }]}
                    onPress={() => parseAndValidateCsv(csvText)}
                  >
                    <Text style={styles.secondaryBtnText}>Validate Pasted Rows</Text>
                  </TouchableOpacity>
                </View>
              )}

              {parsedRows.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.previewHeading}>
                    Validation Preview: {validRows.length} Ready • {parsedRows.length - validRows.length} Issues
                  </Text>
                  {parsedRows.map((r, i) => (
                    <View
                      key={`prev-${r.rowNumber}-${i}`}
                      style={[styles.previewRow, r.valid ? styles.previewOk : styles.previewErr]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.previewTitle}>
                          {r.valid ? '✓ ' : '⚠️ '}
                          {r.fullName || 'Unnamed'} • +91 {r.phone || '--'}
                        </Text>
                        <Text style={styles.previewSub}>
                          {isRental ? `Flat ${r.roomNumber}` : `Room ${r.roomNumber} • ${r.bedLabel || 'Auto Bed'}`} • ₹
                          {Math.round(r.monthlyRentPaise / 100).toLocaleString('en-IN')}/mo
                        </Text>
                        {!r.valid && <Text style={styles.previewErrText}>{r.errorReason}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </GlassCard>

            <TouchableOpacity
              style={[styles.importBtn, (validRows.length === 0 || importing) && { opacity: 0.5 }]}
              onPress={handleBulkImport}
              disabled={validRows.length === 0 || importing}
            >
              {importing ? (
                <BrandLoader variant="inline" color="#FFFFFF" />
              ) : (
                <Text style={styles.importBtnText}>
                  Import {validRows.length} Valid {validRows.length === 1 ? 'Tenant' : 'Tenants'} →
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </AmbientOrangeBackground>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scroll: { padding: 16, paddingBottom: 40 },
  stepLabel: { fontSize: 11, fontWeight: '800', color: '#EA580C', letterSpacing: 0.5 },
  stepDesc: { fontSize: 12.5, color: '#475569', marginTop: 6, marginBottom: 12, lineHeight: 18 },
  modeHint: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 10 },
  propChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  propChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
  },
  propChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  propChipTextActive: { color: '#EA580C' },
  secondaryBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 13.5, fontWeight: '800', color: '#EA580C' },
  primaryOutlineBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryOutlineText: { fontSize: 13.5, fontWeight: '800', color: '#EA580C' },
  pasteToggleBtn: {
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
  },
  pasteToggleText: { fontSize: 12.5, fontWeight: '700', color: '#475569' },
  pasteInput: {
    minHeight: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    fontSize: 12,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  previewHeading: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  previewRow: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
  },
  previewOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  previewErr: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  previewTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  previewSub: { fontSize: 11.5, color: '#475569', marginTop: 2 },
  previewErrText: { fontSize: 11.5, fontWeight: '700', color: '#DC2626', marginTop: 3 },
  importBtn: {
    backgroundColor: '#F97316',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  importBtnText: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' },
});
