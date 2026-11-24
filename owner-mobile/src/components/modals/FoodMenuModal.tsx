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
} from 'react-native';
import { Property, DailyFoodMenu } from '../../types';
import { safeStorage } from '../../utils/safeStorage';

interface FoodMenuModalProps {
  visible: boolean;
  onClose: () => void;
  properties: Property[];
  initialPropertyId?: string;
}

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DEFAULT_WEEKLY_MENU: Record<DayOfWeek, DailyFoodMenu> = {
  Monday: {
    breakfast: 'Idli, Medu Vada, Coconut Chutney, Hot Sambar & Filter Coffee',
    lunch: 'Steamed Rice, Dal Tadka, Aloo Gobi Masala, Curd, Roasted Papad & Pickle',
    snacks: 'Crispy Onion Pakoda & Masala Chai',
    dinner: 'Soft Phulkas / Rotis, Paneer Butter Masala, Jeera Rice, Rasam & Gulab Jamun',
  },
  Tuesday: {
    breakfast: 'Masala Dosa, Tomato Chutney, Sambar & Tea / Coffee',
    lunch: 'Steamed Rice, Tomato Dal, Bhindi Fry, Sambar, Fresh Curd & Appalam',
    snacks: 'Hot Veg Samosa & Ginger Tea',
    dinner: 'Chapati, Mixed Veg Korma, Veg Pulao, Curd & Fresh Cut Fruits',
  },
  Wednesday: {
    breakfast: 'Puri with Potato Masala / Aloo Bhaji, Chutney & Filter Coffee',
    lunch: 'Rice, Andhra Dal, Egg Curry / Paneer Curry, Rasam & Curd',
    snacks: 'Sweet Corn Chaat & Cardamom Tea',
    dinner: 'Phulkas, Chicken Curry (Special) / Malai Kofta, Biryani Rice & Ice Cream',
  },
  Thursday: {
    breakfast: 'Poha with Roasted Peanuts, Sev, Green Chutney & Tea',
    lunch: 'Steamed Rice, Palak Dal, Capsicum Paneer, Tomato Rasam & Curd',
    snacks: 'Mirchi Bajji & Irani Chai',
    dinner: 'Rotis, Dal Makhani, Peas Pulao, Curd & Rice Kheer',
  },
  Friday: {
    breakfast: 'Uttapam / Set Dosa, Coconut & Peanut Chutney, Sambar & Coffee',
    lunch: 'Steamed Rice, Kadi Pakoda, Cabbage Poriyal, Garlic Rasam & Curd',
    snacks: 'Bhel Puri / Sev Puri & Hot Tea',
    dinner: 'Phulkas, Shahi Paneer, Dum Aloo, Fried Rice & Fruit Custard',
  },
  Saturday: {
    breakfast: 'Aloo Paratha with Fresh Curd, Butter & Green Chutney',
    lunch: 'Special Hyderabadi Veg Biryani / Chicken Dum Biryani, Mirchi Ka Salan, Raita',
    snacks: 'Crispy Aloo Bonda & Filter Coffee',
    dinner: 'Chapati, Chana Masala, Jeera Rice, Curd & Semiya Payasam',
  },
  Sunday: {
    breakfast: 'Mysore Bonda / Goli Baje, Allam Chutney & Hot Coffee',
    lunch: 'Sunday Feast: Bagara Rice, Special Chicken Fry / Mushroom Masala, Dalcha & Curd',
    snacks: 'Piping Hot Bun Maska & Irani Chai',
    dinner: 'Light Dinner: Khichdi with Kadhi / Rotis, Aloo Mutter, Curd & Sweet',
  },
};

export const FoodMenuModal: React.FC<FoodMenuModalProps> = ({
  visible,
  onClose,
  properties,
  initialPropertyId,
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    initialPropertyId || properties[0]?.id || 'prop-pg-1'
  );
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

  // Day selection
  const dayNames: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIndex = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(dayNames[todayIndex]);

  // Menu data & availability flag
  const [hasMenu, setHasMenu] = useState(false);
  const [weeklyMenu, setWeeklyMenu] = useState<Record<DayOfWeek, DailyFoodMenu>>(DEFAULT_WEEKLY_MENU);
  const [isEditing, setIsEditing] = useState(false);
  const [editBreakfast, setEditBreakfast] = useState('');
  const [editLunch, setEditLunch] = useState('');
  const [editSnacks, setEditSnacks] = useState('');
  const [editDinner, setEditDinner] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialPropertyId) {
      setSelectedPropertyId(initialPropertyId);
    }
  }, [initialPropertyId]);

  useEffect(() => {
    if (visible) {
      loadMenu();
    }
  }, [visible, selectedPropertyId]);

  useEffect(() => {
    const curr = weeklyMenu[selectedDay] || DEFAULT_WEEKLY_MENU[selectedDay];
    setEditBreakfast(curr.breakfast || '');
    setEditLunch(curr.lunch || '');
    setEditSnacks(curr.snacks || '');
    setEditDinner(curr.dinner || '');
  }, [selectedDay, weeklyMenu]);

  const loadMenu = async () => {
    try {
      const enabledKey = `@staynest_food_menu_enabled_${selectedPropertyId}`;
      const isEnabled = await safeStorage.getItem(enabledKey);
      setHasMenu(isEnabled === 'true');

      const menuKey = `@staynest_food_menu_${selectedPropertyId}`;
      const stored = await safeStorage.getItem(menuKey);
      if (stored) {
        setWeeklyMenu(JSON.parse(stored));
      } else {
        setWeeklyMenu(DEFAULT_WEEKLY_MENU);
      }
    } catch {
      setHasMenu(false);
      setWeeklyMenu(DEFAULT_WEEKLY_MENU);
    }
  };

  const handleSaveDayMenu = async () => {
    setSaving(true);
    try {
      const updated: Record<DayOfWeek, DailyFoodMenu> = {
        ...weeklyMenu,
        [selectedDay]: {
          breakfast: editBreakfast.trim(),
          lunch: editLunch.trim(),
          snacks: editSnacks.trim(),
          dinner: editDinner.trim(),
        },
      };
      setWeeklyMenu(updated);
      setHasMenu(true);

      const menuKey = `@staynest_food_menu_${selectedPropertyId}`;
      await safeStorage.setItem(menuKey, JSON.stringify(updated));

      const enabledKey = `@staynest_food_menu_enabled_${selectedPropertyId}`;
      await safeStorage.setItem(enabledKey, 'true');

      setIsEditing(false);
      const alertMsg = `✓ ${selectedDay}'s food menu published to Restaurant Book!`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(alertMsg);
      } else {
        Alert.alert('✓ Menu Published', alertMsg);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save menu');
    } finally {
      setSaving(false);
    }
  };

  const handleAutofillDefault = () => {
    const def = DEFAULT_WEEKLY_MENU[selectedDay];
    setEditBreakfast(def.breakfast);
    setEditLunch(def.lunch);
    setEditSnacks(def.snacks);
    setEditDinner(def.dinner);
  };

  const handleDisableMenu = async () => {
    try {
      const enabledKey = `@staynest_food_menu_enabled_${selectedPropertyId}`;
      await safeStorage.setItem(enabledKey, 'false');
      setHasMenu(false);
      setIsEditing(false);
      const alertMsg = 'Food menu disabled. PG will now show "No menu available".';
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(alertMsg);
      } else {
        Alert.alert('Menu Unpublished', alertMsg);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to disable menu');
    }
  };

  const currentPropObj = properties.find((p) => p.id === selectedPropertyId) || properties[0];
  const activeDayMenu = weeklyMenu[selectedDay] || DEFAULT_WEEKLY_MENU[selectedDay];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>📖 Restaurant Menu Book</Text>
            <Text style={styles.headerSub}>
              {hasMenu ? 'Everyday Homestyle Dining' : 'No Active Menu'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            style={[styles.editBtn, isEditing && { backgroundColor: '#fee2e2' }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.editBtnText, isEditing && { color: '#dc2626' }]}>
              {isEditing ? 'Cancel' : '✏️ Edit Menu'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Property Selector */}
        <View style={styles.propSelectorWrap}>
          <TouchableOpacity
            style={styles.propSelectorBtn}
            onPress={() => setShowPropertyDropdown(!showPropertyDropdown)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 18 }}>🏢</Text>
              <Text style={styles.propNameText}>{currentPropObj?.name || 'StayNest PG'}</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#64748b' }}>
              {showPropertyDropdown ? '▲' : '▼ Switch PG'}
            </Text>
          </TouchableOpacity>

          {showPropertyDropdown && (
            <View style={styles.propDropdownMenu}>
              {properties.map((p) => {
                const isSelected = p.id === selectedPropertyId;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.propDropdownItem, isSelected && styles.propDropdownItemActive]}
                    onPress={() => {
                      setSelectedPropertyId(p.id);
                      setShowPropertyDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.propDropdownText,
                        isSelected && { color: '#ea580c', fontWeight: '800' },
                      ]}
                    >
                      🏢 {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ─── CASE A: NO MENU AVAILABLE (AND NOT IN EDIT MODE) ─── */}
        {!hasMenu && !isEditing ? (
          <View style={styles.noMenuContainer}>
            <View style={styles.menuBookCover}>
              {/* Gold Filigree & Header */}
              <View style={styles.coverGoldBorder}>
                <View style={styles.coverIconCircle}>
                  <Text style={{ fontSize: 44 }}>📖</Text>
                </View>
                <Text style={styles.coverTitle}>StayNest Dining Book</Text>
                <View style={styles.coverDivider}>
                  <Text style={styles.coverDividerStar}>✦ ✦ ✦</Text>
                </View>
                <Text style={styles.noMenuHeading}>No Menu Available</Text>
                <Text style={styles.noMenuDescription}>
                  A daily food schedule has not been published for this PG yet. When you add a menu, it will be showcased here in restaurant book style for residents to view everyday.
                </Text>

                <TouchableOpacity
                  style={styles.setupMenuBtn}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.setupMenuBtnText}>✏️ Set Up & Edit Menu</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          /* ─── CASE B & C: ACTIVE RESTAURANT BOOK OR EDITING MODE ─── */
          <View style={{ flex: 1 }}>
            {/* Silk Ribbon Bookmark Day Selector */}
            <View style={styles.ribbonContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ribbonScroll}
              >
                {DAYS_OF_WEEK.map((d) => {
                  const isSel = selectedDay === d;
                  const isToday = d === dayNames[todayIndex];
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.ribbonTab,
                        isSel && styles.ribbonTabActive,
                        isToday && !isSel && styles.ribbonTabToday,
                      ]}
                      onPress={() => setSelectedDay(d)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.ribbonTabText,
                          isSel && styles.ribbonTabTextActive,
                          isToday && !isSel && { color: '#b45309', fontWeight: '800' },
                        ]}
                      >
                        {d.slice(0, 3)}
                      </Text>
                      {isToday && (
                        <View style={[styles.ribbonDot, isSel && { backgroundColor: '#fef08a' }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Restaurant Book Content Body */}
            <ScrollView style={styles.bookBody} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={styles.restaurantBookPage}>
                {/* Book Header / Page Title */}
                <View style={styles.bookPageHeader}>
                  <View style={styles.bookHeaderCornerLeft}>
                    <Text style={styles.filigreeText}>⚜️</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.bookDayTitle}>{selectedDay.toUpperCase()}</Text>
                    <Text style={styles.bookCuisineSubtitle}>
                      {selectedDay === dayNames[todayIndex]
                        ? '🌟 SERVING TODAY • HOMESTYLE PG DINING'
                        : 'HOMESTYLE PG CATERING SCHEDULE'}
                    </Text>
                  </View>
                  <View style={styles.bookHeaderCornerRight}>
                    <Text style={styles.filigreeText}>⚜️</Text>
                  </View>
                </View>

                <View style={styles.bookOrnamentalLine} />

                {/* 1. MORNING BREAKFAST */}
                <View style={styles.courseSection}>
                  <View style={styles.courseHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 18 }}>🌅</Text>
                      <Text style={styles.courseTitle}>Morning Breakfast</Text>
                    </View>
                    <View style={styles.courseTimeBadge}>
                      <Text style={styles.courseTimeText}>7:30 AM – 9:30 AM</Text>
                    </View>
                  </View>
                  <View style={styles.dietBadgeRow}>
                    <Text style={styles.dietBadgeGreen}>🟢 Pure Veg Homestyle</Text>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={styles.courseInput}
                      value={editBreakfast}
                      onChangeText={setEditBreakfast}
                      multiline
                      placeholder="e.g. Idli, Medu Vada, Sambar & Filter Coffee"
                    />
                  ) : (
                    <Text style={styles.dishNamesText}>
                      {activeDayMenu.breakfast || 'No dishes scheduled'}
                    </Text>
                  )}
                </View>

                <View style={styles.courseDivider} />

                {/* 2. AFTERNOON LUNCH */}
                <View style={styles.courseSection}>
                  <View style={styles.courseHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 18 }}>🍛</Text>
                      <Text style={styles.courseTitle}>Afternoon Lunch</Text>
                    </View>
                    <View style={styles.courseTimeBadge}>
                      <Text style={styles.courseTimeText}>12:30 PM – 2:30 PM</Text>
                    </View>
                  </View>
                  <View style={styles.dietBadgeRow}>
                    <Text style={styles.dietBadgeGreen}>🥗 Traditional Full Thali</Text>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={styles.courseInput}
                      value={editLunch}
                      onChangeText={setEditLunch}
                      multiline
                      placeholder="e.g. Steamed Rice, Dal Tadka, Paneer Masala, Curd & Papad"
                    />
                  ) : (
                    <Text style={styles.dishNamesText}>
                      {activeDayMenu.lunch || 'No dishes scheduled'}
                    </Text>
                  )}
                </View>

                <View style={styles.courseDivider} />

                {/* 3. HIGH TEA & EVENING SNACKS */}
                <View style={styles.courseSection}>
                  <View style={styles.courseHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 18 }}>☕</Text>
                      <Text style={styles.courseTitle}>High Tea & Snacks</Text>
                    </View>
                    <View style={styles.courseTimeBadge}>
                      <Text style={styles.courseTimeText}>5:00 PM – 6:30 PM</Text>
                    </View>
                  </View>
                  <View style={styles.dietBadgeRow}>
                    <Text style={styles.dietBadgeOrange}>☕ Fresh Brew & Crisps</Text>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={styles.courseInput}
                      value={editSnacks}
                      onChangeText={setEditSnacks}
                      multiline
                      placeholder="e.g. Crispy Onion Pakoda & Masala Chai"
                    />
                  ) : (
                    <Text style={styles.dishNamesText}>
                      {activeDayMenu.snacks || 'No dishes scheduled'}
                    </Text>
                  )}
                </View>

                <View style={styles.courseDivider} />

                {/* 4. NIGHT DINNER */}
                <View style={styles.courseSection}>
                  <View style={styles.courseHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 18 }}>🌙</Text>
                      <Text style={styles.courseTitle}>Night Dinner</Text>
                    </View>
                    <View style={styles.courseTimeBadge}>
                      <Text style={styles.courseTimeText}>7:30 PM – 10:00 PM</Text>
                    </View>
                  </View>
                  <View style={styles.dietBadgeRow}>
                    <Text style={styles.dietBadgePurple}>🍲 Chef's Warm Dinner</Text>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={styles.courseInput}
                      value={editDinner}
                      onChangeText={setEditDinner}
                      multiline
                      placeholder="e.g. Soft Phulkas, Paneer Butter Masala, Jeera Rice & Sweet"
                    />
                  ) : (
                    <Text style={styles.dishNamesText}>
                      {activeDayMenu.dinner || 'No dishes scheduled'}
                    </Text>
                  )}
                </View>

                <View style={styles.bookOrnamentalLine} />

                {/* Edit Mode Quick Tools & Actions */}
                {isEditing ? (
                  <View style={styles.editControlsWrap}>
                    <TouchableOpacity
                      style={styles.autofillBtn}
                      onPress={handleAutofillDefault}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.autofillBtnText}>✨ Fill Recommended PG Menu</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveMenuBtn}
                      onPress={handleSaveDayMenu}
                      disabled={saving}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.saveMenuBtnText}>
                        {saving ? 'Publishing...' : `✓ Save & Publish ${selectedDay}'s Menu`}
                      </Text>
                    </TouchableOpacity>

                    {hasMenu && (
                      <TouchableOpacity
                        style={styles.disableMenuBtn}
                        onPress={handleDisableMenu}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.disableMenuBtnText}>
                          🗑️ Mark No Menu Available for This PG
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={styles.viewModeActionRow}>
                    <TouchableOpacity
                      style={styles.editThisDayBtn}
                      onPress={() => setIsEditing(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.editThisDayBtnText}>✏️ Edit {selectedDay}'s Menu</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.unpublishBtn}
                      onPress={handleDisableMenu}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.unpublishBtnText}>🚫 Unpublish (Show No Menu)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1917', // Dark restaurant book ambience
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 14,
    backgroundColor: '#292524',
    borderBottomWidth: 1,
    borderBottomColor: '#44403c',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#44403c',
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e7e5e4',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fef08a',
  },
  headerSub: {
    fontSize: 11,
    color: '#a8a29e',
    marginTop: 2,
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#d97706',
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  propSelectorWrap: {
    backgroundColor: '#292524',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#44403c',
  },
  propSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c1917',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#78350f',
  },
  propNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fef3c7',
  },
  propDropdownMenu: {
    backgroundColor: '#292524',
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#78350f',
    overflow: 'hidden',
  },
  propDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#44403c',
  },
  propDropdownItemActive: {
    backgroundColor: '#451a03',
  },
  propDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e7e5e4',
  },

  // ─── NO MENU EMPTY STATE (RESTAURANT COVER) ───
  noMenuContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#1c1917',
  },
  menuBookCover: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#2d1810',
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: '#d4af37',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  coverGoldBorder: {
    borderWidth: 1.5,
    borderColor: '#b45309',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  coverIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#451a03',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d4af37',
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#d4af37',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  coverDivider: {
    marginVertical: 10,
  },
  coverDividerStar: {
    color: '#f59e0b',
    fontSize: 14,
    letterSpacing: 6,
  },
  noMenuHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  noMenuDescription: {
    fontSize: 13,
    color: '#d6d3d1',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  setupMenuBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#ea580c',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  setupMenuBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },

  // ─── BOOKMARK RIBBONS (DAYS OF WEEK) ───
  ribbonContainer: {
    backgroundColor: '#292524',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#44403c',
  },
  ribbonScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  ribbonTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#44403c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#78350f',
  },
  ribbonTabActive: {
    backgroundColor: '#b45309',
    borderColor: '#fde047',
  },
  ribbonTabToday: {
    backgroundColor: '#451a03',
    borderColor: '#ea580c',
  },
  ribbonTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d6d3d1',
  },
  ribbonTabTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  ribbonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ea580c',
    marginTop: 2,
  },

  // ─── RESTAURANT BOOK PAGE ───
  bookBody: {
    flex: 1,
    padding: 14,
  },
  restaurantBookPage: {
    backgroundColor: '#fffdf9', // Warm ivory parchment
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#d4af37', // Gold trimmed restaurant menu book
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  bookPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  bookHeaderCornerLeft: {
    width: 24,
  },
  bookHeaderCornerRight: {
    width: 24,
    alignItems: 'flex-end',
  },
  filigreeText: {
    fontSize: 16,
    color: '#b45309',
  },
  bookDayTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#451a03',
    letterSpacing: 2,
  },
  bookCuisineSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 1,
    marginTop: 2,
  },
  bookOrnamentalLine: {
    height: 1,
    backgroundColor: '#fde68a',
    marginVertical: 12,
  },

  // ─── COURSE SECTIONS ───
  courseSection: {
    paddingVertical: 6,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#292524',
  },
  courseTimeBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  courseTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
  },
  dietBadgeRow: {
    marginBottom: 6,
  },
  dietBadgeGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  dietBadgeOrange: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c2410c',
  },
  dietBadgePurple: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7e22ce',
  },
  dishNamesText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#44403c',
    fontWeight: '600',
  },
  courseDivider: {
    height: 1,
    backgroundColor: '#f5f5f4',
    marginVertical: 10,
  },
  courseInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1c1917',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    minHeight: 56,
    textAlignVertical: 'top',
  },

  // ─── EDIT & VIEW ACTION CONTROLS ───
  editControlsWrap: {
    marginTop: 14,
    gap: 10,
  },
  autofillBtn: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  autofillBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  saveMenuBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveMenuBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  disableMenuBtn: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  disableMenuBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  viewModeActionRow: {
    marginTop: 14,
    gap: 10,
  },
  editThisDayBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editThisDayBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  unpublishBtn: {
    backgroundColor: '#f5f5f4',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  unpublishBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78716c',
  },
});
