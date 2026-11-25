import { safeStorage } from '../utils/safeStorage';
import { Expense, RentInvoice, Tenant } from '../types';

export type ActivityType =
  | 'RENT_PAID'
  | 'TENANT_ADDED'
  | 'EXPENSE_LOGGED'
  | 'ISSUE_LOGGED'
  | 'PROPERTY_CREATED'
  | 'KYC_VERIFIED'
  | 'BED_ASSIGNED'
  | 'GENERAL';

export interface ActivityLogItem {
  id: string;
  propertyId?: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  amountRupees?: number;
  timestamp: string;
}

const ACTIVITY_STORAGE_KEY = '@staynest_activity_log';
const MAX_STORED_ACTIVITIES = 50;

/**
 * Persists an owner action to local/safe storage and notifies listeners so
 * DashboardScreen refreshes Recent Activities immediately.
 */
export const logActivity = async (
  entry: Omit<ActivityLogItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<ActivityLogItem> => {
  const newItem: ActivityLogItem = {
    id: entry.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    propertyId: entry.propertyId,
    type: entry.type,
    title: entry.title,
    subtitle: entry.subtitle,
    amountRupees: entry.amountRupees,
    timestamp: entry.timestamp || new Date().toISOString(),
  };

  try {
    const raw = await safeStorage.getItem(ACTIVITY_STORAGE_KEY);
    const existing: ActivityLogItem[] = raw ? JSON.parse(raw) : [];
    const merged = [
      newItem,
      ...(Array.isArray(existing) ? existing.filter((x) => x.id !== newItem.id) : []),
    ].slice(0, MAX_STORED_ACTIVITIES);

    await safeStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(merged));
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('staynest_activity_log', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('staynest_activity_added', { detail: newItem }));
    }
  } catch {
    // ignore storage errors
  }

  return newItem;
};

export const getLoggedActivities = async (): Promise<ActivityLogItem[]> => {
  try {
    const raw = await safeStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const webRaw = window.localStorage.getItem('staynest_activity_log');
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

/**
 * Formats an ISO timestamp into a concise relative label ("Just now", "2h ago", "25 Nov").
 */
export const formatActivityTime = (iso: string): string => {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Recent';
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/**
 * Builds up to `limit` (default 5) most recent activities for the active property
 * by merging explicitly logged actions with real tenant, invoice, expense & issue records.
 */
export const buildRecentActivities = ({
  propertyId,
  defaultPropertyId,
  tenants = [],
  invoices = [],
  expenses = [],
  issues = [],
  loggedActivities = [],
  backendActivities = [],
  limit = 5,
}: {
  propertyId?: string;
  defaultPropertyId?: string;
  tenants?: Tenant[];
  invoices?: RentInvoice[];
  expenses?: Expense[];
  issues?: any[];
  loggedActivities?: ActivityLogItem[];
  backendActivities?: ActivityLogItem[];
  limit?: number;
}): ActivityLogItem[] => {
  const matchesProp = (itemPropId?: string) => {
    if (!propertyId) return true;
    if (itemPropId === propertyId) return true;
    if (
      !itemPropId &&
      (propertyId === 'prop-pg-1' || (defaultPropertyId && propertyId === defaultPropertyId))
    ) {
      return true;
    }
    if (
      (propertyId === 'prop-pg-1' || (defaultPropertyId && propertyId === defaultPropertyId)) &&
      (itemPropId === 'staynest-pg-01' || itemPropId === 'staynest-prop-01')
    ) {
      return true;
    }
    return false;
  };

  const collected: ActivityLogItem[] = [];

  // 1. Explicit local logged activities & backend activities
  [...loggedActivities, ...backendActivities].forEach((act) => {
    if (matchesProp(act.propertyId)) {
      collected.push(act);
    }
  });

  // 2. Paid rent invoices
  invoices.forEach((inv) => {
    const invPropId = (inv as any).propertyId;
    if (!matchesProp(invPropId)) return;
    if (inv.status === 'PAID' || (inv.paidAmountPaise && inv.paidAmountPaise > 0)) {
      const rupees = Math.round(
        ((inv.paidAmountPaise || inv.totalAmountPaise || 0) as number) / 100
      );
      const ts = inv.createdAt || inv.dueDate || new Date().toISOString();
      const invRoom = (inv as any).roomNumber;
      collected.push({
        id: `inv-${inv.id}`,
        propertyId: invPropId,
        type: 'RENT_PAID',
        title: `Rent received${inv.tenantName ? ` from ${inv.tenantName}` : ''}`,
        subtitle: `${invRoom ? `Room ${invRoom}` : 'Monthly Rent'} • ${inv.billingMonth || 'Current'}`,
        amountRupees: rupees,
        timestamp: ts,
      });
    }
  });

  // 3. Tenant check-ins / paid tenants (fallback if no invoice row)
  tenants.forEach((t) => {
    if (!matchesProp(t.propertyId)) return;
    if (t.active === false || t.stayStatus === 'TERMINATED') return;
    const roomInfo = t.roomNumber ? `Room ${t.roomNumber}${t.bedLabel ? ` (${t.bedLabel})` : ''}` : 'Assigned';
    if (t.rentStatus === 'PAID') {
      const rentAmt = t.monthlyRentPaise ? Math.round(t.monthlyRentPaise / 100) : 8500;
      collected.push({
        id: `t-paid-${t.id}`,
        propertyId: t.propertyId,
        type: 'RENT_PAID',
        title: `Rent cleared by ${t.fullName}`,
        subtitle: roomInfo,
        amountRupees: rentAmt,
        timestamp: t.checkIn || t.createdAt || '2026-11-05T10:00:00.000Z',
      });
    } else if (t.checkIn || t.createdAt) {
      collected.push({
        id: `t-join-${t.id}`,
        propertyId: t.propertyId,
        type: 'TENANT_ADDED',
        title: `${t.fullName} checked in`,
        subtitle: roomInfo,
        timestamp: t.checkIn || t.createdAt || new Date().toISOString(),
      });
    }
  });

  // 4. Logged expenses
  expenses.forEach((e) => {
    if (!matchesProp(e.propertyId)) return;
    const rupees = Math.round((e.amountPaise || 0) / 100);
    collected.push({
      id: `exp-${e.id}`,
      propertyId: e.propertyId,
      type: 'EXPENSE_LOGGED',
      title: e.title || e.notes || e.category || 'Expense logged',
      subtitle: e.category || 'OPERATIONAL',
      amountRupees: rupees,
      timestamp: e.transactionDate || e.date || e.createdAt || new Date().toISOString(),
    });
  });

  // 5. Maintenance / resident issues
  issues.forEach((iss) => {
    if (!matchesProp(iss.propertyId)) return;
    collected.push({
      id: `iss-${iss.id}`,
      propertyId: iss.propertyId,
      type: 'ISSUE_LOGGED',
      title: iss.title || 'Maintenance issue logged',
      subtitle: `${iss.roomNumber ? `Room ${iss.roomNumber} • ` : ''}${iss.status || 'OPEN'}`,
      timestamp: iss.createdAt || new Date().toISOString(),
    });
  });

  // Deduplicate by id, sort newest first, return top `limit`
  const seen = new Set<string>();
  const unique = collected.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  unique.sort((a, b) => {
    const ta = Date.parse(a.timestamp) || 0;
    const tb = Date.parse(b.timestamp) || 0;
    return tb - ta;
  });

  return unique.slice(0, limit);
};
