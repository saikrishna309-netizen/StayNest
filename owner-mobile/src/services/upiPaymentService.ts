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
  const tn = note || `Rent Due - ${monthYear}`;
  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(ownerName || 'StayNest Owner')}&am=${amt}&cu=INR&tn=${encodeURIComponent(tn)}`;
};

export const buildRentReminderMessage = ({
  tenantName,
  propertyName,
  roomLabel,
  monthYear,
  roomRent,
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
  electricity?: number;
  maintenance?: number;
  totalDue: number;
  ownerUpiId?: string;
  ownerName: string;
}): string => {
  const breakdownLines = [
    `• Room / Flat Rent: ₹${roomRent.toLocaleString('en-IN')}`,
    ...(electricity > 0 ? [`• Electricity: ₹${electricity.toLocaleString('en-IN')}`] : []),
    ...(maintenance > 0 ? [`• Maintenance: ₹${maintenance.toLocaleString('en-IN')}`] : []),
    `*Total Pending Due: ₹${totalDue.toLocaleString('en-IN')}*`,
  ].join('\n');

  const upiBlock =
    ownerUpiId && validateUpiId(ownerUpiId)
      ? `\n\n💳 *Pay Instantly via PhonePe / GPay / UPI:*\n${buildUpiPaymentLink({
          upiId: ownerUpiId,
          ownerName,
          amountRupees: totalDue,
          monthYear,
        })}\n(UPI ID: \`${ownerUpiId.trim()}\`)`
      : '';

  return (
    `Hello ${tenantName},\n` +
    `Friendly reminder from *${propertyName}* (${roomLabel}) for *${monthYear}*:\n\n` +
    `${breakdownLines}` +
    `${upiBlock}\n\n` +
    `Thank you!\n— *${ownerName}*`
  );
};
