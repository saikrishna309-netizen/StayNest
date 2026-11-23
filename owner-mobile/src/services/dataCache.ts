import { apiClient } from '../api/client';
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

  private TTL_MS = 60 * 1000; // 60 seconds memory freshness

  // ─── PROPERTIES ───
  async getProperties(forceRefresh = false): Promise<Property[]> {
    const now = Date.now();
    if (!forceRefresh && this.properties && now - this.properties.timestamp < this.TTL_MS) {
      return this.properties.data;
    }

    try {
      const res = await apiClient<{ content: Property[] }>('/owner/properties');
      const loaded = res.content || [];
      this.properties = { data: loaded, timestamp: now };
      return loaded;
    } catch {
      return this.properties?.data || [];
    }
  }

  setProperties(props: Property[]) {
    this.properties = { data: props, timestamp: Date.now() };
  }

  // ─── TENANTS ───
  async getTenants(forceRefresh = false): Promise<Tenant[]> {
    const now = Date.now();
    if (!forceRefresh && this.tenants && now - this.tenants.timestamp < this.TTL_MS) {
      return this.tenants.data;
    }

    try {
      const res = await apiClient<{ content: Tenant[] }>('/owner/tenants');
      const loaded = res.content || [];
      this.tenants = { data: loaded, timestamp: now };
      return loaded;
    } catch {
      return this.tenants?.data || [];
    }
  }

  setTenants(tenants: Tenant[]) {
    this.tenants = { data: tenants, timestamp: Date.now() };
  }

  // ─── INVOICES ───
  async getInvoices(forceRefresh = false): Promise<RentInvoice[]> {
    const now = Date.now();
    if (!forceRefresh && this.invoices && now - this.invoices.timestamp < this.TTL_MS) {
      return this.invoices.data;
    }

    try {
      const res = await apiClient<{ content: RentInvoice[] }>('/owner/invoices');
      const loaded = res.content || [];
      this.invoices = { data: loaded, timestamp: now };
      return loaded;
    } catch {
      return this.invoices?.data || [];
    }
  }

  setInvoices(invoices: RentInvoice[]) {
    this.invoices = { data: invoices, timestamp: Date.now() };
  }

  // ─── EXPENSES ───
  async getExpenses(forceRefresh = false): Promise<Expense[]> {
    const now = Date.now();
    if (!forceRefresh && this.expenses && now - this.expenses.timestamp < this.TTL_MS) {
      return this.expenses.data;
    }

    try {
      const res = await apiClient<{ content: Expense[] }>('/owner/expenses');
      const loaded = res.content || [];
      this.expenses = { data: loaded, timestamp: now };
      return loaded;
    } catch {
      return this.expenses?.data || [];
    }
  }

  setExpenses(expenses: Expense[]) {
    this.expenses = { data: expenses, timestamp: Date.now() };
  }

  // Clear all on logout or refresh
  invalidateAll() {
    this.properties = null;
    this.tenants = null;
    this.invoices = null;
    this.expenses = null;
  }
}

export const fastDataCache = new FastDataCache();
