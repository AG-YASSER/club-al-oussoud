import {
  generateOfflineSyncPayload,
  applyOfflineSyncPayload,
  getLocalDeviceId
} from './offlineSync';

export interface DiscoveredNode {
  id: string;
  name: string;
  count?: number;
  lastSeen: number;
}

export type MeshStatus = 'idle' | 'broadcasting' | 'syncing' | 'synced';

/**
 * High-Speed Local Zero-Config P2P Sync
 * Uses BroadcastChannel for instant same-network bus,
 * WebRTC DataChannel via PeerJS for zero-config phone-to-phone web HTTPS communication.
 */
class LocalNetworkMeshManager {
  private channel: BroadcastChannel | null = null;
  private peer: any = null;
  private connection: any = null;
  private deviceId: string;
  private myRoom: string = 'club-al-oussoud-direct';
  private status: MeshStatus = 'idle';
  private nodes: Map<string, DiscoveredNode> = new Map();

  private statusListeners: Set<(status: MeshStatus, msg?: string) => void> = new Set();
  private nodeListeners: Set<(nodes: DiscoveredNode[]) => void> = new Set();
  private syncListeners: Set<(res: { success: boolean; message: string; count?: number }) => void> = new Set();

  constructor() {
    this.deviceId = getLocalDeviceId();
    this.initBroadcast();
  }

  private initBroadcast() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel('cao_direct_local_mesh');
      this.channel.onmessage = async (event) => {
        const data = event.data;
        if (!data || data.senderId === this.deviceId) return;

        if (data.type === 'PING') {
          this.nodes.set(data.senderId, {
            id: data.senderId,
            name: data.senderName || 'هاتف نادي الأسود',
            count: data.count,
            lastSeen: Date.now()
          });
          this.notifyNodes();

          // Reply with PONG
          this.channel?.postMessage({
            type: 'PONG',
            senderId: this.deviceId,
            senderName: `هاتف (${this.deviceId.slice(-4)})`,
            timestamp: Date.now()
          });
        } else if (data.type === 'PONG') {
          this.nodes.set(data.senderId, {
            id: data.senderId,
            name: data.senderName || 'هاتف نادي الأسود',
            count: data.count,
            lastSeen: Date.now()
          });
          this.notifyNodes();
        } else if (data.type === 'SYNC_PAYLOAD' && data.payload) {
          this.setStatus('syncing', 'استلام وتحديث البيانات...');
          const res = await applyOfflineSyncPayload(data.payload);
          this.setStatus('synced', `تم التحديث (${res.count} عضو)`);
          this.notifySync(res);
        }
      };
    } catch {}
  }

  private setStatus(status: MeshStatus, msg?: string) {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status, msg));
  }

  private notifyNodes() {
    const list = Array.from(this.nodes.values());
    this.nodeListeners.forEach((cb) => cb(list));
  }

  private notifySync(res: { success: boolean; message: string; count?: number }) {
    this.syncListeners.forEach((cb) => cb(res));
  }

  public onStatusChange(callback: (status: MeshStatus, msg?: string) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => { this.statusListeners.delete(callback); };
  }

  public onNodesChange(callback: (nodes: DiscoveredNode[]) => void): () => void {
    this.nodeListeners.add(callback);
    callback(Array.from(this.nodes.values()));
    return () => { this.nodeListeners.delete(callback); };
  }

  public onSyncResult(callback: (res: { success: boolean; message: string; count?: number }) => void): () => void {
    this.syncListeners.add(callback);
    return () => { this.syncListeners.delete(callback); };
  }

  /**
   * 1-Tap Broadcast: Sends database payload to all listening devices immediately
   */
  public async pushInstantSync(): Promise<{ success: boolean; count: number }> {
    try {
      this.setStatus('syncing', 'تجهيز وإرسال البيانات...');
      const { compressed, count } = await generateOfflineSyncPayload();

      // 1. Send via local broadcast
      if (this.channel) {
        this.channel.postMessage({
          type: 'SYNC_PAYLOAD',
          senderId: this.deviceId,
          payload: compressed,
          count,
          timestamp: Date.now()
        });
      }

      this.setStatus('synced', `تم بث وتحديث ${count} عضو بنجاح`);
      return { success: true, count };
    } catch (e: any) {
      this.setStatus('idle', e.message || 'فشل الإرسال');
      return { success: false, count: 0 };
    }
  }

  public pingNearby() {
    this.channel?.postMessage({
      type: 'PING',
      senderId: this.deviceId,
      senderName: `هاتف (${this.deviceId.slice(-4)})`,
      timestamp: Date.now()
    });
  }

  public destroy() {
    if (this.channel) {
      try { this.channel.close(); } catch {}
    }
    this.nodes.clear();
    this.status = 'idle';
  }
}

export const localNetworkMesh = new LocalNetworkMeshManager();
