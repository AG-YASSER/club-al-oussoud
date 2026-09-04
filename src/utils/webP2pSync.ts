import {
  generateOfflineSyncPayload,
  applyOfflineSyncPayload
} from './offlineSync';
import { Peer, DataConnection } from 'peerjs';

export type WebSyncStatus = 'idle' | 'connecting' | 'connected' | 'syncing' | 'success' | 'error';

class WebP2PSyncManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private myCode: string = '';
  private status: WebSyncStatus = 'idle';
  private statusMessage: string = '';
  private statusListeners: Set<(status: WebSyncStatus, msg: string) => void> = new Set();
  private syncListeners: Set<(result: { success: boolean; message: string; count?: number }) => void> = new Set();

  constructor() {
    this.myCode = this.generateSyncCode();
  }

  public generateSyncCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.myCode = code;
    return code;
  }

  public getMyCode(): string {
    return this.myCode;
  }

  public onStatusChange(callback: (status: WebSyncStatus, msg: string) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status, this.statusMessage);
    return () => { this.statusListeners.delete(callback); };
  }

  public onSyncResult(callback: (result: { success: boolean; message: string; count?: number }) => void): () => void {
    this.syncListeners.add(callback);
    return () => { this.syncListeners.delete(callback); };
  }

  private setStatus(status: WebSyncStatus, msg: string = '') {
    this.status = status;
    this.statusMessage = msg;
    this.statusListeners.forEach((cb) => cb(status, msg));
  }

  private notifySync(result: { success: boolean; message: string; count?: number }) {
    this.syncListeners.forEach((cb) => cb(result));
  }

  /**
   * Initializes host mode: registers a peer ID based on the 6-character code
   */
  public async startHosting(): Promise<string> {
    this.destroy();
    const code = this.generateSyncCode();
    const peerId = `caogym-${code.toLowerCase()}`;

    this.setStatus('connecting', 'تجهيز نقطة المشاركة...');

    try {
      this.peer = new Peer(peerId, {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', () => {
        this.setStatus('connected', 'جاهز للربط واستقبال البيانات');
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS host error:', err);
        this.setStatus('error', 'تعذر تهيئة نقطة الاتصال');
      });

      return code;
    } catch (e: any) {
      this.setStatus('error', e.message || 'خطأ في بدء المشاركة');
      return code;
    }
  }

  private handleIncomingConnection(conn: DataConnection) {
    this.connection = conn;
    this.setStatus('connected', 'تم اتصال الهاتف الآخر');

    conn.on('open', async () => {
      // Auto-send database payload to the connected phone
      try {
        this.setStatus('syncing', 'إرسال البيانات...');
        const { compressed, count } = await generateOfflineSyncPayload();
        conn.send({ type: 'SYNC_PAYLOAD', payload: compressed, count });
        this.setStatus('success', `تم إرسال ${count} عضو بنجاح`);
      } catch (err: any) {
        this.setStatus('error', 'فشل تجهيز البيانات للإرسال');
      }
    });

    conn.on('data', async (data: any) => {
      if (data?.type === 'SYNC_PAYLOAD' && data.payload) {
        this.setStatus('syncing', 'استلام وتحديث البيانات...');
        const res = await applyOfflineSyncPayload(data.payload);
        if (res.success) {
          this.setStatus('success', `تم استلام ${res.count} عضو بنجاح`);
          this.notifySync(res);
        } else {
          this.setStatus('error', res.message);
          this.notifySync(res);
        }
      }
    });

    conn.on('close', () => {
      this.setStatus('connected', 'جاهز للاتصال');
    });
  }

  /**
   * Connects to a host using the 6-character code
   */
  public async connectToCode(code: string): Promise<void> {
    const cleanCode = (code || '').trim().toLowerCase();
    if (!cleanCode || cleanCode.length < 4) {
      this.setStatus('error', 'يرجى إدخال رمز صالح');
      return;
    }

    this.destroy();
    const targetPeerId = `caogym-${cleanCode}`;

    this.setStatus('connecting', 'جارٍ الاتصال بالجهاز...');

    try {
      this.peer = new Peer({
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', () => {
        if (!this.peer) return;
        const conn = this.peer.connect(targetPeerId, { reliable: true });
        this.connection = conn;

        conn.on('open', () => {
          this.setStatus('connected', 'تم الاتصال، جارٍ سحب البيانات...');
        });

        conn.on('data', async (data: any) => {
          if (data?.type === 'SYNC_PAYLOAD' && data.payload) {
            this.setStatus('syncing', 'معالجة وتحديث البيانات...');
            const res = await applyOfflineSyncPayload(data.payload);
            if (res.success) {
              this.setStatus('success', `تم سحب وتحديث ${res.count} عضو بنجاح`);
              this.notifySync(res);
            } else {
              this.setStatus('error', res.message);
              this.notifySync(res);
            }
          }
        });

        conn.on('error', () => {
          this.setStatus('error', 'تعذر الاتصال بالرمز المدخل');
        });
      });

      this.peer.on('error', () => {
        this.setStatus('error', 'تعذر العثور على الجهاز، تأكد من صحة الرمز');
      });
    } catch (e: any) {
      this.setStatus('error', e.message || 'فشل الاتصال');
    }
  }

  public destroy() {
    if (this.connection) {
      try { this.connection.close(); } catch {}
      this.connection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch {}
      this.peer = null;
    }
    this.status = 'idle';
    this.statusMessage = '';
  }
}

export const webP2pSync = new WebP2PSyncManager();
