import {
  generateOfflineSyncPayload,
  applyOfflineSyncPayload,
  getLocalDeviceId,
  OfflineSyncPayload
} from './offlineSync';

export interface P2PPeer {
  id: string;
  name: string;
  lastSeen: number;
  membersCount?: number;
  connectionType: 'local-channel';
}

export type P2PStatus = 'idle' | 'ready' | 'syncing' | 'error';
export type P2PSyncPayload = OfflineSyncPayload;

class P2PSyncManager {
  private channel: BroadcastChannel | null = null;
  private deviceId: string;
  private deviceName: string;
  private statusListeners: Set<(status: P2PStatus, detail?: string) => void> = new Set();
  private syncListeners: Set<(result: { success: boolean; message: string; count?: number }) => void> = new Set();
  private peerListeners: Set<(peers: P2PPeer[]) => void> = new Set();
  private _status: P2PStatus = 'ready';

  constructor() {
    this.deviceId = getLocalDeviceId();
    this.deviceName = `Club Al Oussoud (${this.deviceId.slice(-4)})`;
    this.initBroadcastChannel();
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel('cao_hotspot_p2p_channel');
      this.channel.onmessage = async (event) => {
        if (event.data?.type === 'SYNC_BIDIRECTIONAL' && event.data?.payload) {
          this.setStatus('syncing');
          const res = await applyOfflineSyncPayload(event.data.payload);
          this.setStatus('ready');
          this.notifySync(res);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  private setStatus(status: P2PStatus, detail?: string) {
    this._status = status;
    this.statusListeners.forEach((cb) => cb(status, detail));
  }

  private notifySync(result: { success: boolean; message: string; count?: number }) {
    this.syncListeners.forEach((cb) => cb(result));
  }

  public getStatus(): P2PStatus { return this._status; }
  public getStatusDetail(): string { return ''; }
  public getDeviceId(): string { return this.deviceId; }
  public getDeviceName(): string { return this.deviceName; }
  public isPeerReady(): boolean { return true; }

  public onPeersChange(callback: (peers: P2PPeer[]) => void): () => void {
    this.peerListeners.add(callback);
    callback([]);
    return () => this.peerListeners.delete(callback);
  }

  public onSyncResult(callback: (result: { success: boolean; message: string; count?: number }) => void): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  public onStatusChange(callback: (status: P2PStatus, detail?: string) => void): () => void {
    this.statusListeners.add(callback);
    callback(this._status);
    return () => this.statusListeners.delete(callback);
  }

  public async generateCompressedPayload() {
    return generateOfflineSyncPayload();
  }

  public async applyPayload(input: string) {
    return applyOfflineSyncPayload(input);
  }

  public async triggerOneClickSync(): Promise<void> {
    try {
      this.setStatus('syncing');
      const { compressed } = await generateOfflineSyncPayload();
      if (this.channel) {
        this.channel.postMessage({
          type: 'SYNC_BIDIRECTIONAL',
          senderId: this.deviceId,
          payload: compressed,
          timestamp: Date.now()
        });
      }
      this.setStatus('ready');
      this.notifySync({ success: true, message: 'تم إرسال إشارة المزامنة للتبويبات المفتوحة' });
    } catch (err: any) {
      this.setStatus('error');
      this.notifySync({ success: false, message: err.message || 'فشل إرسال إشارة المزامنة' });
    }
  }

  public destroy() {
    if (this.channel) {
      try { this.channel.close(); } catch {}
    }
    this.statusListeners.clear();
    this.syncListeners.clear();
    this.peerListeners.clear();
  }
}

export const p2pSync = new P2PSyncManager();
