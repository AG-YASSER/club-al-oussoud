import React, { useState, useEffect } from 'react';
import { Member, MembershipPlan, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Input, Sheet } from './ui/shadcn';
import { CameraCapture } from './CameraCapture';
import { User, Camera, Trash2, Banknote } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { SupportedLanguage, translations } from '../utils/i18n';
import confetti from 'canvas-confetti';

interface MobileMemberModalProps {
  plans: MembershipPlan[];
  isOpen: boolean;
  onClose: () => void;
  onMemberCreated: (member: Member) => void;
  memberToEdit?: Member | null;
  lang?: SupportedLanguage;
}

export function MobileMemberModal({
  plans,
  isOpen,
  onClose,
  onMemberCreated,
  memberToEdit,
  lang = 'fr'
}: MobileMemberModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [planId, setPlanId] = useState(plans[0]?.id || 'plan_1m');
  const [isPaid, setIsPaid] = useState(true);
  const [customPaidAmount, setCustomPaidAmount] = useState<number | ''>('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const t = translations[lang] || translations.fr;
  const selectedPlan = plans.find((p) => p.id === planId) || plans[0];

  useEffect(() => {
    if (memberToEdit) {
      setFullName(memberToEdit.fullName);
      setPhone(memberToEdit.phone);
      setEmergencyContact(memberToEdit.emergencyContact || '');
      setPlanId(memberToEdit.planId);
      setIsPaid(memberToEdit.isPaid);
      setCustomPaidAmount(memberToEdit.isPaid ? selectedPlan?.price || 0 : 0);
      setPhoto(memberToEdit.photo || (memberToEdit as any).avatarWebP || null);
      setNotes(memberToEdit.notes || '');
    } else {
      setFullName('');
      setPhone('');
      setEmergencyContact('');
      setPlanId(plans[0]?.id || 'plan_1m');
      setIsPaid(true);
      setCustomPaidAmount(selectedPlan?.price || 0);
      setPhoto(null);
      setNotes('');
    }
    setErrorMessage('');
  }, [memberToEdit, isOpen, plans]);

  useEffect(() => {
    if (!memberToEdit && selectedPlan) {
      setCustomPaidAmount(isPaid ? selectedPlan.price : 0);
    }
  }, [planId, isPaid, selectedPlan, memberToEdit]);

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        canvas.width = 300;
        canvas.height = 300;
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);
        setPhoto(canvas.toDataURL('image/webp', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !selectedPlan) {
      setErrorMessage(t.requiredFieldsError || 'Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const cleanPhoneInput = phone.replace(/\s+/g, '');
      const existing = await db.members
        .where('phone')
        .equals(cleanPhoneInput)
        .first();

      if (existing && !memberToEdit) {
        setErrorMessage(
          t.phoneExistsError
            ? t.phoneExistsError(existing.fullName, existing.id)
            : `Ce numéro de téléphone est déjà attribué à ${existing.fullName} (#${existing.id}).`
        );
        setIsSubmitting(false);
        return;
      }

      const now = new Date();
      const startDateStr = format(now, 'yyyy-MM-dd');
      const expiryDate = addMonths(now, selectedPlan.durationMonths);
      const expiryDateStr = format(expiryDate, 'yyyy-MM-dd');

      const totalPrice = selectedPlan.price;
      const actualPaid = isPaid ? (typeof customPaidAmount === 'number' ? customPaidAmount : totalPrice) : 0;
      const amountDue = Math.max(0, totalPrice - actualPaid);
      const fullyPaid = amountDue === 0;

      if (memberToEdit) {
        // UPDATE EXISTING MEMBER
        const updatedMember: Member = {
          ...memberToEdit,
          fullName: fullName.trim(),
          phone: cleanPhoneInput,
          emergencyContact: emergencyContact.trim(),
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          startDate: memberToEdit.startDate || startDateStr,
          expiryDate: memberToEdit.expiryDate || expiryDateStr,
          isPaid: fullyPaid,
          amountDue,
          photo: photo || null,
          notes: notes.trim() || undefined,
          isDeleted: false,
          updatedAt: Date.now()
        };

        await db.members.put(updatedMember);
        syncEngine.enqueue('UPDATE_MEMBER', updatedMember);

        // Record cash payment if newly paid
        if (actualPaid > 0) {
          const payment = {
            id: `PAY-${Date.now()}`,
            subscriptionId: `SUB-${memberToEdit.id}`,
            memberId: updatedMember.id,
            memberName: updatedMember.fullName,
            amountPaid: actualPaid,
            paymentDate: startDateStr,
            paymentMethod: 'CASH' as const,
            timestamp: Date.now()
          };
          await db.payments.add(payment);
          syncEngine.enqueue('PAYMENT', payment);
        }

        onMemberCreated(updatedMember);
      } else {
        // CREATE NEW MEMBER
        const randomNum = Math.floor(100 + Math.random() * 900);
        const memberId = `LION-${randomNum}`;
        const subId = `SUB-${Date.now()}-${randomNum}`;

        const newMember: Member = {
          id: memberId,
          fullName: fullName.trim(),
          phone: cleanPhoneInput,
          emergencyContact: emergencyContact.trim(),
          joinedDate: startDateStr,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          startDate: startDateStr,
          expiryDate: expiryDateStr,
          isPaid: fullyPaid,
          amountDue,
          photo: photo || null,
          notes: notes.trim() || undefined,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await db.members.add(newMember);

        // Create initial Subscription snapshot
        const newSub = {
          id: subId,
          memberId: newMember.id,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          startDate: startDateStr,
          endDate: expiryDateStr,
          totalPrice,
          status: 'ACTIVE' as const,
          createdAt: Date.now()
        };
        await db.subscriptions.add(newSub);
        syncEngine.enqueue('SUBSCRIPTION', newSub);

        // If Cash collected, create immutable Payment record
        if (actualPaid > 0) {
          const payment = {
            id: `PAY-${Date.now()}`,
            subscriptionId: subId,
            memberId: newMember.id,
            memberName: newMember.fullName,
            amountPaid: actualPaid,
            paymentDate: startDateStr,
            paymentMethod: 'CASH' as const,
            timestamp: Date.now()
          };
          await db.payments.add(payment);
          syncEngine.enqueue('PAYMENT', payment);
        }

        syncEngine.enqueue('CREATE_MEMBER', newMember);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        onMemberCreated(newMember);
      }

      onClose();
    } catch (err) {
      console.error(err);
      setErrorMessage(t.saveError || 'Une erreur est survenue lors de l enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={memberToEdit ? (t.editMemberModalTitle || 'Modifier le Membre') : (t.addMemberModalTitle || 'Nouveau Membre')}
      description={
        memberToEdit
          ? (t.editMemberModalDesc ? t.editMemberModalDesc(memberToEdit.fullName) : `Modifier les informations de ${memberToEdit.fullName}`)
          : (t.newMemberModalDesc || 'Enregistrez un nouveau membre et son abonnement')
      }
    >
      <div className="py-2">
        {showCamera ? (
          <CameraCapture
            onCapture={(webpDataUrl) => {
              setPhoto(webpDataUrl);
              setShowCamera(false);
            }}
            onCancel={() => setShowCamera(false)}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMessage ? (
              <div className="p-2.5 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-xs font-semibold">
                {errorMessage}
              </div>
            ) : null}

            {/* Photo Section */}
            <div className="flex items-center space-x-4 rtl:space-x-reverse bg-[var(--card)] p-3 rounded-xl border border-[var(--border)]">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                {photo ? (
                  <img src={photo} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-[var(--text-muted)]" />
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCamera(true)}
                    className="flex-1 h-8 text-xs border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)]"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1 text-[var(--primary)]" />
                    {t.takePhotoBtn || 'Photo'}
                  </Button>

                  <label className="flex-1">
                    <input type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
                    <div className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs flex items-center justify-center cursor-pointer font-medium transition-colors">
                      {t.galleryBtn || 'Galerie'}
                    </div>
                  </label>
                </div>

                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="text-[11px] text-[var(--danger)] hover:opacity-80 flex items-center gap-1 self-start font-medium"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t.removePhotoBtn || 'Supprimer la photo'}
                  </button>
                )}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                {t.fullName} <span className="text-[var(--primary)]">*</span>
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t.fullNamePlaceholder || 'Ex: Mehdi Bennani'}
                className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                {t.phone} <span className="text-[var(--primary)]">*</span>
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder || 'Ex: 06 12 34 56 78'}
                className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] font-mono"
                required
              />
            </div>

            {/* Plan Choice */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">{t.choosePlan}</label>
              <div className="grid grid-cols-2 gap-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`p-2.5 rounded-xl border text-left rtl:text-right transition-all ${
                      planId === p.id
                        ? 'border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--text-primary)] shadow-sm'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <div className="font-semibold text-xs text-[var(--text-primary)] truncate">{p.name}</div>
                    <div className="font-mono text-[var(--primary)] font-bold text-xs mt-0.5">
                      {p.price} {t.currency}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Financial Cash & Debt Setting */}
            <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-[var(--success)]" />
                    {t.cashPaymentModal || 'Paiement Espèces (Cash)'}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {isPaid
                      ? (t.cashPaymentSubtextPaid || 'Cotisation totale réglée en cash')
                      : (t.cashPaymentSubtextUnpaid || 'Avance partielle / Dette enregistrée')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPaid(!isPaid)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    isPaid ? 'bg-[var(--success)] justify-end' : 'bg-[var(--surface)] border border-[var(--border)] justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-[var(--text-primary)] shadow-sm" />
                </button>
              </div>

              {!isPaid && (
                <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] block font-medium">
                      {t.cashCollectedAmount || 'Montant encaissé (Cash)'}
                    </label>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {t.totalPriceLabel
                        ? t.totalPriceLabel(selectedPlan?.price || 0, t.currency)
                        : `Prix total: ${selectedPlan?.price} ${t.currency}`}
                    </span>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      min="0"
                      max={selectedPlan?.price || 5000}
                      value={customPaidAmount}
                      onChange={(e) => setCustomPaidAmount(Number(e.target.value))}
                      placeholder={`0 ${t.currency}`}
                      className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] font-mono text-xs h-8 text-right rtl:text-left"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                {t.internalNote || 'Notes / Remarques'}
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder || 'Ex: Blessure genou, casier n°12...'}
                className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 text-xs font-bold uppercase tracking-wider bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary-border)] active:scale-98 transition-all"
            >
              {isSubmitting
                ? (t.processingBtn || 'Traitement...')
                : memberToEdit
                ? (t.saveChangesBtn || 'Sauvegarder les modifications')
                : (t.saveMember || 'Enregistrer le Membre')}
            </Button>
          </form>
        )}
      </div>
    </Sheet>
  );
}
