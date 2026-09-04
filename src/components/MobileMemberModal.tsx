import React, { useState, useEffect } from 'react';
import { Member, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Input, Sheet } from './ui/shadcn';
import { CameraCapture } from './CameraCapture';
import { Camera, Trash2, User, Phone, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { SupportedLanguage, translations } from '../utils/i18n';

interface MobileMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberCreated: (member: Member) => void;
  memberToEdit?: Member | null;
  lang?: SupportedLanguage;
}

export function MobileMemberModal({
  isOpen,
  onClose,
  onMemberCreated,
  memberToEdit,
  lang = 'fr'
}: MobileMemberModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang] || translations.fr;
  const isRTL = lang === 'ar';

  useEffect(() => {
    if (memberToEdit) {
      setFullName(memberToEdit.fullName || '');
      setPhone(memberToEdit.phone || '');
      setPhoto(memberToEdit.photo || null);
      setNotes(memberToEdit.notes || '');
    } else {
      setFullName('');
      setPhone('');
      setPhoto(null);
      setNotes('');
    }
    setError(null);
  }, [memberToEdit, isOpen]);

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
          setPhoto(webpDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      setError(lang === 'ar' ? 'يرجى إدخال الاسم الكامل ورقم الهاتف' : 'Veuillez saisir le nom complet et le numéro de téléphone.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const now = Date.now();
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      if (memberToEdit) {
        // Edit existing member personal details (preserves current subscription & debts)
        const updatedMember: Member = {
          ...memberToEdit,
          fullName: fullName.trim(),
          phone: phone.trim(),
          photo: photo || null,
          notes: notes.trim() || undefined,
          updatedAt: now
        };

        await db.members.put(updatedMember);
        await syncEngine.enqueue('UPDATE_MEMBER', updatedMember);
        onMemberCreated(updatedMember);
      } else {
        // Create pure Member Profile Decoupled from Subscriptions
        const newId = `LION-${Math.floor(1000 + Math.random() * 9000)}`;

        const newMember: Member = {
          id: newId,
          fullName: fullName.trim(),
          phone: phone.trim(),
          emergencyContact: '',
          photo: photo || null,
          joinedDate: todayStr,
          planId: '',
          planName: lang === 'ar' ? 'بدون اشتراك نشط' : 'Aucun abonnement',
          startDate: todayStr,
          expiryDate: todayStr, // Expired by default until subscribed
          isPaid: true,
          amountDue: 0,
          notes: notes.trim() || undefined,
          isDeleted: false,
          createdAt: now,
          updatedAt: now
        };

        await db.members.add(newMember);
        await syncEngine.enqueue('CREATE_MEMBER', newMember);
        onMemberCreated(newMember);
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError(lang === 'ar' ? 'حدث خطأ أثناء حفظ العضو' : 'Erreur lors de l enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={memberToEdit ? (lang === 'ar' ? 'تعديل بيانات العضو' : 'Modifier le Membre') : (lang === 'ar' ? 'تسجيل عضو جديد' : 'Nouveau Membre')}
      description={lang === 'ar' ? 'إضافة بيانات العضو الشخصية والصورة' : 'Fiche personnelle du membre et photo'}
    >
      <div className={`space-y-4 py-2 ${isRTL ? 'rtl' : 'ltr'}`}>
        {error && (
          <div className="p-3 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] text-[var(--danger)] text-xs font-semibold">
            {error}
          </div>
        )}

        {showCamera ? (
          <div className="rounded-xl overflow-hidden border border-[var(--border)]">
            <CameraCapture
              onCapture={(photoUri) => {
                setPhoto(photoUri);
                setShowCamera(false);
              }}
              onCancel={() => setShowCamera(false)}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Photo Avatar Row */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
              <div className="w-14 h-14 rounded-full bg-[var(--card-solid)] border-2 border-[var(--border-hover)] flex items-center justify-center overflow-hidden shrink-0">
                {photo ? (
                  <img src={photo} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-[var(--text-muted)]" />
                )}
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCamera(true)}
                    className="flex-1 h-8 text-xs border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)]"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1 text-[var(--primary)]" />
                    {lang === 'ar' ? 'كاميرا' : 'Photo'}
                  </Button>

                  <label className="flex-1">
                    <input type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
                    <div className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs flex items-center justify-center cursor-pointer font-medium transition-colors">
                      {lang === 'ar' ? 'المعرض' : 'Galerie'}
                    </div>
                  </label>
                </div>

                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="text-[10px] text-[var(--danger)] hover:opacity-80 flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="w-3 h-3" />
                    {lang === 'ar' ? 'حذف الصورة' : 'Supprimer la photo'}
                  </button>
                )}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                {lang === 'ar' ? 'الاسم الكامل' : 'Nom Complet'} <span className="text-[var(--primary)]">*</span>
              </label>
              <div className="relative">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: كريم بناني' : 'Ex: Mehdi Bennani'}
                  className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                {lang === 'ar' ? 'رقم الهاتف' : 'Téléphone'} <span className="text-[var(--primary)]">*</span>
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: 0612345678' : 'Ex: 06 12 34 56 78'}
                className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] font-mono"
                required
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                {lang === 'ar' ? 'ملاحظات إضافية (اختياري)' : 'Notes / Remarques (Optionnel)'}
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: تدريب كيك بوكسينغ، خزانة رقم 4...' : 'Ex: Casier 4, Objectif prise de masse...'}
                className="bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 text-xs font-bold uppercase tracking-wider bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)] shadow-lg shadow-[var(--primary-border)] active:scale-98 transition-all"
              >
                {isSubmitting
                  ? (lang === 'ar' ? 'جارٍ الحفظ...' : 'Enregistrement...')
                  : memberToEdit
                  ? (lang === 'ar' ? 'حفظ التعديلات' : 'Sauvegarder')
                  : (lang === 'ar' ? 'تسجيل العضو' : 'Créer le Membre')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Sheet>
  );
}
