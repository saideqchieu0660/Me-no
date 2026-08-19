import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Play, AlertCircle, Clock } from 'lucide-react';
import { Deck } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { VibeStudyEntryModal } from './VibeStudyEntryModal';

export const VibeFocusDeckCard: React.FC<{ decks: Deck[] }> = ({ decks }) => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const focusDeck = useMemo(() => {
    let mostDueDeck: (Deck & { dueCount: number }) | null = null;
    
    decks.forEach(deck => {
      if (deck.cards && deck.cards.length > 0) {
        const dueCount = deck.cards.filter(c => c.nextReview && c.nextReview <= Date.now()).length;
        if (!mostDueDeck || dueCount > mostDueDeck.dueCount) {
          mostDueDeck = { ...deck, dueCount };
        }
      }
    });

    return mostDueDeck;
  }, [decks]);

  if (!focusDeck || focusDeck.dueCount === 0) {
    return null;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden glass rounded-3xl p-6 md:p-8 mb-8 border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Sparkles className="w-32 h-32 text-orange-500" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 font-bold uppercase tracking-widest text-xs rounded-full border border-red-500/20">
              <AlertCircle className="w-3.5 h-3.5" /> Gợi Ý Ôn Ngay
            </span>
            <span className="text-zinc-500 dark:text-zinc-400 font-bold text-sm uppercase tracking-widest flex items-center gap-1.5">
               <Clock className="w-4 h-4" /> Hôm Nay
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-zinc-100 mb-2 leading-tight">
            {focusDeck.title}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium text-lg">
            Bạn có <strong className="text-red-500">{focusDeck.dueCount} thẻ</strong> đang chờ ôn tập để củng cố trí nhớ. Đừng để đường cong quên lãng đánh bại bạn!
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 flex items-center gap-2 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 text-lg"
        >
          <Play className="w-5 h-5 fill-current" />
          Học Cấp Tốc
        </button>
      </div>
      <VibeStudyEntryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} deck={focusDeck as Deck} />
    </motion.div>
  );
};
