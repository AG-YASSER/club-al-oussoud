import React, { useState, useEffect } from 'react';
import { Member, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Sheet, Input } from './ui/shadcn';
import { Banknote, ShieldCheck, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { SupportedLanguage } from '../utils/i18n';
import confetti from 'canvas-confetti';

interface DebtSettlementModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onSettledSuccess: (updated: Member, paidAmount: number) => void;
  lang?: SupportedLanguage;
}

export function DebtSettlementModal({
  member,
  isOpen,
  onClose,
  onSettledSuccess,
  lang = 'fr'
}: DebtSettlementModalProps) {
  const currentDebt = member?.amountDue || 0;
  const [payAmount, setPayAmount] = useState<number>(currentDebt);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRTL = lang === 'ar';

  useEffect(() => {
    if (member) {
      setPayAmount(member.amountDue || 0);
      setError(null);
    }
  }, [member, isOpen]);

  if (!member) return null;

  const payAmountNum = Number(payAmount) || 0;
  const diff = currentDebt - payAmountNum;
  const newDebt = diff > 0 ? diff : 0;
  const isFullSettlement = payAmountNum >= currentDebt;

  const handleSettle = async () => {
    if (payAmountNum <= 0) {
      setError(lang === 'ar' ? 'يرجى إدخال مبلغ صحيح أكبر من 0' : lang === 'en' ? 'Please enter a valid amount greater than 0.' : 'Veuillez saisir un montant supérieur à 0.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const now = Date.now();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const paymentId = `PAY-${now}`;

      // 1. Create Cash Payment Record
      const paymentRecord = {
        id: paymentId,
        subscriptionId: `SUB-${member.id}`,
        memberId: member.id,
        memberName: member.fullName,
        amountPaid: payAmountNum,
        paymentDate: todayStr,
        paymentMethod: 'CASH' as const,
        note: isFullSettlement
          ? (lang === 'ar' ? 'استخلاص دين سابق بالكامل' : 'Règlement total de la dette')
          : (lang === 'ar' ? `استخلاص جزئي للدين (باقي: ${newDebt} DH)` : lang === 'en' ? `Partial debt payment (remaining: ${newDebt} DH)` : `Règlement partiel (reste: ${newDebt} DH)`),
        timestamp: now
      };

      await db.payments.add(paymentRecord);
      await syncEngine.enqueue('PAYMENT', paymentRecord);

      // 2. Update Member Record with new exact debt
      const updatedMember: Member = {
        ...member,
        isPaid: isFullSettlement,
        amountDue: newDebt,
        updatedAt: now
      };

      await db.members.put(updatedMember);
      await syncEngine.enqueue('UPDATE_MEMBER', updatedMember);

      if (isFullSettlement) {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      }

      onSettledSuccess(updatedMember, payAmountNum);
      onClose();
    } catch (err) {
      console.error(err);
      setError(lang === 'ar' ? 'حدث خطأ أثناء استخلاص الدين.' : 'Erreur lors du règlement.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={lang === 'ar' ? 'استخلاص دين العضو' : lang === 'en' ? 'Settle Member Debt' : 'Règlement de Dette'}
      description={`${member.fullName} (#${member.id})`}
    >
      <div className={`space-y-4 py-2 text-xs ${isRTL ? 'rtl' : 'ltr'}`}>
        {error && (
          <div className="p-3 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Existing Debt Info Card */}
        <div className="p-3 rounded-xl border border-[var(--danger-border)] bg-[var(--card)] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block">
              {lang === 'ar' ? 'الدين المستحق الحالي' : lang === 'en' ? 'Current Outstanding Debt' : 'Dette Actuelle'}
            </span>
            <span className="font-mono text-lg font-black text-[var(--danger)] mt-0.5 block">
              {currentDebt} DH
            </span>
          </div>

          <div className="w-10 h-10 rounded-xl bg-[var(--danger-bg)] flex items-center justify-center text-[var(--danger)]">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Single Clean Input Box for Payment Amount */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
          <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-[var(--success)]" />
            {lang === 'ar' ? 'المبلغ المستلم الآن نقداً (كاش)' : lang === 'en' ? 'Cash Amount Received Today' : 'Montant Versé Aujourd\'hui (Espèces)'}
          </label>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
              placeholder="0"
              className="bg-[var(--card-solid)] border-[var(--border)] text-[var(--text-primary)] font-mono text-base font-black h-11 text-center"
            />
            <span className="font-bold text-sm text-[var(--text-secondary)] px-1">DH</span>
          </div>

          {/* Dynamic Feedback */}
          {isFullSettlement ? (
            <div className="p-2.5 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-between text-[var(--success)]">
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'سيتم تصفير الدين بالكامل' : lang === 'en' ? 'Debt will be cleared completely' : 'Dette totalement soldée'}
              </span>
              <span className="font-mono font-black text-xs">0 DH</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)] flex items-center justify-between text-[var(--warning)]">
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'سيبقى دين متبقي قدره:' : lang === 'en' ? 'Remaining Debt Balance:' : 'Reste dû :'}
              </span>
              <span className="font-mono font-black text-xs">-{newDebt} DH</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button
          onClick={handleSettle}
          disabled={isProcessing}
          className="w-full h-11 text-xs font-bold uppercase tracking-wider bg-[var(--success)] hover:opacity-90 text-white shadow-lg shadow-[var(--success-border)] active:scale-98 transition-all"
        >
          {isProcessing
            ? (lang === 'ar' ? 'جارٍ تسجيل العملية...' : lang === 'en' ? 'Processing...' : 'Traitement...')
            : lang === 'ar'
            ? `تأكيد استلام ${payAmountNum} DH كاش`
            : lang === 'en'
            ? `Confirm Received ${payAmountNum} DH Cash`
            : `Confirmer Encaissement ${payAmountNum} DH`}
        </Button>
      </div>
    </Sheet>
  );
}
