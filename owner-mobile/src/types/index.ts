export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export interface Bed {
  id: string;
  roomId: string;
  propertyId?: string;
  bedLabel: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'RESERVED';
}

export interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  sharingType: string;
  capacity: number;
  floorNumber: number;
  rentMonthlyPaise: number;
  depositPaise: number;
  status: string;
  beds?: Bed[];
}

export interface Property {
  id: string;
  name: string;
  propertyType: string;
  genderPolicy: string;
  cityName?: string;
  localityName?: string;
  addressLine: string;
  pincode?: string;
  startingPricePaise?: number;
  foodIncluded: boolean;
  approvalStatus?: string;
  published?: boolean;
  status?: string;
  amenities?: string[];
  rules?: string;
  noticePeriodDays?: number;
  depositMonths?: number;
  rooms?: Room[];
}

export interface Tenant {
  id: string;
  ownerId: string;
  fullName: string;
  phone: string;
  email?: string;
  idProofType: string;
  idProofNumber: string;
  status: string;
}

export interface TenantStay {
  id: string;
  tenantId: string;
  bedId: string;
  propertyId: string;
  checkIn: string;
  checkOut?: string;
  monthlyRentPaise: number;
  depositPaise: number;
  status: 'ACTIVE' | 'TERMINATED';
}

export interface RentInvoice {
  id: string;
  invoiceNumber: string;
  tenantName: string;
  propertyName: string;
  periodMonth: number;
  periodYear: number;
  totalAmountPaise: number;
  paidAmountPaise: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
}

export interface Expense {
  id: string;
  title: string;
  amountPaise: number;
  category: string;
  date: string;
  paidTo?: string;
}
