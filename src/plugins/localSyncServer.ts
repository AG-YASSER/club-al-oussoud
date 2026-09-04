import { registerPlugin, WebPlugin, PluginListenerHandle } from '@capacitor/core';

export interface LocalSyncServerPlugin {
  startServer(): Promise<{ port: number; ips?: string[] }>;
  stopServer(): Promise<void>;
  setPayload?(options: { payload: string }): Promise<void>;
  printHtml?(options: { html: string; title?: string }): Promise<void>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  addListener(
    eventName: 'peerFound',
    listenerFunc: (peer: { name: string; host: string; port: number }) => void
  ): Promise<PluginListenerHandle>;
}

export class LocalSyncServerWeb extends WebPlugin implements LocalSyncServerPlugin {
  private isServerRunning = false;
  private isSearching = false;
  private currentPayload: string = '';

  async startServer(): Promise<{ port: number; ips?: string[] }> {
    this.isServerRunning = true;
    const host = typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost'
      ? window.location.hostname
      : '0.0.0.0';
    return { port: 8080, ips: [host] };
  }

  async stopServer(): Promise<void> {
    this.isServerRunning = false;
  }

  async setPayload(options: { payload: string }): Promise<void> {
    this.currentPayload = options.payload;
  }

  async printHtml(options: { html: string; title?: string }): Promise<void> {
    if (typeof window === 'undefined') return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(options.html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 2000);
      }, 300);
    }
  }

  /**
   * Fast Parallel /24 Subnet Sweep Fallback
   * 300ms timeout per host, completes full scan in under 2 seconds.
   */
  async startDiscovery(): Promise<void> {
    this.isSearching = true;

    // Detect base IP /24 subnet from window.location or standard LAN subnets
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const ipMatch = currentHost.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);

    const candidates: string[] = [];
    if (ipMatch && ipMatch[1] !== '127.0.0') {
      const prefix = ipMatch[1];
      for (let i = 1; i <= 254; i++) {
        candidates.push(`${prefix}.${i}`);
      }
    } else {
      // Priority Wi-Fi subnets
      const prefixes = ['192.168.11', '192.168.1', '192.168.0', '192.168.43', '10.0.0'];
      for (const p of prefixes) {
        for (let i = 1; i <= 40; i++) {
          candidates.push(`${p}.${i}`);
        }
        candidates.push(`${p}.100`, `${p}.101`, `${p}.102`, `${p}.103`, `${p}.104`, `${p}.105`);
      }
    }

    const checkHost = async (host: string) => {
      if (!this.isSearching) return;
      try {
        const res = await fetch(`http://${host}:8080/api/ping`, {
          method: 'GET',
          signal: AbortSignal.timeout(300) // Strictly 300ms
        });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.status === 'ok' || data.server)) {
            const peerName = data.server || 'GymServer';
            this.notifyListeners('peerFound', {
              name: peerName,
              host,
              port: 8080
            });
          }
        }
      } catch {}
    };

    // Parallel batches of 40 for ultra-fast < 2s completion
    const batchSize = 40;
    for (let i = 0; i < candidates.length; i += batchSize) {
      if (!this.isSearching) break;
      const batch = candidates.slice(i, i + batchSize);
      await Promise.all(batch.map(checkHost));
    }
  }

  async stopDiscovery(): Promise<void> {
    this.isSearching = false;
  }
}

export const LocalSyncServer = registerPlugin<LocalSyncServerPlugin>('LocalSyncServer', {
  web: () => new LocalSyncServerWeb()
});
