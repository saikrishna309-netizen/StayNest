import { apiClient } from './client';
import { Expense, FinancialOverview, Income, PageResponse, RentInvoice, SubscriptionPlan } from '../types';

export interface CreateInvoicePayload {
  tenantId: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  billingMonth: string;
  amountPaise: number;
  dueDate: string;
}

export interface RecordRentPaymentPayload {
  paymentMode: 'CASH' | 'UPI_QR' | 'BANK_TRANSFER';
  transactionReference?: string;
  notes?: string;
}

export interface RecordExpensePayload {
  category: string;
  amountPaise: number;
  paymentMode: string;
  paidTo?: string;
  description?: string;
}

export interface RecordIncomePayload {
  category: string;
  amountPaise: number;
  paymentMode: string;
  notes?: string;
}

export const financeApi = {
  // Rent Invoicing
  listInvoices: () => 
    apiClient<PageResponse<RentInvoice>>('/owner/rent-invoices'),

  createInvoice: (payload: CreateInvoicePayload) => 
    apiClient<RentInvoice>('/owner/rent-invoices', { method: 'POST', body: JSON.stringify(payload) }),

  recordPayment: (invoiceId: string, payload: RecordRentPaymentPayload) => 
    apiClient<RentInvoice>(`/owner/rent-invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(payload) }),

  // Expenses & Income
  listExpenses: () => 
    apiClient<PageResponse<Expense>>('/owner/expenses'),

  recordExpense: (payload: RecordExpensePayload) => 
    apiClient<Expense>('/owner/expenses', { method: 'POST', body: JSON.stringify(payload) }),

  listIncome: () => 
    apiClient<PageResponse<Income>>('/owner/income'),

  recordIncome: (payload: RecordIncomePayload) => 
    apiClient<Income>('/owner/income', { method: 'POST', body: JSON.stringify(payload) }),

  getFinancialOverview: () => 
    apiClient<FinancialOverview>('/owner/reports/monthly'),

  // Subscriptions
  getSubscriptionPlans: () => 
    apiClient<SubscriptionPlan[]>('/subscription-plans'),
};
