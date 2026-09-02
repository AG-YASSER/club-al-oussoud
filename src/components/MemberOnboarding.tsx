import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { db, Member, MembershipPlan } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from './ui/components';
import { CameraCapture } from './CameraCapture';
import {
  IconUserPlus,
  IconCamera,
  IconCheck,
  IconSparkles,
  IconArrowLeft,
  IconTrash,
  IconCalendar,
  IconAlertCircle,
  IconStar
} from '@tabler/icons-react';
import { format, addMonths } from 'date-fns';
import confetti from 'canvas-confetti';

interface MemberOnboardingProps {
  plans: MembershipPlan[];
  onMemberCreated: (newMember: Member) => void;
  onCancel?: () => void;
}

export function MemberOnboarding({
  plans,
  onMemberCreated,
  onCancel
}: MemberOnboardingProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState(plans[0]?.id || 'plan_1m');
  const [joinedDate, setJoinedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [avatarWebP, setAvatarWebP] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan = plans.find((p) => p.id === planId) || plans[0];

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!phone.trim()) newErrors.phone = 'Phone number is required';
    if (!emergencyContact.trim()) newErrors.emergencyContact = 'Emergency contact is required';
    if (!selectedPlan) newErrors.plan = 'Please select a membership plan';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedPlan) return;

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const startDate = joinedDate;
      const expiryDate = format(
        addMonths(new Date(startDate), selectedPlan.durationMonths),
        'yyyy-MM-dd'
      );

      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const memberId = `GYM-${randomCode}`;

      const newMember: Member = {
        id: memberId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim(),
        email: email.trim() || undefined,
        avatarWebP: avatarWebP || undefined,
        joinedDate,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        startDate,
        expiryDate,
        isPaid: true,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };

      await db.members.add(newMember);

      const paymentRecord = {
        id: 'PAY-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
        memberId: newMember.id,
        memberName: newMember.fullName,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        paymentMethod: 'card' as const,
        timestamp: now,
        dateStr: joinedDate,
        validFrom: startDate,
        validUntil: expiryDate
      };
      await db.payments.add(paymentRecord);

      await syncEngine.enqueue('CREATE_MEMBER', newMember);
      await syncEngine.enqueue('PAYMENT', paymentRecord);

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });

      onMemberCreated(newMember);
    } catch (err) {
      console.error('Member creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* SaaS Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/70 p-6 rounded-2xl border border-zinc-800/80 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <IconUserPlus className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Member Onboarding
            </h1>
            <p className="text-xs text-zinc-400">
              Live webcam portrait capture, contact profile, and subscription issuance
            </p>
          </div>
        </div>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <IconArrowLeft className="w-4 h-4" /> Back to Desk
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar WebP Box */}
          <div className="space-y-4">
            <Card className="border-zinc-800 bg-zinc-900/60 p-5 text-center">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-3">
                Member Portrait
              </label>

              <div className="flex flex-col items-center">
                <div className="relative w-44 h-44 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner scanner-grid">
                  {avatarWebP ? (
                    <img
                      src={avatarWebP}
                      alt="Member Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <IconCamera className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                      <span className="text-[11px] text-zinc-500">Awaiting camera snap</span>
                    </div>
                  )}

                  {avatarWebP && (
                    <div className="absolute top-2 right-2 bg-emerald-500/90 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <IconSparkles className="w-3 h-3" /> WebP
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2 w-full">
                  <Button
                    type="button"
                    variant={avatarWebP ? "outline" : "default"}
                    onClick={() => setShowCameraModal(true)}
                    className="w-full font-bold"
                  >
                    <IconCamera className="w-4 h-4 mr-2" />
                    {avatarWebP ? 'Retake Photo' : 'Open Live Webcam'}
                  </Button>

                  {avatarWebP && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAvatarWebP(null)}
                      className="text-zinc-500 hover:text-rose-400 text-xs"
                    >
                      <IconTrash className="w-3.5 h-3.5 mr-1" /> Remove Photo
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Plan Snapshot */}
            <Card className="border-zinc-800 bg-zinc-900/40 p-4">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Order Summary
              </h4>
              <div className="space-y-2 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Selected Tier:</span>
                  <span className="font-semibold text-white">{selectedPlan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Access Duration:</span>
                  <span className="text-zinc-300">{selectedPlan?.durationMonths} Months</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-zinc-800/80">
                  <span>Initial Fee:</span>
                  <span className="font-mono font-black text-emerald-400 text-base">
                    ${selectedPlan?.price}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Form details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800/80 pb-3">
                1. Member Personal Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Full Name *
                  </label>
                  <Input
                    placeholder="e.g. Jordan Miller"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={errors.fullName ? 'border-rose-500/80' : ''}
                  />
                  {errors.fullName && (
                    <span className="text-[11px] text-rose-400 mt-1 block flex items-center gap-1">
                      <IconAlertCircle className="w-3 h-3" /> {errors.fullName}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Phone Number *
                  </label>
                  <Input
                    placeholder="e.g. +1 (555) 987-6543"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={errors.phone ? 'border-rose-500/80' : ''}
                  />
                  {errors.phone && (
                    <span className="text-[11px] text-rose-400 mt-1 block flex items-center gap-1">
                      <IconAlertCircle className="w-3 h-3" /> {errors.phone}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Emergency Contact (Name & Phone) *
                  </label>
                  <Input
                    placeholder="e.g. Rachel Miller (+1 555-444-3322)"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className={errors.emergencyContact ? 'border-rose-500/80' : ''}
                  />
                  {errors.emergencyContact && (
                    <span className="text-[11px] text-rose-400 mt-1 block flex items-center gap-1">
                      <IconAlertCircle className="w-3 h-3" /> {errors.emergencyContact}
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Email Address (Optional)
                  </label>
                  <Input
                    type="email"
                    placeholder="e.g. member@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                  Receptionist / Medical Notes
                </label>
                <Input
                  placeholder="e.g. Needs locker key assigned, orientation scheduled"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </Card>

            {/* Plan Options */}
            <Card className="border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. Choose Membership Tier
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Join Date:</span>
                  <Input
                    type="date"
                    value={joinedDate}
                    onChange={(e) => setJoinedDate(e.target.value)}
                    className="h-8 text-xs w-36"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plans.map((p) => {
                  const isSelected = p.id === planId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setPlanId(p.id)}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all duration-200 relative ${
                        isSelected
                          ? 'border-emerald-500/80 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                          : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-950'
                      }`}
                    >
                      {p.popular && (
                        <span className="absolute top-3 right-3 bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <IconStar className="w-2.5 h-2.5 fill-amber-400" /> POPULAR
                        </span>
                      )}
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="text-2xl font-black text-emerald-400 my-1 font-mono">
                        ${p.price}
                        <span className="text-xs font-normal text-zinc-400 ml-1 font-sans">
                          /{p.durationMonths} {p.durationMonths === 1 ? 'mo' : 'mos'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1 mb-2">{p.description}</p>
                      <ul className="text-[11px] text-zinc-400 space-y-1">
                        {p.features.slice(0, 2).map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="text-emerald-400 font-bold">✓</span> {feat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="flex items-center justify-end gap-3 pt-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="default"
                size="lg"
                disabled={isSubmitting}
                className="px-8 font-bold"
              >
                <IconCheck className="w-5 h-5 mr-2" />
                {isSubmitting ? 'Registering...' : 'Complete & Generate Member ID'}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <CameraCapture
            onCapture={(webp) => {
              setAvatarWebP(webp);
              setShowCameraModal(false);
            }}
            onCancel={() => setShowCameraModal(false)}
          />
        </div>
      )}
    </motion.div>
  );
}
