import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';

export interface MatrixUnit {
  id: string;
  unit_number: string;
  unit_type: string;
  monthly_rent: number;
  maintenance: number;
  sharing_capacity: number;
}

export interface MatrixFloor {
  floor_number: number;
  label: string;
  units: MatrixUnit[];
}

interface FloorUnitMatrixBuilderProps {
  propertyMode: 'PG' | 'RENTAL';
  floors: MatrixFloor[];
  defaultMaintenance: number;
  onChangeFloors: (floors: MatrixFloor[]) => void;
  onBackStep: () => void;
  onSubmit: () => void;
  submitting?: boolean;
}

const RENTAL_UNIT_TYPES = [
  { type: '1RK', defaultRent: 8500, capacity: 1, tintBg: '#f3f4f6', tintBorder: '#d1d5db', tintText: '#374151' },
  { type: '1BHK', defaultRent: 12000, capacity: 1, tintBg: '#f3f4f6', tintBorder: '#d1d5db', tintText: '#111827' },
  { type: '2BHK', defaultRent: 18000, capacity: 1, tintBg: '#f5f3ff', tintBorder: '#ddd6fe', tintText: '#5b21b6' },
  { type: '3BHK', defaultRent: 24000, capacity: 1, tintBg: '#ffedd5', tintBorder: '#fdba74', tintText: '#c2410c' },
  { type: 'Custom', defaultRent: 15000, capacity: 1, tintBg: '#ecfdf5', tintBorder: '#a7f3d0', tintText: '#065f46' },
];

const PG_UNIT_TYPES = [
  { type: '1-Share', defaultRent: 14000, capacity: 1, tintBg: '#f3f4f6', tintBorder: '#d1d5db', tintText: '#111827' },
  { type: '2-Share', defaultRent: 9500, capacity: 2, tintBg: '#f5f3ff', tintBorder: '#ddd6fe', tintText: '#5b21b6' },
  { type: '3-Share', defaultRent: 8000, capacity: 3, tintBg: '#ffedd5', tintBorder: '#fdba74', tintText: '#c2410c' },
  { type: '4-Share', defaultRent: 6500, capacity: 4, tintBg: '#ecfdf5', tintBorder: '#a7f3d0', tintText: '#065f46' },
  { type: 'Custom', defaultRent: 8500, capacity: 2, tintBg: '#f3f4f6', tintBorder: '#d1d5db', tintText: '#374151' },
];

export const getInitialMatrixFloors = (
  propertyMode: 'PG' | 'RENTAL',
  defaultRent: number,
  defaultMaintenance: number
): MatrixFloor[] => {
  if (propertyMode === 'RENTAL') {
    return [
      {
        floor_number: 1,
        label: 'Floor 1',
        units: [
          { id: 'u-1-1', unit_number: '101', unit_type: '1BHK', monthly_rent: 12000, maintenance: defaultMaintenance, sharing_capacity: 1 },
          { id: 'u-1-2', unit_number: '102', unit_type: '2BHK', monthly_rent: 18000, maintenance: defaultMaintenance, sharing_capacity: 1 },
          { id: 'u-1-3', unit_number: '103', unit_type: '2BHK', monthly_rent: 18000, maintenance: defaultMaintenance, sharing_capacity: 1 },
        ],
      },
      {
        floor_number: 2,
        label: 'Floor 2',
        units: [
          { id: 'u-2-1', unit_number: '201', unit_type: '2BHK', monthly_rent: 18500, maintenance: defaultMaintenance, sharing_capacity: 1 },
          { id: 'u-2-2', unit_number: '202', unit_type: '3BHK', monthly_rent: 24000, maintenance: defaultMaintenance, sharing_capacity: 1 },
        ],
      },
    ];
  }

  return [
    {
      floor_number: 1,
      label: 'Floor 1',
      units: [
        { id: 'u-1-1', unit_number: '101', unit_type: '2-Share', monthly_rent: defaultRent || 9500, maintenance: defaultMaintenance, sharing_capacity: 2 },
        { id: 'u-1-2', unit_number: '102', unit_type: '3-Share', monthly_rent: 8000, maintenance: defaultMaintenance, sharing_capacity: 3 },
      ],
    },
    {
      floor_number: 2,
      label: 'Floor 2',
      units: [
        { id: 'u-2-1', unit_number: '201', unit_type: '2-Share', monthly_rent: defaultRent || 9500, maintenance: defaultMaintenance, sharing_capacity: 2 },
        { id: 'u-2-2', unit_number: '202', unit_type: '3-Share', monthly_rent: 8000, maintenance: defaultMaintenance, sharing_capacity: 3 },
      ],
    },
  ];
};

export const FloorUnitMatrixBuilder: React.FC<FloorUnitMatrixBuilderProps> = ({
  propertyMode,
  floors,
  defaultMaintenance,
  onChangeFloors,
  onBackStep,
  onSubmit,
  submitting = false,
}) => {
  const [activeTypePicker, setActiveTypePicker] = useState<{ floorIdx: number; unitId: string } | null>(null);
  const typeOptions = propertyMode === 'RENTAL' ? RENTAL_UNIT_TYPES : PG_UNIT_TYPES;

  const totalUnits = floors.reduce((sum, f) => sum + f.units.length, 0);
  const totalBeds = floors.reduce(
    (sum, f) => sum + f.units.reduce((us, u) => us + (u.sharing_capacity || 1), 0),
    0
  );

  // Compute exact counts grouped by unit_type
  const typeCountsMap = new Map<string, number>();
  floors.forEach((f) => {
    f.units.forEach((u) => {
      typeCountsMap.set(u.unit_type, (typeCountsMap.get(u.unit_type) || 0) + 1);
    });
  });
  const breakdownSummary = Array.from(typeCountsMap.entries())
    .map(([t, c]) => `${c}× ${t}`)
    .join(' • ');

  const getTypeStyle = (unitType: string) => {
    return typeOptions.find((o) => o.type === unitType) || typeOptions[0];
  };

  const handleAddUnitToFloor = (floorIdx: number) => {
    const targetFloor = floors[floorIdx];
    const nextIdx = targetFloor.units.length + 1;
    const prefix = targetFloor.floor_number;
    const nextNum = `${prefix}${nextIdx < 10 ? '0' + nextIdx : nextIdx}`;
    const defaultOpt = propertyMode === 'RENTAL' ? typeOptions[1] : typeOptions[1];

    const newUnit: MatrixUnit = {
      id: `u-${prefix}-${Date.now()}-${nextIdx}`,
      unit_number: nextNum,
      unit_type: defaultOpt.type,
      monthly_rent: defaultOpt.defaultRent,
      maintenance: defaultMaintenance,
      sharing_capacity: defaultOpt.capacity,
    };

    const next = floors.map((f, idx) =>
      idx === floorIdx ? { ...f, units: [...f.units, newUnit] } : f
    );
    onChangeFloors(next);
  };

  const handleCopyPreviousFloor = (floorIdx: number) => {
    if (floorIdx <= 0) return;
    const prevFloor = floors[floorIdx - 1];
    const currFloor = floors[floorIdx];
    const newPrefix = String(currFloor.floor_number);

    const clonedUnits: MatrixUnit[] = prevFloor.units.map((u, uIdx) => {
      const suffix = u.unit_number.length >= 2 ? u.unit_number.slice(-2) : `${uIdx + 1 < 10 ? '0' : ''}${uIdx + 1}`;
      return {
        ...u,
        id: `u-${newPrefix}-${Date.now()}-${uIdx}`,
        unit_number: `${newPrefix}${suffix}`,
      };
    });

    const next = floors.map((f, idx) =>
      idx === floorIdx ? { ...f, units: clonedUnits } : f
    );
    onChangeFloors(next);
  };

  const handleAddFloor = () => {
    const nextFloorNum = floors.length + 1;
    const defaultOpt = typeOptions[1];
    const newFloor: MatrixFloor = {
      floor_number: nextFloorNum,
      label: `Floor ${nextFloorNum}`,
      units: [
        {
          id: `u-${nextFloorNum}-${Date.now()}-1`,
          unit_number: `${nextFloorNum}01`,
          unit_type: defaultOpt.type,
          monthly_rent: defaultOpt.defaultRent,
          maintenance: defaultMaintenance,
          sharing_capacity: defaultOpt.capacity,
        },
      ],
    };
    onChangeFloors([...floors, newFloor]);
  };

  const handleUpdateUnit = (floorIdx: number, unitId: string, patch: Partial<MatrixUnit>) => {
    const next = floors.map((f, idx) => {
      if (idx !== floorIdx) return f;
      return {
        ...f,
        units: f.units.map((u) => (u.id === unitId ? { ...u, ...patch } : u)),
      };
    });
    onChangeFloors(next);
  };

  const handleRemoveUnit = (floorIdx: number, unitId: string) => {
    const next = floors.map((f, idx) => {
      if (idx !== floorIdx) return f;
      return {
        ...f,
        units: f.units.filter((u) => u.id !== unitId),
      };
    });
    onChangeFloors(next);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBackStep} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Property</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Step 2 of 2</Text>
        </View>
      </View>

      {/* Live Building Summary Banner */}
      <View style={styles.summaryBanner}>
        <Text style={styles.summaryTitle}>
          {floors.length} {floors.length === 1 ? 'Floor' : 'Floors'} • {totalUnits} Total{' '}
          {propertyMode === 'PG' ? `Rooms (${totalBeds} Beds)` : 'Units'}
        </Text>
        <Text style={styles.summarySub}>
          {breakdownSummary || 'Add units to each floor below'}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 410 }}>
        {floors.map((floor, fIdx) => (
          <View key={floor.floor_number} style={styles.floorCard}>
            {/* Floor Header */}
            <View style={styles.floorHeaderRow}>
              <Text style={styles.floorTitle}>{floor.label}</Text>
              <View style={styles.floorActionsRow}>
                {fIdx > 0 && (
                  <TouchableOpacity
                    style={styles.copyFloorBtn}
                    onPress={() => handleCopyPreviousFloor(fIdx)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.copyFloorBtnText}>
                      Copy Floor {floors[fIdx - 1].floor_number}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleAddUnitToFloor(fIdx)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.addUnitText}>+ Add Unit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Unit Rows */}
            {floor.units.length === 0 ? (
              <Text style={styles.emptyFloorText}>No units on this floor. Tap "+ Add Unit".</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {floor.units.map((unit) => {
                  const tStyle = getTypeStyle(unit.unit_type);
                  const isPickerOpen =
                    activeTypePicker?.floorIdx === fIdx && activeTypePicker?.unitId === unit.id;

                  return (
                    <View key={unit.id}>
                      <View style={styles.unitRow}>
                        {/* 1. Editable Unit Number */}
                        <TextInput
                          style={styles.unitNumInput}
                          value={unit.unit_number}
                          onChangeText={(val) =>
                            handleUpdateUnit(fIdx, unit.id, { unit_number: val })
                          }
                          placeholder="101"
                        />

                        {/* 2. Unit Type Selector Pill */}
                        <TouchableOpacity
                          style={[
                            styles.unitTypePill,
                            { backgroundColor: tStyle.tintBg, borderColor: tStyle.tintBorder },
                          ]}
                          onPress={() =>
                            setActiveTypePicker(isPickerOpen ? null : { floorIdx: fIdx, unitId: unit.id })
                          }
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.unitTypePillText, { color: tStyle.tintText }]}>
                            {unit.unit_type} ▾
                          </Text>
                        </TouchableOpacity>

                        {/* 3. Monthly Rent Input */}
                        <View style={styles.rentInputWrap}>
                          <Text style={styles.rentRupeePrefix}>₹</Text>
                          <TextInput
                            style={styles.rentInput}
                            value={String(unit.monthly_rent)}
                            keyboardType="numeric"
                            onChangeText={(val) => {
                              const num = parseInt(val.replace(/\D/g, '') || '0', 10);
                              handleUpdateUnit(fIdx, unit.id, { monthly_rent: num });
                            }}
                          />
                        </View>

                        {/* 4. Remove (×) button */}
                        <TouchableOpacity
                          style={styles.deleteUnitBtn}
                          onPress={() => handleRemoveUnit(fIdx, unit.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteUnitIcon}>×</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Inline Dropdown Options for Unit Type */}
                      {isPickerOpen && (
                        <View style={styles.inlineTypeSelectorRow}>
                          {typeOptions.map((opt) => (
                            <TouchableOpacity
                              key={opt.type}
                              style={[
                                styles.inlineTypeOption,
                                unit.unit_type === opt.type && styles.inlineTypeOptionActive,
                              ]}
                              onPress={() => {
                                handleUpdateUnit(fIdx, unit.id, {
                                  unit_type: opt.type,
                                  monthly_rent: opt.defaultRent,
                                  sharing_capacity: opt.capacity,
                                });
                                setActiveTypePicker(null);
                              }}
                            >
                              <Text
                                style={[
                                  styles.inlineTypeOptionText,
                                  unit.unit_type === opt.type && { color: '#ffffff', fontWeight: '800' },
                                ]}
                              >
                                {opt.type}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        {/* + Add Floor Button */}
        <TouchableOpacity
          style={styles.addFloorDashedBtn}
          onPress={handleAddFloor}
          activeOpacity={0.8}
        >
          <Text style={styles.addFloorDashedText}>+ Add Floor</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Primary CTA */}
      <TouchableOpacity
        style={[styles.generateCtaBtn, (submitting || totalUnits === 0) && { opacity: 0.65 }]}
        onPress={onSubmit}
        disabled={submitting || totalUnits === 0}
        activeOpacity={0.85}
      >
        <Text style={styles.generateCtaText}>
          {submitting
            ? 'Saving Property...'
            : `Generate ${totalUnits} ${propertyMode === 'PG' ? 'Rooms' : 'Units'} & Save Property`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    padding: 4,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    flex: 1,
    marginLeft: 8,
  },
  stepBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  summaryBanner: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },
  summarySub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 2,
  },
  floorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#efece9',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  floorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  floorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  floorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copyFloorBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  copyFloorBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  addUnitText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
  },
  emptyFloorText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 8,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitNumInput: {
    width: 52,
    backgroundColor: '#faf8f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  unitTypePill: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 76,
    alignItems: 'center',
  },
  unitTypePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rentInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  rentRupeePrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    marginRight: 2,
  },
  rentInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  deleteUnitBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  deleteUnitIcon: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '700',
  },
  inlineTypeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    padding: 8,
    backgroundColor: '#faf8f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#efece9',
  },
  inlineTypeOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inlineTypeOptionActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  inlineTypeOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  addFloorDashedBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 14,
  },
  addFloorDashedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4b5563',
  },
  generateCtaBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#ea580c',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  generateCtaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
