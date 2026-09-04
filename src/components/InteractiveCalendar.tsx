import React, { useState, useMemo, useEffect } from 'react';
import { Member, MembershipPlan, db } from '../db/db';
import { Card, Badge, Button } from './ui/shadcn';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  RefreshCw,
  Banknote
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
import { ar, fr, enUS } from 'date-fns/locale';
import { SupportedLanguage, getWhatsAppReminder } from '../utils/i18n';

interface InteractiveCalendarProps {
  members: Member[];
  plans?: MembershipPlan[];
  onRenew: (member: Member) => void;
  onSettleDebt: (member: Member) => void;
  onBlockedRenewal?: (member: Member) => void;
  lang?: SupportedLanguage;
}

/**
 * Normalizes any Date or date string to strict YYYY-MM-DD
 * Eliminates all timezone offset shifts between UTC and local time!
 */
export function normalizeDateKey(dateInput: Date | string | undefined | null): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function cleanPhone(phoneStr: string): string {
  const digits = phoneStr ? phoneStr.replace(/\D/g, '') : '';
  if (digits.startsWith('0')) return '212' + digits.substring(1);
  if (digits.startsWith('212')) return digits;
  return '212' + digits;
}

export function InteractiveCalendar({
  members,
  onRenew,
  onSettleDebt,
  lang = 'ar'
}: InteractiveCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterMode, setFilterMode] = useState<'all' | 'expiring' | 'debts'>('all');
  const [liveDbMembers, setLiveDbMembers] = useState<Member[]>([]);

  const isRTL = lang === 'ar';

  const dateLocale = useMemo(() => {
    switch (lang) {
      case 'ar':
        return ar;
      case 'en':
        return enUS;
      default:
        return fr;
    }
  }, [lang]);

  // Merge prop members with fallback to direct IndexedDB query for absolute real-time sync
  useEffect(() => {
    let isMounted = true;
    const fetchDbMembers = async () => {
      try {
        const list = await db.members.filter((m) => !m.isDeleted).toArray();
        if (isMounted && list.length > 0) {
          setLiveDbMembers(list);
        }
      } catch (err) {
        console.error('Failed to query members for calendar:', err);
      }
    };
    fetchDbMembers();
    return () => {
      isMounted = false;
    };
  }, [members]);

  const activeMembers = useMemo(() => {
    const source = members && members.length > 0 ? members : liveDbMembers;
    return source.filter((m) => !m.isDeleted);
  }, [members, liveDbMembers]);

  /**
   * Calendar Agenda Data Structure:
   * Maps each date string (YYYY-MM-DD) to expiring members and debt members.
   * - Expiring: member.expiryDate === dateKey
   * - Debts: (amountDue > 0 || !isPaid) AND (member.startDate === dateKey || member.expiryDate === dateKey)
   */
  const agendaByDate = useMemo(() => {
    const map: Record<
      string,
      {
        expiring: Member[];
        debts: Member[];
        all: Member[];
      }
    > = {};

    const getEntry = (key: string) => {
      if (!map[key]) {
        map[key] = { expiring: [], debts: [], all: [] };
      }
      return map[key];
    };

    activeMembers.forEach((member) => {
      const hasDebt = (member.amountDue || 0) > 0 || !member.isPaid;
      const expiryKey = normalizeDateKey(member.expiryDate);
      const startKey = normalizeDateKey(member.startDate);

      // 1. Subscription Expiration: Map to expiryDate
      if (expiryKey) {
        const entry = getEntry(expiryKey);
        if (!hasDebt) {
          entry.expiring.push(member);
        }
        if (!entry.all.some((m) => m.id === member.id)) {
          entry.all.push(member);
        }
      }

      // 2. Unpaid Debt: Map to startDate (date debt was recorded) and expiryDate
      if (hasDebt) {
        if (startKey) {
          const startEntry = getEntry(startKey);
          if (!startEntry.debts.some((m) => m.id === member.id)) {
            startEntry.debts.push(member);
          }
          if (!startEntry.all.some((m) => m.id === member.id)) {
            startEntry.all.push(member);
          }
        }
        if (expiryKey && expiryKey !== startKey) {
          const expiryEntry = getEntry(expiryKey);
          if (!expiryEntry.debts.some((m) => m.id === member.id)) {
            expiryEntry.debts.push(member);
          }
          if (!expiryEntry.all.some((m) => m.id === member.id)) {
            expiryEntry.all.push(member);
          }
        }
      }
    });

    return map;
  }, [activeMembers]);

  // Calendar dates computation for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedDateStr = normalizeDateKey(selectedDate);
  const todayStr = normalizeDateKey(new Date());

  // Filtered members for the currently selected date
  const dayMembers = useMemo(() => {
    const entry = agendaByDate[selectedDateStr];
    if (!entry) return [];

    if (filterMode === 'expiring') {
      return entry.expiring;
    }
    if (filterMode === 'debts') {
      return entry.debts;
    }
    return entry.all;
  }, [agendaByDate, selectedDateStr, filterMode]);

  // Metric counts for the current month
  const monthlyExpiringCount = useMemo(() => {
    return activeMembers.filter((m) => {
      const expKey = normalizeDateKey(m.expiryDate);
      if (!expKey) return false;
      const isPaidMember = m.isPaid && (m.amountDue || 0) === 0;
      const currentMonthPrefix = format(currentMonth, 'yyyy-MM');
      return isPaidMember && expKey.startsWith(currentMonthPrefix);
    }).length;
  }, [activeMembers, currentMonth]);

  const monthlyDebtsCount = useMemo(() => {
    return activeMembers.filter((m) => (m.amountDue || 0) > 0 || !m.isPaid).length;
  }, [activeMembers]);

  const todayEventsCount = useMemo(() => {
    return agendaByDate[todayStr]?.all.length || 0;
  }, [agendaByDate, todayStr]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  // Localized texts
  const tTexts = {
    monthExpirations:
      lang === 'ar' ? 'انتهاء الشهر' : lang === 'en' ? 'Month Expirations' : 'Expirations du mois',
    pendingDebts:
      lang === 'ar' ? 'ديون معلقة' : lang === 'en' ? 'Pending Debts' : 'Dettes impayées',
    todayEvents:
      lang === 'ar' ? 'أحداث اليوم' : lang === 'en' ? "Today's Events" : "Aujourd'hui",
    legendExpiry:
      lang === 'ar' ? 'انتهاء اشتراك' : lang === 'en' ? 'Subscription Expiry' : 'Fin abonnement',
    legendDebt:
      lang === 'ar' ? 'دين غير مسدد' : lang === 'en' ? 'Pending Debt' : 'Dette impayée',
    membersCount:
      lang === 'ar' ? 'مشتركين' : lang === 'en' ? 'members' : 'membres',
    filterAll:
      lang === 'ar' ? 'الكل' : lang === 'en' ? 'All' : 'Tous',
    filterExpiring:
      lang === 'ar' ? 'الاشتراكات' : lang === 'en' ? 'Expirations' : 'Expirations',
    filterDebts:
      lang === 'ar' ? 'الديون' : lang === 'en' ? 'Debts' : 'Dettes',
    callBtn:
      lang === 'ar' ? 'اتصال' : lang === 'en' ? 'Call' : 'Appel',
    waBtn:
      lang === 'ar' ? 'واتساب' : lang === 'en' ? 'WhatsApp' : 'WhatsApp',
    settleBtn:
      lang === 'ar' ? 'استخلاص' : lang === 'en' ? 'Settle' : 'Encaisser',
    renewBtn:
      lang === 'ar' ? 'تجديد' : lang === 'en' ? 'Renew' : 'Renouveler',
    debtBadge: (amount: number) =>
      lang === 'ar' ? `دين: ${amount} DH` : lang === 'en' ? `Debt: ${amount} DH` : `Dû: ${amount} DH`,
    expiringBadge:
      lang === 'ar' ? 'انتهاء الاشتراك' : lang === 'en' ? 'Subscription Expiring' : 'Expire aujourd\'hui',
    emptyNotice:
      lang === 'ar'
        ? 'لا توجد أي اشتراكات تنتهي أو ديون مسجلة في هذا اليوم.'
        : lang === 'en'
        ? 'No subscription expirations or pending debts on this day.'
        : 'Aucune échéance ou dette enregistrée pour cette date.'
  };

  return (
    <div className={`space-y-4 pb-8 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* 1. Quick Monthly Metric Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center space-y-1">
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block truncate">
            {tTexts.monthExpirations}
          </span>
          <div className="text-base font-black text-orange-400 font-mono">
            {monthlyExpiringCount}
          </div>
        </Card>

        <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center space-y-1">
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block truncate">
            {tTexts.pendingDebts}
          </span>
          <div className="text-base font-black text-[var(--danger)] font-mono">
            {monthlyDebtsCount}
          </div>
        </Card>

        <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center space-y-1">
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase block truncate">
            {tTexts.todayEvents}
          </span>
          <div className="text-base font-black text-[var(--primary)] font-mono">
            {todayEventsCount}
          </div>
        </Card>
      </div>

      {/* 2. Interactive Monthly Calendar Grid */}
      <Card className="bg-[var(--card)] border border-[var(--border)] p-4 space-y-4 shadow-sm">
        {/* Month Header & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-sm font-black tracking-tight text-[var(--text-primary)] capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-0.5">
            <button
              onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
              className="p-1.5 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-secondary)] transition-all active:scale-90"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setCurrentMonth(now);
                setSelectedDate(now);
              }}
              className="px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-all"
            >
              {tTexts.todayEvents}
            </button>
            <button
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              className="p-1.5 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-secondary)] transition-all active:scale-90"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center border-b border-[var(--border-subtle)] pb-2">
          {(lang === 'ar'
            ? ['إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'أحد']
            : lang === 'en'
            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
          ).map((d, i) => (
            <span key={i} className="text-[10px] font-bold text-[var(--text-muted)] py-1 uppercase">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((day, idx) => {
            const dateStr = normalizeDateKey(day);
            const dayEntry = agendaByDate[dateStr];
            const hasDebts = (dayEntry?.debts.length || 0) > 0;
            const hasExpiring = (dayEntry?.expiring.length || 0) > 0;
            const hasEvents = hasDebts || hasExpiring;

            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonthDay = isSameMonth(day, currentMonth);
            const isCurrentToday = isToday(day);

            return (
              <button
                key={idx}
                type="button"
                data-date={dateStr}
                onClick={() => handleDayClick(day)}
                className={`h-12 rounded-xl flex flex-col items-center justify-center relative transition-all active:scale-95 ${
                  !isCurrentMonthDay
                    ? 'text-[var(--text-muted)] opacity-25'
                    : isSelected
                    ? 'bg-[var(--primary-bg)] text-[var(--primary)] font-black border-2 border-[var(--primary)] shadow-md'
                    : isCurrentToday
                    ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-bold border border-[var(--primary-border)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] border border-transparent'
                }`}
              >
                <span className="text-xs font-mono">{format(day, 'd')}</span>

                {/* Status Indicator Dots */}
                {hasEvents && isCurrentMonthDay && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {hasDebts && (
                      <span
                        title={tTexts.legendDebt}
                        className="w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-red-500/20 animate-pulse"
                      />
                    )}
                    {hasExpiring && (
                      <span
                        title={tTexts.legendExpiry}
                        className="w-1.5 h-1.5 rounded-full bg-orange-500"
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 pt-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>{tTexts.legendExpiry}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{tTexts.legendDebt}</span>
          </div>
        </div>
      </Card>

      {/* 3. Real-Time Members List Filtered by Selected Date (Below Grid) */}
      <Card className="bg-[var(--card)] border border-[var(--border)] p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[var(--primary)]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {format(selectedDate, 'dd MMMM yyyy', { locale: dateLocale })}
            </h4>
          </div>

          <Badge variant="outline" className="text-[10px] font-mono border-[var(--border)] font-bold">
            {dayMembers.length} {tTexts.membersCount}
          </Badge>
        </div>

        {/* Sub-Filter Pills */}
        <div className="flex bg-[var(--surface)] border border-[var(--border)] rounded-xl p-1 gap-1">
          {[
            { id: 'all', label: tTexts.filterAll },
            { id: 'expiring', label: tTexts.filterExpiring },
            { id: 'debts', label: tTexts.filterDebts }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterMode(item.id as any)}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all ${
                filterMode === item.id
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Members Cards List */}
        {dayMembers.length > 0 ? (
          <div className="space-y-2.5 pt-1">
            {dayMembers.map((member) => {
              const hasDebt = (member.amountDue || 0) > 0 || !member.isPaid;
              const formattedPhone = cleanPhone(member.phone);
              const reminderMsg = getWhatsAppReminder(lang, member.fullName, member.planName, 0, hasDebt);
              const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(reminderMsg)}`;
              const telUrl = `tel:+${formattedPhone}`;

              return (
                <div
                  key={member.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2.5 text-xs shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-[var(--text-primary)]">{member.fullName}</div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {member.planName} • {member.phone}
                      </div>
                    </div>

                    {hasDebt ? (
                      <Badge variant="destructive" className="font-mono text-xs font-black">
                        {tTexts.debtBadge(member.amountDue || 0)}
                      </Badge>
                    ) : (
                      <Badge variant="orange" className="font-mono text-xs font-bold">
                        {tTexts.expiringBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Actions: Call, WhatsApp, Settle / Renew */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
                    <a
                      href={telUrl}
                      className="h-8 rounded-lg bg-[var(--surface-hover)] text-[var(--text-primary)] flex items-center justify-center gap-1 font-bold text-xs border border-[var(--border)] active:scale-95"
                    >
                      <Phone className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>{tTexts.callBtn}</span>
                    </a>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 rounded-lg bg-[var(--success-bg)] text-[var(--success)] flex items-center justify-center gap-1 font-bold text-xs border border-[var(--success-border)] active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{tTexts.waBtn}</span>
                    </a>

                    {hasDebt ? (
                      <Button
                        size="sm"
                        onClick={() => onSettleDebt(member)}
                        className="h-8 text-xs font-bold bg-[var(--danger)] hover:opacity-90 text-white"
                      >
                        <Banknote className="w-3.5 h-3.5 mr-1" />
                        <span>{tTexts.settleBtn}</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onRenew(member)}
                        className="h-8 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-foreground)]"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        <span>{tTexts.renewBtn}</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border)] rounded-xl">
            {tTexts.emptyNotice}
          </div>
        )}
      </Card>
    </div>
  );
}
