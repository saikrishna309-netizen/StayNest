// ============================================================================
// StayNest Core TypeScript Domain Types (Mapped to Spring Boot DTOs)
// ============================================================================

export type UserRole = 'ROLE_CUSTOMER' | 'ROLE_OWNER' | 'ROLE_ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ----------------------------------------------------------------------------
// Discovery & Property Types
// ----------------------------------------------------------------------------
export type GenderPolicy = 'BOYS' | 'GIRLS' | 'CO_ED';
export type PropertyType = 'PG' | 'HOSTEL' | 'COLIVING';
export type ApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type SharingType = 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'FOUR_PLUS';
export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'UNDER_MAINTENANCE' | 'HELD';

export interface City {
  id: string;
  name: string;
  state: string;
}

export interface Locality {
  id: string;
  cityId: string;
  name: string;
  pincode: string;
}

export interface Bed {
  id: string;
  bedLabel: string;
  active: boolean;
  status: BedStatus;
}

export interface Room {
  id: string;
  roomNumber: string;
  sharingType: SharingType;
  capacity: number;
  floorNumber: number;
  rentMonthlyPaise: number;
  depositPaise: number;
  status: string;
  beds: Bed[];
}

export interface PropertySummary {
  id: string;
  ownerId: string;
  name: string;
  propertyType: PropertyType;
  genderPolicy: GenderPolicy;
  cityId: string;
  cityName: string;
  localityId: string;
  localityName: string;
  addressLine: string;
  primaryPhotoUrl: string | null;
  startingPricePaise: number;
  foodIncluded: boolean;
  approvalStatus: ApprovalStatus;
  published: boolean;
  amenities: string[];
  googleMapsUrl?: string;
  createdAt: string;
}

export interface PropertyDetail extends PropertySummary {
  description: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl?: string;
  noticePeriodDays: number;
  depositMonths: number;
  payAtPropertyAllowed: boolean;
  rules: string;
  cancellationPolicy: string;
  rooms: Room[];
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ----------------------------------------------------------------------------
// Tenant & Stay Types
// ----------------------------------------------------------------------------
export interface Tenant {
  id: string;
  ownerId: string;
  fullName: string;
  phone: string;
  email: string | null;
  emergencyContact: string | null;
  idProofType: string;
  idProofNumber: string;
  active: boolean;
  createdAt: string;
}

export interface TenantStay {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  checkIn: string;
  checkOut?: string | null;
  monthlyRentPaise: number;
  securityDepositPaise: number;
  status: 'ACTIVE' | 'VACATED' | 'NOTICE';
  createdAt?: string;
}

// ----------------------------------------------------------------------------
// Rent Invoices & Finance Types
// ----------------------------------------------------------------------------
export interface RentInvoice {
  id: string;
  tenantId: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  invoiceNumber: string;
  billingMonth: string;
  amountPaise: number;
  lateFeePaise: number;
  dueDate: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
}

export interface Expense {
  id: string;
  category: string;
  amountPaise: number;
  description?: string;
  paidTo?: string;
  paymentMode: string;
  createdAt: string;
}

export interface Income {
  id: string;
  category: string;
  amountPaise: number;
  notes?: string;
  paymentMode: string;
  createdAt: string;
}

export interface FinancialOverview {
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
  monthlyRevenuePaise: number;
  monthlyExpensesPaise: number;
  netProfitPaise: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  planCode: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  priceMonthlyPaise: number;
  maxProperties: number;
  maxBeds: number;
  features: string[];
}

export interface ResidentEnquiry {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomNumber: string;
  bedId: string;
  bedLabel: string;
  monthlyRentPaise: number;
  depositPaise: number;
  checkInDate: string;
  status: 'PENDING_HOLD' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  holdExpiresAt: string;
  notes?: string;
  createdAt: string;
}


