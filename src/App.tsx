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
import { FinanceScreen } from './components/FinanceScreen';
import { SettingsTab } from './components/SettingsTab';
import { SplashScreen } from './components/SplashScreen';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Card, Badge, Sheet } from './components/ui/shadcn';
import {
  Search,
  Filter,
  Plus,
  Users,
  PieChart,
  Settings,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { SupportedLanguage, translations } from './utils/i18n';
import { StatusBar } from '@capacitor/status-bar';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  // 3 Core Tabs: Membres, Finance, Réglages
  const [activeTab, setActiveTab] = useState<'members' | 'finance' | 'settings'>('members');
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

  // Debt Collection / Encaisser le Reste
  const handleTogglePayment = async (member: Member) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const remainingDebt = member.amountDue || 0;

    if (remainingDebt > 0) {
      // Collect remaining debt in cash
      const newPayment: Payment = {
        id: `PAY-${Date.now()}`,
        subscriptionId: `SUB-${member.id}`,
        memberId: member.id,
        memberName: member.fullName,
        amountPaid: remainingDebt,
        paymentDate: todayStr,
        paymentMethod: 'CASH',
        timestamp: Date.now()
      };

      await db.payments.add(newPayment);
      await syncEngine.enqueue('PAYMENT', newPayment);

      const updated: Member = {
        ...member,
        isPaid: true,
        amountDue: 0,
        updatedAt: Date.now()
      };
      await db.members.put(updated);
      await syncEngine.enqueue('UPDATE_MEMBER', updated);
      await refreshData();
      showToast(
        t.paymentCollectedToast
          ? t.paymentCollectedToast(remainingDebt, t.currency)
          : `Encaissement de ${remainingDebt} ${t.currency} effectué avec succès !`,
        'success'
      );
    } else {
      // Toggle unpaid status
      const updated: Member = {
        ...member,
        isPaid: !member.isPaid,
        amountDue: !member.isPaid ? 0 : 250,
        updatedAt: Date.now()
      };
      await db.members.put(updated);
      await syncEngine.enqueue('UPDATE_MEMBER', updated);
      await refreshData();
    }
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
        t.memberArchivedToast
          ? t.memberArchivedToast(member.fullName)
          : `${member.fullName} a été archivé et sa photo purgée.`,
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

      <div className={`min-h-screen min-h-[100dvh] bg-[var(--background)] text-[var(--text-primary)] flex flex-col items-center select-none ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Mobile Shell Responsive Container */}
        <div className="w-full max-w-lg min-h-screen min-h-[100dvh] bg-[var(--background)] sm:border-x sm:border-[var(--border)] flex flex-col relative pb-[calc(5rem+max(0.75rem,env(safe-area-inset-bottom,0px)))] shadow-2xl">
          {/* Top Header - Rendered ONLY on Membres Tab */}
          {activeTab === 'members' ? (
            <header className="sticky top-0 z-40 bg-[var(--nav-bg)] backdrop-blur-md border-b border-[var(--border)] px-4 pt-safe pb-3 space-y-3">
              {/* Minimalistic Brand Bar + Language Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LionLogo size={44} primaryColor="var(--primary)" />
                  <div>
                    <h1 className="text-base font-black tracking-tight text-[var(--text-primary)] flex items-center gap-1 leading-none">
                      CLUB <span className="text-[var(--primary)]">AL OUSSOUD</span>
                    </h1>
                    <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-1">
                      {t.brandSubtitle}
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="text-[10px] uppercase font-bold text-[var(--text-muted)] border-[var(--border)]">
                  {lang}
                </Badge>
              </div>

              {/* Search Bar + Filter Trigger */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 rtl:pl-3 rtl:pr-9 pr-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsFilterSheetOpen(true)}
                  className={`h-10 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                    filter !== 'all'
                      ? 'border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {filter === 'all'
                      ? t.filterAll
                      : filter === 'unpaid'
                      ? t.filterUnpaid
                      : filter === 'expiring'
                      ? t.filterExpiring
                      : t.filterExpired}
                  </span>
                </button>
              </div>
            </header>
          ) : (
            /* Clean Sub-Screen Header for other tabs */
            <header className="sticky top-0 z-40 bg-[var(--nav-bg)] backdrop-blur-md border-b border-[var(--border)] px-4 pt-safe pb-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                {activeTab === 'finance' ? t.tabFinance : t.tabSettings}
              </h2>

              <Badge variant="outline" className="text-[10px] uppercase font-bold text-[var(--text-muted)] border-[var(--border)]">
                {lang}
              </Badge>
            </header>
          )}

          {/* Floating Toast / Tooltip Outside Layout (High Visibility, Top Z-Index, 3s Auto-dismiss) */}
          {toastMessage && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm pointer-events-auto transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-5">
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
                  <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center">
                    <span className="text-[10px] text-[var(--text-secondary)] font-medium block truncate">
                      {t.filterAll}
                    </span>
                    <span className="text-base font-bold text-[var(--text-primary)] font-mono mt-0.5 block">
                      {counts.all}
                    </span>
                  </Card>

                  <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center">
                    <span className="text-[10px] text-[var(--primary)] font-medium block truncate">
                      {t.filterExpiring} (7j)
                    </span>
                    <span className="text-base font-bold text-[var(--primary)] font-mono mt-0.5 block">
                      {counts.expiring}
                    </span>
                  </Card>

                  <Card className="bg-[var(--card)] border border-[var(--border)] p-2.5 text-center">
                    <span className="text-[10px] text-[var(--danger)] font-medium block truncate">
                      {t.filterUnpaid}
                    </span>
                    <span className="text-base font-bold text-[var(--danger)] font-mono mt-0.5 block">
                      {counts.unpaid}
                    </span>
                  </Card>
                </div>

                {/* Section Header with Count */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {t.tabMembers} ({filteredMembers.length})
                  </span>
                  <span className="text-[11px] text-[var(--primary)] font-medium">
                    {t.tapForDetails}
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
                        onRenew={(m) => setRenewingMember(m)}
                        onTogglePaymentStatus={handleTogglePayment}
                        onDeleteMember={handleDeleteMember}
                        onEditMember={(m) => {
                          setEditingMember(m);
                          setShowAddModal(true);
                        }}
                        lang={lang}
                      />
                    ))
                  ) : (
                    <div className="text-center py-16 rounded-xl border border-[var(--border)] bg-[var(--card-subtle)] p-6 text-[var(--text-muted)] text-xs">
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
                onTogglePayment={handleTogglePayment}
                lang={lang}
              />
            )}

            {/* SCREEN 3: RÉGLAGES */}
            {activeTab === 'settings' && (
              <SettingsTab
                plans={plans}
                onPlansUpdated={refreshData}
                lang={lang}
                onLanguageChange={handleSetLang}
                notificationsEnabled={notificationsEnabled}
                onToggleNotifications={setNotificationsEnabled}
              />
            )}
          </main>

          {/* Floating Action Button for Adding Members */}
          {activeTab === 'members' && (
            <button
              onClick={() => {
                setEditingMember(null);
                setShowAddModal(true);
              }}
              className="fixed bottom-[calc(4.25rem+max(0.75rem,env(safe-area-inset-bottom,0px)))] right-4 rtl:right-auto rtl:left-4 sm:right-[calc(50%-15rem)] sm:rtl:right-auto sm:rtl:left-[calc(50%-15rem)] z-40 w-12 h-12 rounded-full shadow-[0_8px_24px_var(--primary-border)] flex items-center justify-center text-[var(--primary-foreground)] font-black bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all active:scale-90 hover:scale-105"
              title={t.addNewMember}
            >
              <Plus className="w-6 h-6" />
            </button>
          )}

          {/* Modern Sleek Minimalist Bottom Navigation Bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--nav-bg)] backdrop-blur-xl border-t border-[var(--nav-border)] max-w-lg mx-auto px-4 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around">
            <button
              onClick={() => setActiveTab('members')}
              className="group flex flex-col items-center justify-center py-1 px-3 transition-colors duration-200 active:scale-95 flex-1 relative"
            >
              <div
                className={`transition-all duration-200 ${
                  activeTab === 'members'
                    ? 'text-[var(--primary)] filter drop-shadow-[0_0_8px_var(--nav-glow)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}
              >
                <Users className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-200 truncate ${
                  activeTab === 'members'
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}
              >
                {t.tabMembers}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className="group flex flex-col items-center justify-center py-1 px-3 transition-colors duration-200 active:scale-95 flex-1 relative"
            >
              <div
                className={`transition-all duration-200 ${
                  activeTab === 'finance'
                    ? 'text-[var(--primary)] filter drop-shadow-[0_0_8px_var(--nav-glow)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}
              >
                <PieChart className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-200 truncate ${
                  activeTab === 'finance'
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}
              >
                {t.tabFinance}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="group flex flex-col items-center justify-center py-1 px-3 transition-colors duration-200 active:scale-95 flex-1 relative"
            >
              <div
                className={`transition-all duration-200 ${
                  activeTab === 'settings'
                    ? 'text-[var(--primary)] filter drop-shadow-[0_0_8px_var(--nav-glow)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}
              >
                <Settings className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] mt-1 font-medium transition-colors duration-200 truncate ${
                  activeTab === 'settings'
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`}
              >
                {t.tabSettings}
              </span>
            </button>
          </nav>

          {/* Filter Bottom Sheet */}
          <Sheet isOpen={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)} title={t.filterLabel}>
            <div className="space-y-2 py-2">
              {[
                { key: 'all', label: t.filterAll, count: counts.all },
                { key: 'unpaid', label: t.filterUnpaid, count: counts.unpaid },
                { key: 'expiring', label: t.filterExpiring, count: counts.expiring },
                { key: 'expired', label: t.filterExpired, count: counts.expired }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setFilter(item.key);
                    setIsFilterSheetOpen(false);
                  }}
                  className={`w-full p-3 rounded-xl border text-left rtl:text-right text-xs flex items-center justify-between transition-colors ${
                    filter === item.key
                      ? 'border-[var(--primary-border)] bg-[var(--primary-bg)] text-[var(--primary)] font-semibold'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
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

          {/* Add / Edit Member Modal */}
          <MobileMemberModal
            plans={plans}
            isOpen={showAddModal}
            memberToEdit={editingMember}
            onClose={() => {
              setShowAddModal(false);
              setEditingMember(null);
            }}
            onMemberCreated={() => {
              refreshData();
              showToast(
                editingMember ? t.memberUpdatedToast : t.memberSavedToast,
                'success'
              );
              setEditingMember(null);
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
                showToast(t.memberRenewedToast, 'success');
              }}
              lang={lang}
            />
          )}

          {/* Reusable ConfirmDialog for Member Deletion (Soft Delete & Photo Purge) */}
          <ConfirmDialog
            isOpen={!!memberToDelete}
            title={t.deleteMemberModalTitle}
            description={memberToDelete ? t.deleteMemberModalDesc(memberToDelete.fullName) : ''}
            confirmLabel={t.confirmArchiveBtn}
            cancelLabel={t.cancelBtn}
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
