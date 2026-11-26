import { Linking, Platform } from 'react-native';
import { apiClient } from '../api/client';
import { safeStorage } from '../utils/safeStorage';
import { emitDataChanged } from '../utils/appEvents';

export type PlanTier = 'FREE' | 'PRO_TRIAL' | 'PRO_ACTIVE';
export type AutoPayApp = 'PHONEPE' | 'GPAY' | 'PAYTM' | 'UPI';

export interface SubscriptionState {
  plan: PlanTier;
  autopayStatus: 'NONE' | 'PENDING' | 'ACTIVE' | 'CANCELLED';
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
 * Calls POST /subscriptions/create-mandate, opens Razorpay hosted UPI AutoPay checkout (shortUrl)
 * or UPI app intent, and keeps the subscription in PENDING state until verified by Razorpay.
 */
export const startProTrialWithAutoPay = async (
  preferredApp: AutoPayApp
): Promise<{
  state: SubscriptionState;
  launchedUpiApp: boolean;
  shortUrl?: string;
  gatewayMode?: string;
}> => {
  let subscriptionId = `sub_${Date.now()}`;
  let nextBillingDate = getFutureDateIso(30);
  let shortUrl: string | undefined;
  let mandateAuthUrl = '';
  let gatewayMode = 'SANDBOX_FALLBACK';

  const res = await apiClient<{
    subscriptionId?: string;
    nextBillingDate?: string;
    shortUrl?: string;
    mandateAuthUrl?: string;
    gatewayMode?: string;
  }>('/subscriptions/create-mandate', {
    method: 'POST',
    body: JSON.stringify({ preferredApp }),
  });

  if (res?.subscriptionId) subscriptionId = res.subscriptionId;
  if (res?.nextBillingDate) nextBillingDate = res.nextBillingDate;
  if (res?.shortUrl) shortUrl = res.shortUrl;
  if (res?.mandateAuthUrl) mandateAuthUrl = res.mandateAuthUrl;
  if (res?.gatewayMode) gatewayMode = res.gatewayMode;

  let launchedUpiApp = false;
  const targetUrl = shortUrl || mandateAuthUrl;

  if (shortUrl) {
    try {
      await Linking.openURL(shortUrl);
      launchedUpiApp = true;
    } catch {
      launchedUpiApp = false;
    }
  } else if (Platform.OS !== 'web' && targetUrl) {
    let appSpecificUrl = targetUrl;
    if (preferredApp === 'PHONEPE') {
      appSpecificUrl = targetUrl.replace(/^upi:\/\//, 'phonepe://');
    } else if (preferredApp === 'GPAY') {
      appSpecificUrl = targetUrl.replace(/^upi:\/\//, 'tez://upi/');
    } else if (preferredApp === 'PAYTM') {
      appSpecificUrl = targetUrl.replace(/^upi:\/\//, 'paytmmp://');
    }

    try {
      const canOpenSpecific = await Linking.canOpenURL(appSpecificUrl);
      if (canOpenSpecific) {
        await Linking.openURL(appSpecificUrl);
        launchedUpiApp = true;
      } else {
        const canOpenGeneric = await Linking.canOpenURL(targetUrl);
        if (canOpenGeneric) {
          await Linking.openURL(targetUrl);
          launchedUpiApp = true;
        }
      }
    } catch {
      launchedUpiApp = false;
    }
  }

  // Keep plan as FREE and autopayStatus as PENDING until Razorpay confirms the mandate
  const pendingState: SubscriptionState = {
    plan: 'FREE',
    autopayStatus: 'PENDING',
    nextBillingDate,
    subscriptionId,
    autoPayMethod: preferredApp,
    updatedAt: new Date().toISOString(),
  };
  await saveSubscriptionState(pendingState);
  return { state: pendingState, launchedUpiApp, shortUrl, gatewayMode };
};

/**
 * Verifies a pending Razorpay UPI AutoPay mandate on the backend (via /subscriptions/verify-mandate
 * and/or webhook-updated /owner/subscription) before unlocking PRO_TRIAL.
 */
export const verifyAndSyncSubscription = async (
  subscriptionId?: string,
  razorpayPaymentId?: string,
  razorpaySignature?: string
): Promise<{ verified: boolean; state: SubscriptionState }> => {
  const current = await getSubscriptionState();
  const targetSubId = subscriptionId || current.subscriptionId;

  try {
    const verifyRes = await apiClient<{
      verified?: boolean;
      plan?: PlanTier;
      status?: string;
      autopayStatus?: 'NONE' | 'PENDING' | 'ACTIVE' | 'CANCELLED';
      subscriptionId?: string;
      nextBillingDate?: string;
    }>('/subscriptions/verify-mandate', {
      method: 'POST',
      body: JSON.stringify({
        subscriptionId: targetSubId,
        razorpayPaymentId,
        razorpaySignature,
      }),
    });

    if (verifyRes?.verified) {
      const activeState: SubscriptionState = {
        plan: verifyRes.plan === 'PRO_ACTIVE' ? 'PRO_ACTIVE' : 'PRO_TRIAL',
        autopayStatus: 'ACTIVE',
        nextBillingDate: verifyRes.nextBillingDate || current.nextBillingDate,
        subscriptionId: verifyRes.subscriptionId || targetSubId,
        autoPayMethod: current.autoPayMethod,
        updatedAt: new Date().toISOString(),
      };
      await saveSubscriptionState(activeState);
      return { verified: true, state: activeState };
    }
  } catch {
    // Fall through to /owner/subscription check in case webhook already activated it
  }

  try {
    const serverSub = await apiClient<{
      status?: string;
      planTier?: PlanTier;
      autopayStatus?: 'NONE' | 'PENDING' | 'ACTIVE' | 'CANCELLED';
      endDate?: string;
      gatewaySubscriptionId?: string;
    }>('/owner/subscription');

    const isServerActive =
      (serverSub?.status === 'ACTIVE' || serverSub?.status === 'CANCEL_AT_PERIOD_END') &&
      (serverSub?.planTier === 'PRO_TRIAL' || serverSub?.planTier === 'PRO_ACTIVE');

    if (isServerActive && serverSub.planTier) {
      const syncedState: SubscriptionState = {
        plan: serverSub.planTier,
        autopayStatus: serverSub.autopayStatus || 'ACTIVE',
        nextBillingDate: serverSub.endDate || current.nextBillingDate,
        subscriptionId: serverSub.gatewaySubscriptionId || targetSubId,
        autoPayMethod: current.autoPayMethod,
        updatedAt: new Date().toISOString(),
      };
      await saveSubscriptionState(syncedState);
      return { verified: true, state: syncedState };
    }
  } catch {
    // ignore
  }

  return { verified: false, state: current };
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
