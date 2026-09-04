import { db, MembershipPlan } from './db';

// Empty default plans: Clean start for the gym. The manager inputs their own plans!
export const DEFAULT_PLANS: MembershipPlan[] = [];

// Production initialization:
// Strictly clean start with 0 plans, 0 members, 0 payments.
export async function seedDatabaseIfEmpty() {
  // Do nothing. Leaves plans empty so user can create their own custom plans.
}
