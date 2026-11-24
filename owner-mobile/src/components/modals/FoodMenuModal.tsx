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

  // Current day selection
  const dayNames: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIndex = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(dayNames[todayIndex]);

  // Menu data
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
    setEditBreakfast(curr.breakfast);
    setEditLunch(curr.lunch);
    setEditSnacks(curr.snacks);
    setEditDinner(curr.dinner);
  }, [selectedDay, weeklyMenu]);

  const loadMenu = async () => {
    try {
      const key = `@staynest_food_menu_${selectedPropertyId}`;
      const stored = await safeStorage.getItem(key);
      if (stored) {
        setWeeklyMenu(JSON.parse(stored));
      } else {
        setWeeklyMenu(DEFAULT_WEEKLY_MENU);
      }
    } catch {
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
      const key = `@staynest_food_menu_${selectedPropertyId}`;
      await safeStorage.setItem(key, JSON.stringify(updated));

      setIsEditing(false);
      const alertMsg = `✓ ${selectedDay}'s food menu updated successfully!`;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(alertMsg);
      } else {
        Alert.alert('✓ Menu Saved', alertMsg);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save menu');
    } finally {
      setSaving(false);
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
            <Text style={styles.headerTitle}>🍲 PG Food Menu</Text>
            <Text style={styles.headerSub}>Weekly Meals & Timings</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                setIsEditing(false);
              } else {
                setIsEditing(true);
              }
            }}
            style={[styles.editBtn, isEditing && { backgroundColor: '#fee2e2' }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.editBtnText, isEditing && { color: '#dc2626' }]}>
              {isEditing ? 'Cancel' : '✏️ Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 1. Property Selector */}
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

        {/* 2. Days of Week Selector Bar */}
        <View style={styles.daysScrollWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysContainer}
          >
            {DAYS_OF_WEEK.map((d) => {
              const isSel = selectedDay === d;
              const isToday = d === dayNames[todayIndex];
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.dayPill,
                    isSel && styles.dayPillActive,
                    isToday && !isSel && styles.dayPillToday,
                  ]}
                  onPress={() => {
                    setSelectedDay(d);
                    setIsEditing(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      isSel && styles.dayPillTextActive,
                      isToday && !isSel && { color: '#ea580c', fontWeight: '800' },
                    ]}
                  >
                    {d.slice(0, 3)}
                  </Text>
                  {isToday ? <View style={styles.todayDot} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.dayBanner}>
            <View>
              <Text style={styles.dayBannerTitle}>{selectedDay}'s Menu</Text>
              <Text style={styles.dayBannerSub}>
                {selectedDay === dayNames[todayIndex] ? '🌟 Serving Today' : 'Scheduled Meals'}
              </Text>
            </View>
            <View style={styles.foodTag}>
              <Text style={styles.foodTagText}>🥗 100% Homestyle</Text>
            </View>
          </View>

          {/* MEAL 1: Breakfast */}
          <View style={[styles.mealCard, { borderColor: '#fde047' }]}>
            <View style={[styles.mealCardHeader, { backgroundColor: '#fefce8' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 20 }}>🌅</Text>
                <Text style={styles.mealTitle}>Breakfast</Text>
              </View>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>7:30 AM - 9:30 AM</Text>
              </View>
            </View>
            <View style={styles.mealCardBody}>
              {isEditing ? (
                <TextInput
                  style={styles.editMealInput}
                  value={editBreakfast}
                  onChangeText={setEditBreakfast}
                  multiline
                  placeholder="Enter breakfast items..."
                />
              ) : (
                <Text style={styles.mealItemsText}>{activeDayMenu.breakfast}</Text>
              )}
            </View>
          </View>

          {/* MEAL 2: Lunch */}
          <View style={[styles.mealCard, { borderColor: '#fdba74' }]}>
            <View style={[styles.mealCardHeader, { backgroundColor: '#fff7ed' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 20 }}>☀️</Text>
                <Text style={styles.mealTitle}>Lunch</Text>
              </View>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>12:30 PM - 2:30 PM</Text>
              </View>
            </View>
            <View style={styles.mealCardBody}>
              {isEditing ? (
                <TextInput
                  style={styles.editMealInput}
                  value={editLunch}
                  onChangeText={setEditLunch}
                  multiline
                  placeholder="Enter lunch items..."
                />
              ) : (
                <Text style={styles.mealItemsText}>{activeDayMenu.lunch}</Text>
              )}
            </View>
          </View>

          {/* MEAL 3: Evening Snacks & Tea */}
          <View style={[styles.mealCard, { borderColor: '#fbcfe8' }]}>
            <View style={[styles.mealCardHeader, { backgroundColor: '#fdf2f8' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 20 }}>☕</Text>
                <Text style={styles.mealTitle}>Evening Snacks & Tea</Text>
              </View>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>5:00 PM - 6:30 PM</Text>
              </View>
            </View>
            <View style={styles.mealCardBody}>
              {isEditing ? (
                <TextInput
                  style={styles.editMealInput}
                  value={editSnacks}
                  onChangeText={setEditSnacks}
                  multiline
                  placeholder="Enter snacks items..."
                />
              ) : (
                <Text style={styles.mealItemsText}>{activeDayMenu.snacks}</Text>
              )}
            </View>
          </View>

          {/* MEAL 4: Dinner */}
          <View style={[styles.mealCard, { borderColor: '#c7d2fe' }]}>
            <View style={[styles.mealCardHeader, { backgroundColor: '#eef2ff' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 20 }}>🌙</Text>
                <Text style={styles.mealTitle}>Dinner</Text>
              </View>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>7:30 PM - 9:30 PM</Text>
              </View>
            </View>
            <View style={styles.mealCardBody}>
              {isEditing ? (
                <TextInput
                  style={styles.editMealInput}
                  value={editDinner}
                  onChangeText={setEditDinner}
                  multiline
                  placeholder="Enter dinner items..."
                />
              ) : (
                <Text style={styles.mealItemsText}>{activeDayMenu.dinner}</Text>
              )}
            </View>
          </View>

          {/* Save Button in Edit Mode */}
          {isEditing && (
            <TouchableOpacity
              style={styles.saveMenuBtn}
              onPress={handleSaveDayMenu}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.saveMenuBtnText}>
                {saving ? 'Saving...' : `✓ Save ${selectedDay}'s Menu`}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
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
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
  },
  propSelectorWrap: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  propSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  propNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  propDropdownMenu: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
  },
  propDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  propDropdownItemActive: {
    backgroundColor: '#fff7ed',
  },
  propDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  daysScrollWrapper: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  daysContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  dayPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayPillActive: {
    backgroundColor: '#ea580c',
  },
  dayPillToday: {
    borderWidth: 1.5,
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  dayPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    marginTop: 2,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  dayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#fb923c',
  },
  dayBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  dayBannerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  foodTag: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  foodTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
  },
  mealCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  timeBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  mealCardBody: {
    padding: 14,
  },
  mealItemsText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
    fontWeight: '600',
  },
  editMealInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveMenuBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
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
});
