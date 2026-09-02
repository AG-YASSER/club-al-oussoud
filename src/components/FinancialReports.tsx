import React, { useMemo } from 'react';
import { PaymentRecord, Member } from '../db/db';
import { defaultTheme } from '../config/theme';
import {
  IconReceipt2,
  IconDownload,
  IconFileSpreadsheet,
  IconTrendingUp,
  IconCurrencyDollar,
  IconCalendarStats
} from '@tabler/icons-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

interface FinancialReportsProps {
  payments: PaymentRecord[];
  members: Member[];
}

export function FinancialReports({ payments, members }: FinancialReportsProps) {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

  // Filter payments for this month
  const thisMonthPayments = payments.filter((p) => {
    const pDate = new Date(p.timestamp);
    return pDate >= currentMonthStart && pDate <= currentMonthEnd;
  });

  const totalMonthlyIncome = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calculate daily income for days in month (1..now)
  const daysInMonth = eachDayOfInterval({ start: currentMonthStart, end: now });
  const dailyData = useMemo(() => {
    return daysInMonth.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayTotal = payments
        .filter((p) => p.dateStr === dayStr)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      return {
        dayNum: format(day, 'd'),
        amount: dayTotal,
        dateStr: dayStr
      };
    });
  }, [daysInMonth, payments]);

  const maxDailyAmount = Math.max(...dailyData.map((d) => d.amount), 500);

  // Export to CSV / Excel
  const exportToCSV = () => {
    const headers = ['Date', 'ID Membre', 'Nom Membre', 'Formule', 'Montant (DH)', 'Methode'];
    const rows = payments.map((p) => [
      p.dateStr,
      p.memberId,
      `"${p.memberName.replace(/"/g, '""')}"`,
      `"${p.planName.replace(/"/g, '""')}"`,
      p.amount,
      p.paymentMethod
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rapport_Financier_Al_Oussoud_${format(now, 'yyyy_MM')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download printable PDF Report
  const downloadPDFReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport Financier - Club Al Oussoud (${format(now, 'MMMM yyyy')})</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #111; }
          .header { border-bottom: 2px solid #f97316; padding-bottom: 10px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #f97316; }
          .summary { display: flex; gap: 20px; margin-bottom: 20px; }
          .card { border: 1px solid #ddd; padding: 12px 20px; border-radius: 8px; }
          .card h4 { margin: 0; font-size: 12px; color: #666; }
          .card p { margin: 5px 0 0 0; font-size: 20px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #eee; padding: 8px 12px; text-align: left; font-size: 12px; }
          th { background: #fdf6ee; color: #f97316; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">CLUB AL OUSSOUD</div>
          <div>Rapport Financier Mensuel • ${format(now, 'dd/MM/yyyy')}</div>
        </div>
        <div class="summary">
          <div class="card">
            <h4>Total Recettes Mensuelles</h4>
            <p>${totalMonthlyIncome} DH</p>
          </div>
          <div class="card">
            <h4>Transactions Encaissées</h4>
            <p>${thisMonthPayments.length}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Membre</th>
              <th>Formule</th>
              <th>Montant</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            ${payments.slice(0, 50).map(p => `
              <tr>
                <td>${p.dateStr}</td>
                <td>${p.memberName} (${p.memberId})</td>
                <td>${p.planName}</td>
                <td><b>${p.amount} DH</b></td>
                <td>${p.paymentMethod}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 space-y-4 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <IconCalendarStats className="w-5 h-5 text-orange-500" />
          <h3 className="text-sm font-bold text-white">Analyse des Recettes & Rapports</h3>
        </div>
        <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">
          {format(now, 'MMMM yyyy')}
        </span>
      </div>

      {/* Daily Income Mini Bar Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Recettes journalières (Jours 1 à {format(now, 'd')})</span>
          <span className="font-mono text-white font-bold">{totalMonthlyIncome} DH</span>
        </div>

        {/* CSS Flex Bar Chart */}
        <div className="h-28 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-2.5 flex items-end gap-1.5 overflow-x-auto">
          {dailyData.slice(-14).map((item, idx) => {
            const heightPercent = Math.max(8, (item.amount / maxDailyAmount) * 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 min-w-[18px]">
                <div
                  style={{ height: `${heightPercent}%` }}
                  title={`${item.dateStr}: ${item.amount} DH`}
                  className={`w-full rounded-t-md transition-all ${
                    item.amount > 0
                      ? 'bg-gradient-to-t from-orange-600 to-amber-400'
                      : 'bg-zinc-800/60'
                  }`}
                />
                <span className="text-[9px] font-mono text-zinc-500">{item.dayNum}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={exportToCSV}
          className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-bold border border-zinc-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
        >
          <IconFileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Exporter Excel / CSV</span>
        </button>

        <button
          type="button"
          onClick={downloadPDFReport}
          className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
        >
          <IconDownload className="w-4 h-4" />
          <span>Rapport PDF</span>
        </button>
      </div>
    </div>
  );
}
