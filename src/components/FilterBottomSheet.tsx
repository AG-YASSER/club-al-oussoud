import React from 'react';
import { IconFilter, IconCheck, IconX, IconAlertTriangle, IconClock, IconCircleCheck } from '@tabler/icons-react';
import { translations, SupportedLanguage } from '../utils/i18n';

export type FilterType = 'all' | 'unpaid' | 'expiring' | 'expired' | 'active';

interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: FilterType;
  onSelectFilter: (filter: FilterType) => void;
  counts: Record<string, number>;
  lang: SupportedLanguage;
}

export function FilterBottomSheet({
  isOpen,
  onClose,
  activeFilter,
  onSelectFilter,
  counts,
  lang
}: FilterBottomSheetProps) {
  if (!isOpen) return null;

  const t = translations[lang];

  const filterOptions: { id: FilterType; label: string; count: number; badgeColor: string; icon: React.ReactNode }[] = [
    {
      id: 'all',
      label: t.filterAll,
      count: counts.all || 0,
      badgeColor: 'text-zinc-300 bg-zinc-800',
      icon: <IconFilter className="w-4 h-4 text-zinc-400" />
    },
    {
      id: 'unpaid',
      label: t.filterUnpaid,
      count: counts.unpaid || 0,
      badgeColor: 'text-orange-400 bg-orange-500/10 border border-orange-500/30',
      icon: <IconAlertTriangle className="w-4 h-4 text-orange-400" />
    },
    {
      id: 'expiring',
      label: t.filterExpiring,
      count: counts.expiring || 0,
      badgeColor: 'text-amber-400 bg-amber-500/10 border border-amber-500/30',
      icon: <IconClock className="w-4 h-4 text-amber-400" />
    },
    {
      id: 'expired',
      label: t.filterExpired,
      count: counts.expired || 0,
      badgeColor: 'text-rose-400 bg-rose-500/10 border border-rose-500/30',
      icon: <IconX className="w-4 h-4 text-rose-400" />
    },
    {
      id: 'active',
      label: t.filterActive,
      count: counts.active || 0,
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30',
      icon: <IconCircleCheck className="w-4 h-4 text-emerald-400" />
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border-t border-zinc-800 rounded-t-3xl p-5 shadow-2xl space-y-4">
        {/* Top Handle and Title */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <IconFilter className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white tracking-tight">{t.selectFilter}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-800/60"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-2">
          {filterOptions.map((opt) => {
            const isSelected = activeFilter === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelectFilter(opt.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/15 text-white font-bold'
                    : 'border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {opt.icon}
                  <span className="text-sm">{opt.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${opt.badgeColor}`}>
                    {opt.count}
                  </span>
                  {isSelected && <IconCheck className="w-4 h-4 text-amber-400 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700/60"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
}
