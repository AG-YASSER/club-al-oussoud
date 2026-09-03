import { Member, getSubscriptionStatus } from '../db/db';
import { defaultTheme } from '../config/theme';

/**
 * Request notification permission from the browser/device
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }

  return false;
}

/**
 * Trigger an immediate native device/browser notification
 */
export async function sendNativeNotification(title: string, body: string, iconUrl?: string) {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        body,
        icon: iconUrl || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200]
      } as NotificationOptions);
    } else {
      new Notification(title, {
        body,
        icon: iconUrl || '/pwa-192x192.png'
      });
    }
  } catch (err) {
    console.error('Error firing notification:', err);
  }
}

import { SupportedLanguage } from './i18n';

/**
 * Scan members list and trigger push alerts for subscriptions expiring in ≤ 3 days, 1 day, or overdue
 */
export async function checkAndNotifyExpiringMembers(members: Member[], lang: SupportedLanguage = 'fr') {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission || members.length === 0) return;

  const urgentMembers = members.filter((m) => {
    const { status, daysRemaining } = getSubscriptionStatus(m);
    return !m.isPaid || (status === 'expiring' && daysRemaining <= 3) || status === 'expired';
  });

  if (urgentMembers.length === 0) return;

  const unpaidCount = urgentMembers.filter((m) => !m.isPaid).length;
  const expiringSoonCount = urgentMembers.filter((m) => m.isPaid && getSubscriptionStatus(m).daysRemaining <= 3 && getSubscriptionStatus(m).daysRemaining >= 0).length;
  const expiredCount = urgentMembers.filter((m) => m.isPaid && getSubscriptionStatus(m).daysRemaining < 0).length;

  let title = 'Club Al Oussoud - Rappel Échéances';
  let body = '';

  if (lang === 'ar') {
    title = 'نادي الأسود - تنبيه الاستحقاقات';
    if (unpaidCount > 0) body += `${unpaidCount} اشتراك غير مسدد. `;
    if (expiringSoonCount > 0) body += `${expiringSoonCount} اشتراك ينتهي خلال 3 أيام. `;
    if (expiredCount > 0) body += `${expiredCount} اشتراك منتهي.`;
    if (!body) body = `${urgentMembers.length} عضو يتطلب المتابعة.`;
  } else if (lang === 'en') {
    title = 'Club Al Oussoud - Membership Reminder';
    if (unpaidCount > 0) body += `${unpaidCount} unpaid dues. `;
    if (expiringSoonCount > 0) body += `${expiringSoonCount} expiring within 3 days. `;
    if (expiredCount > 0) body += `${expiredCount} expired.`;
    if (!body) body = `${urgentMembers.length} members require attention.`;
  } else {
    if (unpaidCount > 0) body += `${unpaidCount} cotisation(s) impayée(s). `;
    if (expiringSoonCount > 0) body += `${expiringSoonCount} abonnement(s) expire(nt) sous 3 jours. `;
    if (expiredCount > 0) body += `${expiredCount} abonnement(s) expiré(s).`;
    if (!body) body = `${urgentMembers.length} membres nécessitent une relance.`;
  }

  await sendNativeNotification(title, body);
}
