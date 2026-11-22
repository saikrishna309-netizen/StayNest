import { apiClient } from './client';
import { City, Locality, PageResponse, PropertyDetail, PropertySummary, Room } from '../types';

export interface PropertySearchParams {
  [key: string]: any;
  cityId?: string;
  localityId?: string;
  genderPolicy?: string;
  minRent?: number;
  maxRent?: number;
  foodIncluded?: boolean;
  q?: string;
  page?: number;
  size?: number;
}

export interface CreatePropertyPayload {
  name: string;
  propertyType: string;
  genderPolicy: string;
  cityId: string;
  localityId: string;
  addressLine: string;
  pincode: string;
  startingPricePaise: number;
  foodIncluded: boolean;
  description: string;
  rules?: string;
  amenities: string[];
}

export interface CreateRoomPayload {
  roomNumber: string;
  sharingType: string;
  capacity: number;
  floorNumber: number;
  rentMonthlyPaise: number;
  depositPaise: number;
}

export const propertyApi = {
  // Public Discovery
  getCities: () => 
    apiClient<City[]>('/cities'),

  getLocalities: (cityId: string) => 
    apiClient<Locality[]>('/localities', { params: { cityId } }),

  searchProperties: (params: PropertySearchParams = {}) => 
    apiClient<PageResponse<PropertySummary>>('/properties', { params }),

  getPropertyDetail: (id: string) => 
    apiClient<PropertyDetail>(`/properties/${id}`),

  // Owner Inventory Management
  getOwnerProperties: () => 
    apiClient<PageResponse<PropertySummary>>('/owner/properties'),

  createProperty: (payload: CreatePropertyPayload) => 
    apiClient<PropertyDetail>('/owner/properties', { method: 'POST', body: JSON.stringify(payload) }),

  updateProperty: (id: string, payload: Partial<CreatePropertyPayload>) => 
    apiClient<PropertyDetail>(`/owner/properties/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  submitProperty: (id: string) => 
    apiClient<{ message: string }>(`/owner/properties/${id}/submit`, { method: 'POST' }),

  createRoom: (propertyId: string, payload: CreateRoomPayload) => 
    apiClient<Room>(`/owner/properties/${propertyId}/rooms`, { method: 'POST', body: JSON.stringify(payload) }),

  createBed: (roomId: string, bedLabel: string) => 
    apiClient<unknown>(`/owner/rooms/${roomId}/beds`, { method: 'POST', body: JSON.stringify({ bedLabel }) }),
};

