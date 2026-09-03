import React, { useState } from 'react';
import { Member, MembershipPlan, getSubscriptionStatus } from '../db/db';
import { Avatar, Badge, Button } from './ui/shadcn';
import { Phone, MessageCircle, RefreshCw, ChevronDown, ChevronUp, MessageSquare, Trash2, Edit3, Banknote } from 'lucide-react';
import { SupportedLanguage, translations, getWhatsAppReminder } from '../utils/i18n';

interface MemberCardProps {
  member: Member;
  plans: MembershipPlan[];
    onRenew: (member: Member) => void;
  onTogglePaymentStatus: (member: Member) => void;
  onDeleteMember?: (member: Member) => void;
  onEditMember?: (member: Member) => void;
  lang?: SupportedLanguage;
}

export function MemberCard({
  member,
  plans,
    onRenew,
  onTogglePaymentStatus,
  onDeleteMember,
  onEditMember,
  lang = 'fr'
}: MemberCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { status, daysRemaining } = getSubscriptionStatus(member);
  const t = translations[lang] || translations.fr;

  // Standardize Moroccan phone number
  const cleanPhone = (rawPhone: string) => {
    let p = rawPhone ? rawPhone.replace(/\D/g, '') : '';
    if (p.startsWith('0')) {
      p = '212' + p.substring(1);
    }
    return p;
  };

  const formattedPhone = cleanPhone(member.phone);
  const waReminderText = getWhatsAppReminder(lang, member.fullName, member.planName, daysRemaining, !member.isPaid);
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(waReminderText)}`;
  const callUrl = `tel:+${formattedPhone}`;
  const smsUrl = `sms:+${formattedPhone}?body=${encodeURIComponent(waReminderText)}`;

  const getStatusBadge = () => {
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
      case 'unpaid':
        return (
          <Badge variant="outline" className="bg-[var(--danger-bg)] text-[var(--danger)] border-[var(--danger-border)] text-[10px] px-1.5 py-0 font-medium">
            {t.unpaid} ({member.amountDue || 0} {t.currency})
          </Badge>
        );
    }
  };

  const getStatusDot = () => {
    switch (status) {
      case 'active':
        return 'bg-[var(--success)]';
      case 'expiring':
        return 'bg-[var(--warning)] animate-ping';
      case 'expired':
      case 'unpaid':
        return 'bg-[var(--danger)]';
    }
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden transition-all duration-200 hover:border-[var(--border-hover)] shadow-sm">
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3 flex items-center justify-between cursor-pointer select-none active:bg-[var(--surface-hover)]"
      >
        <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar
              src={member.photo || (member as any).avatarWebP || undefined}
              fallback={member.fullName.substring(0, 2).toUpperCase()}
              className="w-11 h-11 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
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
            </div>
          </div>
        </div>

        {/* Right side: Check-in & Chevron */}
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

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRenew(member);
              }}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)] text-[11px] font-bold shadow-md transition-colors active:scale-95"
              title={t.renew}
            >
              <RefreshCw className="w-4 h-4 text-[var(--primary-foreground)] mb-0.5" />
              <span>{t.renew}</span>
            </button>
          </div>

          {/* Bottom 3 Actions: Toggle Paid, Edit, Delete */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {/* 1. Toggle Paid / Unpaid */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePaymentStatus(member);
              }}
              className={`py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-colors active:scale-95 ${
                member.isPaid
                  ? 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white'
                  : 'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span className="truncate">{member.isPaid ? t.markUnpaid : t.markPaid}</span>
            </button>

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
    </div>
  );
}
