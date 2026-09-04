import React, { useState, useEffect, useRef } from 'react';
import {
  Member,
  MembershipPlan,
  Payment,
  db,
  getSubscriptionStatus
} from './db/db';
import { seedDatabaseIfEmpty } from './db/seedData';
import { syncEngine } from './db/syncEngine';
import { defaultTheme } from './config/theme';
import { LionLogo } from './components/LionLogo';
import { MemberCard } from './components/MemberCard';
import { MobileMemberModal } from './components/MobileMemberModal';
import { MobileRenewalModal } from './components/MobileRenewalModal';
import { DebtSettlementModal } from './components/DebtSettlementModal';
import { FinanceScreen } from './components/FinanceScreen';
import { InteractiveCalendar } from './components/InteractiveCalendar';
import { SettingsTab } from './components/SettingsTab';
import { SplashScreen } from './components/SplashScreen';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Card, Badge, Sheet } from './components/ui/shadcn';
import {
  Search,
  Filter,
  Plus,
  Users,
  Calendar as CalendarIcon,
  PieChart,
  Settings,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { SupportedLanguage, translations } from './utils/i18n';
import { StatusBar } from '@capacitor/status-bar';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  // 4 Core Tabs: Membres, Calendrier, Finance, Réglages
  const [activeTab, setActiveTab] = useState<'members' | 'calendar' | 'finance' | 'settings'>('members');
  const [lang, setLang] = useState<SupportedLanguage>('fr');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Data state
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [renewingMember, setRenewingMember] = useState<Member | null>(null);
  const [memberForDebtSettlement, setMemberForDebtSettlement] = useState<Member | null>(null);
  const [blockedRenewalMember, setBlockedRenewalMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Toast System (Floating Top Notification - Exactly 3s)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'warning' | 'expired' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'expired' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  const t = translations[lang] || translations.fr;
  const isRTL = lang === 'ar';

  const refreshData = async () => {
    try {
      const [mList, pList, payList] = await Promise.all([
        db.members.orderBy('updatedAt').reverse().toArray(),
        db.plans.toArray(),
        db.payments.orderBy('timestamp').reverse().toArray()
      ]);
      // Filter out soft-deleted members for active reception UI
      setMembers(mList.filter((m) => !m.isDeleted));
      setPlans(pList);
      setPayments(payList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const savedLang = localStorage.getItem('app_lang') as SupportedLanguage;
        if (savedLang) setLang(savedLang);
      } catch (e) {
        console.error(e);
      }

      await seedDatabaseIfEmpty();
      await refreshData();
      setIsLoading(false);

      try {
        await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        await StatusBar.setBackgroundColor({ color: '#09090b' }).catch(() => {});
      } catch (e) {
        // web fallback
      }
    };
    init();
  }, []);

  const handleSetLang = (newLang: SupportedLanguage) => {
    setLang(newLang);
    try {
      localStorage.setItem('app_lang', newLang);
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger Renewal with strict pre-check: Block if debt exists
  const handleRequestRenewal = (member: Member) => {
    const debt = member.amountDue || 0;
    if (debt > 0 || !member.isPaid) {
      setBlockedRenewalMember(member);
      return;
    }
    setRenewingMember(member);
  };

  // Soft Delete + Photo Purging (Storage Optimization & Ledger Integrity)
  const handleDeleteMember = async (member: Member) => {
    setMemberToDelete(member);
  };

  const confirmDeleteMember = async (member: Member) => {
    try {
      // Soft Delete: Mark isDeleted = true and purge photo payload (95% storage saving)
      const softDeletedMember: Member = {
        ...member,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        photo: null, // Purge photo memory immediately
        updatedAt: Date.now()
      };

      await db.members.put(softDeletedMember);
      await syncEngine.enqueue('UPDATE_MEMBER', softDeletedMember);

      await refreshData();
      setMemberToDelete(null);
      showToast(
        lang === 'ar' ? `تمت أرشفة ${member.fullName} وتفريغ المساحة.` : `${member.fullName} a été archivé et sa photo purgée.`,
        'warning'
      );
    } catch (err) {
      console.error(err);
      setMemberToDelete(null);
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

  // Search filter
  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.fullName.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.id.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (filter === 'all') return true;

    const { status } = getSubscriptionStatus(m);
    return status === filter;
  });

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}

      <div className={`min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center select-none ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Mobile Shell Responsive Container */}
        <div className="w-full max-w-lg min-h-screen bg-[#09090b] sm:border-x sm:border-zinc-800/80 flex flex-col relative pb-20 shadow-2xl">
          {/* Top Header - Rendered ONLY on Membres Tab */}
          {activeTab === 'members' ? (
            <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 pt-safe pb-3 space-y-3">
              {/* Minimalistic Brand Bar + Language Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LionLogo size={44} primaryColor={defaultTheme.colors.primary} />
                  <div>
                    <h1 className="text-base font-black tracking-tight text-zinc-100 flex items-center gap-1 leading-none">
                      CLUB <span className="text-orange-500">AL OUSSOUD</span>
                    </h1>
                    <p className="text-[10px] text-zinc-400 font-medium mt-1">
                      {lang === 'ar' ? 'إدارة النادي والاستخلاص النقدي' : t.brandSubtitle}
                    </p>
                  </div>
                </div>

                
              </div>

              {/* Search Bar + Filter Trigger */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={lang === 'ar' ? 'بحث بالاسم أو الهاتف...' : t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 rtl:pl-3 rtl:pr-9 pr-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/80 transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsFilterSheetOpen(true)}
                  className={`h-10 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                    filter !== 'all'
                      ? 'border-orange-500/80 bg-orange-500/10 text-orange-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-850'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {filter === 'all'
                      ? (lang === 'ar' ? 'الكل' : t.filterAll)
                      : filter === 'unpaid'
                      ? (lang === 'ar' ? 'الديون' : t.filterUnpaid)
                      : filter === 'expiring'
                      ? (lang === 'ar' ? 'تنتهي قريباً' : t.filterExpiring)
                      : (lang === 'ar' ? 'منتهية' : t.filterExpired)}
                  </span>
                </button>
              </div>
            </header>
          ) : (
            /* Clean Sub-Screen Header for other tabs */
            <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 pt-safe pb-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-100 tracking-tight">
                {activeTab === 'calendar'
                  ? (lang === 'ar' ? 'التقويم ومواعيد الانتهاء' : lang === 'en' ? 'Calendar & Expirations' : 'Calendrier & Échéances')
                  : activeTab === 'finance'
                  ? (lang === 'ar' ? 'المالية والمقبوضات' : t.tabFinance)
                  : (lang === 'ar' ? 'الإعدادات والنسخ' : t.tabSettings)}
              </h2>

              
            </header>
          )}

          {/* Floating Toast / Tooltip Outside Layout (High Visibility, Top Z-Index, 3s Auto-dismiss) */}
          {toastMessage && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-sm pointer-events-auto transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-5">
              <div
                className={`px-4 py-3 rounded-2xl border flex items-center justify-between shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl ${
                  toastMessage.type === 'success'
                    ? 'bg-zinc-950/95 border-emerald-500/50 text-emerald-300 shadow-emerald-950/40'
                    : toastMessage.type === 'warning'
                    ? 'bg-zinc-950/95 border-orange-500/50 text-orange-300 shadow-orange-950/40'
                    : 'bg-zinc-950/95 border-red-500/50 text-red-300 shadow-red-950/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 animate-ping ${
                      toastMessage.type === 'success'
                        ? 'bg-emerald-400'
                        : toastMessage.type === 'warning'
                        ? 'bg-orange-400'
                        : 'bg-red-400'
                    }`}
                  />
                  <span className="text-xs font-bold tracking-tight truncate leading-none text-zinc-100">
                    {toastMessage.text}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                    setToastMessage(null);
                  }}
                  aria-label="Fermer notification"
                  className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-zinc-800/80 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
                      {lang === 'ar' ? 'كل الأعضاء' : t.filterAll}
                    </span>
                    <span className="text-base font-bold text-zinc-100 font-mono mt-0.5 block">
                      {counts.all}
                    </span>
                  </Card>

                  <Card className="bg-zinc-900/50 border border-zinc-800/80 p-2.5 text-center">
                    <span className="text-[10px] text-orange-400 font-medium block truncate">
                      {lang === 'ar' ? 'تنتهي قريباً (7j)' : `${t.filterExpiring} (7j)`}
                    </span>
                    <span className="text-base font-bold text-orange-400 font-mono mt-0.5 block">
                      {counts.expiring}
                    </span>
                  </Card>

                  <Card className="bg-zinc-900/50 border border-zinc-800/80 p-2.5 text-center">
                    <span className="text-[10px] text-red-400 font-medium block truncate">
                      {lang === 'ar' ? 'الديون' : t.filterUnpaid}
                    </span>
                    <span className="text-base font-bold text-red-400 font-mono mt-0.5 block">
                      {counts.unpaid}
                    </span>
                  </Card>
                </div>

                {/* Section Header with Count */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {lang === 'ar' ? 'لائحة المشتركين' : t.tabMembers} ({filteredMembers.length})
                  </span>
                  <span className="text-[11px] text-orange-400 font-medium">
                    {lang === 'ar' ? 'اضغط للتفاصيل' : t.tapForDetails}
                  </span>
                </div>

                {/* Members List */}
                <div className="space-y-2.5">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        plans={plans}
                        onRenew={handleRequestRenewal}
                        onSettleDebt={(m) => setMemberForDebtSettlement(m)}
                        onBlockedRenewal={(m) => setBlockedRenewalMember(m)}
                        onDeleteMember={handleDeleteMember}
                        onEditMember={(m) => {
                          setEditingMember(m);
                          setShowAddModal(true);
                        }}
                        lang={lang}
                      />
                    ))
                  ) : (
                    <div className="text-center py-16 rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-500 text-xs">
                      {lang === 'ar' ? 'لم يتم العثور على أي مشترك.' : t.noMembersFound}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SCREEN 2: CALENDRIER & AGENDA (100% REAL-TIME & REACTIVE) */}
            {activeTab === 'calendar' && (
              <InteractiveCalendar
                members={members}
                plans={plans}
                onRenew={handleRequestRenewal}
                onSettleDebt={(m) => setMemberForDebtSettlement(m)}
                onBlockedRenewal={(m) => setBlockedRenewalMember(m)}
                lang={lang}
              />
            )}

            {/* SCREEN 3: FINANCE & STATS */}
            {activeTab === 'finance' && (
              <FinanceScreen
                payments={payments}
                members={members}
                onTogglePayment={(m) => setMemberForDebtSettlement(m)}
                onSettleDebt={(m) => setMemberForDebtSettlement(m)}
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
                onToggleNotifications={setNotificationsEnabled}
                onShowToast={showToast}
              />
            )}
          </main>

          {/* Floating Action Button for Adding Members (Personal Info only) */}
          {activeTab === 'members' && (
            <button
              onClick={() => {
                setEditingMember(null);
                setShowAddModal(true);
              }}
              className="fixed bottom-20 right-4 sm:right-[calc(50%-15rem)] z-40 w-13 h-13 rounded-full shadow-xl flex items-center justify-center text-white font-black bg-orange-500 hover:bg-orange-600 transition-transform active:scale-95 hover:scale-105"
              title={lang === 'ar' ? 'إضافة عضو جديد' : t.addNewMember}
            >
              <Plus className="w-6 h-6" />
            </button>
          )}

          {/* 4 Core Bottom Navigation Tabs: Membres, Calendrier, Finance, Réglages */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 py-2.5 px-3 flex justify-around max-w-lg mx-auto">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
                activeTab === 'members' ? 'text-orange-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="truncate">{lang === 'ar' ? 'المشتركون' : lang === 'en' ? 'Members' : t.tabMembers}</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
                activeTab === 'calendar' ? 'text-orange-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span className="truncate">{lang === 'ar' ? 'التقويم' : lang === 'en' ? 'Calendar' : 'Calendrier'}</span>
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
                activeTab === 'finance' ? 'text-orange-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span className="truncate">{lang === 'ar' ? 'المالية' : lang === 'en' ? 'Finance' : t.tabFinance}</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition flex-1 ${
                activeTab === 'settings' ? 'text-orange-500 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="truncate">{lang === 'ar' ? 'الإعدادات' : lang === 'en' ? 'Settings' : t.tabSettings}</span>
            </button>
          </nav>

          {/* Filter Bottom Sheet */}
          <Sheet isOpen={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)} title={lang === 'ar' ? 'تصفية حسب الحالة' : t.filterLabel}>
            <div className="space-y-2 py-2">
              {[
                { key: 'all', label: lang === 'ar' ? 'كل المشتركين' : t.filterAll, count: counts.all },
                { key: 'unpaid', label: lang === 'ar' ? 'ديون غير مسددة' : t.filterUnpaid, count: counts.unpaid },
                { key: 'expiring', label: lang === 'ar' ? 'تنتهي قريباً (7 أيام)' : t.filterExpiring, count: counts.expiring },
                { key: 'expired', label: lang === 'ar' ? 'اشتراكات منتهية' : t.filterExpired, count: counts.expired }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setFilter(item.key);
                    setIsFilterSheetOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl border text-left rtl:text-right text-xs flex items-center justify-between transition-colors ${
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

          {/* Add / Edit Member Modal (Decoupled personal info only) */}
          <MobileMemberModal
            isOpen={showAddModal}
            memberToEdit={editingMember}
            onClose={() => {
              setShowAddModal(false);
              setEditingMember(null);
            }}
            onMemberCreated={() => {
              refreshData();
              showToast(
                editingMember
                  ? (lang === 'ar' ? 'تم تحديث بيانات العضو!' : lang === 'en' ? 'Member profile updated!' : 'Fiche membre mise à jour !')
                  : (lang === 'ar' ? 'تم تسجيل العضو بنجاح!' : lang === 'en' ? 'New member registered!' : 'Nouveau membre enregistré !'),
                'success'
              );
              setEditingMember(null);
            }}
            lang={lang}
          />

          {/* Renewal Modal (Handles variable cash payments, non-overlapping date extension) */}
          {renewingMember && (
            <MobileRenewalModal
              member={renewingMember}
              plans={plans}
              isOpen={!!renewingMember}
              onClose={() => setRenewingMember(null)}
              onOpenDebtSettlement={(m) => setMemberForDebtSettlement(m)}
              onRenewSuccess={() => {
                refreshData();
                showToast(
                  lang === 'ar' ? 'تم تجديد الاشتراك واستلام المبلغ!' : lang === 'en' ? 'Subscription renewed & payment collected!' : 'Abonnement prolongé avec succès !',
                  'success'
                );
              }}
              lang={lang}
            />
          )}

          {/* Dedicated Debt Settlement Modal (Encaisser le Reste) */}
          {memberForDebtSettlement && (
            <DebtSettlementModal
              member={memberForDebtSettlement}
              isOpen={!!memberForDebtSettlement}
              onClose={() => setMemberForDebtSettlement(null)}
              onSettledSuccess={(updated, paidAmount) => {
                refreshData();
                showToast(
                  lang === 'ar'
                    ? `تم استخلاص ${paidAmount} DH نقداً بنجاح!`
                    : `Encaissement de ${paidAmount} DH enregistré !`,
                  'success'
                );
              }}
              lang={lang}
            />
          )}

          {/* Blocked Renewal Warning Modal (When member has active debt) */}
          <ConfirmDialog
            isOpen={!!blockedRenewalMember}
            title={lang === 'ar' ? 'تنبيه: دين سابق معلق' : 'Attention: Dette en cours'}
            description={
              lang === 'ar'
                ? `يجب استخلاص الدين السابق أولاً (${blockedRenewalMember?.amountDue || 0} DH) قبل تجديد الاشتراك.`
                : `Veuillez d'abord régler la dette précédente (${blockedRenewalMember?.amountDue || 0} DH) avant de renouveler.`
            }
            confirmLabel={lang === 'ar' ? 'استخلاص الدين الآن' : lang === 'en' ? 'Settle Debt Now' : 'Régler la dette'}
            cancelLabel={lang === 'ar' ? 'إلغاء' : lang === 'en' ? 'Cancel' : 'Annuler'}
            variant="warning"
            lang={lang}
            onConfirm={() => {
              const target = blockedRenewalMember;
              setBlockedRenewalMember(null);
              if (target) {
                setMemberForDebtSettlement(target);
              }
            }}
            onCancel={() => setBlockedRenewalMember(null)}
          />

          {/* Reusable ConfirmDialog for Member Deletion (Soft Delete & Photo Purge) */}
          <ConfirmDialog
            isOpen={!!memberToDelete}
            title={lang === 'ar' ? 'أرشفة العضو وحذف صورته؟' : lang === 'en' ? 'Archive member and delete photo?' : 'Archiver et supprimer la photo ?'}
            description={
              lang === 'ar'
                ? `سيتم نقل ${memberToDelete?.fullName} للأرشيف وحذف صورته فوراً لتوفير مساحة الهاتف مع الحفاظ التام على السجل المالي.`
                : `Cette action retirera ${memberToDelete?.fullName} de la liste active et supprimera immédiatement sa photo pour libérer l'espace de stockage, tout en préservant l'historique financier.`
            }
            confirmLabel={lang === 'ar' ? 'أرشفة ومسح الصورة' : lang === 'en' ? 'Archive & Purge' : 'Archiver & Nettoyer'}
            cancelLabel={lang === 'ar' ? 'إلغاء' : 'Annuler'}
            variant="danger"
            lang={lang}
            onConfirm={() => {
              if (memberToDelete) confirmDeleteMember(memberToDelete);
            }}
            onCancel={() => setMemberToDelete(null)}
          />
        </div>
      </div>
    </>
  );
}

export default App;
