import { Linking, Platform } from 'react-native';
import { apiClient } from '../api/client';
import { safeStorage } from '../utils/safeStorage';
import { emitDataChanged } from '../utils/appEvents';

export type PlanTier = 'FREE' | 'PRO_TRIAL' | 'PRO_ACTIVE';
export type AutoPayApp = 'PHONEPE' | 'GPAY' | 'PAYTM' | 'UPI';

export interface SubscriptionState {
  plan: PlanTier;
  autopayStatus: 'NONE' | 'ACTIVE' | 'CANCELLED';
  nextBillingDate: string; // YYYY-MM-DD
  subscriptionId?: string;
  autoPayMethod?: AutoPayApp;
  updatedAt: string;
}

export const FREE_MAX_PROPERTIES = 1;
export const FREE_MAX_WHATSAPP_REMINDERS_PER_MONTH = 5;

const SUB_STORAGE_KEY = '@staynest_owner_subscription_v2';
const MERCHANT_UPI_ID = 'staynest.subscription@okaxis';

const getFutureDateIso = (daysAhead: number): string => {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return d.toISOString().split('T')[0];
};

export const formatDisplayDate = (isoDate: string): string => {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return isoDate;
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const isProActive = (state: SubscriptionState): boolean => {
  return state.plan === 'PRO_TRIAL' || state.plan === 'PRO_ACTIVE';
};

export const getSubscriptionState = async (): Promise<SubscriptionState> => {
  const defaultFree: SubscriptionState = {
    plan: 'FREE',
    autopayStatus: 'NONE',
    nextBillingDate: getFutureDateIso(30),
    updatedAt: new Date().toISOString(),
  };

  try {
    const raw = await safeStorage.getItem(SUB_STORAGE_KEY);
    if (raw) {
      return { ...defaultFree, ...JSON.parse(raw) };
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const legacy = window.localStorage.getItem('staynest_owner_subscription_v2');
      if (legacy) return { ...defaultFree, ...JSON.parse(legacy) };
    }
  } catch {
    // ignore
  }
  return defaultFree;
};

export const saveSubscriptionState = async (state: SubscriptionState): Promise<void> => {
  const serialized = JSON.stringify(state);
  await safeStorage.setItem(SUB_STORAGE_KEY, serialized);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('staynest_owner_subscription_v2', serialized);
    } catch {}
  }
  emitDataChanged();
};

export const getCurrentYearMonth = (): string => {
  return new Date().toISOString().slice(0, 7);
};

export const getMonthlyReminderCount = async (monthKey = getCurrentYearMonth()): Promise<number> => {
  const key = `@staynest_wa_reminders_${monthKey}`;
  try {
    const raw = await safeStorage.getItem(key);
    if (raw) {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const wRaw = window.localStorage.getItem(`staynest_wa_reminders_${monthKey}`);
      if (wRaw) {
        const n = parseInt(wRaw, 10);
        return Number.isFinite(n) ? n : 0;
      }
    }
  } catch {
    // ignore
  }
  return 0;
};

export const incrementMonthlyReminderCount = async (monthKey = getCurrentYearMonth()): Promise<number> => {
  const current = await getMonthlyReminderCount(monthKey);
  const next = current + 1;
  await safeStorage.setItem(`@staynest_wa_reminders_${monthKey}`, String(next));
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`staynest_wa_reminders_${monthKey}`, String(next));
    } catch {}
  }
  emitDataChanged();
  return next;
};

export const canAddProperty = (state: SubscriptionState, currentPropertiesCount: number): boolean => {
  if (isProActive(state)) return true;
  return currentPropertiesCount < FREE_MAX_PROPERTIES;
};

export const canSendWhatsAppReminder = async (
  state: SubscriptionState,
  monthKey = getCurrentYearMonth()
): Promise<{ allowed: boolean; used: number; limit: number }> => {
  const used = await getMonthlyReminderCount(monthKey);
  if (isProActive(state)) {
    return { allowed: true, used, limit: Infinity };
  }
  return {
    allowed: used < FREE_MAX_WHATSAPP_REMINDERS_PER_MONTH,
    used,
    limit: FREE_MAX_WHATSAPP_REMINDERS_PER_MONTH,
  };
};

/**
 * Calls POST /subscriptions/create-mandate, launches PhonePe / GPay / Paytm
 * UPI AutoPay mandate intent on Android/iOS, and activates PRO_TRIAL (₹0 today, ₹99/mo after 30d).
 */
export const startProTrialWithAutoPay = async (
  preferredApp: AutoPayApp
): Promise<{ state: SubscriptionState; launchedUpiApp: boolean }> => {
  let subscriptionId = `sub_${Date.now()}`;
  let nextBillingDate = getFutureDateIso(30);
  let mandateAuthUrl = '';

  try {
    const res = await apiClient<{
      subscriptionId?: string;
      nextBillingDate?: string;
      mandateAuthUrl?: string;
    }>('/subscriptions/create-mandate', {
      method: 'POST',
      body: JSON.stringify({ preferredApp }),
    });
    if (res?.subscriptionId) subscriptionId = res.subscriptionId;
    if (res?.nextBillingDate) nextBillingDate = res.nextBillingDate;
    if (res?.mandateAuthUrl) mandateAuthUrl = res.mandateAuthUrl;
  } catch {
    // Offline/local fallback
  }

  if (!mandateAuthUrl) {
    const tn = encodeURIComponent('StayNest Pro AutoPay 99/mo');
    const pn = encodeURIComponent('StayNest PG');
    mandateAuthUrl = `upi://mandate?pa=${MERCHANT_UPI_ID}&pn=${pn}&am=99.00&cu=INR&recur=MONTHLY&tr=${subscriptionId}&tn=${tn}`;
  }

  let appSpecificUrl = mandateAuthUrl;
  if (preferredApp === 'PHONEPE') {
    appSpecificUrl = mandateAuthUrl.replace(/^upi:\/\//, 'phonepe://');
  } else if (preferredApp === 'GPAY') {
    appSpecificUrl = mandateAuthUrl.replace(/^upi:\/\//, 'tez://upi/');
  } else if (preferredApp === 'PAYTM') {
    appSpecificUrl = mandateAuthUrl.replace(/^upi:\/\//, 'paytmmp://');
  }

  let launchedUpiApp = false;
  if (Platform.OS !== 'web') {
    try {
      const canOpenSpecific = await Linking.canOpenURL(appSpecificUrl);
      if (canOpenSpecific) {
        await Linking.openURL(appSpecificUrl);
        launchedUpiApp = true;
      } else {
        const canOpenGeneric = await Linking.canOpenURL(mandateAuthUrl);
        if (canOpenGeneric) {
          await Linking.openURL(mandateAuthUrl);
          launchedUpiApp = true;
        }
      }
    } catch {
      launchedUpiApp = false;
    }
  }

  const nextState: SubscriptionState = {
    plan: 'PRO_TRIAL',
    autopayStatus: 'ACTIVE',
    nextBillingDate,
    subscriptionId,
    autoPayMethod: preferredApp,
    updatedAt: new Date().toISOString(),
  };
  await saveSubscriptionState(nextState);
  return { state: nextState, launchedUpiApp };
};

export const cancelProAutoPay = async (): Promise<SubscriptionState> => {
  const current = await getSubscriptionState();
  try {
    await apiClient('/subscriptions/cancel-autopay', { method: 'POST' });
  } catch {
    // Graceful local update
  }
  const updated: SubscriptionState = {
    ...current,
    autopayStatus: 'CANCELLED',
    updatedAt: new Date().toISOString(),
  };
  await saveSubscriptionState(updated);
  return updated;
};
