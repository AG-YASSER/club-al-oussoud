import { ImagePreviewModal } from './ImagePreviewModal';
import React, { useState } from 'react';
import { Member, MembershipPlan, getSubscriptionStatus } from '../db/db';
import { Avatar, Badge } from './ui/shadcn';
import {
  Phone,
  MessageCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Trash2,
  Edit3,
  Banknote,
  CheckCircle,
  Lock,
  Coins
} from 'lucide-react';
import { SupportedLanguage, translations, getWhatsAppReminder } from '../utils/i18n';

interface MemberCardProps {
  member: Member;
  plans: MembershipPlan[];
  onRenew: (member: Member) => void;
  onSettleDebt: (member: Member) => void;
  onBlockedRenewal?: (member: Member) => void;
  onDeleteMember?: (member: Member) => void;
  onEditMember?: (member: Member) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  lang?: SupportedLanguage;
}

export function MemberCard({
  member,
  plans,
  onRenew,
  onSettleDebt,
  onBlockedRenewal,
  onDeleteMember,
  onEditMember,
  isExpanded,
  onToggleExpand,
  lang = 'fr'
}: MemberCardProps) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = isExpanded !== undefined ? isExpanded : localExpanded;
  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalExpanded(!localExpanded);
    }
  };
  const [showImageModal, setShowImageModal] = useState(false);
  const { status, daysRemaining } = getSubscriptionStatus(member);
  const t = translations[lang] || translations.fr;

  const currentDebt = member.amountDue || 0;
  const hasDebt = currentDebt > 0 || !member.isPaid;

  // Standardize Moroccan phone number
  const cleanPhone = (rawPhone: string) => {
    let p = rawPhone ? rawPhone.replace(/\D/g, '') : '';
    if (p.startsWith('0')) {
      p = '212' + p.substring(1);
    }
    return p;
  };

  const formattedPhone = cleanPhone(member.phone);
  const waReminderText = getWhatsAppReminder(lang, member.fullName, member.planName, daysRemaining, hasDebt);
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(waReminderText)}`;
  const callUrl = `tel:+${formattedPhone}`;
  const smsUrl = `sms:+${formattedPhone}?body=${encodeURIComponent(waReminderText)}`;

  const getStatusBadge = () => {
    if (hasDebt) {
      return (
        <Badge variant="outline" className="bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-border)] text-[10px] px-1.5 py-0 font-bold">
          {lang === 'ar' ? `دين: ${currentDebt} DH` : `Dette: ${currentDebt} DH`}
        </Badge>
      );
    }

        switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="bg-[var(--success-bg)] text-[var(--success)] border-[var(--success-border)] text-[10px] px-1.5 py-0 font-medium">
            {daysRemaining} {t.daysRemaining}
          </Badge>
        );
      case 'expiring':
        return (
          <Badge variant="outline" className="bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning-border)] text-[10px] px-1.5 py-0 font-medium animate-pulse">
            {daysRemaining} {t.daysRemaining}
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-border)] text-[10px] px-1.5 py-0 font-medium">
            {t.filterExpired}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusDot = () => {
    if (hasDebt) return 'bg-[var(--danger)] ring-2 ring-red-500/20';
    switch (status) {
      case 'active':
        return 'bg-[var(--success)]';
      case 'expiring':
        return 'bg-[var(--warning)] animate-ping';
      case 'expired':
        return 'bg-[var(--danger)]';
      default:
        return 'bg-zinc-500';
    }
  };

  const handleRenewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDebt) {
      if (onBlockedRenewal) {
        onBlockedRenewal(member);
      }
      return;
    }
    onRenew(member);
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden transition-all duration-200 hover:border-[var(--border-hover)] shadow-sm">
      {/* Header */}
      <div
        onClick={handleToggle}
        className="p-3 flex items-center justify-between cursor-pointer select-none active:bg-[var(--surface-hover)]"
      >
        <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar
              src={member.photo || undefined}
              fallback={member.fullName.substring(0, 2).toUpperCase()}
              className={`w-11 h-11 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] ${member.photo ? 'cursor-zoom-in ring-1 ring-primary/30 hover:ring-primary hover:scale-105 transition-all' : ''}`}
              onClick={(e) => {
                if (member.photo) {
                  e.stopPropagation();
                  setShowImageModal(true);
                }
              }}
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--background)] ${getStatusDot()}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-bold text-sm text-[var(--text-primary)] truncate">{member.fullName}</h4>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">#{member.id}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[var(--text-secondary)] truncate">{member.planName}</span>
              {getStatusBadge()}
              {Number(member.creditBalance) > 0 && !hasDebt && (
                <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 font-bold">
                  +{member.creditBalance} DH {lang === 'ar' ? 'فائض' : 'Crédit'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Chevron */}
        <div className="flex items-center gap-2 ml-2 rtl:ml-0 rtl:mr-2 flex-shrink-0">
          <button type="button" className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Actions */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] bg-[var(--card-subtle)] space-y-2.5">
          {/* Member Meta */}
          {Number(member.creditBalance) > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
              <span className="text-amber-400 font-bold flex items-center gap-1.5 text-[11px]">
                <Coins className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'رصيد فائض محفوظ في النظام:' : lang === 'en' ? 'Saved Surplus Credit:' : 'Surplus disponible en compte :'}
              </span>
              <span className="font-mono font-black text-amber-300 text-xs">+{member.creditBalance} DH</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--surface)] p-2.5 rounded-lg border border-[var(--border)]">
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">{t.phone}</span>
              <a href={callUrl} className="font-semibold text-[var(--primary)] hover:underline">
                {member.phone}
              </a>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase font-bold">{t.dueDate || 'Échéance'}</span>
              <span className="font-semibold text-[var(--text-primary)] font-mono">{member.expiryDate}</span>
            </div>
          </div>

          {member.notes && (
            <div className="text-xs bg-[var(--surface)] p-2 rounded border border-[var(--border)] text-[var(--text-secondary)] italic">
              "{member.notes}"
            </div>
          )}

          {/* 4 Action Buttons Grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <a
              href={callUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-[11px] font-bold border border-[var(--border)] transition-colors active:scale-95 shadow-sm"
              title={t.call}
            >
              <Phone className="w-4 h-4 text-[var(--primary)] mb-0.5" />
              <span>{t.call}</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-[var(--success-bg)] hover:opacity-90 text-[var(--success)] text-[11px] font-bold border border-[var(--success-border)] transition-colors active:scale-95 shadow-sm"
              title="WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-[var(--success)] mb-0.5" />
              <span>WhatsApp</span>
            </a>

            <a
              href={smsUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-[11px] font-bold border border-[var(--border)] transition-colors active:scale-95 shadow-sm"
              title={t.sms}
            >
              <MessageSquare className="w-4 h-4 text-[var(--info)] mb-0.5" />
              <span>{t.sms}</span>
            </a>

            {/* Renewal Button (Disabled / Warning if active debt exists) */}
            <button
              type="button"
              onClick={handleRenewClick}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-[11px] font-bold shadow-md transition-colors active:scale-95 ${
                hasDebt
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/60 cursor-not-allowed'
                  : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)]'
              }`}
              title={hasDebt ? (lang === 'ar' ? 'التجديد معطل (يوجد دين)' : lang === 'en' ? 'Renewal Blocked (Debt)' : 'Dette en cours') : (lang === 'ar' ? 'تجديد' : lang === 'en' ? 'Renew' : t.renew)}
            >
              {hasDebt ? (
                <Lock className="w-4 h-4 text-zinc-500 mb-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 text-[var(--primary-foreground)] mb-0.5" />
              )}
              <span>{t.renew}</span>
            </button>
          </div>

          {/* Bottom 3 Actions: Settle Debt, Edit, Delete */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {/* 1. Settle Debt Button */}
            {hasDebt ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSettleDebt(member);
                }}
                className="py-2 px-2 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] hover:bg-[var(--danger)] hover:text-white text-[var(--danger)] text-xs font-bold flex items-center justify-center gap-1 transition-colors active:scale-95"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span className="truncate">{lang === 'ar' ? `استخلاص (${currentDebt} DH)` : `Encaisser (${currentDebt} DH)`}</span>
              </button>
            ) : (
              <div className="py-2 px-2 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)] text-xs font-bold flex items-center justify-center gap-1 opacity-90 select-none">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="truncate">{lang === 'ar' ? 'الحساب خالص (0 DH)' : 'Soldé (0 DH)'}</span>
              </div>
            )}

            {/* 2. Edit Member Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onEditMember) onEditMember(member);
              }}
              className="py-2 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1 transition-colors active:scale-95 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>{t.editAction || 'Modifier'}</span>
            </button>

            {/* 3. Delete Member Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onDeleteMember) {
                  onDeleteMember(member);
                }
              }}
              className="py-2 px-2 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] hover:bg-[var(--danger)] hover:text-white text-[var(--danger)] text-xs font-bold flex items-center justify-center gap-1 transition-colors active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.deleteAction || 'Supprimer'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Full Size Member Photo Modal */}
      {member.photo && (
        <ImagePreviewModal
          isOpen={showImageModal}
          src={member.photo}
          title={member.fullName}
          alt={member.fullName}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </div>
  );
}
