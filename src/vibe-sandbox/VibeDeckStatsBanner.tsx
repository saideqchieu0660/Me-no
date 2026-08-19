import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Target, TrendingUp, BookOpen, Flame, Calendar, Trophy } from 'lucide-react';
import { Deck, store } from '../lib/store';

export const VibeDeckStatsBanner: React.FC<{ decks: Deck[] }> = ({ decks }) => {
  const stats = useMemo(() => {
    let dueCards = 0;
    let totalCards = 0;
    let totalMastery = 0;
    let masteredCards = 0;

    decks.forEach(deck => {
      if (deck.cards) {
        totalCards += deck.cards.length;
        deck.cards.forEach(card => {
          if (card.nextReview && card.nextReview <= Date.now()) {
            dueCards++;
          }
          if (card.mastery) {
            totalMastery += card.mastery;
            if (card.mastery >= 90) masteredCards++;
          }
        });
      }
    });

    const averageMastery = totalCards > 0 ? (totalMastery / totalCards) : 0;
    
    // Streak logic - just mock or pull from user if available. We'll use store.getCurrentUser
    const user = store.getCurrentUser();
    const streak = user?.streak || 0;

    return { dueCards, averageMastery, totalDecks: decks.length, masteredCards, streak };
  }, [decks]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
    >
      <div className="glass p-5 rounded-3xl flex items-center gap-4 bg-gradient-to-br from-red-500/10 to-transparent dark:from-red-500/5">
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl shadow-sm">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{stats.dueCards}</div>
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Cần Ôn Hôm Nay</div>
        </div>
      </div>

      <div className="glass p-5 rounded-3xl flex items-center gap-4 bg-gradient-to-br from-green-500/10 to-transparent dark:from-green-500/5">
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl shadow-sm">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{stats.averageMastery.toFixed(1)}%</div>
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Độ Thuộc (TB)</div>
        </div>
      </div>

      <div className="glass p-5 rounded-3xl flex items-center gap-4 bg-gradient-to-br from-orange-500/10 to-transparent dark:from-orange-500/5">
        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl shadow-sm">
          <Flame className="w-6 h-6" />
        </div>
        <div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{stats.streak}</div>
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Ngày Liên Tục</div>
        </div>
      </div>

      <div className="glass p-5 rounded-3xl flex items-center gap-4 bg-gradient-to-br from-blue-500/10 to-transparent dark:from-blue-500/5">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">{stats.masteredCards}</div>
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Thẻ Đã Thuộc</div>
        </div>
      </div>
    </motion.div>
  );
};
