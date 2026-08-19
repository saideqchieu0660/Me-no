import React from 'react';
import { motion } from 'motion/react';
import { Target, Flame, Sparkles, Trophy, Layers, Pin } from 'lucide-react';

export type VibeFilterType = 'all' | 'pinned' | 'due' | 'hard' | 'mastered' | 'new';

interface VibeSmartFiltersProps {
  activeFilter: VibeFilterType;
  onFilterChange: (filter: VibeFilterType) => void;
  counts: {
    all: number;
    pinned: number;
    due: number;
    hard: number;
    mastered: number;
    new: number;
  };
}

export const VibeSmartFilters: React.FC<VibeSmartFiltersProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  const filters: { id: VibeFilterType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'all', label: 'Tất cả bộ thẻ', icon: <Layers className="w-4 h-4" />, count: counts.all },
    { id: 'pinned', label: 'Đã ghim', icon: <Pin className="w-4 h-4 text-orange-500 fill-orange-500" />, count: counts.pinned },
    { id: 'due', label: 'Cần ôn hôm nay', icon: <Target className="w-4 h-4 text-red-500" />, count: counts.due },
    { id: 'hard', label: 'Có thẻ khó (X)', icon: <Flame className="w-4 h-4 text-amber-500" />, count: counts.hard },
    { id: 'mastered', label: 'Thành thạo (>80%)', icon: <Trophy className="w-4 h-4 text-emerald-500" />, count: counts.mastered },
    { id: 'new', label: 'Mới tạo', icon: <Sparkles className="w-4 h-4 text-blue-500" />, count: counts.new },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-none my-4"
    >
      {filters.map((f) => {
        const isActive = activeFilter === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm sm:text-base font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 ring-2 ring-orange-500 scale-[1.02]'
                : 'bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800'
            }`}
          >
            {f.icon}
            <span>{f.label}</span>
            <span
              className={`px-2.5 py-0.5 text-xs rounded-full font-black transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {f.count}
            </span>
          </button>
        );
      })}
    </motion.div>
  );
};
