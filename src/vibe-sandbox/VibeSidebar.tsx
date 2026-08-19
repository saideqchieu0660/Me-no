import React, { useState, useEffect } from "react";
import {
  Home,
  BookOpen,
  Library,
  Plus,
  Trophy,
  User,
  Settings,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  X,
  Menu,
  Sparkles,
  Shield,
  LayoutGrid,
  BarChart3,
  Layers,
  Cpu
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { store, Deck } from "../lib/store";
import { cn } from "../lib/utils";
import { isFeatureEnabled } from "../features.config";
import { VibeStudyEntryModal } from "./VibeStudyEntryModal";

interface VibeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  onOpenSettings?: () => void;
}

interface TreeFolderItem {
  name: string;
  count?: number;
  isOpen?: boolean;
  children?: {
    id: string;
    title: string;
    cardCount: number;
    subject?: string;
  }[];
}

export const VibeSidebar: React.FC<VibeSidebarProps> = ({
  isOpen,
  onClose,
  onToggle,
  onOpenSettings,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [studyEntryDeck, setStudyEntryDeck] = useState<Deck | null>(null);
  
  const [activeTab, setActiveTabState] = useState<string>(() => {
    return sessionStorage.getItem("student_dashboard_tab") || "all_sets";
  });
  
  const [studySetsExpanded, setStudySetsExpanded] = useState<boolean>(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "📌 ĐÃ GHIM": true,
    English: true,
    Japanese: false,
    General: true,
  });

  const [decks, setDecks] = useState<Deck[]>(() => store.getDecks());
  const [pinnedDecks, setPinnedDecks] = useState<string[]>(() => {
    const currentUser = store.getCurrentUser();
    const saved = localStorage.getItem(`pinned_decks_${currentUser?.id || 'guest'}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Listen for external tab changes & pin changes
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.tab) {
        setActiveTabState(customEvent.detail.tab);
      }
    };
    window.addEventListener("vibe-tab-change", handleTabChange as EventListener);
    
    const handlePinnedUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.pinnedDecks) {
        setPinnedDecks(customEvent.detail.pinnedDecks);
      }
    };
    window.addEventListener("vibe-pinned-updated", handlePinnedUpdated as EventListener);

    // Subscribe to store updates for decks
    const handleSync = () => {
      setDecks(store.getDecks());
      const currentUser = store.getCurrentUser();
      const saved = localStorage.getItem(`pinned_decks_${currentUser?.id || 'guest'}`);
      setPinnedDecks(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener("henosis-data-synced", handleSync);

    return () => {
      window.removeEventListener("vibe-tab-change", handleTabChange as EventListener);
      window.removeEventListener("vibe-pinned-updated", handlePinnedUpdated as EventListener);
      window.removeEventListener("henosis-data-synced", handleSync);
    };
  }, []);

  const handleSelectTab = (tabId: string, path?: string) => {
    setActiveTabState(tabId);
    sessionStorage.setItem("student_dashboard_tab", tabId);
    
    // Dispatch custom event so StudentDashboard updates its state
    window.dispatchEvent(
      new CustomEvent("vibe-tab-change", { detail: { tab: tabId } })
    );

    if (path) {
      navigate(path);
    } else if (location.pathname !== "/dashboard" && location.pathname !== "/") {
      navigate("/dashboard");
    }

    // Auto close on mobile
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const toggleFolder = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  // Group decks by Subject into tree structure with Pinned category on top
  const groupedDecksBySubject = React.useMemo(() => {
    const groups: Record<string, Deck[]> = {};
    
    // Add Pinned decks section if any exist
    const pinnedList = decks.filter(d => pinnedDecks.includes(d.id));
    if (pinnedList.length > 0) {
      groups["📌 ĐÃ GHIM"] = pinnedList;
    }

    decks.forEach((deck) => {
      const subj = deck.subject || "Thư mục chung";
      if (!groups[subj]) groups[subj] = [];
      groups[subj].push(deck);
    });
    return groups;
  }, [decks, pinnedDecks]);

  const currentPath = location.pathname;

  const navItems = [
    {
      id: "study_sets_group",
      label: "📚 Study Sets",
      icon: BookOpen,
      isGroup: true,
    },
    {
      id: "library",
      label: "📚 Thư Viện",
      icon: Library,
      action: () => handleSelectTab("all_sets"),
    },
    {
      id: "create_deck",
      label: "✨ Tạo Bộ Thẻ",
      icon: Plus,
      action: () => handleSelectTab("create_deck"),
    },
    {
      id: "vibe-classes",
      label: "🏫 Lớp Học",
      icon: Layers,
      action: () => handleSelectTab("vibe-classes"),
    },
    {
      id: "ranking",
      label: "🏆 Bảng Xếp Hạng",
      icon: BarChart3,
      enabled: isFeatureEnabled("ENABLE_RANKING"),
      action: () => handleSelectTab("ranking"),
    },
    {
      id: "profile",
      label: "👤 Hồ Sơ",
      icon: User,
      action: () => handleSelectTab("profile"),
    },
    {
      id: "united-engine",
      label: "🔄 United Engine",
      icon: Cpu,
      action: () => handleSelectTab("united-engine"),
    },
    {
      id: "settings",
      label: "⚙️ Cài Đặt",
      icon: Settings,
      action: () => {
        if (onOpenSettings) onOpenSettings();
        else handleSelectTab("settings");
      },
    },
  ];

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-[1010] w-72 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out pt-safe pb-safe",
          isOpen 
            ? "translate-x-0 md:sticky md:top-24 md:h-[calc(100dvh-7rem-env(safe-area-inset-bottom,0px))] md:z-30 md:w-64 md:shrink-0 md:pt-0" 
            : "-translate-x-full md:translate-x-0 md:sticky md:top-24 md:h-[calc(100dvh-7rem-env(safe-area-inset-bottom,0px))] md:z-30 md:w-64 md:shrink-0 md:pt-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 md:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items Body */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 hide-scrollbar">
          {navItems
            .filter((item) => item.enabled !== false)
            .map((item) => {
              if (item.isGroup) {
                return (
                  <div key={item.id} className="pt-2 pb-1">
                    {/* Study Sets Group Header */}
                    <button
                      onClick={() => setStudySetsExpanded((prev) => !prev)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-orange-500 transition-colors rounded-xl"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        
                        <span>{item.label}</span>
                      </div>
                      {studySetsExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                      )}
                    </button>

                    {/* Study Sets Tree View Hierarchy */}
                    {studySetsExpanded && (
                      <div className="mt-1 ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-800 space-y-1 text-sm">
                        {Object.entries(groupedDecksBySubject).map(
                          ([subjName, subjDecks]) => {
                            const isFolderExpanded =
                              expandedFolders[subjName] ?? false;
                            const totalCards = subjDecks.reduce(
                              (acc, d) => acc + (d.cards?.length || 0),
                              0
                            );

                            return (
                              <div key={subjName} className="space-y-1">
                                <button
                                  onClick={(e) => toggleFolder(subjName, e)}
                                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition text-xs font-semibold group"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {isFolderExpanded ? (
                                      <FolderOpen className="w-4 h-4 text-orange-500 shrink-0" />
                                    ) : (
                                      <Folder className="w-4 h-4 text-zinc-400 group-hover:text-orange-500 shrink-0" />
                                    )}
                                    <span className="truncate">{subjName}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 font-mono">
                                      {subjDecks.length}
                                    </span>
                                    {isFolderExpanded ? (
                                      <ChevronDown className="w-3 h-3 text-zinc-400" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 text-zinc-400" />
                                    )}
                                  </div>
                                </button>

                                {/* Child Decks in Folder */}
                                {isFolderExpanded && (
                                  <div className="ml-4 space-y-0.5 border-l border-orange-500/20 pl-2">
                                    {subjDecks.map((deck) => (
                                      <button
                                        key={deck.id}
                                        onClick={() => {
                                          handleSelectTab("all_sets");
                                          setStudyEntryDeck(deck);
                                        }}
                                        className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-300 hover:bg-orange-500/5 transition group text-left"
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="text-orange-500/80">🃏</span>
                                          <span className="truncate font-medium">
                                            {deck.title}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-zinc-400 font-mono shrink-0 ml-1">
                                          {deck.cards?.length || 0} thẻ
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              const isPathActive = (item as any).path && currentPath === (item as any).path;
              const isTabActive =
                !(item as any).path &&
                currentPath === "/dashboard" &&
                activeTab === item.id;
              const isActive = isPathActive || isTabActive;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) item.action();
                    else if ((item as any).path) handleSelectTab(item.id, (item as any).path);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group relative",
                    isActive
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900  font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    
                    <span>{item.label}</span>
                  </div>

                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                  )}
                </button>
              );
            })}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
          <span className="font-mono text-[10px]">Henosis v2.5 • Sandbox</span>
          <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-[10px]">
            Vibe Mode
          </span>
        </div>
      </aside>
      <VibeStudyEntryModal
        isOpen={!!studyEntryDeck}
        onClose={() => setStudyEntryDeck(null)}
        deck={studyEntryDeck as Deck}
      />
    </>
  );
};

export default VibeSidebar;
