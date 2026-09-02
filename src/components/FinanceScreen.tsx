import React, { useState, useMemo } from 'react';
import { PaymentRecord, Member } from '../db/db';
import { Card, Badge, Button, Sheet } from './ui/shadcn';
import {
  TrendingUp,
  AlertCircle,
  Users,
  Download,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { SupportedLanguage, translations, getWhatsAppReminder } from '../utils/i18n';

interface FinanceScreenProps {
  payments: PaymentRecord[];
  members: Member[];
  todayVisitsCount: number;
  onTogglePayment: (member: Member) => void;
  lang: SupportedLanguage;
}

export function FinanceScreen({
  payments,
  members,
  todayVisitsCount,
  onTogglePayment,
  lang
}: FinanceScreenProps) {
  const [activeTab, setActiveTab] = useState<'apercu' | 'recettes' | 'dettes'>('apercu');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const t = translations[lang] || translations.fr;

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

  const thisMonthPayments = useMemo(() => {
    return payments.filter((p) => {
      const pDate = new Date(p.timestamp);
      return pDate >= currentMonthStart && pDate <= currentMonthEnd;
    });
  }, [payments, currentMonthStart, currentMonthEnd]);

  const monthlyRevenue = useMemo(() => {
    return thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [thisMonthPayments]);

  const unpaidMembers = useMemo(() => {
    return members.filter((m) => !m.isPaid);
  }, [members]);

  const totalDebt = useMemo(() => {
    return unpaidMembers.reduce((sum, m) => sum + (m.amountDue || 250), 0);
  }, [unpaidMembers]);

  // Recharts Bar Data
  const daysInMonth = eachDayOfInterval({ start: currentMonthStart, end: now });
  const chartData = useMemo(() => {
    return daysInMonth.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayTotal = payments
        .filter((p) => p.dateStr === dayStr)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      return {
        day: format(day, 'd'),
        dateStr: dayStr,
        amount: dayTotal
      };
    });
  }, [daysInMonth, payments]);

  // CSV Export
  const exportToCSV = () => {
    const headers = ['Date', 'ID Membre', 'Nom', 'Formule', `Montant (${t.currency})`, 'Mode'];
    const rows = payments.map((p) => [
      p.dateStr,
      p.memberId,
      `"${p.memberName.replace(/"/g, '""')}"`,
      `"${p.planName.replace(/"/g, '""')}"`,
      p.amount,
      p.paymentMethod
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = `Rapport_Financier_${format(now, 'yyyy_MM')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportOpen(false);
  };

  // PDF Printable Export
  const downloadPDFReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
      <head>
        <title>${t.appName} - ${t.exportReportTitle} (${format(now, 'MMMM yyyy')})</title>
        <style>
          body { font-family: sans-serif; padding: 25px; color: #18181b; }
          .header { border-bottom: 2px solid #f97316; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 24px; font-weight: 800; color: #f97316; }
          .summary { display: flex; gap: 16px; margin-bottom: 20px; }
          .card { border: 1px solid #e4e4e7; background: #f4f4f5; padding: 12px 18px; border-radius: 8px; flex: 1; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e4e4e7; padding: 8px 12px; text-align: ${lang === 'ar' ? 'right' : 'left'}; font-size: 12px; }
          th { background: #fff7ed; color: #ea580c; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><div class="title">${t.appName}</div><div>${t.brandSubtitle}</div></div>
          <div>${format(now, 'dd/MM/yyyy')}</div>
        </div>
        <div class="summary">
          <div class="card"><h4>${t.monthlyRevenue}</h4><p><b>${monthlyRevenue} ${t.currency}</b></p></div>
          <div class="card"><h4>${t.totalDebts}</h4><p style="color:#ef4444"><b>${totalDebt} ${t.currency}</b></p></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Membre</th><th>Formule</th><th>Montant</th><th>Mode</th></tr></thead>
          <tbody>
            ${payments.map(p => `<tr><td>${p.dateStr}</td><td>${p.memberName} (${p.memberId})</td><td>${p.planName}</td><td><b>${p.amount} ${t.currency}</b></td><td>${p.paymentMethod}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setIsExportOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* 1. KPI Blocks */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="bg-zinc-900/60 p-3 text-center border-zinc-800/80">
          <div className="flex items-center justify-center text-emerald-400 mb-1">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 block truncate">{t.monthlyRevenue}</span>
          <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
            {monthlyRevenue} <span className="text-[10px] font-sans">{t.currency}</span>
          </span>
        </Card>

        <Card className="bg-zinc-900/60 p-3 text-center border-zinc-800/80">
          <div className="flex items-center justify-center text-red-400 mb-1">
            <AlertCircle className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 block truncate">{t.totalDebts}</span>
          <span className="text-base font-bold text-red-400 font-mono mt-0.5 block">
            {totalDebt} <span className="text-[10px] font-sans">{t.currency}</span>
          </span>
        </Card>

        <Card className="bg-zinc-900/60 p-3 text-center border-zinc-800/80">
          <div className="flex items-center justify-center text-orange-400 mb-1">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-medium text-zinc-400 block truncate">{t.todayVisitsLabel}</span>
          <span className="text-base font-bold text-zinc-100 font-mono mt-0.5 block">
            {todayVisitsCount}
          </span>
        </Card>
      </div>

      {/* 2. Tabs Navigation & Export */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-zinc-900 border border-zinc-800/90 rounded-lg p-1 gap-1 flex-1">
          <button
            onClick={() => setActiveTab('apercu')}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'apercu'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.overview}
          </button>
          <button
            onClick={() => setActiveTab('recettes')}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'recettes'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.receipts} ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('dettes')}
            className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'dettes'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.debts} ({unpaidMembers.length})
          </button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsExportOpen(true)}
          className="h-8 text-xs text-orange-400 border-zinc-800 hover:border-orange-500/40 gap-1 px-2.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.exportReport}</span>
        </Button>
      </div>

      {/* 3. Tab Panels */}
      {activeTab === 'apercu' && (
        <div className="space-y-4">
          <Card className="p-4 border-zinc-800/80 bg-zinc-900/60">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                  {t.dailyEarnings} ({format(now, 'MMMM yyyy')})
                </h4>
                <p className="text-[11px] text-zinc-400">{t.hoverTooltipHint}</p>
              </div>
              <Badge variant="orange" className="font-mono text-xs">
                {monthlyRevenue} {t.currency}
              </Badge>
            </div>

            {/* Recharts Bar Chart */}
            <div className="w-full h-44 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.slice(-14)} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#27272a' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2 shadow-xl text-xs font-mono">
                            <p className="text-zinc-400 text-[10px]">{data.dateStr}</p>
                            <p className="font-bold text-orange-400 mt-0.5">{data.amount} {t.currency}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.slice(-14).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.amount > 0 ? '#f97316' : '#27272a'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 flex items-center justify-between text-xs">
            <span className="text-zinc-400">{t.recoveryRate}</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {monthlyRevenue + totalDebt > 0
                ? `${Math.round((monthlyRevenue / (monthlyRevenue + totalDebt)) * 100)}%`
                : '100%'}
            </span>
          </div>
        </div>
      )}

      {activeTab === 'recettes' && (
        <div className="space-y-2">
          {payments.length > 0 ? (
            payments.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-zinc-100">{p.memberName}</div>
                  <div className="text-zinc-400 text-[11px] mt-0.5">{p.planName} • {p.dateStr}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-400 text-sm">+{p.amount} {t.currency}</div>
                  <span className="text-[10px] text-zinc-500 uppercase">{p.paymentMethod}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-zinc-500 text-xs">{t.noPaymentsYet}</div>
          )}
        </div>
      )}

      {activeTab === 'dettes' && (
        <div className="space-y-2.5">
          {unpaidMembers.length > 0 ? (
            unpaidMembers.map((member) => {
              const cleanPhone = (rawPhone: string) => {
                let p = rawPhone ? rawPhone.replace(/\D/g, '') : '';
                if (p.startsWith('0')) p = '212' + p.substring(1);
                return p;
              };
              const phoneFormatted = cleanPhone(member.phone);
              const reminderMsg = typeof t?.whatsappReminderTemplate === 'function'
                ? t.whatsappReminderTemplate(member.fullName, member.planName, 0, true)
                : getWhatsAppReminder(lang, member.fullName, member.planName, 0, true);
              const waUrl = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(reminderMsg)}`;
              const telUrl = `tel:+${phoneFormatted}`;

              return (
                <div
                  key={member.id}
                  className="rounded-xl border border-red-500/30 bg-zinc-900/60 p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-zinc-100 text-sm">{member.fullName}</div>
                      <div className="text-zinc-400 text-xs">{member.planName} • {member.phone}</div>
                    </div>
                    <Badge variant="destructive" className="font-mono text-xs">
                      {member.amountDue || 250} {t.currency}
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-zinc-800">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onTogglePayment(member)}
                      className="flex-1 h-8 text-xs font-semibold"
                    >
                      {t.markPaid}
                    </Button>
                    <a
                      href={telUrl}
                      className="h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-orange-400 flex items-center justify-center text-xs font-medium border border-zinc-750"
                      title={t.call}
                    >
                      {t.call}
                    </a>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-medium border border-emerald-500/20"
                      title={t.whatsapp}
                    >
                      {t.whatsapp}
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-emerald-400 text-xs font-semibold">
              {t.allDuesCleared}
            </div>
          )}
        </div>
      )}

      {/* Export Sheet Modal */}
      <Sheet
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title={t.exportReportTitle}
        description={t.exportReportDesc}
      >
        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            onClick={downloadPDFReport}
            className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-orange-500/40 flex flex-col items-center text-center gap-2 transition-colors active:scale-98"
          >
            <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-100 block">{t.pdfReport}</span>
              <span className="text-[10px] text-zinc-400">{t.pdfReportDesc}</span>
            </div>
          </button>

          <button
            onClick={exportToCSV}
            className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-orange-500/40 flex flex-col items-center text-center gap-2 transition-colors active:scale-98"
          >
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-100 block">{t.excelReport}</span>
              <span className="text-[10px] text-zinc-400">{t.excelReportDesc}</span>
            </div>
          </button>
        </div>
      </Sheet>
    </div>
  );
}
