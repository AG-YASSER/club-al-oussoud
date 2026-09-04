import LZString from 'lz-string';
import { db, Member, MembershipPlan, Subscription, Payment } from '../db/db';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface OfflineSyncData {
  m: any[];
  pln: MembershipPlan[];
  sub: Subscription[];
  pay: Payment[];
}

export interface OfflineSyncPayload {
  app: 'CAO_SYNC';
  ver: number;
  ts: number;
  deviceId: string;
  d: OfflineSyncData;
}

export function getLocalDeviceId(): string {
  try {
    let id = localStorage.getItem('cao_device_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      localStorage.setItem('cao_device_id', id);
    }
    return id;
  } catch {
    return 'DEV-OFFLINE';
  }
}

/**
 * Generates an instant, 100% offline sync payload from IndexedDB.
 * Compresses data using LZ-String for minimal QR code and transfer footprint.
 */
export async function generateOfflineSyncPayload(): Promise<{ raw: string; compressed: string; count: number }> {
  const [members, plans, subscriptions, payments] = await Promise.all([
    db.members.filter((m) => !m.isDeleted).toArray(),
    db.plans.toArray(),
    db.subscriptions.toArray(),
    db.payments.toArray()
  ]);

  const payload: OfflineSyncPayload = {
    app: 'CAO_SYNC',
    ver: 4,
    ts: Date.now(),
    deviceId: getLocalDeviceId(),
    d: {
      m: members.map((m) => ({
        i: m.id,
        n: m.fullName,
        p: m.phone || '',
        ec: m.emergencyContact || '',
        pl: m.planId,
        pn: m.planName,
        s: m.startDate,
        e: m.expiryDate,
        pd: m.isPaid,
        ad: m.amountDue || 0,
        del: m.isDeleted,
        nt: m.notes || '',
        u: m.updatedAt || Date.now()
      })),
      pln: plans,
      sub: subscriptions,
      pay: payments
    }
  };

  const raw = JSON.stringify(payload);
  const compressed = 'CAO_LZ:' + LZString.compressToBase64(raw);
  return { raw, compressed, count: members.length };
}

/**
 * Applies decompressed payload into IndexedDB immediately using bulkPut.
 */
export async function applyOfflineSyncPayload(
  input: string
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    let jsonStr = (input || '').trim();
    if (!jsonStr) {
      return { success: false, message: 'محتوى المزامنة فارغ', count: 0 };
    }

    if (jsonStr.startsWith('CAO_LZ:')) {
      const decompressed = LZString.decompressFromBase64(jsonStr.slice(7));
      if (!decompressed) {
        return { success: false, message: 'فشل فك ضغط بيانات LZ', count: 0 };
      }
      jsonStr = decompressed;
    }

    const payload: OfflineSyncPayload = JSON.parse(jsonStr);
    if (payload.app !== 'CAO_SYNC' || !payload.d) {
      return { success: false, message: 'صيغة كود المزامنة غير صالحة', count: 0 };
    }

    let mergedCount = 0;
    await db.transaction('rw', db.members, db.plans, db.subscriptions, db.payments, async () => {
      // 1. Plans
      if (payload.d.pln && payload.d.pln.length > 0) {
        await db.plans.bulkPut(payload.d.pln);
      }

      // 2. Members (immediate bulkPut)
      if (payload.d.m && payload.d.m.length > 0) {
        mergedCount = payload.d.m.length;
        const existingMembers = await db.members.toArray();
        const existingMap = new Map<string, Member>(existingMembers.map((m) => [m.id, m]));

        const membersToPut: Member[] = [];
        for (const item of payload.d.m) {
          if (item.fullName) {
            // Full Member schema
            const existing = existingMap.get(item.id);
            membersToPut.push({
              ...item,
              photo: existing?.photo || item.photo || null,
              updatedAt: Math.max(item.updatedAt || Date.now(), existing?.updatedAt || 0)
            });
          } else {
            // Minified format (i, n, p, ec, pl, pn, s, e, pd, ad, del, nt, u)
            const existing = existingMap.get(item.i);
            membersToPut.push({
              id: item.i,
              fullName: item.n,
              phone: item.p || existing?.phone || '',
              emergencyContact: item.ec || existing?.emergencyContact || '',
              email: existing?.email || '',
              photo: existing?.photo || null,
              joinedDate: item.s || existing?.joinedDate || new Date().toISOString().split('T')[0],
              planId: item.pl,
              planName: item.pn,
              startDate: item.s,
              expiryDate: item.e,
              isPaid: item.pd !== false,
              amountDue: item.ad || 0,
              notes: item.nt || existing?.notes || '',
              isDeleted: Boolean(item.del),
              deletedAt: item.del ? (existing?.deletedAt || new Date().toISOString().split('T')[0]) : undefined,
              createdAt: existing?.createdAt || item.u || Date.now(),
              updatedAt: Math.max(item.u || Date.now(), existing?.updatedAt || 0)
            });
          }
        }

        if (membersToPut.length > 0) {
          await db.members.bulkPut(membersToPut);
        }
      }

      // 3. Subscriptions
      if (payload.d.sub && payload.d.sub.length > 0) {
        await db.subscriptions.bulkPut(payload.d.sub);
      }

      // 4. Payments
      if (payload.d.pay && payload.d.pay.length > 0) {
        await db.payments.bulkPut(payload.d.pay);
      }
    });

    return { success: true, message: `تمت مزامنة ${mergedCount} عضو بنجاح!`, count: mergedCount };
  } catch (err: any) {
    console.error('applyOfflineSyncPayload error:', err);
    return { success: false, message: err.message || 'خطأ في معالجة بيانات المزامنة', count: 0 };
  }
}

/**
 * 1-Click Share & Nearby: Exports sync file and opens native Android Share (Bluetooth / Quick Share / WhatsApp)
 */
export async function exportAndShareSyncFile(): Promise<boolean> {
  try {
    const { raw } = await generateOfflineSyncPayload();
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `Club_Al_Oussoud_Sync_${dateStr}.json`;

    try {
      const fileResult = await Filesystem.writeFile({
        path: fileName,
        data: raw,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      await Share.share({
        title: 'Club Al Oussoud Database Sync',
        text: 'ملف مزامنة نادي الأسود (Club Al Oussoud Sync File)',
        url: fileResult.uri,
        dialogTitle: 'مشاركة ملف المزامنة (Bluetooth / Quick Share / WhatsApp)'
      });
      return true;
    } catch {
      // Fallback for Web browser
      const blob = new Blob([raw], { type: 'application/json' });
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [new File([blob], fileName, { type: 'application/json' })] })) {
        await navigator.share({
          title: 'Club Al Oussoud Sync',
          files: [new File([blob], fileName, { type: 'application/json' })]
        });
        return true;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (err) {
    console.error('exportAndShareSyncFile error:', err);
    return false;
  }
}

/**
 * 1-Click Import: Reads a local sync file and merges into IndexedDB immediately.
 */
export async function importSyncFile(file: File): Promise<{ success: boolean; message: string; count: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const res = await applyOfflineSyncPayload(text);
      resolve(res);
    };
    reader.onerror = () => {
      resolve({ success: false, message: 'فشل قراءة الملف المحدد', count: 0 });
    };
    reader.readAsText(file);
  });
}

/**
 * Normalizes user IP input:
 * - '192.168.1.5' -> 'http://192.168.1.5:8080'
 * - '192.168.1.5:3000' -> 'http://192.168.1.5:3000'
 * - 'http://192.168.1.5:8080/' -> 'http://192.168.1.5:8080'
 */
export function normalizeLocalIp(input: string): string {
  let cleaned = input.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!cleaned) return '';
  if (!cleaned.includes(':')) {
    cleaned = `${cleaned}:8080`;
  }
  return `http://${cleaned}`;
}

/**
 * Direct Local IP Sync: Pushes current database to the target IP server.
 */
export async function pushToLocalIp(
  targetIp: string
): Promise<{ success: boolean; message: string }> {
  const url = normalizeLocalIp(targetIp);
  if (!url) {
    return { success: false, message: 'يرجى إدخال عنوان IP صالح (مثال: 192.168.1.50:8080)' };
  }

  try {
    const { compressed } = await generateOfflineSyncPayload();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${url}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: compressed }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`استجابة الخادم: ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message || 'تم إرسال البيانات بنجاح إلى الجهاز المحدد!'
    };
  } catch (err: any) {
    console.error('pushToLocalIp error:', err);
    if (err.name === 'AbortError') {
      return { success: false, message: 'انتهت مهلة الاتصال بالخادم. تأكد من تشغيل الخادم والاتصال بنفس شبكة Wi-Fi.' };
    }
    return { success: false, message: `فشل الإرسال: ${err.message || 'تعذر الوصول للعنوان'}` };
  }
}

/**
 * Direct Local IP Sync: Pulls database payload from the target IP and merges immediately.
 */
export async function pullFromLocalIp(
  targetIp: string
): Promise<{ success: boolean; message: string; count: number }> {
  const url = normalizeLocalIp(targetIp);
  if (!url) {
    return { success: false, message: 'يرجى إدخال عنوان IP صالح (مثال: 192.168.1.50:8080)', count: 0 };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${url}/api/sync`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`استجابة الخادم: ${res.status}`);
    }

    const data = await res.json();
    if (!data.success || !data.payload) {
      return { success: false, message: 'لم يتم العثور على بيانات مزامنة في الخادم', count: 0 };
    }

    const mergeResult = await applyOfflineSyncPayload(data.payload);
    return mergeResult;
  } catch (err: any) {
    console.error('pullFromLocalIp error:', err);
    if (err.name === 'AbortError') {
      return { success: false, message: 'انتهت مهلة الاتصال بالخادم. تأكد من العنوان ونفس شبكة Wi-Fi.', count: 0 };
    }
    return { success: false, message: `فشل السحب: ${err.message || 'تعذر الاتصال'}`, count: 0 };
  }
}

/**
 * Pings target IP to verify if local sync server is reachable.
 */
export async function pingLocalIp(
  targetIp: string
): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const url = normalizeLocalIp(targetIp);
  if (!url) {
    return { success: false, message: 'يرجى كتابة عنوان IP صالح', latencyMs: 0 };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${url}/api/ping`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { success: true, message: `متصل بنجاح! (${latencyMs}ms)`, latencyMs };
    }
    return { success: false, message: `استجاب الخادم برمز خطأ: ${res.status}`, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { success: false, message: 'تعذر الاتصال بالخادم على هذا العنوان', latencyMs };
  }
}

/**
 * Local BroadcastChannel for same-device multi-tab synchronization.
 */
class TabBroadcastManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(result: { success: boolean; message: string; count: number }) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('cao_offline_tab_channel');
        this.channel.onmessage = async (e) => {
          if (e.data?.type === 'SYNC_PAYLOAD' && e.data?.payload) {
            const res = await applyOfflineSyncPayload(e.data.payload);
            this.listeners.forEach((cb) => cb(res));
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization error:', err);
      }
    }
  }

  public onTabSync(callback: (result: { success: boolean; message: string; count: number }) => void) {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  public async broadcastNow(): Promise<boolean> {
    if (!this.channel) return false;
    try {
      const { compressed } = await generateOfflineSyncPayload();
      this.channel.postMessage({
        type: 'SYNC_PAYLOAD',
        payload: compressed,
        timestamp: Date.now()
      });
      return true;
    } catch (err) {
      console.error('broadcastNow error:', err);
      return false;
    }
  }
}

export const tabBroadcastSync = new TabBroadcastManager();

