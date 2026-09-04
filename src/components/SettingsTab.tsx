import React, { useState, useRef, useEffect } from 'react';
import { MembershipPlan, db } from '../db/db';
import { Card, Button, Input, Sheet } from './ui/shadcn';
import {
  Globe,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Share2,
  Copy,
  Download,
  Upload,
  Database,
  QrCode,
  Camera,
  Wifi,
  Radio,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  Activity,
  FileCheck2,
  Server,
  Search,
  Loader2
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LocalSyncServer } from '../plugins/localSyncServer';
import { sameNetworkSync, NetworkServerStatus } from '../utils/sameNetworkSync';
import { SupportedLanguage } from '../utils/i18n';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ConfirmDialog } from './ConfirmDialog';
import {
  generateOfflineSyncPayload,
  applyOfflineSyncPayload,
  exportAndShareSyncFile,
  importSyncFile,
  pushToLocalIp,
  pullFromLocalIp,
  pingLocalIp,
  tabBroadcastSync,
  fetchSyncPayloadFromUrl
} from '../utils/offlineSync';

interface SettingsTabProps {
  plans: MembershipPlan[];
  onPlansUpdated: () => void;
  lang: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  onShowToast?: (text: string, type?: "success" | "warning" | "expired") => void;
}

export function SettingsTab({
  plans,
  onPlansUpdated,
  lang,
  onLanguageChange,
  onShowToast,
}: SettingsTabProps) {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDuration, setEditDuration] = useState<number>(1);
  const [editPrice, setEditPrice] = useState<number>(0);

  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDuration, setNewDuration] = useState(1);
  const [newPrice, setNewPrice] = useState(250);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  // App-styled Modals
  const [showLangModal, setShowLangModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showClearDbModal, setShowClearDbModal] = useState(false);

  // Custom Styled Alert Modal
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    variant: 'danger' | 'warning' | 'primary' | 'success';
  }>({
    isOpen: false,
    title: '',
    description: '',
    variant: 'primary'
  });

  const showAlert = (title: string, description: string, variant: 'danger' | 'warning' | 'primary' | 'success' = 'primary') => {
    setAlertModal({ isOpen: true, title, description, variant });
  };
  // Local Sync Modal & Tabs
  const [showQrSyncModal, setShowQrSyncModal] = useState(false);
  const [syncTab, setSyncTab] = useState<'share' | 'scan' | 'wifi'>('share');
  const [compressedPayload, setCompressedPayload] = useState<string>('');
  const [memberCount, setMemberCount] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);

  // Camera QR Scanner States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Direct Local IP Sync States
  const [localIpInput, setLocalIpInput] = useState<string>(() => {
    try {
      return localStorage.getItem('cao_local_ip') || '';
    } catch {
      return '';
    }
  });
  const [showManualIp, setShowManualIp] = useState(false);
  const [ipSyncAction, setIpSyncAction] = useState<'push' | 'pull' | 'ping' | null>(null);
  const [ipSyncStatus, setIpSyncStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isFileImporting, setIsFileImporting] = useState(false);

  // Same-Network Instant Sync States (No code, No IP, 1-Click)
  const [networkSyncStatus, setNetworkSyncStatus] = useState<NetworkServerStatus>('idle');
  const [networkSyncMsg, setNetworkSyncMsg] = useState<string>('');
  const [isNetServerActive, setIsNetServerActive] = useState<boolean>(false);

  // Deterministic QR Pairing States
  const [pairingToken, setPairingToken] = useState<string>('');
  const [pairingQrPayload, setPairingQrPayload] = useState<string>('');
  const [scannerStep, setScannerStep] = useState<'idle' | 'scanning' | 'connecting' | 'downloading' | 'complete' | 'error'>('idle');
  const [scannerStatusMsg, setScannerStatusMsg] = useState<string>('');
  const [isReceiverScannerOpen, setIsReceiverScannerOpen] = useState(false);
  const receiverHtml5QrRef = useRef<Html5Qrcode | null>(null);

  // Embedded LocalSyncServer & NSD Discovery States
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [serverIps, setServerIps] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredPeers, setDiscoveredPeers] = useState<Array<{ name: string; host: string; port: number }>>([]);
  const discoveryListenerRef = useRef<any>(null);
  const serverPayloadListenerRef = useRef<any>(null);

  const qrImageInputRef = useRef<HTMLInputElement>(null);
  const syncFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRTL = lang === 'ar';

  // Preload Offline QR payload instantly on mount and whenever plans change
  const loadOfflineQrPayload = async () => {
    try {
      const { compressed, count } = await generateOfflineSyncPayload();
      setCompressedPayload(compressed);
      setMemberCount(count);
    } catch (err) {
      console.error('Error generating offline QR payload:', err);
    }
  };

  useEffect(() => {
    loadOfflineQrPayload();
  }, [plans]);

  // Tab broadcast listener for same-device multi-tab synchronization
  useEffect(() => {
    const unsub = tabBroadcastSync.onTabSync((res) => {
      if (res.success) {
        onPlansUpdated();
        setBackupStatus(
          lang === 'ar'
            ? `تم تحديث ${res.count} عضو تلقائياً من تبويب آخر!`
            : lang === 'en'
            ? `Updated ${res.count} members from another tab!`
            : `Synchronisé (${res.count} membres) depuis un autre onglet !`
        );
        setTimeout(() => setBackupStatus(null), 4000);
      }
    });
    return () => { unsub(); };
  }, [lang, onPlansUpdated]);

  useEffect(() => {
    const unsub = sameNetworkSync.onStatusChange((status, msg) => {
      setNetworkSyncStatus(status);
      setNetworkSyncMsg(msg);
      setIsNetServerActive(sameNetworkSync.getIsServerActive());
    });
    return () => { unsub(); };
  }, []);

  const handleToggleNetServer = async () => {
    if (isNetServerActive) {
      await sameNetworkSync.stopServer(lang);
      if (onShowToast) {
        onShowToast(lang === 'ar' ? 'تم إيقاف الخادم' : 'Serveur arrêté', 'warning');
      }
    } else {
      await sameNetworkSync.startServer(lang);
      if (onShowToast) {
        onShowToast(
          lang === 'ar'
            ? 'الخادم نشط ويبث الآن في الشبكة!'
            : 'Serveur actif et diffuse sur le réseau !',
          'success'
        );
      }
    }
  };

  const handlePullFromNetwork = async () => {
    const res = await sameNetworkSync.pullDataFromSameNetwork(lang);
    if (res.success) {
      onPlansUpdated();
      const msg = lang === 'ar'
        ? `تم بنجاح! تم استلام وتحديث ${res.count} عضو`
        : `Succès ! ${res.count} membres mis à jour`;
      if (onShowToast) {
        onShowToast(msg, 'success');
      }
    } else {
      const errMsg = res.message || (
        lang === 'ar'
          ? 'فشل في الاتصال أو لم يتم العثور على خادم في الشبكة'
          : 'Échec de connexion ou aucun serveur trouvé'
      );
      if (onShowToast) {
        onShowToast(errMsg, 'expired');
      }
    }
  };

  // Cleanup camera scanner on unmount or tab switch
  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
      try {
        html5QrCodeRef.current.clear();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Stop NSD Discovery
  const stopDiscoveryService = async () => {};

  useEffect(() => {
    return () => {
      stopCameraScanner();
      
    };
  }, []);

  useEffect(() => {
    if (!showQrSyncModal || syncTab !== 'scan') {
      stopCameraScanner();
    }
    if (!showQrSyncModal || syncTab !== 'wifi') {
      
    }
  }, [showQrSyncModal, syncTab]);

  // Start Camera QR Scanner
  const startCameraScanner = async () => {
    try {
      setCameraError(null);
      await stopCameraScanner();
      await new Promise((r) => setTimeout(r, 120));

      const elementId = 'qr-camera-viewfinder';
      const container = document.getElementById(elementId);
      if (!container) return;

      const qrScanner = new Html5Qrcode(elementId);
      html5QrCodeRef.current = qrScanner;

      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      let cameraConfig: any = { facingMode: 'environment' };
      if (cameras && cameras.length > 0) {
        const rearCam = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];
        if (rearCam?.id) cameraConfig = rearCam.id;
      }

      await qrScanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          }
        },
        async (decodedText) => {
          await stopCameraScanner();
          await handleApplySyncCode(decodedText);
        },
        () => {}
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera scanner error:', err);
      setIsCameraActive(false);
      setCameraError(
        lang === 'ar'
          ? 'تعذر تشغيل الكاميرا. تأكد من منح الإذن أو استخدم خيار رفع صورة QR أدناه.'
          : lang === 'en'
          ? 'Camera access failed. Ensure permission is granted or upload a QR image below.'
          : 'Erreur caméra. Vérifiez les permissions ou importez une image QR ci-dessous.'
      );
    }
  };
  // Scan QR from an image file fallback
  const handleScanQrImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setCameraError(null);
      const elementId = 'qr-image-scan-hidden';
      let hiddenEl = document.getElementById(elementId);
      if (!hiddenEl) {
        hiddenEl = document.createElement('div');
        hiddenEl.id = elementId;
        hiddenEl.style.display = 'none';
        document.body.appendChild(hiddenEl);
      }
      const scanner = new Html5Qrcode(elementId);
      const result = await scanner.scanFile(file, false);
      try { scanner.clear(); } catch {}
      if (hiddenEl.parentNode) hiddenEl.parentNode.removeChild(hiddenEl);
      await handleApplySyncCode(result);
    } catch (err: any) {
      console.error('Image QR scan error:', err);
      setCameraError(
        lang === 'ar'
          ? 'تعذر قراءة رمز QR من الصورة. تأكد أن الصورة واضحة.'
          : lang === 'en'
          ? 'Could not read QR from image. Make sure the image is clear.'
          : 'Impossible de lire le QR depuis l image.'
      );
    } finally {
      if (qrImageInputRef.current) qrImageInputRef.current.value = '';
    }
  };

  // Apply Sync Code into IndexedDB immediately with bulkPut
  const handleApplySyncCode = async (rawCode: string) => {
    try {
      if (!rawCode?.trim()) return;
      const res = await applyOfflineSyncPayload(rawCode);

      if (!res.success) {
        showAlert(
          lang === 'ar' ? 'رمز غير صالح' : lang === 'en' ? 'Invalid Payload' : 'Code Invalide',
          res.message,
          'danger'
        );
        return;
      }

      onPlansUpdated();
      setShowQrSyncModal(false);
      setBackupStatus(
        lang === 'ar'
          ? `✅ تمت المزامنة بنجاح! تم حفظ وتحديث ${res.count} عضو في قاعدة البيانات.`
          : lang === 'en'
          ? `✅ Sync completed! Updated ${res.count} members in database.`
          : `✅ Synchronisation réussie ! (${res.count} membres enregistrés)`
      );
      setTimeout(() => setBackupStatus(null), 5000);
    } catch (err: any) {
      console.error(err);
      showAlert(
        lang === 'ar' ? 'خطأ' : 'Error',
        err.message || 'فشلت معالجة رمز المزامنة',
        'danger'
      );
    }
  };

  // Open Modal Helper with immediate payload ready
  const handleOpenSyncModal = async (defaultTab: 'share' | 'scan' | 'wifi' = 'share') => {
    setSyncTab(defaultTab);
    setShowQrSyncModal(true);
    if (defaultTab === 'share') {
      await loadOfflineQrPayload();
    } else if (defaultTab === 'scan') {
      setTimeout(() => startCameraScanner(), 120);
    }
  };

  // 1-Click Share & Nearby: Export sync file via Android native share
  const handleShareSyncFile = async () => {
    const ok = await exportAndShareSyncFile();
    if (ok) {
      setBackupStatus(
        lang === 'ar' ? 'تم تجهيز ملف المزامنة للمشاركة بنجاح' : 'Sync file ready to share'
      );
      setTimeout(() => setBackupStatus(null), 3000);
    }
  };

  // 1-Click Import: Read selected file and merge immediately
  const handleImportSyncFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsFileImporting(true);
    try {
      const res = await importSyncFile(file);
      if (res.success) {
        onPlansUpdated();
        setShowQrSyncModal(false);
        setBackupStatus(
          lang === 'ar'
            ? `✅ تم استيراد ودمج ${res.count} عضو بنجاح من الملف!`
            : lang === 'en'
            ? `✅ Imported and merged ${res.count} members from file!`
            : `✅ Importation réussie (${res.count} membres) !`
        );
        setTimeout(() => setBackupStatus(null), 5000);
      } else {
        showAlert(
          lang === 'ar' ? 'خطأ في الاستيراد' : 'Import Error',
          res.message,
          'danger'
        );
      }
    } finally {
      setIsFileImporting(false);
      if (syncFileInputRef.current) syncFileInputRef.current.value = '';
    }
  };

  // Direct Local IP Sync Handlers
  const handlePushToIp = async () => {
    setIpSyncAction('push');
    setIpSyncStatus(null);
    try {
      try { localStorage.setItem('cao_local_ip', localIpInput); } catch {}
      const res = await pushToLocalIp(localIpInput);
      setIpSyncStatus({
        type: res.success ? 'success' : 'error',
        message: res.message
      });
      if (res.success) {
        setTimeout(() => setIpSyncStatus(null), 5000);
      }
    } catch (err: any) {
      setIpSyncStatus({ type: 'error', message: err.message || 'فشل الاتصال' });
    } finally {
      setIpSyncAction(null);
    }
  };

  const handlePullFromIp = async () => {
    setIpSyncAction('pull');
    setIpSyncStatus(null);
    try {
      try { localStorage.setItem('cao_local_ip', localIpInput); } catch {}
      const res = await pullFromLocalIp(localIpInput);
      if (res.success) {
        onPlansUpdated();
        setIpSyncStatus({
          type: 'success',
          message: `✅ تم سحب وتحديث ${res.count} عضو بنجاح من الخادم!`
        });
        setTimeout(() => {
          setShowQrSyncModal(false);
          setIpSyncStatus(null);
        }, 2500);
      } else {
        setIpSyncStatus({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setIpSyncStatus({ type: 'error', message: err.message || 'فشل السحب' });
    } finally {
      setIpSyncAction(null);
    }
  };

  const handlePingIp = async () => {
    setIpSyncAction('ping');
    setIpSyncStatus(null);
    try {
      try { localStorage.setItem('cao_local_ip', localIpInput); } catch {}
      const res = await pingLocalIp(localIpInput);
      setIpSyncStatus({
        type: res.success ? 'success' : 'error',
        message: res.message
      });
    } catch (err: any) {
      setIpSyncStatus({ type: 'error', message: 'تعذر الاتصال' });
    } finally {
      setIpSyncAction(null);
    }
  };

  const handleBroadcastTabSync = async () => {
    const ok = await tabBroadcastSync.broadcastNow();
    if (ok) {
      setBackupStatus(
        lang === 'ar' ? 'تم إرسال إشارة التحديث لجميع التبويبات المفتوحة' : 'Broadcasted to open tabs'
      );
      setTimeout(() => setBackupStatus(null), 3000);
    }
  };

  // Toggle Embedded Server (Become Server / Host)
  const handleToggleServer = async () => {
    if (isServerRunning) {
      try {
        await LocalSyncServer.stopServer();
      } catch (err) {
        console.warn('Failed to stop server:', err);
      }
      setIsServerRunning(false);
      setServerPort(null);
      setServerIps([]);
      setPairingQrPayload('');
    } else {
      try {
        const res = await LocalSyncServer.startServer();
        const port = res?.port || 8080;
        setIsServerRunning(true);
        setServerPort(port);

        // Preload database payload into memory for /api/sync-export
        try {
          const { compressed } = await generateOfflineSyncPayload();
          if ((LocalSyncServer as any).setPayload) {
            await (LocalSyncServer as any).setPayload({ payload: compressed });
          }
        } catch {}

        // STRICT REAL WI-FI IP RESOLUTION (Never 0.0.0.0, never localhost)
        const nonLoopbacks = (res?.ips || []).filter(
          (ip) => ip && ip !== '127.0.0.1' && ip !== 'localhost' && ip !== '0.0.0.0'
        );

        let finalIp = '';
        if (nonLoopbacks.length > 0) {
          finalIp = nonLoopbacks[0];
          setServerIps(nonLoopbacks);
        } else if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.hostname !== '0.0.0.0') {
          finalIp = window.location.hostname;
          setServerIps([finalIp]);
        }

        if (finalIp) {
          const serverUrl = `http://${finalIp}:${port}`;
          setPairingQrPayload(serverUrl);
        } else {
          setServerIps([]);
          setPairingQrPayload('');
        }
      } catch (err: any) {
        console.error('Failed to start server:', err);
        showAlert(
          lang === 'ar' ? 'فشل تشغيل الخادم' : 'Server Start Failed',
          err?.message || (lang === 'ar' ? 'تعذر تشغيل الخادم المحلي' : 'Unable to start local server'),
          'danger'
        );
      }
    }
  };

  // Direct 1-Hit Sync Request: Connects directly and imports Dexie.js database in a single hit
  const executeDirectSyncFetch = async (targetUrlOrIp: string) => {
    let clean = targetUrlOrIp.trim();
    if (!clean) return;

    // Parse if QR JSON payload was passed
    try {
      if (clean.startsWith('{') && clean.endsWith('}')) {
        const parsed = JSON.parse(clean);
        if (parsed.url) clean = parsed.url;
      }
    } catch {}

    setScannerStep('connecting');
    setScannerStatusMsg(lang === 'ar' ? 'جارٍ الاتصال وسحب البيانات...' : 'Connexion et synchronisation...');

    try {
      const res = await fetchSyncPayloadFromUrl(clean);
      if (res.success) {
        setScannerStep('complete');
        setScannerStatusMsg(
          lang === 'ar'
            ? `تم الاتصال وتحديث ${res.count} عضو بنجاح!`
            : `Synchronisation réussie (${res.count} membres) !`
        );
        onPlansUpdated();
        const toastMsg = lang === "ar"
          ? `تم بنجاح! تم استلام وتحديث ${res.count} عضو`
          : `Succès ! ${res.count} membres mis à jour`;
        if (onShowToast) {
          onShowToast(toastMsg, "success");
        }
        setTimeout(() => {
          setScannerStep('idle');
          setScannerStatusMsg('');
          setIsReceiverScannerOpen(false);
        }, 2200);
      } else {
        setScannerStep('error');
        setScannerStatusMsg(res.message);
      }
    } catch (e: any) {
      setScannerStep('error');
      setScannerStatusMsg(e.message || (lang === 'ar' ? 'فشل الاتصال بالخادم' : 'Échec de connexion'));
    }
  };

  // 1-Tap Auto-Discovery (Native UDP Broadcast / Auto-Detect)
  const handleAutoDiscoverySync = async () => {
    setScannerStep('connecting');
    setScannerStatusMsg(lang === 'ar' ? 'جارٍ البحث التلقائي عبر الشبكة...' : 'Recherche automatique...');

    if (discoveryListenerRef.current) {
      try { await discoveryListenerRef.current.remove(); } catch {}
    }

    let resolved = false;

    discoveryListenerRef.current = await LocalSyncServer.addListener('peerFound', async (peer) => {
      if (!peer || !peer.host || resolved) return;
      resolved = true;
      try { await LocalSyncServer.stopDiscovery(); } catch {}

      const targetEndpoint = `http://${peer.host}:${peer.port || 8080}`;
      setScannerStatusMsg(
        lang === 'ar'
          ? `تم العثور على الخادم (${peer.host})! جارٍ المزامنة...`
          : `Serveur trouvé (${peer.host}) ! Synchronisation...`
      );
      await executeDirectSyncFetch(targetEndpoint);
    });

    await LocalSyncServer.startDiscovery();

    // 4-Second Timeout for UDP Discovery before showing clean 1-line prompt
    setTimeout(async () => {
      if (!resolved) {
        try { await LocalSyncServer.stopDiscovery(); } catch {}
        setScannerStep('error');
        setScannerStatusMsg(
          lang === 'ar'
            ? 'تعذر الاكتشاف التلقائي. تأكد من تشغيل الخادم بالهاتف الأول، أو امسح رمز QR أدناه.'
            : 'Détection auto bloquée par le routeur. Scannez le QR code ci-dessous.'
        );
      }
    }, 4000);
  };

  // Stop Client Camera Scanner
  const stopReceiverScanner = async () => {
    if (receiverHtml5QrRef.current) {
      try {
        if (receiverHtml5QrRef.current.isScanning) {
          await receiverHtml5QrRef.current.stop();
        }
      } catch (e) {}
      try { receiverHtml5QrRef.current.clear(); } catch {}
      receiverHtml5QrRef.current = null;
    }
    setIsReceiverScannerOpen(false);
  };

  // Start Client Camera Scanner
  const startReceiverScanner = async () => {
    try {
      setScannerStep('scanning');
      setScannerStatusMsg('');
      setIsReceiverScannerOpen(true);
      await stopReceiverScanner();
      await new Promise((r) => setTimeout(r, 150));

      const elementId = 'qr-client-viewfinder';
      const container = document.getElementById(elementId);
      if (!container) return;

      const qrScanner = new Html5Qrcode(elementId);
      receiverHtml5QrRef.current = qrScanner;

      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      let cameraConfig: any = { facingMode: 'environment' };
      if (cameras && cameras.length > 0) {
        const rearCam = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];
        if (rearCam?.id) cameraConfig = rearCam.id;
      }

      await qrScanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (w, h) => {
            const minEdge = Math.min(w, h);
            const size = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: size, height: size };
          }
        },
        async (decodedText) => {
          await stopReceiverScanner();
          await executeDirectSyncFetch(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      console.error('Receiver camera error:', err);
      setScannerStep('error');
      setScannerStatusMsg(
        lang === 'ar'
          ? 'تعذر الوصول للكاميرا. يمكنك إدخال عنوان IP يدوياً بالأسفل.'
          : 'Erreur d accès caméra. Saisissez l adresse IP ci-dessous.'
      );
    }
  };

  const handleCopySyncText = async () => {
    if (!compressedPayload) return;
    try {
      await navigator.clipboard.writeText(compressedPayload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  // Plan Management Handlers
  const handleStartEdit = (plan: MembershipPlan) => {
    setEditingPlanId(plan.id);
    setEditName(plan.name);
    setEditDuration(plan.durationMonths);
    setEditPrice(plan.price);
  };

  const handleCancelEdit = () => {
    setEditingPlanId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingPlanId || !editName.trim()) return;
    await db.plans.update(editingPlanId, {
      name: editName.trim(),
      durationMonths: editDuration,
      price: editPrice
    });
    setEditingPlanId(null);
    onPlansUpdated();
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    const count = await db.plans.count();
    if (count <= 1) {
      setPlanToDelete(null);
      showAlert(
        lang === 'ar' ? 'تنبيه' : lang === 'en' ? 'Warning' : 'Attention',
        lang === 'ar'
          ? 'يجب أن تظل باقة واحدة على الأقل نشطة في النادي.'
          : lang === 'en'
          ? 'At least one membership plan must remain active in the system.'
          : 'Au moins une formule doit rester active.',
        'warning'
      );
      return;
    }
    await db.plans.delete(planToDelete.id);
    setPlanToDelete(null);
    onPlansUpdated();
  };

  const handleAddPlan = async () => {
    if (!newName.trim()) return;
    const newId = `plan-${Date.now()}`;
    await db.plans.add({
      id: newId,
      name: newName.trim(),
      durationMonths: newDuration,
      price: newPrice,
      description: `Boutique ${newName.trim()}`,
      features: []
    });
    setNewName('');
    setNewDuration(1);
    setNewPrice(250);
    setShowAddPlan(false);
    onPlansUpdated();
  };
  // Backup: JSON Export (Zero Data Loss)
  const handleExportBackup = async () => {
    try {
      const [allMembers, allPlans, allSubscriptions, allPayments] = await Promise.all([
        db.members.toArray(),
        db.plans.toArray(),
        db.subscriptions.toArray(),
        db.payments.toArray()
      ]);

      const backupData = {
        app: 'Club_Al_Oussoud',
        schemaVersion: 4,
        exportedAt: new Date().toISOString(),
        data: {
          members: allMembers,
          plans: allPlans,
          subscriptions: allSubscriptions,
          payments: allPayments
        }
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const fileName = `Club_Al_Oussoud_Backup_${new Date().toISOString().split('T')[0]}.json`;

      try {
        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });

        await Share.share({
          title: 'Sauvegarde Club Al Oussoud',
          text: `Sauvegarde complète de la base de données (${allMembers.length} membres)`,
          url: fileResult.uri,
          dialogTitle: 'Exporter la sauvegarde'
        });
      } catch {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setBackupStatus(
        lang === 'ar'
          ? 'تم استخراج النسخة الاحتياطية بنجاح!'
          : lang === 'en'
          ? 'JSON backup exported successfully!'
          : 'Sauvegarde JSON générée avec succès !'
      );
      setTimeout(() => setBackupStatus(null), 4000);
    } catch (err) {
      console.error(err);
      showAlert(
        lang === 'ar' ? 'خطأ في النسخ الاحتياطي' : lang === 'en' ? 'Backup Error' : 'Erreur de sauvegarde',
        lang === 'ar'
          ? 'حدث خطأ أثناء استخراج النسخة الاحتياطية.'
          : lang === 'en'
          ? 'An error occurred while generating backup.'
          : 'Erreur lors de l export de la sauvegarde.',
        'danger'
      );
    }
  };

  // Restore: JSON Import (Zero Data Loss)
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.data || !Array.isArray(parsed.data.members)) {
          showAlert(
            lang === 'ar' ? 'ملف غير صالح' : lang === 'en' ? 'Invalid File' : 'Fichier Invalide',
            lang === 'ar'
              ? 'ملف النسخة الاحتياطية غير صالح أو تالف.'
              : lang === 'en'
              ? 'Backup file format is invalid or corrupted.'
              : 'Fichier de sauvegarde invalide.',
            'danger'
          );
          return;
        }

        await db.transaction('rw', db.members, db.plans, db.subscriptions, db.payments, async () => {
          if (parsed.data.plans?.length > 0) {
            await db.plans.clear();
            await db.plans.bulkPut(parsed.data.plans);
          }
          if (parsed.data.members?.length > 0) {
            await db.members.clear();
            const normalizedMembers = parsed.data.members.map((m: any) => ({
              ...m,
              amountDue: m.amountDue ?? 0,
              isPaid: m.isPaid !== false && !(m.amountDue && m.amountDue > 0)
            }));
            await db.members.bulkPut(normalizedMembers);
          }
          if (parsed.data.subscriptions?.length > 0) {
            await db.subscriptions.clear();
            await db.subscriptions.bulkPut(parsed.data.subscriptions);
          }
          if (parsed.data.payments?.length > 0) {
            await db.payments.clear();
            await db.payments.bulkPut(parsed.data.payments);
          }
        });

        onPlansUpdated();
        setBackupStatus(
          lang === 'ar'
            ? 'تم استرجاع جميع البيانات بنجاح!'
            : lang === 'en'
            ? 'Database restored successfully!'
            : 'Restauration terminée avec succès !'
        );
        setTimeout(() => setBackupStatus(null), 4000);
      } catch (err) {
        console.error(err);
        showAlert(
          lang === 'ar' ? 'خطأ في الاسترجاع' : lang === 'en' ? 'Restore Error' : 'Erreur',
          lang === 'ar'
            ? 'تعذر قراءة ملف الـ JSON المحدد.'
            : lang === 'en'
            ? 'Failed to read the selected backup file.'
            : 'Erreur lors de la lecture du fichier JSON.',
          'danger'
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClearDatabase = async () => {
    await Promise.all([
      db.members.clear(),
      db.subscriptions.clear(),
      db.payments.clear()
    ]);
    setShowClearDbModal(false);
    onPlansUpdated();
    const wipeMsg = lang === 'ar'
      ? 'تم تصفير قاعدة البيانات بنجاح!'
      : lang === 'en'
      ? 'Database reset to zero successfully!'
      : 'Base réinitialisée avec succès !';
    if (onShowToast) {
      onShowToast(wipeMsg, 'success');
    }
  };

  // Localized texts
  const tTexts = {
    appLang: lang === 'ar' ? 'لغة التطبيق' : lang === 'en' ? 'App Language' : 'Langue',
    currentLangName: lang === 'ar' ? 'العربية (AR)' : lang === 'en' ? 'English (EN)' : 'Français (FR)',
    changeLangBtn: lang === 'ar' ? 'تغيير' : lang === 'en' ? 'Change' : 'Changer',
    plansTitle: lang === 'ar' ? 'باقات الاشتراك وأسعارها' : lang === 'en' ? 'Subscription Plans & Pricing' : 'Formules d Abonnement',
    plansSubtitle: lang === 'ar' ? 'تعديل أو إضافة باقات النادي والأسعار' : lang === 'en' ? 'Manage club pricing and durations' : 'Gérez les tarifs et durées des formules',
    addPlanBtn: lang === 'ar' ? 'إضافة' : lang === 'en' ? 'Add Plan' : 'Ajouter',
    newPlanTitle: lang === 'ar' ? 'إنشاء باقة جديدة' : lang === 'en' ? 'Create New Plan' : 'Nouvelle Formule',
    durationLabel: lang === 'ar' ? 'المدة (أشهر)' : lang === 'en' ? 'Duration (Months)' : 'Durée (Mois)',
    priceLabel: lang === 'ar' ? 'السعر (DH)' : lang === 'en' ? 'Price (DH)' : 'Tarif (DH)',
    cancelBtn: lang === 'ar' ? 'إلغاء' : lang === 'en' ? 'Cancel' : 'Annuler',
    saveBtn: lang === 'ar' ? 'حفظ' : lang === 'en' ? 'Save' : 'Enregistrer',
    monthUnit: lang === 'ar' ? 'أشهر' : lang === 'en' ? 'month(s)' : 'mois',
    p2pTitle: lang === 'ar' ? 'المزامنة المباشرة (QR & شبكة Wi-Fi)' : lang === 'en' ? 'Direct Sync (QR & Local Network)' : 'Synchronisation Directe (QR & Wi-Fi)',
    p2pSubtitle: lang === 'ar' ? 'مزامنة فورية بدون إنترنت بكاميرا QR أو شبكة Wi-Fi المحلية' : lang === 'en' ? '100% offline sync via camera QR or local Wi-Fi' : 'Synchronisation directe QR ou réseau local',
    p2pBtnText: lang === 'ar' ? 'عرض الرمز (QR)' : lang === 'en' ? 'Show QR Code' : 'Afficher QR Code',
    scanBtnText: lang === 'ar' ? 'مسح بالكاميرا' : lang === 'en' ? 'Scan Camera' : 'Scanner Caméra',
    wifiBtnText: lang === 'ar' ? 'شبكة Wi-Fi / IP' : lang === 'en' ? 'Local Wi-Fi / IP' : 'Réseau Wi-Fi / IP',
    backupSectionTitle: lang === 'ar' ? 'النسخ الاحتياطي والأمان (Zero Data Loss)' : lang === 'en' ? 'Backup & Safety (Zero Data Loss)' : 'Sauvegarde & Sécurité',
    backupJsonBtn: lang === 'ar' ? 'حفظ نسخة JSON' : lang === 'en' ? 'Save JSON Backup' : 'Sauvegarder JSON',
    restoreJsonBtn: lang === 'ar' ? 'استرجاع JSON' : lang === 'en' ? 'Restore JSON' : 'Restaurer JSON',
    resetDbBtn: lang === 'ar' ? 'تصفير قاعدة البيانات (البدء من الصفر)' : lang === 'en' ? 'Wipe Database (Start Fresh)' : 'Vider la base de données (Départ à zéro)',
    selectLangTitle: lang === 'ar' ? 'اختر لغة التطبيق' : lang === 'en' ? 'Select App Language' : 'Choisir la langue',
    syncModalTitle: lang === 'ar' ? 'مركز المزامنة الفورية (100% Offline)' : lang === 'en' ? 'Instant Offline Sync Hub' : 'Centre de Synchronisation Directe',
    tabShareQr: lang === 'ar' ? 'عرض الرمز (QR)' : lang === 'en' ? 'Show QR' : 'Afficher QR',
    tabScanCamera: lang === 'ar' ? 'مسح بالكاميرا' : lang === 'en' ? 'Scan Camera' : 'Scanner Caméra',
    tabWifiHotspot: lang === 'ar' ? 'شبكة Wi-Fi / IP' : lang === 'en' ? 'Local Wi-Fi' : 'Réseau Wi-Fi',
    scanCameraPrompt: lang === 'ar' ? 'وجه الكاميرا نحو شاشة الهاتف الآخر لمسح رمز QR فورياً' : lang === 'en' ? 'Point camera at partner screen to scan QR instantly' : 'Pointez la caméra vers l autre écran pour scanner',
    startCameraBtn: lang === 'ar' ? 'تشغيل الكاميرا للمسح' : lang === 'en' ? 'Start Camera' : 'Démarrer la caméra',
    stopCameraBtn: lang === 'ar' ? 'إيقاف الكاميرا' : lang === 'en' ? 'Stop Camera' : 'Arrêter la caméra',
    shareWaBtn: lang === 'ar' ? 'مشاركة ملف المزامنة' : lang === 'en' ? 'Share Sync File' : 'Partager fichier',
    wifiSyncTitle: lang === 'ar' ? 'المزامنة اللاسلكية المباشرة' : lang === 'en' ? 'Direct Wireless Sync' : 'Synchronisation Sans Fil Directe',
    wifiSyncDesc: lang === 'ar'
      ? 'مزامنة فورية بين جهازين على نفس شبكة Wi-Fi أو نقطة اتصال (Hotspot) بدون إنترنت.'
      : lang === 'en'
      ? 'Instant sync between devices on same Wi-Fi or Hotspot without internet.'
      : 'Synchronisation instantanée entre appareils sur le même réseau Wi-Fi ou Point d accès.',
    hostModeTitle: lang === 'ar' ? '1. وضع الاستقبال (خادم)' : lang === 'en' ? '1. Host Server Mode' : '1. Mode Serveur Hôte',
    hostModeDesc: lang === 'ar' ? 'شغّل هذا الهاتف كخادم لاستقبال البيانات من الهواتف الأخرى' : lang === 'en' ? 'Run this phone as server to receive data from peers' : 'Activer ce téléphone comme serveur pour recevoir les données',
    discoverModeTitle: lang === 'ar' ? '2. اكتشاف الأجهزة والمزامنة' : lang === 'en' ? '2. Discover & Sync' : '2. Découvrir et Synchroniser',
    discoverModeDesc: lang === 'ar' ? 'ابحث تلقائياً عن الأجهزة القريبة دون كتابة أي عنوان' : lang === 'en' ? 'Find nearby devices automatically without typing an IP' : 'Rechercher les appareils à proximité sans saisir d adresse',
    becomeServer: lang === 'ar' ? 'تشغيل كخادم (Host)' : lang === 'en' ? 'Become Server' : 'Mode Serveur',
    stopServer: lang === 'ar' ? 'إيقاف الخادم' : lang === 'en' ? 'Stop Server' : 'Arrêter le serveur',
    serverActive: lang === 'ar' ? 'الخادم نشط وجاهز' : lang === 'en' ? 'Server Ready' : 'Serveur Prêt',
    serverStopped: lang === 'ar' ? 'الخادم متوقف' : lang === 'en' ? 'Server Stopped' : 'Serveur Arrêté',
    findNearby: lang === 'ar' ? 'البحث عن أجهزة قريبة' : lang === 'en' ? 'Find Nearby Devices' : 'Rechercher appareils',
    stopDiscoveryBtn: lang === 'ar' ? 'إيقاف البحث' : lang === 'en' ? 'Stop Search' : 'Arrêter la recherche',
    searchingPeers: lang === 'ar' ? 'جارٍ البحث عن أجهزة قريبة...' : lang === 'en' ? 'Searching for nearby devices...' : 'Recherche d appareils en cours...',
    noPeersFound: lang === 'ar' ? 'لم يتم العثور على أجهزة بعد (تأكد من تشغيل الخادم بالهاتف الآخر)' : lang === 'en' ? 'No devices found (ensure server is running on peer)' : 'Aucun appareil trouvé (vérifiez que le serveur est actif)',
    syncWithDevice: lang === 'ar' ? 'مزامنة وسحب' : lang === 'en' ? 'Sync / Pull' : 'Synchroniser',
    pushToDevice: lang === 'ar' ? 'إرسال' : lang === 'en' ? 'Push' : 'Envoyer',
    manualIpToggle: lang === 'ar' ? 'إدخال عنوان IP يدوياً (خيارات متقدمة)' : lang === 'en' ? 'Manual IP Entry (Advanced)' : 'Saisie IP manuelle (Avancé)',
    copyCodeBtn: isCopied
      ? (lang === 'ar' ? 'تم النسخ!' : lang === 'en' ? 'Copied!' : 'Copié !')
      : (lang === 'ar' ? 'نسخ كود المزامنة' : lang === 'en' ? 'Copy Code' : 'Copier le code')
  };
  return (
    <div className={`space-y-4 pb-12 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* 1. App Language Card */}
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--surface)] text-[var(--primary)] border border-[var(--border)]">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)]">{tTexts.appLang}</h4>
            <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {tTexts.currentLangName}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowLangModal(true)}
          className="h-8 text-xs font-bold border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        >
          {tTexts.changeLangBtn}
        </Button>
      </Card>

      {/* 2. Membership Plans Management */}
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[var(--primary)]" />
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">{tTexts.plansTitle}</h4>
              <p className="text-[10px] text-[var(--text-muted)]">{tTexts.plansSubtitle}</p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setShowAddPlan(!showAddPlan)}
            className="h-8 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{tTexts.addPlanBtn}</span>
          </Button>
        </div>

        {/* Add Plan Form */}
        {showAddPlan && (
          <div className="p-3 rounded-xl border border-[var(--primary-border)] bg-[var(--primary-bg)] space-y-3 animate-in fade-in duration-150">
            <div className="text-xs font-bold text-[var(--primary)]">{tTexts.newPlanTitle}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input
                placeholder={lang === 'ar' ? 'اسم الباقة (مثال: 3 أشهر)' : 'Plan Name'}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-xs bg-[var(--card)] border-[var(--border)]"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  {tTexts.durationLabel}:
                </span>
                <Input
                  type="number"
                  min={1}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="h-8 text-xs bg-[var(--card)] border-[var(--border)]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                  {tTexts.priceLabel}:
                </span>
                <Input
                  type="number"
                  min={0}
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  className="h-8 text-xs bg-[var(--card)] border-[var(--border)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddPlan(false)}
                className="h-7 text-xs text-[var(--text-secondary)]"
              >
                {tTexts.cancelBtn}
              </Button>
              <Button
                size="sm"
                onClick={handleAddPlan}
                disabled={!newName.trim()}
                className="h-7 text-xs font-bold bg-[var(--primary)] text-white"
              >
                {tTexts.saveBtn}
              </Button>
            </div>
          </div>
        )}

        {/* Plans List */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {plans.map((plan) => {
            const isEditing = editingPlanId === plan.id;
            return (
              <div key={plan.id} className="py-2.5 flex items-center justify-between gap-2">
                {isEditing ? (
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 text-xs bg-[var(--surface)] border-[var(--border)]"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={editDuration}
                      onChange={(e) => setEditDuration(Number(e.target.value))}
                      className="h-7 text-xs bg-[var(--surface)] border-[var(--border)]"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      className="h-7 text-xs bg-[var(--surface)] border-[var(--border)]"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{plan.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {plan.durationMonths} {tTexts.monthUnit} • <span className="text-[var(--primary)] font-bold">{plan.price} DH</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="h-7 px-2.5 text-xs font-bold bg-[var(--primary)] text-white"
                      >
                        {tTexts.saveBtn}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-7 px-2 text-xs text-[var(--text-muted)]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEdit(plan)}
                        className="h-7 w-7 p-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlanToDelete({ id: plan.id, name: plan.name })}
                        className="h-7 w-7 p-0 text-[var(--danger)] hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. Modern QR Code Scanner & Local Network Sync Hub */}
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--primary)] animate-pulse" />
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                {tTexts.p2pTitle}
              </h4>
              <p className="text-[10px] text-[var(--text-muted)]">
                {tTexts.p2pSubtitle}
              </p>
            </div>
          </div>

          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            100% Offline
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => handleOpenSyncModal('share')}
            variant="outline"
            className="h-10 text-xs font-bold border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <QrCode className="w-4 h-4" />
            <span className="truncate">{tTexts.p2pBtnText}</span>
          </Button>

          <Button
            onClick={() => handleOpenSyncModal('scan')}
            variant="outline"
            className="h-10 text-xs font-bold border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-1.5"
          >
            <Camera className="w-4 h-4 text-[var(--primary)]" />
            <span className="truncate">{tTexts.scanBtnText}</span>
          </Button>

          <Button
            onClick={() => handleOpenSyncModal('wifi')}
            variant="outline"
            className="h-10 text-xs font-bold border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-1.5"
          >
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="truncate">{tTexts.wifiBtnText}</span>
          </Button>
        </div>
      </Card>

      {/* 4. Data Safety & Backup Center (Zero Data Loss) */}
      <Card className="p-4 border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[var(--primary)]" />
          <h4 className="text-xs font-bold text-[var(--text-primary)]">
            {tTexts.backupSectionTitle}
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleExportBackup}
            variant="outline"
            className="h-9 text-xs font-bold border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>{tTexts.backupJsonBtn}</span>
          </Button>

          <label className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5 text-[var(--success)]" />
            <span>{tTexts.restoreJsonBtn}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportBackup}
            />
          </label>
        </div>

        <Button
          onClick={() => setShowClearDbModal(true)}
          variant="ghost"
          className="w-full h-8 text-[11px] font-bold text-[var(--danger)] hover:bg-red-500/10 hover:text-[var(--danger)] transition flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{tTexts.resetDbBtn}</span>
        </Button>
      </Card>

      

      {/* App Language Selection Modal */}
      {showLangModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xs rounded-2xl bg-[var(--card)] border border-[var(--border)] p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <h3 className="text-xs font-bold text-[var(--text-primary)]">{tTexts.selectLangTitle}</h3>
              <button onClick={() => setShowLangModal(false)} className="text-[var(--text-muted)] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {[
                { code: 'ar', label: 'العربية (AR)' },
                { code: 'en', label: 'English (EN)' },
                { code: 'fr', label: 'Français (FR)' }
              ].map((item) => (
                <button
                  key={item.code}
                  onClick={() => {
                    onLanguageChange(item.code as SupportedLanguage);
                    setShowLangModal(false);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                    lang === item.code
                      ? 'border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span>{item.label}</span>
                  {lang === item.code && <Check className="w-4 h-4 text-[var(--primary)]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Local Sync Hub Sheet */}
      <Sheet
        isOpen={showQrSyncModal}
        onClose={() => {
          stopCameraScanner();
          
          setShowQrSyncModal(false);
        }}
        title={tTexts.syncModalTitle}
      >
        <div className={`space-y-4 py-2 text-xs ${isRTL ? 'rtl' : 'ltr'}`}>
          {/* Triple Tabs: Share QR vs Camera Scanner vs Wi-Fi / IP */}
          <div className="flex bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1 gap-1">
            <button
              onClick={() => {
                stopCameraScanner();
                
                setSyncTab('share');
                loadOfflineQrPayload();
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                syncTab === 'share'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{tTexts.tabShareQr}</span>
            </button>

            <button
              onClick={() => {
                
                setSyncTab('scan');
                startCameraScanner();
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                syncTab === 'scan'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{tTexts.tabScanCamera}</span>
            </button>

            <button
              onClick={() => {
                stopCameraScanner();
                setSyncTab('wifi');
                // Automatically kick off discovery for instant results on web & iPhone
                setTimeout(() => {
                  // No background discovery loop needed
                }, 100);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                syncTab === 'wifi'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{tTexts.tabWifiHotspot}</span>
            </button>
          </div>

          {/* TAB 1: Standalone Offline QR Code (Instant 100ms render) */}
          {syncTab === 'share' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white text-zinc-950 border border-[var(--border)] shadow-md">
                <QRCodeSVG
                  value={compressedPayload || 'CAO_LZ:'}
                  size={230}
                  level="L"
                  includeMargin={true}
                  className="rounded-lg"
                />

                <div className="text-[10px] font-bold text-zinc-700 mt-2 text-center flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {lang === 'ar'
                      ? `رمز مشفر ومضغوط بـ LZ-String جاهز للمسح فورا (${memberCount} عضو)`
                      : `Compressed LZ payload ready for instant scan (${memberCount} members)`}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Native Share & Copy Code */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleShareSyncFile}
                  variant="outline"
                  className="h-10 text-xs font-bold border-[var(--primary-border)] bg-[var(--surface)] text-[var(--primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{tTexts.shareWaBtn}</span>
                </Button>

                <Button
                  onClick={handleCopySyncText}
                  variant="outline"
                  className="h-10 text-xs font-bold border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-[var(--success)]" />
                  <span>{tTexts.copyCodeBtn}</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: Camera QR Scanner (html5-qrcode with WebView fixes) */}
          {syncTab === 'scan' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="text-center text-[11px] text-[var(--text-secondary)] font-medium">
                {tTexts.scanCameraPrompt}
              </div>

              {/* Viewfinder element for Html5Qrcode */}
              <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-zinc-950 border-2 border-[var(--primary-border)] shadow-lg flex items-center justify-center">
                <div id="qr-camera-viewfinder" className="w-full h-full object-cover" />

                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-zinc-950/90 z-10 space-y-2">
                    <Camera className="w-8 h-8 text-[var(--primary)] animate-pulse" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {lang === 'ar' ? 'الكاميرا متوقفة' : 'Camera Inactive'}
                    </span>
                    <Button
                      size="sm"
                      onClick={startCameraScanner}
                      className="h-8 text-xs font-bold bg-[var(--primary)] text-white"
                    >
                      {tTexts.startCameraBtn}
                    </Button>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] text-xs text-center space-y-2">
                  <p className="text-[var(--danger)] font-bold">{cameraError}</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-xs font-bold cursor-pointer hover:bg-[var(--primary-hover)] transition">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'رفع صورة QR بديلاً' : 'Upload QR Image Instead'}</span>
                    <input ref={qrImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleScanQrImage} />
                  </label>
                </div>
              )}

              {/* Image upload fallback always available */}
              {!isCameraActive && !cameraError && (
                <div className="text-center">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] text-[11px] font-medium cursor-pointer hover:bg-[var(--surface-hover)] transition">
                    <Upload className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'أو ارفع صورة رمز QR من المعرض' : 'Or upload QR image from gallery'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleScanQrImage} />
                  </label>
                </div>
              )}

              {isCameraActive && (
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={stopCameraScanner}
                    className="h-8 text-xs font-bold border-[var(--danger-border)] text-[var(--danger)] hover:bg-red-500/10"
                  >
                    {tTexts.stopCameraBtn}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Deterministic Wi-Fi Sync Engine */}
          {syncTab === 'wifi' && (
            <div className="space-y-4 animate-in fade-in duration-150">

              {/* CARD 1: HOST / BROADCASTER */}
              <div className="p-4 rounded-2xl border border-[var(--primary-border)] bg-[var(--card)] space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--primary-bg)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary)] shadow-sm">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wide">
                        {lang === 'ar' ? '1. الهاتف الأول (مشاركة البيانات)' : '1. PREMIER TÉLÉPHONE (PARTAGE)'}
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {lang === 'ar' ? 'تشغيل الخادم لبث المشتركين لكافة أجهزة نفس الشبكة' : 'Activer le serveur pour transmettre les données'}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 border transition-all ${
                    isNetServerActive
                      ? 'bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)]'
                      : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isNetServerActive ? 'bg-[var(--success)] animate-ping' : 'bg-zinc-500'
                    }`} />
                    <span>
                      {isNetServerActive
                        ? (lang === 'ar' ? 'الخادم نشط' : 'Actif')
                        : (lang === 'ar' ? 'متوقف' : 'Inactif')}
                    </span>
                  </span>
                </div>

                <div className="pt-1">
                  {!isNetServerActive ? (
                    <Button
                      size="sm"
                      onClick={handleToggleNetServer}
                      disabled={networkSyncStatus === 'starting'}
                      className="w-full h-11 text-xs font-black rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
                    >
                      {networkSyncStatus === 'starting' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <Wifi className="w-4 h-4" />
                      )}
                      <span>{lang === 'ar' ? 'بدء المشاركة وتشغيل الخادم' : 'Démarrer le partage et le serveur'}</span>
                    </Button>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-xl bg-[var(--success-bg)] border border-[var(--success-border)] text-[11px] text-[var(--success)] font-bold text-center leading-relaxed">
                        {lang === 'ar'
                          ? 'الخادم نشط ويبث الآن! في الهاتف الثاني اضغط على (سحب البيانات).'
                          : 'Serveur actif ! Sur le 2ème téléphone, appuyez sur (Télécharger les données).'}
                      </div>
                      <Button
                        size="sm"
                        onClick={handleToggleNetServer}
                        className="w-full h-9 text-xs font-bold rounded-xl bg-[var(--danger-bg)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white border border-[var(--danger-border)] flex items-center justify-center gap-1.5 transition-all active:scale-98"
                      >
                        <X className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'إيقاف الخادم' : 'Arrêter le serveur'}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 2: RECEIVER / PULL */}
              <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] space-y-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wide">
                      {lang === 'ar' ? '2. الهاتف الثاني (استلام البيانات)' : '2. DEUXIÈME TÉLÉPHONE (RÉCEPTION)'}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {lang === 'ar' ? 'التعرف التلقائي وسحب المشتركين بنقرة واحدة' : 'Recherche automatique et mise à jour en 1 clic'}
                    </p>
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <Button
                    size="sm"
                    onClick={handlePullFromNetwork}
                    disabled={networkSyncStatus === 'pulling'}
                    className="w-full h-11 text-xs font-black rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    {networkSyncStatus === 'pulling' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>{lang === 'ar' ? 'جارٍ الاتصال وسحب البيانات...' : 'Connexion et téléchargement...'}</span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'سحب البيانات من الهاتف الآخر (1 نقرة)' : 'Télécharger les données (1 clic)'}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

            </div>
          )}
        </div>
      </Sheet>

      {/* Delete Plan Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(planToDelete)}
        title={lang === 'ar' ? 'تأكيد حذف الباقة' : 'Confirm Delete Plan'}
        description={
          lang === 'ar'
            ? `هل أنت متأكد من حذف الباقة "${planToDelete?.name}"؟`
            : `Are you sure you want to delete "${planToDelete?.name}"?`
        }
        confirmText={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelText={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={handleDeletePlan}
        onClose={() => setPlanToDelete(null)}
      />

      {/* Clear Database Confirmation */}
      <ConfirmDialog
        isOpen={showClearDbModal}
        title={lang === 'ar' ? 'تصفير قاعدة البيانات' : 'Wipe Database'}
        description={
          lang === 'ar'
            ? 'تحذير: سيتم حذف جميع المشتركين والمدفوعات وسجل العمليات نهائياً! لا يمكن التراجع عن هذا الإجراء.'
            : 'Warning: This will permanently erase all members, payments, and subscriptions!'
        }
        confirmText={lang === 'ar' ? 'نعم، مسح كل شيء' : 'Yes, wipe everything'}
        cancelText={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={handleClearDatabase}
        onClose={() => setShowClearDbModal(false)}
      />

      {/* Custom General Alert Dialog */}
      <ConfirmDialog
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        description={alertModal.description}
        confirmText={lang === 'ar' ? 'حسناً' : 'OK'}
        variant={alertModal.variant}
        onConfirm={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

