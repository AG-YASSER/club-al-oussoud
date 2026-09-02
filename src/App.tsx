import React, { useState, useEffect } from 'react';
import {
  db,
  Member,
  MembershipPlan,
  CheckIn,
  PaymentRecord,
  getSubscriptionStatus
} from './db/db';
import { seedDatabaseIfEmpty } from './db/seedData';
import { syncEngine } from './db/syncEngine';
import { soundEngine } from './utils/soundEngine';
import { defaultTheme } from './config/theme';
import { LionLogo } from './components/LionLogo';
import { MemberCard } from './components/MemberCard';
import { MobileMemberModal } from './components/MobileMemberModal';
import { MobileRenewalModal } from './components/MobileRenewalModal';
import { InteractiveCalendar } from './components/InteractiveCalendar';
import { FinanceScreen } from './components/FinanceScreen';
import { SettingsTab } from './components/SettingsTab';
import { SplashScreen } from './components/SplashScreen';
import { Button, Input, Card, Badge, Sheet } from './components/ui/shadcn';
import { translations, SupportedLanguage } from './utils/i18n';
import { checkAndNotifyExpiringMembers, requestNotificationPermission } from './utils/notifications';
import {
  Search,
  Plus,
  Users,
  PieChart,
  Calendar as CalendarIcon,
  Settings,
  SlidersHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';

export type FilterType = 'all' | 'unpaid' | 'expiring' | 'expired' | 'active';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'finance' | 'calendar' | 'settings'>('members');
  const [lang, setLang] = useState<SupportedLanguage>('fr');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Core Data
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [renewingMember, setRenewingMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'expired' } | null>(null);

  const t = translations[lang] || translations.fr;
  const isRTL = lang === 'ar';

  const refreshData = async () => {
    try {
      const [mList, pList, cList, payList] = await Promise.all([
        db.members.orderBy('updatedAt').reverse().toArray(),
        db.plans.toArray(),
        db.checkIns.orderBy('timestamp').reverse().toArray(),
        db.payments.orderBy('timestamp').reverse().toArray()
      ]);
      setMembers(mList);
      setPlans(pList);
      setCheckIns(cList);
      setPayments(payList);

      // Trigger native notification checks for memberships expiring soon
      if (notificationsEnabled) {
        checkAndNotifyExpiringMembers(mList);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Persist language
  const handleSetLang = async (newLang: SupportedLanguage) => {
    setLang(newLang);
    localStorage.setItem('al_oussoud_lang', newLang);
    await db.settings.put({ key: 'lang', value: newLang });
  };

  // Persist notification preference
  const handleSetNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    localStorage.setItem('al_oussoud_notifications', JSON.stringify(enabled));
    await db.settings.put({ key: 'notifications', value: enabled });
  };

  useEffect(() => {
    const init = async () => {
      // 1. Load saved settings from localStorage / IndexedDB
      const savedLang = localStorage.getItem('al_oussoud_lang') as SupportedLanguage;
      if (savedLang && (savedLang === 'fr' || savedLang === 'ar' || savedLang === 'en')) {
        setLang(savedLang);
      } else {
        const dbLang = await db.settings.get('lang');
        if (dbLang?.value) setLang(dbLang.value);
      }

      const savedNotifs = localStorage.getItem('al_oussoud_notifications');
      if (savedNotifs !== null) {
        setNotificationsEnabled(JSON.parse(savedNotifs));
      } else {
        const dbNotifs = await db.settings.get('notifications');
        if (dbNotifs?.value !== undefined) setNotificationsEnabled(dbNotifs.value);
      }

      await seedDatabaseIfEmpty();
      await refreshData();
      setIsLoading(false);

      // Ask for native notification permission on initial launch
      await requestNotificationPermission();
    };
    init();
  }, []);

  // Quick Check-In
  const handleCheckIn = async (member: Member) => {
    const { status, daysRemaining } = getSubscriptionStatus(member);
    const now = new Date();
    const timeStr = format(now, 'HH:mm');
    const dateStr = format(now, 'yyyy-MM-dd');

    if (status === 'active') {
      soundEngine.playSuccess();
      setToastMessage({ text: `${t.quickCheckInSuccess} (${member.fullName})`, type: 'success' });
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    } else if (status === 'expiring') {
      soundEngine.playWarning();
      setToastMessage({ text: `${t.quickCheckInExpiring} (${daysRemaining}${t.daysRemaining})`, type: 'warning' });
    } else if (status === 'unpaid') {
      soundEngine.playWarning();
      setToastMessage({ text: t.quickCheckInUnpaid, type: 'warning' });
    } else {
      soundEngine.playExpiredAlert();
      setToastMessage({ text: `${t.quickCheckInExpired} (${member.fullName})`, type: 'expired' });
    }

    const checkInRecord: CheckIn = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      memberId: member.id,
      memberName: member.fullName,
      memberAvatar: member.avatarWebP,
      planName: member.planName,
      statusAtCheckIn: status,
      timestamp: Date.now(),
      dateStr,
      timeStr
    };

    await db.checkIns.add(checkInRecord);
    await syncEngine.enqueue('CHECK_IN', checkInRecord);
    await refreshData();

    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle Payment
  const handleTogglePayment = async (member: Member) => {
    const updated: Member = {
      ...member,
      isPaid: !member.isPaid,
      amountDue: !member.isPaid ? 0 : 250,
      updatedAt: Date.now()
    };
    await db.members.put(updated);
    await syncEngine.enqueue('UPDATE_MEMBER', updated);
    await refreshData();
  };

  // Delete Member Permanently
  const handleDeleteMember = async (member: Member) => {
    try {
      await db.members.delete(member.id);
      await refreshData();
      setToastMessage({ text: `${member.fullName} a été supprimé.`, type: 'warning' });
    } catch (err) {
      console.error(err);
    }
  };

  // Status counters
  const counts = members.reduce(
    (acc, m) => {
      const { status } = getSubscriptionStatus(m);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { all: members.length, unpaid: 0, expiring: 0, expired: 0, active: 0 } as Record<string, number>
  );

  const getActiveFilterLabel = () => {
    switch (filter) {
      case 'unpaid': return t.filterUnpaid;
      case 'expiring': return t.filterExpiring;
      case 'expired': return t.filterExpired;
      case 'active': return t.filterActive;
      default: return t.filterAll;
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const { status } = getSubscriptionStatus(m);
    if (filter === 'all') return true;
    return status === filter;
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCheckIns = checkIns.filter((c) => c.dateStr === todayStr);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased selection:bg-orange-500/20 selection:text-orange-400 flex justify-center"
    >
      {/* 1. Animated Splash Screen */}
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      {/* Mobile Shell Responsive Container */}
      <div className="w-full max-w-lg min-h-screen bg-[#09090b] sm:border-x sm:border-zinc-800/80 flex flex-col relative pb-20 shadow-2xl">
        {/* Top Header - Rendered ONLY on Membres Tab */}
        {activeTab === 'members' ? (
          <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 space-y-3">
            {/* Minimalistic Brand Bar + Language Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <LionLogo size={44} primaryColor={defaultTheme.colors.primary} />
                <div>
                  <h1 className="text-base font-black tracking-tight text-zinc-100 flex items-center gap-1 leading-none">
                    CLUB <span className="text-orange-500">AL OUSSOUD</span>
                  </h1>
                  <p className="text-[10px] text-zinc-400 font-medium mt-1">
                    {t.brandSubtitle}
                  </p>
                </div>
              </div>

              {/* Language Toggle Pill Badge */}
              <button
                onClick={() => {
                  const nextLang: SupportedLanguage = lang === 'fr' ? 'ar' : lang === 'ar' ? 'en' : 'fr';
                  handleSetLang(nextLang);
                }}
              >
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-orange-400 border-zinc-800 hover:border-orange-500/40">
                  {lang}
                </Badge>
              </button>
            </div>

            {/* Search Bar + Filter Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-7 h-9 text-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Button opening shadcn Sheet */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterSheetOpen(true)}
                className={`h-9 px-2.5 text-xs gap-1.5 shrink-0 ${
                  filter !== 'all' ? 'border-orange-500 text-orange-400 bg-orange-500/10' : ''
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="max-w-[85px] truncate">{getActiveFilterLabel()}</span>
              </Button>
            </div>
          </header>
        ) : (
          /* Clean Sub-Screen Header for other tabs */
          <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100 tracking-tight">
              {activeTab === 'finance'
                ? t.tabFinance
                : activeTab === 'calendar'
                ? t.tabCalendar
                : t.tabSettings}
            </h2>

            <button
              onClick={() => {
                const nextLang: SupportedLanguage = lang === 'fr' ? 'ar' : lang === 'ar' ? 'en' : 'fr';
                handleSetLang(nextLang);
              }}
            >
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-orange-400 border-zinc-800">
                {lang}
              </Badge>
            </button>
          </header>
        )}

        {/* Real-time Toast */}
        {toastMessage && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in duration-200 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : toastMessage.type === 'warning'
                ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="text-zinc-400 hover:text-zinc-100">✕</button>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 p-4 space-y-4">
          {/* SCREEN 1: MEMBRES */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              {/* 3 Clean Stat Badges / Cards */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="bg-zinc-900/50 border border-zinc-800/80 p-2.5 text-center">
                  <span className="text-[10px] text-zinc-400 font-medium block truncate">
                    {t.statsEntries}
                  </span>
                  <span className="text-base font-bold text-zinc-100 font-mono mt-0.5 block">
                    {todayCheckIns.length}
                  </span>
                </Card>

                <Card className="bg-zinc-900/50 border border-zinc-800/80 p-2.5 text-center">
                  <span className="text-[10px] text-orange-400 font-medium block truncate">
                    {t.statsRenew}
                  </span>
                  <span className="text-base font-bold text-orange-400 font-mono mt-0.5 block">
                    {(counts.expiring || 0) + (counts.expired || 0)}
                  </span>
                </Card>

                <Card className="bg-zinc-900/50 border border-zinc-800/80 p-2.5 text-center">
                  <span className="text-[10px] text-red-400 font-medium block truncate">
                    {t.statsUnpaid}
                  </span>
                  <span className="text-base font-bold text-red-400 font-mono mt-0.5 block">
                    {counts.unpaid || 0}
                  </span>
                </Card>
              </div>

              {/* Members Stream */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {t.membersCount} ({filteredMembers.length})
                  </span>
                  <span className="text-[11px] text-orange-400 font-medium">{t.tapForDetails}</span>
                </div>

                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      plans={plans}
                      onCheckIn={handleCheckIn}
                      onRenew={(m) => setRenewingMember(m)}
                      onTogglePaymentStatus={handleTogglePayment}
                      onDeleteMember={handleDeleteMember}
                      lang={lang}
                    />
                  ))
                ) : (
                  <div className="text-center py-16 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-500 text-xs">
                    {t.noMembersFound}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCREEN 2: FINANCE & STATS */}
          {activeTab === 'finance' && (
            <FinanceScreen
              payments={payments}
              members={members}
              todayVisitsCount={todayCheckIns.length}
              onTogglePayment={handleTogglePayment}
              lang={lang}
            />
          )}

          {/* SCREEN 3: CALENDRIER */}
          {activeTab === 'calendar' && (
            <InteractiveCalendar
              members={members}
              plans={plans}
              onRenew={(m) => setRenewingMember(m)}
              onTogglePayment={handleTogglePayment}
              lang={lang}
            />
          )}

          {/* SCREEN 4: RÉGLAGES */}
          {activeTab === 'settings' && (
            <SettingsTab
              plans={plans}
              onPlansUpdated={refreshData}
              lang={lang}
              onLanguageChange={handleSetLang}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={handleSetNotifications}
            />
          )}
        </main>

        {/* Floating Action Button */}
        {activeTab === 'members' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="fixed bottom-20 right-4 sm:right-[calc(50%-15rem)] z-40 w-13 h-13 rounded-full shadow-xl flex items-center justify-center text-white font-black bg-orange-500 hover:bg-orange-600 transition-transform active:scale-95 hover:scale-105"
            title={t.addNewMember}
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        )}

        {/* 4 Distinct Bottom Navigation Tabs */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 py-2.5 px-4 flex justify-around max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
              activeTab === 'members' ? 'text-orange-500 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="truncate">{t.tabMembers}</span>
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
              activeTab === 'finance' ? 'text-orange-500 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span className="truncate">{t.tabFinance}</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
              activeTab === 'calendar' ? 'text-orange-500 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span className="truncate">{t.tabCalendar}</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
              activeTab === 'settings' ? 'text-orange-500 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="truncate">{t.tabSettings}</span>
          </button>
        </nav>

        {/* Filter Sheet */}
        <Sheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          title={t.selectFilter}
          description={t.selectFilter}
        >
          <div className="space-y-2 py-2">
            {[
              { key: 'all' as FilterType, label: t.filterAll, count: counts.all },
              { key: 'unpaid' as FilterType, label: t.filterUnpaid, count: counts.unpaid },
              { key: 'expiring' as FilterType, label: t.filterExpiring, count: counts.expiring },
              { key: 'expired' as FilterType, label: t.filterExpired, count: counts.expired },
              { key: 'active' as FilterType, label: t.filterActive, count: counts.active }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setFilter(item.key);
                  setIsFilterSheetOpen(false);
                }}
                className={`w-full p-3 rounded-xl border text-left text-xs flex items-center justify-between transition-colors ${
                  filter === item.key
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 font-semibold'
                    : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-750'
                }`}
              >
                <span>{item.label}</span>
                <Badge variant={filter === item.key ? 'orange' : 'secondary'} className="font-mono text-[10px]">
                  {item.count}
                </Badge>
              </button>
            ))}
          </div>
        </Sheet>

        {/* Add Member Modal */}
        <MobileMemberModal
          plans={plans}
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onMemberCreated={() => {
            refreshData();
            setToastMessage({ text: 'Nouveau membre enregistré avec succès!', type: 'success' });
          }}
          lang={lang}
        />

        {/* Renewal Modal */}
        {renewingMember && (
          <MobileRenewalModal
            member={renewingMember}
            plans={plans}
            isOpen={!!renewingMember}
            onClose={() => setRenewingMember(null)}
            onRenewSuccess={() => {
              refreshData();
              setToastMessage({ text: 'Abonnement prolongé avec succès!', type: 'success' });
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
