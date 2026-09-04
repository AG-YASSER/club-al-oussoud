import {
  generateOfflineSyncPayload,
  applyOfflineSyncPayload
} from './offlineSync';
import { SupportedLanguage } from './i18n';

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
  public async startServer(lang: SupportedLanguage = 'ar'): Promise<{ success: boolean; message: string }> {
    try {
      this.setStatus('starting', lang === 'fr' ? 'Démarrage du serveur...' : lang === 'en' ? 'Starting server...' : 'جارٍ تشغيل الخادم وبث البيانات في الشبكة...');
      const { compressed, count } = await generateOfflineSyncPayload();

      // Publish to same-network room
      const res = await fetch('/api/network-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: 'Club Al Oussoud',
          count,
          payload: compressed
        })
      });

      if (!res.ok) {
        throw new Error(lang === 'fr' ? 'Échec d\'envoi du signal au réseau' : lang === 'en' ? 'Failed to broadcast signal' : 'فشل إرسال إشارة البث للشبكة');
      }

      this.isServerActive = true;
      const successMsg = lang === 'fr'
        ? `Serveur actif ! (${count} membres prêts à transmettre)`
        : lang === 'en'
        ? `Server active! (${count} members ready to sync)`
        : `الخادم نشط - جاهز لنقل ${count} عضو`;

      this.setStatus('active', successMsg);

      // Keep alive heartbeat every 3 minutes
      if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = setInterval(async () => {
        if (!this.isServerActive) return;
        try {
          await fetch('/api/network-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderName: 'Club Al Oussoud',
              count,
              payload: compressed
            })
          });
        } catch {}
      }, 3 * 60 * 1000);

      return { success: true, message: successMsg };
    } catch (err: any) {
      this.isServerActive = false;
      const errorMsg = err.message || (lang === 'fr' ? 'Échec de démarrage du serveur' : lang === 'en' ? 'Failed to start server' : 'فشل تشغيل الخادم');
      this.setStatus('error', errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Stop Server
   */
  public async stopServer(lang: SupportedLanguage = 'ar'): Promise<{ success: boolean; message: string }> {
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
    const stoppedMsg = lang === 'fr' ? 'Serveur arrêté' : lang === 'en' ? 'Server stopped' : 'الخادم متوقف';
    this.setStatus('idle', stoppedMsg);
    return { success: true, message: stoppedMsg };
  }

  /**
   * Phone 2 (Receiver):
   * Taps "Pull Data" -> automatically queries same Wi-Fi room, pulls encrypted payload, and merges into Dexie.js
   */
  public async pullDataFromSameNetwork(lang: SupportedLanguage = 'ar'): Promise<NetworkSyncResult> {
    try {
      this.setStatus('pulling', lang === 'fr' ? 'Connexion et téléchargement...' : lang === 'en' ? 'Connecting and syncing...' : 'جارٍ فحص الشبكة وسحب البيانات...');

      // 1-Click check with cache buster
      const res = await fetch(`/api/network-sync?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) {
        throw new Error(lang === 'fr' ? 'Impossible de contacter le réseau' : lang === 'en' ? 'Unable to connect to network' : 'تعذر الاتصال بالشبكة');
      }

      const data = await res.json();

      if (!data.active || !data.payload) {
        const notFoundMsg = lang === 'fr'
          ? 'Activez d\'abord le serveur sur le premier téléphone et connectez-vous au même Wi-Fi'
          : lang === 'en'
          ? 'Start the server on Phone 1 first and make sure both phones are on same Wi-Fi'
          : 'تأكد من الضغط على (تشغيل الخادم) في الهاتف الأول أولاً والاتصال بنفس شبكة Wi-Fi';

        this.setStatus('error', notFoundMsg);
        return {
          success: false,
          message: notFoundMsg
        };
      }

      // Automatically decompress and merge into local Dexie.js
      const applyRes = await applyOfflineSyncPayload(data.payload);

      if (applyRes.success) {
        const okMsg = lang === 'fr'
          ? `Succès ! ${applyRes.count} membres mis à jour`
          : lang === 'en'
          ? `Success! ${applyRes.count} members synced`
          : `تم بنجاح! تم استلام وتحديث ${applyRes.count} عضو`;

        this.setStatus('synced', okMsg);
        return {
          success: true,
          message: okMsg,
          count: applyRes.count
        };
      } else {
        const failMsg = lang === 'fr' ? 'Erreur lors de la fusion des données' : applyRes.message;
        this.setStatus('error', failMsg);
        return {
          success: false,
          message: failMsg
        };
      }
    } catch (err: any) {
      const connErr = lang === 'fr' ? 'Erreur de connexion réseau' : lang === 'en' ? 'Network connection error' : (err.message || 'خطأ أثناء الاتصال');
      this.setStatus('error', connErr);
      return {
        success: false,
        message: connErr
      };
    }
  }
}

export const sameNetworkSync = new SameNetworkSyncEngine();
