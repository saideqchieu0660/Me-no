import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, Target, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { Deck, store } from '../lib/store';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { get } from 'idb-keyval';
import { VibeSyncEngine } from './sync/VibeSyncEngine';

interface BackupData {
  deckId: string;
  hardCardIds: string[];
  updatedAt: number;
}

interface VibeStudyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck | null;
}

export function VibeStudyEntryModal({ isOpen, onClose, deck }: VibeStudyEntryModalProps) {
  const navigate = useNavigate();
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupData | null>(null);

  const weakCardIds = useMemo(() => {
    if (!deck || !deck.cards) return [];
    return deck.cards.filter(c => c.isHard).map(c => c.id);
  }, [deck]);

  useEffect(() => {
    if (deck?.id && isOpen) {
      get(`vibe_backup_x_${deck.id}`).then(data => {
        if (data) {
          setLastBackup(data as BackupData);
        } else {
          setLastBackup(null);
        }
      });
    } else {
       setLastBackup(null);
    }
  }, [deck, isOpen]);

  if (!deck) return null;

  const handleStudyAll = async () => {
    store.setTempDeck(deck as any);
    navigate(`/study/${deck.id}`);
    onClose();
  };

  const handleStudyWeak = async () => {
    if (weakCardIds.length === 0) return;
    store.setTempDeck(deck as any);
    navigate(`/study/${deck.id}?mode=weak`);
    onClose();
  };

  const handleRestore = async () => {
    if (!lastBackup) return;
    
    try {
      const currentUser = store.getCurrentUser();
      let remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
      let updatedCount = 0;

      for (const card of deck.cards) {
        const shouldBeHard = lastBackup.hardCardIds.includes(card.id);
        
        if (!shouldBeHard && remindIds.includes(card.id)) {
          remindIds = remindIds.filter((id: string) => id !== card.id);
        } else if (shouldBeHard && !remindIds.includes(card.id)) {
           remindIds.push(card.id);
        }

        if (Boolean(card.isHard) !== shouldBeHard) {
          card.isHard = shouldBeHard;
          updatedCount++;

          if (currentUser) {
            // Push qua VibeSyncEngine để đồng bộ server
            await VibeSyncEngine.enqueueChange({
                type: "UPSERT_CARD_STATE",
                payload: {
                    uid: currentUser.id,
                    cardId: card.id,
                    isWeakCard: shouldBeHard
                }
            }).catch(err => console.warn("Queue ignored:", err));
            
            if (!(globalThis as any)._vibeCardStateUpdates) (globalThis as any)._vibeCardStateUpdates = [];
            (globalThis as any)._vibeCardStateUpdates.push({ cardId: card.id, isWeakCard: shouldBeHard });
          }
        }
      }

      localStorage.setItem("remind_later_items", JSON.stringify(remindIds));
      
      // Save locally to persist state without reload
      // We will access store properties dynamically or we can just trigger sync event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("henosis-data-synced"));
        window.dispatchEvent(new CustomEvent("vibe-backup-restored"));
        if ((globalThis as any)._vibeCardStateUpdates) {
          window.dispatchEvent(new CustomEvent("vibe-card-states-updated", { detail: { states: (globalThis as any)._vibeCardStateUpdates } }));
          (globalThis as any)._vibeCardStateUpdates = [];
        }
      }
      
      toast.success(`Đã khôi phục trạng thái ${lastBackup.hardCardIds.length} thẻ X! (cập nhật ${updatedCount} thẻ)`);
      setIsConfirmingRestore(false);
      onClose();
      navigate(`/study/${deck.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Không thể khôi phục backup");
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="study-entry-portal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        >
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-10"
          >
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/60 flex items-start justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
              <div className="pr-8">
                <h3 className="font-extrabold text-xl text-zinc-900 dark:text-zinc-100 line-clamp-1">{deck.title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                  <span className="font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{deck.cards.length} thẻ</span>
                  {weakCardIds.length > 0 && (
                    <span className="font-semibold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 px-2 py-0.5 rounded-md">
                      {weakCardIds.length} thẻ X
                    </span>
                  )}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer absolute top-4 right-4 bg-zinc-100 dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <button
                onClick={handleStudyAll}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 transition-all text-left group cursor-pointer active:scale-[0.98]"
              >
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">Học bình thường</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Học toàn bộ {deck.cards.length} thẻ trong học phần</span>
                </div>
              </button>

              <button
                onClick={handleStudyWeak}
                disabled={weakCardIds.length === 0}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                  weakCardIds.length > 0
                    ? "bg-orange-500/10 hover:bg-orange-500/20 border-orange-200 dark:border-orange-900/50 cursor-pointer active:scale-[0.98]"
                    : "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/50 opacity-60 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "p-3 rounded-xl transition-all",
                  weakCardIds.length > 0
                    ? "bg-orange-500/20 text-orange-600 dark:text-orange-400 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white"
                    : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                )}>
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-base font-bold",
                    weakCardIds.length > 0 ? "text-orange-700 dark:text-orange-400" : "text-zinc-500"
                  )}>Học riêng thẻ X</span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {weakCardIds.length > 0 
                      ? `Ôn lại ${weakCardIds.length} thẻ chưa thuộc`
                      : "Bạn đã thuộc tất cả các thẻ!"}
                  </span>
                </div>
              </button>

              <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-4 mt-2">
                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 px-1">Snapshots Thẻ X</div>
                <div className="w-full flex flex-col gap-3">
                  {!isConfirmingRestore ? (
                    <button
                      onClick={() => {
                        if (lastBackup) setIsConfirmingRestore(true);
                      }}
                      disabled={!lastBackup}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                        lastBackup 
                          ? "bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/50 cursor-pointer active:scale-[0.98]"
                          : "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/50 opacity-60 cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "p-3 rounded-xl transition-all",
                        lastBackup
                          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 group-hover:scale-110"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                      )}>
                        <RotateCcw className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col">
                        <span className={cn(
                          "text-base font-bold",
                          lastBackup ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-500"
                        )}>Khôi phục & Học</span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                          {lastBackup ? `Ghi đè trạng thái và học ${lastBackup.hardCardIds.length} thẻ X` : "Chưa có bản lưu nào"}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-3 p-4 rounded-2xl border border-orange-500/30 bg-orange-500/5 transition-all">
                      <div className="flex items-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400 text-center">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        Xác nhận ghi đè bằng bản sao lưu ({lastBackup?.hardCardIds.length} thẻ) và bắt đầu học?
                      </div>
                      <div className="flex gap-3 w-full mt-1">
                        <button
                          onClick={handleRestore}
                          className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors active:scale-95 cursor-pointer"
                        >
                          Chắc chắn
                        </button>
                        <button
                          onClick={() => setIsConfirmingRestore(false)}
                          className="flex-1 py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-bold rounded-xl transition-colors active:scale-95 cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
