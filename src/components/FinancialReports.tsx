import React, { useMemo } from 'react';
import { PaymentRecord, Member } from '../db/db';
import { defaultTheme } from '../config/theme';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  TrendingUp,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { exportHtmlToPrintAndPdf } from '../utils/printAndPdf';

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
  const totalDebts = members.filter(m => !m.isPaid).reduce((sum, m) => sum + (m.amountDue || 0), 0);
  const unpaidMembers = members.filter(m => !m.isPaid);

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

  // Export to Clean CSV / Excel with UTF-8 BOM
  const exportToCSV = () => {
    const headers = ['Type', 'Date', 'ID Membre', 'Nom Membre', 'Formule', 'Montant (DH)', 'Methode/Statut'];
    const paymentRows = payments.map((p) => [
      'RECETTE',
      p.dateStr,
      p.memberId,
      `"${p.memberName.replace(/"/g, '""')}"`,
      `"${p.planName.replace(/"/g, '""')}"`,
      p.amount,
      p.paymentMethod.toUpperCase()
    ]);

    const debtRows = unpaidMembers.map((m) => [
      'DETTE',
      m.expiryDate,
      m.id,
      `"${m.fullName.replace(/"/g, '""')}"`,
      `"${m.planName.replace(/"/g, '""')}"`,
      m.amountDue,
      'IMPAYE'
    ]);

    const summaryRows = [
      [],
      ['BILAN DU MOIS', format(now, 'MMMM yyyy')],
      ['Total Recettes Encaissées', `${totalMonthlyIncome} DH`],
      ['Total Dettes en Attente', `${totalDebts} DH`],
      ['Nombre Total de Membres', members.length]
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        headers.join(','),
        ...paymentRows.map((e) => e.join(',')),
        ...debtRows.map((e) => e.join(',')),
        ...summaryRows.map((e) => e.join(','))
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rapport_Financier_Club_Al_Oussoud_${format(now, 'yyyy_MM')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download high-end printable PDF Report (Native Android & Web)
  const downloadPDFReport = async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>Rapport Financier - Club Al Oussoud (${format(now, 'MMMM yyyy')})</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
          * { box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, sans-serif; padding: 32px; color: #18181b; background: #ffffff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f97316; padding-bottom: 16px; margin-bottom: 24px; }
          .brand-title { font-size: 26px; font-weight: 800; color: #09090b; letter-spacing: -0.5px; }
          .brand-accent { color: #ea580c; }
          .meta { font-size: 13px; color: #71717a; text-align: right; }
          .meta-strong { color: #09090b; font-weight: 600; }
          .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; }
          .kpi-card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 10px; padding: 14px; }
          .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #71717a; letter-spacing: 0.5px; }
          .kpi-val { font-size: 22px; font-weight: 800; margin-top: 4px; }
          .val-green { color: #16a34a; }
          .val-red { color: #dc2626; }
          .val-dark { color: #09090b; }
          .section-title { font-size: 15px; font-weight: 700; color: #09090b; margin: 24px 0 10px; border-left: 3px solid #ea580c; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th { background: #f4f4f5; color: #52525b; font-weight: 600; text-align: left; padding: 10px; border: 1px solid #e4e4e7; }
          td { padding: 9px 10px; border: 1px solid #e4e4e7; color: #27272a; }
          tr:nth-child(even) td { background: #fafafa; }
          .amount-tag { font-weight: 700; font-family: monospace; }
          .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e4e4e7; display: flex; justify-content: space-between; font-size: 11px; color: #a1a1aa; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">CLUB <span class="brand-accent">AL OUSSOUD</span></div>
            <div style="font-size: 13px; color: #71717a; margin-top: 4px;">Rapport de Gestion & Situation Financière</div>
          </div>
          <div class="meta">
            <div>Période: <span class="meta-strong">${format(now, 'MMMM yyyy')}</span></div>
            <div>Généré le: <span class="meta-strong">${format(now, 'dd/MM/yyyy HH:mm')}</span></div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Recettes du Mois</div>
            <div class="kpi-val val-green">${totalMonthlyIncome} DH</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Dettes en Attente</div>
            <div class="kpi-val val-red">${totalDebts} DH</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Membres Inscrits</div>
            <div class="kpi-val val-dark">${members.length}</div>
          </div>
        </div>

        <div class="section-title">Journal des Encaissements (${thisMonthPayments.length})</div>
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
            ${
              thisMonthPayments.length > 0
                ? thisMonthPayments
                    .map(
                      (p) => `
              <tr>
                <td>${p.dateStr}</td>
                <td><strong>${p.memberName}</strong> <span style="color:#71717a;font-size:10px;">(#${p.memberId})</span></td>
                <td>${p.planName}</td>
                <td class="amount-tag val-green">+${p.amount} DH</td>
                <td>${p.paymentMethod.toUpperCase()}</td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="5" style="text-align:center;color:#a1a1aa;padding:18px;">Aucun encaissement sur cette période.</td></tr>`
            }
          </tbody>
        </table>

        ${
          unpaidMembers.length > 0
            ? `
          <div class="section-title">État des Dettes Non Régularisées (${unpaidMembers.length})</div>
          <table>
            <thead>
              <tr>
                <th>Membre</th>
                <th>Téléphone</th>
                <th>Formule</th>
                <th>Échéance</th>
                <th>Montant Dû</th>
              </tr>
            </thead>
            <tbody>
              ${unpaidMembers
                .map(
                  (m) => `
                <tr>
                  <td><strong>${m.fullName}</strong></td>
                  <td>${m.phone}</td>
                  <td>${m.planName}</td>
                  <td>${m.expiryDate}</td>
                  <td class="amount-tag val-red">${m.amountDue} DH</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
            : ''
        }

        <div class="footer">
          <div>Document officiel généré automatiquement par l'application Club Al Oussoud.</div>
          <div>Page 1 / 1</div>
        </div>
      </body>
      </html>
    `;
    await exportHtmlToPrintAndPdf({
      html,
      title: `Rapport_Financier_${format(now, 'yyyy-MM')}`,
      lang: 'fr'
    });
  };

  return (
    <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 space-y-4 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-orange-500" />
          <h3 className="text-sm font-bold text-white">Analyse des Recettes & Rapports</h3>
        </div>
        <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-500/20">
          {format(now, 'MMMM yyyy')}
        </span>
      </div>

      {/* Daily Income Mini Bar Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Recettes journalières (Jours 1 à ${format(now, 'd')})</span>
          <span className="font-mono text-white font-bold">${totalMonthlyIncome} DH</span>
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
                <span className="text-[9px] font-mono text-zinc-500">${item.dayNum}</span>
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
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Exporter Excel / CSV</span>
        </button>

        <button
          type="button"
          onClick={downloadPDFReport}
          className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
        >
          <Download className="w-4 h-4" />
          <span>Rapport PDF</span>
        </button>
      </div>
    </div>
  );
}
