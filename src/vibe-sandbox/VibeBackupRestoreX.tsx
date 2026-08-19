import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { get, set } from 'idb-keyval';
import { Save, RotateCcw, AlertTriangle, X, DatabaseBackup } from 'lucide-react';
import { toast } from 'sonner';
import { store, Flashcard, saveLocalUserDecks } from '../lib/store';
import { cn } from '../lib/utils';
// @ts-ignore
import { VibeSyncEngine } from '../vibe-sandbox/sync/VibeSyncEngine';

interface BackupData {
  deckId: string;
  hardCardIds: string[];
  updatedAt: number;
}

interface VibeBackupRestoreXProps {
  deckId: string;
  deckTitle: string;
  cards: Flashcard[];
  onRestored?: () => void;
  className?: string;
}

export function VibeBackupRestoreX({ deckId, deckTitle, cards, onRestored, className }: VibeBackupRestoreXProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupData | null>(null);

  const fetchBackup = async () => {
    try {
      const data = await get(`vibe_backup_x_${deckId}`);
      if (data) {
        setLastBackup(data as BackupData);
      }
    } catch (e) {
      console.error('Failed to fetch backup', e);
    }
  };

  const handleOpen = () => {
    fetchBackup();
    setIsOpen(true);
  };

  const handleBackup = async () => {
    try {
      const remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
      const hardCardIds = cards.filter((c) => Boolean(c.isHard) || remindIds.includes(c.id)).map((c) => c.id);
      
      const backupData: BackupData = {
        deckId,
        hardCardIds,
        updatedAt: Date.now(),
      };
      
      await set(`vibe_backup_x_${deckId}`, backupData);
      setLastBackup(backupData);
      toast.success(`Đã sao lưu ${hardCardIds.length} thẻ khó của mục "${deckTitle}"`);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi sao lưu dữ liệu.');
    }
  };

  const handleRestore = async () => {
    if (!lastBackup) return;

    try {
      const currentUser = store.getCurrentUser();
      
      let remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
      let updatedCount = 0;

      for (const card of cards) {
        const shouldBeHard = lastBackup.hardCardIds.includes(card.id);
        
        if (!shouldBeHard && remindIds.includes(card.id)) {
          remindIds = remindIds.filter((id: string) => id !== card.id);
        } else if (shouldBeHard && !remindIds.includes(card.id)) {
           // We don't necessarily need to add it to remindIds since isHard=true covers it,
           // but adding it ensures the unified check works consistently everywhere
           remindIds.push(card.id);
        }

        if (Boolean(card.isHard) !== shouldBeHard) {
          card.isHard = shouldBeHard;
          updatedCount++;

          if (currentUser) {
            // Cập nhật memory store để đồng bộ trạng thái thẻ
            const statePayload = { isWeakCard: shouldBeHard };
            
            // Push qua VibeSyncEngine để đồng bộ server
            await VibeSyncEngine.enqueueChange({
                type: "UPSERT_CARD_STATE",
                payload: {
                    uid: currentUser.id,
                    cardId: card.id,
                    isWeakCard: shouldBeHard
                }
            }).catch(err => console.warn("Queue ignored:", err));
            
            if (!globalThis._vibeCardStateUpdates) globalThis._vibeCardStateUpdates = [];
            globalThis._vibeCardStateUpdates.push({ cardId: card.id, isWeakCard: shouldBeHard });
          }
        }
      }

      localStorage.setItem("remind_later_items", JSON.stringify(remindIds));
      
      // Save locally to persist state without reload
      saveLocalUserDecks();
      store.setDecksLocally(store.getDecks());
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("henosis-data-synced"));
        window.dispatchEvent(new CustomEvent("vibe-backup-restored"));
        if (globalThis._vibeCardStateUpdates) {
          window.dispatchEvent(new CustomEvent("vibe-card-states-updated", { detail: { states: globalThis._vibeCardStateUpdates } }));
          globalThis._vibeCardStateUpdates = [];
        }
      }

      toast.success(`Đã khôi phục ${lastBackup.hardCardIds.length} thẻ khó (cập nhật ${updatedCount} thẻ)`);
      if (onRestored) onRestored();
      setIsOpen(false);
      setIsConfirmingRestore(false);
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi khôi phục dữ liệu.');
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={handleOpen}
        className="flex items-center justify-center p-2 rounded-full bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-800/40 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer"
        title="Sao lưu/Khôi phục thẻ đánh dấu X"
      >
        <DatabaseBackup className="w-5 h-5" />
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="backup-portal-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
            >
              <motion.div
                key="backup-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsOpen(false);
                  setIsConfirmingRestore(false);
                }}
                className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                key="backup-content"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-10"
              >
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
                  <div className="flex items-center gap-2">
                    <DatabaseBackup className="w-5 h-5 text-purple-500" />
                    <span className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">Snapshots Thẻ X</span>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer">
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-1">
                    Quản lý trạng thái các thẻ học được đánh dấu khó (thẻ X) của bộ học trình <strong className="text-zinc-700 dark:text-zinc-300">"{deckTitle}"</strong>.
                  </div>

                  <button
                    onClick={handleBackup}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/10 dark:border-purple-400/10 text-purple-700 dark:text-purple-400 transition-all text-left group active:scale-98 cursor-pointer"
                  >
                    <div className="p-2 bg-purple-500 text-white rounded-lg group-hover:scale-105 transition-transform">
                      <Save className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Lưu trạng thái hiện tại</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Ghi đè hoặc tạo mới bản sao lưu</span>
                    </div>
                  </button>

                  <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                  {!isConfirmingRestore ? (
                    <button
                      onClick={() => {
                        if (lastBackup) {
                          setIsConfirmingRestore(true);
                        }
                      }}
                      disabled={!lastBackup}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                        lastBackup 
                          ? "bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/10 dark:border-orange-400/10 text-orange-700 dark:text-orange-400 active:scale-98 cursor-pointer" 
                          : "bg-zinc-50 dark:bg-zinc-900/35 border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg transition-transform",
                        lastBackup ? "bg-orange-50 text-white group-hover:scale-105" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
                      )}>
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Khôi phục trạng thái</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {lastBackup 
                            ? `Bản lưu: ${new Date(lastBackup.updatedAt).toLocaleTimeString('vi-VN')} ngày ${new Date(lastBackup.updatedAt).toLocaleDateString('vi-VN')} (${lastBackup.hardCardIds.length} thẻ)` 
                            : "Chưa có bản sao lưu nào"}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-3">
                      <div className="flex items-start gap-2.5 text-orange-800 dark:text-orange-300">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                        <span className="text-xs font-semibold leading-relaxed">
                          Hành động này sẽ ghi đè toàn bộ trạng thái đánh dấu X hiện tại bằng bản sao lưu trước đó ({lastBackup?.hardCardIds.length} thẻ). Bạn có chắc chắn không?
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRestore}
                          className="flex-1 py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold rounded-lg transition-colors cursor-pointer shadow-sm shadow-orange-500/10"
                        >
                          Chắc chắn
                        </button>
                        <button
                          onClick={() => setIsConfirmingRestore(false)}
                          className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-extrabold rounded-lg transition-colors cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
