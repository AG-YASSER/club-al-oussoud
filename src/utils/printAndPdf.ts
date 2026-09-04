import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { LocalSyncServer } from '../plugins/localSyncServer';

export interface PrintAndPdfOptions {
  html: string;
  title: string;
  lang?: string;
}

export async function exportHtmlToPrintAndPdf(options: PrintAndPdfOptions): Promise<void> {
  const { html, title } = options;
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1. Android & iOS Native Environment (Capacitor)
  if (Capacitor.isNativePlatform()) {
    try {
      // Calls Android native PrintManager -> opens system "Enregistrer au format PDF" / Print dialog directly!
      await LocalSyncServer.printHtml({
        html,
        title: sanitizedTitle
      });
      return;
    } catch (err) {
      console.warn('Native PrintManager failed, falling back to native file sharing:', err);
    }

    try {
      // Fallback: Write HTML file into Cache directory and trigger native Android Share sheet
      const fileName = `${sanitizedTitle}.html`;
      const fileResult = await Filesystem.writeFile({
        path: fileName,
        data: html,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      await Share.share({
        title,
        text: title,
        url: fileResult.uri,
        dialogTitle: title
      });
      return;
    } catch (shareErr) {
      console.error('Native file share failed:', shareErr);
    }
  }

  // 2. Web Browser: Invisible iframe print (no popup blocker)
  try {
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
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 3000);
      }, 400);
      return;
    }
  } catch (iframeErr) {
    console.warn('Iframe print failed:', iframeErr);
  }

  // 3. Web Fallback: Direct Blob download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizedTitle}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
