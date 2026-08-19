import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Flashcard } from '../lib/store';

interface VibeFanoutDeckCardProps {
  cards?: Flashcard[];
  isHovered?: boolean;
}

export const VibeFanoutDeckCard: React.FC<VibeFanoutDeckCardProps> = ({ cards = [], isHovered = false }) => {
  // Take up to 4 cards for preview
  const previewCards = cards.slice(0, 4);
  
  // Fallback items if deck has fewer cards
  const displayCards = previewCards.length > 0 
    ? previewCards 
    : [
        { id: "1", front: "Thẻ mẫu #1", back: "Nội dung ghi nhớ #1" },
        { id: "2", front: "Thẻ mẫu #2", back: "Nội dung ghi nhớ #2" },
        { id: "3", front: "Thẻ mẫu #3", back: "Nội dung ghi nhớ #3" }
      ];

  // Fanout configuration parameters for up to 4 cards
  const fanConfigs = [
    { rotate: -20, x: -70, y: -52, scale: 0.95 },
    { rotate: -7,  x: -24, y: -68, scale: 0.98 },
    { rotate: 7,   x: 24,  y: -68, scale: 0.98 },
    { rotate: 20,  x: 70,  y: -52, scale: 0.95 },
  ];

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-0 w-full flex justify-center">
      <AnimatePresence>
        {isHovered && displayCards.map((card, idx) => {
          const config = fanConfigs[idx % fanConfigs.length];
          const text = (card as any).front || (card as any).word || (card as any).question || `Thẻ #${idx + 1}`;
          const detail = (card as any).back || (card as any).definition || (card as any).answer || "";

          return (
            <motion.div
              key={card.id || idx}
              initial={{ rotate: 0, x: 0, y: 0, scale: 0.75, opacity: 0 }}
              animate={{
                rotate: config.rotate,
                x: config.x,
                y: config.y,
                scale: config.scale,
                opacity: 1,
              }}
              exit={{ rotate: 0, x: 0, y: 0, scale: 0.75, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 22,
                delay: idx * 0.035,
              }}
              style={{ transformOrigin: "bottom center" }}
              className={cn(
                "absolute w-44 sm:w-48 h-28 rounded-2xl p-3 flex flex-col justify-between shadow-2xl border backdrop-blur-md select-none",
                "bg-zinc-900/95 text-white border-orange-500/50 shadow-orange-500/20",
                "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-tr before:from-orange-500/20 before:to-transparent before:pointer-events-none"
              )}
            >
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5 relative z-10">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Thẻ #{idx + 1}
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  Preview
                </span>
              </div>
              <p className="text-xs font-bold line-clamp-2 text-zinc-100 leading-snug my-auto relative z-10">
                {text}
              </p>
              {detail && (
                <p className="text-[10px] text-zinc-400 line-clamp-1 italic relative z-10">
                  {detail}
                </p>
              )}
            </motion.div>
          );
        })}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: -90, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute z-20 px-3 py-1 rounded-full bg-orange-600/90 text-white text-[11px] font-bold shadow-lg shadow-orange-500/30 backdrop-blur-md flex items-center gap-1.5 border border-orange-400/30 whitespace-nowrap"
          >
            <span>Bấm lần nữa để vào học</span>
            <span className="text-xs">➔</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
