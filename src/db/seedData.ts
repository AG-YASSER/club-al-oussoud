import { db, MembershipPlan } from './db';

// Production Default Moroccan Gym Subscription Plans
export const DEFAULT_PLANS: MembershipPlan[] = [
  {
    id: 'plan_12m',
    name: '12 Mois Elite VIP',
    durationMonths: 12,
    price: 429,
    description: '12 mois • 429 DH',
    features: ['Accès illimité toute l année', 'Casier VIP réservé', 'Coaching privé']
  },
  {
    id: 'plan_6m',
    name: '6 Mois Performance',
    durationMonths: 6,
    price: 239,
    description: '6 mois • 239 DH',
    features: ['Accès prioritaire 7j/7', 'Plan nutritionnel de base']
  },
  {
    id: 'plan_3m',
    name: '3 Mois Pro Saver',
    durationMonths: 3,
    price: 129,
    description: '3 mois • 129 DH',
    features: ['Musculation & Cardio', 'Programme d entraînement'],
    popular: true
  },
  {
    id: 'plan_1m',
    name: '1 Mois Standard',
    durationMonths: 1,
    price: 49,
    description: '1 mois • 49 DH',
    features: ['Musculation complète', 'Cardio-training', 'Vestiaires & douches']
  }
];

// Production initialization:
// Strictly initializes the subscription plans structure if empty.
// ZERO mock members, ZERO mock payments. Starts clean for real-world gym clients!
export async function seedDatabaseIfEmpty() {
  const planCount = await db.plans.count();
  if (planCount === 0) {
    await db.plans.bulkAdd(DEFAULT_PLANS);
  }
}
