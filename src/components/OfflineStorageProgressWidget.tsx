import React, { useEffect, useState } from "react";
import { getStorageEstimate } from "../utils/storageEstimator";
import { HardDrive, Database, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

export function OfflineStorageProgressWidget({ variant = 'large' }: { variant?: 'small' | 'large' }) {
  const [estimate, setEstimate] = useState<{ quota: number; usage: number; available: boolean }>({ quota: 0, usage: 0, available: false });
  const [offlineCount, setOfflineCount] = useState({ decks: 0, cards: 0 });

  useEffect(() => {
    async function loadData() {
      // Get bytes storage usage
      const storageData = await getStorageEstimate();
      setEstimate(storageData);

      // Count offline decks & cards (by dynamically importing from offlineDb)
      try {
        const { getAllOfflineDecks } = await import("../utils/offlineDb");
        const decks = await getAllOfflineDecks();
        let totalCards = 0;
        decks.forEach(d => {
          totalCards += Array.isArray(d.cards) ? d.cards.length : 0;
        });
        setOfflineCount({ decks: decks.length, cards: totalCards });
      } catch (e) {
        console.warn("Could not calculate offline decks total", e);
      }
    }
    loadData();
    // Poll every 10s just in case, though usually it happens on mount
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!estimate.available || estimate.quota === 0) {
    return (
       <div className={cn("p-4 rounded-xl border border-zinc-200 dark:border-zinc-800", variant === 'small' ? 'text-xs my-2' : 'my-4')}>
          <p className="flex items-center gap-2 opacity-60"><AlertCircle className="w-4 h-4"/> Trình duyệt không hỗ trợ kiểm tra dung lượng trống.</p>
       </div>
    );
  }

  // Convert to MB
  const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
  const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
  const percentage = Math.min(((estimate.usage / estimate.quota) * 100), 100);

  // Estimates (Approximations): ~250KB per deck
  const estimatedRemainingMB = (estimate.quota - estimate.usage) / (1024 * 1024);
  const maxDecksEstimate = Math.min(Math.floor(estimatedRemainingMB * 4), 10000); // arbitrarily capped at 10k so it doesn't look absurd if quota is 100GB
  const maxCardsEstimate = maxDecksEstimate * 50;

  const getProgressColor = () => {
    if (percentage > 90) return "bg-red-500";
    if (percentage > 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const isSmall = variant === 'small';

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white/50 dark:bg-black/50 p-4", isSmall ? "" : "p-6")}>
       <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
             <HardDrive className={cn("text-orange-500", isSmall ? "w-4 h-4" : "w-5 h-5")} />
             <h4 className={cn("font-medium", isSmall ? "text-sm" : "text-lg")}>Không gian bộ nhớ Offline (IndexedDB)</h4>
          </div>
          <p className={cn("opacity-70 font-mono", isSmall ? "text-xs" : "text-sm")}>{usageMB} MB / {quotaMB} MB</p>
       </div>
       
       <div className={cn("w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden", isSmall ? "h-2 mb-3" : "h-3 mb-5")}>
         <div 
           className={cn("h-full transition-all duration-500", getProgressColor())} 
           style={{ width: `${Math.max(percentage, 1)}%` }}
         />
       </div>

       <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/60">
         <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-zinc-400" />
            <span className={cn("opacity-80", isSmall ? "text-xs" : "text-sm")}>
              Đã lưu: <b>{offlineCount.decks} học phần</b> ({offlineCount.cards} thẻ)
            </span>
         </div>
         {percentage < 99 && (
             <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400" />
                <span className={cn("opacity-80 text-blue-600 dark:text-blue-400", isSmall ? "text-xs" : "text-sm")}>
                   Ước tính có thể lưu thêm: ~ <b>{maxDecksEstimate.toLocaleString()}</b> học phần (khoảng ~ <b>{maxCardsEstimate.toLocaleString()}</b> thẻ)
                </span>
             </div>
         )}
       </div>
    </div>
  );
}
