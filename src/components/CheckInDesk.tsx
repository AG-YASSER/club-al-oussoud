import React, { useState, useEffect, useRef } from 'react';
import { db, Member, CheckIn, getSubscriptionStatus, MembershipPlan } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { soundEngine } from '../utils/soundEngine';
import { RenewalModal } from './RenewalModal';
import {
  IconSearch,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconUser,
  IconPhone,
  IconCalendar,
  IconShieldCheck,
  IconBolt,
  IconClock,
  IconCreditCard,
  IconSparkles,
  IconArrowRight,
  IconScan,
  IconFocus2,
  IconFlame
} from '@tabler/icons-react';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';

interface CheckInDeskProps {
  plans: MembershipPlan[];
  onOpenNewMember?: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function CheckInDesk({
  plans,
  onOpenNewMember,
  searchQuery,
  setSearchQuery
}: CheckInDeskProps) {
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [renewalMember, setRenewalMember] = useState<Member | null>(null);
  const [checkInFeedback, setCheckInFeedback] = useState<{
    type: 'success' | 'warning' | 'expired';
    message: string;
    timestamp: number;
  } | null>(null);

  const loadRecentCheckIns = async () => {
    const list = await db.checkIns.orderBy('timestamp').reverse().limit(15).toArray();
    setRecentCheckIns(list);
  };

  useEffect(() => {
    loadRecentCheckIns();
  }, []);

  // Search logic
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const allMembers = await db.members.toArray();
      const filtered = allMembers.filter(
        (m) =>
          m.fullName.toLowerCase().includes(query) ||
          m.phone.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query)
      );
      setSearchResults(filtered.slice(0, 6));
    }, 80);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute Check-in
  const handleCheckIn = async (member: Member) => {
    const { status, daysRemaining } = getSubscriptionStatus(member.expiryDate);
    const now = new Date();
    const timeStr = format(now, 'hh:mm a');
    const dateStr = format(now, 'yyyy-MM-dd');

    if (status === 'active') {
      soundEngine.playSuccess();
      setCheckInFeedback({
        type: 'success',
        message: `Welcome, ${member.fullName}! Check-in verified.`,
        timestamp: Date.now()
      });
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else if (status === 'expiring') {
      soundEngine.playWarning();
      setCheckInFeedback({
        type: 'warning',
        message: `Check-in recorded! Subscription expires in ${daysRemaining} day(s).`,
        timestamp: Date.now()
      });
    } else {
      soundEngine.playExpiredAlert();
      setCheckInFeedback({
        type: 'expired',
        message: `ALERT: Membership EXPIRED ${Math.abs(daysRemaining)} days ago! Please renew.`,
        timestamp: Date.now()
      });
    }

    const checkInRecord: CheckIn = {
      id: 'chk_' + Math.random().toString(36).substring(2, 9),
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

    setSelectedMember(member);
    setSearchQuery('');
    setSearchResults([]);
    loadRecentCheckIns();
  };

  const statusInfo = selectedMember
    ? getSubscriptionStatus(selectedMember.expiryDate)
    : null;

  return (
    <div className="space-y-6">
      {/* Live Search Autocomplete Popup */}
      {searchResults.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden divide-y divide-zinc-800/80 mb-6">
          <div className="px-4 py-2 bg-zinc-950/70 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Matching Members ({searchResults.length})
          </div>
          {searchResults.map((m) => {
            const { status } = getSubscriptionStatus(m.expiryDate);
            return (
              <div
                key={m.id}
                onClick={() => handleCheckIn(m)}
                className="flex items-center justify-between p-3.5 hover:bg-zinc-800/60 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3.5">
                  {m.avatarWebP ? (
                    <img
                      src={m.avatarWebP}
                      alt={m.fullName}
                      className="w-10 h-10 rounded-xl object-cover border border-zinc-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-sm">
                      {m.fullName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{m.fullName}</span>
                      <span className="text-[11px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        {m.id}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                      <span>{m.phone}</span>
                      <span>•</span>
                      <span>{m.planName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                      status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : status === 'expiring'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        status === 'active'
                          ? 'bg-emerald-400'
                          : status === 'expiring'
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                    />
                    {status === 'active' && 'Active'}
                    {status === 'expiring' && 'Expiring Soon'}
                    {status === 'expired' && 'Expired'}
                  </span>
                  <button className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1">
                    Check In <IconArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Real-time Reception Feedback Banner */}
      {checkInFeedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
            checkInFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : checkInFeedback.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {checkInFeedback.type === 'success' && (
              <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
                <IconCheck className="w-5 h-5" />
              </div>
            )}
            {checkInFeedback.type === 'warning' && (
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <IconAlertTriangle className="w-5 h-5" />
              </div>
            )}
            {checkInFeedback.type === 'expired' && (
              <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
                <IconX className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="font-bold text-sm sm:text-base">{checkInFeedback.message}</p>
              <p className="text-xs opacity-75">Web Audio tone synthesized on receptionist speaker</p>
            </div>
          </div>

          {checkInFeedback.type === 'expired' && selectedMember && (
            <button
              onClick={() => setRenewalMember(selectedMember)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5"
            >
              <IconCreditCard className="w-4 h-4" />
              Renew Plan
            </button>
          )}
        </div>
      )}

      {/* Strict 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Center Column (Span 2): Active Verification Desk */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden h-full flex flex-col justify-between">
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <IconScan className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Reception Verification Desk
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Live credential matching & membership pass verification
                  </p>
                </div>
              </div>

              {selectedMember && statusInfo && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                    statusInfo.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : statusInfo.status === 'expiring'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      statusInfo.status === 'active'
                        ? 'bg-emerald-400'
                        : statusInfo.status === 'expiring'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  {statusInfo.badgeLabel}
                </span>
              )}
            </div>

            {/* Card Body */}
            {selectedMember && statusInfo ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                {/* Active Member Split View */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Large Avatar */}
                  <div className="relative flex-shrink-0">
                    {selectedMember.avatarWebP ? (
                      <img
                        src={selectedMember.avatarWebP}
                        alt={selectedMember.fullName}
                        className="w-32 h-32 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xl"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-2xl bg-zinc-800 border-2 border-zinc-700 flex flex-col items-center justify-center text-zinc-400">
                        <IconUser className="w-12 h-12 mb-1 opacity-50" />
                        <span className="text-xs">No Avatar</span>
                      </div>
                    )}
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-zinc-950 px-2.5 py-0.5 rounded-full border border-zinc-700 text-[10px] font-mono text-zinc-300 font-bold">
                      {selectedMember.id}
                    </div>
                  </div>

                  {/* Member Details */}
                  <div className="flex-1 text-center sm:text-left space-y-2.5">
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      {selectedMember.fullName}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1 text-zinc-300">
                        <IconPhone className="w-3.5 h-3.5 text-emerald-400" />
                        {selectedMember.phone}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <IconCalendar className="w-3.5 h-3.5 text-emerald-400" />
                        Joined {selectedMember.joinedDate}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-300 flex items-center gap-2">
                      <IconShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>Emergency: {selectedMember.emergencyContact}</span>
                    </div>

                    {selectedMember.notes && (
                      <p className="text-xs italic text-zinc-400">"{selectedMember.notes}"</p>
                    )}
                  </div>
                </div>

                {/* Subscription Bar */}
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 ${
                    statusInfo.status === 'active'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : statusInfo.status === 'expiring'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}
                >
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                      Current Subscription
                    </div>
                    <div className="text-base font-bold text-white">{selectedMember.planName}</div>
                    <div className="text-xs text-zinc-300 mt-0.5">
                      Valid until <span className="font-bold text-white">{selectedMember.expiryDate}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setRenewalMember(selectedMember)}
                      className="flex-1 sm:flex-initial bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-4 py-2 rounded-xl border border-zinc-700 transition"
                    >
                      Extend / Renew
                    </button>
                    <button
                      onClick={() => handleCheckIn(selectedMember)}
                      className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 transition"
                    >
                      <IconBolt className="w-4 h-4" /> Re-Check In
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Modern Centered Radar Scanner Empty State */
              <div className="text-center py-16 px-4 space-y-4 flex-1 flex flex-col items-center justify-center">
                <div className="relative bg-emerald-500/5 border border-emerald-500/10 rounded-full p-8 text-emerald-400 flex items-center justify-center shadow-inner">
                  <div className="w-16 h-16 rounded-full border border-emerald-500/20 flex items-center justify-center">
                    <IconFocus2 className="w-8 h-8 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Awaiting Member ID Scan
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Type a name, phone number, or member ID in the search bar above to verify identity and trigger check-in pass.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Span 1): Today's Check-In Feed */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/80 rounded-2xl p-5 flex flex-col h-full shadow-2xl">
            {/* Feed Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <IconClock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Today's Check-In Feed</h3>
              </div>
              <span className="bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-full font-mono font-semibold">
                {recentCheckIns.length} Logged
              </span>
            </div>

            {/* Feed Items */}
            <div className="space-y-2.5 overflow-y-auto max-h-[500px] flex-1 pr-1">
              {recentCheckIns.length > 0 ? (
                recentCheckIns.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/60 hover:border-zinc-700/80 transition-all"
                  >
                    {/* Left: Avatar + Name + Plan */}
                    <div className="flex items-center gap-3 min-w-0">
                      {item.memberAvatar ? (
                        <img
                          src={item.memberAvatar}
                          alt={item.memberName}
                          className="w-9 h-9 rounded-lg object-cover border border-zinc-700 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">
                          {item.memberName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item.memberName}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{item.planName}</p>
                      </div>
                    </div>

                    {/* Right: Badge + Timestamp */}
                    <div className="text-right flex-shrink-0 pl-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                          item.statusAtCheckIn === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.statusAtCheckIn === 'expiring'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.statusAtCheckIn}
                      </span>
                      <p className="text-[10px] font-mono text-zinc-500 mt-1 whitespace-nowrap">
                        {item.timeStr}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-xs text-zinc-500">
                  No check-ins recorded yet today.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Renewal Modal */}
      {renewalMember && (
        <RenewalModal
          member={renewalMember}
          plans={plans}
          isOpen={!!renewalMember}
          onClose={() => setRenewalMember(null)}
          onRenewSuccess={(updated) => {
            setSelectedMember(updated);
            loadRecentCheckIns();
          }}
        />
      )}
    </div>
  );
}
