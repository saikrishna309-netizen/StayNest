// ============================================================================
// StayNest Single Source of Truth Financial & Occupancy Service
// Eliminates hardcoded values and guarantees 100% mathematical consistency
// across Dashboard, Tenant Management, Room Management, and Financials.
// ============================================================================

import { Tenant, Room, RentInvoice, Expense } from '../types';
import { FloorItem } from './propertyDataService';

export interface FixedMonthlyBill {
  id: string;
  title: string;
  category: string;
  monthlyAmount: number;
  icon: string;
  isPaidThisMonth: boolean;
  dueDate: string;
}

export interface MonthlyPnlRecord {
  id: string;
  month: string; // e.g. 'Nov 2026'
  short: string; // e.g. 'Nov'
  year: string; // e.g. '2026'
  monthKey?: string; // e.g. '2026-11'
  revenue: number;
  expense: number;
  profit: number;
  isGain: boolean;
  notes?: string;
  isCustom?: boolean;
}

export interface OccupancyMetrics {
  totalBeds: number;
  occupiedBeds: number;
  emptyBeds: number;
  occupancyRate: number;
}

export interface CollectionMetrics {
  expectedRent: number;
  collectedRent: number;
  pendingDue: number;
  collectionRate: number;
  rentDueCount: number;
  activeTenantsCount: number;
}

export interface ExpenseAndProfitMetrics {
  totalMandatoryCost: number;
  paidMandatoryBills: number;
  pendingMandatoryBills: number;
  loggedVariableExpenses: number;
  totalExpenses: number;
  netProfit: number;
}

export interface PeriodPnlMetrics {
  netPeriodSurplus: number;
  avgMonthlyProfit: number;
}

/**
 * Format currency safely using Indian numbering system (en-IN).
 */
export const formatINR = (amount: number): string => {
  const safeVal = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${Math.abs(safeVal).toLocaleString('en-IN')}`;
};

/**
 * Compute occupancy metrics from rooms/floors and active tenants.
 * Total Beds = sum of beds across all active rooms.
 * Occupied Beds = count of active tenants assigned to beds.
 * Empty Beds = Total Beds - Occupied Beds.
 */
export const computeOccupancyMetrics = (
  roomsOrFloors: Array<Room | FloorItem>,
  activeTenants: Tenant[]
): OccupancyMetrics => {
  let totalBeds = 0;
  let bedOccupiedCount = 0;

  const activeAssignedTenants = activeTenants.filter(
    (t) =>
      t.active !== false &&
      t.stayStatus !== 'TERMINATED' &&
      Boolean(t.bedId || t.roomId || t.roomNumber)
  );
  const occupiedBedIds = new Set(
    activeAssignedTenants.map((t) => t.bedId).filter(Boolean) as string[]
  );
  const occupiedRoomBedKeys = new Set(
    activeAssignedTenants
      .filter((t) => t.roomNumber && t.bedLabel)
      .map((t) => `${String(t.roomNumber).trim()}-${String(t.bedLabel).trim().toLowerCase()}`)
  );

  const countRoom = (r: any) => {
    if (Array.isArray(r.beds) && r.beds.length > 0) {
      totalBeds += r.beds.length;
      bedOccupiedCount += r.beds.filter((b: any) => {
        if (b.status === 'OCCUPIED' || occupiedBedIds.has(b.id)) return true;
        const key = `${String(r.roomNumber || '').trim()}-${String(b.bedLabel || '').trim().toLowerCase()}`;
        return occupiedRoomBedKeys.has(key);
      }).length;
    } else {
      totalBeds += r.capacity || 0;
    }
  };

  roomsOrFloors.forEach((item: any) => {
    if (Array.isArray(item.rooms)) {
      item.rooms.forEach(countRoom);
    } else {
      countRoom(item);
    }
  });

  const occupiedBeds =
    totalBeds === 0
      ? 0
      : Math.min(totalBeds, Math.max(bedOccupiedCount, activeAssignedTenants.length));
  const emptyBeds = Math.max(0, totalBeds - occupiedBeds);
  const occupancyRate =
    totalBeds === 0 ? 0 : Math.min(100, Math.round((occupiedBeds / totalBeds) * 100));

  return {
    totalBeds,
    occupiedBeds,
    emptyBeds,
    occupancyRate,
  };
};

/**
 * Compute rent collection metrics for Dashboard & Tenant Management.
 * - Expected Rent = sum of monthly rent for all active tenants
 * - Collected Rent = sum of verified payments / paid rent for that month
 * - Pending Due = Expected Rent - Collected Rent
 * - Collection Rate = Expected Rent === 0 ? 0 : Math.round((Collected / Expected) * 100)
 * - Rent Due Count = exact count of active tenants where Due Pending > 0
 */
export const computeCollectionMetrics = (
  tenants: Tenant[],
  selectedMonth?: string,
  invoices?: RentInvoice[]
): CollectionMetrics => {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const activeTenants = tenants.filter(
    (t) => t.active !== false && t.stayStatus !== 'TERMINATED'
  );

  const monthInvoices =
    selectedMonth && Array.isArray(invoices)
      ? invoices.filter(
          (i) =>
            i.billingMonth === selectedMonth ||
            (i.dueDate && i.dueDate.startsWith(selectedMonth)) ||
            (i.createdAt && i.createdAt.startsWith(selectedMonth))
        )
      : Array.isArray(invoices)
        ? invoices
        : [];

  // For non-current months: strictly use that month's invoices (if nothing was added, return 0)
  if (selectedMonth && selectedMonth !== currentMonthKey) {
    if (monthInvoices.length > 0) {
      const expectedRent = Math.round(
        monthInvoices.reduce((sum, i) => sum + (i.totalAmountPaise || 0), 0) / 100
      );
      const collectedRent = Math.round(
        monthInvoices.reduce((sum, i) => sum + (i.paidAmountPaise || 0), 0) / 100
      );
      const pendingDue = Math.max(0, expectedRent - collectedRent);
      const collectionRate =
        expectedRent === 0
          ? 0
          : Math.min(100, Math.max(0, Math.round((collectedRent / expectedRent) * 100)));
      const rentDueCount = monthInvoices.filter(
        (i) => (i.totalAmountPaise || 0) > (i.paidAmountPaise || 0)
      ).length;

      return {
        expectedRent,
        collectedRent,
        pendingDue,
        collectionRate,
        rentDueCount,
        activeTenantsCount: activeTenants.length,
      };
    }

    // No invoices for this non-current month -> check if any tenant specifically checked in that exact month
    const checkedInThatMonth = activeTenants.filter(
      (t) => (t.checkIn || t.createdAt || '').slice(0, 7) === selectedMonth
    );
    if (checkedInThatMonth.length === 0) {
      return {
        expectedRent: 0,
        collectedRent: 0,
        pendingDue: 0,
        collectionRate: 0,
        rentDueCount: 0,
        activeTenantsCount: 0,
      };
    }
  }

  // If invoices exist for the selected month and no active tenants loaded, derive from invoices
  if (activeTenants.length === 0 && monthInvoices.length > 0) {
    const expectedRent = Math.round(
      monthInvoices.reduce((sum, i) => sum + (i.totalAmountPaise || 0), 0) / 100
    );
    const collectedRent = Math.round(
      monthInvoices.reduce((sum, i) => sum + (i.paidAmountPaise || 0), 0) / 100
    );
    const pendingDue = Math.max(0, expectedRent - collectedRent);
    const collectionRate =
      expectedRent === 0 ? 0 : Math.min(100, Math.max(0, Math.round((collectedRent / expectedRent) * 100)));
    const rentDueCount = monthInvoices.filter(
      (i) => (i.totalAmountPaise || 0) > (i.paidAmountPaise || 0)
    ).length;

    return {
      expectedRent,
      collectedRent,
      pendingDue,
      collectionRate,
      rentDueCount,
      activeTenantsCount: 0,
    };
  }

  const scopedTenants = selectedMonth
    ? activeTenants.filter((t) => {
        const startMonth = (t.checkIn || t.createdAt || '').slice(0, 7);
        return !startMonth || startMonth <= selectedMonth;
      })
    : activeTenants;

  let expectedRent = 0;
  let collectedRent = 0;
  let pendingDue = 0;
  let rentDueCount = 0;

  scopedTenants.forEach((t) => {
    const rent = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 0;
    const due =
      typeof t.outstandingPaise === 'number'
        ? Math.max(0, Math.round(t.outstandingPaise / 100))
        : t.rentStatus === 'PAID'
          ? 0
          : rent;
    const paid = Math.max(0, rent - due);

    expectedRent += rent;
    collectedRent += paid;
    pendingDue += due;
    if (due > 0) {
      rentDueCount += 1;
    }
  });

  const collectionRate =
    expectedRent === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round((collectedRent / expectedRent) * 100)));

  return {
    expectedRent,
    collectedRent,
    pendingDue,
    collectionRate,
    rentDueCount,
    activeTenantsCount: activeTenants.length,
  };
};

/**
 * Filter expenses by YYYY-MM month string safely.
 */
export const filterExpensesByMonth = (expenses: Expense[], monthKey?: string): Expense[] => {
  if (!monthKey) return expenses;
  return expenses.filter((e) => {
    const dateStr = e.transactionDate || e.expenseDate || e.date || e.createdAt || '';
    return dateStr.startsWith(monthKey);
  });
};

/**
 * Compute expense & profit/loss metrics from real bills + logged variable expenses.
 * - Total Mandatory Cost = sum of all recurring monthly operating bills (Paid + Pending)
 * - Total Expenses = Paid Mandatory Bills + Logged Variable Expenses for that month
 * - Net Profit = Collected Rent (Inflow) - Total Expenses (Outflow)
 */
export const computeExpenseAndProfitMetrics = ({
  collectedRent,
  fixedBills,
  loggedExpenses,
  selectedMonth,
}: {
  collectedRent: number;
  fixedBills: FixedMonthlyBill[];
  loggedExpenses: Expense[];
  selectedMonth?: string;
}): ExpenseAndProfitMetrics => {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const applyMandatory = !selectedMonth || selectedMonth === currentMonthKey;
  const totalMandatoryCost = applyMandatory ? fixedBills.reduce((sum, b) => sum + (b.monthlyAmount || 0), 0) : 0;
  const paidMandatoryBills = applyMandatory
    ? fixedBills.filter((b) => b.isPaidThisMonth).reduce((sum, b) => sum + (b.monthlyAmount || 0), 0)
    : 0;
  const pendingMandatoryBills = Math.max(0, totalMandatoryCost - paidMandatoryBills);

  const monthExpenses = selectedMonth
    ? filterExpensesByMonth(loggedExpenses, selectedMonth)
    : loggedExpenses;

  const loggedVariableExpenses = Math.round(
    monthExpenses.reduce((sum, e) => sum + (e.amountPaise || 0), 0) / 100
  );

  const totalExpenses = paidMandatoryBills + loggedVariableExpenses;
  const netProfit = collectedRent - totalExpenses;

  return {
    totalMandatoryCost,
    paidMandatoryBills,
    pendingMandatoryBills,
    loggedVariableExpenses,
    totalExpenses,
    netProfit,
  };
};

/**
 * Compute aggregate period surplus and average monthly profit across a P&L array.
 * Safe against empty arrays (returns 0 instead of NaN).
 */
export const computePeriodPnlMetrics = (records: MonthlyPnlRecord[]): PeriodPnlMetrics => {
  if (!records || records.length === 0) {
    return { netPeriodSurplus: 0, avgMonthlyProfit: 0 };
  }
  const netPeriodSurplus = records.reduce((sum, r) => sum + (r.profit || 0), 0);
  const avgMonthlyProfit = Math.round(netPeriodSurplus / records.length);
  return {
    netPeriodSurplus,
    avgMonthlyProfit,
  };
};

export const DEFAULT_PORTFOLIO_TENANTS: Tenant[] = [];

export interface MonthlyInvoiceBreakdown {
  baseRent: number;
  electricityCharge: number;
  maintenanceCharge: number;
  discount: number;
  totalInvoice: number;
}

/**
 * Single Source of Truth monthly invoice calculator:
 * Total = Base Rent (Bed or Room) + Electricity Bill + Maintenance Fee - Discounts
 */
export const computeMonthlyInvoiceTotal = ({
  baseRent,
  electricityMode = 'INCLUDED',
  electricityFixed = 0,
  prevReading = 0,
  currReading = 0,
  ratePerUnit = 0,
  maintenanceMode = 'INCLUDED',
  maintenanceFee = 0,
  discount = 0,
}: {
  baseRent: number;
  electricityMode?: 'METERED' | 'FIXED' | 'INCLUDED';
  electricityFixed?: number;
  prevReading?: number;
  currReading?: number;
  ratePerUnit?: number;
  maintenanceMode?: 'INCLUDED' | 'EXTRA';
  maintenanceFee?: number;
  discount?: number;
}): MonthlyInvoiceBreakdown => {
  const safeBase = Math.max(0, Math.round(baseRent || 0));
  let electricityCharge = 0;
  if (electricityMode === 'METERED') {
    const units = Math.max(0, (currReading || 0) - (prevReading || 0));
    electricityCharge = Math.round(units * Math.max(0, ratePerUnit || 0));
  } else if (electricityMode === 'FIXED') {
    electricityCharge = Math.max(0, Math.round(electricityFixed || 0));
  }

  const maintenanceCharge =
    maintenanceMode === 'EXTRA' ? Math.max(0, Math.round(maintenanceFee || 0)) : 0;

  const safeDiscount = Math.max(0, Math.round(discount || 0));
  const totalInvoice = Math.max(0, safeBase + electricityCharge + maintenanceCharge - safeDiscount);

  return {
    baseRent: safeBase,
    electricityCharge,
    maintenanceCharge,
    discount: safeDiscount,
    totalInvoice,
  };
};

/**
 * Merges API tenants, default portfolio tenants, locally onboarded custom tenants,
 * and cached payment statuses into one consistent tenant list.
 */
export const mergePortfolioTenants = (
  apiTenants: Tenant[],
  customTenants: Tenant[] = []
): Tenant[] => {
  const existingPhones = new Set(apiTenants.map((t) => t.phone));
  const existingIds = new Set(apiTenants.map((t) => t.id));
  let merged: Tenant[] = [
    ...apiTenants,
    ...DEFAULT_PORTFOLIO_TENANTS.filter((mt) => !existingPhones.has(mt.phone) && !existingIds.has(mt.id)),
  ];

  if (customTenants.length > 0) {
    const cIds = new Set(customTenants.map((c) => c.id));
    merged = [
      ...customTenants,
      ...merged.filter((lt) => !cIds.has(lt.id)),
    ];
  }

  return merged.map((t) => ({
    ...t,
    active: t.stayStatus === 'TERMINATED' ? false : t.active !== false,
    stayStatus: t.stayStatus === 'TERMINATED' ? 'TERMINATED' : 'ACTIVE',
  }));
};
