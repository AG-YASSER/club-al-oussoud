import React, { useState, useMemo } from 'react';
import { Payment, Member } from '../db/db';
import { Card, Badge, Button, Sheet } from './ui/shadcn';
import {
  TrendingUp,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Calendar,
  Banknote,
  Sun,
  CalendarDays,
  ArrowDownLeft,
  CheckCircle2,
  ReceiptText,
  ShieldCheck
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { SupportedLanguage, translations, getWhatsAppReminder } from '../utils/i18n';

interface FinanceScreenProps {
  payments: Payment[];
  members: Member[];
  onTogglePayment: (member: Member) => void;
  lang: SupportedLanguage;
}

export function FinanceScreen({
  payments,
  members,
  onTogglePayment,
  lang
}: FinanceScreenProps) {
  const [activeTab, setActiveTab] = useState<'apercu' | 'recettes' | 'dettes'>('apercu');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const t = translations[lang] || translations.fr;
  const isRTL = lang === 'ar';

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Map member ID to plan name for fast lookup
  const memberPlanMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      map.set(m.id, m.planName);
    });
    return map;
  }, [members]);

  // Today's Payments
  const todayPayments = useMemo(() => {
    return payments.filter((p) => p.paymentDate === todayStr);
  }, [payments, todayStr]);

  const todayCash = useMemo(() => {
    return todayPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }, [todayPayments]);

  // This Week's Payments
  const thisWeekPayments = useMemo(() => {
    return payments.filter((p) => {
      const pDate = new Date(p.paymentDate || p.timestamp);
      return pDate >= currentWeekStart && pDate <= currentWeekEnd;
    });
  }, [payments, currentWeekStart, currentWeekEnd]);

  const thisWeekCash = useMemo(() => {
    return thisWeekPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }, [thisWeekPayments]);

  // This Month's Payments
  const thisMonthPayments = useMemo(() => {
    return payments.filter((p) => {
      const pDate = new Date(p.paymentDate || p.timestamp);
      return pDate >= currentMonthStart && pDate <= currentMonthEnd;
    });
  }, [payments, currentMonthStart, currentMonthEnd]);

  const monthlyRevenue = useMemo(() => {
    return thisMonthPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  }, [thisMonthPayments]);

  // Active Unpaid Members & Debts (excluding soft-deleted)
  const activeMembers = useMemo(() => {
    return members.filter((m) => !m.isDeleted);
  }, [members]);

  const unpaidMembers = useMemo(() => {
    return activeMembers.filter((m) => !m.isPaid);
  }, [activeMembers]);

  const totalDebt = useMemo(() => {
    return unpaidMembers.reduce((sum, m) => sum + (m.amountDue || 0), 0);
  }, [unpaidMembers]);

  // Collection Rate (%)
  const totalGoal = monthlyRevenue + totalDebt;
  const collectionRate = useMemo(() => {
    if (totalGoal === 0) return 100;
    return Math.min(100, Math.max(0, Math.round((monthlyRevenue / totalGoal) * 100)));
  }, [monthlyRevenue, totalGoal]);

  // Sorted recent 5 payments
  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 5);
  }, [payments]);

  // Export to Excel / CSV with UTF-8 BOM
  const exportToExcelCSV = () => {
    try {
      const headers = isRTL
        ? ['النوع', 'التاريخ', 'العضو', 'المبلغ (DH)', 'طريقة الدفع']
        : ['Type', 'Date', 'Membre', 'Montant (DH)', 'Mode Paiement'];

      const paymentRows = payments.map((p) => [
        isRTL ? 'مقبوضات نقدية' : 'RECETTE CASH',
        p.paymentDate,
        `"${p.memberName.replace(/"/g, '""')}"`,
        p.amountPaid,
        'CASH'
      ]);

      const debtRows = unpaidMembers.map((m) => [
        isRTL ? 'دين معلق' : 'DETTE EN COURS',
        m.expiryDate,
        `"${m.fullName.replace(/"/g, '""')}"`,
        m.amountDue || 0,
        isRTL ? 'غير مسدد' : 'NON PAYE'
      ]);

      const summaryRows = [
        [],
        [isRTL ? '--- التقرير المالي الشهري ---' : '--- RESUME FINANCIER DU MOIS ---'],
        [isRTL ? 'إجمالي المداخيل المحصلة' : 'Total Recettes Encaissées', `${monthlyRevenue} ${t.currency}`],
        [isRTL ? 'إجمالي الديون المعلقة' : 'Total Dettes à Recouvrer', `${totalDebt} ${t.currency}`],
        [isRTL ? 'نسبة التحصيل' : 'Taux de Recouvrement', `${collectionRate}%`],
        [isRTL ? 'تاريخ التصدير' : 'Date Exportation', new Date().toLocaleString()]
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
      link.setAttribute('href', url);
      link.setAttribute('download', `Club_Al_Oussoud_Finances_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsExportOpen(false);
    } catch (err) {
      console.error(err);
      alert(isRTL ? 'خطأ أثناء تصدير ملف CSV' : 'Erreur lors de l exportation CSV');
    }
  };

  // High-End Printable PDF Document
  const exportToCleanPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(
        isRTL
          ? 'يرجى السماح بالنوافذ المنبثقة لطباعة التقرير.'
          : 'Veuillez autoriser les fenêtres pop-up pour générer le PDF.'
      );
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html lang="${lang}" dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8" />
        <title>${isRTL ? 'التقرير المالي - نادي الأسود' : 'Rapport Financier - Club Al Oussoud'}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
            margin: 0;
            padding: 32px;
            color: #0f172a;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #f97316;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand-title {
            font-size: 22px;
            font-weight: 900;
            color: #09090b;
            letter-spacing: 0.5px;
          }
          .brand-title span { color: #f97316; }
          .report-badge {
            background: #f1f5f9;
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: bold;
            color: #475569;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 28px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            background: #f8fafc;
          }
          .kpi-label {
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .kpi-value {
            font-size: 20px;
            font-weight: 900;
            font-family: monospace;
          }
          .val-green { color: #10b981; }
          .val-red { color: #f43f5e; }
          .val-orange { color: #f97316; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 24px;
          }
          th {
            background: #f1f5f9;
            color: #1e293b;
            font-weight: 700;
            text-align: ${isRTL ? 'right' : 'left'};
            padding: 10px 12px;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 9px 12px;
            border-bottom: 1px solid #f1f5f9;
          }
          .footer {
            margin-top: 32px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">${isRTL ? 'نادي <span>الأسود</span>' : 'CLUB <span>AL OUSSOUD</span>'}</div>
            <div style="font-size:11px;color:#64748b;margin-top:3px;">
              ${isRTL ? 'كشف المداخيل النقدية والديون' : 'Rapport de Recouvrement & Encaissements Espèces'}
            </div>
          </div>
          <div class="report-badge">Date: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">${isRTL ? 'المداخيل المحصلة (الشهر)' : 'Recettes Encaissées (Mois)'}</div>
            <div class="kpi-value val-green">${monthlyRevenue} ${t.currency}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">${isRTL ? 'إجمالي الديون المعلقة' : 'Dettes à Recouvrer'}</div>
            <div class="kpi-value val-red">${totalDebt} ${t.currency}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">${isRTL ? 'نسبة التحصيل' : 'Taux de Recouvrement'}</div>
            <div class="kpi-value val-orange">${collectionRate}%</div>
          </div>
        </div>

        <h3 style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:12px;">
          ${isRTL ? 'سجل المقبوضات النقدية المسجلة' : 'Journal des Encaissements Espèces (CASH)'}
        </h3>
        <table>
          <thead>
            <tr>
              <th>${isRTL ? 'التاريخ' : 'Date'}</th>
              <th>${isRTL ? 'العضو' : 'Membre'}</th>
              <th>${isRTL ? 'المبلغ المحصل' : 'Montant Encaissé'}</th>
              <th>${isRTL ? 'طريقة الدفع' : 'Mode'}</th>
            </tr>
          </thead>
          <tbody>
            ${
              payments.length > 0
                ? payments
                    .slice(0, 50)
                    .map(
                      (p) => `
              <tr>
                <td>${p.paymentDate}</td>
                <td><strong>${p.memberName}</strong> (#${p.memberId})</td>
                <td style="font-weight:bold;color:#10b981;">+${p.amountPaid} ${t.currency}</td>
                <td><span style="background:#ecfdf5;color:#059669;padding:2px 6px;border-radius:4px;font-weight:bold;">CASH</span></td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;">${
                    isRTL ? 'لا توجد مقبوضات مسجلة.' : 'Aucun encaissement enregistré.'
                  }</td></tr>`
            }
          </tbody>
        </table>

        <div class="footer">
          <div>Club Al Oussoud - Management System</div>
          <div>Page 1/1</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    setIsExportOpen(false);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. TOP SUMMARY CARDS (Recettes, Dettes, Taux) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Recettes Card */}
        <Card className="bg-[var(--card)] border border-[var(--border)] p-3 sm:p-3.5 space-y-1.5 rounded-xl relative overflow-hidden transition-all hover:border-[var(--border-hover)] shadow-sm">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <div className="w-5 h-5 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-3 h-3 text-[var(--success)]" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-tight text-[var(--text-secondary)] truncate">
              {t.kpiRevenue}
            </span>
          </div>
          <div className="font-mono text-sm sm:text-base font-black text-[var(--success)] tracking-tight truncate">
            {monthlyRevenue.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-[var(--text-muted)]">{t.currency}</span>
          </div>
        </Card>

        {/* Dettes Card */}
        <Card className="bg-[var(--card)] border border-[var(--border)] p-3 sm:p-3.5 space-y-1.5 rounded-xl relative overflow-hidden transition-all hover:border-[var(--border-hover)] shadow-sm">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <div className="w-5 h-5 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-center shrink-0">
              <AlertCircle className="w-3 h-3 text-[var(--danger)]" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-tight text-[var(--text-secondary)] truncate">
              {t.kpiDebts}
            </span>
          </div>
          <div className="font-mono text-sm sm:text-base font-black text-[var(--danger)] tracking-tight truncate">
            {totalDebt.toLocaleString()}{' '}
            <span className="text-[10px] font-normal text-[var(--text-muted)]">{t.currency}</span>
          </div>
        </Card>

        {/* Taux Card */}
        <Card className="bg-[var(--card)] border border-[var(--border)] p-3 sm:p-3.5 space-y-1.5 rounded-xl relative overflow-hidden transition-all hover:border-[var(--border-hover)] shadow-sm">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <div className="w-5 h-5 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3 h-3 text-[var(--warning)]" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-tight text-[var(--text-secondary)] truncate">
              {t.kpiRecovery}
            </span>
          </div>
          <div className="font-mono text-sm sm:text-base font-black text-[var(--text-primary)] tracking-tight truncate">
            {collectionRate}%
          </div>
        </Card>
      </div>

      {/* 2. SUB TABS (Segmented Pill Control) + EXPORT BUTTON */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] flex-1 shadow-inner gap-1">
          <button
            onClick={() => setActiveTab('apercu')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'apercu'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {t.tabOverview}
          </button>

          <button
            onClick={() => setActiveTab('recettes')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'recettes'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span>{t.tabReceipts}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'recettes' ? 'bg-white/20 text-white' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
              }`}
            >
              {thisMonthPayments.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dettes')}
            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === 'dettes'
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span>{t.tabDebts}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'dettes' ? 'bg-white/20 text-white' : 'bg-[var(--danger-bg)] text-[var(--danger)]'
              }`}
            >
              {unpaidMembers.length}
            </span>
          </button>
        </div>

        {/* Exporter Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsExportOpen(true)}
          className="h-9 px-3 border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-xl shrink-0 shadow-sm active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>{t.exportReport}</span>
        </Button>
      </div>

      {/* 3. TAB 1: FINANCIAL SNAPSHOT (Replacing Bulky Bar Chart) */}
      {activeTab === 'apercu' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          {/* A) Quick Stat Cards: Aujourd'hui, Cette Semaine, Ce Mois */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Aujourd'hui */}
            <Card className="bg-[var(--card)] border border-[var(--border)] p-3 rounded-xl space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Sun className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-secondary)] truncate">
                  {t.todayCash}
                </span>
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-[var(--success)] tracking-tight">
                +{todayCash.toLocaleString()}{' '}
                <span className="text-[9px] font-normal text-[var(--text-muted)]">{t.currency}</span>
              </div>
              <div className="text-[9px] text-[var(--text-muted)]">
                {todayPayments.length} {isRTL ? 'عملية' : 'op.'}
              </div>
            </Card>

            {/* Cette Semaine */}
            <Card className="bg-[var(--card)] border border-[var(--border)] p-3 rounded-xl space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <CalendarDays className="w-3.5 h-3.5 text-[var(--info)] shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-secondary)] truncate">
                  {t.thisWeekCash}
                </span>
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-[var(--success)] tracking-tight">
                +{thisWeekCash.toLocaleString()}{' '}
                <span className="text-[9px] font-normal text-[var(--text-muted)]">{t.currency}</span>
              </div>
              <div className="text-[9px] text-[var(--text-muted)]">
                {thisWeekPayments.length} {isRTL ? 'عملية' : 'op.'}
              </div>
            </Card>

            {/* Ce Mois */}
            <Card className="bg-[var(--card)] border border-[var(--border)] p-3 rounded-xl space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-secondary)] truncate">
                  {t.thisMonthCash}
                </span>
              </div>
              <div className="font-mono text-sm sm:text-base font-black text-[var(--success)] tracking-tight">
                +{monthlyRevenue.toLocaleString()}{' '}
                <span className="text-[9px] font-normal text-[var(--text-muted)]">{t.currency}</span>
              </div>
              <div className="text-[9px] text-[var(--text-muted)]">
                {thisMonthPayments.length} {isRTL ? 'عملية' : 'op.'}
              </div>
            </Card>
          </div>

          {/* B) Linear Progress Bar for Collection Rate */}
          <Card className="bg-[var(--card)] border border-[var(--border)] p-3.5 sm:p-4 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[var(--primary-bg)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary)]">
                  <Banknote className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-tight">
                    {t.collectionRateTitle}
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {isRTL
                      ? 'مقارنة المقبوضات النقدية مع إجمالي الديون المستحقة'
                      : 'Suivi du recouvrement des cotisations ce mois'}
                  </p>
                </div>
              </div>

              <Badge
                variant="outline"
                className={`font-mono text-xs font-black px-2.5 py-0.5 border ${
                  collectionRate >= 80
                    ? 'text-[var(--success)] border-[var(--success-border)] bg-[var(--success-bg)]'
                    : collectionRate >= 50
                    ? 'text-[var(--warning)] border-[var(--warning-border)] bg-[var(--warning-bg)]'
                    : 'text-[var(--danger)] border-[var(--danger-border)] bg-[var(--danger-bg)]'
                }`}
              >
                {collectionRate}%
              </Badge>
            </div>

            {/* Linear Progress Bar with Unified CSS Variables Gradient */}
            <div className="w-full bg-[var(--surface)] h-2.5 rounded-full overflow-hidden p-0.5 border border-[var(--border)]">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out bg-[var(--success)] shadow-[0_0_8px_var(--success-border)]"
                style={{ width: `${collectionRate}%` }}
              />
            </div>

            {/* Breakdown Indicators */}
            <div className="grid grid-cols-3 gap-1 text-[10px] pt-1 border-t border-[var(--border)]">
              <div className="space-y-0.5">
                <span className="text-[var(--text-muted)] block font-medium">{t.collected}</span>
                <span className="font-mono font-bold text-[var(--success)] block">
                  +{monthlyRevenue.toLocaleString()} {t.currency}
                </span>
              </div>

              <div className="space-y-0.5 text-center">
                <span className="text-[var(--text-muted)] block font-medium">{t.pending}</span>
                <span className="font-mono font-bold text-[var(--danger)] block">
                  {totalDebt.toLocaleString()} {t.currency}
                </span>
              </div>

              <div className="space-y-0.5 text-right">
                <span className="text-[var(--text-muted)] block font-medium">{t.target}</span>
                <span className="font-mono font-bold text-[var(--text-primary)] block">
                  {totalGoal.toLocaleString()} {t.currency}
                </span>
              </div>
            </div>
          </Card>

          {/* C) Top 5 Recent Transactions Section */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <ReceiptText className="w-4 h-4 text-[var(--primary)]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  {t.recentTransactions}
                </h4>
              </div>
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                {recentPayments.length > 0 ? `${recentPayments.length} / 5` : ''}
              </span>
            </div>

            {recentPayments.length > 0 ? (
              <div className="space-y-2">
                {recentPayments.map((p) => {
                  const planName = memberPlanMap.get(p.memberId) || t.planFallback;

                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--surface-hover)] transition-all flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center text-[var(--success)] shrink-0">
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {p.memberName}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5 truncate mt-0.5">
                            <span className="text-[var(--primary)] font-medium">{planName}</span>
                            <span>•</span>
                            <span className="text-[var(--text-muted)]">{p.paymentDate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-black text-[var(--success)] tracking-tight">
                          +{Number(p.amountPaid || 0).toLocaleString()} {t.currency}
                        </div>
                        <Badge
                          variant="outline"
                          className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--success)] border-[var(--success-border)] bg-[var(--success-bg)] px-1.5 py-0"
                        >
                          CASH
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Clean Empty State */
              <div className="text-center py-10 px-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card-subtle)] space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mx-auto">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-[var(--text-secondary)]">{t.noRecentTransactions}</div>
                <div className="text-[11px] text-[var(--text-muted)] max-w-xs mx-auto">
                  {t.noRecentTransactionsDesc}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: FULL CASH RECEIPTS FEED */}
      {activeTab === 'recettes' && (
        <div className="space-y-2 animate-in fade-in duration-200">
          {payments.length > 0 ? (
            payments.map((payment) => {
              const planName = memberPlanMap.get(payment.memberId) || t.planFallback;

              return (
                <div
                  key={payment.id}
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--surface-hover)] flex items-center justify-between gap-3 shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center text-[var(--success)] shrink-0">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {payment.memberName}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5 truncate mt-0.5">
                        <span className="text-[var(--primary)] font-medium">{planName}</span>
                        <span>•</span>
                        <span className="text-[var(--text-muted)]">#{payment.memberId}</span>
                        <span>•</span>
                        <span className="text-[var(--text-muted)]">{payment.paymentDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-black text-[var(--success)] tracking-tight">
                      +{Number(payment.amountPaid || 0).toLocaleString()} {t.currency}
                    </div>
                    <Badge
                      variant="outline"
                      className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--success)] border-[var(--success-border)] bg-[var(--success-bg)] px-1.5 py-0"
                    >
                      CASH
                    </Badge>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 px-4 rounded-xl border border-[var(--border)] bg-[var(--card-subtle)] text-[var(--text-muted)] text-xs">
              {t.noReceiptsRecorded}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: DEBTS LIST */}
      {activeTab === 'dettes' && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          {unpaidMembers.length > 0 ? (
            unpaidMembers.map((member) => {
              const waText = getWhatsAppReminder(lang, member.fullName, member.planName, 0, true);
              const waUrl = `https://wa.me/212${member.phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(waText)}`;

              return (
                <div
                  key={member.id}
                  className="p-3.5 rounded-xl border border-[var(--danger-border)] bg-[var(--card)] space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {member.fullName}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">
                        <span className="text-[var(--primary)] font-medium">{member.planName}</span>
                        {' • '}
                        <span className="text-[var(--text-muted)]">
                          {t.dueDate}: {member.expiryDate}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant="destructive"
                      className="font-mono text-xs font-bold shrink-0 bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger-border)]"
                    >
                      {Number(member.amountDue || 0).toLocaleString()} {t.currency}
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
                    <Button
                      size="sm"
                      onClick={() => onTogglePayment(member)}
                      className="flex-1 h-8 text-xs font-bold bg-[var(--success)] hover:opacity-90 text-white rounded-lg active:scale-95 transition-all"
                    >
                      <Banknote className="w-3.5 h-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                      {t.collectRemaining}
                    </Button>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--success)] text-xs flex items-center justify-center active:scale-95 transition-all shrink-0"
                      title={t.whatsapp}
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[var(--success)]" />
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 px-4 rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)] text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[var(--success)] mx-auto" />
              <div className="font-bold">{t.allDebtsSettled}</div>
            </div>
          )}
        </div>
      )}

      {/* 6. EXPORT BOTTOM SHEET */}
      <Sheet
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title={t.exportDrawerTitle}
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t.exportDrawerDesc}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Excel / CSV Card */}
            <button
              onClick={exportToExcelCSV}
              className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--success-border)] text-left rtl:text-right flex items-start gap-3 transition-all group active:scale-98 shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-center text-[var(--success)] shrink-0 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--success)] transition-colors">
                  {t.exportExcel}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                  {t.exportExcelDesc}
                </div>
              </div>
            </button>

            {/* Printable PDF Card */}
            <button
              onClick={exportToCleanPDF}
              className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--primary-border)] text-left rtl:text-right flex items-start gap-3 transition-all group active:scale-98 shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-bg)] border border-[var(--primary-border)] flex items-center justify-center text-[var(--primary)] shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                  {t.exportPdf}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-tight">
                  {t.exportPdfDesc}
                </div>
              </div>
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export default FinanceScreen;
