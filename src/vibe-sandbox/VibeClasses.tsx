import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, UserPlus, BookOpen, BarChart3, Plus, Trash2, 
  Settings, ChevronRight, Copy, Check, Clock, Play, Folder, FolderOpen,
  MoreVertical, Share2, DownloadCloud
} from "lucide-react";
import { store, Deck } from "../lib/store";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "../lib/firebase";
import { getCreatorLabel } from "../utils/xp";
import { StickyNav } from "../components/StickyNav";
import { isFeatureEnabled } from "../features.config";
import { VibeStickyStudyNav, VibeNavGroup } from "./VibeStickyStudyNav";
import { cn } from "../lib/utils";
import { DeckOptionsMenu } from "../components/DeckOptionsMenu";

interface VibeClass {
  id: string;
  name: string;
  description: string;
  createdBy: string; // User ID
  members: { id: string; name: string; role: 'admin' | 'student' }[];
  deckIds: string[]; // Added study sets
}

export const VibeClasses: React.FC = () => {
  const [classes, setClasses] = useState<VibeClass[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDesc, setNewClassDesc] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [showCategoryMenu, setShowCategoryMenu] = useState<string | null>(null);
  const isLoadedRef = React.useRef(false);

  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      const visibleEntries = entries.filter(entry => entry.isIntersecting);
      if (visibleEntries.length > 0) {
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
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1]
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const sectionElements = document.querySelectorAll('[data-section-id]');
    sectionElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [classes]); // Re-run when classes change

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
      element.classList.add('ring-4', 'ring-orange-500', 'ring-opacity-50');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-orange-500', 'ring-opacity-50');
      }, 1500);
    }
  };

  const currentUser = auth.currentUser;
  const currentUserId = currentUser?.uid || "guest";
  const currentUserName = currentUser?.displayName || "Guest Student";

  useEffect(() => {
    const loadedClasses = localStorage.getItem("vibe_classes");
    let parsedClasses: VibeClass[] = [];
    if (loadedClasses) {
      try {
        parsedClasses = JSON.parse(loadedClasses);
      } catch (e) {
        console.error("Error parsing local classes", e);
      }
    }

    const hasLocalSystemClass = parsedClasses.some(c => c.id === "class-local-system");
    const isLocalWithoutFirebase = !currentUser;

    if (isLocalWithoutFirebase && !hasLocalSystemClass) {
      const defaultSystemClass: VibeClass = {
        id: "class-local-system",
        name: "Lớp Học Hệ Thống (Local Sandbox)",
        description: "Lớp học mẫu hoạt động cục bộ được tạo sẵn cho việc chạy thử nghiệm ngoại tuyến khi không kết nối Firebase.",
        createdBy: "anonymous",
        members: [
          { id: "anonymous", name: "Anonymous Teacher (Giáo viên)", role: 'admin' },
          { id: currentUserId, name: currentUserName, role: 'student' }
        ],
        deckIds: []
      };

      const localDecks = store.getDecks();
      if (localDecks && localDecks.length > 0) {
        defaultSystemClass.deckIds = localDecks.slice(0, 2).map(d => d.id);
      }

      parsedClasses = [defaultSystemClass, ...parsedClasses];
      setClasses(parsedClasses);
      localStorage.setItem("vibe_classes", JSON.stringify(parsedClasses));
    } else {
      setClasses(parsedClasses);
    }
    isLoadedRef.current = true;
  }, [currentUser, currentUserId, currentUserName]);

  useEffect(() => {
    if (isLoadedRef.current) {
      localStorage.setItem("vibe_classes", JSON.stringify(classes));
    }
  }, [classes]);

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const newClass: VibeClass = {
      id: "class-" + Math.random().toString(36).substr(2, 9),
      name: newClassName.trim(),
      description: newClassDesc.trim(),
      createdBy: currentUserId,
      members: [{ id: currentUserId, name: currentUserName, role: 'admin' }],
      deckIds: []
    };

    setClasses([...classes, newClass]);
    setIsCreating(false);
    setNewClassName("");
    setNewClassDesc("");
    toast.success("Đã tạo lớp học thành công!");
  };

  const handleDeleteClass = (classId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa lớp học này không? Hành động này không thể hoàn tác.")) {
      const updatedClasses = classes.filter(c => c.id !== classId);
      setClasses(updatedClasses);
      toast.success("Đã xóa lớp học thành công!");
    }
  };

  const handleJoinClass = () => {
    const code = prompt("Nhập mã lớp học (Class ID):");
    if (!code) return;

    const targetClass = classes.find(c => c.id === code);
    if (!targetClass) {
      toast.error("Không tìm thấy lớp học với mã này.");
      return;
    }

    if (targetClass.members.some(m => m.id === currentUserId)) {
      toast.info("Bạn đã ở trong lớp học này rồi.");
      return;
    }

    const updatedClasses = classes.map(c => {
      if (c.id === code) {
        return {
          ...c,
          members: [...c.members, { id: currentUserId, name: currentUserName, role: 'student' as const }]
        };
      }
      return c;
    });

    setClasses(updatedClasses);
    toast.success("Đã tham gia lớp học thành công!");
  };


  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-400">Lớp Học (Vibe)</h2>
          <p className="text-zinc-500 mt-2">Quản lý lớp học, thành viên và học phần của bạn</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleJoinClass}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            Tham gia bằng mã
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition flex items-center gap-2 shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-5 h-5" /> Tạo lớp mới
          </button>
        </div>
      </div>

      {isCreating && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-8 shadow-xl"
        >
          <h3 className="text-xl font-bold mb-4">Tạo Lớp Học Mới</h3>
          <form onSubmit={handleCreateClass} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1">Tên lớp học</label>
              <input 
                type="text" 
                value={newClassName}
                onChange={e => setNewClassName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                placeholder="VD: Lớp Tiếng Anh 101"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-500 mb-1">Mô tả (tùy chọn)</label>
              <input 
                type="text" 
                value={newClassDesc}
                onChange={e => setNewClassDesc(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500"
                placeholder="VD: Học phần dành cho kỳ thi Toeic..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              >
                Hủy
              </button>
              <button 
                type="submit"
                disabled={!newClassName.trim()}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-bold disabled:opacity-50 hover:bg-orange-600 transition"
              >
                Tạo Lớp
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {isFeatureEnabled("vibe-study-nav") ? null : (
        <StickyNav 
          sections={classes.map(cls => ({
            id: cls.id,
            title: cls.name,
            items: cls.deckIds.map(deckId => {
              const deck = store.getDecks().find(d => d.id === deckId);
              return { id: deckId, title: deck?.title || "Unknown Deck" };
            })
          }))}
          activeSectionId={activeSectionId}
          onSectionClick={handleSectionClick}
          onItemClick={handleItemClick}
        />
      )}

      <div className="space-y-12">
        {classes.length === 0 && !isCreating && (
          <div className="py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
            <Users className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-xl font-bold text-zinc-500 mb-2">Bạn chưa tham gia lớp học nào</h3>
            <p className="text-zinc-400 mb-6">Tạo một lớp học mới hoặc tham gia bằng mã được chia sẻ</p>
          </div>
        )}

        {(() => {
          const content = classes.map(activeClass => {
            const innerContent = (
              <div key={activeClass.id} id={isFeatureEnabled("vibe-study-nav") ? undefined : `section-${activeClass.id}`} data-section-id={isFeatureEnabled("vibe-study-nav") ? undefined : activeClass.id} className="space-y-6 pt-4">
                <div className="flex items-center gap-4 mb-6">
                  {!isFeatureEnabled("vibe-study-nav") && (
                    <h2 className="text-3xl font-bold">{activeClass.name}</h2>
                  )}
                  <span className="text-sm px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 font-bold">
                    ID: {activeClass.id}
                  </span>
                </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lớp Học Info & Roster */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Settings className="w-5 h-5 text-orange-500" /> Thông tin lớp
                    </h3>
                    {(activeClass.createdBy === currentUserId || activeClass.members.some(m => m.id === currentUserId && m.role === 'admin')) && (
                      <button
                        onClick={() => handleDeleteClass(activeClass.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition"
                        title="Xóa lớp học"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-500 text-sm mb-6">{activeClass.description || "Không có mô tả"}</p>
                  
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Mã mời tham gia</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white dark:bg-zinc-950 px-3 py-2 rounded-lg text-orange-600 font-mono text-sm border border-orange-500/20 truncate">
                        {activeClass.id}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(activeClass.id);
                          setCopiedId(activeClass.id);
                          setTimeout(() => setCopiedId(null), 2000);
                          toast.success("Đã sao chép mã mời!");
                        }}
                        className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition shrink-0"
                      >
                        {copiedId === activeClass.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" /> Thành viên ({activeClass.members.length})
                  </h3>
                  <div className="space-y-3">
                    {activeClass.members.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{member.name} {member.id === currentUserId ? "(Bạn)" : ""}</span>
                        </div>
                        {member.role === 'admin' && (
                          <span className="text-[10px] font-black uppercase bg-orange-500/10 text-orange-500 px-2 py-1 rounded">Admin</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Study Material & Progress */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-500" /> Học phần của lớp
                    </h3>
                    {activeClass.createdBy === currentUserId && (
                      <span className="text-xs bg-orange-500/10 text-orange-600 px-3 py-1.5 rounded-full font-bold">
                        💡 Vào các học phần để thêm vào lớp
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    {activeClass.deckIds.length === 0 ? (
                      <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
                        <p className="text-zinc-500">Chưa có học phần nào được thêm vào lớp này.</p>
                      </div>
                    ) : (
                      (() => {
                        const grouped: Record<string, Deck[]> = {};
                        activeClass.deckIds.forEach(deckId => {
                          const deck = store.getDecks().find(d => d.id === deckId);
                          if (!deck) return;
                          const subject = deck.subject || "Chung";
                          if (!grouped[subject]) {
                            grouped[subject] = [];
                          }
                          grouped[subject].push(deck);
                        });

                        const subjects = Object.keys(grouped);

                        return (
                          <div className="space-y-3">
                            {subjects.map(subject => {
                              const decksInSubject = grouped[subject];
                              const isExpanded = !!expandedSubjects[subject];

                              return (
                                <div key={subject} className="border border-zinc-150 dark:border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/10">
                                  {/* Tiêu đề phân mục */}
                                  <div
                                    onClick={() => {
                                      setExpandedSubjects(prev => ({
                                        ...prev,
                                        [subject]: !prev[subject]
                                      }));
                                    }}
                                    className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition text-left cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-orange-500/10 text-orange-600 rounded-lg">
                                        {isExpanded ? <FolderOpen className="w-4 h-4 text-orange-500" /> : <Folder className="w-4 h-4 text-orange-500" />}
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-sm capitalize text-zinc-800 dark:text-zinc-200">
                                          Phân mục: {subject}
                                        </h4>
                                        <p className="text-[11px] text-zinc-500 font-medium">
                                          {decksInSubject.length} học phần
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="relative z-30">
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowCategoryMenu(showCategoryMenu === subject ? null : subject);
                                          }}
                                          className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                        >
                                          <MoreVertical className="w-5 h-5" />
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
                                              <button
                                                onClick={async (e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setShowCategoryMenu(null);
                                                  if (!navigator.onLine) {
                                                    toast.error("Bạn đang offline, không thể tải xuống danh mục.");
                                                    return;
                                                  }
                                                  const { downloadCourseForOffline } = await import('../utils/offlineDb');
                                                  let successCount = 0;
                                                  const loadingToast = toast.loading(`Đang tải xuống ${decksInSubject.length} học phần...`);
                                                  for (const deck of decksInSubject) {
                                                    try {
                                                      await downloadCourseForOffline(deck.id);
                                                      successCount++;
                                                    } catch (err) {
                                                      console.error(`Failed to download ${deck.id}:`, err);
                                                    }
                                                  }
                                                  toast.dismiss(loadingToast);
                                                  if (successCount > 0) {
                                                    toast.success(`Đã tải xuống thành công ${successCount}/${decksInSubject.length} học phần.`);
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
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setShowCategoryMenu(null);
                                                  const categoryUrl = `${window.location.origin}/category/${encodeURIComponent(subject)}`;
                                                  const shareText = `📚 Phân mục: ${subject}\n👉 Xem toàn bộ học phần trong phân mục này: ${categoryUrl}`;
                                                  navigator.clipboard.writeText(shareText).then(() => {
                                                    toast.success("Đã sao chép link phân mục!");
                                                  }).catch(() => toast.error("Không thể sao chép."));
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-blue-600 transition-colors"
                                              >
                                                <Share2 className="w-4 h-4" />
                                                Chia sẻ phân mục
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                      <ChevronRight className={cn(
                                        "w-4 h-4 text-zinc-400 transition-transform duration-200",
                                        isExpanded && "rotate-90"
                                      )} />
                                    </div>
                                  </div>

                                  {/* Danh sách học phần con */}
                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden border-t border-zinc-100 dark:border-zinc-800/50"
                                      >
                                        <div className="p-3 bg-zinc-50/10 dark:bg-zinc-950/20 space-y-2">
                                          {decksInSubject.map(deck => (
                                            <div 
                                              key={deck.id} 
                                              id={`deck-${activeClass.id}-${deck.id}`} 
                                              className="flex items-center justify-between p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-orange-500/40 transition shadow-sm"
                                            >
                                              <div>
                                                <h5 className="font-bold text-xs text-zinc-800 dark:text-zinc-200">{deck.title}</h5>
                                                <div className="flex gap-2 text-[10px] text-zinc-500 font-semibold mt-0.5">
                                                  <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{deck.cards?.length || 0} thẻ</span>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Link to={`/study/${deck.id}`} className="p-2 bg-orange-500/10 text-orange-600 rounded-full hover:bg-orange-500/20 transition active:scale-95">
                                                  <Play className="w-3.5 h-3.5" />
                                                </Link>
                                                <DeckOptionsMenu deck={deck} />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-500" /> Bảng xếp hạng tiến độ
                  </h3>
                  <div className="space-y-3">
                    {activeClass.members.map((member, idx) => (
                      <div key={member.id} className="flex items-center gap-4 p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl">
                        <div className="w-6 font-mono font-bold text-zinc-400 text-center">#{idx + 1}</div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-sm">{member.name}</span>
                            <span className="text-xs font-bold text-orange-500">{Math.floor(Math.random() * 40) + 10}%</span>
                          </div>
                          <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400" style={{ width: `${Math.floor(Math.random() * 40) + 10}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          );

          if (isFeatureEnabled("vibe-study-nav")) {
            return (
              <VibeNavGroup key={activeClass.id} id={activeClass.id} title={activeClass.name}>
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
    </div>
  );
};
