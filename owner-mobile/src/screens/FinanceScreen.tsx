import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { apiClient } from '../api/client';
import { RentInvoice, Expense, Property } from '../types';

interface FinanceScreenProps {
  onBack: () => void;
}

interface FixedMonthlyBill {
  id: string;
  title: string;
  category: string;
  monthlyAmount: number;
  icon: string;
  isPaidThisMonth: boolean;
  dueDate: string;
}

interface MonthlyPnlRecord {
  id: string;
  month: string;
  short: string;
  year: string;
  revenue: number;
  expense: number;
  profit: number;
  isGain: boolean;
  notes?: string;
  isCustom?: boolean;
}

export const FinanceScreen: React.FC<FinanceScreenProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Selected Billing Month Filter
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [timeframeMode, setTimeframeMode] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Log Expense Form State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState('ELECTRICITY');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Edit Expense State (Requirement 4: Recent expenses editable after entering)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Fixed Monthly Operating Bills (Requirement 4: Mandatory recurring PG bills)
  const [fixedBills, setFixedBills] = useState<FixedMonthlyBill[]>([
    {
      id: 'fix-1',
      title: 'Building Monthly Lease Rent',
      category: 'BUILDING_RENT',
      monthlyAmount: 60000,
      icon: '🏢',
      isPaidThisMonth: true,
      dueDate: '1st of month',
    },
    {
      id: 'fix-2',
      title: 'Cook & Kitchen Staff Salary',
      category: 'SALARY',
      monthlyAmount: 25000,
      icon: '👨‍🍳',
      isPaidThisMonth: true,
      dueDate: '5th of month',
    },
    {
      id: 'fix-3',
      title: 'Cleaning & Housekeeping Staff',
      category: 'SALARY',
      monthlyAmount: 12000,
      icon: '🧹',
      isPaidThisMonth: true,
      dueDate: '5th of month',
    },
    {
      id: 'fix-4',
      title: 'Commercial Electricity (BESCOM)',
      category: 'UTILITIES',
      monthlyAmount: 18000,
      icon: '⚡',
      isPaidThisMonth: false,
      dueDate: '10th of month',
    },
    {
      id: 'fix-5',
      title: 'Water Tanker & Supply',
      category: 'UTILITIES',
      monthlyAmount: 8000,
      icon: '💧',
      isPaidThisMonth: false,
      dueDate: 'Every Monday',
    },
    {
      id: 'fix-6',
      title: 'High-Speed Commercial Wi-Fi',
      category: 'INTERNET',
      monthlyAmount: 3500,
      icon: '📶',
      isPaidThisMonth: true,
      dueDate: '15th of month',
    },
    {
      id: 'fix-7',
      title: 'Security CCTV & Maintenance',
      category: 'MAINTENANCE',
      monthlyAmount: 5000,
      icon: '🛡️',
      isPaidThisMonth: false,
      dueDate: '20th of month',
    },
  ]);

  // Historical P&L Past Month Tracking (Requirement 1: Add/Track Previous Year & Month P&L)
  const [showAddPastMonthModal, setShowAddPastMonthModal] = useState(false);
  const [selectedPnlYear, setSelectedPnlYear] = useState<'ALL' | '2026' | '2025' | '2024'>('2026');
  const [selectedBarMonth, setSelectedBarMonth] = useState<string | null>('Nov 2026');
  const [pastMonthChoice, setPastMonthChoice] = useState('Oct');
  const [pastYearChoice, setPastYearChoice] = useState('2025');
  const [pastRevenueInput, setPastRevenueInput] = useState('');
  const [pastExpenseInput, setPastExpenseInput] = useState('');
  const [pastNotesInput, setPastNotesInput] = useState('');
  const [customPastMonths, setCustomPastMonths] = useState<MonthlyPnlRecord[]>([
    {
      id: 'hist-2025-12',
      month: 'Dec 2025',
      short: 'Dec',
      year: '2025',
      revenue: 185000,
      expense: 139000,
      profit: 46000,
      isGain: true,
      notes: 'Winter admissions surge',
      isCustom: true,
    },
    {
      id: 'hist-2025-11',
      month: 'Nov 2025',
      short: 'Nov',
      year: '2025',
      revenue: 178000,
      expense: 142000,
      profit: 36000,
      isGain: true,
      notes: 'Festive baseline operational month',
      isCustom: true,
    },
  ]);

  // Standard Templates for Quick Logging
  const STANDARD_EXPENSES = [
    { label: '🏢 Building Rent', category: 'BUILDING_RENT', defaultTitle: 'Building Monthly Rent', defaultAmount: '60000' },
    { label: '👷 Workers Salary', category: 'SALARY', defaultTitle: 'Cook & Staff Salary', defaultAmount: '25000' },
    { label: '🥦 Daily Groceries', category: 'GROCERIES', defaultTitle: 'Vegetables & Mess Groceries', defaultAmount: '4500' },
    { label: '⚡ Electricity Bill', category: 'UTILITIES', defaultTitle: 'BESCOM Electricity Bill', defaultAmount: '18000' },
    { label: '📶 Wi-Fi Bill', category: 'INTERNET', defaultTitle: 'Wi-Fi Broadband Bill', defaultAmount: '3500' },
    { label: '🔧 Repairs & Plumber', category: 'MAINTENANCE', defaultTitle: 'Plumbing & Electrical Repair', defaultAmount: '2200' },
  ];

  const handleSelectTemplate = (template: typeof STANDARD_EXPENSES[0]) => {
    setTitle(template.defaultTitle);
    setCategory(template.category);
    setAmountRupees(template.defaultAmount);
    setShowExpenseForm(true);
  };

  useEffect(() => {
    loadFinanceData();

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const handleExpenseAdded = () => loadFinanceData(true);
      window.addEventListener('staynest_expense_added', handleExpenseAdded);
      window.addEventListener('storage', handleExpenseAdded);
      return () => {
        window.removeEventListener('staynest_expense_added', handleExpenseAdded);
        window.removeEventListener('storage', handleExpenseAdded);
      };
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadFinanceData();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const loadFinanceData = async (silent = false) => {
    if (!silent && expenses.length === 0) setLoading(true);
    try {
      const [invRes, expRes, propRes] = await Promise.all([
        apiClient<{ content: RentInvoice[] }>('/owner/rent-invoices'),
        apiClient<{ content: Expense[] }>('/owner/expenses'),
        apiClient<{ content: Property[] }>('/owner/properties').catch(() => ({ content: [] })),
      ]);

      let loadedExpenses = expRes.content || [];

      // Check localStorage cached edits/additions
      if (typeof window !== 'undefined' && window.localStorage) {
        const cachedExp = window.localStorage.getItem('staynest_cached_expenses');
        if (cachedExp) {
          try {
            const parsed = JSON.parse(cachedExp);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loadedExpenses = parsed;
            }
          } catch {}
        }

        // Merge custom electricity and added expenses
        const customExp = window.localStorage.getItem('staynest_custom_expenses');
        if (customExp) {
          try {
            const parsedCustom = JSON.parse(customExp);
            if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
              const existingIds = new Set(loadedExpenses.map((e) => e.id));
              const newItems = parsedCustom.filter((e: any) => !existingIds.has(e.id));
              loadedExpenses = [...newItems, ...loadedExpenses];
            }
          } catch {}
        }

        const cachedBills = window.localStorage.getItem('staynest_fixed_bills');
        if (cachedBills) {
          try {
            const parsedB = JSON.parse(cachedBills);
            if (Array.isArray(parsedB) && parsedB.length > 0) {
              setFixedBills(parsedB);
            }
          } catch {}
        }

        const cachedPnl = window.localStorage.getItem('staynest_historical_monthly_pnl');
        if (cachedPnl) {
          try {
            const parsedP = JSON.parse(cachedPnl);
            if (Array.isArray(parsedP) && parsedP.length > 0) {
              setCustomPastMonths(parsedP);
            }
          } catch {}
        }
      }

      setInvoices(invRes.content || []);
      setExpenses(loadedExpenses);
      const props = propRes.content || [];
      setProperties(props);
      if (props.length > 0) {
        setSelectedPropertyId((prev) => prev || props[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Create Expense Handler
  const handleCreateExpense = async () => {
    if (!title.trim() || !amountRupees) {
      Alert.alert('Required', 'Please enter expense title and amount');
      return;
    }

    setSubmittingExpense(true);
    try {
      const propId = selectedPropertyId || (properties.length > 0 ? properties[0].id : undefined);
      const parsedAmount = Number(amountRupees);
      const newExp: Expense = {
        id: `exp-${Date.now()}`,
        propertyId: propId || 'staynest-prop-01',
        title: title.trim(),
        notes: title.trim(),
        amountPaise: parsedAmount * 100,
        category: category.toUpperCase(),
        transactionDate: new Date().toISOString().split('T')[0],
      };

      try {
        await apiClient('/owner/expenses', {
          method: 'POST',
          body: JSON.stringify({
            propertyId: propId,
            title: title.trim(),
            notes: title.trim(),
            amountPaise: parsedAmount * 100,
            category: category.toUpperCase(),
            transactionDate: new Date().toISOString().split('T')[0],
          }),
        });
      } catch {}

      const updated = [newExp, ...expenses];
      setExpenses(updated);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('staynest_cached_expenses', JSON.stringify(updated));
      }

      Alert.alert('✓ Expense Recorded', `₹${parsedAmount.toLocaleString('en-IN')} logged under ${category}.`);
      setTitle('');
      setAmountRupees('');
      setShowExpenseForm(false);
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Open Edit Expense Modal (Requirement 4)
  const handleOpenEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditTitle(expense.title || expense.notes || expense.category);
    setEditAmount(String(Math.round(expense.amountPaise / 100)));
    setEditCategory(expense.category || 'GENERAL');
    setEditDate(expense.transactionDate || expense.date || new Date().toISOString().split('T')[0]);
  };

  // Save Expense Edit Handler (Requirement 4: Updates backend & state)
  const handleSaveEditExpense = async () => {
    if (!editingExpense) return;
    if (!editTitle.trim() || !editAmount) {
      Alert.alert('Required', 'Please enter title and amount');
      return;
    }

    setSavingEdit(true);
    try {
      const parsedAmount = Number(editAmount);
      const updatedExpense: Expense = {
        ...editingExpense,
        title: editTitle.trim(),
        notes: editTitle.trim(),
        amountPaise: parsedAmount * 100,
        category: editCategory.toUpperCase(),
        transactionDate: editDate,
      };

      try {
        await apiClient(`/owner/expenses/${editingExpense.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: editTitle.trim(),
            notes: editTitle.trim(),
            amountPaise: parsedAmount * 100,
            category: editCategory.toUpperCase(),
            transactionDate: editDate,
          }),
        });
      } catch {}

      const updatedList = expenses.map((e) => (e.id === editingExpense.id ? updatedExpense : e));
      setExpenses(updatedList);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('staynest_cached_expenses', JSON.stringify(updatedList));
      }

      Alert.alert('✓ Expense Updated', `Record updated to ₹${parsedAmount.toLocaleString('en-IN')}`);
      setEditingExpense(null);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Expense Handler (Requirement 4)
  const handleDeleteExpense = async (expenseId: string) => {
    const doDelete = async () => {
      setDeletingExpense(true);
      try {
        try {
          await apiClient(`/owner/expenses/${expenseId}`, {
            method: 'DELETE',
          });
        } catch {}

        const filtered = expenses.filter((e) => e.id !== expenseId);
        setExpenses(filtered);
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('staynest_cached_expenses', JSON.stringify(filtered));
        }

        setEditingExpense(null);
        Alert.alert('✓ Deleted', 'Expense record removed from ledger');
      } finally {
        setDeletingExpense(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm('Are you sure you want to delete this expense record?')) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Expense', 'Are you sure you want to delete this expense record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Toggle Fixed Bill Status (Requirement 4: Mark Paid or Pending)
  const handleToggleBillStatus = (billId: string) => {
    const updated = fixedBills.map((b) => (b.id === billId ? { ...b, isPaidThisMonth: !b.isPaidThisMonth } : b));
    setFixedBills(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_fixed_bills', JSON.stringify(updated));
    }
  };

  // Fixed Bills Calculations (Monthly & Yearly)
  const totalMonthlyBills = fixedBills.reduce((sum, b) => sum + b.monthlyAmount, 0);
  const totalYearlyBills = totalMonthlyBills * 12;
  const paidBillsThisMonth = fixedBills.filter((b) => b.isPaidThisMonth).reduce((sum, b) => sum + b.monthlyAmount, 0);
  const pendingBillsThisMonth = totalMonthlyBills - paidBillsThisMonth;

  // Add / Save Historical Past Month Data (Requirement 1: Fetch/Add previous year/month data)
  const handleSavePastMonthData = () => {
    if (!pastRevenueInput || !pastExpenseInput) {
      Alert.alert('Required Fields', 'Please enter both revenue and expenses for the month.');
      return;
    }
    const rev = Number(pastRevenueInput);
    const exp = Number(pastExpenseInput);
    const profit = rev - exp;
    const fullMonthName = `${pastMonthChoice} ${pastYearChoice}`;
    const newEntry = {
      id: `hist-${pastYearChoice}-${pastMonthChoice}-${Date.now()}`,
      month: fullMonthName,
      short: pastMonthChoice,
      year: pastYearChoice,
      revenue: rev,
      expense: exp,
      profit: profit,
      isGain: profit >= 0,
      notes: pastNotesInput.trim() || undefined,
      isCustom: true,
    };

    const updated = [newEntry, ...customPastMonths.filter((m) => m.month !== fullMonthName)];
    setCustomPastMonths(updated);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_historical_monthly_pnl', JSON.stringify(updated));
    }
    setSelectedBarMonth(fullMonthName);
    setShowAddPastMonthModal(false);
    setPastRevenueInput('');
    setPastExpenseInput('');
    setPastNotesInput('');
    Alert.alert('✓ Historical P&L Saved', `${fullMonthName} data added: ₹${rev.toLocaleString('en-IN')} revenue, ₹${exp.toLocaleString('en-IN')} expenses.`);
  };

  const handleDeletePastMonthData = (id: string, monthName: string) => {
    const doDelete = () => {
      const updated = customPastMonths.filter((m) => m.id !== id);
      setCustomPastMonths(updated);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('staynest_historical_monthly_pnl', JSON.stringify(updated));
      }
      setSelectedBarMonth('Nov 2026');
      Alert.alert('Deleted', `Historical record for ${monthName} removed.`);
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Delete historical P&L record for ${monthName}?`)) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Historical Record', `Remove P&L data for ${monthName}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Base 2026 Monthly Profit & Loss Records
  const currentMonthRentInflow = invoices.length > 0 ? invoices.reduce((s, i) => s + i.totalAmountPaise, 0) / 100 : 255000;
  const currentMonthExpenses = expenses.length > 0 ? expenses.reduce((s, e) => s + e.amountPaise, 0) / 100 : totalMonthlyBills;

  const BASE_MONTHLY_P_AND_L: MonthlyPnlRecord[] = [
    { id: 'base-2026-06', month: 'Jun 2026', short: 'Jun', year: '2026', revenue: 195000, expense: 142000, profit: 53000, isGain: true, isCustom: false },
    { id: 'base-2026-07', month: 'Jul 2026', short: 'Jul', year: '2026', revenue: 205000, expense: 154000, profit: 51000, isGain: true, isCustom: false },
    { id: 'base-2026-08', month: 'Aug 2026', short: 'Aug', year: '2026', revenue: 215000, expense: 168000, profit: 47000, isGain: true, isCustom: false },
    { id: 'base-2026-09', month: 'Sep 2026', short: 'Sep', year: '2026', revenue: 220000, expense: 172000, profit: 48000, isGain: true, isCustom: false },
    { id: 'base-2026-10', month: 'Oct 2026', short: 'Oct', year: '2026', revenue: 235000, expense: 165000, profit: 70000, isGain: true, isCustom: false },
    {
      id: 'base-2026-11',
      month: 'Nov 2026',
      short: 'Nov',
      year: '2026',
      revenue: currentMonthRentInflow,
      expense: currentMonthExpenses,
      profit: currentMonthRentInflow - currentMonthExpenses,
      isGain: (currentMonthRentInflow - currentMonthExpenses) >= 0,
      isCustom: false,
    },
  ];

  // Combined records (base + user-added custom past months/years)
  const allMonthlyRecords: MonthlyPnlRecord[] = [...customPastMonths, ...BASE_MONTHLY_P_AND_L];

  // Filtered by selected year
  const filteredMonthlyRecords = selectedPnlYear === 'ALL'
    ? allMonthlyRecords
    : allMonthlyRecords.filter((d) => d.year === selectedPnlYear);

  const displayPnlRecords = filteredMonthlyRecords.length > 0 ? filteredMonthlyRecords : BASE_MONTHLY_P_AND_L;
  const maxVal = Math.max(...displayPnlRecords.map((d) => Math.max(d.revenue, d.expense)), 260000);
  const totalPeriodProfit = displayPnlRecords.reduce((sum, d) => sum + d.profit, 0);
  const avgMonthlyProfit = Math.round(totalPeriodProfit / displayPnlRecords.length);

  // Selected bar detail inspection
  const inspectedMonthData = displayPnlRecords.find((d) => d.month === selectedBarMonth) || displayPnlRecords[displayPnlRecords.length - 1];

  return (
    <View style={styles.container}>
      {/* ─── 1. TOP HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backBtnText}>← Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finance & P&L</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowExpenseForm(!showExpenseForm)}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Log Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Executive Quick Stats Banner */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Avg Monthly Profit</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>
              +₹{avgMonthlyProfit.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={[styles.kpiBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#e2e8f0' }]}>
            <Text style={styles.kpiLabel}>Mandatory Monthly</Text>
            <Text style={[styles.kpiValue, { color: '#ea580c' }]}>
              ₹{totalMonthlyBills.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Net Period Surplus</Text>
            <Text style={[styles.kpiValue, { color: '#4f46e5' }]}>
              +₹{totalPeriodProfit.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#ea580c', '#3b82f6']}
            tintColor="#ea580c"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 2. INTERACTIVE MONTHLY PROFIT & LOSS GRAPH (REQUIREMENT 1 & 4) ─── */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📈</Text>
                <Text style={styles.chartTitle}>Monthly Profit & Loss Track</Text>
              </View>
              <Text style={styles.chartSub}>Inflow (Rent) vs Outflow (Bills) vs Net Gain</Text>
            </View>

            <TouchableOpacity
              style={styles.addPastMonthBtn}
              onPress={() => setShowAddPastMonthModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addPastMonthBtnText}>+ Add Past Month</Text>
            </TouchableOpacity>
          </View>

          {/* Year Filter Chips & Legend */}
          <View style={styles.filterAndLegendRow}>
            <View style={styles.yearFilterRow}>
              {(['2026', '2025', '2024', 'ALL'] as const).map((yr) => (
                <TouchableOpacity
                  key={yr}
                  style={[styles.yearChip, selectedPnlYear === yr && styles.yearChipActive]}
                  onPress={() => setSelectedPnlYear(yr)}
                >
                  <Text style={[styles.yearChipText, selectedPnlYear === yr && styles.yearChipTextActive]}>
                    {yr === 'ALL' ? 'All Years' : yr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                <Text style={styles.legendText}>Rent</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
                <Text style={styles.legendText}>Expenses</Text>
              </View>
            </View>
          </View>

          {/* Bar Chart Visualization */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: '100%', paddingHorizontal: 4 }}>
            <View style={styles.chartBarsContainer}>
              {displayPnlRecords.map((item, idx) => {
                const revH = Math.max(16, Math.min(100, Math.round((item.revenue / maxVal) * 95)));
                const expH = Math.max(16, Math.min(100, Math.round((item.expense / maxVal) * 95)));
                const isSelected = selectedBarMonth === item.month;

                return (
                  <TouchableOpacity
                    key={item.id || idx}
                    style={[styles.barGroup, isSelected && styles.barGroupSelected]}
                    onPress={() => setSelectedBarMonth(item.month)}
                    activeOpacity={0.7}
                  >
                    {/* Profit Pill Top Badge */}
                    <View
                      style={[
                        styles.barProfitBadge,
                        item.isGain ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fee2e2' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.barProfitBadgeText,
                          item.isGain ? { color: '#16a34a' } : { color: '#dc2626' },
                        ]}
                      >
                        {item.isGain ? '+' : '-'}₹{Math.round(Math.abs(item.profit) / 1000)}k
                      </Text>
                    </View>

                    {/* Dual Bars: Revenue & Expense */}
                    <View style={styles.barsPillarRow}>
                      <View style={[styles.singleBar, { height: revH, backgroundColor: '#10b981' }]} />
                      <View style={[styles.singleBar, { height: expH, backgroundColor: '#f97316' }]} />
                    </View>

                    {/* Month Label */}
                    <Text style={[styles.barMonthLabel, isSelected && { color: '#ea580c', fontWeight: '900' }]}>
                      {item.short}
                    </Text>
                    <Text style={[styles.barStatusText, { color: item.isGain ? '#059669' : '#dc2626' }]}>
                      {item.isGain ? 'Gain' : 'Loss'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Interactive Selected Month Breakdown Card */}
          {inspectedMonthData && (
            <View style={styles.inspectedMonthCard}>
              <View style={styles.inspectedMonthHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13 }}>🗓️</Text>
                  <Text style={styles.inspectedMonthTitle}>{inspectedMonthData.month} Performance</Text>
                  {inspectedMonthData.isCustom && (
                    <View style={styles.customBadge}>
                      <Text style={styles.customBadgeText}>Historical / Custom</Text>
                    </View>
                  )}
                </View>
                {inspectedMonthData.isCustom && (
                  <TouchableOpacity
                    onPress={() => handleDeletePastMonthData(inspectedMonthData.id, inspectedMonthData.month)}
                  >
                    <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '800' }}>🗑️ Delete</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inspectedMetricsRow}>
                <View style={styles.inspectedMetricBox}>
                  <Text style={styles.inspectedMetricLabel}>Rent Inflow</Text>
                  <Text style={[styles.inspectedMetricValue, { color: '#059669' }]}>
                    ₹{inspectedMonthData.revenue.toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.inspectedMetricBox}>
                  <Text style={styles.inspectedMetricLabel}>Expenses</Text>
                  <Text style={[styles.inspectedMetricValue, { color: '#ea580c' }]}>
                    ₹{inspectedMonthData.expense.toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.inspectedMetricBox}>
                  <Text style={styles.inspectedMetricLabel}>Net Margin</Text>
                  <Text
                    style={[
                      styles.inspectedMetricValue,
                      { color: inspectedMonthData.isGain ? '#16a34a' : '#dc2626' },
                    ]}
                  >
                    {inspectedMonthData.isGain ? '+' : '-'}₹{Math.abs(inspectedMonthData.profit).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {inspectedMonthData.notes && (
                <Text style={styles.inspectedNotes}>📝 {inspectedMonthData.notes}</Text>
              )}
            </View>
          )}

          <View style={styles.chartFooterRow}>
            <Text style={styles.chartFooterNote}>
              💡 Tap any month bar to inspect revenue vs expenses, or add past years anytime.
            </Text>
          </View>
        </View>

        {/* ─── 3. FIXED MONTHLY MANDATORY BILLS (REQUIREMENT 4: "MUST PAY EVERY MONTH") ─── */}
        <View style={styles.fixedBillsCard}>
          <View style={styles.fixedBillsHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📌</Text>
                <Text style={styles.fixedBillsTitle}>Mandatory Operating Bills</Text>
              </View>
              <Text style={styles.fixedBillsSub}>Expenses owner must pay every month</Text>
            </View>

            {/* Monthly vs Yearly Toggle Pill */}
            <View style={styles.timeframeToggle}>
              <TouchableOpacity
                style={[styles.toggleOption, timeframeMode === 'MONTHLY' && styles.toggleOptionActive]}
                onPress={() => setTimeframeMode('MONTHLY')}
              >
                <Text
                  style={[styles.toggleOptionText, timeframeMode === 'MONTHLY' && styles.toggleOptionTextActive]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, timeframeMode === 'YEARLY' && styles.toggleOptionActive]}
                onPress={() => setTimeframeMode('YEARLY')}
              >
                <Text
                  style={[styles.toggleOptionText, timeframeMode === 'YEARLY' && styles.toggleOptionTextActive]}
                >
                  Yearly
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Aggregate Total Banner */}
          <View style={styles.billsTotalBanner}>
            <View>
              <Text style={styles.billsTotalSub}>
                {timeframeMode === 'MONTHLY' ? 'Total Mandatory Monthly Cost:' : 'Estimated Yearly Obligation:'}
              </Text>
              <Text style={styles.billsTotalAmount}>
                ₹{(timeframeMode === 'MONTHLY' ? totalMonthlyBills : totalYearlyBills).toLocaleString('en-IN')}
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>
                  {timeframeMode === 'MONTHLY' ? ' / month' : ' / year'}
                </Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '800' }}>
                Paid: ₹{paidBillsThisMonth.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '800', marginTop: 2 }}>
                Pending: ₹{pendingBillsThisMonth.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* List of Mandatory Bills */}
          <View style={{ gap: 8, marginTop: 12 }}>
            {fixedBills.map((bill) => {
              const displayAmount = timeframeMode === 'MONTHLY' ? bill.monthlyAmount : bill.monthlyAmount * 12;

              return (
                <View key={bill.id} style={styles.billRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={styles.billIconCircle}>
                      <Text style={{ fontSize: 16 }}>{bill.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.billTitle}>{bill.title}</Text>
                      <Text style={styles.billDueInfo}>Due: {bill.dueDate}</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                    <Text style={styles.billAmount}>₹{displayAmount.toLocaleString('en-IN')}</Text>
                    <Text style={styles.billPerText}>{timeframeMode === 'MONTHLY' ? '/mo' : '/yr'}</Text>
                  </View>

                  {/* Status Button (Paid / Pending) */}
                  <TouchableOpacity
                    style={[
                      styles.billStatusPill,
                      bill.isPaidThisMonth ? styles.billStatusPaid : styles.billStatusPending,
                    ]}
                    onPress={() => handleToggleBillStatus(bill.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.billStatusText,
                        bill.isPaidThisMonth ? { color: '#059669' } : { color: '#b45309' },
                      ]}
                    >
                      {bill.isPaidThisMonth ? '✓ Paid' : '⏳ Due'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── 4. QUICK ADD STANDARD EXPENSES TEMPLATES ─── */}
        <View style={styles.quickExpensesCard}>
          <Text style={styles.quickExpensesTitle}>⚡ QUICK ADD OPERATIONAL EXPENSE</Text>
          <Text style={styles.quickExpensesSub}>Tap any template to pre-fill expense amount & category:</Text>
          <View style={styles.templatesGrid}>
            {STANDARD_EXPENSES.map((tpl) => (
              <TouchableOpacity
                key={tpl.category}
                style={[
                  styles.templateChip,
                  category === tpl.category && showExpenseForm && styles.templateChipActive,
                ]}
                onPress={() => handleSelectTemplate(tpl)}
              >
                <Text
                  style={[
                    styles.templateChipText,
                    category === tpl.category && showExpenseForm && styles.templateChipTextActive,
                  ]}
                >
                  {tpl.label} (₹{Number(tpl.defaultAmount).toLocaleString('en-IN')})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── 5. LOG EXPENSE FORM ─── */}
        {showExpenseForm && (
          <View style={styles.formCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.formTitle}>Log Operational Expense</Text>
              <TouchableOpacity onPress={() => setShowExpenseForm(false)}>
                <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '800' }}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>TITLE / DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. BESCOM Electricity Bill"
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>AMOUNT (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={amountRupees}
                  onChangeText={setAmountRupees}
                  keyboardType="numeric"
                  placeholder="3500"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>CATEGORY</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="ELECTRICITY"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, submittingExpense && { opacity: 0.6 }]}
              onPress={handleCreateExpense}
              disabled={submittingExpense}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>
                {submittingExpense ? 'Saving...' : 'Add Expense Record'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── 6. RECENT EXPENSES WITH EDIT & DELETE BUTTONS (REQUIREMENT 4) ─── */}
        <View style={{ marginTop: 24, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.sectionTitle}>RECENT EXPENSES ({expenses.length})</Text>
            <Text style={styles.sectionSub}>Tap Edit (✏️) to modify title, category or amount</Text>
          </View>
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🧾</Text>
            <Text style={styles.emptyTitle}>No Expenses Logged Yet</Text>
            <Text style={styles.emptyText}>Tap "+ Log Expense" above to record maintenance, food or bill payments.</Text>
          </View>
        ) : (
          expenses.map((e) => {
            const expTitle = e.title || e.notes || e.category;
            const expDate = e.transactionDate || e.date || 'Recent';

            return (
              <View key={e.id} style={styles.expCard}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.expTitle}>{expTitle}</Text>
                  <Text style={styles.expCategory}>
                    🏷️ {e.category} • 📅 {expDate}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                  <Text style={styles.expAmount}>
                    -₹{(e.amountPaise / 100).toLocaleString('en-IN')}
                  </Text>
                </View>

                {/* Edit & Delete Action Buttons (Requirement 4) */}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.expActionBtn}
                    onPress={() => handleOpenEditExpense(e)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 13 }}>✏️</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.expActionBtn, { backgroundColor: '#fee2e2' }]}
                    onPress={() => handleDeleteExpense(e.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 13 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ─── MODAL: EDIT EXPENSE (REQUIREMENT 4) ─── */}
      <Modal
        visible={!!editingExpense}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingExpense(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Edit Expense Record</Text>
                <Text style={styles.modalSub}>Update amount, description or date</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingExpense(null)}>
                <Text style={{ fontSize: 16, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>TITLE / DESCRIPTION</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="e.g. Cook Salary"
            />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>AMOUNT (₹)</Text>
                <TextInput
                  style={styles.input}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="numeric"
                  placeholder="25000"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>CATEGORY</Text>
                <TextInput
                  style={styles.input}
                  value={editCategory}
                  onChangeText={setEditCategory}
                  placeholder="SALARY"
                />
              </View>
            </View>

            <Text style={styles.label}>DATE (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="2026-11-22"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingEdit && { opacity: 0.6 }]}
                onPress={handleSaveEditExpense}
                disabled={savingEdit}
                activeOpacity={0.85}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>✓ Save Changes</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={() => editingExpense && handleDeleteExpense(editingExpense.id)}
                disabled={deletingExpense}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDeleteBtnText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL: ADD HISTORICAL / PAST MONTH DATA (REQUIREMENT 1) ─── */}
      <Modal
        visible={showAddPastMonthModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPastMonthModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Add Past Month / Year P&L</Text>
                <Text style={styles.modalSub}>Track historical revenue, expenses and net profit</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddPastMonthModal(false)}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Select Year */}
            <Text style={styles.label}>SELECT YEAR</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              {['2026', '2025', '2024', '2023'].map((yr) => (
                <TouchableOpacity
                  key={yr}
                  style={[styles.modalYearChip, pastYearChoice === yr && styles.modalYearChipActive]}
                  onPress={() => setPastYearChoice(yr)}
                >
                  <Text style={[styles.modalYearChipText, pastYearChoice === yr && styles.modalYearChipTextActive]}>
                    {yr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Select Month */}
            <Text style={styles.label}>SELECT MONTH</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modalMonthChip, pastMonthChoice === m && styles.modalMonthChipActive]}
                    onPress={() => setPastMonthChoice(m)}
                  >
                    <Text style={[styles.modalMonthChipText, pastMonthChoice === m && styles.modalMonthChipTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Revenue & Expenses Inputs */}
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>RENT INFLOW (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={pastRevenueInput}
                  onChangeText={setPastRevenueInput}
                  keyboardType="numeric"
                  placeholder="e.g. 210000"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>EXPENSES (₹) *</Text>
                <TextInput
                  style={styles.input}
                  value={pastExpenseInput}
                  onChangeText={setPastExpenseInput}
                  keyboardType="numeric"
                  placeholder="e.g. 155000"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Calculated Profit Preview */}
            {pastRevenueInput && pastExpenseInput ? (
              <View
                style={[
                  styles.previewBox,
                  Number(pastRevenueInput) >= Number(pastExpenseInput) ? styles.previewGain : styles.previewLoss,
                ]}
              >
                <Text style={styles.previewLabel}>Calculated Net Margin:</Text>
                <Text
                  style={[
                    styles.previewValue,
                    Number(pastRevenueInput) >= Number(pastExpenseInput) ? { color: '#16a34a' } : { color: '#dc2626' },
                  ]}
                >
                  {Number(pastRevenueInput) >= Number(pastExpenseInput) ? '+' : '-'}₹
                  {Math.abs(Number(pastRevenueInput) - Number(pastExpenseInput)).toLocaleString('en-IN')}
                  {' '}({Number(pastRevenueInput) >= Number(pastExpenseInput) ? 'Gain' : 'Loss'})
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={pastNotesInput}
              onChangeText={setPastNotesInput}
              placeholder="e.g. Peak college semester admissions"
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={styles.savePastMonthBtn}
              onPress={handleSavePastMonthData}
              activeOpacity={0.85}
            >
              <Text style={styles.savePastMonthBtnText}>✓ Save Historical Month Record</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  addBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  // Profit & Loss Chart Card
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  chartSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
  },
  barGroup: {
    alignItems: 'center',
    flex: 1,
  },
  barProfitBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  barProfitBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  barsPillarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  singleBar: {
    width: 12,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barMonthLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 6,
  },
  barStatusText: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
  chartFooterRow: {
    marginTop: 10,
  },
  chartFooterNote: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  // Fixed Bills Card
  fixedBillsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  fixedBillsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fixedBillsTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  fixedBillsSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  timeframeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  toggleOption: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  toggleOptionActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  toggleOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  toggleOptionTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  billsTotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  billsTotalSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9a3412',
  },
  billsTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ea580c',
    marginTop: 2,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  billDueInfo: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  billAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  billPerText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
  billStatusPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  billStatusPaid: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  billStatusPending: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  billStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  // Quick Add Standard Expenses
  quickExpensesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  quickExpensesTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 0.5,
  },
  quickExpensesSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  templateChip: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  templateChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  templateChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  templateChipTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  // Form Card
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  // Recent Expenses Section
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  expCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  expTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  expCategory: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  expAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#dc2626',
  },
  expActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  // Modal Edit Expense
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalDeleteBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  modalDeleteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  // Year & Past Month Graph Controls
  addPastMonthBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addPastMonthBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
  },
  filterAndLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yearFilterRow: {
    flexDirection: 'row',
    gap: 5,
  },
  yearChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  yearChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
  },
  yearChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  yearChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  barGroupSelected: {
    backgroundColor: '#fff7ed',
    borderRadius: 6,
  },
  inspectedMonthCard: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inspectedMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inspectedMonthTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  customBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  customBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
  },
  inspectedMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  inspectedMetricBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
  },
  inspectedMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  inspectedMetricValue: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },
  inspectedNotes: {
    fontSize: 10,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 6,
  },
  modalYearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalYearChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
  },
  modalYearChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalYearChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  modalMonthChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalMonthChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
  },
  modalMonthChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modalMonthChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  previewBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewGain: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  previewLoss: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  savePastMonthBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  savePastMonthBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
