import { apiClient } from '../api/client';
import { safeStorage } from '../utils/safeStorage';
import { Property, Tenant, RentInvoice, Expense } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class FastDataCache {
  private properties: CacheEntry<Property[]> | null = null;
  private tenants: CacheEntry<Tenant[]> | null = null;
  private invoices: CacheEntry<RentInvoice[]> | null = null;
  private expenses: CacheEntry<Expense[]> | null = null;

  private inFlight = new Map<string, Promise<any>>();
  private TTL_MS = 60 * 1000; // 60 seconds fresh window

  private async fetchWithSwr<T>(
    key: string,
    current: CacheEntry<T> | null,
    setter: (entry: CacheEntry<T>) => void,
    fetcher: () => Promise<T>,
    forceRefresh: boolean,
    fallbackValue: T
  ): Promise<T> {
    const now = Date.now();
    if (!forceRefresh && current && now - current.timestamp < this.TTL_MS) {
      return current.data;
    }

    // Deduplicate concurrent requests for the same key
    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    // Load persisted SWR snapshot if memory cache is cold
    if (!current && !forceRefresh) {
      try {
        const stored = await safeStorage.getItem(`@staynest_swr_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as CacheEntry<T>;
          if (parsed && parsed.data) {
            setter(parsed);
            // Trigger background refresh without blocking initial render
            void this.fetchWithSwr(key, parsed, setter, fetcher, true, fallbackValue);
            return parsed.data;
          }
        }
      } catch {}
    }

    const networkPromise = (async () => {
      try {
        const fresh = await fetcher();
        const entry: CacheEntry<T> = { data: fresh, timestamp: Date.now() };
        setter(entry);
        safeStorage.setItem(`@staynest_swr_${key}`, JSON.stringify(entry)).catch(() => {});
        return fresh;
      } catch {
        return current?.data ?? fallbackValue;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, networkPromise);

    // Stale-while-revalidate: if stale data exists in memory, return it immediately while refreshing
    if (!forceRefresh && current) {
      return current.data;
    }
    return networkPromise;
  }

  // ─── PROPERTIES ───
  async getProperties(forceRefresh = false): Promise<Property[]> {
    return this.fetchWithSwr(
      'properties',
      this.properties,
      (e) => { this.properties = e; },
      async () => (await apiClient<{ content: Property[] }>('/owner/properties')).content || [],
      forceRefresh,
      []
    );
  }

  setProperties(props: Property[]) {
    const entry = { data: props, timestamp: Date.now() };
    this.properties = entry;
    safeStorage.setItem('@staynest_swr_properties', JSON.stringify(entry)).catch(() => {});
  }

  // ─── TENANTS ───
  async getTenants(forceRefresh = false): Promise<Tenant[]> {
    return this.fetchWithSwr(
      'tenants',
      this.tenants,
      (e) => { this.tenants = e; },
      async () => (await apiClient<{ content: Tenant[] }>('/owner/tenants')).content || [],
      forceRefresh,
      []
    );
  }

  setTenants(tenants: Tenant[]) {
    const entry = { data: tenants, timestamp: Date.now() };
    this.tenants = entry;
    safeStorage.setItem('@staynest_swr_tenants', JSON.stringify(entry)).catch(() => {});
  }

  // ─── INVOICES ───
  async getInvoices(forceRefresh = false): Promise<RentInvoice[]> {
    return this.fetchWithSwr(
      'invoices',
      this.invoices,
      (e) => { this.invoices = e; },
      async () => (await apiClient<{ content: RentInvoice[] }>('/owner/invoices')).content || [],
      forceRefresh,
      []
    );
  }

  setInvoices(invoices: RentInvoice[]) {
    const entry = { data: invoices, timestamp: Date.now() };
    this.invoices = entry;
    safeStorage.setItem('@staynest_swr_invoices', JSON.stringify(entry)).catch(() => {});
  }

  // ─── EXPENSES ───
  async getExpenses(forceRefresh = false): Promise<Expense[]> {
    return this.fetchWithSwr(
      'expenses',
      this.expenses,
      (e) => { this.expenses = e; },
      async () => (await apiClient<{ content: Expense[] }>('/owner/expenses')).content || [],
      forceRefresh,
      []
    );
  }

  setExpenses(expenses: Expense[]) {
    const entry = { data: expenses, timestamp: Date.now() };
    this.expenses = entry;
    safeStorage.setItem('@staynest_swr_expenses', JSON.stringify(entry)).catch(() => {});
  }

  // Invalidate all caches after mutations (onboard, checkout, pay, add expense)
  invalidateAll() {
    this.properties = null;
    this.tenants = null;
    this.invoices = null;
    this.expenses = null;
  }
}

export const fastDataCache = new FastDataCache();
