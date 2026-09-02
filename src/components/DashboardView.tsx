import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Member, MembershipPlan, CheckIn, PaymentRecord, getSubscriptionStatus } from '../db/db';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from './ui/components';
import { RenewalModal } from './RenewalModal';
import {
  IconUsers,
  IconCircleCheck,
  IconAlertTriangle,
  IconCurrencyDollar,
  IconArrowUpRight,
  IconClock,
  IconCreditCard,
  IconWifi,
  IconWifiOff,
  IconUserPlus,
  IconScan
} from '@tabler/icons-react';
import { format } from 'date-fns';

interface DashboardViewProps {
  members: Member[];
  plans: MembershipPlan[];
  checkIns: CheckIn[];
  payments: PaymentRecord[];
  isOnline: boolean;
  pendingSyncCount: number;
  onNavigateToCheckIn: () => void;
  onNavigateToOnboarding: () => void;
  onRefreshData: () => void;
}

export function DashboardView({
  members,
  plans,
  checkIns,
  payments,
  isOnline,
  pendingSyncCount,
  onNavigateToCheckIn,
  onNavigateToOnboarding,
  onRefreshData
}: DashboardViewProps) {
  const [selectedRenewalMember, setSelectedRenewalMember] = useState<Member | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCheckInsCount = checkIns.filter((c) => c.dateStr === todayStr).length;

  let activeCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  const expiringMembersList: { member: Member; daysLeft: number }[] = [];

  members.forEach((m) => {
    const { status, daysRemaining } = getSubscriptionStatus(m.expiryDate);
    if (status === 'active') activeCount++;
    else if (status === 'expiring') {
      expiringCount++;
      expiringMembersList.push({ member: m, daysLeft: daysRemaining });
    } else {
      expiredCount++;
    }
  });

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Top Banner with Floating Glass Indicators */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/70 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Reception Console
            </span>
            <div className="flex items-center gap-1.5 text-xs">
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[11px] font-medium">
                  <IconWifi className="w-3 h-3" /> Online Synced
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-[11px] font-medium">
                  <IconWifiOff className="w-3 h-3" /> Offline ({pendingSyncCount} in queue)
                </span>
              )}
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Gym Operations & Desk Analytics
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time gym floor occupancy, subscription alerts, and receptionist cash flow
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onNavigateToOnboarding} className="gap-1.5">
            <IconUserPlus className="w-4 h-4" />
            <span>New Member</span>
          </Button>
          <Button variant="default" size="lg" onClick={onNavigateToCheckIn} className="gap-2 font-bold shadow-lg">
            <IconScan className="w-4 h-4" />
            <span>Open Check-In Desk</span>
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 p-5 group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Today's Check-Ins
            </span>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <IconCircleCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{todayCheckInsCount}</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center">
              <IconArrowUpRight className="w-3.5 h-3.5" /> Live
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Gym turnstile entries today</p>
        </Card>

        {/* Stat 2 */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 p-5 group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Active Members
            </span>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <IconUsers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 font-mono">{activeCount}</span>
            <span className="text-xs text-zinc-400 font-medium">of {members.length} Total</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Valid subscriptions active</p>
        </Card>

        {/* Stat 3 */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 p-5 group hover:border-amber-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Expiring Soon
            </span>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <IconAlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 font-mono">{expiringCount}</span>
            <span className="text-xs text-amber-400/80 font-medium">≤ 5 days left</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Target for receptionist renewal</p>
        </Card>

        {/* Stat 4 */}
        <Card className="border-zinc-800/80 bg-zinc-900/60 p-5 group hover:border-emerald-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <IconCurrencyDollar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">${totalRevenue}</span>
            <span className="text-xs text-emerald-400 font-semibold">{payments.length} transactions</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Stored in local IndexedDB</p>
        </Card>
      </div>

      {/* Expiring Subscriptions & Check-in Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <Card className="border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-2xl">
            <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4 text-amber-400" />
                <CardTitle className="text-sm font-bold text-white">
                  Expiring Subscriptions (Action Needed)
                </CardTitle>
              </div>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                {expiringMembersList.length + expiredCount} Total Alerts
              </span>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-zinc-400 font-semibold uppercase tracking-wider border-b border-zinc-800/80">
                    <tr>
                      <th className="p-3.5">Member</th>
                      <th className="p-3.5">Plan</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {members
                      .filter((m) => {
                        const { status } = getSubscriptionStatus(m.expiryDate);
                        return status === 'expiring' || status === 'expired';
                      })
                      .slice(0, 5)
                      .map((member) => {
                        const { status, badgeLabel } = getSubscriptionStatus(member.expiryDate);
                        return (
                          <tr key={member.id} className="hover:bg-zinc-800/40 transition">
                            <td className="p-3.5">
                              <div className="font-bold text-white text-sm">{member.fullName}</div>
                              <div className="text-zinc-400 font-mono text-[11px]">{member.phone}</div>
                            </td>
                            <td className="p-3.5">
                              <div className="text-zinc-200">{member.planName}</div>
                              <div className="text-zinc-400 text-[10px]">Exp: {member.expiryDate}</div>
                            </td>
                            <td className="p-3.5">
                              <Badge variant={status} className="text-[10px]">
                                {badgeLabel}
                              </Badge>
                            </td>
                            <td className="p-3.5 text-right">
                              <Button
                                variant={status === 'expired' ? 'destructive' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedRenewalMember(member)}
                                className="h-7 text-xs px-2.5 font-semibold"
                              >
                                <IconCreditCard className="w-3 h-3 mr-1" />
                                Renew
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Feed Stream */}
        <div className="lg:col-span-5">
          <Card className="border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-2xl">
            <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <IconClock className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm font-bold text-white">
                  Latest Entrance Activity
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToCheckIn}
                className="text-xs text-emerald-400 hover:text-emerald-300 h-7"
              >
                Go to Desk →
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-2.5 max-h-[380px] overflow-y-auto">
              {checkIns.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {c.memberAvatar ? (
                      <img
                        src={c.memberAvatar}
                        alt={c.memberName}
                        className="w-8 h-8 rounded-lg object-cover border border-zinc-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-300 flex-shrink-0">
                        {c.memberName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.memberName}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{c.planName}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <Badge variant={c.statusAtCheckIn} className="text-[9px] px-1.5 py-0">
                      {c.statusAtCheckIn}
                    </Badge>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{c.timeStr}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedRenewalMember && (
        <RenewalModal
          member={selectedRenewalMember}
          plans={plans}
          isOpen={!!selectedRenewalMember}
          onClose={() => setSelectedRenewalMember(null)}
          onRenewSuccess={() => {
            onRefreshData();
          }}
        />
      )}
    </motion.div>
  );
}
