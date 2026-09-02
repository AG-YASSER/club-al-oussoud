import React, { useState } from 'react';
import { db, Member, MembershipPlan } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { defaultTheme } from '../config/theme';
import { CameraCapture } from './CameraCapture';
import { Button, Input, Sheet, Badge } from './ui/shadcn';
import { Camera, Image, Check, X, User, Trash2, DollarSign } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { SupportedLanguage, translations } from '../utils/i18n';
import confetti from 'canvas-confetti';

interface MobileMemberModalProps {
  plans: MembershipPlan[];
  isOpen: boolean;
  onClose: () => void;
  onMemberCreated: (member: Member) => void;
  lang: SupportedLanguage;
}

export function MobileMemberModal({
  plans,
  isOpen,
  onClose,
  onMemberCreated,
  lang
}: MobileMemberModalProps) {
  const t = translations[lang];
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [planId, setPlanId] = useState(plans[0]?.id || 'plan_1m');
  const [isPaid, setIsPaid] = useState(true);
  const [avatarWebP, setAvatarWebP] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan = plans.find((p) => p.id === planId) || plans[0];

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        canvas.width = 400;
        canvas.height = 400;
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 400, 400);
        setAvatarWebP(canvas.toDataURL('image/webp', 0.85));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const expiryDate = format(
        addMonths(new Date(), selectedPlan ? selectedPlan.durationMonths : 1),
        'yyyy-MM-dd'
      );

      const code = Math.floor(100 + Math.random() * 900);
      const newMember: Member = {
        id: `LION-${code}`,
        fullName: fullName.trim(),
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim() || 'Non renseigné',
        avatarWebP: avatarWebP || undefined,
        joinedDate: todayStr,
        planId: selectedPlan?.id || 'plan_1m',
        planName: selectedPlan?.name || 'Abonnement',
        startDate: todayStr,
        expiryDate,
        isPaid,
        amountDue: isPaid ? 0 : selectedPlan?.price,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };

      await db.members.add(newMember);

      if (isPaid && selectedPlan) {
        await db.payments.add({
          id: `PAY-${Date.now()}`,
          memberId: newMember.id,
          memberName: newMember.fullName,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          amount: selectedPlan.price,
          paymentMethod: 'cash',
          timestamp: now,
          dateStr: todayStr,
          validFrom: todayStr,
          validUntil: expiryDate
        });
      }

      await syncEngine.enqueue('CREATE_MEMBER', newMember);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      onMemberCreated(newMember);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={t.addMemberModalTitle}
      description={t.addMemberSubtitle}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
        {/* Photo area */}
        <div className="flex items-center gap-3 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
          <div className="relative w-14 h-14 rounded-full bg-zinc-850 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
            {avatarWebP ? (
              <img src={avatarWebP} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-zinc-600" />
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <span className="text-xs font-medium text-zinc-300 block">{t.photoTitle}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowCamera(true)}
                className="h-7 text-xs flex-1 gap-1"
              >
                <Camera className="w-3.5 h-3.5 text-orange-400" />
                <span>Caméra</span>
              </Button>

              <label className="flex-1 cursor-pointer">
                <input type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
                <div className="h-7 rounded-md border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 flex items-center justify-center text-xs gap-1 transition-colors">
                  <Image className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Galerie</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-2">
          <div>
            <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t.fullName} *</label>
            <Input
              placeholder="Ex: Yassine Benali"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t.phone} *</label>
              <Input
                type="tel"
                placeholder="06 12 34 56 78"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t.emergencyContact}</label>
              <Input
                placeholder="Ami / Parent"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Subscription Plan Picker */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t.planSelection}</label>
          <div className="grid grid-cols-2 gap-2">
            {plans.map((p) => {
              const isSelected = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500/10 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-zinc-750'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{p.name}</div>
                  <div className="text-[10px] text-zinc-400">{p.durationMonths} mois</div>
                  <div className="text-xs font-bold text-orange-400 font-mono mt-0.5">{p.price} DH</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-zinc-200 block">{isPaid ? t.paid : t.unpaid}</span>
            <span className="text-[10px] text-zinc-400">{isPaid ? t.paidSubtext : t.unpaidSubtext}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsPaid(!isPaid)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              isPaid
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}
          >
            {isPaid ? "Payé ✓" : "Dette ⚠️"}
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 block mb-1">{t.internalNote}</label>
          <Input
            placeholder="Ex: Casier N°7"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 text-sm font-semibold mt-2"
        >
          {isSubmitting ? t.saving : t.saveMember}
        </Button>
      </form>

      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <CameraCapture
            onCapture={(webp) => {
              setAvatarWebP(webp);
              setShowCamera(false);
            }}
            onCancel={() => setShowCamera(false)}
          />
        </div>
      )}
    </Sheet>
  );
}
