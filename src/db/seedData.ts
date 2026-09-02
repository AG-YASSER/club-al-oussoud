import { db, MembershipPlan } from './db';

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
  // All mock sample members removed! Database starts fresh and clean for production.
}
