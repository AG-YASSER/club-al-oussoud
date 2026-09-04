import {
  generateOfflineSyncPayload,
  applyOfflineSyncPayload
} from './offlineSync';

export interface NetworkSyncResult {
  success: boolean;
  message: string;
  count?: number;
}

export type NetworkServerStatus = 'idle' | 'starting' | 'active' | 'pulling' | 'synced' | 'error';

class SameNetworkSyncEngine {
  private status: NetworkServerStatus = 'idle';
  private message: string = '';
  private statusListeners: Set<(status: NetworkServerStatus, msg: string) => void> = new Set();
  private isServerActive: boolean = false;
  private keepAliveInterval: any = null;

  public onStatusChange(callback: (status: NetworkServerStatus, msg: string) => void) {
    this.statusListeners.add(callback);
    callback(this.status, this.message);
    return () => { this.statusListeners.delete(callback); };
  }

  private setStatus(status: NetworkServerStatus, msg: string = '') {
    this.status = status;
    this.message = msg;
    this.statusListeners.forEach((cb) => cb(status, msg));
  }

  public getIsServerActive() {
    return this.isServerActive;
  }

  /**
   * Phone 1 (Host Server):
   * Taps "Start Server" -> encrypts/compresses Dexie database and publishes to the shared Wi-Fi room
   */
  public async startServer(): Promise<void> {
    try {
      this.setStatus('starting', 'جارٍ تشغيل الخادم وبث البيانات في الشبكة...');
      const { compressed, count } = await generateOfflineSyncPayload();

      // Publish to same-network room
      const res = await fetch('/api/network-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: 'هاتف نادي الأسود',
          count,
          payload: compressed
        })
      });

      if (!res.ok) {
        throw new Error('فشل إرسال إشارة البث للشبكة');
      }

      this.isServerActive = true;
      this.setStatus('active', `الخادم نشط - جاهز لنقل ${count} عضو`);

      // Keep alive heartbeat every 3 minutes
      if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = setInterval(async () => {
        if (!this.isServerActive) return;
        try {
          await fetch('/api/network-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderName: 'هاتف نادي الأسود',
              count,
              payload: compressed
            })
          });
        } catch {}
      }, 3 * 60 * 1000);

    } catch (err: any) {
      this.isServerActive = false;
      this.setStatus('error', err.message || 'فشل تشغيل الخادم');
    }
  }

  /**
   * Stop Server
   */
  public async stopServer(): Promise<void> {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    this.isServerActive = false;
    try {
      await fetch('/api/network-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
    } catch {}
    this.setStatus('idle', 'الخادم متوقف');
  }

  /**
   * Phone 2 (Receiver):
   * Taps "Pull Data" -> automatically queries same Wi-Fi room, pulls encrypted payload, and merges into Dexie.js
   */
  public async pullDataFromSameNetwork(): Promise<NetworkSyncResult> {
    try {
      this.setStatus('pulling', 'جارٍ فحص الشبكة وسحب البيانات...');

      // 1-Click check with cache buster
      const res = await fetch(`/api/network-sync?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) {
        throw new Error('تعذر الاتصال بالشبكة');
      }

      const data = await res.json();

      if (!data.active || !data.payload) {
        this.setStatus('error', 'لم يتم العثور على خادم مفعل في نفس شبكة Wi-Fi');
        return {
          success: false,
          message: 'تأكد من الضغط على (تشغيل الخادم) في الهاتف الأول أولاً والاتصال بنفس شبكة Wi-Fi'
        };
      }

      // Automatically decompress and merge into local Dexie.js
      const applyRes = await applyOfflineSyncPayload(data.payload);

      if (applyRes.success) {
        this.setStatus('synced', `تم بنجاح! تم استلام وتحديث ${applyRes.count} عضو`);
        return {
          success: true,
          message: `تم استلام وتحديث ${applyRes.count} عضو بنجاح!`,
          count: applyRes.count
        };
      } else {
        this.setStatus('error', applyRes.message);
        return applyRes;
      }
    } catch (err: any) {
      this.setStatus('error', err.message || 'خطأ أثناء الاتصال');
      return {
        success: false,
        message: err.message || 'فشل الاتصال بالشبكة'
      };
    }
  }
}

export const sameNetworkSync = new SameNetworkSyncEngine();
