import React, { useState } from 'react';
import { Member, MembershipPlan, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Sheet, Input } from './ui/shadcn';
import { Calendar, Banknote } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { SupportedLanguage, translations } from '../utils/i18n';
import confetti from 'canvas-confetti';

interface MobileRenewalModalProps {
  member: Member;
  plans: MembershipPlan[];
  isOpen: boolean;
  onClose: () => void;
  onRenewSuccess: (updated: Member) => void;
  lang?: SupportedLanguage;
}

export function MobileRenewalModal({
  member,
  plans,
  isOpen,
  onClose,
  onRenewSuccess,
  lang = 'fr'
}: MobileRenewalModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(member.planId || plans[0]?.id || 'plan_1m');
  const [isProcessing, setIsProcessing] = useState(false);
  const t = translations[lang] || translations.fr;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  // Business Logic: If current active subscription endDate is in future, don't waste days!
  // Base date = previous endDate; If already expired, base date = Today
  const calculateNewDates = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isFuture = member.expiryDate && member.expiryDate > todayStr;
    const startDate = isFuture ? member.expiryDate : todayStr;
    const baseDate = new Date(startDate);
    const newExpiry = addMonths(baseDate, selectedPlan ? selectedPlan.durationMonths : 1);
    return {
      startDate,
      expiryDate: format(newExpiry, 'yyyy-MM-dd')
    };
  };

  const { startDate: newStartDate, expiryDate: newExpiryDate } = calculateNewDates();

  const handleRenew = async () => {
    if (!selectedPlan) return;
    setIsProcessing(true);

    try {
      const now = Date.now();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const subId = `SUB-${Date.now()}-${member.id}`;

      // Update Member
      const updatedMember: Member = {
        ...member,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        isPaid: true,
        amountDue: 0,
        updatedAt: now
      };

      await db.members.put(updatedMember);

      // Create new Subscription snapshot
      const subscriptionRecord = {
        id: subId,
        memberId: member.id,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        startDate: newStartDate,
        endDate: newExpiryDate,
        totalPrice: selectedPlan.price,
        status: 'ACTIVE' as const,
        createdAt: now
      };
      await db.subscriptions.add(subscriptionRecord);

      // Create immutable CASH payment record
      const paymentRecord = {
        id: `PAY-${Date.now()}`,
        subscriptionId: subId,
        memberId: member.id,
        memberName: member.fullName,
        amountPaid: selectedPlan.price,
        paymentDate: todayStr,
        paymentMethod: 'CASH' as const,
        timestamp: now
      };

      await db.payments.add(paymentRecord);
      await syncEngine.enqueue('PAYMENT', paymentRecord);
      await syncEngine.enqueue('SUBSCRIPTION', subscriptionRecord);
      await syncEngine.enqueue('UPDATE_MEMBER', updatedMember);

      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      onRenewSuccess(updatedMember);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={t.renewModalTitle}
      description={`${member.fullName} (#${member.id})`}
    >
      <div className="space-y-4 py-2 text-xs">
        {/* Plan Select */}
        <div>
          <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1.5">{t.choosePlan}</label>
          <div className="grid grid-cols-2 gap-2">
            {plans.map((p) => {
              const isSelected = p.id === selectedPlanId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-2.5 rounded-lg border text-left rtl:text-right transition-colors ${
                    isSelected
                      ? 'border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--text-primary)] shadow-sm'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="font-semibold text-xs truncate">{p.name}</div>
                  <div className="font-mono text-[var(--primary)] font-bold text-xs mt-0.5">{p.price} {t.currency}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date preview */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--primary)]" />
            <div>
              <span className="text-[10px] text-[var(--text-secondary)] block">{t.newExpiration}</span>
              <span className="font-mono font-bold text-[var(--text-primary)] text-xs">{newExpiryDate}</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">{t.currentExpiry}: {member.expiryDate}</span>
        </div>

        {/* Cash Notice */}
        <div className="p-3 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] flex items-center gap-2 text-[var(--success)]">
          <Banknote className="w-4 h-4" />
          <span className="font-medium text-[11px]">{t.cashOnlyNotice || "Règlement en Espèces (Cash Uniquement)"}</span>
        </div>

        {/* Submit */}
        <Button
          onClick={handleRenew}
          disabled={isProcessing}
          className="w-full h-11 text-xs font-bold uppercase tracking-wider bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary-border)] mt-2 active:scale-98 transition-all"
        >
          {isProcessing
            ? (t.processingBtn || "...")
            : (t.collectCashButton
                ? t.collectCashButton(selectedPlan?.price || 0, t.currency)
                : `Encaisser ${selectedPlan?.price || 0} ${t.currency} (Cash)`)}
        </Button>
      </div>
    </Sheet>
  );
}
