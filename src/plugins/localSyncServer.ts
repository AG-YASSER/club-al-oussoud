import { registerPlugin, WebPlugin, PluginListenerHandle } from '@capacitor/core';

export interface LocalSyncServerPlugin {
  startServer(): Promise<{ port: number }>;
  stopServer(): Promise<void>;
  setPayload?(options: { payload: string }): Promise<void>;
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
  private serverPollInterval: any = null;
  private lastServerTimestamp = 0;

  async startServer(): Promise<{ port: number }> {
    this.isServerRunning = true;
    const hostsToCheck = [
      '127.0.0.1',
      'localhost',
      typeof window !== 'undefined' ? window.location.hostname : ''
    ].filter(Boolean);

    for (const host of hostsToCheck) {
      try {
        const res = await fetch(`http://${host}:8080/api/ping`, {
          signal: AbortSignal.timeout(1200)
        });
        if (res.ok) {
          const data = await res.json();
          this.lastServerTimestamp = data.lastUpdated || 0;
          this.startServerPolling(host, 8080);
          return { port: 8080 };
        }
      } catch {}
    }

    return { port: 8080 };
  }

  private startServerPolling(host: string, port: number) {
    if (this.serverPollInterval) clearInterval(this.serverPollInterval);
    this.serverPollInterval = setInterval(async () => {
      if (!this.isServerRunning) return;
      try {
        const res = await fetch(`http://${host}:${port}/api/sync`, {
          signal: AbortSignal.timeout(2500)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.payload && data.lastUpdated > this.lastServerTimestamp) {
            this.lastServerTimestamp = data.lastUpdated;
            this.notifyListeners('dataReceived', { payload: data.payload });
          }
        }
      } catch {}
    }, 2500);
  }

  async stopServer(): Promise<void> {
    this.isServerRunning = false;
    if (this.serverPollInterval) {
      clearInterval(this.serverPollInterval);
      this.serverPollInterval = null;
    }
  }

  async startDiscovery(): Promise<void> {
    this.isSearching = true;

    // Fast priority candidates
    const candidates = new Set<string>();
    candidates.add('127.0.0.1');
    candidates.add('localhost');
    if (typeof window !== 'undefined' && window.location.hostname) {
      candidates.add(window.location.hostname);
    }
    candidates.add('192.168.43.1'); // Android hotspot

    try {
      const saved = localStorage.getItem('cao_local_ip');
      if (saved) {
        const hostOnly = saved.split(':')[0].trim();
        if (hostOnly) candidates.add(hostOnly);
      }
    } catch {}

    // 1. Immediate priority test
    await this.testCandidates(Array.from(candidates), 600);

    // 2. High-speed Subnet Sweep (parallel chunks of 30)
    if (this.isSearching) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const ipMatch = currentHost.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);

      const subnetHosts: string[] = [];
      if (ipMatch && ipMatch[1] !== '127.0.0') {
        const prefix = ipMatch[1];
        for (let i = 1; i <= 254; i++) {
          subnetHosts.push(`${prefix}.${i}`);
        }
      } else {
        const prefixes = ['192.168.1', '192.168.0', '192.168.43', '192.168.11', '10.0.0'];
        for (const p of prefixes) {
          for (let i = 1; i <= 40; i++) {
            subnetHosts.push(`${p}.${i}`);
          }
          subnetHosts.push(`${p}.100`, `${p}.101`, `${p}.102`, `${p}.103`);
        }
      }

      await this.testCandidates(subnetHosts, 400);
    }
  }

  private async testCandidates(hosts: string[], timeoutMs: number = 500) {
    const discovered = new Set<string>();

    const checkHost = async (host: string) => {
      if (!this.isSearching) return;
      try {
        const res = await fetch(`http://${host}:8080/api/ping`, {
          method: 'GET',
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.status === 'ok' || data.server)) {
            const peerName = data.server || `Club Al Oussoud Server (${host})`;
            const reportedIps: string[] = Array.isArray(data.ips) ? data.ips : [];
            const bestHost = (host === '127.0.0.1' || host === 'localhost') && reportedIps.length > 0
              ? reportedIps[0]
              : host;

            const peerKey = `${bestHost}:8080`;
            if (!discovered.has(peerKey)) {
              discovered.add(peerKey);
              this.notifyListeners('peerFound', {
                name: peerName,
                host: bestHost,
                port: 8080
              });
            }
          }
        }
      } catch {}
    };

    // Parallel chunks of 30 for high-speed network detection
    const chunkSize = 30;
    for (let i = 0; i < hosts.length; i += chunkSize) {
      if (!this.isSearching) break;
      const chunk = hosts.slice(i, i + chunkSize);
      await Promise.all(chunk.map(checkHost));
    }
  }

  async stopDiscovery(): Promise<void> {
    this.isSearching = false;
  }
}

export const LocalSyncServer = registerPlugin<LocalSyncServerPlugin>('LocalSyncServer', {
  web: () => new LocalSyncServerWeb()
});
