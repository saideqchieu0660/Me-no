import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Flame } from 'lucide-react';

export const VibeHeatmap = () => {
  const heatmapData = useMemo(() => {
    const data = [];
    for (let w = 0; w < 18; w++) { // Make it a bit wider to fill space
      const week = [];
      for (let d = 0; d < 7; d++) {
        const rand = Math.random();
        let val = 0;
        if (rand > 0.85) val = 4;
        else if (rand > 0.7) val = 3;
        else if (rand > 0.5) val = 2;
        else if (rand > 0.35) val = 1;
        week.push(val);
      }
      data.push(week);
    }
    return data;
  }, []);

  const getColor = (val: number) => {
    switch (val) {
      case 4: return "bg-orange-500 dark:bg-orange-500 border-orange-600 dark:border-orange-400";
      case 3: return "bg-orange-400 dark:bg-orange-600 border-orange-500 dark:border-orange-500";
      case 2: return "bg-orange-300 dark:bg-orange-700 border-orange-400 dark:border-orange-600";
      case 1: return "bg-orange-200 dark:bg-orange-800/80 border-orange-300 dark:border-orange-700";
      default: return "bg-zinc-100/50 dark:bg-zinc-800/30";
    }
  };

  const getBorder = (val: number) => {
    if (val === 0) return "border-zinc-200/60 dark:border-zinc-700/50";
    return "";
  };

  return (
    <div className="bg-white dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden group">
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-orange-500/10 transition-colors duration-1000" />
      
      <div className="relative z-10 min-w-[200px]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">Streak 4 Tháng</h3>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed max-w-[240px]">
          Bạn đã hoàn thành <strong className="text-zinc-800 dark:text-zinc-200 font-bold">512 thẻ</strong> trong thời gian qua. Lửa học tập đang cháy!
        </p>
        <div className="flex items-center gap-3 text-xs font-bold tracking-wide uppercase text-zinc-400 dark:text-zinc-500">
          <span>Ít</span>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map(val => (
              <div key={val} className={cn("w-3 h-3 rounded-sm border", getColor(val), getBorder(val))} />
            ))}
          </div>
          <span>Nhiều</span>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-4 md:pb-0 w-full relative z-10 scrollbar-hide snap-x">
        {heatmapData.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1.5 snap-start shrink-0">
            {week.map((val, dIdx) => (
              <motion.div
                key={`${wIdx}-${dIdx}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (wIdx * 7 + dIdx) * 0.005, type: "spring" }}
                className={cn(
                  "w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm border cursor-pointer hover:scale-150 hover:z-20 transition-transform origin-center shadow-sm relative",
                  getColor(val),
                  getBorder(val)
                )}
                title={`${val > 0 ? val * 12 + Math.floor(Math.random()*10) : 0} thẻ ôn tập`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
