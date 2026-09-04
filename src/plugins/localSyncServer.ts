import { registerPlugin, WebPlugin, PluginListenerHandle } from '@capacitor/core';

export interface LocalSyncServerPlugin {
  startServer(): Promise<{ port: number; ips?: string[] }>;
  stopServer(): Promise<void>;
  setPayload?(options: { payload: string }): Promise<void>;
  printHtml?(options: { html: string; title?: string }): Promise<void>;
  addListener(
    eventName: 'dataReceived',
    listenerFunc: (data: { payload: string }) => void
  ): Promise<PluginListenerHandle>;
}

export class LocalSyncServerWeb extends WebPlugin implements LocalSyncServerPlugin {
  private isServerRunning = false;
  private currentPayload: string = '';

  async startServer(): Promise<{ port: number; ips?: string[] }> {
    this.isServerRunning = true;
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
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
}

export const LocalSyncServer = registerPlugin<LocalSyncServerPlugin>('LocalSyncServer', {
  web: () => new LocalSyncServerWeb()
});
