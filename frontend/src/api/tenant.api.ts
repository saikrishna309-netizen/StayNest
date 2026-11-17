import { apiClient } from './client';
import { PageResponse, Tenant, TenantStay } from '../types';

export interface CreateTenantPayload {
  fullName: string;
  phone: string;
  email?: string | null;
  emergencyContact?: string | null;
  idProofType: string;
  idProofNumber: string;
}

export interface RecordStayPayload {
  propertyId: string;
  roomId: string;
  bedId: string;
  checkIn: string;
  checkOut?: string;
  monthlyRentPaise: number;
  securityDepositPaise?: number;
}

export const tenantApi = {
  listTenants: (q?: string) => 
    apiClient<PageResponse<Tenant>>('/owner/tenants', { params: { q } }),

  getTenant: (id: string) => 
    apiClient<Tenant>(`/owner/tenants/${id}`),

  createTenant: (payload: CreateTenantPayload) => 
    apiClient<Tenant>('/owner/tenants', { method: 'POST', body: JSON.stringify(payload) }),

  recordStay: (tenantId: string, payload: RecordStayPayload) => 
    apiClient<TenantStay>(`/owner/tenants/${tenantId}/stays`, { method: 'POST', body: JSON.stringify(payload) }),

  getTenantStays: (tenantId: string) => 
    apiClient<TenantStay[]>(`/owner/tenants/${tenantId}/stays`),
};
