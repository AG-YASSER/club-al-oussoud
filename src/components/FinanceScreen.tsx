import React, { useState, useMemo } from 'react';
import { Payment, Member } from '../db/db';
import { Card, Badge, Button, Sheet } from './ui/shadcn';
import { ConfirmDialog } from './ConfirmDialog';
import {
  TrendingUp,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Banknote,
  ArrowUpRight,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { SupportedLanguage, translations, getWhatsAppReminder } from '../utils/i18n';

interface FinanceScreenProps {
  payments: Payment[];
  members: Member[];
  onTogglePayment: (member: Member) => void;
  onSettleDebt?: (member: Member) => void;
  lang: SupportedLanguage;
}

export function FinanceScreen({
  payments,
  members,
  onTogglePayment,
  onSettleDebt,
  lang
}: FinanceScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'apercu' | 'recettes' | 'dettes'>('apercu');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; description: string; variant?: 'warning' | 'danger' | 'primary' | 'success' }>({
    isOpen: false,
    title: '',
    description: '',
    variant: 'warning'
  });

  const t = translations[lang] || translations.fr;
  const isRTL = lang === 'ar';

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  // Month and Week boundaries
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Filter Payments
  const todayPayments = useMemo(() => {
    return payments.filter((p) => p.paymentDate === todayStr);
  }, [payments, todayStr]);

  const thisWeekPayments = useMemo(() => {
    return payments.filter((p) => {
      const d = new Date(p.paymentDate || p.timestamp);
      return isWithinInterval(d, { start: currentWeekStart, end: currentWeekEnd });
    });
  }, [payments, currentWeekStart, currentWeekEnd]);

  const thisMonthPayments = useMemo(() => {
    return payments.filter((p) => {
      const d = new Date(p.paymentDate || p.timestamp);
      return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
    });
  }, [payments, currentMonthStart, currentMonthEnd]);

  // Cash totals
  const todayRevenue = useMemo(() => todayPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0), [todayPayments]);
  const weekRevenue = useMemo(() => thisWeekPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0), [thisWeekPayments]);
  const monthRevenue = useMemo(() => thisMonthPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0), [thisMonthPayments]);

  // Active Members and Debts (excluding soft-deleted)
  const activeMembers = useMemo(() => members.filter((m) => !m.isDeleted), [members]);
  const unpaidMembers = useMemo(() => activeMembers.filter((m) => (m.amountDue || 0) > 0 || !m.isPaid), [activeMembers]);
  const totalDebt = useMemo(() => unpaidMembers.reduce((sum, m) => sum + (m.amountDue || 0), 0), [unpaidMembers]);

  // Collection Rate
  const collectionRate = useMemo(() => {
    const totalPotential = monthRevenue + totalDebt;
    if (totalPotential === 0) return 100;
    return Math.min(100, Math.round((monthRevenue / totalPotential) * 100));
  }, [monthRevenue, totalDebt]);

  // Recent 5 Transactions
  const recentTransactions = useMemo(() => {
    return [...payments].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [payments]);

  // EXPORT 1: Clean Excel / CSV with UTF-8 BOM
  const exportToExcelCSV = () => {
    try {
      const headers = [
        lang === 'ar' ? 'النوع' : 'Type',
        lang === 'ar' ? 'التاريخ' : 'Date',
        lang === 'ar' ? 'المشترك' : 'Membre',
        lang === 'ar' ? 'المبلغ (DH)' : 'Montant (DH)',
        lang === 'ar' ? 'وسيلة الدفع' : 'Mode Paiement',
        lang === 'ar' ? 'ملاحظة' : 'Note'
      ];

      const paymentRows = payments.map((p) => [
        lang === 'ar' ? 'مقبوضات كاش' : 'RECETTE CASH',
        p.paymentDate,
        `"${p.memberName.replace(/"/g, '""')}"`,
        p.amountPaid,
        'CASH',
        `"${(p.note || '').replace(/"/g, '""')}"`
      ]);

      const debtRows = unpaidMembers.map((m) => [
        lang === 'ar' ? 'دين معلق' : 'DETTE EN COURS',
        m.expiryDate,
        `"${m.fullName.replace(/"/g, '""')}"`,
        m.amountDue || 0,
        lang === 'ar' ? 'غير مسدد' : 'NON PAYE',
        `"${(m.notes || '').replace(/"/g, '""')}"`
      ]);

      const summaryRows = [
        [],
        [lang === 'ar' ? '--- ملخص الحسابات المالية ---' : '--- RESUME FINANCIER GLOBAL ---'],
        [lang === 'ar' ? 'مجموع مقبوضات الشهر (كاش)' : 'Recettes du mois (CASH)', `${monthRevenue} DH`],
        [lang === 'ar' ? 'مجموع الديون المعلقة' : 'Total des dettes', `${totalDebt} DH`],
        [lang === 'ar' ? 'نسبة التحصيل' : 'Taux de recouvrement', `${collectionRate}%`],
        [lang === 'ar' ? 'عدد الأعضاء النشطين' : 'Membres actifs', `${activeMembers.length}`],
        [lang === 'ar' ? 'تاريخ التصدير' : 'Date d extraction', new Date().toLocaleString()]
      ];

      const csvContent = [
        headers.join(';'),
        ...paymentRows.map((r) => r.join(';')),
        ...debtRows.map((r) => r.join(';')),
        ...summaryRows.map((r) => r.join(';'))
      ].join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Club_Al_Oussoud_Finances_${todayStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsExportOpen(false);
    } catch (err) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        title: lang === 'ar' ? 'خطأ في التصدير' : 'Erreur',
        description: lang === 'ar' ? 'تعذر استخراج ملف الـ CSV.' : 'Erreur lors de l export CSV.',
        variant: 'danger'
      });
    }
  };

  // EXPORT 2: Printable High-End Clean PDF Document
  const exportToCleanPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setAlertModal({
        isOpen: true,
        title: lang === 'ar' ? 'تنبيه النوافذ المنبثقة' : 'Fenêtres Pop-up',
        description: lang === 'ar' ? 'يرجى السماح بالنوافذ المنبثقة في المتصفح لطباعة التقرير المالي.' : 'Veuillez autoriser les fenêtres pop-up pour imprimer le rapport.',
        variant: 'warning'
      });
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8" />
        <title>Rapport Financier - Club Al Oussoud</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
            margin: 0;
            padding: 30px;
            color: #09090b;
            background: #ffffff;
            direction: ${isRTL ? 'rtl' : 'ltr'};
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #f97316;
            padding-bottom: 12px;
            margin-bottom: 25px;
          }
          .brand {
            font-size: 22px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .brand span { color: #f97316; }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 25px;
          }
          .kpi-card {
            border: 1px solid #e4e4e7;
            border-radius: 8px;
            padding: 12px;
            background: #fafafa;
          }
          .kpi-title {
            font-size: 10px;
            text-transform: uppercase;
            color: #71717a;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .kpi-val {
            font-size: 18px;
            font-weight: 900;
            font-family: monospace;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 25px;
          }
          th {
            background: #f4f4f5;
            color: #18181b;
            font-weight: 800;
            text-align: ${isRTL ? 'right' : 'left'};
            padding: 8px 10px;
            border-bottom: 1px solid #e4e4e7;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #f4f4f5;
          }
          .footer {
            margin-top: 30px;
            border-top: 1px solid #e4e4e7;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #71717a;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">CLUB <span>AL OUSSOUD</span></div>
            <div style="font-size:11px;color:#71717a;margin-top:3px;">
              ${lang === 'ar' ? 'تقرير المداخيل والمقبوضات النقدية الرسمية' : 'Rapport Officiel des Recettes et Encaissements Espèces'}
            </div>
          </div>
          <div style="font-size:11px;font-weight:bold;color:#52525b;">${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">${lang === 'ar' ? 'مداخيل اليوم' : 'Recettes Aujourd\'hui'}</div>
            <div class="kpi-val" style="color:#16a34a;">+${todayRevenue} DH</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">${lang === 'ar' ? 'مداخيل الشهر' : 'Recettes ce Mois'}</div>
            <div class="kpi-val" style="color:#16a34a;">+${monthRevenue} DH</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">${lang === 'ar' ? 'الديون المعلقة' : 'Dettes à Recouvrer'}</div>
            <div class="kpi-val" style="color:#dc2626;">-${totalDebt} DH</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">${lang === 'ar' ? 'نسبة التحصيل' : 'Taux Recouvrement'}</div>
            <div class="kpi-val" style="color:#ea580c;">${collectionRate}%</div>
          </div>
        </div>

        <h3 style="font-size:12px;font-weight:800;margin-bottom:8px;">
          ${lang === 'ar' ? 'سجل المقبوضات النقدية (CASH)' : 'Journal des Encaissements Espèces (CASH)'}
        </h3>
        <table>
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'التاريخ' : 'Date'}</th>
              <th>${lang === 'ar' ? 'المشترك' : 'Membre'}</th>
              <th>${lang === 'ar' ? 'المبلغ المستلم' : 'Montant Encaissé'}</th>
              <th>${lang === 'ar' ? 'طريقة الدفع' : 'Mode'}</th>
            </tr>
          </thead>
          <tbody>
            ${
              payments.length > 0
                ? payments
                    .slice(0, 100)
                    .map(
                      (p) => `
              <tr>
                <td>${p.paymentDate}</td>
                <td><strong>${p.memberName}</strong> (#${p.memberId})</td>
                <td style="font-weight:bold;color:#16a34a;">+${p.amountPaid} DH</td>
                <td><span style="background:#ecfdf5;color:#047857;padding:2px 6px;border-radius:4px;font-weight:bold;">CASH</span></td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="4" style="text-align:center;color:#a1a1aa;">${lang === 'ar' ? 'لا توجد مقبوضات مسجلة' : 'Aucun enregistrement.'}</td></tr>`
            }
          </tbody>
        </table>

        <div class="footer">
          <div>Club Al Oussoud - Système de Gestion Financière</div>
          <div>${lang === 'ar' ? 'تم استخراج التقرير آلياً' : 'Document généré automatiquement'}</div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    setIsExportOpen(false);
  };

  const handleSettleDebtClick = (member: Member) => {
    if (onSettleDebt) {
      onSettleDebt(member);
    } else {
      onTogglePayment(member);
    }
  };

  return (
    <div className={`space-y-4 pb-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* 1. Main 3 KPI Top Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-[var(--card)] border border-[var(--border)] p-3 space-y-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--success)]" />
            <span className="text-[10px] uppercase font-bold tracking-tight">
              {lang === 'ar' ? 'المداخيل' : 'Recettes'}
            </span>
          </div>
          <div className="font-mono text-base font-black text-[var(--success)] tracking-tight">
            {monthRevenue} <span className="text-[10px] font-normal text-[var(--text-secondary)]">DH</span>
          </div>
        </Card>

        <Card className="bg-[var(--card)] border border-[var(--border)] p-3 space-y-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <AlertCircle className="w-3.5 h-3.5 text-[var(--danger)]" />
            <span className="text-[10px] uppercase font-bold tracking-tight">
              {lang === 'ar' ? 'الديون' : 'Dettes'}
            </span>
          </div>
          <div className="font-mono text-base font-black text-[var(--danger)] tracking-tight">
            {totalDebt} <span className="text-[10px] font-normal text-[var(--text-secondary)]">DH</span>
          </div>
        </Card>

        <Card className="bg-[var(--card)] border border-[var(--border)] p-3 space-y-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <Banknote className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span className="text-[10px] uppercase font-bold tracking-tight">
              {lang === 'ar' ? 'التحصيل' : 'Recouvr.'}
            </span>
          </div>
          <div className="font-mono text-base font-black text-[var(--text-primary)] tracking-tight">
            {collectionRate}%
          </div>
        </Card>
      </div>

      {/* 2. Sub-Tabs & Export Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex-1">
          <button
            onClick={() => setActiveSubTab('apercu')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'apercu'
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {lang === 'ar' ? 'نظرة عامة' : 'Aperçu'}
          </button>
          <button
            onClick={() => setActiveSubTab('recettes')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'recettes'
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {lang === 'ar' ? `المقبوضات (${payments.length})` : `Recettes (${payments.length})`}
          </button>
          <button
            onClick={() => setActiveSubTab('dettes')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'dettes'
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {lang === 'ar' ? `الديون (${unpaidMembers.length})` : `Dettes (${unpaidMembers.length})`}
          </button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsExportOpen(true)}
          className="h-8 border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
        >
          <Download className="w-3.5 h-3.5 mr-1 text-[var(--primary)]" />
          {lang === 'ar' ? 'تصدير' : 'Exporter'}
        </Button>
      </div>

      {/* SUBTAB 1: Financial Snapshot */}
      {activeSubTab === 'apercu' && (
        <div className="space-y-3">
          {/* Quick Cash Stat Cards: Today, This Week, This Month */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">
                {lang === 'ar' ? 'اليوم' : 'Aujourd\'hui'}
              </span>
              <span className="font-mono text-sm font-black text-[var(--success)] block">
                +{todayRevenue} DH
              </span>
            </Card>

            <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">
                {lang === 'ar' ? 'هذا الأسبوع' : 'Cette semaine'}
              </span>
              <span className="font-mono text-sm font-black text-[var(--primary)] block">
                +{weekRevenue} DH
              </span>
            </Card>

            <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">
                {lang === 'ar' ? 'هذا الشهر' : 'Ce mois'}
              </span>
              <span className="font-mono text-sm font-black text-[var(--text-primary)] block">
                +{monthRevenue} DH
              </span>
            </Card>
          </div>

          {/* Collection Progress Bar */}
          <Card className="bg-[var(--card)] border border-[var(--border)] p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[var(--text-primary)] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
                {lang === 'ar' ? 'معدل تحصيل الاشتراكات' : 'Taux de Recouvrement'}
              </span>
              <span className="font-mono text-[var(--primary)]">{collectionRate}%</span>
            </div>

            <div className="w-full h-2.5 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border)]">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-medium pt-0.5">
              <span>{lang === 'ar' ? 'مستخلص:' : 'Encaissé :'} {monthRevenue} DH</span>
              <span>{lang === 'ar' ? 'باقي ديون:' : 'Restant :'} {totalDebt} DH</span>
            </div>
          </Card>

          {/* Recent 5 Transactions */}
          <Card className="bg-[var(--card)] border border-[var(--border)] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-[var(--success)]" />
                {lang === 'ar' ? 'أحدث المقبوضات النقدية' : 'Dernières Transactions'}
              </h4>
              <Badge variant="outline" className="text-[10px] border-[var(--border)] text-[var(--text-secondary)] font-bold">
                Top 5
              </Badge>
            </div>

            <div className="space-y-2">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center text-[var(--success)] font-black text-xs">
                        DH
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">{p.memberName}</div>
                        <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                          <span>{p.paymentDate}</span>
                          {p.note && <span>• {p.note}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right rtl:text-left">
                      <span className="font-mono text-xs font-black text-[var(--success)]">
                        +{p.amountPaid} DH
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border)] rounded-xl">
                  {lang === 'ar' ? 'لا توجد مقبوضات مسجلة حتى الآن.' : 'Aucune transaction récente.'}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* SUBTAB 2: Full Cash Receipts Feed */}
      {activeSubTab === 'recettes' && (
        <div className="space-y-2">
          {payments.length > 0 ? (
            payments.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center text-[var(--success)]">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{p.memberName}</div>
                    <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                      <span>#{p.memberId}</span>
                      <span>•</span>
                      <span>{p.paymentDate}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right rtl:text-left">
                  <div className="font-mono text-xs font-black text-[var(--success)]">
                    +{p.amountPaid} DH
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider text-[var(--success)] border-[var(--success-border)] bg-[var(--success-bg)] mt-0.5">
                    CASH
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-[var(--text-muted)] text-xs border border-[var(--border)] rounded-xl bg-[var(--card)]">
              {lang === 'ar' ? 'لا توجد مقبوضات كاش مسجلة.' : 'Aucun encaissement cash enregistré.'}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: Debts List */}
      {activeSubTab === 'dettes' && (
        <div className="space-y-2">
          {unpaidMembers.length > 0 ? (
            unpaidMembers.map((member) => {
              const waText = getWhatsAppReminder(lang, member.fullName, member.planName, 0, true);
              const waUrl = `https://wa.me/212${member.phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(waText)}`;

              return (
                <div
                  key={member.id}
                  className="p-3.5 rounded-xl border border-[var(--danger-border)] bg-[var(--card)] space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">{member.fullName}</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {member.planName} • {lang === 'ar' ? 'تاريخ:' : 'Échéance:'} {member.expiryDate}
                      </div>
                    </div>

                    <Badge variant="destructive" className="font-mono text-xs font-black">
                      {member.amountDue || 0} DH
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-[var(--border-subtle)]">
                    <Button
                      size="sm"
                      onClick={() => handleSettleDebtClick(member)}
                      className="flex-1 h-8 text-xs font-bold bg-[var(--danger)] hover:opacity-90 text-white"
                    >
                      <Banknote className="w-3.5 h-3.5 mr-1" />
                      {lang === 'ar' ? `استخلاص (${member.amountDue || 0} DH)` : `Encaisser (${member.amountDue || 0} DH)`}
                    </Button>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-xs flex items-center justify-center transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[var(--success)]" />
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-[var(--text-muted)] text-xs border border-[var(--border)] rounded-xl bg-[var(--card)]">
              {lang === 'ar' ? 'ممتاز! لا توجد أي ديون متراكمة على المشتركين.' : 'Aucune dette en attente. Tout est régularisé !'}
            </div>
          )}
        </div>
      )}

      {/* Export Drawer */}
      <Sheet isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} title={lang === 'ar' ? 'تصدير التقارير المالية' : 'Exporter les Données Financières'}>
        <div className={`space-y-3 py-2 ${isRTL ? 'rtl' : 'ltr'}`}>
          <p className="text-xs text-[var(--text-secondary)]">
            {lang === 'ar'
              ? 'قم بتنزيل كشف الحسابات بتنسيق Excel/CSV أو تجهيز ملف PDF رسمي جاهز للطباعة والمراجعة.'
              : 'Téléchargez les rapports financiers au format Excel/CSV ou générez un document PDF prêt pour impression.'}
          </p>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              onClick={exportToExcelCSV}
              variant="outline"
              className="h-12 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4 text-[var(--success)]" />
              <span className="text-[11px] font-bold">{lang === 'ar' ? 'ملف إكسل (CSV)' : 'Fichier Excel (CSV)'}</span>
            </Button>

            <Button
              onClick={exportToCleanPDF}
              variant="outline"
              className="h-12 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-1"
            >
              <FileText className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-[11px] font-bold">{lang === 'ar' ? 'تقرير PDF للطباعة' : 'Document PDF Imprimable'}</span>
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Reusable Custom Alert Modal */}
      <ConfirmDialog
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        description={alertModal.description}
        variant={alertModal.variant}
        singleButton={true}
        onConfirm={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        lang={lang}
      />
    </div>
  );
}
