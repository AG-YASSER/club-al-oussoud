import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Member, MembershipPlan, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from './ui/components';
import {
  IconCreditCard,
  IconX,
  IconCalendarEvent,
  IconCheck,
  IconSparkles,
  IconReceipt2,
  IconCash,
  IconDeviceMobile
} from '@tabler/icons-react';
import { addMonths, format } from 'date-fns';
import confetti from 'canvas-confetti';

interface RenewalModalProps {
  member: Member;
  plans: MembershipPlan[];
  isOpen: boolean;
  onClose: () => void;
  onRenewSuccess: (updatedMember: Member) => void;
}

export function RenewalModal({
  member,
  plans,
  isOpen,
  onClose,
  onRenewSuccess
}: RenewalModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(member.planId || plans[0]?.id || 'plan_1m');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi_transfer'>('card');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const calculateNewDates = () => {
    const today = new Date();
    const currentExpiry = new Date(member.expiryDate);
    const baseDate = currentExpiry < today ? today : currentExpiry;
    const newExpiry = addMonths(baseDate, selectedPlan ? selectedPlan.durationMonths : 1);

    return {
      startDate: format(currentExpiry < today ? today : new Date(member.startDate), 'yyyy-MM-dd'),
      expiryDate: format(newExpiry, 'yyyy-MM-dd')
    };
  };

  const finalPrice = Math.max(0, (selectedPlan?.price || 0) - discountAmount);

  const handleRenew = async () => {
    if (!selectedPlan) return;
    setIsProcessing(true);

    try {
      const { expiryDate } = calculateNewDates();
      const now = Date.now();
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const updatedMember: Member = {
        ...member,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        expiryDate,
        updatedAt: now
      };

      await db.members.put(updatedMember);

      const paymentRecord = {
        id: 'PAY-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        memberId: member.id,
        memberName: member.fullName,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: finalPrice,
        paymentMethod,
        timestamp: now,
        dateStr: todayStr,
        validFrom: todayStr,
        validUntil: expiryDate
      };

      await db.payments.add(paymentRecord);
      await syncEngine.enqueue('PAYMENT', paymentRecord);
      await syncEngine.enqueue('UPDATE_MEMBER', updatedMember);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });

      onRenewSuccess(updatedMember);
      onClose();
    } catch (err) {
      console.error('Renewal failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const { expiryDate: newExpiryPreview } = calculateNewDates();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-lg"
        >
          <Card className="border-zinc-800 bg-zinc-900/95 shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <IconCreditCard className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-white tracking-tight">
                    Renew Membership Pass
                  </CardTitle>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Extending subscription for <span className="text-zinc-200 font-semibold">{member.fullName}</span> ({member.id})
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition"
              >
                <IconX className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* Plan Selection */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2.5">
                  Choose Extension Plan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {plans.map((p) => {
                    const isSelected = p.id === selectedPlanId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-emerald-500/80 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                            : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-bold text-sm text-zinc-200">{p.name}</div>
                          <span className="text-xs font-mono font-bold text-emerald-400">${p.price}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">
                          {p.durationMonths} {p.durationMonths === 1 ? 'Month' : 'Months'} Access
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expiry Date Timeline Preview */}
              <div className="bg-zinc-950/80 rounded-xl p-4 border border-zinc-800/80 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <IconCalendarEvent className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400">New Expiry Date</p>
                    <p className="text-sm font-bold text-white font-mono">{newExpiryPreview}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-zinc-400">Current Expiry</p>
                  <p className="text-xs font-mono text-zinc-500">{member.expiryDate}</p>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'card', label: 'Credit Card', icon: IconCreditCard },
                    { id: 'cash', label: 'Cash Desk', icon: IconCash },
                    { id: 'upi_transfer', label: 'Instant UPI', icon: IconDeviceMobile }
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-medium rounded-xl border transition ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/30'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Apply Receptionist Discount ($)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max={selectedPlan?.price || 1000}
                    value={discountAmount || ''}
                    placeholder="0"
                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Price Calculation & Checkout */}
              <div className="border-t border-zinc-800/80 pt-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-zinc-400 uppercase font-semibold">Total Amount:</span>
                  <div className="text-2xl font-black text-emerald-400 font-mono">${finalPrice}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                    Cancel
                  </Button>
                  <Button variant="default" onClick={handleRenew} disabled={isProcessing} className="px-6 font-bold">
                    <IconCheck className="w-4 h-4 mr-1.5" />
                    {isProcessing ? 'Recording...' : 'Collect & Extend'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
