import Dexie, { Table } from 'dexie';

export interface MembershipPlan {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
}

export type SubscriptionStatus = 'active' | 'expiring' | 'expired' | 'unpaid';

export interface Member {
  id: string; // e.g. "LION-101"
  fullName: string;
  phone: string;
  emergencyContact: string;
  email?: string;
  avatarWebP?: string; // WebP base64 encoded image
  joinedDate: string; // YYYY-MM-DD
  planId: string;
  planName: string;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  isPaid: boolean; // Tracking paid vs unpaid for paper notebook replacement
  amountDue?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CheckIn {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  planName: string;
  statusAtCheckIn: SubscriptionStatus;
  timestamp: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm:ss
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberName: string;
  planId: string;
  planName: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'upi_transfer';
  timestamp: number;
  dateStr: string;
  validFrom: string;
  validUntil: string;
}

export interface SyncQueueItem {
  id: string;
  action: 'CREATE_MEMBER' | 'UPDATE_MEMBER' | 'CHECK_IN' | 'PAYMENT';
  payload: any;
  timestamp: number;
  synced: boolean;
  retryCount: number;
}

export interface AppSetting {
  key: string;
  value: any;
}

export class GymDatabase extends Dexie {
  members!: Table<Member, string>;
  plans!: Table<MembershipPlan, string>;
  checkIns!: Table<CheckIn, string>;
  payments!: Table<PaymentRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('GymReceptionDB');
    this.version(3).stores({
      members: 'id, fullName, phone, expiryDate, planId, isPaid, joinedDate, updatedAt',
      plans: 'id, name, durationMonths, price',
      checkIns: 'id, memberId, timestamp, dateStr, statusAtCheckIn',
      payments: 'id, memberId, timestamp, dateStr',
      syncQueue: 'id, action, timestamp, synced',
      settings: 'key'
    });
  }
}

export const db = new GymDatabase();

/**
 * Calculates remaining days and subscription status
 * Accepts either a Member object or an expiryDate string
 */
export function getSubscriptionStatus(input: { expiryDate: string; isPaid?: boolean } | string): {
  status: SubscriptionStatus;
  daysRemaining: number;
  badgeLabel: string;
} {
  const expiryDateStr = typeof input === 'string' ? input : input.expiryDate;
  const isPaid = typeof input === 'string' ? true : input.isPaid !== false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (!isPaid) {
    return {
      status: 'unpaid',
      daysRemaining,
      badgeLabel: 'Non Payé (Unpaid)'
    };
  }

  if (daysRemaining > 7) {
    return {
      status: 'active',
      daysRemaining,
      badgeLabel: `${daysRemaining}j restants (Payé)`
    };
  } else if (daysRemaining >= 0) {
    return {
      status: 'expiring',
      daysRemaining,
      badgeLabel: `${daysRemaining}j (Expire Bientôt)`
    };
  } else {
    const expiredDaysAgo = Math.abs(daysRemaining);
    return {
      status: 'expired',
      daysRemaining,
      badgeLabel: `Expiré il y a ${expiredDaysAgo}j`
    };
  }
}
