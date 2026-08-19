import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Quote, Target } from 'lucide-react';
import { store } from '../lib/store';

const QUOTES = [
  "Điều duy nhất cản trở ta học hỏi chính là nền giáo dục của ta. - Albert Einstein",
  "Lý tính luôn là nô lệ của đam mê. - David Hume",
  "Không có gì trong trí tuệ mà không qua giác quan trước đó. - John Locke",
  "Biết người là trí, biết mình là sáng. - Lão Tử",
  "Trí tuệ là sức mạnh. - Francis Bacon"
];

export const VibeDailyMotivation: React.FC = () => {
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const user = store.getCurrentUser();
  const xp = user?.points || 0;

  // Mock simple checklist based on XP and general activity
  const checklist = [
    { label: "Mở ứng dụng học tập", done: true },
    { label: "Đạt 50 XP trong ngày", done: xp > 50 },
    { label: "Ôn tập ít nhất 1 bộ thẻ", done: xp > 10 }
  ];

  const progress = (checklist.filter(c => c.done).length / checklist.length) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass p-6 md:p-8 rounded-3xl mb-8 flex flex-col md:flex-row gap-8"
    >
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-2 mb-4 text-orange-500 font-bold uppercase tracking-widest text-sm">
          <Target className="w-5 h-5" /> Mục Tiêu Trong Ngày
        </div>
        
        <div className="space-y-3">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <Circle className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
              )}
              <span className={`font-medium text-lg ${item.done ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-200'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5 mt-4 overflow-hidden">
          <div className="bg-orange-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="flex-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden">
        <Quote className="absolute -top-4 -left-4 w-24 h-24 text-zinc-200 dark:text-zinc-700/30 opacity-50 -rotate-12" />
        <div className="relative z-10">
          <p className="text-xl md:text-2xl font-serif italic text-zinc-700 dark:text-zinc-300 leading-relaxed">
            "{quote.split(' - ')[0]}"
          </p>
          <p className="mt-4 font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
            — {quote.split(' - ')[1]}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
