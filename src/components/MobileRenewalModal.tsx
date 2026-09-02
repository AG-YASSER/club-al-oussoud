import React, { useState } from 'react';
import { Member, MembershipPlan, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Sheet, Badge } from './ui/shadcn';
import { Check, Calendar, CreditCard, Banknote } from 'lucide-react';
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const t = translations[lang] || translations.fr;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const calculateNewDates = () => {
    const today = new Date();
    const currentExpiry = new Date(member.expiryDate);
    const baseDate = currentExpiry < today ? today : currentExpiry;
    const newExpiry = addMonths(baseDate, selectedPlan ? selectedPlan.durationMonths : 1);
    return { expiryDate: format(newExpiry, 'yyyy-MM-dd') };
  };

  const { expiryDate: newExpiryDate } = calculateNewDates();

  const handleRenew = async () => {
    if (!selectedPlan) return;
    setIsProcessing(true);

    try {
      const now = Date.now();
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const updatedMember: Member = {
        ...member,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        expiryDate: newExpiryDate,
        isPaid: true,
        amountDue: 0,
        updatedAt: now
      };

      await db.members.put(updatedMember);

      const paymentRecord = {
        id: `PAY-${Date.now()}`,
        memberId: member.id,
        memberName: member.fullName,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        paymentMethod,
        timestamp: now,
        dateStr: todayStr,
        validFrom: todayStr,
        validUntil: newExpiryDate
      };

      await db.payments.add(paymentRecord);
      await syncEngine.enqueue('PAYMENT', paymentRecord);
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
          <label className="text-[11px] font-medium text-zinc-400 block mb-1.5">{t.choosePlan}</label>
          <div className="grid grid-cols-2 gap-2">
            {plans.map((p) => {
              const isSelected = p.id === selectedPlanId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500/10 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
                  }`}
                >
                  <div className="font-semibold text-xs truncate">{p.name}</div>
                  <div className="font-mono text-orange-400 font-bold text-xs mt-0.5">{p.price} {t.currency}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date preview */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500" />
            <div>
              <span className="text-[10px] text-zinc-400 block">{t.newExpiration}</span>
              <span className="font-mono font-bold text-zinc-100 text-xs">{newExpiryDate}</span>
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">{t.currentExpiry}: {member.expiryDate}</span>
        </div>

        {/* Payment mode */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1.5">{t.paymentMethod}</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'cash', label: t.cash },
              { id: 'card', label: t.card },
              { id: 'transfer', label: t.transfer }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPaymentMethod(item.id as any)}
                className={`py-1.5 rounded-md border text-center font-medium transition-colors ${
                  paymentMethod === item.id
                    ? 'border-orange-500 bg-orange-500/15 text-orange-400'
                    : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleRenew}
          disabled={isProcessing}
          className="w-full h-10 text-xs font-semibold mt-2"
        >
          {isProcessing ? "..." : t.collectAndValidate(selectedPlan?.price || 0, t.currency)}
        </Button>
      </div>
    </Sheet>
  );
}
