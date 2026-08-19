import React, { useState, useEffect } from 'react';
import { MoreVertical, Pin, PinOff, Edit3, Share2, DownloadCloud, FileJson, Layers, Check, Save, CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { Deck, store } from '../lib/store';
import { downloadCourseForOffline, getAllOfflineDecks } from '../utils/offlineDb';
import { isFeatureEnabled } from '../features.config';
import { set } from 'idb-keyval';
import { VibeProgressSyncManager } from '../vibe-sandbox/sync/VibeProgressSyncManager';

export const DeckOptionsMenu = ({ 
  deck, 
  onEditDeck, 
  onAddToClass 
}: { 
  deck: Deck;
  onEditDeck?: () => void;
  onAddToClass?: () => void;
}) => {
  const [showDeckMenu, setShowDeckMenu] = useState(false);
  const [pinnedDecks, setPinnedDecks] = useState<string[]>([]);
  const [downloadingDecks, setDownloadingDecks] = useState<Set<string>>(new Set());
  const [offlineDeckIds, setOfflineDeckIds] = useState<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const currentUser = store.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'Admin';

  useEffect(() => {
    const pinnedKey = `pinned_decks_${currentUser?.id || 'guest'}`;
    try {
      const stored = JSON.parse(localStorage.getItem(pinnedKey) || '[]');
      if (Array.isArray(stored)) {
        setPinnedDecks(stored);
      }
    } catch(e) {}
    
    const handleUpdate = (e: any) => {
      if (e.detail?.pinnedDecks) {
        setPinnedDecks(e.detail.pinnedDecks);
      }
    };
    window.addEventListener("vibe-pinned-updated", handleUpdate);
    return () => window.removeEventListener("vibe-pinned-updated", handleUpdate);
  }, [currentUser?.id]);

  useEffect(() => {
    const refreshOfflineStatus = () => {
        getAllOfflineDecks().then(offlineDecks => {
          setOfflineDeckIds(new Set(offlineDecks.filter(d => (d as any).isAvailableOffline).map(d => d.id)));
        });
    };
    
    const handleOnline = () => { setIsOnline(true); refreshOfflineStatus(); };
    const handleOffline = () => { setIsOnline(false); refreshOfflineStatus(); };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('henosis-offline-update', refreshOfflineStatus);
    
    refreshOfflineStatus();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('henosis-offline-update', refreshOfflineStatus);
    };
  }, []);

  const togglePin = () => {
    setPinnedDecks(prev => {
      const newPinned = prev.includes(deck.id) 
         ? prev.filter(id => id !== deck.id) 
         : [...prev, deck.id];
         
      const pinnedKey = `pinned_decks_${currentUser?.id || 'guest'}`;
      try {
        localStorage.setItem(pinnedKey, JSON.stringify(newPinned));
      } catch (e: any) {
        console.warn('LocalStorage quota exceeded');
      }
      
      window.dispatchEvent(new CustomEvent("vibe-pinned-updated", { detail: { pinnedDecks: newPinned } }));
      return newPinned;
    });
  };

  const handleDownloadOffline = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloadingDecks.has(deck.id)) return;
    try {
      setDownloadingDecks(prev => new Set(prev).add(deck.id));
      await downloadCourseForOffline(deck.id);
      toast.success("Đã tải xuống khóa học để dùng offline.");
      setOfflineDeckIds(prev => {
        const next = new Set(prev);
        next.add(deck.id);
        return next;
      });
    } catch (err) {
      toast.error("Lỗi khi tải xuống: " + (err as Error).message);
    } finally {
      setDownloadingDecks(prev => {
        const next = new Set(prev);
        next.delete(deck.id);
        return next;
      });
    }
  };

  const handleDownloadJson = (onlyHardCards: boolean) => {
    const remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
    let cardsToDownload = deck.cards || [];
    
    if (onlyHardCards) {
      cardsToDownload = cardsToDownload.filter(c => Boolean(c.isHard) || remindIds.includes(c.id));
      if (cardsToDownload.length === 0) {
         toast.error("Không có thẻ X nào trong bộ này.");
         return;
      }
    }
    
    const cleanCards = cardsToDownload.map((c: any) => ({
      front: c.front || "",
      back: c.back || ""
    }));

    const exportData = {
      title: deck.title || "",
      subject: deck.subject || "",
      cards: cleanCards
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const suffix = onlyHardCards ? "_the_X" : "";
    downloadAnchorNode.setAttribute("download", `deck_${deck.title || 'untitled'}${suffix}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    toast.success(`Đã tải xuống ${cardsToDownload.length} thẻ.`);
  };

  const handleBackup = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeckMenu(false);
    
    try {
      const remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
      const weakCardIds = (deck.cards || [])
        .filter(c => Boolean(c.isHard) || remindIds.includes(c.id))
        .map(c => c.id);

      const backupKey = `vibe_backup_x_${deck.id}`;
      const newBackup = {
        deckId: deck.id,
        hardCardIds: weakCardIds,
        updatedAt: Date.now()
      };
      await set(backupKey, newBackup);
      toast.success(`Đã lưu trạng thái ${weakCardIds.length} thẻ X!`);
    } catch (err) {
      console.error(err);
      toast.error("Lỗi khi sao lưu dữ liệu.");
    }
  };

  return (
    <div className="relative z-[60]">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(!showDeckMenu); }}
        className="text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 transition p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 flex items-center justify-center cursor-pointer border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
        title="Tùy chọn học phần"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {showDeckMenu && (
        <>
          <div
            className="fixed inset-0 z-[70]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeckMenu(false);
            }}
          />
          <div
            className="absolute right-0 top-full mt-2 w-56 max-w-[90vw] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700/80 z-[80] overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(false); togglePin(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
            >
              {pinnedDecks.includes(deck.id) ? (
                <><PinOff className="w-4 h-4" /> Bỏ ghim</>
              ) : (
                <><Pin className="w-4 h-4" /> Ghim học phần</>
              )}
            </button>
            
            {(isAdmin || deck.createdBy === currentUser?.id) && onEditDeck && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(false); onEditDeck(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Sửa tên & danh mục
              </button>
            )}
            
            {onAddToClass && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(false); onAddToClass(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                Thêm vào Lớp học
              </button>
            )}

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeckMenu(false);
                const deckUrl = `${window.location.origin}/study/${deck.id}`;
                const shareText = `📚 Học phần: ${deck.title}\n👉 Tham gia học ngay: ${deckUrl}`;
                navigator.clipboard.writeText(shareText).then(() => {
                  toast.success("Đã sao chép link học phần!");
                }).catch(() => toast.error("Không thể sao chép."));
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Chia sẻ học phần
            </button>

            {isOnline && !offlineDeckIds.has(deck.id) && !deck.id.startsWith("remind-later-") && (
              <button
                onClick={(e) => { setShowDeckMenu(false); handleDownloadOffline(e); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
              >
                {downloadingDecks.has(deck.id) ? <Check className="w-4 h-4 animate-pulse" /> : <DownloadCloud className="w-4 h-4" />}
                Tải xuống Offline
              </button>
            )}

            <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1"></div>

            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBackup(e); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"><Save className="w-4 h-4" /> Lưu snapshot Thẻ X</button>

            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(false); handleDownloadJson(true); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              Tải JSON thẻ X
            </button>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(false); handleDownloadJson(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              Tải JSON (Toàn bộ)
            </button>
          </div>
        </>
      )}
    </div>
  );
};
