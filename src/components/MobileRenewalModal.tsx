import React, { useState, useEffect } from 'react';
import { Member, MembershipPlan, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Sheet, Input } from './ui/shadcn';
import { Calendar, Banknote, Clock, ShieldCheck, AlertCircle, Coins } from 'lucide-react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang] || translations.fr;
  const isRTL = lang === 'ar';

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  // Existing surplus balance from previous overpayment
  const existingCredit = Math.max(0, Number(member.creditBalance) || 0);

  // Dynamic calculations
  const totalPrice = Number(selectedPlan ? selectedPlan.price : 0);
  const appliedCredit = Math.min(existingCredit, totalPrice);
  const netDueAfterCredit = Math.max(0, totalPrice - appliedCredit);

  const [customPaidAmount, setCustomPaidAmount] = useState<string | number>(netDueAfterCredit);

  useEffect(() => {
    if (selectedPlan) {
      // By default, suggest net cash due after deducting existing surplus credit!
      setCustomPaidAmount(netDueAfterCredit);
      setError(null);
    }
  }, [selectedPlan, isOpen, netDueAfterCredit]);

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

  // Dynamic Debt / Surplus Calculation:
  // Total funds available = previous surplus credit + cash received today
  const amountPaidNum = Math.max(0, Number(customPaidAmount) || 0);
  const totalFunds = existingCredit + amountPaidNum;
  const isFullyCovered = totalFunds >= totalPrice;
  const remainingDebt = isFullyCovered ? 0 : totalPrice - totalFunds;
  const newCreditBalance = isFullyCovered ? totalFunds - totalPrice : 0;
  const isFullyPaid = isFullyCovered;

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

      // Update Member state with exact calculated debt and updated creditBalance (surplus becomes 0 if fully used)
      const updatedMember: Member = {
        ...member,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        startDate: newStartDate,
        expiryDate: newExpiryDate,
        isPaid: isFullyPaid,
        amountDue: remainingDebt,
        creditBalance: newCreditBalance, // Surplus stored in system until 0 or updated
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

      // Record Cash payment record
      let note = 'Paiement comptant';
      if (existingCredit > 0 && amountPaidNum > 0) {
        note = `Paiement avec déduction de surplus antérieur (${appliedCredit} DH déduits). Encaissé: ${amountPaidNum} DH${newCreditBalance > 0 ? ` (Nouveau surplus: +${newCreditBalance} DH)` : ''}`;
      } else if (existingCredit > 0 && amountPaidNum === 0) {
        note = `Renouvellement couvert par surplus antérieur (${appliedCredit} DH déduits)${newCreditBalance > 0 ? ` (Nouveau surplus: +${newCreditBalance} DH)` : ''}`;
      } else if (remainingDebt > 0) {
        note = `Paiement partiel. Reste dû: ${remainingDebt} DH`;
      } else if (newCreditBalance > 0) {
        note = `Paiement avec surplus conservé: +${newCreditBalance} DH`;
      }

      const paymentRecord = {
        id: `PAY-${now}`,
        subscriptionId: subId,
        memberId: member.id,
        memberName: member.fullName,
        amountPaid: amountPaidNum,
        paymentDate: todayStr,
        paymentMethod: 'CASH' as const,
        note: note,
        timestamp: now
      };

      await db.payments.add(paymentRecord);
      await syncEngine.enqueue('PAYMENT', paymentRecord);

      await syncEngine.enqueue('SUBSCRIPTION', subscriptionRecord);
      await syncEngine.enqueue('UPDATE_MEMBER', updatedMember);

      if (isFullyPaid) {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      }
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
      title={lang === 'ar' ? 'تجديد الاشتراك / الأداء' : lang === 'en' ? 'Renew Membership / Settle' : 'Renouvellement d\'Abonnement'}
      description={`${member.fullName} (#${member.id})`}
    >
      <div className={`space-y-4 py-2 text-xs ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Prior Unpaid Debt Warning Block */}
        {hasExistingDebt && (
          <div className="p-3.5 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] space-y-2 text-[var(--danger)]">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'تنبيه: يوجد على المشترك دين غير مدفوع' : lang === 'en' ? 'Warning: Member has pending debt' : 'Attention: Dette antérieure impayée'}</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {lang === 'ar'
                ? `هذا المشترك مدين بمبلغ ${existingDebt} DH. النظام يمنع التجديد حتى يتم استخلاص الدين السابق كاملاً.`
                : `Ce membre doit encore ${existingDebt} DH. Le renouvellement est bloqué jusqu'à régularisation totale de la dette.`}
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
                    <span className="text-[10px] text-[var(--text-muted)]">{p.durationMonths} {lang === 'ar' ? (p.durationMonths === 1 ? 'شهر' : 'أشهر') : lang === 'en' ? 'mo' : 'mois'}</span>
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

        {/* SPECIAL SURPLUS NOTIFICATION BOX: Appears ONLY when existingCredit > 0 UNDER THE DATES */}
        {existingCredit > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                {lang === 'ar'
                  ? 'رصيد فائض سابق متوفر للعميل'
                  : lang === 'en'
                  ? 'Previous Surplus Credit Available'
                  : 'Surplus antérieur disponible'}
              </span>
              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                +{existingCredit} DH
              </span>
            </div>

            <p className="text-[11px] leading-relaxed text-amber-200/90 font-medium">
              {lang === 'ar'
                ? `تنبيه لصاحب المحل: هذا العميل قد أعطى في السابق مبلغاً أكبر من الاشتراك (بقي له +${existingCredit} DH)، وتم تلقائياً احتساب وخصم الفائض (${appliedCredit} DH) من هذا التجديد حتى يصبح الفائض 0.`
                : lang === 'en'
                ? `Notice: This customer previously overpaid (remaining credit: +${existingCredit} DH). The surplus of ${appliedCredit} DH has been automatically deducted from this renewal.`
                : `Note réception : Ce client a versé précédemment un montant supérieur à l'abonnement (surplus de +${existingCredit} DH). Ce montant (${appliedCredit} DH) a été automatiquement déduit de ce renouvellement.`}
            </p>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-amber-500/20 font-mono">
              <span className="text-amber-200/70">
                {lang === 'ar' ? 'سعر الباقة:' : 'Tarif :'} <strong className="text-amber-200">{totalPrice} DH</strong>
              </span>
              <span className="text-emerald-400 font-bold">
                -{appliedCredit} DH {lang === 'ar' ? '(خصم الفائض)' : '(déduit)'}
              </span>
              <span className="font-bold text-amber-300">
                = {netDueAfterCredit} DH {lang === 'ar' ? '(المطلوب)' : '(net à payer)'}
              </span>
            </div>

            {existingCredit > totalPrice && (
              <div className="text-[10px] text-amber-300/90 font-medium pt-1 border-t border-amber-500/10">
                {lang === 'ar'
                  ? `سيتبقى للعميل فائض إضافي قدره +${existingCredit - totalPrice} DH محفوظ في حسابه للتجديد القادم.`
                  : `Il restera encore un surplus de +${existingCredit - totalPrice} DH conservé pour le prochain renouvellement.`}
              </div>
            )}
          </div>
        )}

        {/* 3. Single Clean Cash Input Box & Live Dynamic Calculation */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-[var(--success)]" />
              {lang === 'ar' ? 'المبلغ المستلم نقداً (كاش)' : lang === 'en' ? 'Cash Received Today' : 'Montant Encaissé (Espèces)'}
            </span>
            <span className="text-[11px] font-mono font-bold text-[var(--text-secondary)]">
              {existingCredit > 0 ? (
                <span className="flex items-center gap-1.5">
                  <span className="line-through text-zinc-500 text-[10px]">{totalPrice} DH</span>
                  <span className="text-amber-400 font-black">{netDueAfterCredit} DH</span>
                </span>
              ) : (
                <span>{lang === 'ar' ? 'سعر الباقة:' : lang === 'en' ? 'Plan Price:' : 'Tarif :'} {totalPrice} DH</span>
              )}
            </span>
          </div>

          {/* Single clean input box without any presets */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              value={customPaidAmount}
              onChange={(e) => {
                const clean = e.target.value.replace(/^0+(?=\d)/, '');
                setCustomPaidAmount(clean);
              }}
              onFocus={(e) => e.target.select()}
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
          ) : newCreditBalance > 0 ? (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-300">
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                {lang === 'ar' ? 'فائض جديد سيتم حفظه للنظام:' : lang === 'en' ? 'New Excess Credit to be Saved:' : 'Nouveau surplus conservé :'}
              </span>
              <span className="font-mono font-black text-xs">+{newCreditBalance} DH</span>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] flex items-center justify-between text-[var(--success)]">
              <span className="flex items-center gap-1.5 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                {existingCredit > 0
                  ? (lang === 'ar' ? 'تم استهلاك الفائض بالكامل (الحساب خالص)' : lang === 'en' ? 'Surplus fully applied (Account Settled)' : 'Surplus soldé (Compte réglé)')
                  : (lang === 'ar' ? 'الحساب خالص بالكامل' : lang === 'en' ? 'Paid in Full (Zero Debt)' : 'Compte soldé (Payé)')}
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
            : amountPaidNum === 0 && isFullyCovered
            ? (lang === 'ar' ? 'تأكيد التجديد (0 DH كاش - مخصوم من الفائض)' : lang === 'en' ? 'Confirm Renewal (0 DH Cash - Covered by Surplus)' : 'Valider (0 DH - Déduit du surplus)')
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
