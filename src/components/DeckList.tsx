import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { MoreVertical, MoreHorizontal, Play, BookOpen, Search, X, ChevronLeft, ChevronRight, Sparkles, Pin, PinOff, Clock, Check, Share2, Edit3, DownloadCloud, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Deck, store, Flashcard } from '../lib/store';
import { useTheme } from '../components/ThemeProvider';
import { cn } from '../lib/utils';
import { downloadCourseForOffline, isDeckSavedOffline, getAllOfflineDecks } from '../utils/offlineDb';
import { isFeatureEnabled } from '../features.config';
import { Layers } from 'lucide-react';
import { VibeStudyEntryModal } from '../vibe-sandbox/VibeStudyEntryModal';
import { VibeDeckStatsBanner } from '../vibe-sandbox/VibeDeckStatsBanner';
import { VibeSmartFilters, VibeFilterType } from '../vibe-sandbox/VibeSmartFilters';
import { StickyNav } from './StickyNav';
import { VibeStickyStudyNav, VibeNavGroup } from '../vibe-sandbox/VibeStickyStudyNav';
import { VibeClassModal } from '../vibe-sandbox/VibeClassModal';
import { EditDeckModal } from './EditDeckModal';
import { VibeFanoutDeckCard } from '../vibe-sandbox/VibeFanoutDeckCard';

interface DeckListProps {
  decks: Deck[];
  showSearch?: boolean;
  groupBySubject?: boolean;
  onCategoryQuiz?: (subject: string, subjectDecks: Deck[]) => void;
  onCategoryReviewHardCards?: (subject: string, subjectDecks: Deck[]) => void;
  onCategoryStudyAll?: (subject: string, subjectDecks: Deck[]) => void;
  isAdmin?: boolean;
  onEditDeck?: (deck: Deck) => void;
}

const TiltCard = ({ children, delayIdx, className = "", onClick, cards }: { children: React.ReactNode, delayIdx: number, className?: string, onClick?: () => void, cards?: Flashcard[] }) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isFeatureEnabled("vibe-fanout-deck") && !isHovered) {
      e.stopPropagation();
      setIsHovered(true);
      return;
    }
    if (onClick) onClick();
  };

  const { theme, isFixLagEnabled } = useTheme();

  if (isFixLagEnabled) {
    return (
      <div 
        className={`h-full overflow-visible relative ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isFeatureEnabled("vibe-fanout-deck") && (
          <VibeFanoutDeckCard cards={cards} isHovered={isHovered} />
        )}
        <div onClick={handleCardClick} className="relative p-4 sm:p-5 rounded-2xl flex flex-col group overflow-visible min-h-[10rem] h-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 transition-colors shadow-sm cursor-pointer z-10">
          {children}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delayIdx * 0.1, type: "spring", stiffness: 100 }}
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`perspective-1000 h-full overflow-visible relative ${className}`}
    >
      {isFeatureEnabled("vibe-fanout-deck") && (
        <VibeFanoutDeckCard cards={cards} isHovered={isHovered} />
      )}
      <div onClick={handleCardClick} className="card-3d relative p-4 sm:p-5 rounded-2xl flex flex-col group overflow-visible min-h-[10rem] h-full transform-style-3d bg-white/70 dark:bg-black/80 cursor-pointer z-10">
        {children}
      </div>
    </motion.div>
  );
};

export const DeckList = ({ decks, showSearch = true, groupBySubject = false, onCategoryQuiz, onCategoryReviewHardCards, onCategoryStudyAll, isAdmin = false, onEditDeck }: DeckListProps) => {
  const navigate = useNavigate();
  const currentUser = store.getCurrentUser();
  const [pinnedDecks, setPinnedDecks] = useState<string[]>(() => {
    const saved = localStorage.getItem(`pinned_decks_${currentUser?.id || 'guest'}`);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineDeckIds, setOfflineDeckIds] = useState<Set<string>>(new Set());
  const [downloadingDecks, setDownloadingDecks] = useState<Set<string>>(new Set());
  const [showDownloadMenu, setShowDownloadMenu] = useState<string | null>(null);
  const [showCategoryMenu, setShowCategoryMenu] = useState<string | null>(null);
  const [showDeckMenu, setShowDeckMenu] = useState<string | null>(null);
  const [classModalDeckIds, setClassModalDeckIds] = useState<string[] | null>(null);
  const [studyEntryDeck, setStudyEntryDeck] = useState<Deck | null>(null);
  const [localEditingDeck, setLocalEditingDeck] = useState<Deck | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find the entry that is intersecting most
      const visibleEntries = entries.filter(entry => entry.isIntersecting);
      if (visibleEntries.length > 0) {
        // Sort by intersection ratio or simply pick the first one that has high visibility
        const mostVisible = visibleEntries.reduce((prev, current) => 
          (prev.intersectionRatio > current.intersectionRatio) ? prev : current
        );
        const sectionId = mostVisible.target.getAttribute('data-section-id');
        if (sectionId) {
          setActiveSectionId(sectionId);
        }
      }
    };

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', // Trigger when section is in the top 20-40% of viewport
      threshold: [0, 0.25, 0.5, 0.75, 1]
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Get all sections
    const sectionElements = document.querySelectorAll('[data-section-id]');
    sectionElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [groupBySubject]); // Re-run when grouping changes

  const handleSectionClick = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleItemClick = (itemId: string) => {
    const element = document.getElementById(`deck-${itemId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief highlight effect
      element.classList.add('ring-4', 'ring-orange-500', 'ring-opacity-50');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-orange-500', 'ring-opacity-50');
      }, 1500);
    }
  };

  const handleDownloadJson = (deck: Deck, onlyHardCards: boolean) => {
    const remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
    let cardsToDownload = deck.cards || [];
    
    if (onlyHardCards) {
      cardsToDownload = cardsToDownload.filter(c => Boolean(c.isHard) || remindIds.includes(c.id));
      if (cardsToDownload.length === 0) {
         toast.error("Không có thẻ X nào trong bộ này.");
         return;
      }
    }

    const exportData = {
      ...deck,
      cards: cardsToDownload
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

  const handleDownloadOffline = async (e: React.MouseEvent, deckId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloadingDecks.has(deckId)) return;

    try {
      setDownloadingDecks(prev => new Set(prev).add(deckId));
      await downloadCourseForOffline(deckId);
      toast.success("Đã tải xuống khóa học để dùng offline.");
      setOfflineDeckIds(prev => {
        const next = new Set(prev);
        next.add(deckId);
        return next;
      });
    } catch (err) {
      toast.error("Lỗi khi tải xuống: " + (err as Error).message);
    } finally {
      setDownloadingDecks(prev => {
        const next = new Set(prev);
        next.delete(deckId);
        return next;
      });
    }
  };

const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e: any) {
      console.warn(`LocalStorage quota exceeded when setting ${key}. Cleaning up...`);
      try {
        localStorage.removeItem('local_global_activity_feed');
        localStorage.removeItem('henosis-failed-chunks');
        localStorage.setItem(key, value);
      } catch (e2) {
        console.error(`Failed to save ${key} to localStorage even after cleanup.`);
      }
    }
  };

  const togglePin = (deckId: string) => {
    setPinnedDecks(prev => {
      const newPinned = prev.includes(deckId) 
        ? prev.filter(id => id !== deckId) 
        : [...prev, deckId];
      safeSetItem(`pinned_decks_${currentUser?.id || 'guest'}`, JSON.stringify(newPinned));
      window.dispatchEvent(new CustomEvent("vibe-pinned-updated", { detail: { pinnedDecks: newPinned } }));
      return newPinned;
    });
  };

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategoryName, setIsSavingCategoryName] = useState(false);

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || oldName === trimmedNewName) {
      setEditingCategory(null);
      return;
    }
    setIsSavingCategoryName(true);
    try {
      const { db } = await import("../lib/firebase");
      const { collection, getDocs, writeBatch, query, where } = await import("firebase/firestore");
      const currentUser = store.getCurrentUser();
      if (!currentUser) return;
      
      const setsRef = collection(db, "sets");
      const q = query(setsRef, where("createdBy", "==", currentUser.id));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const currentSubject = String(data?.subject || "Tự chọn").trim().toUpperCase();
        const targetSubject = oldName.trim().toUpperCase();
        
        if (data && currentSubject === targetSubject) {
          batch.update(docSnap.ref, { subject: trimmedNewName });
          count++;
        }
      });
      
      let countLocal = 0;
      const targetBase = oldName.trim().toUpperCase();
      const updatedLocalDecks = store.getDecks().map(d => {
        const s = String(d.subject || "Tự chọn").trim().toUpperCase();
        if (s === targetBase) {
          countLocal++;
          return { ...d, subject: trimmedNewName };
        }
        return d;
      });

      if (count > 0) {
        toast.promise(batch.commit(), {
          loading: "Đang cập nhật danh mục...",
          success: () => {
             store.setDecksLocally(updatedLocalDecks);
             // Let the realtime listener handle any UI updates.
             return "Đã đổi tên danh mục thành công!";
          },
          error: "Đã có lỗi xảy ra khi đổi tên danh mục, vui lòng thử lại.",
        });
      } else if (countLocal > 0) {
        store.setDecksLocally(updatedLocalDecks);
        toast.success("Đã đổi tên danh mục cục bộ thành công!");
      } else {
        toast.info("Không có bộ thẻ nào cần đổi tên trong danh mục này.");
      }
    } catch (err) {
      console.error("Error renaming category:", err);
      toast.error("Đã có lỗi xảy ra khi đổi tên danh mục.");
    } finally {
      setIsSavingCategoryName(false);
      setEditingCategory(null);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [smartFilter, setSmartFilter] = useState<VibeFilterType>('all');
  const [sortOrder, setSortOrder] = useState<"default" | "newest" | "oldest" | "az" | "za">(() => {
    const saved = localStorage.getItem('deckSortOrder');
    return (saved as "default" | "newest" | "oldest" | "az" | "za") || "default";
  });
  
  useEffect(() => {
    safeSetItem('deckSortOrder', sortOrder);
  }, [sortOrder]);

  const filterCounts = useMemo(() => {
    let due = 0;
    let hard = 0;
    let mastered = 0;
    let newDecks = 0;
    let pinnedCount = 0;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    let remindIds: string[] = [];
    try {
      remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
    } catch (e) {
      remindIds = [];
    }

    decks.forEach(deck => {
      let hasDue = false;
      let hasHard = false;
      const totalCards = deck.cards ? deck.cards.length : 0;
      let totalMastery = 0;

      if (pinnedDecks.includes(deck.id)) {
        pinnedCount++;
      }

      if (deck.cards) {
        deck.cards.forEach(card => {
          if (card.nextReview && card.nextReview <= now) {
            hasDue = true;
          }
          if (card.isHard || remindIds.includes(card.id)) {
            hasHard = true;
          }
          if (card.mastery) {
            totalMastery += card.mastery;
          }
        });
      }

      if (hasDue) due++;
      if (hasHard) hard++;
      const avgMastery = totalCards > 0 ? (totalMastery / totalCards) : 0;
      if (avgMastery >= 80) mastered++;

      const createdAt = deck.createdAt ? (typeof deck.createdAt === 'string' ? new Date(deck.createdAt).getTime() : deck.createdAt) : 0;
      if (createdAt >= sevenDaysAgo) newDecks++;
    });

    return {
      all: decks.length,
      pinned: pinnedCount,
      due,
      hard,
      mastered,
      new: newDecks,
    };
  }, [decks, pinnedDecks]);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const scrollContainersRef = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollCategory = (subject: string, direction: 'left' | 'right') => {
    const container = scrollContainersRef.current[subject];
    if (container) {
      const scrollAmount = container.clientWidth * 0.75; // Cuộn 75% chiều rộng container để xem bài tiếp theo một cách hợp lý
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const saveSearch = (query: string) => {
    if (!query.trim()) return;
    const newRecent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    safeSetItem('recentSearches', JSON.stringify(newRecent));
  };

  const sortedAndFilteredDecks = useMemo(() => {
    let result = [...decks].filter(deck => {
      const matchesSearch = deck.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (deck.subject || "Tự chọn").toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (smartFilter === 'all') return true;

      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      let remindIds: string[] = [];
      try {
        remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
      } catch (e) {
        remindIds = [];
      }

      if (smartFilter === 'pinned') {
        return pinnedDecks.includes(deck.id);
      }
      if (smartFilter === 'due') {
        return deck.cards?.some(c => c.nextReview && c.nextReview <= now);
      }
      if (smartFilter === 'hard') {
        return deck.cards?.some(c => c.isHard || remindIds.includes(c.id));
      }
      if (smartFilter === 'mastered') {
        if (!deck.cards || deck.cards.length === 0) return false;
        const totalMastery = deck.cards.reduce((acc, c) => acc + (c.mastery || 0), 0);
        return (totalMastery / deck.cards.length) >= 80;
      }
      if (smartFilter === 'new') {
        const createdAt = deck.createdAt ? (typeof deck.createdAt === 'string' ? new Date(deck.createdAt).getTime() : deck.createdAt) : 0;
        return createdAt >= sevenDaysAgo;
      }

      return true;
    });

    if (sortOrder === "newest") {
      result.sort((a, b) => {
        const timeA = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt) : 0;
        const timeB = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt) : 0;
        return timeB - timeA;
      });
    } else if (sortOrder === "oldest") {
      result.sort((a, b) => {
        const timeA = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt) : 0;
        const timeB = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt) : 0;
        return timeA - timeB;
      });
    } else if (sortOrder === "az") {
      result.sort((a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true }));
    } else if (sortOrder === "za") {
      result.sort((a, b) => b.title.localeCompare(a.title, 'vi', { numeric: true }));
    }

    // Always sort pinned items to the top if not grouping by subject
    // (If grouping, they are shown in a pinned section)
    result.sort((a, b) => {
      const aPinned = pinnedDecks.includes(a.id);
      const bPinned = pinnedDecks.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    return result;
  }, [decks, searchQuery, sortOrder, pinnedDecks, smartFilter]);

  const groupedDecks = useMemo(() => {
    const groups: Record<string, Deck[]> = {};
    
    sortedAndFilteredDecks.forEach((deck) => {
      if (pinnedDecks.includes(deck.id)) {
        if (!groups["📌 ĐÃ GHIM"]) groups["📌 ĐÃ GHIM"] = [];
        groups["📌 ĐÃ GHIM"].push(deck);
      }
      
      const subj = String(deck?.subject || "Tự chọn").trim();
      const normalizedSubj = subj.toUpperCase();
      if (!groups[normalizedSubj]) groups[normalizedSubj] = [];
      groups[normalizedSubj].push(deck);
    });

    return groups;
  }, [sortedAndFilteredDecks, pinnedDecks]);

  const getCreatorLabel = (d: Deck) => {
    const systemDecks = ["deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "deck_test_ui", "deck_formatting_test", "daily-quest", "remind-later-deck"];
    if (systemDecks.includes(d.id) || !d.createdBy || d.createdBy === "system") {
      return "Hệ thống";
    }
    const currentUser = store.getCurrentUser();
    if (currentUser && d.createdBy === currentUser.id) {
      return "Bởi bạn";
    }
    if (d.creatorRole === "admin" || d.creatorRole === "Admin" || d.creatorRole === "teacher") {
      return `Admin - ${(d as any).creatorName || "CoStudy Admin"}`;
    }
    return (d as any).creatorName ? `Bởi ${(d as any).creatorName}` : "Học viên";
  };

  return (
    <div className="space-y-6">
      {isFeatureEnabled("vibe-deck-stats-banner") && (
        <VibeDeckStatsBanner decks={decks} />
      )}

      {showSearch && (
        <div className="space-y-4 my-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full">
            <div className="relative w-full max-w-2xl flex-1">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-8 w-8 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm bộ thẻ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveSearch(searchQuery);
                }}
                className="block w-full pl-16 pr-16 py-5 border-2 border-zinc-300 dark:border-zinc-700 rounded-2xl bg-white dark:bg-zinc-900 focus:ring-4 focus:ring-orange-500/55 focus:border-orange-500 transition text-xl sm:text-3xl min-h-[72px] font-black"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-2 flex items-center justify-center w-16 h-16 min-w-[64px] min-h-[64px] hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors my-auto focus:outline-none"
                  aria-label="Clear Search"
                >
                  <X className="h-7 w-7 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" />
                </button>
              )}
              {isDropdownOpen && !searchQuery && recentSearches.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-4 bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-8 py-5 text-base sm:text-xl text-zinc-500 uppercase tracking-widest font-black border-b-2 border-zinc-200 dark:border-zinc-700">Tìm kiếm gần đây</div>
                  {recentSearches.map((search) => (
                    <button
                      key={search}
                      onClick={() => setSearchQuery(search)}
                      className="w-full text-left px-8 py-5 text-xl sm:text-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition font-black min-h-[64px]"
                    >
                      {search}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="w-full sm:w-auto shrink-0 flex items-center bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-2 min-h-[72px]">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-transparent text-lg sm:text-xl font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none w-full appearance-none cursor-pointer pr-8"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '1.2em' }}
              >
                <option value="default">Sắp xếp: Mặc định</option>
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất (sớm nhất)</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
              </select>
            </div>
          </div>

          {isFeatureEnabled("vibe-smart-filters") && (
            <VibeSmartFilters
              activeFilter={smartFilter}
              onFilterChange={setSmartFilter}
              counts={filterCounts}
            />
          )}
        </div>
      )}

      <div className="space-y-12">
        {sortedAndFilteredDecks.length > 0 ? (
          groupBySubject ? (
            <div className="space-y-16">
              {isFeatureEnabled("vibe-study-nav") ? null : (
                <StickyNav 
                  sections={Object.entries(groupedDecks).sort(([subjectA], [subjectB]) => {
                    if (subjectA === "📌 ĐÃ GHIM") return -1;
                    if (subjectB === "📌 ĐÃ GHIM") return 1;
                    return subjectA.localeCompare(subjectB, 'vi', { numeric: true });
                  }).map(([subject, subjectDecks]) => ({
                    id: subject,
                    title: subject,
                    items: subjectDecks.map(d => ({ id: d.id, title: d.title }))
                  }))}
                  activeSectionId={activeSectionId}
                  onSectionClick={handleSectionClick}
                  onItemClick={handleItemClick}
                />
              )}
              {(() => {
                const sortedEntries = Object.entries(groupedDecks).sort(([subjectA], [subjectB]) => {
                  if (subjectA === "📌 ĐÃ GHIM") return -1;
                  if (subjectB === "📌 ĐÃ GHIM") return 1;
                  return subjectA.localeCompare(subjectB, 'vi', { numeric: true });
                });

                const content = sortedEntries.map(([subject, subjectDecks]) => {
                  const innerContent = (
                    <div key={subject} id={isFeatureEnabled("vibe-study-nav") ? undefined : `section-${subject}`} data-section-id={isFeatureEnabled("vibe-study-nav") ? undefined : subject} className={cn("animate-in fade-in duration-300 bg-white/40 dark:bg-black/40 backdrop-blur-sm p-4 md:p-8 rounded-[2.5rem] border border-orange-500/10 shadow-[0_8px_32px_-12px_rgba(249,115,22,0.1)]", isFeatureEnabled("vibe-study-nav") ? "space-y-4 pt-2" : "space-y-8")}>
                      {/* Category Header Bar with Horizontal Control Buttons */}
                      {!isFeatureEnabled("vibe-study-nav") && (
                      <div className="sticky top-16 sm:top-20 z-30 bg-white/40 dark:bg-black/40 backdrop-blur-md pt-2 -mt-2 flex items-center justify-between gap-4 border-b border-orange-500/20 dark:border-zinc-800/60 pb-4">
                        <div className="flex items-center gap-4">
                          {!isFeatureEnabled("vibe-study-nav") && (
                            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20 shadow-sm shrink-0">
                              <BookOpen className="w-6 h-6" />
                            </span>
                          )}
                          <div className="flex items-baseline gap-3">
                            {editingCategory === subject ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              className="text-2xl sm:text-3xl font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg px-2 py-1 outline-none border border-zinc-300 dark:border-zinc-700 w-full max-w-[200px]"
                              autoFocus
                              disabled={isSavingCategoryName}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameCategory(subject, newCategoryName);
                                if (e.key === 'Escape') setEditingCategory(null);
                              }}
                            />
                            <button
                              onClick={() => handleRenameCategory(subject, newCategoryName)}
                              disabled={isSavingCategoryName}
                              className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setEditingCategory(null)}
                              disabled={isSavingCategoryName}
                              className="p-2 bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 rounded-lg shadow-sm"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <h4 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight uppercase flex items-center gap-2">
                            {subject}
                            <span className="ml-3 px-3 py-1 bg-white/50 dark:bg-black/50 text-orange-600 dark:text-orange-400 text-sm rounded-full font-bold border border-orange-500/20 shadow-sm">
                              {subjectDecks.length} Bộ
                            </span>
                            <div className="flex items-center ml-2">
                              {subject !== "📌 ĐÃ GHIM" && (
                                <div className="relative z-30">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setShowCategoryMenu(showCategoryMenu === subject ? null : subject);
                                    }}
                                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                  >
                                    <MoreHorizontal className="w-5 h-5" />
                                  </button>
                                  {showCategoryMenu === subject && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-[70]"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setShowCategoryMenu(null);
                                        }}
                                      />
                                      <div className="absolute right-0 top-full mt-2 w-56 max-w-[90vw] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700/80 z-[80] overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-150">
                                        {isAdmin && (
                                          <button
                                            onClick={() => {
                                              setShowCategoryMenu(null);
                                              setEditingCategory(subject);
                                              setNewCategoryName(subject);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-orange-600 transition-colors"
                                          >
                                            <Edit3 className="w-4 h-4" />
                                            Đổi tên danh mục
                                          </button>
                                        )}
                                        <button
                                          onClick={async () => {
                                            setShowCategoryMenu(null);
                                            if (!navigator.onLine) {
                                              toast.error("Bạn đang offline, không thể tải xuống danh mục.");
                                              return;
                                            }
                                            const { downloadCourseForOffline } = await import('../utils/offlineDb');
                                            let successCount = 0;
                                            const loadingToast = toast.loading(`Đang tải xuống ${subjectDecks.length} học phần...`);
                                            for (const deck of subjectDecks) {
                                              try {
                                                await downloadCourseForOffline(deck.id);
                                                successCount++;
                                              } catch (err) {
                                                console.error(`Failed to download ${deck.id}:`, err);
                                              }
                                            }
                                            toast.dismiss(loadingToast);
                                            if (successCount > 0) {
                                              toast.success(`Đã tải xuống thành công ${successCount}/${subjectDecks.length} học phần.`);
                                              window.dispatchEvent(new Event('henosis-offline-update'));
                                            } else {
                                              toast.error("Tải xuống thất bại. Vui lòng thử lại.");
                                            }
                                          }}
                                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-emerald-600 transition-colors"
                                        >
                                          <DownloadCloud className="w-4 h-4" />
                                          Tải xuống Offline
                                        </button>
                                        <button
                                          onClick={() => {
                                            setShowCategoryMenu(null);
                                            const categoryUrl = `${window.location.origin}/category/${encodeURIComponent(subject)}`;
                                            const shareText = `📚 Danh mục: ${subject}\n👉 Truy cập toàn bộ thẻ: ${categoryUrl}`;
                                            navigator.clipboard.writeText(shareText).then(() => {
                                              toast.success("Đã sao chép link danh mục!");
                                            }).catch(() => toast.error("Không thể sao chép."));
                                          }}
                                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-blue-600 transition-colors"
                                        >
                                          <Share2 className="w-4 h-4" />
                                          Chia sẻ
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </h4>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {subject !== "📌 ĐÃ GHIM" && (
                        <button
                          onClick={() => {
                            const categoryUrl = `${window.location.origin}/category/${encodeURIComponent(subject)}`;
                            const shareText = `📚 Phân mục: ${subject}\n👉 Xem toàn bộ học phần trong phân mục này: ${categoryUrl}`;
                            navigator.clipboard.writeText(shareText).then(() => {
                              toast.success("Đã sao chép link phân mục!", {
                                description: "Bây giờ bạn có thể dán (Paste) để chia sẻ phân mục cho bạn học.",
                              });
                            }).catch((err) => {
                              console.error("Lỗi khi sao chép: ", err);
                              toast.error("Không thể sao chép, vui lòng thử lại.");
                            });
                          }}
                          className="mr-1 text-xs font-black bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shrink-0"
                          title={`Chia sẻ phân mục ${subject}`}
                        >
                          <Share2 className="w-4 h-4 text-white shrink-0" />
                          <span className="hidden sm:inline">Chia Sẻ Phân Mục</span>
                          <span className="sm:hidden">Chia Sẻ</span>
                        </button>
                      )}
                      {onCategoryReviewHardCards && (() => {
                         const remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
                         const hardCardsInCat = subjectDecks.flatMap(d => d.cards || []).filter(c => c.isHard === true || remindIds.includes(c.id));
                         const uniqueHardCards = Array.from(new Map(hardCardsInCat.map(c => [c.id, c])).values());
                          
                         return (
                           <button
                             onClick={() => uniqueHardCards.length > 0 && onCategoryReviewHardCards(subject, subjectDecks)}
                             disabled={uniqueHardCards.length === 0}
                             className={cn(
                               "mr-1 text-xs font-black text-white px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 focus:outline-none shrink-0",
                               uniqueHardCards.length > 0
                                 ? "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.4)] cursor-pointer"
                                 : "bg-red-300 dark:bg-red-900/50 opacity-50 cursor-not-allowed"
                             )}
                             title={uniqueHardCards.length > 0 ? `Ôn lại ${uniqueHardCards.length} thẻ khó trong mục này` : `Không có thẻ nào bị đánh dấu X trong mục này`}
                           >
                             <span className="flex items-center justify-center bg-white/20 rounded-full w-5 h-5 text-[10px]">{uniqueHardCards.length}</span>
                             <span className="hidden leading-none sm:inline">Ôn Thẻ X</span>
                             <span className="sm:hidden leading-none">Thẻ X</span>
                           </button>
                         );
                      })()}
                      {onCategoryStudyAll && (() => {
                        const allCardsCount = subjectDecks.reduce((acc, d) => acc + (d.cards?.length || 0), 0);
                        if (allCardsCount > 0) {
                          return (
                            <button
                              onClick={() => onCategoryStudyAll(subject, subjectDecks)}
                              className="mr-1 text-xs font-black bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shrink-0"
                              title={`Học toàn bộ ${allCardsCount} thẻ trong mục này`}
                            >
                              <BookOpen className="w-4 h-4 text-white shrink-0" />
                              <span className="hidden leading-none sm:inline">Học Toàn Bộ</span>
                              <span className="sm:hidden leading-none">Học Hết</span>
                            </button>
                          );
                        }
                        return null;
                      })()}
                      {onCategoryQuiz && (
                        <button
                          onClick={() => onCategoryQuiz(subject, subjectDecks)}
                          className="mr-1 text-xs font-black bg-gradient-to-r from-orange-500 to-orange-500 hover:from-orange-600 hover:to-orange-600 text-white px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer shrink-0"
                          title={`Tạo đề thi AI cho mục ${subject}`}
                        >
                          <Sparkles className="w-4 h-4 text-white animate-pulse shrink-0" />
                          <span className="hidden leading-none sm:inline">Tạo Đề Thi AI Mục Này</span>
                          <span className="sm:hidden leading-none">Thi AI</span>
                        </button>
                      )}
                      {subject !== "📌 ĐÃ GHIM" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setClassModalDeckIds(subjectDecks.map(d => d.id)); }}
                          className="mr-1 text-xs font-black bg-gradient-to-r from-orange-500 to-orange-500 hover:from-orange-600 hover:to-orange-600 text-white px-4 py-2.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer shrink-0"
                          title={`Thêm toàn bộ phân mục vào Lớp học`}
                        >
                          <Layers className="w-4 h-4 text-white shrink-0" />
                          <span className="hidden leading-none sm:inline">Thêm vào Lớp</span>
                          <span className="sm:hidden leading-none">Lớp</span>
                        </button>
                      )}

                      {/* Scroll buttons for Desktop navigation */}
                      {!isFeatureEnabled("vibe-study-nav") && subjectDecks.length > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => scrollCategory(subject, 'left')}
                            className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            title="Cuộn sang trái"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => scrollCategory(subject, 'right')}
                            className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            title="Cuộn sang phải"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Horizontal or Vertical Area for this Category */}
                  <div
                    ref={(el) => { scrollContainersRef.current[subject] = el; }}
                    className={cn(
                      "pb-6 pt-2 px-1 overflow-visible",
                      isFeatureEnabled("vibe-study-nav")
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                        : "flex overflow-x-auto gap-6 sm:gap-8 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-orange-500/20 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700/50 [&::-webkit-scrollbar-thumb]:rounded-full cursor-grab active:cursor-grabbing"
                    )}
                  >
                    {subjectDecks.map((deck, idx) => {
                      const masteredCount = deck.cards.filter(c => c.mastery >= 80).length;
                      const masteryRate = deck.cards.length > 0 ? Math.round((masteredCount / deck.cards.length) * 100) : 0;
                      
                      const estimatedSeconds = deck.cards.reduce((acc, card) => {
                          const m = card.mastery || 0;
                          if (m >= 80) return acc + 10;
                          if (m >= 50) return acc + 25;
                          if (m >= 20) return acc + 40;
                          return acc + 60;
                      }, 0);
                      const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
                      
                      const isOfflineUnavailable = !isOnline && !offlineDeckIds.has(deck.id);

                      return (
                        <TiltCard key={`${deck.id || "deck"}-${idx}`} delayIdx={idx} cards={deck.cards} onClick={() => setStudyEntryDeck(deck as any)} className={cn(
                          "shrink-0 h-auto",
                          isFeatureEnabled("vibe-study-nav") ? "w-full" : "w-[85vw] sm:w-[380px] snap-start",
                          isOfflineUnavailable && "opacity-40 grayscale pointer-events-none",
                          showDeckMenu === deck.id ? "z-[60] relative" : "relative z-10"
                        )}>
                          <div className="absolute top-4 right-4 z-20 flex gap-2">
                            {isOfflineUnavailable && (
                               <div className="px-3 py-1.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-wider flex items-center border-2 border-red-500/20 backdrop-blur-md shadow-sm">
                                  Offline
                               </div>
                            )}
                            {offlineDeckIds.has(deck.id) && (
                               <div className="p-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400" title="Đã có thể học offline">
                                 <Check className="w-5 h-5" />
                               </div>
                            )}
                            <div className="relative z-30">
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(showDeckMenu === deck.id ? null : deck.id); }}
                                className="p-2 rounded-full transition-colors bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                title="Tùy chọn"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                              {showDeckMenu === deck.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-[70]"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setShowDeckMenu(null);
                                    }}
                                  />
                                  <div 
                                    className="absolute right-0 top-full mt-2 w-56 max-w-[90vw] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700/80 z-[80] overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-150"
                                    style={{ transform: "translateZ(80px)" }}
                                    onClick={(e) => { e.stopPropagation(); }}
                                  >
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); togglePin(deck.id); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                    >
                                      {pinnedDecks.includes(deck.id) ? (
                                        <><PinOff className="w-4 h-4" /> Bỏ ghim</>
                                      ) : (
                                        <><Pin className="w-4 h-4" /> Ghim học phần</>
                                      )}
                                    </button>
                                    
                                    {(isAdmin || deck.createdBy === currentUser?.id) && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); if (onEditDeck) onEditDeck(deck); else setLocalEditingDeck(deck); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                        Sửa tên & danh mục
                                      </button>
                                    )}
                                    
                                    <button
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); setClassModalDeckIds([deck.id]); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                    >
                                      <Layers className="w-4 h-4" />
                                      Thêm vào Lớp học
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setShowDeckMenu(null);
                                        const deckUrl = `${window.location.origin}/study/${deck.id}`;
                                        const shareText = `📚 Học phần: ${deck.title}\n👉 Tham gia học ngay: ${deckUrl}`;
                                        navigator.clipboard.writeText(shareText).then(() => {
                                          toast.success("Đã sao chép link học phần!");
                                        }).catch(() => toast.error("Không thể sao chép."));
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                    >
                                      <Share2 className="w-4 h-4" />
                                      Chia sẻ học phần
                                    </button>

                                    {isOnline && !offlineDeckIds.has(deck.id) && !deck.id.startsWith("remind-later-") && (
                                      <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); handleDownloadOffline(e, deck.id); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                      >
                                        {downloadingDecks.has(deck.id) ? <Check className="w-4 h-4 animate-pulse" /> : <DownloadCloud className="w-4 h-4" />}
                                        Tải xuống Offline
                                      </button>
                                    )}

                                    <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1"></div>

                                    <button
                                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); handleDownloadJson(deck, false); }}
                                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                    >
                                      <FileJson className="w-4 h-4" />
                                      Tải JSON (Toàn bộ)
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="relative z-10 flex flex-col h-full [transform:translateZ(30px)] pt-2">
                            <h4 className="font-extrabold text-xl sm:text-2xl mb-2 pr-10 text-zinc-900 dark:text-white group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors line-clamp-2 break-all break-words leading-relaxed">{deck.title}</h4>
                            
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                              <span className="text-xs sm:text-sm px-2.5 py-1 rounded-lg font-mono font-black uppercase tracking-wider bg-orange-500/15 text-orange-600 dark:text-orange-400 border-2 border-orange-500/20 leading-relaxed">
                                {getCreatorLabel(deck)}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1 rounded-lg font-mono font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border-2 border-purple-500/20 leading-relaxed">
                                {deck.cards?.length || 0} Thẻ
                              </span>
                              {(() => {
                                const now = Date.now();
                                const dueCount = deck.cards ? deck.cards.filter(c => c.nextReview && c.nextReview <= now).length : 0;
                                if (dueCount > 0 && isFeatureEnabled("vibe-spaced-repetition-tracker")) {
                                  return (
                                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-extrabold bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-sm animate-pulse">
                                      🔥 Cần ôn: {dueCount} thẻ
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            {(() => {
                              const now = Date.now();
                              const dueCount = deck.cards ? deck.cards.filter(c => c.nextReview && c.nextReview <= now).length : 0;
                              if (dueCount > 0 && isFeatureEnabled("vibe-spaced-repetition-tracker")) {
                                return (
                                  <div className="mt-auto pt-2">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setStudyEntryDeck(deck as any);
                                      }}
                                      className="w-full py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-[1.02]"
                                    >
                                      <span>⚡ Ôn ngay 1-Click</span>
                                    </button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </TiltCard>
                      );
                    })}
                  </div>
                </div>
              );
              
              if (isFeatureEnabled("vibe-study-nav")) {
                const headerActions = (
                  <>
                    {subject !== "📌 ĐÃ GHIM" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const categoryUrl = `${window.location.origin}/category/${encodeURIComponent(subject)}`;
                          const shareText = `📚 Phân mục: ${subject}\n👉 Xem toàn bộ học phần trong phân mục này: ${categoryUrl}`;
                          navigator.clipboard.writeText(shareText).then(() => {
                            toast.success("Đã sao chép link phân mục!", {
                              description: "Bây giờ bạn có thể dán (Paste) để chia sẻ phân mục cho bạn học.",
                            });
                          }).catch((err) => {
                            console.error("Lỗi khi sao chép: ", err);
                            toast.error("Không thể sao chép, vui lòng thử lại.");
                          });
                        }}
                        className="text-[10px] sm:text-xs font-black bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:scale-105 shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                        title={`Chia sẻ phân mục ${subject}`}
                      >
                        <Share2 className="w-3 h-3 text-white shrink-0" />
                        <span className="hidden sm:inline">Chia Sẻ</span>
                      </button>
                    )}
                    {onCategoryReviewHardCards && (() => {
                       const remindIds = JSON.parse(localStorage.getItem("remind_later_items") || "[]");
                       const hardCardsInCat = subjectDecks.flatMap(d => d.cards || []).filter(c => c.isHard === true || remindIds.includes(c.id));
                       const uniqueHardCards = Array.from(new Map(hardCardsInCat.map(c => [c.id, c])).values());
                       return (
                         <button
                           onClick={(e) => { e.stopPropagation(); uniqueHardCards.length > 0 && onCategoryReviewHardCards(subject, subjectDecks); }}
                           disabled={uniqueHardCards.length === 0}
                           className={cn(
                             "text-[10px] sm:text-xs font-black text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0",
                             uniqueHardCards.length > 0
                               ? "bg-gradient-to-r from-red-500 to-rose-500 hover:scale-105 shadow-md cursor-pointer"
                               : "bg-red-300 dark:bg-red-900/50 opacity-50 cursor-not-allowed"
                           )}
                           title={`Ôn ${uniqueHardCards.length} thẻ khó`}
                         >
                           <span className="flex items-center justify-center bg-white/20 rounded-full w-4 h-4 text-[9px]">{uniqueHardCards.length}</span>
                           <span className="hidden sm:inline">Ôn Thẻ X</span>
                         </button>
                       );
                    })()}
                    {onCategoryStudyAll && (() => {
                      const allCardsCount = subjectDecks.reduce((acc, d) => acc + (d.cards?.length || 0), 0);
                      if (allCardsCount > 0) {
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); onCategoryStudyAll(subject, subjectDecks); }}
                            className="text-[10px] sm:text-xs font-black bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:scale-105 shadow-md flex items-center gap-1.5 shrink-0"
                            title={`Học toàn bộ ${allCardsCount} thẻ`}
                          >
                            <BookOpen className="w-3 h-3 text-white shrink-0" />
                            <span className="hidden sm:inline">Học Hết</span>
                          </button>
                        );
                      }
                      return null;
                    })()}
                    {onCategoryQuiz && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onCategoryQuiz(subject, subjectDecks); }}
                        className="text-[10px] sm:text-xs font-black bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-black px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:scale-105 shadow-md flex items-center gap-1.5 shrink-0"
                        title={`Tạo đề thi AI`}
                      >
                        <Sparkles className="w-3 h-3 text-black animate-pulse shrink-0" />
                        <span className="hidden sm:inline">Thi AI</span>
                      </button>
                    )}
                    {subject !== "📌 ĐÃ GHIM" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setClassModalDeckIds(subjectDecks.map(d => d.id)); }}
                        className="text-[10px] sm:text-xs font-black bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-black px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl hover:scale-105 shadow-md flex items-center gap-1.5 shrink-0"
                        title={`Thêm toàn bộ phân mục vào Lớp học`}
                      >
                        <Layers className="w-3 h-3 text-black shrink-0" />
                        <span className="hidden sm:inline">Thêm vào Lớp</span>
                      </button>
                    )}
                  </>
                );

                return (
                  <VibeNavGroup key={subject} id={subject} title={subject} headerActions={headerActions}>
                    {innerContent}
                  </VibeNavGroup>
                );
              }
              
              return innerContent;
            });

            if (isFeatureEnabled("vibe-study-nav")) {
              return (
                <VibeStickyStudyNav defaultOpenId={activeSectionId || undefined}>
                  {content}
                </VibeStickyStudyNav>
              );
            }

            return <>{content}</>;
          })()}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10">
              {sortedAndFilteredDecks.map((deck, idx) => {
                const masteredCount = deck.cards.filter(c => c.mastery >= 80).length;
                const masteryRate = deck.cards.length > 0 ? Math.round((masteredCount / deck.cards.length) * 100) : 0;
                
                const estimatedSeconds = deck.cards.reduce((acc, card) => {
                    const m = card.mastery || 0;
                    if (m >= 80) return acc + 10;
                    if (m >= 50) return acc + 25;
                    if (m >= 20) return acc + 40;
                    return acc + 60;
                }, 0);
                const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
                
                const isOfflineUnavailable = !isOnline && !offlineDeckIds.has(deck.id);

                return (
                  <TiltCard key={`${deck.id || "deck"}-${idx}`} delayIdx={idx} cards={deck.cards} onClick={() => navigate(`/study/${deck.id}`)} className={cn(
                    "shrink-0 h-auto w-full",
                    isOfflineUnavailable && "opacity-40 grayscale pointer-events-none"
                  )}>
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                      {isOfflineUnavailable && (
                         <div className="px-3 py-1.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-wider flex items-center border-2 border-red-500/20 backdrop-blur-md shadow-sm">
                            Offline
                         </div>
                      )}
                      {offlineDeckIds.has(deck.id) && (
                         <div className="p-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400" title="Đã có thể học offline">
                           <Check className="w-5 h-5" />
                         </div>
                      )}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(showDeckMenu === deck.id ? null : deck.id); }}
                          className="p-2 rounded-full transition-colors bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          title="Tùy chọn"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {showDeckMenu === deck.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowDeckMenu(null);
                              }}
                            />
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden py-1">
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); togglePin(deck.id); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                              >
                                {pinnedDecks.includes(deck.id) ? (
                                  <><PinOff className="w-4 h-4" /> Bỏ ghim</>
                                ) : (
                                  <><Pin className="w-4 h-4" /> Ghim học phần</>
                                )}
                              </button>
                                
                              {(isAdmin || deck.createdBy === currentUser?.id) && (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); if (onEditDeck) onEditDeck(deck); else setLocalEditingDeck(deck); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  Sửa tên & danh mục
                                </button>
                              )}
                                
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); setClassModalDeckIds([deck.id]); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                              >
                                <Layers className="w-4 h-4" />
                                Thêm vào Lớp học
                              </button>

                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowDeckMenu(null);
                                  const deckUrl = `${window.location.origin}/study/${deck.id}`;
                                  const shareText = `📚 Học phần: ${deck.title}\n👉 Tham gia học ngay: ${deckUrl}`;
                                  navigator.clipboard.writeText(shareText).then(() => {
                                    toast.success("Đã sao chép link học phần!");
                                  }).catch(() => toast.error("Không thể sao chép."));
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                              >
                                <Share2 className="w-4 h-4" />
                                Chia sẻ học phần
                              </button>

                              {isOnline && !offlineDeckIds.has(deck.id) && !deck.id.startsWith("remind-later-") && (
                                <button
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); handleDownloadOffline(e, deck.id); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                >
                                  {downloadingDecks.has(deck.id) ? <Check className="w-4 h-4 animate-pulse" /> : <DownloadCloud className="w-4 h-4" />}
                                  Tải xuống Offline
                                </button>
                              )}

                              <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800 my-1"></div>

                              <button
                                 onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDeckMenu(null); handleDownloadJson(deck, false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                              >
                                <FileJson className="w-4 h-4" />
                                Tải JSON (Toàn bộ)
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="relative z-10 flex flex-col h-full [transform:translateZ(30px)] pt-2">
                      <h4 className="font-extrabold text-xl sm:text-2xl mb-2 pr-10 text-zinc-900 dark:text-white group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors line-clamp-2 break-all break-words leading-relaxed">{deck.title}</h4>
                        
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-xs sm:text-sm px-2.5 py-1 rounded-lg font-mono font-black uppercase tracking-wider bg-orange-500/15 text-orange-600 dark:text-orange-400 border-2 border-orange-500/20 leading-relaxed">
                          {getCreatorLabel(deck)}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs sm:text-sm px-2.5 py-1 rounded-lg font-mono font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border-2 border-purple-500/20 leading-relaxed">
                          {deck.cards?.length || 0} Thẻ
                        </span>
                        {(() => {
                          const now = Date.now();
                          const dueCount = deck.cards ? deck.cards.filter(c => c.nextReview && c.nextReview <= now).length : 0;
                          if (dueCount > 0 && isFeatureEnabled("vibe-spaced-repetition-tracker")) {
                            return (
                              <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-extrabold bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-sm animate-pulse">
                                🔥 Cần ôn: {dueCount} thẻ
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      
                      {(() => {
                        const now = Date.now();
                        const dueCount = deck.cards ? deck.cards.filter(c => c.nextReview && c.nextReview <= now).length : 0;
                        if (dueCount > 0 && isFeatureEnabled("vibe-spaced-repetition-tracker")) {
                          return (
                            <div className="mt-auto pt-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setStudyEntryDeck(deck as any);
                                }}
                                className="w-full py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer hover:scale-[1.02]"
                              >
                                <span>⚡ Ôn ngay 1-Click</span>
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          )
        ) : (
          <div className="p-12 text-center text-zinc-500 space-y-6">
            <p className="text-xl sm:text-3xl font-black italic leading-loose">Không tìm thấy bộ thẻ nào phù hợp.</p>
            <button className="text-orange-600 dark:text-orange-400 font-black hover:underline text-xl sm:text-3xl p-4 min-h-[56px] inline-flex items-center gap-2">
                Tạo bộ thẻ mới
            </button>
          </div>
        )}
      </div>
      {classModalDeckIds && (
        <VibeClassModal
          isOpen={true}
          onClose={() => setClassModalDeckIds(null)}
          deckIds={classModalDeckIds}
        />
      )}
      {localEditingDeck && (
        <EditDeckModal
          isOpen={true}
          onClose={() => setLocalEditingDeck(null)}
          deckId={localEditingDeck.id}
          initialTitle={typeof localEditingDeck.title === "string" ? localEditingDeck.title : JSON.stringify(localEditingDeck.title)}
          initialSubject={typeof localEditingDeck.subject === "string" ? localEditingDeck.subject : (localEditingDeck.subject ? JSON.stringify(localEditingDeck.subject) : "general")}
          onSaveSuccess={() => {
            // State will update via store subscription if any, or reload
          }}
        />
      )}
      <VibeStudyEntryModal
        isOpen={!!studyEntryDeck}
        onClose={() => setStudyEntryDeck(null)}
        deck={studyEntryDeck}
      />
    </div>
  );
};
