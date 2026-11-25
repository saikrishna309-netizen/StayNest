import { safeStorage } from '../utils/safeStorage';
import { emitDataChanged } from '../utils/appEvents';

export interface MonthlyBillRecord {
  id: string;
  tenancyId: string;
  propertyId?: string;
  billingMonth: string; // YYYY-MM e.g. '2026-11'
  prevReading: number;
  currReading: number;
  units: number;
  ratePerUnit: number;
  electricityAmount: number;
  baseRent: number;
  maintenanceAmount: number;
  totalPayable: number;
  paidAmount: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'DUE';
  isDirectAmount?: boolean;
  updatedAt: string;
}

const MONTHLY_BILLS_KEY = '@staynest_monthly_bills';

export const getAllMonthlyBills = async (): Promise<MonthlyBillRecord[]> => {
  try {
    const raw = await safeStorage.getItem(MONTHLY_BILLS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const webRaw = window.localStorage.getItem('staynest_monthly_bills');
      if (webRaw) {
        const parsed = JSON.parse(webRaw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
};

export const getPriorMonthKey = (billingMonth: string): string => {
  const [yStr, mStr] = billingMonth.split('-');
  let year = parseInt(yStr, 10) || 2026;
  let month = parseInt(mStr, 10) || 11;
  month -= 1;
  if (month <= 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const getMonthlyBill = (
  bills: MonthlyBillRecord[],
  tenancyId: string,
  billingMonth: string
): MonthlyBillRecord | undefined => {
  return bills.find((b) => b.tenancyId === tenancyId && b.billingMonth === billingMonth);
};

export const getPreviousMonthCurrReading = (
  bills: MonthlyBillRecord[],
  tenancyId: string,
  billingMonth: string,
  startingReading = 0
): number => {
  const prevKey = getPriorMonthKey(billingMonth);
  const prevBill = bills.find((b) => b.tenancyId === tenancyId && b.billingMonth === prevKey);
  if (prevBill && typeof prevBill.currReading === 'number') {
    return prevBill.currReading;
  }
  return startingReading || 0;
};

export const saveMonthlyBill = async (bill: MonthlyBillRecord): Promise<MonthlyBillRecord[]> => {
  const existing = await getAllMonthlyBills();
  const next = [
    bill,
    ...existing.filter(
      (b) => !(b.tenancyId === bill.tenancyId && b.billingMonth === bill.billingMonth)
    ),
  ];
  const serialized = JSON.stringify(next);
  await safeStorage.setItem(MONTHLY_BILLS_KEY, serialized);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('staynest_monthly_bills', serialized);
    } catch {}
  }
  emitDataChanged();
  return next;
};
