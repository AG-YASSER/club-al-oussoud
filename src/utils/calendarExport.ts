import { Member } from '../db/db';

/**
 * Downloads a standardized .ics calendar file for the member's subscription expiry.
 * Works natively on iOS (Safari Calendar import) and Android (Google Calendar / Outlook).
 */
export function exportMemberExpiryToCalendar(member: Member, gymName: string = 'Club Al Oussoud') {
  // Expiry date as YYYYMMDD
  const cleanDate = member.expiryDate.replace(/-/g, '');
  const uid = `gym-${member.id}-${cleanDate}@al-oussoud.local`;
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Club Al Oussoud//Gym Management Mobile//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStr}`,
    `DTSTART;VALUE=DATE:${cleanDate}`,
    `DTEND;VALUE=DATE:${cleanDate}`,
    `SUMMARY:Expiration Abonnement: ${member.fullName} (${gymName})`,
    `DESCRIPTION:Renouvellement pour ${member.fullName}\\nPlan: ${member.planName}\\nTéléphone: ${member.phone}\\nID: ${member.id}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P1D', // 1 day before notification
    'ACTION:DISPLAY',
    `DESCRIPTION:Rappel: L'abonnement de ${member.fullName} expire demain!`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `expiration_${member.fullName.replace(/\s+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Requests native browser/PWA notification permission and schedules a local alert
 */
export async function requestAndSendLocalNotification(title: string, body: string): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn(`${title}\n${body}`);
    return false;
  }

  try {
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg'
      });
      return true;
    } else {
      console.warn(`${title}\n${body}`);
      return false;
    }
  } catch (err) {
    console.warn('Native notification error:', err);
    console.warn(`${title}\n${body}`);
    return false;
  }
}
