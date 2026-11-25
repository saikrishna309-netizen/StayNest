import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Property, MaintenanceIssue } from '../../types';
import { safeStorage } from '../../utils/safeStorage';

interface LogIssueModalProps {
  visible: boolean;
  onClose: () => void;
  properties: Property[];
  initialPropertyId?: string;
}

type IssueCategory = 'ELECTRICAL' | 'PLUMBING' | 'INTERNET' | 'HOUSEKEEPING' | 'OTHER';

interface CategoryConfig {
  key: IssueCategory;
  headline: string;
  icon: string;
  badgeColor: string;
  bgTint: string;
  options: string[];
}

const CATEGORY_CONFIGS: Record<IssueCategory, CategoryConfig> = {
  ELECTRICAL: {
    key: 'ELECTRICAL',
    headline: '⚡ Electrical Issues',
    icon: '⚡',
    badgeColor: '#ea580c',
    bgTint: '#fff7ed',
    options: [
      'No Power / Main MCB Trip',
      'Ceiling Fan Issue / Not Rotating',
      'Switch / Socket Defective',
      'Light / Tube Bulb Defect',
      'AC Not Cooling / Water Dripping',
      'Geyser Not Heating Water',
      'Inverter / UPS Backup Down',
      'Exhaust Fan Broken',
    ],
  },
  PLUMBING: {
    key: 'PLUMBING',
    headline: '🚰 Plumbing & Water Issues',
    icon: '🚰',
    badgeColor: '#0284c7',
    bgTint: '#f0f9ff',
    options: [
      'Tap Leaking / Broken Tap',
      'Washroom Drain Clogged',
      'Flush Valve Not Working',
      'No Water / Low Water Pressure',
      'Shower Head Jammed / Leaking',
      'Washbasin Pipe Blocked',
      'Water Tank Overflow',
      'Pipe Seepage / Wall Moisture',
    ],
  },
  INTERNET: {
    key: 'INTERNET',
    headline: '🌐 Internet & Wi-Fi Issues',
    icon: '🌐',
    badgeColor: '#2563eb',
    bgTint: '#eff6ff',
    options: [
      'Wi-Fi Offline / No Internet',
      'Router Blinking Red / Down',
      'Very Slow Internet Speed',
      'Low Wi-Fi Signal in Room',
      'Frequent Disconnections',
      'LAN Cable / Port Damaged',
      'Password Reset / Unable to Connect',
    ],
  },
  HOUSEKEEPING: {
    key: 'HOUSEKEEPING',
    headline: '🧹 Housekeeping & Cleaning Issues',
    icon: '🧹',
    badgeColor: '#16a34a',
    bgTint: '#f0fdf4',
    options: [
      'Room Cleaning Required',
      'Washroom Deep Cleaning Needed',
      'Dustbin / Trash Not Cleared',
      'Bed Linen & Pillow Replacement',
      'Water RO Filter Cleaning',
      'Corridor / Balcony Dirty',
      'Pest Control / Mosquito Spray Needed',
    ],
  },
  OTHER: {
    key: 'OTHER',
    headline: '🚪 Carpentry & Other Issues',
    icon: '🚪',
    badgeColor: '#7c3aed',
    bgTint: '#faf5ff',
    options: [
      'Door Lock / Handle Broken',
      'Cupboard / Wardrobe Door Stuck',
      'Window Glass / Latch Damaged',
      'Bed Frame / Mattress Issue',
      'Main Gate / Access Sensor Issue',
      'Curtain Rod Broken',
    ],
  },
};

export const LogIssueModal: React.FC<LogIssueModalProps> = ({
  visible,
  onClose,
  properties,
  initialPropertyId,
}) => {
  const [activeTab, setActiveTab] = useState<'NEW_ISSUE' | 'HISTORY'>('NEW_ISSUE');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    initialPropertyId || properties[0]?.id || 'prop-pg-1'
  );
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Form states
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>('ELECTRICAL');
  const [selectedOption, setSelectedOption] = useState<string>('No Power / Main MCB Trip');
  const [roomNumber, setRoomNumber] = useState('101');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [customDescription, setCustomDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History state
  const [issuesList, setIssuesList] = useState<MaintenanceIssue[]>([]);

  useEffect(() => {
    if (initialPropertyId) {
      setSelectedPropertyId(initialPropertyId);
    }
  }, [initialPropertyId]);

  useEffect(() => {
    if (visible) {
      loadIssues();
    }
  }, [visible]);

  const loadIssues = async () => {
    try {
      const stored = await safeStorage.getItem('@staynest_maintenance_issues');
      if (stored) {
        setIssuesList(JSON.parse(stored));
      } else {
        // Initial mock issues for realistic PG operations
        const defaultIssues: MaintenanceIssue[] = [
          {
            id: 'ISS-101',
            propertyId: 'prop-pg-1',
            propertyName: "StayNest Elite Men's PG",
            roomNumber: '101',
            issueCategory: 'ELECTRICAL',
            selectedOption: 'Ceiling Fan Issue / Not Rotating',
            description: 'Regulator not controlling speed, stuck at 1.',
            priority: 'MEDIUM',
            status: 'OPEN',
            reportedDate: new Date(Date.now() - 3600000 * 5).toISOString(),
          },
          {
            id: 'ISS-102',
            propertyId: 'prop-pg-1',
            propertyName: "StayNest Elite Men's PG",
            roomNumber: '201',
            issueCategory: 'PLUMBING',
            selectedOption: 'Tap Leaking / Broken Tap',
            description: 'Washroom washbasin tap dripping continuously.',
            priority: 'LOW',
            status: 'IN_PROGRESS',
            reportedDate: new Date(Date.now() - 3600000 * 22).toISOString(),
          },
          {
            id: 'ISS-103',
            propertyId: 'prop-pg-2',
            propertyName: 'Sai Durga Executive Ladies PG',
            roomNumber: '102',
            issueCategory: 'INTERNET',
            selectedOption: 'Wi-Fi Offline / No Internet',
            description: '1st floor router keeps disconnecting.',
            priority: 'HIGH',
            status: 'OPEN',
            reportedDate: new Date(Date.now() - 3600000 * 2).toISOString(),
          },
        ];
        setIssuesList(defaultIssues);
        await safeStorage.setItem('@staynest_maintenance_issues', JSON.stringify(defaultIssues));
      }
    } catch {
      // ignore
    }
  };

  const handleSelectCategory = (cat: IssueCategory) => {
    setSelectedCategory(cat);
    setShowCategoryDropdown(false);
    // Auto-select first option of that category
    if (CATEGORY_CONFIGS[cat]?.options?.length > 0) {
      setSelectedOption(CATEGORY_CONFIGS[cat].options[0]);
    }
  };

  const handleLogIssue = async () => {
    if (!selectedOption.trim()) {
      Alert.alert('Required', 'Please select a specific issue option.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedProp = properties.find((p) => p.id === selectedPropertyId);
      const propName = selectedProp?.name || "StayNest Elite Men's PG";

      const newIssue: MaintenanceIssue = {
        id: `ISS-${Date.now().toString().slice(-4)}`,
        propertyId: selectedPropertyId,
        propertyName: propName,
        roomNumber: roomNumber.trim() || 'Common Area',
        issueCategory: selectedCategory,
        selectedOption: selectedOption,
        description: customDescription.trim() || undefined,
        priority: priority,
        status: 'OPEN',
        reportedDate: new Date().toISOString(),
      };

      const updated = [newIssue, ...issuesList];
      setIssuesList(updated);
      await safeStorage.setItem('@staynest_maintenance_issues', JSON.stringify(updated));

      const alertMsg = `Issue #${newIssue.id} logged for ${propName} (Room ${newIssue.roomNumber}). Assigned to maintenance team!`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`✓ ${alertMsg}`);
      } else {
        Alert.alert('✓ Issue Logged Successfully', alertMsg);
      }

      setCustomDescription('');
      setActiveTab('HISTORY');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not log issue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
    const updated = issuesList.map((item) => {
      if (item.id === issueId) {
        return {
          ...item,
          status: newStatus,
          resolvedDate: newStatus === 'RESOLVED' ? new Date().toISOString() : undefined,
        };
      }
      return item;
    });
    setIssuesList(updated);
    await safeStorage.setItem('@staynest_maintenance_issues', JSON.stringify(updated));
  };

  const currentPropObj = properties.find((p) => p.id === selectedPropertyId) || properties[0];
  const currentConfig = CATEGORY_CONFIGS[selectedCategory];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>🛠️ Maintenance & Issues</Text>
            <Text style={styles.headerSub}>PG Complaint Management</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeRoundBtn} activeOpacity={0.7}>
            <Text style={styles.closeRoundBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher: + Log Issue vs. History */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'NEW_ISSUE' && styles.tabItemActive]}
            onPress={() => setActiveTab('NEW_ISSUE')}
          >
            <Text style={[styles.tabText, activeTab === 'NEW_ISSUE' && styles.tabTextActive]}>
              + Log New Issue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'HISTORY' && styles.tabItemActive]}
            onPress={() => setActiveTab('HISTORY')}
          >
            <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>
              📋 Active Issues ({issuesList.filter((i) => i.status !== 'RESOLVED').length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'NEW_ISSUE' ? (
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 56 }} keyboardShouldPersistTaps="handled">
            {/* 1. Property Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                🏢 1. Select PG Property <Text style={{ color: '#dc2626' }}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowPropertyDropdown(!showPropertyDropdown)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownSelectedText}>
                    {currentPropObj?.name || 'Select Property'}
                  </Text>
                  <Text style={styles.dropdownSubText}>
                    {currentPropObj?.addressLine || currentPropObj?.cityName || 'Vijayawada'}
                  </Text>
                </View>
                <Text style={styles.dropdownArrow}>{showPropertyDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showPropertyDropdown && (
                <View style={styles.dropdownMenu}>
                  {properties.map((p) => {
                    const isSelected = p.id === selectedPropertyId;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemActive]}
                        onPress={() => {
                          setSelectedPropertyId(p.id);
                          setShowPropertyDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownMenuText, isSelected && { color: '#ea580c', fontWeight: '800' }]}>
                          🏢 {p.name}
                        </Text>
                        <Text style={styles.dropdownMenuSubText}>
                          {p.addressLine || p.cityName} • {p.genderPolicy || 'PG'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 2. Room / Location Input */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>📍 Room Number or Location</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 101, 204, Kitchen, Corridor, Terrace"
                placeholderTextColor="#94a3b8"
                value={roomNumber}
                onChangeText={setRoomNumber}
              />
            </View>

            {/* 3. Issue Type Category Dropdown */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                🏷️ 2. Select Issue Category <Text style={{ color: '#dc2626' }}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.dropdownTrigger, { borderColor: currentConfig.badgeColor }]}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>{currentConfig.icon}</Text>
                  <Text style={[styles.dropdownSelectedText, { color: '#0f172a' }]}>
                    {currentConfig.headline}
                  </Text>
                </View>
                <Text style={styles.dropdownArrow}>{showCategoryDropdown ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={styles.dropdownMenu}>
                  {(Object.keys(CATEGORY_CONFIGS) as IssueCategory[]).map((catKey) => {
                    const cfg = CATEGORY_CONFIGS[catKey];
                    const isSelected = catKey === selectedCategory;
                    return (
                      <TouchableOpacity
                        key={catKey}
                        style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemActive]}
                        onPress={() => handleSelectCategory(catKey)}
                      >
                        <Text style={[styles.dropdownMenuText, isSelected && { color: cfg.badgeColor, fontWeight: '800' }]}>
                          {cfg.headline}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 4. THE SPECIFIC OPTIONS BOX (USER REQUIREMENT) */}
            <View style={[styles.optionsOuterBox, { borderColor: '#fb923c' }]}>
              <View style={[styles.optionsBoxHeader, { backgroundColor: currentConfig.bgTint }]}>
                <Text style={styles.optionsBoxTitle}>{currentConfig.headline}</Text>
                <Text style={styles.optionsBoxSub}>
                  Select the specific issue from the options below:
                </Text>
              </View>

              <View style={styles.optionsChipsContainer}>
                {currentConfig.options.map((opt) => {
                  const isChosen = selectedOption === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.optionChip,
                        isChosen && styles.optionChipSelected,
                      ]}
                      onPress={() => setSelectedOption(opt)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.optionRadioCircle}>
                        {isChosen ? (
                          <View style={styles.optionRadioInner} />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.optionChipText,
                          isChosen && styles.optionChipTextSelected,
                        ]}
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. Priority Selector */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>⚡ Urgency / Priority</Text>
              <View style={styles.priorityRow}>
                {[
                  { key: 'LOW', label: '🟢 Low', color: '#16a34a', bg: '#f0fdf4' },
                  { key: 'MEDIUM', label: '🟡 Medium', color: '#d97706', bg: '#fffbeb' },
                  { key: 'HIGH', label: '🔴 Urgent / High', color: '#dc2626', bg: '#fef2f2' },
                ].map((p) => {
                  const isPActive = priority === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[
                        styles.priorityPill,
                        isPActive && { borderColor: p.color, backgroundColor: p.bg, borderWidth: 2 },
                      ]}
                      onPress={() => setPriority(p.key as any)}
                    >
                      <Text
                        style={[
                          styles.priorityPillText,
                          isPActive && { color: p.color, fontWeight: '800' },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 6. Additional Details Input */}
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>📝 Notes / Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Mention any extra details (e.g. resident name, specific corner, preferred repair time)..."
                placeholderTextColor="#94a3b8"
                multiline
                value={customDescription}
                onChangeText={setCustomDescription}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleLogIssue}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? 'Logging Issue...' : '✓ Submit & Log Issue'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* HISTORY & TRACKING TAB */
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
            {issuesList.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🎉</Text>
                <Text style={styles.emptyTitle}>No Issues Logged</Text>
                <Text style={styles.emptySub}>All facilities and rooms are operating smoothly!</Text>
              </View>
            ) : (
              issuesList.map((item) => {
                const cfg = CATEGORY_CONFIGS[item.issueCategory] || CATEGORY_CONFIGS.OTHER;
                const isResolved = item.status === 'RESOLVED';
                return (
                  <View key={item.id} style={styles.issueHistoryCard}>
                    <View style={styles.issueCardTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                        <Text style={styles.issueCardId}>{item.id}</Text>
                        <Text style={styles.issueCardProp}>• {item.propertyName}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          item.status === 'RESOLVED' && { backgroundColor: '#dcfce7' },
                          item.status === 'IN_PROGRESS' && { backgroundColor: '#fef3c7' },
                          item.status === 'OPEN' && { backgroundColor: '#fee2e2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            item.status === 'RESOLVED' && { color: '#15803d' },
                            item.status === 'IN_PROGRESS' && { color: '#b45309' },
                            item.status === 'OPEN' && { color: '#b91c1c' },
                          ]}
                        >
                          {item.status.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.issueCardTitle}>{item.selectedOption}</Text>
                    <Text style={styles.issueCardMeta}>
                      📍 Room {item.roomNumber || 'General Area'} • Priority:{' '}
                      <Text
                        style={{
                          fontWeight: '800',
                          color:
                            item.priority === 'HIGH'
                              ? '#dc2626'
                              : item.priority === 'MEDIUM'
                              ? '#d97706'
                              : '#16a34a',
                        }}
                      >
                        {item.priority}
                      </Text>
                    </Text>

                    {item.description ? (
                      <Text style={styles.issueCardDesc}>"{item.description}"</Text>
                    ) : null}

                    {/* Status Action Buttons */}
                    <View style={styles.issueCardActions}>
                      {!isResolved ? (
                        <>
                          {item.status === 'OPEN' && (
                            <TouchableOpacity
                              style={[styles.actionBtn, { backgroundColor: '#fef3c7', borderColor: '#fde047' }]}
                              onPress={() => handleStatusChange(item.id, 'IN_PROGRESS')}
                            >
                              <Text style={[styles.actionBtnText, { color: '#854d0e' }]}>
                                ⏳ Mark In Progress
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}
                            onPress={() => handleStatusChange(item.id, 'RESOLVED')}
                          >
                            <Text style={[styles.actionBtnText, { color: '#166534' }]}>
                              ✓ Mark Fixed
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '700' }}>
                            ✓ Resolved
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleStatusChange(item.id, 'OPEN')}
                          >
                            <Text style={{ fontSize: 11, color: '#64748b', textDecorationLine: 'underline' }}>
                              Reopen
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 14,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeRoundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeRoundBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#ea580c',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  dropdownSelectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#64748b',
  },
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownMenuItemActive: {
    backgroundColor: '#fff7ed',
  },
  dropdownMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownMenuSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  // The Specific Box with Headline (User specification)
  optionsOuterBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 16,
    overflow: 'hidden',
  },
  optionsBoxHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
  },
  optionsBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  optionsBoxSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  optionsChipsContainer: {
    padding: 10,
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionChipSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
    borderWidth: 1.5,
  },
  optionRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ea580c',
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  optionChipTextSelected: {
    color: '#c2410c',
    fontWeight: '700',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityPill: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  priorityPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  // History tab styles
  issueHistoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  issueCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  issueCardId: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
  },
  issueCardProp: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  issueCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  issueCardMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  issueCardDesc: {
    fontSize: 12,
    color: '#334155',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  issueCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginTop: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
