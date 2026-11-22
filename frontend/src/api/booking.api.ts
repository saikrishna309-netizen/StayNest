import { apiClient } from './client';
import { PageResponse, ResidentEnquiry } from '../types';

export interface CreateHoldPayload {
  bedId: string;
  checkIn: string;
  checkOut: string;
}

export interface CreateBookingPayload {
  bedId: string;
  checkIn: string;
  checkOut: string;
  paymentChoice?: 'ONLINE' | 'PAY_AT_PROPERTY';
}

export interface HoldResult {
  holdId: string;
  bedId: string;
  checkIn: string;
  checkOut: string;
  expiresAt: string;
  status: string;
}

export interface BookingResult {
  bookingId: string;
  bookingCode: string;
  customerId: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  status: string;
  paymentStatus: string;
  paymentChoice: string;
  totalPaise: number;
  checkIn: string;
  checkOut: string;
  createdAt: string;
}

export const bookingApi = {
  // Create 15-minute hold on a bed
  createHold: async (payload: CreateHoldPayload): Promise<HoldResult> => {
    return apiClient<HoldResult>('/bookings/holds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Create booking / confirm pay-at-property
  createBooking: async (payload: CreateBookingPayload): Promise<BookingResult> => {
    return apiClient<BookingResult>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // List customer bookings
  getCustomerBookings: async (): Promise<PageResponse<BookingResult>> => {
    return apiClient<PageResponse<BookingResult>>('/customer/bookings');
  },

  // List owner bookings/enquiries
  getOwnerBookings: async (): Promise<PageResponse<BookingResult>> => {
    return apiClient<PageResponse<BookingResult>>('/owner/bookings');
  },

  // Cancel booking
  cancelBooking: async (bookingId: string, reason?: string): Promise<BookingResult> => {
    return apiClient<BookingResult>(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // --------------------------------------------------------------------------
  // Local Shared Enquiries Storage (Synchronized between Website & Owner App)
  // --------------------------------------------------------------------------
  getLocalEnquiries: (): ResidentEnquiry[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem('staynest_customer_enquiries');
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveLocalEnquiry: (enquiry: ResidentEnquiry): void => {
    if (typeof window === 'undefined') return;
    try {
      const current = bookingApi.getLocalEnquiries();
      const updated = [enquiry, ...current.filter((e) => e.id !== enquiry.id)];
      localStorage.setItem('staynest_customer_enquiries', JSON.stringify(updated));

      // Dispatch event to notify other components/tabs
      window.dispatchEvent(new CustomEvent('staynest_new_enquiry', { detail: enquiry }));
    } catch (err) {
      console.warn('Failed to save local enquiry:', err);
    }
  },

  updateLocalEnquiryStatus: (id: string, status: ResidentEnquiry['status']): void => {
    if (typeof window === 'undefined') return;
    try {
      const current = bookingApi.getLocalEnquiries();
      const updated = current.map((e) => (e.id === id ? { ...e, status } : e));
      localStorage.setItem('staynest_customer_enquiries', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('staynest_enquiry_updated', { detail: { id, status } }));
    } catch (err) {
      console.warn('Failed to update local enquiry:', err);
    }
  },
};
