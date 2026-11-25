import { safeStorage } from '../utils/safeStorage';

export interface OwnerPayoutDetails {
  upiId: string;
  upiVerified: boolean;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

const PAYOUT_STORAGE_KEY = '@staynest_owner_payout_details';
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export const validateUpiId = (upiId: string): boolean => {
  return UPI_REGEX.test(upiId.trim());
};

/**
 * Strips spaces/dashes, takes last 10 digits, and prepends '91' for wa.me links.
 */
export const normalizeIndianPhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return last10.length === 10 ? `91${last10}` : digits;
};

export const getOwnerPayoutDetails = async (): Promise<OwnerPayoutDetails> => {
  const fallback: OwnerPayoutDetails = {
    upiId: '',
    upiVerified: false,
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
  };

  try {
    const raw = await safeStorage.getItem(PAYOUT_STORAGE_KEY);
    if (raw) {
      return { ...fallback, ...JSON.parse(raw) };
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const webRaw = window.localStorage.getItem('staynest_owner_payout_details');
      if (webRaw) {
        return { ...fallback, ...JSON.parse(webRaw) };
      }
    }
  } catch {
    // ignore
  }
  return fallback;
};

export const saveOwnerPayoutDetails = async (details: OwnerPayoutDetails): Promise<void> => {
  const serialized = JSON.stringify(details);
  await safeStorage.setItem(PAYOUT_STORAGE_KEY, serialized);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('staynest_owner_payout_details', serialized);
    } catch {}
  }
};

export const buildUpiPaymentLink = ({
  upiId,
  ownerName,
  amountRupees,
  monthYear,
  note,
}: {
  upiId: string;
  ownerName: string;
  amountRupees: number;
  monthYear: string;
  note?: string;
}): string => {
  const cleanUpi = upiId.trim();
  const amt = Math.max(1, Math.round(amountRupees));
  const tn = note || `Rent ${monthYear}`;
  return `upi://pay?pa=${cleanUpi}&pn=${encodeURIComponent(ownerName || 'StayNest Owner')}&am=${amt}&cu=INR&tn=${encodeURIComponent(tn)}`;
};

export const buildRentReminderMessage = ({
  tenantName,
  propertyName,
  roomLabel,
  monthYear,
  roomRent,
  units = 0,
  electricity = 0,
  maintenance = 0,
  totalDue,
  ownerUpiId,
  ownerName,
}: {
  tenantName: string;
  propertyName: string;
  roomLabel: string;
  monthYear: string;
  roomRent: number;
  units?: number;
  electricity?: number;
  maintenance?: number;
  totalDue: number;
  ownerUpiId?: string;
  ownerName: string;
}): string => {
  const hasValidUpi = Boolean(ownerUpiId && validateUpiId(ownerUpiId));
  const upiBlock = hasValidUpi
    ? `\n\nPay directly via UPI ID: *${ownerUpiId!.trim()}*\nQuick UPI Pay Link (PhonePe / GPay / Paytm):\n${buildUpiPaymentLink({
        upiId: ownerUpiId!,
        ownerName,
        amountRupees: totalDue,
        monthYear,
      })}`
    : '';

  return (
    `Hi ${tenantName},\n` +
    `Here is your rent & electricity bill for *${monthYear}* (${propertyName} - ${roomLabel}):\n\n` +
    `• Room Rent: ₹${roomRent.toLocaleString('en-IN')}\n` +
    `• Current Bill (${units} units): ₹${electricity.toLocaleString('en-IN')}\n` +
    `• Maintenance: ₹${maintenance.toLocaleString('en-IN')}\n` +
    `*Total Due: ₹${totalDue.toLocaleString('en-IN')}*` +
    upiBlock
  );
};
