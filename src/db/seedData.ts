import { db, MembershipPlan, Member, PaymentRecord } from './db';

export const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'plan_12m',
    name: '12 Months Elite VIP',
    durationMonths: 12,
    price: 429,
    description: '12 mois • 429 DH',
    features: ['Accès illimité toute l année', 'Casier VIP réservé', 'Coaching privé']
  },
  {
    id: 'plan_1m',
    name: '1 Month Standard',
    durationMonths: 1,
    price: 49,
    description: '1 mois • 49 DH',
    features: ['Musculation complète', 'Cardio-training', 'Vestiaires & douches']
  },
  {
    id: 'plan_3m',
    name: '3 Months Pro Saver',
    durationMonths: 3,
    price: 129,
    description: '3 mois • 129 DH',
    features: ['Musculation & Cardio', 'Programme d entraînement'],
    popular: true
  },
  {
    id: 'plan_6m',
    name: '6 Months Performance',
    durationMonths: 6,
    price: 239,
    description: '6 mois • 239 DH',
    features: ['Accès prioritaire 7j/7', 'Plan nutritionnel de base']
  }
];

export const INITIAL_MEMBERS_SEEDED: Member[] = [
  {
    id: 'GYM-1005',
    fullName: 'Jordan Taylor',
    phone: '+1 (555) 678-9012',
    emergencyContact: '+1 (555) 999-0001',
    joinedDate: '2026-09-07',
    planId: 'plan_12m',
    planName: '12 Months Elite VIP',
    startDate: '2026-09-07',
    expiryDate: '2028-09-07',
    isPaid: true,
    amountDue: 0,
    notes: 'Morning workout regular (6:30 AM).',
    createdAt: Date.now() - 1000000,
    updatedAt: Date.now() - 1000000
  },
  {
    id: 'LION-144',
    fullName: 'Yasser Latrech',
    phone: '+212 6 40 10 27 87',
    emergencyContact: '+212 6 00 00 00 00',
    joinedDate: '2026-08-15',
    planId: 'plan_6m',
    planName: '6 Months Performance',
    startDate: '2026-08-15',
    expiryDate: '2027-02-15',
    isPaid: true,
    amountDue: 0,
    notes: 'Champion member.',
    createdAt: Date.now() - 2000000,
    updatedAt: Date.now() - 2000000
  },
  {
    id: 'GYM-1004',
    fullName: 'Sophia Chen',
    phone: '+1 (555) 567-8901',
    emergencyContact: '+1 (555) 999-0002',
    joinedDate: '2026-08-20',
    planId: 'plan_12m',
    planName: '12 Months Elite VIP',
    startDate: '2026-08-20',
    expiryDate: '2027-08-20',
    isPaid: true,
    amountDue: 0,
    notes: 'VIP Card Holder.',
    createdAt: Date.now() - 3000000,
    updatedAt: Date.now() - 3000000
  },
  {
    id: 'GYM-1002',
    fullName: 'Elena Rostova',
    phone: '+1 (555) 345-6789',
    emergencyContact: '+1 (555) 999-0003',
    joinedDate: '2026-08-04',
    planId: 'plan_1m',
    planName: '1 Month Standard',
    startDate: '2026-08-04',
    expiryDate: '2026-09-04',
    isPaid: false,
    amountDue: 250,
    notes: 'Renewing this week.',
    createdAt: Date.now() - 4000000,
    updatedAt: Date.now() - 4000000
  },
  {
    id: 'GYM-1001',
    fullName: 'Alexander Wright',
    phone: '+1 (555) 234-5678',
    emergencyContact: '+1 (555) 999-0004',
    joinedDate: '2026-07-15',
    planId: 'plan_3m',
    planName: '3 Months Pro Saver',
    startDate: '2026-07-15',
    expiryDate: '2026-10-15',
    isPaid: true,
    amountDue: 0,
    notes: 'Strength conditioning program.',
    createdAt: Date.now() - 5000000,
    updatedAt: Date.now() - 5000000
  },
  {
    id: 'GYM-1003',
    fullName: 'Marcus Vance',
    phone: '+1 (555) 456-7890',
    emergencyContact: '+1 (555) 999-0005',
    joinedDate: '2026-07-28',
    planId: 'plan_1m',
    planName: '1 Month Standard',
    startDate: '2026-07-28',
    expiryDate: '2026-08-28',
    isPaid: true,
    amountDue: 0,
    notes: 'Subscription currently expired.',
    createdAt: Date.now() - 6000000,
    updatedAt: Date.now() - 6000000
  }
];

export async function seedDatabaseIfEmpty() {
  const planCount = await db.plans.count();
  if (planCount === 0) {
    await db.plans.bulkAdd(DEFAULT_PLANS);
  }

  const memberCount = await db.members.count();
  if (memberCount === 0) {
    await db.members.bulkAdd(INITIAL_MEMBERS_SEEDED);

    const now = Date.now();
    const payments: PaymentRecord[] = [
      {
        id: 'PAY-101',
        memberId: 'GYM-1005',
        memberName: 'Jordan Taylor',
        planId: 'plan_12m',
        planName: '12 Months Elite VIP',
        amount: 2200,
        paymentMethod: 'card',
        timestamp: now - 3600000 * 2,
        dateStr: '2026-09-02',
        validFrom: '2026-09-07',
        validUntil: '2028-09-07'
      },
      {
        id: 'PAY-102',
        memberId: 'LION-144',
        memberName: 'Yasser Latrech',
        planId: 'plan_6m',
        planName: '6 Months Performance',
        amount: 1200,
        paymentMethod: 'cash',
        timestamp: now - 3600000 * 4,
        dateStr: '2026-09-02',
        validFrom: '2026-08-15',
        validUntil: '2027-02-15'
      },
      {
        id: 'PAY-103',
        memberId: 'GYM-1001',
        memberName: 'Alexander Wright',
        planId: 'plan_3m',
        planName: '3 Months Pro Saver',
        amount: 650,
        paymentMethod: 'card',
        timestamp: now - 3600000 * 6,
        dateStr: '2026-09-02',
        validFrom: '2026-07-15',
        validUntil: '2026-10-15'
      },
      {
        id: 'PAY-104',
        memberId: 'GYM-1002',
        memberName: 'Elena Rostova',
        planId: 'plan_1m',
        planName: '1 Month Standard',
        amount: 250,
        paymentMethod: 'cash',
        timestamp: now - 3600000 * 8,
        dateStr: '2026-09-02',
        validFrom: '2026-08-04',
        validUntil: '2026-09-04'
      }
    ];
    await db.payments.bulkAdd(payments);

    await db.checkIns.bulkAdd([
      { id: 'CHK-1', memberId: 'GYM-1005', memberName: 'Jordan Taylor', planName: '12 Months Elite VIP', statusAtCheckIn: 'active', timestamp: now - 3600000 * 5, dateStr: '2026-09-02', timeStr: '06:30' },
      { id: 'CHK-2', memberId: 'LION-144', memberName: 'Yasser Latrech', planName: '6 Months Performance', statusAtCheckIn: 'active', timestamp: now - 3600000 * 3, dateStr: '2026-09-02', timeStr: '08:15' },
      { id: 'CHK-3', memberId: 'GYM-1001', memberName: 'Alexander Wright', planName: '3 Months Pro Saver', statusAtCheckIn: 'active', timestamp: now - 3600000 * 1, dateStr: '2026-09-02', timeStr: '10:00' }
    ]);
  }
}
