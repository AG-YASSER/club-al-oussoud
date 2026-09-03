import { db, SyncQueueItem } from './db';

type SyncListener = (isOnline: boolean, pendingCount: number) => void;

class SyncEngine {
  private listeners: Set<SyncListener> = new Set();
  private isOnline: boolean = navigator.onLine;

  constructor() {
    window.addEventListener('online', () => this.handleConnectivityChange(true));
    window.addEventListener('offline', () => this.handleConnectivityChange(false));
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notify() {
    const pendingCount = await db.syncQueue.where('synced').equals(0 as any).count();
    this.listeners.forEach((listener) => listener(this.isOnline, pendingCount));
  }

  private async handleConnectivityChange(online: boolean) {
    this.isOnline = online;
    if (online) {
      console.log('[SyncEngine] Back online! Processing queued offline financial actions...');
      await this.processQueue();
    }
    this.notify();
  }

  public async enqueue(action: SyncQueueItem['action'], payload: any) {
    const item: SyncQueueItem = {
      id: 'sync_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      action,
      payload,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0
    };

    await db.syncQueue.add(item);
    this.notify();

    if (this.isOnline) {
      await this.processQueue();
    }
  }

  public async processQueue() {
    const pendingItems = await db.syncQueue.where('synced').equals(0 as any).toArray();
    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      try {
        // Simulate remote server sync call for local-first operations (members, payments, subscriptions)
        await new Promise((resolve) => setTimeout(resolve, 200));
        console.log(`[SyncEngine] Successfully synced financial action: ${item.action}`, item.payload);
        await db.syncQueue.update(item.id, { synced: true });
      } catch (err) {
        console.error(`[SyncEngine] Failed syncing action ${item.action}`, err);
        await db.syncQueue.update(item.id, { retryCount: item.retryCount + 1 });
      }
    }
    this.notify();
  }

  public getConnectivityStatus() {
    return this.isOnline;
  }
}

export const syncEngine = new SyncEngine();
