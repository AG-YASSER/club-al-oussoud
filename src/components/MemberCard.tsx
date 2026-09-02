import React, { useState } from 'react';
import { Member, MembershipPlan, getSubscriptionStatus } from '../db/db';
import { Avatar, Badge, Button } from './ui/shadcn';
import { Phone, MessageCircle, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, MessageSquare, Trash2 } from 'lucide-react';
import { SupportedLanguage, translations, getWhatsAppReminder } from '../utils/i18n';

interface MemberCardProps {
  member: Member;
  plans: MembershipPlan[];
  onCheckIn: (member: Member) => void;
  onRenew: (member: Member) => void;
  onTogglePaymentStatus: (member: Member) => void;
  onDeleteMember?: (member: Member) => void;
  lang?: SupportedLanguage;
}

export function MemberCard({
  member,
  plans,
  onCheckIn,
  onRenew,
  onTogglePaymentStatus,
  onDeleteMember,
  lang = 'fr'
}: MemberCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { status, daysRemaining } = getSubscriptionStatus(member);
  const t = translations[lang] || translations.fr;

  // Standardize Moroccan phone number: "0612345678" -> "212612345678"
  const cleanPhone = (rawPhone: string) => {
    let p = rawPhone ? rawPhone.replace(/\D/g, '') : '';
    if (p.startsWith('0')) {
      p = '212' + p.substring(1);
    }
    return p;
  };

  const formattedPhone = cleanPhone(member.phone);

  // Safe WhatsApp reminder message via robust standalone function
  const localizedMsg = typeof t?.whatsappReminderTemplate === 'function'
    ? t.whatsappReminderTemplate(member.fullName, member.planName, daysRemaining, !member.isPaid)
    : getWhatsAppReminder(lang, member.fullName, member.planName, daysRemaining, !member.isPaid);

  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(localizedMsg)}`;

  // Native phone call & SMS hrefs
  const telUrl = `tel:+${formattedPhone}`;
  const smsUrl = `sms:+${formattedPhone}?body=${encodeURIComponent(localizedMsg)}`;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-3.5 transition-all cursor-pointer hover:border-zinc-700 select-none shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Avatar with status indicator dot */}
        <div className="relative shrink-0">
          <Avatar
            src={member.avatarWebP}
            fallback={member.fullName ? member.fullName.charAt(0).toUpperCase() : 'M'}
            className="h-11 w-11 rounded-xl border border-zinc-700/80 bg-zinc-800 text-zinc-100 font-bold"
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${
              status === 'active'
                ? 'bg-emerald-500'
                : status === 'expiring'
                ? 'bg-orange-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
        </div>

        {/* Member Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-bold text-zinc-100 truncate">{member.fullName}</h4>
            <span className="text-[10px] font-mono text-zinc-400">#{member.id}</span>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-300 bg-zinc-800/90 border border-zinc-700/60 px-2 py-0.5 rounded-md">
              {member.planName}
            </span>

            {/* Localized Status Badges */}
            {status === 'unpaid' ? (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-bold">
                {t.unpaid} ({member.amountDue || 250} {t.currency})
              </Badge>
            ) : status === 'expiring' ? (
              <Badge variant="orange" className="text-[10px] px-2 py-0.5 font-bold">
                {t.filterExpiring} ({daysRemaining}{t.daysRemaining})
              </Badge>
            ) : status === 'expired' ? (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-bold">
                {t.filterExpired}
              </Badge>
            ) : (
              <Badge variant="green" className="text-[10px] px-2 py-0.5 font-bold">
                {t.paid}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Pointage / Check-in */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onCheckIn(member);
            }}
            className="h-8 px-3 text-xs font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20"
          >
            {t.pointage}
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>
      </div>

      {/* Expanded Actions with 1-Click Calling, WhatsApp, SMS */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
            <div>
              <span className="text-[10px] text-zinc-400 block font-medium">{t.phone}</span>
              <a
                href={telUrl}
                onClick={(e) => e.stopPropagation()}
                className="text-orange-400 font-bold hover:underline flex items-center gap-1 mt-0.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{member.phone}</span>
              </a>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block font-medium">{t.expiries}</span>
              <span className="text-zinc-100 font-bold block mt-0.5 font-mono">{member.expiryDate}</span>
            </div>
          </div>

          {member.notes && (
            <p className="text-[11px] text-zinc-300 italic bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
              "{member.notes}"
            </p>
          )}

          {/* Direct 1-Click Action Triggers: Call, WhatsApp, SMS, Renew */}
          <div className="grid grid-cols-4 gap-1.5">
            {/* 1. Native Direct Call */}
            <a
              href={telUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-100 text-[11px] font-bold border border-zinc-700 transition-colors active:scale-95 shadow-sm"
              title={t.call}
            >
              <Phone className="w-4 h-4 text-orange-400 mb-0.5" />
              <span>{t.call}</span>
            </a>

            {/* 2. Direct WhatsApp with Localized Template */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 transition-colors active:scale-95 shadow-sm"
              title={t.whatsapp}
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 mb-0.5" />
              <span>{t.whatsapp}</span>
            </a>

            {/* 3. Direct SMS Fallback */}
            <a
              href={smsUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-[11px] font-bold border border-zinc-700 transition-colors active:scale-95 shadow-sm"
              title={t.sms}
            >
              <MessageSquare className="w-4 h-4 text-blue-400 mb-0.5" />
              <span>{t.sms}</span>
            </a>

            {/* 4. Renew Subscription */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRenew(member);
              }}
              className="flex flex-col items-center justify-center py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold shadow-md transition-colors active:scale-95"
              title={t.renew}
            >
              <RefreshCw className="w-4 h-4 text-white mb-0.5" />
              <span>{t.renew}</span>
            </button>
          </div>

          {/* Toggle Payment Status */}
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePaymentStatus(member);
            }}
            className="w-full h-8 text-xs font-semibold text-zinc-200 border-zinc-750 hover:bg-zinc-800"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
            {member.isPaid ? t.markUnpaid : t.markPaid}
          </Button>

          {/* Delete Member Button */}
          {onDeleteMember && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(t.confirmDeleteMember || 'Supprimer ce membre ?')) {
                  onDeleteMember(member);
                }
              }}
              className="w-full py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-98"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.deleteMember}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
