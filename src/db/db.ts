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
  photo?: string | null; // Base64 WebP image. Explicitly set to null on soft delete to purge 95% storage!
  joinedDate: string; // YYYY-MM-DD
  planId: string;
  planName: string;
  startDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  isPaid: boolean; // Tracking paid vs unpaid cash debt
  amountDue?: number;
  notes?: string;
  isDeleted: boolean; // Soft delete flag
  deletedAt?: string; // ISO or YYYY-MM-DD timestamp
  createdAt: number;
  updatedAt: number;
}

export interface Subscription {
  id: string;
  memberId: string;
  planId: string;
  planName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalPrice: number; // Hardcoded snapshot at purchase time
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  createdAt: number;
}

export interface Payment {
  id: string;
  subscriptionId?: string;
  memberId: string;
  memberName: string;
  amountPaid: number; // Stored numeric amount paid
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: 'CASH'; // Strictly Cash-Only
  note?: string;
  timestamp: number;
}

// Backward compatibility alias for UI views
export type PaymentRecord = Payment & {
  planId?: string;
  planName?: string;
  amount: number; // Getter alias for amountPaid
  dateStr: string; // Getter alias for paymentDate
};

export interface SyncQueueItem {
  id: string;
  action: 'CREATE_MEMBER' | 'UPDATE_MEMBER' | 'PAYMENT' | 'SUBSCRIPTION';
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
  subscriptions!: Table<Subscription, string>;
  payments!: Table<Payment, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('GymReceptionDB');
    // Version 4: Removed checkIns table completely, added subscriptions table, soft-delete & cash-only payments
    this.version(4).stores({
      members: 'id, fullName, phone, expiryDate, planId, isPaid, isDeleted, joinedDate, updatedAt',
      plans: 'id, name, durationMonths, price',
      subscriptions: 'id, memberId, planId, startDate, endDate, status',
      payments: 'id, subscriptionId, memberId, paymentDate, timestamp',
      syncQueue: 'id, action, timestamp, synced',
      settings: 'key'
    });
  }
}

export const db = new GymDatabase();

/**
 * Calculates remaining days and subscription status
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
