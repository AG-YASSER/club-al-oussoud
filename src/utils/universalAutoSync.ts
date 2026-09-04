import {
  generateOfflineSyncPayload,
  applyOfflineSyncPayload
} from './offlineSync';
import { Capacitor } from '@capacitor/core';
import { LocalSyncServer } from '../plugins/localSyncServer';

export interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
}

export type AutoSyncStatus = 'idle' | 'broadcasting' | 'receiving' | 'success' | 'error';

class UniversalAutoSyncManager {
  private status: AutoSyncStatus = 'idle';
  private message: string = '';
  private statusListeners: Set<(status: AutoSyncStatus, msg: string) => void> = new Set();
  private isServerActive: boolean = false;

  public onStatusChange(cb: (status: AutoSyncStatus, msg: string) => void) {
    this.statusListeners.add(cb);
    cb(this.status, this.message);
    return () => { this.statusListeners.delete(cb); };
  }

  private setStatus(status: AutoSyncStatus, msg: string) {
    this.status = status;
    this.message = msg;
    this.statusListeners.forEach((cb) => cb(status, msg));
  }

  public getIsServerActive() {
    return this.isServerActive;
  }

  /**
   * Phone 1: Start Server & Broadcast
   */
  public async startBroadcasting(): Promise<void> {
    try {
      this.setStatus('broadcasting', 'جارٍ تشغيل الخادم وبث البيانات...');
      const { compressed, count } = await generateOfflineSyncPayload();

      // 1. If running in Capacitor (Android/iOS): start native NanoHTTPD server on 0.0.0.0:8080
      if (Capacitor.isNativePlatform()) {
        try {
          await LocalSyncServer.startServer();
          await LocalSyncServer.setPayload({ payload: compressed });
        } catch (e) {
          console.warn('Native local server start warning:', e);
        }
      }

      // 2. Broadcast to Web/Serverless endpoint so web devices sync seamlessly
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: compressed })
        });
      } catch (cloudErr) {
        console.warn('Relay push error:', cloudErr);
      }

      this.isServerActive = true;
      this.setStatus('broadcasting', `الخادم نشط - جاهز لنقل ${count} عضو`);
    } catch (err: any) {
      this.setStatus('error', err?.message || 'فشل تشغيل الخادم');
    }
  }

  public async stopBroadcasting(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try { await LocalSyncServer.stopServer(); } catch {}
    }
    this.isServerActive = false;
    this.setStatus('idle', 'المشاركة متوقفة');
  }

  /**
   * Phone 2: Discover & Pull automatically with 0 user input
   */
  public async discoverAndPull(): Promise<SyncResult> {
    this.setStatus('receiving', 'جارٍ الاتصال بالهاتف وسحب البيانات...');

    // Strategy 1: Pull from Web / Serverless endpoint
    try {
      const res = await fetch('/api/sync', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.payload) {
          const applyRes = await applyOfflineSyncPayload(data.payload);
          if (applyRes.success) {
            this.setStatus('success', `تم الاتصال وسحب ${applyRes.count} عضو بنجاح!`);
            return applyRes;
          }
        }
      }
    } catch (e) {}

    // Strategy 2: If in native app or local network, query default port 8080 on standard local hostnames
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
      const candidateUrls = [
        'http://127.0.0.1:8080/api/sync',
        'http://localhost:8080/api/sync',
        'http://192.168.43.1:8080/api/sync'
      ];

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(1500)
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.payload) {
              const applyRes = await applyOfflineSyncPayload(data.payload);
              if (applyRes.success) {
                this.setStatus('success', `تم الاتصال وسحب ${applyRes.count} عضو بنجاح!`);
                return applyRes;
              }
            }
          }
        } catch {}
      }
    }

    this.setStatus('error', 'تعذر العثور على خادم مفعل في الهاتف الأول');
    return { success: false, message: 'تأكد من الضغط على "بدء المشاركة" في الهاتف الأول أولاً' };
  }
}

export const universalAutoSync = new UniversalAutoSyncManager();
