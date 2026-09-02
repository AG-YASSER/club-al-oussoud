import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Member, MembershipPlan, getSubscriptionStatus, db } from '../db/db';
import { syncEngine } from '../db/syncEngine';
import { Button, Input, Card, Badge } from './ui/components';
import { RenewalModal } from './RenewalModal';
import {
  IconSearch,
  IconCreditCard,
  IconTrash,
  IconId,
  IconUser,
  IconCheck,
  IconAlertTriangle,
  IconX
} from '@tabler/icons-react';

interface MembersListProps {
  members: Member[];
  plans: MembershipPlan[];
  onRefresh: () => void;
  onOpenNewMember?: () => void;
}

export function MembersList({
  members,
  plans,
  onRefresh,
  onOpenNewMember
}: MembersListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [renewalMember, setRenewalMember] = useState<Member | null>(null);

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const { status } = getSubscriptionStatus(m.expiryDate);
    if (filterStatus === 'all') return true;
    return status === filterStatus;
  });

  const handleDeleteMember = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove member "${name}"?`)) {
      await db.members.delete(id);
      await syncEngine.enqueue('UPDATE_MEMBER', { id, deleted: true });
      onRefresh();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Floating Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex-1 relative">
          <IconSearch className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search directory by name, phone, or member ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-12 text-sm bg-zinc-900/80 border-zinc-800"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'expiring', 'expired'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                filterStatus === status
                  ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] font-bold'
                  : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              {status}
            </button>
          ))}
          {onOpenNewMember && (
            <Button variant="default" size="sm" onClick={onOpenNewMember} className="whitespace-nowrap h-9">
              + New Member
            </Button>
          )}
        </div>
      </div>

      {/* Modern SaaS Table */}
      <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-950/80 text-zinc-400 text-xs font-semibold uppercase tracking-wider border-b border-zinc-800/80">
              <tr>
                <th className="py-4 px-5">Member Information</th>
                <th className="py-4 px-5">Subscription Tier</th>
                <th className="py-4 px-5">Status & Expiry</th>
                <th className="py-4 px-5">Emergency Contact</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const { status, badgeLabel } = getSubscriptionStatus(member.expiryDate);
                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          {member.avatarWebP ? (
                            <img
                              src={member.avatarWebP}
                              alt={member.fullName}
                              className="w-11 h-11 rounded-xl object-cover border border-zinc-700/80 shadow-md"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300">
                              {member.fullName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white text-sm">
                              {member.fullName}
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-zinc-400">{member.id}</span>
                              <span>•</span>
                              <span>{member.phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="font-semibold text-zinc-200">{member.planName}</div>
                        <div className="text-xs text-zinc-500">Joined {member.joinedDate}</div>
                      </td>

                      <td className="py-4 px-5">
                        <Badge variant={status}>{badgeLabel}</Badge>
                        <div className="text-xs font-mono text-zinc-500 mt-1">
                          Valid until {member.expiryDate}
                        </div>
                      </td>

                      <td className="py-4 px-5 text-xs text-zinc-400 font-medium">
                        {member.emergencyContact || '—'}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRenewalMember(member)}
                            className="gap-1.5 h-8 text-xs hover:border-emerald-500/50"
                          >
                            <IconCreditCard className="w-3.5 h-3.5 text-emerald-400" />
                            Renew Pass
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMember(member.id, member.fullName)}
                            className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 h-8 w-8"
                          >
                            <IconTrash className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-zinc-500 text-sm">
                    No members match search query or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {renewalMember && (
        <RenewalModal
          member={renewalMember}
          plans={plans}
          isOpen={!!renewalMember}
          onClose={() => setRenewalMember(null)}
          onRenewSuccess={() => {
            onRefresh();
          }}
        />
      )}
    </motion.div>
  );
}
