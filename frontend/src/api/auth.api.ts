import { apiClient } from './client';
import { AuthResponse, User } from '../types';

export interface LoginPayload {
  username: string; // accepts email or phone
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  role: 'ROLE_CUSTOMER' | 'ROLE_OWNER';
  businessName?: string;
}

export const authApi = {
  login: (payload: LoginPayload) => 
    apiClient<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),

  register: (payload: RegisterPayload) => 
    apiClient<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),

  logout: () => 
    apiClient<{ message: string }>('/auth/logout', { method: 'POST' }),

  sendOtp: (phone: string, role = 'ROLE_CUSTOMER', otp?: string) =>
    apiClient<{ message: string; otp?: string; demoOtp?: string }>('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone, role, otp }),
    }),

  verifyOtp: (phone: string, otp: string) =>
    apiClient<AuthResponse>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),

  getCurrentUser: () => 
    apiClient<User>('/users/me'),
};

