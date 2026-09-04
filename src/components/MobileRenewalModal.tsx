import React, { useState, useEffect } from 'react';
import { Member, MembershipPlan, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Sheet, Input } from './ui/shadcn';
import { Calendar, Banknote, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { addMonths, format, parseISO, isAfter, startOfDay } from 'date-fns';
import { SupportedLanguage, translations } from '../utils/i18n';
import confetti from 'canvas-confetti';

interface MobileRenewalModalProps {
  member: Member;
  plans: MembershipPlan[];
  isOpen: boolean;
  onClose: () => void;
  onRenewSuccess: (updated: Member) => void;
  onOpenDebtSettlement?: (member: Member) => void;
  lang?: SupportedLanguage;
}

export function MobileRenewalModal({
  member,
  plans,
  isOpen,
  onClose,
  onRenewSuccess,
  onOpenDebtSettlement,
  lang = 'fr'
}: MobileRenewalModalProps) {
  const defaultPlan = plans.find((p) => p.id === member.planId) || plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlan?.id || plans[0]?.id || '');
  const [customPaidAmount, setCustomPaidAmount] = useState<number>(defaultPlan?.price || 0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang] || translations.fr;
  const isRTL = lang === 'ar';

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  useEffect(() => {
    if (selectedPlan) {
      setCustomPaidAmount(selectedPlan.price);
      setError(null);
    }
  }, [selectedPlanId, isOpen]);

  // Check if member already has active debt
  const existingDebt = member.amountDue || 0;
  const hasExistingDebt = existingDebt > 0 || !member.isPaid;

  // Renewal Date Addition: When renewing an active non-expired plan, start from CURRENT expiryDate!
  // If already expired, start from today!
  const calculateDates = () => {
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');

    let baseDate: Date = today;
    let startDateStr: string = todayStr;

    if (member.expiryDate) {
      const currentExpiry = startOfDay(parseISO(member.expiryDate));
      // If expiry is today or in the future: extend from that exact expiry date!
      if (!isNaN(currentExpiry.getTime()) && (isAfter(currentExpiry, today) || member.expiryDate === todayStr)) {
        baseDate = currentExpiry;
        startDateStr = member.expiryDate;
      }
    }

    const months = selectedPlan ? selectedPlan.durationMonths : 1;
    const newExpiry = addMonths(baseDate, months);
    return {
      startDate: startDateStr,
      expiryDate: format(newExpiry, 'yyyy-MM-dd')
    };
  };

  const { startDate: newStartDate, expiryDate: newExpiryDate } = calculateDates();

  // Dynamic Debt Calculation: Remaining Debt = (Plan Price - Entered Cash Amount)
  const totalPrice = Number(selectedPlan ? selectedPlan.price : 0);
  const amountPaidNum = Number(customPaidAmount) || 0;
  const remainingDebt = totalPrice > amountPaidNum ? totalPrice - amountPaidNum : 0;
  const excessCredit = amountPaidNum > totalPrice ? amountPaidNum - totalPrice : 0;
  const isFullyPaid = amountPaidNum >= totalPrice;

  const handleRenew = async () => {
    // Hard check: Restrict renewal if member has unpaid prior debt
    if (hasExistingDebt) {
      setError(
        lang === 'ar'
          ? `يجب استخلاص الدين السابق أولاً (${existingDebt} DH) قبل تجديد الاشتراك.`
          : `Veuillez d'abord régler la dette précédente (${existingDebt} DH) avant de renouveler.`
      );
      return;
    }

    if (!selectedPlan) return;
    if (amountPaidNum < 0) {
      setError(lang === 'ar' ? 'المبلغ المدفوع غير صالح' : 'Montant invalide.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const now = Date.now();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const subId = `SUB-${now}-${member.id}`;

      // Update Member state with exact calculated debt
      const updatedMember: Member = {
        ...member,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        isPaid: isFullyPaid,
        amountDue: remainingDebt, // Exactly (totalPrice - amountPaidNum)
        updatedAt: now
      };

      await db.members.put(updatedMember);

      // Create new Subscription snapshot record
      const subscriptionRecord = {
        id: subId,
        memberId: member.id,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        startDate: newStartDate,
        endDate: newExpiryDate,
        totalPrice: totalPrice,
        status: 'ACTIVE' as const,
        createdAt: now
      };
      await db.subscriptions.add(subscriptionRecord);

      // Create immutable Cash payment record for amount actually paid
      if (amountPaidNum > 0) {
        const paymentRecord = {
          id: `PAY-${now}`,
          subscriptionId: subId,
          memberId: member.id,
          memberName: member.fullName,
          amountPaid: amountPaidNum,
          paymentDate: todayStr,
          paymentMethod: 'CASH' as const,
          note: remainingDebt > 0
            ? `Paiement partiel. Reste dû: ${remainingDebt} DH`
            : excessCredit > 0
            ? `Paiement avec surplus: +${excessCredit} DH`
            : 'Paiement comptant',
          timestamp: now
        };

        await db.payments.add(paymentRecord);
        await syncEngine.enqueue('PAYMENT', paymentRecord);
      }

      await syncEngine.enqueue('SUBSCRIPTION', subscriptionRecord);
      await syncEngine.enqueue('UPDATE_MEMBER', updatedMember);

      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      onRenewSuccess(updatedMember);
      onClose();
    } catch (err) {
      console.error(err);
      setError(lang === 'ar' ? 'حدث خطأ أثناء تجديد الاشتراك' : 'Erreur lors du renouvellement.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={lang === 'ar' ? 'تجديد الاشتراك / استخلاص' : lang === 'en' ? 'Renew Membership / Settle' : 'Renouvellement d\'Abonnement'}
      description={`${member.fullName} (#${member.id})`}
    >
      <div className={`space-y-4 py-2 text-xs ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Prior Unpaid Debt Warning Block */}
        {hasExistingDebt && (
          <div className="p-3.5 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] space-y-2 text-[var(--danger)]">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'تنبيه: دين سابق معلق على المشترك' : lang === 'en' ? 'Warning: Member has pending debt' : 'Attention: Dette antérieure impayée'}</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {lang === 'ar'
                ? `يجب استخلاص الدين السابق أولاً (${existingDebt} DH) قبل تجديد الاشتراك.`
                : lang === 'en'
                ? `Previous debt of ${existingDebt} DH must be settled first before renewing.`
                : `Veuillez d'abord encaisser la dette précédente de ${existingDebt} DH avant de renouveler.`}
            </p>
            {onOpenDebtSettlement && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenDebtSettlement(member);
                }}
                className="w-full h-8 text-xs font-bold bg-[var(--danger)] text-white hover:opacity-90"
              >
                <Banknote className="w-3.5 h-3.5 mr-1" />
                <span>{lang === 'ar' ? `استخلاص الدين الحالي (${existingDebt} DH)` : lang === 'en' ? `Settle Pending Debt (${existingDebt} DH)` : `Régler la dette (${existingDebt} DH)`}</span>
              </Button>
            )}
          </div>
        )}

        {error && !hasExistingDebt && (
          <div className="p-3 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-xs font-semibold">
            {error}
          </div>
        )}

        {/* 1. Plan Choice */}
        <div>
          <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1.5 uppercase tracking-wider">
            {lang === 'ar' ? 'اختر باقة الاشتراك' : lang === 'en' ? 'Select Membership Plan' : 'Choisir la formule'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {plans.map((p) => {
              const isSelected = p.id === selectedPlanId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-3 rounded-xl border text-left rtl:text-right transition-all ${
                    isSelected
                      ? 'border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--text-primary)] shadow-md ring-1 ring-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                  }`}
                >
                  <div className="font-bold text-xs text-[var(--text-primary)] truncate">{p.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-[var(--primary)] font-black text-xs">{p.price} DH</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{p.durationMonths} {lang === 'ar' ? 'أشهر' : lang === 'en' ? 'mo' : 'mois'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Calculated Dates Preview (Extended from current expiry) */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
              {lang === 'ar' ? 'تاريخ بداية التجديد:' : lang === 'en' ? 'Renewal Start Date:' : 'Date de début :'}
            </span>
            <span className="font-mono font-bold text-[var(--text-primary)]">{newStartDate}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[var(--border-subtle)]">
            <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--success)]" />
              {lang === 'ar' ? 'تاريخ الانتهاء الجديد:' : lang === 'en' ? 'New Expiry Date:' : 'Nouvelle expiration :'}
            </span>
            <span className="font-mono font-bold text-[var(--success)] text-xs">{newExpiryDate}</span>
          </div>
        </div>

        {/* 3. Single Clean Cash Input Box & Live Dynamic Calculation */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-[var(--success)]" />
              {lang === 'ar' ? 'المبلغ المستلم نقداً (كاش)' : lang === 'en' ? 'Cash Received Today' : 'Montant Encaissé (Espèces)'}
            </span>
            <span className="text-[11px] font-mono font-bold text-[var(--text-secondary)]">
              {lang === 'ar' ? 'سعر الباقة:' : lang === 'en' ? 'Plan Price:' : 'Tarif :'} {totalPrice} DH
            </span>
          </div>

          {/* Single clean input box without any presets */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              value={customPaidAmount}
              onChange={(e) => setCustomPaidAmount(Number(e.target.value))}
              placeholder="0"
              className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] font-mono text-base font-black h-11 text-center"
            />
            <span className="font-bold text-sm text-[var(--text-secondary)] px-1">DH</span>
          </div>

          {/* Dynamic Calculated Feedback */}
          {remainingDebt > 0 ? (
            <div className="p-2.5 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-between text-[var(--danger)]">
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                <AlertCircle className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'باقي دين على المشترك:' : lang === 'en' ? 'Remaining Debt Due:' : 'Reste dû (Dette) :'}
              </span>
              <span className="font-mono font-black text-xs">-{remainingDebt} DH</span>
            </div>
          ) : excessCredit > 0 ? (
            <div className="p-2.5 rounded-lg bg-[var(--info-bg)] border border-[var(--info-border)] flex items-center justify-between text-[var(--info)]">
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'فائض / رصيد إضافي:' : lang === 'en' ? 'Excess Credit:' : 'Surplus en plus :'}
              </span>
              <span className="font-mono font-black text-xs">+{excessCredit} DH</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-between text-[var(--success)]">
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'الحساب خالص بالكامل' : lang === 'en' ? 'Paid in Full (Zero Debt)' : 'Compte soldé (Payé)'}
              </span>
              <span className="font-mono font-black text-xs">0 DH</span>
            </div>
          )}
        </div>

        {/* 4. Action Button */}
        <Button
          onClick={handleRenew}
          disabled={isProcessing || hasExistingDebt}
          className={`w-full h-11 text-xs font-bold uppercase tracking-wider text-white shadow-lg active:scale-98 transition-all ${
            hasExistingDebt
              ? 'bg-zinc-700 opacity-50 cursor-not-allowed'
              : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-[var(--primary-border)]'
          }`}
        >
          {isProcessing
            ? (lang === 'ar' ? 'جارٍ تسجيل العملية...' : 'Traitement...')
            : hasExistingDebt
            ? (lang === 'ar' ? 'التجديد معطل (يوجد دين سابق)' : 'Renouvellement bloqué (Dette en cours)')
            : lang === 'ar'
            ? `تأكيد واستلام ${amountPaidNum} DH كاش`
            : lang === 'en'
            ? `Confirm & Collect ${amountPaidNum} DH Cash`
            : `Encaisser ${amountPaidNum} DH (Espèces)`}
        </Button>
      </div>
    </Sheet>
  );
}
