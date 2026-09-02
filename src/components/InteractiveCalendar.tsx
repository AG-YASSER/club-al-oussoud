import React, { useState, useMemo } from 'react';
import { Member, MembershipPlan, getSubscriptionStatus } from '../db/db';
import { Card, Badge, Button, Sheet } from './ui/shadcn';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Phone,
  MessageCircle,
  Banknote,
  RefreshCw
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns';
import { fr, ar, enUS } from 'date-fns/locale';
import { SupportedLanguage, translations, getWhatsAppReminder } from '../utils/i18n';

interface InteractiveCalendarProps {
  members: Member[];
  plans: MembershipPlan[];
  onRenew: (member: Member) => void;
  onTogglePayment: (member: Member) => void;
  lang: SupportedLanguage;
}

type CalendarFilterMode = 'all' | 'expiring' | 'unpaid';

export function InteractiveCalendar({
  members,
  plans,
  onRenew,
  onTogglePayment,
  lang
}: InteractiveCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDaySheetOpen, setIsDaySheetOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<CalendarFilterMode>('all');
  const t = translations[lang] || translations.fr;

  const dateLocale = lang === 'ar' ? ar : lang === 'en' ? enUS : fr;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const expiriesByDate = useMemo(() => {
    return members.reduce((acc, m) => {
      if (filterMode === 'unpaid' && m.isPaid) return acc;
      if (filterMode === 'expiring' && !m.isPaid) return acc;

      if (!acc[m.expiryDate]) {
        acc[m.expiryDate] = [];
      }
      acc[m.expiryDate].push(m);
      return acc;
    }, {} as Record<string, Member[]>);
  }, [members, filterMode]);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayMembers = expiriesByDate[selectedDateStr] || [];

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsDaySheetOpen(true);
  };

  const cleanPhone = (rawPhone: string) => {
    let p = rawPhone ? rawPhone.replace(/\D/g, '') : '';
    if (p.startsWith('0')) p = '212' + p.substring(1);
    return p;
  };

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800/80 bg-zinc-900/60 p-4">
        {/* Month Navigation & Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-zinc-100 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="h-7 w-7"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-300" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentMonth(new Date())}
              className="h-7 px-2 text-xs font-medium text-orange-400"
            >
              {t.today}
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="h-7 w-7"
            >
              <ChevronRight className="w-4 h-4 text-zinc-300" />
            </Button>
          </div>
        </div>

        {/* Filter Toggle Pill Buttons */}
        <div className="flex bg-zinc-950/60 border border-zinc-800 rounded-lg p-1 gap-1 mb-3">
          {[
            { id: 'all', label: t.allReminders },
            { id: 'expiring', label: t.expiries },
            { id: 'unpaid', label: t.unpaidFilter }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterMode(item.id as CalendarFilterMode)}
              className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
                filterMode === item.id
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Weekdays */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {(lang === 'ar'
            ? ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد']
            : ['L', 'M', 'M', 'J', 'V', 'S', 'D']
          ).map((d, i) => (
            <span key={i} className="text-[11px] font-medium text-zinc-500 py-1">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayExpiries = expiriesByDate[dateStr] || [];
            const hasExpiries = dayExpiries.length > 0;
            const hasUnpaid = dayExpiries.some((m) => !m.isPaid);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentToday = isToday(day);

            return (
              <button
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`h-10 rounded-lg flex flex-col items-center justify-center relative transition-colors ${
                  !isCurrentMonth
                    ? 'text-zinc-600 opacity-30'
                    : isSelected
                    ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30'
                    : isCurrentToday
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <span className="text-xs font-mono">{format(day, 'd')}</span>

                {/* Status indicator dots */}
                {hasExpiries && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      hasUnpaid ? 'bg-red-500 ring-2 ring-red-500/20' : 'bg-orange-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Subtle Legend */}
        <div className="flex items-center justify-center gap-4 pt-3 mt-3 border-t border-zinc-800/80 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>{t.expiries}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{t.unpaidFilter}</span>
          </div>
        </div>
      </Card>

      {/* Day Inspection Sheet with Direct Call & WhatsApp Triggers */}
      <Sheet
        isOpen={isDaySheetOpen}
        onClose={() => setIsDaySheetOpen(false)}
        title={format(selectedDate, 'dd MMMM yyyy', { locale: dateLocale })}
        description={`${dayMembers.length} ${t.concernedMembers}`}
      >
        <div className="space-y-2.5 py-2">
          {dayMembers.length > 0 ? (
            dayMembers.map((member) => {
              const { status, daysRemaining } = getSubscriptionStatus(member);
              const formattedPhone = cleanPhone(member.phone);
              const reminderMsg = typeof t?.whatsappReminderTemplate === 'function'
                ? t.whatsappReminderTemplate(member.fullName, member.planName, daysRemaining, !member.isPaid)
                : getWhatsAppReminder(lang, member.fullName, member.planName, daysRemaining, !member.isPaid);
              const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(reminderMsg)}`;
              const telUrl = `tel:+${formattedPhone}`;

              return (
                <div
                  key={member.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-zinc-100 text-sm">{member.fullName}</h4>
                      <p className="text-zinc-400 text-[11px]">{member.planName} • {member.phone}</p>
                    </div>

                    <Badge variant={!member.isPaid ? 'destructive' : 'orange'}>
                      {!member.isPaid ? `${t.unpaid}` : `${daysRemaining}${t.daysRemaining}`}
                    </Badge>
                  </div>

                  {/* 1-Click Action Triggers: Call, WhatsApp, Renew */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-zinc-800">
                    <a
                      href={telUrl}
                      className="h-8 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-orange-400 flex items-center justify-center gap-1 font-semibold text-xs border border-zinc-700/60"
                      title={t.call}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{t.call}</span>
                    </a>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center gap-1 font-semibold text-xs border border-emerald-500/20"
                      title={t.whatsapp}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{t.whatsapp}</span>
                    </a>

                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        onRenew(member);
                        setIsDaySheetOpen(false);
                      }}
                      className="h-8 text-xs font-semibold gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{t.renew}</span>
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-zinc-500 text-xs">
              {t.noMembersExpiringDate}
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
