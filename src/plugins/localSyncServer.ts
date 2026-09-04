import { registerPlugin, WebPlugin, PluginListenerHandle } from '@capacitor/core';
import { normalizeLocalIp } from '../utils/offlineSync';

export interface LocalSyncServerPlugin {
  startServer(): Promise<{ port: number; ips?: string[] }>;
  stopServer(): Promise<void>;
  setPayload(options: { payload: string }): Promise<void>;
  printHtml(options: { html: string; title?: string }): Promise<void>;
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
  private currentPayload: string = '';

  private isSecureHttps(): boolean {
    return typeof window !== 'undefined' && window.location.protocol === 'https:';
  }

  async startServer(): Promise<{ port: number; ips?: string[] }> {
    this.isServerRunning = true;
    const detectedIps: string[] = [];

    // If running on HTTPS (e.g. Vercel), do NOT make insecure HTTP localhost requests to prevent Mixed Content errors
    if (this.isSecureHttps()) {
      const currentHost = window.location.hostname || 'club-al-oussoud';
      return { port: 8080, ips: [currentHost] };
    }

    const hostsToCheck = [
      typeof window !== 'undefined' ? window.location.hostname : '',
      '127.0.0.1',
      'localhost'
    ].filter(Boolean);

    for (const host of hostsToCheck) {
      try {
        const res = await fetch(`http://${host}:8080/api/ping`, {
          signal: AbortSignal.timeout(1000)
        });
        if (res.ok) {
          const data = await res.json();
          this.lastServerTimestamp = data.lastUpdated || 0;
          if (Array.isArray(data.ips)) {
            detectedIps.push(...data.ips);
          }
          this.startServerPolling(host, 8080);
          return { port: 8080, ips: detectedIps.length > 0 ? detectedIps : [host] };
        }
      } catch {}
    }

    const fallbackHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
    return { port: 8080, ips: [fallbackHost] };
  }

  async setPayload(options: { payload: string }): Promise<void> {
    this.currentPayload = options.payload;

    // Never fetch insecure HTTP from HTTPS
    if (this.isSecureHttps()) return;

    const hosts = [
      typeof window !== 'undefined' ? window.location.hostname : '',
      '127.0.0.1',
      'localhost'
    ].filter(Boolean);

    for (const host of hosts) {
      try {
        await fetch(`http://${host}:8080/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: options.payload }),
          signal: AbortSignal.timeout(1200)
        });
      } catch {}
    }
  }

  private startServerPolling(host: string, port: number) {
    if (this.serverPollInterval) clearInterval(this.serverPollInterval);
    if (this.isSecureHttps()) return;

    this.serverPollInterval = setInterval(async () => {
      if (!this.isServerRunning) return;
      try {
        const res = await fetch(`http://${host}:${port}/api/sync`, {
          signal: AbortSignal.timeout(2000)
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

  async stopServer(): Promise<void> {
    this.isServerRunning = false;
    if (this.serverPollInterval) {
      clearInterval(this.serverPollInterval);
      this.serverPollInterval = null;
    }
  }

  async startDiscovery(): Promise<void> {
    this.isSearching = true;

    // Fast candidate list
    const candidates = new Set<string>();

    // 1. Saved IP in localStorage
    try {
      const saved = localStorage.getItem('cao_local_ip');
      if (saved) {
        const hostOnly = saved.replace(/^https?:\/\//i, '').split(':')[0].trim();
        if (hostOnly) candidates.add(hostOnly);
      }
    } catch {}

    // Only test local IP candidates if not on HTTPS or if candidate has explicit protocol
    if (!this.isSecureHttps()) {
      if (typeof window !== 'undefined' && window.location.hostname) {
        candidates.add(window.location.hostname);
      }
      candidates.add('127.0.0.1');
      candidates.add('localhost');
      candidates.add('192.168.43.1'); // Android hotspot default

      await this.testCandidates(Array.from(candidates), 900);

      // Smart Subnet Scan only in local non-https context
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
          const commonPrefixes = ['192.168.1', '192.168.0', '192.168.43', '192.168.11', '10.0.0'];
          for (const prefix of commonPrefixes) {
            for (let i = 1; i <= 30; i++) {
              subnetHosts.push(`${prefix}.${i}`);
            }
          }
        }
        await this.testCandidates(subnetHosts, 500);
      }
    } else {
      // In HTTPS context (Vercel): Only check saved IP if specified with protocol or directly
      if (candidates.size > 0) {
        await this.testCandidates(Array.from(candidates), 1200);
      }
    }
  }

  private async testCandidates(hosts: string[], timeoutMs: number = 800) {
    const discovered = new Set<string>();

    const checkHost = async (host: string) => {
      if (!this.isSearching) return;
      // In HTTPS, do not attempt plain HTTP fetch to avoid Mixed Content console blocks
      if (this.isSecureHttps() && !host.startsWith('https://') && !host.startsWith('//')) {
        return;
      }

      try {
        const url = host.startsWith('http://') || host.startsWith('https://')
          ? `${host}/api/ping`
          : `http://${host}:8080/api/ping`;

        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.status === 'ok' || data.server)) {
            const peerName = data.server || `Serveur Club Al Oussoud (${host})`;

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

    const chunkSize = 15;
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
