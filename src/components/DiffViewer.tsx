import React from 'react';
import { diffWordsWithSpace, diffChars } from 'diff';

interface DiffViewerProps {
  title: string;
  oldText: string;
  newText: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ title, oldText, newText }) => {
  // Use diffWordsWithSpace to find changes
  const diffs = diffWordsWithSpace(oldText || "", newText || "");

  const renderOld = () => {
    return diffs.map((part, index) => {
      if (part.added) return null;
      if (part.removed) {
        // highlight removed whitespace or newlines carefully
        const content = part.value.replace(/\n/g, '↵\n');
        return (
          <span key={index} className="bg-red-200 dark:bg-red-900/60 text-red-900 dark:text-red-100 rounded-[2px] font-bold">
            {content}
          </span>
        );
      }
      return <span key={index}>{part.value}</span>;
    });
  };

  const renderNew = () => {
    return diffs.map((part, index) => {
      if (part.removed) return null;
      if (part.added) {
        const content = part.value.replace(/\n/g, '↵\n');
        return (
          <span key={index} className="bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 rounded-[2px] font-bold">
            {content}
          </span>
        );
      }
      return <span key={index}>{part.value}</span>;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
        <span className="flex items-center gap-1.5 uppercase">
          {title}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Original */}
        <div className="border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 rounded-xl p-3.5 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-red-200/60 dark:border-red-900/40 text-[11px] font-bold text-red-700 dark:text-red-400">
            <span>🔴 DỮ LIỆU GỐC (Trước)</span>
            <span className="text-[10px] bg-red-100 dark:bg-red-900/60 px-2 py-0.5 rounded font-mono">Chưa tách dòng</span>
          </div>
          <div className="text-xs font-mono whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 leading-relaxed break-words flex-1 min-h-[90px] bg-red-50/50 dark:bg-red-950/10 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30">
            {renderOld()}
          </div>
        </div>

        {/* Right: New (Formatted) */}
        <div className="border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl p-3.5 flex flex-col">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200/60 dark:border-emerald-800/40 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <span>🟢 ĐỊNH DẠNG AI (Sau)</span>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-mono">Đã làm thoáng</span>
          </div>
          <div className="w-full bg-emerald-50/50 dark:bg-emerald-950/10 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/30 text-xs font-mono whitespace-pre-wrap text-zinc-900 dark:text-zinc-100 leading-relaxed flex-1 min-h-[90px] break-words">
            {renderNew()}
          </div>
        </div>
      </div>
    </div>
  );
};
