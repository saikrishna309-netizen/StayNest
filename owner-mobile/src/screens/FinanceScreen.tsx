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
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { apiClient } from '../api/client';
import { safeStorage } from '../utils/safeStorage';
import { logActivity } from '../services/activityLogService';
import { GLASS_TOKENS } from '../components/glass/GlassCard';
import { showGlassSuccess } from '../components/glass/GlassSuccessModal';
import { RentInvoice, Expense, Property, Tenant } from '../types';
import {
  computeCollectionMetrics,
  computeExpenseAndProfitMetrics,
  computePeriodPnlMetrics,
  mergePortfolioTenants,
  FixedMonthlyBill,
  MonthlyPnlRecord,
} from '../services/financeSummaryService';

interface FinanceScreenProps {
  onBack: () => void;
  selectedPropertyId?: string | null;
  onActivePropertyChange?: (property: Property) => void;
}

export const FinanceScreen: React.FC<FinanceScreenProps> = ({
  onBack,
  selectedPropertyId: propSelectedPropertyId,
  onActivePropertyChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(propSelectedPropertyId || '');

  useEffect(() => {
    if (propSelectedPropertyId && propSelectedPropertyId !== selectedPropertyId) {
      setSelectedPropertyId(propSelectedPropertyId);
      if (!properties.some((p) => p.id === propSelectedPropertyId)) {
        loadFinanceData(true);
      }
    }
  }, [propSelectedPropertyId]);

  // Selected Billing Month Filter
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [timeframeMode, setTimeframeMode] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Log Expense Form State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [title, setTitle] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState('ELECTRICITY');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Fixed Monthly Operating Bills (loaded from storage/API; empty if none configured yet)
  const [fixedBills, setFixedBills] = useState<FixedMonthlyBill[]>([]);

  // Historical P&L Past Month Tracking
  const [showAddPastMonthModal, setShowAddPastMonthModal] = useState(false);
  const [selectedPnlYear, setSelectedPnlYear] = useState<'ALL' | '2026' | '2025' | '2024'>('2026');
  const [selectedBarMonth, setSelectedBarMonth] = useState<string | null>('Nov 2026');
  const [pastMonthChoice, setPastMonthChoice] = useState('Oct');
  const [pastYearChoice, setPastYearChoice] = useState('2025');
  const [pastRevenueInput, setPastRevenueInput] = useState('');
  const [pastExpenseInput, setPastExpenseInput] = useState('');
  const [pastNotesInput, setPastNotesInput] = useState('');
  const [customPastMonths, setCustomPastMonths] = useState<MonthlyPnlRecord[]>([]);

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
      const [invRes, expRes, propRes, tenRes] = await Promise.all([
        apiClient<{ content: RentInvoice[] }>('/owner/rent-invoices').catch(() => ({ content: [] })),
        apiClient<{ content: Expense[] }>('/owner/expenses').catch(() => ({ content: [] })),
        apiClient<{ content: Property[] }>('/owner/properties').catch(() => ({ content: [] })),
        apiClient<{ content: Tenant[] }>('/owner/tenants?size=100').catch(() => ({ content: [] })),
      ]);

      let customTenantsList: Tenant[] = [];
      try {
        const storedCustomTenants = await safeStorage.getItem('@staynest_custom_tenants');
        if (storedCustomTenants) {
          const parsedT: Tenant[] = JSON.parse(storedCustomTenants);
          if (Array.isArray(parsedT)) {
            customTenantsList = parsedT;
          }
        }
      } catch {}

      let loadedTenants = mergePortfolioTenants(tenRes.content || [], customTenantsList);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const cachedT = window.localStorage.getItem('staynest_cached_tenants');
          const parsedT = cachedT ? JSON.parse(cachedT) : [];
          loadedTenants = loadedTenants.map((lt) => {
            const cleanPhone = lt.phone ? lt.phone.replace(/[^0-9]/g, '') : '';
            const isPaidDirect =
              window.localStorage.getItem(`staynest_paid_${lt.id}`) === 'PAID' ||
              (cleanPhone ? window.localStorage.getItem(`staynest_paid_${cleanPhone}`) === 'PAID' : false);
            const match = Array.isArray(parsedT)
              ? parsedT.find((p: any) => p.id === lt.id || p.phone === lt.phone || p.fullName === lt.fullName)
              : null;
            if (isPaidDirect || (match && match.rentStatus === 'PAID')) {
              return { ...lt, rentStatus: 'PAID' as const, outstandingPaise: 0 };
            }
            return lt;
          });
        } catch {}
      }
      setTenants(loadedTenants);

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
      let combinedProps: Property[] = propRes.content || [];
      try {
        const storedCustomProps = await safeStorage.getItem('@staynest_custom_properties');
        if (storedCustomProps) {
          const parsedCustom = JSON.parse(storedCustomProps);
          if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
            const seen = new Set(combinedProps.map((p) => p.id));
            combinedProps = [...combinedProps, ...parsedCustom.filter((p: Property) => !seen.has(p.id))];
          }
        }
      } catch {}

      setProperties(combinedProps);
      const storedActiveId =
        propSelectedPropertyId ||
        (await safeStorage.getItem('@staynest_active_property_id')) ||
        (typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('staynest_active_property_id')
          : '');
      if (storedActiveId && combinedProps.some((p) => p.id === storedActiveId)) {
        setSelectedPropertyId(storedActiveId);
      } else if (combinedProps.length > 0) {
        setSelectedPropertyId((prev) => (prev && combinedProps.some((p) => p.id === prev) ? prev : combinedProps[0].id));
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
      await logActivity({
        propertyId: propId,
        type: 'EXPENSE_LOGGED',
        title: title.trim(),
        subtitle: category.toUpperCase(),
        amountRupees: parsedAmount,
      });

      showGlassSuccess({
        title: 'Expense Recorded',
        message: `₹${parsedAmount.toLocaleString('en-IN')} logged under ${category}.`,
        buttonText: 'Done',
      });
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

      showGlassSuccess({
        title: 'Expense Updated',
        message: `Record updated to ₹${parsedAmount.toLocaleString('en-IN')}.`,
        buttonText: 'Done',
      });
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
      window.dispatchEvent(new Event('staynest_expense_added'));
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
    showGlassSuccess({
      title: 'P&L Saved',
      message: `${fullMonthName} data added: ₹${rev.toLocaleString('en-IN')} revenue, ₹${exp.toLocaleString('en-IN')} expenses.`,
      buttonText: 'Done',
    });
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

  // Filter tenants, invoices, and expenses by the active property
  const activeTenants = tenants.filter((t) => {
    if (!selectedPropertyId) return true;
    if (t.propertyId === selectedPropertyId) return true;
    if (!t.propertyId && (selectedPropertyId === 'prop-pg-1' || selectedPropertyId === properties[0]?.id)) return true;
    return false;
  });

  const activeExpenses = expenses.filter((e) => {
    if (!selectedPropertyId) return true;
    if (e.propertyId === selectedPropertyId) return true;
    if (
      (selectedPropertyId === 'prop-pg-1' || selectedPropertyId === properties[0]?.id) &&
      (e.propertyId === 'staynest-pg-01' || e.propertyId === 'staynest-prop-01' || !e.propertyId)
    ) {
      return true;
    }
    return false;
  });

  const activeInvoices = invoices.filter((inv) => {
    if (!selectedPropertyId) return true;
    if ((inv as any).propertyId === selectedPropertyId) return true;
    if (!(inv as any).propertyId && activeTenants.some((t) => t.id === (inv as any).tenantId)) return true;
    return false;
  });

  // Single Source of Truth: Current Month Collection & Expense Metrics
  const currentMonthCollection = computeCollectionMetrics(activeTenants, selectedMonth, activeInvoices);
  const currentMonthExpenseProfit = computeExpenseAndProfitMetrics({
    collectedRent: currentMonthCollection.collectedRent,
    fixedBills,
    loggedExpenses: activeExpenses,
    selectedMonth,
  });

  const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const formatMonthKeyMeta = (monthKey: string) => {
    const [yr, mStr] = monthKey.split('-');
    const mIdx = Math.max(0, Math.min(11, (parseInt(mStr, 10) || 1) - 1));
    const short = MONTH_SHORT_NAMES[mIdx];
    return { short, year: yr, month: `${short} ${yr}` };
  };

  // Build monthly P&L dynamically from underlying invoices, tenants, expenses & fixed bills
  const dynamicMonthMap = new Map<string, { revenue: number; expense: number }>();

  // 1. Aggregate invoices by YYYY-MM
  activeInvoices.forEach((inv) => {
    const rawDate = inv.billingMonth || inv.dueDate || inv.createdAt || '';
    const key = rawDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    const entry = dynamicMonthMap.get(key) || { revenue: 0, expense: 0 };
    const amt = (inv.paidAmountPaise || (inv.status === 'PAID' ? inv.totalAmountPaise : 0) || 0) / 100;
    entry.revenue += amt;
    dynamicMonthMap.set(key, entry);
  });

  // 2. Aggregate expenses by YYYY-MM
  activeExpenses.forEach((exp) => {
    const rawDate = exp.transactionDate || exp.expenseDate || exp.date || exp.createdAt || '';
    const key = rawDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    const entry = dynamicMonthMap.get(key) || { revenue: 0, expense: 0 };
    entry.expense += (exp.amountPaise || 0) / 100;
    dynamicMonthMap.set(key, entry);
  });

  // 3. Ensure selectedMonth reflects exact Single Source of Truth (Collection - [Paid Mandatory Bills + Variable Expenses])
  dynamicMonthMap.set(selectedMonth, {
    revenue: currentMonthCollection.collectedRent,
    expense: currentMonthExpenseProfit.totalExpenses,
  });

  const computedRecords: MonthlyPnlRecord[] = Array.from(dynamicMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vals]) => {
      const meta = formatMonthKeyMeta(key);
      const rev = Math.round(vals.revenue);
      const exp = Math.round(vals.expense);
      const profit = rev - exp;
      return {
        id: `dyn-${key}`,
        month: meta.month,
        short: meta.short,
        year: meta.year,
        monthKey: key,
        revenue: rev,
        expense: exp,
        profit,
        isGain: profit >= 0,
        isCustom: false,
      };
    });

  // Combine user-added historical months with dynamically computed months (custom overrides if same month)
  const customMonthNames = new Set(customPastMonths.map((c) => c.month));
  const allMonthlyRecords: MonthlyPnlRecord[] = [
    ...customPastMonths,
    ...computedRecords.filter((r) => !customMonthNames.has(r.month)),
  ];

  // Filtered by selected year
  const displayPnlRecords = selectedPnlYear === 'ALL'
    ? allMonthlyRecords
    : allMonthlyRecords.filter((d) => d.year === selectedPnlYear);

  const maxVal = displayPnlRecords.length > 0
    ? Math.max(...displayPnlRecords.map((d) => Math.max(d.revenue, d.expense)), 1)
    : 1;

  const { netPeriodSurplus: totalPeriodProfit, avgMonthlyProfit } = computePeriodPnlMetrics(displayPnlRecords);

  // Selected bar detail inspection (safe when empty)
  const inspectedMonthData = displayPnlRecords.length > 0
    ? (displayPnlRecords.find((d) => d.month === selectedBarMonth) || displayPnlRecords[displayPnlRecords.length - 1])
    : null;

  return (
    <View style={styles.container}>
      {/* ─── 1. TOP HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backBtnText}>← Dashboard</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 5.5A2 2 0 016 3.5h9a2 2 0 012 2V6H4v-.5z"
                stroke="#0f172a"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Rect x="2.5" y="6" width="18" height="14" rx="3" stroke="#0f172a" strokeWidth="2" />
              <Path
                d="M15 10.5h4.5a1.5 1.5 0 011.5 1.5v2a1.5 1.5 0 01-1.5 1.5H15v-5z"
                stroke="#0f172a"
                strokeWidth="1.8"
                fill="#ffffff"
              />
              <Circle cx="18" cy="13" r="1.2" fill="#0f172a" />
            </Svg>
            <Text style={styles.headerTitle}>Financials</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowExpenseForm(!showExpenseForm)}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Log Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Active Property Selector Pills (Synced across all screens) */}
        {properties.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 10 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {properties.map((p) => {
              const isSelected = selectedPropertyId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    setSelectedPropertyId(p.id);
                    onActivePropertyChange?.(p);
                  }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isSelected ? '#ea580c' : '#faf8f6',
                    borderWidth: 1,
                    borderColor: isSelected ? '#ea580c' : '#efece9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: isSelected ? '#ffffff' : '#374151',
                    }}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Executive Quick Stats Banner */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit>
              AVG MONTHLY PROFIT
            </Text>
            <Text style={[styles.kpiValue, { color: avgMonthlyProfit >= 0 ? '#4d8b6f' : '#dc2626' }]} numberOfLines={1} adjustsFontSizeToFit>
              {avgMonthlyProfit >= 0 ? '+' : '-'}₹{Math.abs(avgMonthlyProfit).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={[styles.kpiBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#efece9' }]}>
            <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit>
              MANDATORY MONTHLY
            </Text>
            <Text style={[styles.kpiValue, { color: '#ea580c' }]} numberOfLines={1} adjustsFontSizeToFit>
              ₹{totalMonthlyBills.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel} numberOfLines={1} adjustsFontSizeToFit>
              NET PERIOD SURPLUS
            </Text>
            <Text style={[styles.kpiValue, { color: totalPeriodProfit >= 0 ? '#3730a3' : '#dc2626' }]} numberOfLines={1} adjustsFontSizeToFit>
              {totalPeriodProfit >= 0 ? '+' : '-'}₹{Math.abs(totalPeriodProfit).toLocaleString('en-IN')}
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
            colors={['#ea580c', '#4d8b6f']}
            tintColor="#ea580c"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 2. INTERACTIVE MONTHLY PROFIT & LOSS GRAPH ─── */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
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
                <View style={[styles.legendDot, { backgroundColor: '#6d9e86' }]} />
                <Text style={styles.legendText}>Rent</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ea580c' }]} />
                <Text style={styles.legendText}>Expenses</Text>
              </View>
            </View>
          </View>

          {/* Bar Chart Visualization */}
          {loading && displayPnlRecords.length === 0 ? (
            <ActivityIndicator color="#ea580c" style={{ marginVertical: 40 }} />
          ) : displayPnlRecords.length === 0 ? (
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#6b7280' }}>
                No financial records for {selectedPnlYear === 'ALL' ? 'any year' : selectedPnlYear} yet.
              </Text>
              <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Log an expense or tap "+ Add Past Month" to track P&L.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScrollContent}
            >
              <View
                style={[
                  styles.chartBarsContainer,
                  {
                    justifyContent: displayPnlRecords.length <= 2 ? 'center' : 'space-around',
                    minWidth: Math.max(280, displayPnlRecords.length * 64),
                  },
                ]}
              >
                {displayPnlRecords.map((item, idx) => {
                  const revH = item.revenue > 0 ? Math.max(12, Math.min(96, Math.round((item.revenue / maxVal) * 92))) : 6;
                  const expH = item.expense > 0 ? Math.max(12, Math.min(96, Math.round((item.expense / maxVal) * 92))) : 6;
                  const isSelected = inspectedMonthData?.month === item.month;

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
                          isSelected
                            ? { backgroundColor: '#ffedd5' }
                            : item.isGain
                              ? { backgroundColor: '#e6f4ea' }
                              : { backgroundColor: '#fee2e2' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.barProfitBadgeText,
                            isSelected
                              ? { color: '#c2410c' }
                              : item.isGain
                                ? { color: '#15803d' }
                                : { color: '#dc2626' },
                          ]}
                        >
                          {item.isGain ? '+' : '-'}₹{Math.round(Math.abs(item.profit) / 1000)}k
                        </Text>
                      </View>

                      {/* Dual Bars: Revenue & Expense aligned to fixed baseline */}
                      <View style={styles.barsPillarRow}>
                        <View style={[styles.singleBar, { height: revH, backgroundColor: '#7aa992' }]} />
                        <View style={[styles.singleBar, { height: expH, backgroundColor: '#ea580c' }]} />
                      </View>

                      {/* Month Label */}
                      <Text style={[styles.barMonthLabel, isSelected && { color: '#ea580c', fontWeight: '900' }]}>
                        {item.short}
                      </Text>
                      <Text style={[styles.barStatusText, { color: item.isGain ? '#4d8b6f' : '#dc2626' }]}>
                        {item.isGain ? 'Gain' : 'Loss'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

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
                  <Text style={styles.inspectedMetricLabel}>RENT INFLOW</Text>
                  <Text style={[styles.inspectedMetricValue, { color: '#4d8b6f' }]}>
                    ₹{inspectedMonthData.revenue.toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.inspectedMetricBox}>
                  <Text style={styles.inspectedMetricLabel}>EXPENSES</Text>
                  <Text style={[styles.inspectedMetricValue, { color: '#ea580c' }]}>
                    ₹{inspectedMonthData.expense.toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.inspectedMetricBox}>
                  <Text style={styles.inspectedMetricLabel}>NET MARGIN</Text>
                  <Text
                    style={[
                      styles.inspectedMetricValue,
                      { color: inspectedMonthData.isGain ? '#15803d' : '#dc2626' },
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

        {/* ─── 3. FIXED MONTHLY MANDATORY BILLS ─── */}
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
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6b7280' }}>
                  {timeframeMode === 'MONTHLY' ? ' / month' : ' / year'}
                </Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '800' }}>
                Paid: ₹{paidBillsThisMonth.toLocaleString('en-IN')}
              </Text>
              <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '800', marginTop: 2 }}>
                Pending: ₹{pendingBillsThisMonth.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* List of Mandatory Bills */}
          {fixedBills.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '600' }}>
                No mandatory operating bills configured yet.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 12 }}>
              {fixedBills.map((bill) => {
                const displayAmount = timeframeMode === 'MONTHLY' ? bill.monthlyAmount : bill.monthlyAmount * 12;

                return (
                  <View key={bill.id} style={styles.billRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <View style={[styles.billIconCircle, { flexShrink: 0 }]}>
                        <Text style={{ fontSize: 16 }}>{bill.icon}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.billTitle} numberOfLines={2}>{bill.title}</Text>
                        <Text style={styles.billDueInfo}>Due: {bill.dueDate}</Text>
                      </View>
                    </View>

                    <View style={{ flexShrink: 0, alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.billAmount} numberOfLines={1}>
                        ₹{displayAmount.toLocaleString('en-IN')}
                        <Text style={styles.billPerText}>
                          {timeframeMode === 'MONTHLY' ? '/mo' : '/yr'}
                        </Text>
                      </Text>

                      {/* Status Button (Paid / Pending) */}
                      <TouchableOpacity
                        style={[
                          styles.billStatusPill,
                          { minWidth: 68, alignItems: 'center', justifyContent: 'center' },
                          bill.isPaidThisMonth ? styles.billStatusPaid : styles.billStatusPending,
                        ]}
                        onPress={() => handleToggleBillStatus(bill.id)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.billStatusText,
                          bill.isPaidThisMonth ? { color: '#15803d' } : { color: '#b45309' },
                        ]}
                      >
                        {bill.isPaidThisMonth ? '✓ Paid' : '⏳ Due'}
                      </Text>
                    </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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

        {/* ─── 6. RECENT EXPENSES WITH EDIT & DELETE BUTTONS ─── */}
        <View style={{ marginTop: 24, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.sectionTitle}>RECENT EXPENSES ({activeExpenses.length})</Text>
            <Text style={styles.sectionSub}>Tap Edit (✏️) to modify title, category or amount</Text>
          </View>
        </View>

        {activeExpenses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🧾</Text>
            <Text style={styles.emptyTitle}>No Expenses Logged Yet</Text>
            <Text style={styles.emptyText}>Tap "+ Log Expense" above to record maintenance, food or bill payments.</Text>
          </View>
        ) : (
          activeExpenses.map((e) => {
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

                {/* Edit & Delete Action Buttons */}
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
    backgroundColor: 'transparent',
  },
  header: {
    backgroundColor: 'transparent',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#efece9',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#efece9',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#ea580c',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#efece9',
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  kpiLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  // Profit & Loss Chart Card
  chartCard: {
    backgroundColor: GLASS_TOKENS.cardBg,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: GLASS_TOKENS.cardBorder,
    marginBottom: 16,
    ...GLASS_TOKENS.shadow,
    ...GLASS_TOKENS.webBlur16,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  chartSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  chartScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    width: '100%',
    minHeight: 175,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
    gap: 8,
  },
  barGroup: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 52,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  barProfitBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 8,
  },
  barProfitBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  barsPillarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 100,
    gap: 4,
  },
  singleBar: {
    width: 13,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barMonthLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
    marginTop: 6,
  },
  barStatusText: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  chartFooterRow: {
    marginTop: 12,
  },
  chartFooterNote: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  // Fixed Bills Card
  fixedBillsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#efece9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  fixedBillsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  fixedBillsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  fixedBillsSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  timeframeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 3,
  },
  toggleOption: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 8,
  },
  toggleOptionActive: {
    backgroundColor: '#ea580c',
  },
  toggleOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  toggleOptionTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  billsTotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  billsTotalSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7c2d12',
  },
  billsTotalAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#d96b27',
    marginTop: 2,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#efece9',
  },
  billIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  billDueInfo: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },
  billAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
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
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    marginBottom: 16,
    shadowColor: '#ea580c',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: '#fffaf5',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
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
    color: '#334155',
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  expCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#ea580c',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  expTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
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
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addPastMonthBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d96b27',
  },
  filterAndLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  yearFilterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  yearChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  yearChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  yearChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  yearChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  barGroupSelected: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
  },
  inspectedMonthCard: {
    marginTop: 14,
    backgroundColor: '#faf8f6',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#efece9',
  },
  inspectedMonthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  inspectedMonthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  customBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
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
    gap: 8,
  },
  inspectedMetricBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#efece9',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  inspectedMetricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inspectedMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  inspectedNotes: {
    fontSize: 10,
    color: '#4b5563',
    fontStyle: 'italic',
    marginTop: 8,
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
