import { db, MembershipPlan, Member } from './db';
import { format, subDays, addDays } from 'date-fns';

export const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'plan_1m',
    name: '1 Mois Musculation',
    durationMonths: 1,
    price: 250,
    description: 'Accès libre musculation & cardio',
    features: ['Musculation complète', 'Cardio-training', 'Vestiaires & douches']
  },
  {
    id: 'plan_3m',
    name: '3 Mois Pack Lion',
    durationMonths: 3,
    price: 650,
    description: 'Programme prise de masse / sèche inclus',
    features: ['Musculation & Cardio', 'Conseils coaching débutant', 'Programme d’entraînement'],
    popular: true
  },
  {
    id: 'plan_6m',
    name: '6 Mois Warrior',
    durationMonths: 6,
    price: 1200,
    description: 'Accès illimité 7j/7 + Suivi progression',
    features: ['Accès prioritaire', 'Plan nutritionnel de base', 'Suivi mensuel']
  },
  {
    id: 'plan_12m',
    name: '1 An Oussoud VIP',
    durationMonths: 12,
    price: 2200,
    description: 'L’abonnement suprême pour vrais guerriers',
    features: ['Accès illimité toute l’année', 'Casier réservé', 'T-shirt Club Al Oussoud offert']
  }
];

export async function seedDatabaseIfEmpty() {
  const planCount = await db.plans.count();
  if (planCount === 0) {
    await db.plans.bulkAdd(DEFAULT_PLANS);
  }

  const memberCount = await db.members.count();
  if (memberCount === 0) {
    const today = new Date();

    const sampleMembers: Member[] = [
      {
        id: 'LION-101',
        fullName: 'Yassine Benali',
        phone: '+212 6 61 23 45 67',
        emergencyContact: 'Karim Benali (+212 6 62 11 22 33)',
        joinedDate: format(subDays(today, 45), 'yyyy-MM-dd'),
        planId: 'plan_3m',
        planName: '3 Mois Pack Lion',
        startDate: format(subDays(today, 45), 'yyyy-MM-dd'),
        expiryDate: format(addDays(today, 45), 'yyyy-MM-dd'),
        isPaid: true,
        notes: 'S’entraîne le soir à 18h30. Très assidu.',
        createdAt: Date.now() - 45 * 86400000,
        updatedAt: Date.now() - 45 * 86400000
      },
      {
        id: 'LION-102',
        fullName: 'Omar El Amrani',
        phone: '+212 6 72 88 99 00',
        emergencyContact: 'Fatima El Amrani (+212 6 55 44 33 22)',
        joinedDate: format(subDays(today, 27), 'yyyy-MM-dd'),
        planId: 'plan_1m',
        planName: '1 Mois Musculation',
        startDate: format(subDays(today, 27), 'yyyy-MM-dd'),
        expiryDate: format(addDays(today, 3), 'yyyy-MM-dd'), // Expiring soon (3 days left)
        isPaid: true,
        notes: 'Avertir du renouvellement cette semaine.',
        createdAt: Date.now() - 27 * 86400000,
        updatedAt: Date.now() - 27 * 86400000
      },
      {
        id: 'LION-103',
        fullName: 'Mehdi Chraibi',
        phone: '+212 6 63 12 78 90',
        emergencyContact: 'Tarik Chraibi (+212 6 77 88 99 11)',
        joinedDate: format(subDays(today, 60), 'yyyy-MM-dd'),
        planId: 'plan_1m',
        planName: '1 Mois Musculation',
        startDate: format(subDays(today, 40), 'yyyy-MM-dd'),
        expiryDate: format(subDays(today, 10), 'yyyy-MM-dd'), // Expired (10 days ago)
        isPaid: true,
        notes: 'Abonnement expiré. Doit régler la mensualité.',
        createdAt: Date.now() - 60 * 86400000,
        updatedAt: Date.now() - 40 * 86400000
      },
      {
        id: 'LION-104',
        fullName: 'Amine Tazi',
        phone: '+212 6 64 55 66 77',
        emergencyContact: 'Nour Tazi (+212 6 66 77 88 99)',
        joinedDate: format(subDays(today, 5), 'yyyy-MM-dd'),
        planId: 'plan_1m',
        planName: '1 Mois Musculation',
        startDate: format(subDays(today, 5), 'yyyy-MM-dd'),
        expiryDate: format(addDays(today, 25), 'yyyy-MM-dd'),
        isPaid: false, // Unpaid registration (notebook replacement!)
        amountDue: 250,
        notes: 'A promis d’apporter l’argent le lendemain (carnet remplacé).',
        createdAt: Date.now() - 5 * 86400000,
        updatedAt: Date.now() - 5 * 86400000
      },
      {
        id: 'LION-105',
        fullName: 'Hamza Boukhriss',
        phone: '+212 6 70 11 22 33',
        emergencyContact: 'Rachid (+212 6 50 40 30 20)',
        joinedDate: format(subDays(today, 90), 'yyyy-MM-dd'),
        planId: 'plan_12m',
        planName: '1 An Oussoud VIP',
        startDate: format(subDays(today, 90), 'yyyy-MM-dd'),
        expiryDate: format(addDays(today, 275), 'yyyy-MM-dd'),
        isPaid: true,
        notes: 'Membre VIP, casier N°7.',
        createdAt: Date.now() - 90 * 86400000,
        updatedAt: Date.now() - 90 * 86400000
      }
    ];

    await db.members.bulkAdd(sampleMembers);

    const todayStr = format(today, 'yyyy-MM-dd');
    await db.checkIns.bulkAdd([
      {
        id: 'chk-1',
        memberId: 'LION-101',
        memberName: 'Yassine Benali',
        planName: '3 Mois Pack Lion',
        statusAtCheckIn: 'active',
        timestamp: today.getTime() - 3600000 * 2,
        dateStr: todayStr,
        timeStr: '08:30'
      },
      {
        id: 'chk-2',
        memberId: 'LION-105',
        memberName: 'Hamza Boukhriss',
        planName: '1 An Oussoud VIP',
        statusAtCheckIn: 'active',
        timestamp: today.getTime() - 3600000 * 1,
        dateStr: todayStr,
        timeStr: '10:15'
      }
    ]);
  }
}
