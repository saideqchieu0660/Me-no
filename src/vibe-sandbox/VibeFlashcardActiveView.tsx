import { safeFetch } from "../utils/safeFetch";
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import { 
  ArrowLeft, Volume2, VolumeX, Sparkles, Check, X, BellPlus, Edit3, Settings, AlertCircle, Zap, Sliders,  Copy, CheckCheck, FileText, Plus, Timer as TimerIcon, Palette, BarChart2, Wrench, RefreshCcw, Languages} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Flashcard } from '../lib/store';
import { DiffViewer } from '../components/DiffViewer';
import { VibeStudyCompanion } from './VibeStudyCompanion';
import { VibePomodoroStats } from './VibePomodoroStats';
import { Deck } from '../lib/store';
import { DeckOptionsMenu } from '../components/DeckOptionsMenu';
import { usePomodoro } from '../lib/PomodoroStore';

export interface VibeFlashcardActiveViewProps {
  currentCard: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  onMark: (remembered: boolean) => void;
  onRemindLater?: () => void;
  currentIndex: number;
  totalCards: number;
  deckTitle?: string;
  onBack: () => void;
  onRestart?: () => void;
  onPrevCard?: () => void;
  onAddToClass?: () => void;
  onEditDeckMetadata?: () => void;
  isSoundEnabled: boolean;
  onToggleMute: () => void;
  onListen: (e?: React.MouseEvent, text?: string, locale?: string) => void;
  isExtracting: boolean;
  deepExplanation: string | null;
  onAgent3: (customPromptOverride?: string) => void;
  onClearExplanation: () => void;
  isClozeMode?: boolean;
  onToggleClozeMode?: () => void;
  isHintRevealed?: boolean;
  onToggleHint?: () => void;
  canEditDeck: boolean;
  onEditOpen: (e: React.MouseEvent) => void;
  isEditing: boolean;
  editFront: string;
  setEditFront: (v: string) => void;
  editBack: string;
  setEditBack: (v: string) => void;
  editExampleSentence: string;
  setEditExampleSentence: (v: string) => void;
  onSaveEdit: (e: React.MouseEvent) => void;
  onDeleteCard: (e: React.MouseEvent) => void;
  deleteCountdown: number | null;
  startDeleteCountdown: (e: React.MouseEvent) => void;
  cancelDeleteCountdown: (e: React.MouseEvent) => void;
  detectLanguage: (text: string) => { isAvailable: boolean; locale: "en-US" | "vi-VN" | "" };
  onSaveFormattedCard?: (newFront: string, newBack: string, newExample?: string) => Promise<void>;
  onTranslateDefinition?: () => void;
  isTranslatingDefinition?: boolean;
  correctCount?: number;
  incorrectCount?: number;
  weakCardsCount?: number;
  onReviewWeakCards?: () => void;
  deck?: Deck | null;
}

// Helper to pre-process text to convert "\n" or "/n/" to real newlines
const processText = (text: string) => text ? text.replace(/\\n|\/n\//gi, '\n') : "";

export const VibeFlashcardActiveView: React.FC<VibeFlashcardActiveViewProps> = React.memo(({
  currentCard,
  isFlipped,
  onFlip,
  onMark,
  onRemindLater,
  currentIndex,
  totalCards,
  deckTitle,
  onBack,
  onRestart,
  onPrevCard,
  onAddToClass,
  onEditDeckMetadata,
  isSoundEnabled,
  onToggleMute,
  onListen,
  isExtracting,
  deepExplanation,
  onAgent3,
  onClearExplanation,
  canEditDeck,
  onEditOpen,
  isEditing,
  editFront,
  setEditFront,
  editBack,
  setEditBack,
  editExampleSentence,
  setEditExampleSentence,
  onSaveEdit,
  onSaveFormattedCard,
  onTranslateDefinition,
  isTranslatingDefinition,
  onDeleteCard,
  deleteCountdown,
  startDeleteCountdown,
  cancelDeleteCountdown,
  detectLanguage,
  correctCount = 0,
  incorrectCount = 0,
  weakCardsCount = 0,
  onReviewWeakCards,
  deck,
}) => {
  
  const [showAiDropdown, setShowAiDropdown] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customCardType, setCustomCardType] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customLength, setCustomLength] = useState<"short" | "normal" | "detailed">("normal");

  const [globalPrompts, setGlobalPrompts] = useState<any[]>([]);
  const [isCreatingGlobal, setIsCreatingGlobal] = useState(false);
  const [newGlobalTitle, setNewGlobalTitle] = useState("");
  const [newGlobalPrompt, setNewGlobalPrompt] = useState("");

  const fetchGlobalPrompts = async () => {
    try {
      const res = await safeFetch("/api/vibe/global-prompts");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGlobalPrompts(data.data || []);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchGlobalPrompts();
  }, []);

  const handleCreateGlobalPrompt = async () => {
    if (!newGlobalTitle.trim() || !newGlobalPrompt.trim()) return;
    try {
      const res = await safeFetch("/api/vibe/global-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newGlobalTitle,
          prompt: newGlobalPrompt,
          isGlobal: true, // as user requested, push to all system
        })
      });
      if (res.ok) {
        setNewGlobalTitle("");
        setNewGlobalPrompt("");
        setIsCreatingGlobal(false);
        fetchGlobalPrompts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const { isEnabled: isTimerOpen, setIsEnabled: setIsTimerOpen } = usePomodoro();
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isMiniPomodoro, setIsMiniPomodoro] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isToolsOverlayOpen, setIsToolsOverlayOpen] = useState(false);
  
  // Format AI & Diff States
  const [isFormatting, setIsFormatting] = useState(false);
  const [isFormatDiffModalOpen, setIsFormatDiffModalOpen] = useState(false);
  const [diffFront, setDiffFront] = useState("");
  const [diffBack, setDiffBack] = useState("");
  const [diffExample, setDiffExample] = useState("");
  const [isApplyingFormat, setIsApplyingFormat] = useState(false);

  // AI Explanation Copy & Diff States
  const [isCopiedExplanation, setIsCopiedExplanation] = useState(false);
  const [isApplyExplanationModalOpen, setIsApplyExplanationModalOpen] = useState(false);
  const [isApplyingExplanation, setIsApplyingExplanation] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAiDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAutoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAiDropdown(false);
    onAgent3();
  };

  const handleCustomClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAiDropdown(false);

    // Instant local card type detection without making an API call
    const frontText = currentCard?.front?.trim() || "";
    const backText = currentCard?.back?.trim() || "";
    const isQuestion =
      /[?？]/.test(frontText) ||
      /\b(chọn|đáp án|câu hỏi|câu nào|tại sao|nguyên nhân|which|what|where|when|why|how|select|choose|fill|correct|incorrect|find)\b/i.test(frontText) ||
      /\b[A-D][.s)]\b/.test(frontText) ||
      /\b[A-D][.s)]\b/.test(backText);

    const isEnglishText = !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(frontText);
    const isVocab = !isQuestion && (isEnglishText || !!currentCard?.wordForm || frontText.split(" ").length <= 6);

    let detectedType = "KHÁI NIỆM HỌC TẬP CHUNG";
    let defaultPrompt = `Hãy bóc tách và giải thích khái niệm / nội dung này:\n1. Nêu bật bản chất cốt lõi ngay lập tức.\n2. Ví dụ hoặc mẹo nhớ (CHỈ ghi nếu có giá trị học tập, tuyệt đối cấm để mục trống).`;

    if (isQuestion) {
      detectedType = "CÂU HỎI / BÀI TẬP TRẮC NGHIỆM";
      defaultPrompt = `Thẻ học này thuộc dạng CÂU HỎI / BÀI TẬP. Hãy giải bài và giải thích đáp án:\n1. Giải thích vì sao đáp án đúng lại đúng.\n2. Phân tích vì sao các đáp án khác sai (nếu có lựa chọn và có giá trị học tập).\n3. LƯU Ý QUAN TRỌNG: CHỈ ghi những phân tích thực sự có giá trị học tập. KHÔNG ghi tiêu đề trống hay mục rỗng không có thông tin.`;
    } else if (isVocab) {
      detectedType = "TỪ VỰNG / CỤM TỪ TIẾNG ANH";
      defaultPrompt = `Thẻ học này thuộc dạng TỪ VỰNG / CỤM TỪ / THÀNH NGỮ / CỤM ĐỘNG TỪ. Hãy bóc tách và giải thích:\n1. Bóc tách nghĩa cốt lõi.\n2. Đính kèm phiên âm IPA chuẩn xác ngay cạnh từ/cụm từ.\n3. Đưa ra 1 Ví dụ minh họa thực tế (kèm câu Tiếng Anh & dịch nghĩa Tiếng Việt).\n4. Mẹo ghi nhớ / Nguồn gốc: CHỈ ghi nếu giúp ích ghi nhớ.`;
    }

    setCustomCardType(detectedType);
    setCustomPrompt(defaultPrompt);
    setIsCustomModalOpen(true);
  };

  const handleCustomSubmit = () => {
    setIsCustomModalOpen(false);
    let finalPrompt = customPrompt;
    if (customLength === "short") {
       finalPrompt += "\n\n(YÊU CẦU ĐỘ DÀI: Hãy trả lời siêu ngắn gọn, tối đa 2-3 câu, đi thẳng vào đáp án và trọng tâm).";
    } else if (customLength === "detailed") {
       finalPrompt += "\n\n(YÊU CẦU ĐỘ DÀI: Hãy giải thích cặn kẽ, bóc tách chi tiết từng vấn đề, lật đi lật lại ngọn ngành, có kèm ví dụ minh họa và mở rộng sâu sắc).";
    }
    onAgent3(finalPrompt);
  };

  const handleFormatAI = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFormatting || !currentCard) return;
    setIsFormatting(true);
    try {
      const res = await safeFetch("/api/automation/format-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: currentCard.front || "",
          back: currentCard.back || "",
          example_sentence: currentCard.example_sentence || "",
        }),
      });

      if (!res.ok) {
        throw new Error("Không thể kết nối AI định dạng.");
      }

      const data = await res.json();
      setDiffFront(data.formattedFront || currentCard.front || "");
      setDiffBack(data.formattedBack || currentCard.back || "");
      setDiffExample(data.formattedExample || currentCard.example_sentence || "");
      setIsFormatDiffModalOpen(true);
    } catch (err: any) {
      console.warn("Format AI Error:", err);
      alert("Không thể định dạng AI lúc này: " + (err.message || "Lỗi kết nối."));
    } finally {
      setIsFormatting(false);
    }
  };

  const handleApplyFormat = async () => {
    setIsApplyingFormat(true);
    try {
      if (onSaveFormattedCard) {
        await onSaveFormattedCard(diffFront, diffBack, diffExample);
      } else {
        setEditFront(diffFront);
        setEditBack(diffBack);
        setEditExampleSentence(diffExample);
        const mockEvt = { stopPropagation: () => {} } as React.MouseEvent;
        await onSaveEdit(mockEvt);
      }
      setIsFormatDiffModalOpen(false);
    } catch (err) {
      console.error("Failed to apply format:", err);
      alert("Không thể áp dụng định dạng mới.");
    } finally {
      setIsApplyingFormat(false);
    }
  };

  const getWordFormBadge = (computedForm?: string) => {
    if (!computedForm) return null;
    const lowerForm = computedForm.toLowerCase();
    
    return (
      <span
        className={cn(
          "text-[10px] sm:text-[11px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full shadow-sm mb-4 inline-block",
          lowerForm.includes("noun") || lowerForm === "n"
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50"
            : lowerForm.includes("verb") || lowerForm === "v"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50"
              : lowerForm.includes("adj")
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50"
                : lowerForm.includes("adv")
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                  : lowerForm.includes("idiom") || lowerForm.includes("colloc")
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700",
        )}
      >
        [{computedForm}]
      </span>
    );
  };

  const parseWordForm = () => {
    let computedForm = currentCard?.wordForm;
    const frontText = currentCard?.front || (currentCard as any)?.word || "";
    if (!computedForm) {
      const check = detectLanguage(frontText);
      if (check.isAvailable && check.locale === "en-US") {
        const backText = currentCard?.back || (currentCard as any)?.meaning || "";
        const match = backText.match(/\((n|v|adj|adv|prep|conj|pron|idiom|phrasal verb)\)/i);
        if (match) {
          computedForm = match[1];
        } else {
          const cleanFront = frontText.replace(/\([^)]*\)/g, "").trim();
          const tokens = cleanFront.split(/\s+/).filter(t => t.length > 0);
          if (tokens.length >= 3) computedForm = "idiom";
          else if (tokens.length === 2) computedForm = "collocation";
          else computedForm = "vocabulary";
        }
      }
    } else {
       const cleanFront = frontText.replace(/\([^)]*\)/g, "").trim();
       const tokens = cleanFront.split(/\s+/).filter(t => t.length > 0);
       if (tokens.length === 1 && /idiom|colloc/i.test(computedForm)) {
          computedForm = "vocabulary";
       }
    }
    return computedForm;
  };

  return (
    <div className="flex flex-col h-[100dvh] md:h-[90vh] max-w-4xl mx-auto px-4 py-4 md:py-8 font-sans animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-4 md:mb-6 shrink-0">
           <div className="flex items-center gap-3 sm:gap-4">
             <button onClick={onBack} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 font-bold text-sm sm:text-base transition cursor-pointer">
               <ArrowLeft className="w-5 h-5"/> Quay lại
             </button>
             {onRestart && (
               <button onClick={onRestart} title="Học lại từ đầu" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 font-bold text-sm sm:text-base transition cursor-pointer bg-zinc-100 dark:bg-zinc-800/50 px-2 sm:px-3 py-1.5 rounded-lg border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                 <RefreshCcw className="w-4 h-4 text-orange-500"/>
                 <span className="hidden sm:inline text-xs sm:text-sm">Học lại</span>
               </button>
             )}
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 try {
                   const frontText = currentCard.front || "";
                   const existing = JSON.parse(localStorage.getItem("vibe_collected_ideas") || "[]");
                   if (!existing.includes(frontText)) {
                     existing.push(frontText);
                     localStorage.setItem("vibe_collected_ideas", JSON.stringify(existing));
                     toast.success("Đã lưu ý tưởng/mẫu câu vào sổ tay cá nhân!");
                   } else {
                     toast("Ý tưởng này đã có trong sổ tay của bạn rồi.");
                   }
                 } catch (err) {
                   console.error(err);
                 }
               }}
               title="Lưu mẫu câu/ý tưởng này vào Sổ tay cá nhân"
               className="text-zinc-500 hover:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1.5 font-bold text-sm sm:text-base transition cursor-pointer bg-zinc-100 dark:bg-zinc-800/50 px-2 sm:px-3 py-1.5 rounded-lg border border-transparent hover:border-amber-200 dark:hover:border-amber-700/50"
             >
               <BellPlus className="w-4 h-4 text-amber-500"/>
               <span className="hidden sm:inline text-xs sm:text-sm">Gom nhặt</span>
             </button>
           </div>
           <div className="hidden sm:flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200 px-4 max-w-sm">
           <span className="truncate">{deckTitle}</span>
           <div className="h-3 w-px bg-zinc-350 dark:bg-zinc-700 mx-1"></div>
           <button type="button" onClick={() => setIsToolsOverlayOpen(true)} className="text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 transition p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 flex items-center gap-1 cursor-pointer" title="Công cụ học tập"><Wrench className="w-3.5 h-3.5 animate-pulse" /><span className="text-[10px] uppercase font-black tracking-wider">Công cụ</span></button>
           {deck && (
             <DeckOptionsMenu deck={deck} onEditDeck={onEditDeckMetadata} onAddToClass={onAddToClass} />
           )}
           {onEditDeckMetadata && (
             <button
               onClick={onEditDeckMetadata}
               className="text-zinc-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-blue-500/10"
               title="Sửa tên và danh mục"
             >
               <Edit3 className="w-3.5 h-3.5" />
             </button>
           )}
         </div>
         <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Wrench Tool Trigger */}
            <div className="flex items-center gap-1 sm:hidden">
              <button type="button" onClick={() => setIsToolsOverlayOpen(true)} className="text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 transition p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center cursor-pointer" title="Công cụ học tập"><Wrench className="w-4 h-4 animate-pulse" /></button>
              {deck && (
                <div className="flex items-center justify-center border border-zinc-200 dark:border-zinc-800 rounded-full h-8 w-8 bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800">
                  <DeckOptionsMenu deck={deck} onEditDeck={onEditDeckMetadata} onAddToClass={onAddToClass} />
                </div>
              )}
            </div>
           {onAddToClass && (
             <button 
               onClick={onAddToClass} 
               className="text-orange-500 hover:bg-orange-500/10 px-3 py-1.5 rounded-full transition flex items-center gap-1 text-xs sm:text-sm font-bold border border-orange-500/20"
             >
               <Plus className="w-4 h-4" />
               <span className="hidden sm:inline">Vào Lớp</span>
             </button>
           )}
           <div className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 font-mono tracking-widest bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800">
             {currentIndex + 1} / {totalCards}
           </div>
           <button onClick={onToggleMute} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition bg-zinc-100 dark:bg-zinc-800/50 p-2 rounded-full border border-zinc-200 dark:border-zinc-800 cursor-pointer">
             {isSoundEnabled ? <Volume2 className="w-4 h-4"/> : <VolumeX className="w-4 h-4 text-red-500"/>}
           </button>
         </div>
      </div>


      {/* Active view Stats rendering if open */}
      {isStatsOpen && (
        <div className="w-full mt-2 animate-in fade-in duration-300">
          <VibePomodoroStats currentDeckTitle={deckTitle} />
        </div>
      )}

      {/* Overlay/Modal chọn Công cụ học tập */}
      {isToolsOverlayOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setIsToolsOverlayOpen(false)}>
          <div 
            className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <h4 className="font-extrabold text-sm text-zinc-900 dark:text-zinc-105 uppercase tracking-wider">
                  Công Cụ Tập Trung
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsToolsOverlayOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of 3 tools */}
            <div className="space-y-4">
              
              {/* Tool 1: Pomodoro Timer */}
              <div className="flex items-center justify-between p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="flex items-center gap-3">
                  <div className={"p-2 rounded-xl transition-all " + (isTimerOpen ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                    <TimerIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-zinc-855 dark:text-zinc-100">Đồng hồ Pomodoro</h5>
                    <p className="text-[10px] text-zinc-400">Đếm ngược 25p tập trung học tập</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTimerOpen(!isTimerOpen)}
                  className={"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none " + (isTimerOpen ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800")}
                >
                  <span
                    className={"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow ring-0 transition duration-200 ease-in-out " + (isTimerOpen ? "translate-x-4" : "translate-x-0")}
                  />
                </button>
              </div>

              {/* Sub-toggle: Pomodoro Type (Full vs Mini Popup) */}
              {isTimerOpen && (
                <div className="pl-12 pr-3 py-1 flex items-center justify-between animate-in slide-in-from-top-1 duration-200">
                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">Giao diện đồng hồ:</span>
                  <button
                    type="button"
                    onClick={() => setIsMiniPomodoro(!isMiniPomodoro)}
                    className="text-[10px] font-black uppercase tracking-wider py-1 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    {isMiniPomodoro ? "Popup gọn nhẹ" : "Đầy đủ"}
                  </button>
                </div>
              )}

              {/* Tool 2: Sketchpad & Memo */}
              <div className="flex items-center justify-between p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="flex items-center gap-3">
                  <div className={"p-2 rounded-xl transition-all " + (isScratchpadOpen ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-zinc-855 dark:text-zinc-100">Bảng nháp & Ghi nhớ</h5>
                    <p className="text-[10px] text-zinc-400">Vẽ tay phác họa và ghi chú nhanh</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScratchpadOpen(!isScratchpadOpen)}
                  className={"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none " + (isScratchpadOpen ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800")}
                >
                  <span
                    className={"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow ring-0 transition duration-200 ease-in-out " + (isScratchpadOpen ? "translate-x-4" : "translate-x-0")}
                  />
                </button>
              </div>

              {/* Tool 3: Pomodoro Stats */}
              <div className="flex items-center justify-between p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="flex items-center gap-3">
                  <div className={"p-2 rounded-xl transition-all " + (isStatsOpen ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400")}>
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-zinc-855 dark:text-zinc-100">Thống kê Pomodoro</h5>
                    <p className="text-[10px] text-zinc-400">Theo dõi tiến độ, biểu đồ 7 ngày</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStatsOpen(!isStatsOpen)}
                  className={"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none " + (isStatsOpen ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800")}
                >
                  <span
                    className={"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow ring-0 transition duration-200 ease-in-out " + (isStatsOpen ? "translate-x-4" : "translate-x-0")}
                  />
                </button>
              </div>

            </div>

            <button
              type="button"
              onClick={() => setIsToolsOverlayOpen(false)}
              className="mt-5 w-full py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-extrabold text-xs uppercase tracking-widest rounded-xl hover:opacity-90 transition cursor-pointer shadow-lg"
            >
              Hoàn tất
            </button>
          </div>
        </div>
      )}
  

      {/* Main Card Area - Let it grow and manage its own internal scroll */}
      <div className="w-full flex-1 flex flex-col min-h-0 relative">
        <div 
           onClick={(e) => {
             // Don't flip if we are editing
             if (isEditing) return;
             onFlip();
           }}
           className="w-full h-full bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-sm hover:shadow-md cursor-pointer flex flex-col transition-all active:scale-[0.99] overflow-hidden relative group"
        >
          {canEditDeck && !isEditing && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEditOpen(e); }} 
              className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20 flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition bg-zinc-50/80 dark:bg-zinc-800/80 backdrop-blur hover:bg-zinc-100 dark:hover:bg-zinc-700 p-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" /> <span className="hidden sm:inline">Chỉnh sửa</span>
            </button>
          )}
           <div className="w-full h-full overflow-y-auto overflow-x-hidden p-6 sm:p-10 md:p-14 flex flex-col">
              
              {isEditing ? (
                 <div className="w-full max-w-2xl mx-auto flex flex-col justify-center my-auto" onClick={(e) => e.stopPropagation()}>
                    {deleteCountdown !== null ? (
                      <div className="w-full p-6 bg-red-500/10 dark:bg-red-500/5 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center animate-in zoom-in-95 duration-200">
                        <div className="p-3 bg-red-500/20 text-red-600 dark:text-red-400 rounded-full animate-bounce">
                          <AlertCircle className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                            Xác nhận xóa thẻ học
                          </h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Bạn có chắc chắn muốn xóa? Nút xác nhận sẽ mở sau{" "}
                            <span className="font-extrabold text-red-500 text-sm animate-pulse">
                              {deleteCountdown}s
                            </span>
                          </p>
                        </div>
                        <div className="flex gap-3 w-full">
                          <button
                            onClick={cancelDeleteCountdown}
                            className="flex-1 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Hủy bỏ
                          </button>
                          <button
                            disabled={deleteCountdown > 0}
                            onClick={onDeleteCard}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition",
                              deleteCountdown > 0
                                ? "bg-red-500/30 text-red-500/50 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700 text-white cursor-pointer",
                            )}
                          >
                            Xác nhận xóa
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full space-y-4 bg-white dark:bg-zinc-900 rounded-2xl p-1">
                         <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-800">
                           <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Chỉnh sửa thẻ học</span>
                           <button
                             type="button"
                             onClick={handleFormatAI}
                             disabled={isFormatting}
                             className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
                             title="Tự động xuống dòng, làm thông thoáng thẻ bằng AI"
                           >
                             <Sliders className="w-3.5 h-3.5" />
                             {isFormatting ? "Đang định dạng..." : "✨ Định dạng AI"}
                           </button>
                         </div>
                         <textarea
                            className="w-full p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-base"
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            placeholder="Mặt trước..."
                            rows={3}
                          />
                          <textarea
                            className="w-full p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-base"
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            placeholder="Mặt sau..."
                            rows={4}
                          />
                          <textarea
                            className="w-full p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 resize-none outline-none focus:ring-2 focus:ring-blue-500 transition text-zinc-900 dark:text-zinc-100 text-sm"
                            value={editExampleSentence}
                            onChange={(e) => setEditExampleSentence(e.target.value)}
                            placeholder="Câu ví dụ đục lỗ. Đặt từ cần đố trong ngoặc vuông, ví dụ: 'To [debunk] a myth is to prove it wrong.'..."
                            rows={2}
                          />
                          <div className="flex gap-3 w-full">
                            <button
                              onClick={onSaveEdit}
                              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition text-sm cursor-pointer"
                            >
                              Lưu Thay Đổi
                            </button>
                            <button
                              type="button"
                              onClick={handleFormatAI}
                              disabled={isFormatting}
                              className="px-4 py-3 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title="Tự động xuống dòng làm thoáng thẻ bằng AI"
                            >
                              <Sliders className="w-4 h-4" />
                              {isFormatting ? "Đang định dạng..." : "Định dạng AI"}
                            </button>
                            <button
                              onClick={startDeleteCountdown}
                              className="py-3 px-4 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl font-bold transition text-sm flex items-center justify-center gap-1 cursor-pointer"
                            >
                              Xóa
                            </button>
                          </div>
                      </div>
                    )}
                 </div>
              ) : isFlipped ? (
                <div className="w-full max-w-2xl mx-auto my-auto flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                   {/* Back of Card */}
                   <div className="flex justify-between items-start mb-6 w-full gap-4">
                     <h3 className="text-2xl sm:text-3xl font-bold font-display text-zinc-900 dark:text-zinc-100 break-words whitespace-pre-wrap flex-1 min-w-0 overflow-hidden">
                        {processText(currentCard.front)}
                     </h3>
                     {(() => {
                        const check = detectLanguage(currentCard.back || "");
                        if (!check.isAvailable) return null;
                        return (
                          <button onClick={(e) => { e.stopPropagation(); onListen(e, currentCard.back, check.locale); }} className="p-2.5 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition shrink-0 ml-4">
                            <Volume2 className="w-5 h-5"/>
                          </button>
                        );
                     })()}
                   </div>

                   <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8 shrink-0" />
                   
                   <div className="markdown-body prose dark:prose-invert max-w-none w-full text-left break-words whitespace-pre-wrap text-lg sm:text-xl text-zinc-700 dark:text-zinc-300">
                     <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>
                       {processText(currentCard.back)}
                     </ReactMarkdown>
                   </div>
                   
                   {currentCard.example_sentence && (
                     <div className="mt-10 p-5 sm:p-6 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl w-full text-left break-words whitespace-pre-wrap text-zinc-600 dark:text-zinc-400 italic text-lg sm:text-xl border border-zinc-100 dark:border-zinc-800/50">
                       {processText(currentCard.example_sentence)}
                     </div>
                   )}
                </div>
              ) : (
                <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center my-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                   {/* Front of Card */}
                   {getWordFormBadge(parseWordForm())}
                   
                   <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-zinc-900 dark:text-zinc-100 text-center break-words whitespace-pre-wrap w-full leading-tight">
                      {processText(currentCard.front)}
                   </h2>
                   
                   {(() => {
                      const text = currentCard.front || "";
                      const check = detectLanguage(text);
                      if (!check.isAvailable) return null;
                      return (
                        <button onClick={(e) => { e.stopPropagation(); onListen(e, text, check.locale); }} className="mt-8 p-3 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition shadow-sm">
                          <Volume2 className="w-6 h-6"/>
                        </button>
                      );
                   })()}
                </div>
              )}

           </div>
        </div>
      </div>

      {/* Secondary Actions Row */}
      {!isEditing && (
        <div className="w-full max-w-xl mx-auto mt-4 sm:mt-6 flex justify-end items-center px-4 shrink-0">
          <div className="flex gap-3 sm:gap-4 items-center">
            {onTranslateDefinition && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTranslateDefinition(); }}
                disabled={isTranslatingDefinition || isExtracting || isFormatting}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 transition disabled:opacity-50 cursor-pointer bg-teal-100 dark:bg-teal-950/60 hover:bg-teal-200 dark:hover:bg-teal-900/80 px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-800 shadow-sm"
                title="Dịch định nghĩa tiếng Anh sang tiếng Việt"
              >
                <Languages className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {isTranslatingDefinition ? "Đang dịch..." : "Dịch định nghĩa"}
              </button>
            )}

            <button
              type="button"
              onClick={handleFormatAI}
              disabled={isFormatting || isExtracting}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 transition disabled:opacity-50 cursor-pointer bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 dark:hover:bg-purple-900/80 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 shadow-sm"
              title="Tự động xuống dòng, tách đáp án A B C D & làm thoáng thẻ học bằng AI"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              {isFormatting ? "Đang định dạng..." : "✨ Định dạng AI"}
            </button>

            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (!isExtracting) {
                    setShowAiDropdown(!showAiDropdown);
                  }
                }} 
                disabled={isExtracting} 
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4"/> 
                {isExtracting ? "Đang suy nghĩ..." : "Giải thích AI"}
              </button>

              {/* AI Options Dropdown */}
              {showAiDropdown && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 mb-1">
                    Chế độ Giải thích AI
                  </div>
                  
                  <button
                    onClick={handleAutoClick}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-left transition group cursor-pointer"
                  >
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-105 transition shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        ⚡ Tự động (1-Click)
                      </div>
                      <div className="text-[11px] text-zinc-500 leading-tight mt-0.5">
                        Tự động nhận dạng thẻ & giải thích ngay lập tức.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleCustomClick}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/30 text-left transition group mt-1 cursor-pointer"
                  >
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg group-hover:scale-105 transition shrink-0">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        ⚙️ Tùy chỉnh Prompt
                      </div>
                      <div className="text-[11px] text-zinc-500 leading-tight mt-0.5">
                        Chọn mẫu hoặc sửa yêu cầu theo ý muốn trước khi gửi AI.
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Prompt Modal */}
      {isCustomModalOpen && (
        <div 
          onClick={(e) => { e.stopPropagation(); setIsCustomModalOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                    Tùy chỉnh Yêu cầu AI
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Thêm tùy chọn & chỉnh sửa Prompt trước khi gửi cho AI
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Card Type Badge & Quick Template Selector */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Chọn mẫu Prompt nhanh theo dạng thẻ:</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCustomCardType("TỪ VỰNG / CỤM TỪ TIẾNG ANH");
                    setCustomPrompt(`Thẻ học này thuộc dạng TỪ VỰNG / CỤM TỪ. Hãy bóc tách và giải thích:\n1. Bóc tách nghĩa cốt lõi.\n2. Đính kèm phiên âm IPA chuẩn xác ngay cạnh từ/cụm từ.\n3. Đưa ra 1 Ví dụ minh họa thực tế (kèm câu Tiếng Anh & dịch nghĩa Tiếng Việt).\n4. Mẹo ghi nhớ / Nguồn gốc: CHỈ ghi nếu giúp ích ghi nhớ.`);
                  }}
                  className={cn(
                    "p-2 rounded-xl text-[11px] font-bold text-center border transition cursor-pointer flex items-center justify-center gap-1",
                    customCardType.includes("TỪ VỰNG")
                      ? "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:border-purple-600 dark:text-purple-200"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                  )}
                >
                  📝 Từ vựng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCardType("CÂU HỎI / BÀI TẬP TRẮC NGHIỆM");
                    setCustomPrompt(`Thẻ học này thuộc dạng CÂU HỎI / BÀI TẬP. Hãy giải bài và giải thích đáp án:\n1. Giải thích vì sao đáp án đúng lại đúng.\n2. Phân tích vì sao các đáp án khác sai (nếu có lựa chọn).\n3. LƯU Ý: CHỈ ghi những phân tích có giá trị học tập, không để mục trống.`);
                  }}
                  className={cn(
                    "p-2 rounded-xl text-[11px] font-bold text-center border transition cursor-pointer flex items-center justify-center gap-1",
                    customCardType.includes("CÂU HỎI") || customCardType.includes("TRẮC NGHIỆM")
                      ? "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:border-purple-600 dark:text-purple-200"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                  )}
                >
                  ❓ Trắc nghiệm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCardType("KHÁI NIỆM HỌC TẬP CHUNG");
                    setCustomPrompt(`Hãy bóc tách và giải thích khái niệm / nội dung này:\n1. Nêu bật bản chất cốt lõi ngay lập tức.\n2. Ví dụ hoặc mẹo nhớ (CHỈ ghi nếu có giá trị học tập, tuyệt đối cấm để mục trống).`);
                  }}
                  className={cn(
                    "p-2 rounded-xl text-[11px] font-bold text-center border transition cursor-pointer flex items-center justify-center gap-1",
                    customCardType.includes("KHÁI NIỆM")
                      ? "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:border-purple-600 dark:text-purple-200"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                  )}
                >
                  💡 Khái niệm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomCardType("TỰ DO");
                    setCustomPrompt("");
                  }}
                  className={cn(
                    "p-2 rounded-xl text-[11px] font-bold text-center border transition cursor-pointer flex items-center justify-center gap-1",
                    customCardType.includes("TỰ DO")
                      ? "bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/50 dark:border-purple-600 dark:text-purple-200"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                  )}
                >
                  ✨ Tự do
                </button>
              </div>
            </div>

            {/* Length Constraint Layer */}
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                <span className="text-[14px]">📏</span>
                <span>Định hướng dung lượng (Độ dài câu trả lời):</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-800/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCustomLength("short")}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5",
                    customLength === "short"
                      ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  ⚡ Siêu tốc
                </button>
                <button
                  type="button"
                  onClick={() => setCustomLength("normal")}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5",
                    customLength === "normal"
                      ? "bg-white dark:bg-zinc-700 text-green-600 dark:text-green-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  📖 Vừa đủ
                </button>
                <button
                  type="button"
                  onClick={() => setCustomLength("detailed")}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition cursor-pointer flex items-center justify-center gap-1.5",
                    customLength === "detailed"
                      ? "bg-white dark:bg-zinc-700 text-orange-600 dark:text-orange-400 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  )}
                >
                  📚 Cặn kẽ
                </button>
              </div>
            </div>

            {/* Prompt Editor Textarea */}
            <div className="space-y-1.5 mt-4">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex justify-between items-center">
                <span>Nội dung Yêu cầu (Prompt):</span>
                <span className="text-[11px] font-normal text-zinc-400">Có thể chỉnh sửa thoải mái</span>
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={5}
                className="w-full p-3.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 leading-relaxed font-mono resize-y"
                placeholder="Nhập yêu cầu tùy chỉnh cho AI..."
              />
            </div>

            {/* Quick Add Chips */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-zinc-400">Bấm để thêm nhanh yêu cầu:</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev ? prev + "\n\n" + "Hãy phân tích thẻ học này. BẮT BUỘC TRẢ LỜI ĐẦY ĐỦ 100% CÁC MỤC SAU THÀNH TỪNG PHẦN RÕ RÀNG, KHÔNG ĐƯỢC BỎ SÓT:\n- Nguồn gốc & Bản chất\n- Họ từ\n- Dễ nhầm với..." : "Hãy phân tích thẻ học này. BẮT BUỘC TRẢ LỜI ĐẦY ĐỦ 100% CÁC MỤC SAU THÀNH TỪNG PHẦN RÕ RÀNG, KHÔNG ĐƯỢC BỎ SÓT:\n- Nguồn gốc & Bản chất\n- Họ từ\n- Dễ nhầm với...")}
                  className="px-2.5 py-1 text-[11px] font-bold bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50 rounded-lg transition cursor-pointer"
                >
                  🔥 Phân tích chuyên sâu 100%
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev + "\n- Đính kèm phiên âm IPA chuẩn xác và 1 ví dụ minh họa kèm dịch tiếng Việt.")}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  + IPA & Ví dụ
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev + "\n- Phân tích chi tiết từng đáp án sai của câu hỏi trắc nghiệm này.")}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  + Phân tích trắc nghiệm
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev + "\n- Trả lời siêu ngắn gọn trong 2 câu.")}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  + Siêu ngắn gọn
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev + "\n- Thêm 1 mẹo ghi nhớ hoặc liên tưởng cực thông minh.")}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  + Mẹo nhớ
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev + "\n- Liệt kê các từ đồng nghĩa (synonyms) và trái nghĩa (antonyms).")}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  + Đồng nghĩa / Trái nghĩa
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPrompt(prev => prev + "\n- Trình bày dạng gạch đầu dòng ngắn, trực quan, dễ học.")}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 text-zinc-700 dark:text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  + Dạng gạch đầu dòng
                </button>

                {/* Dynamic Global Tags */}
                {globalPrompts.map(gp => (
                  <button
                    key={gp.id}
                    type="button"
                    onClick={() => setCustomPrompt(prev => prev + "\n- " + gp.prompt)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-800/60 dark:hover:text-blue-300 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50 rounded-lg transition cursor-pointer"
                  >
                    + {gp.title}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setIsCreatingGlobal(!isCreatingGlobal)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg transition cursor-pointer"
                >
                  + Tạo nhãn mới
                </button>
              </div>

              {isCreatingGlobal && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl space-y-2 animate-in fade-in zoom-in-95">
                  <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400">Tạo nhãn Hệ thống (Global) mới</div>
                  <input
                    type="text"
                    value={newGlobalTitle}
                    onChange={e => setNewGlobalTitle(e.target.value)}
                    placeholder="Tên nút (VD: Giải thích kiểu GenZ)"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <textarea
                    value={newGlobalPrompt}
                    onChange={e => setNewGlobalPrompt(e.target.value)}
                    placeholder="Nội dung Prompt được chèn thêm..."
                    rows={2}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingGlobal(false)}
                      className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateGlobalPrompt}
                      disabled={!newGlobalTitle.trim() || !newGlobalPrompt.trim()}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Lưu nhãn Global
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCustomSubmit}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Gửi AI Giải thích
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Panel */}
      {deepExplanation && !isEditing && (
        <div className="w-full max-w-xl mx-auto mt-4 p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl animate-in fade-in slide-in-from-bottom-2 shrink-0 max-h-64 overflow-y-auto space-y-3">
          <div className="flex justify-between items-center border-b border-blue-200/50 dark:border-blue-800/50 pb-2">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
              <Sparkles className="w-4 h-4"/> Trợ lý AI Giải thích
            </div>
            <button onClick={onClearExplanation} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-white dark:bg-zinc-800 rounded-full p-1 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
               <X className="w-3.5 h-3.5"/>
            </button>
          </div>
          
          <div className="markdown-body prose dark:prose-invert max-w-none text-sm break-words whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
             <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>{deepExplanation}</ReactMarkdown>
          </div>

          {/* Action Buttons: Copy & Áp dụng vào thẻ */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(deepExplanation);
                setIsCopiedExplanation(true);
                toast.success("Đã sao chép câu trả lời AI!");
                setTimeout(() => setIsCopiedExplanation(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl border border-zinc-200 dark:border-zinc-700 transition shadow-sm cursor-pointer"
            >
              {isCopiedExplanation ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Đã copy</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsApplyExplanationModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Áp dụng vào thẻ</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Primary Controls */}
      {!isEditing && (
        <div className="w-full max-w-xl mx-auto mt-4 sm:mt-6 shrink-0 pb-4 flex flex-col gap-3.5">
          <div className="flex w-full items-center justify-between gap-3 sm:gap-4">
              <button onClick={(e) => { e.stopPropagation(); onMark(false); }} className="flex-1 py-4 sm:py-5 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-2xl font-bold text-base sm:text-lg transition active:scale-95 flex items-center justify-center gap-2 border border-red-100 dark:border-red-500/20">
                <X className="w-5 h-5 sm:w-6 sm:h-6"/> Quên ({incorrectCount})
              </button>
              <button onClick={(e) => { e.stopPropagation(); onMark(true); }} className="flex-1 py-4 sm:py-5 bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-2xl font-bold text-base sm:text-lg transition active:scale-95 flex items-center justify-center gap-2 border border-green-100 dark:border-green-500/20 shadow-sm">
                <Check className="w-5 h-5 sm:w-6 sm:h-6"/> Nhớ ({correctCount})
              </button>
          </div>
          {onPrevCard && (
            <button 
              type="button"
              disabled={currentIndex === 0}
              onClick={(e) => { e.stopPropagation(); onPrevCard(); }} 
              className={cn(
                "w-full py-4 rounded-2xl font-extrabold text-sm sm:text-base transition flex items-center justify-center gap-2 border shadow-sm",
                currentIndex === 0
                  ? "bg-zinc-100/40 text-zinc-400 dark:bg-zinc-800/20 dark:text-zinc-600 border-zinc-200/30 dark:border-zinc-800/40 cursor-not-allowed opacity-50"
                  : "bg-zinc-100/90 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 dark:text-zinc-200 border-zinc-200/65 dark:border-zinc-750/70 cursor-pointer active:scale-[0.98]"
              )}
            >
              <ArrowLeft className="w-4.5 h-4.5" />
              Quay lại thẻ trước đó
            </button>
          )}
        </div>
      )}

      {/* AI Format Diff Modal (GitHub Style Comparison) */}
      {isFormatDiffModalOpen && (
        <div 
          onClick={() => setIsFormatDiffModalOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      So sánh Định dạng AI (Format Diff)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-[10px] uppercase tracking-wider">
                      GitHub Diff Style
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Chưa áp dụng vào thẻ. Hãy xem sự khác biệt giữa bản gốc (dính chùm) và bản AI định dạng (thông thoáng) bên dưới.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormatDiffModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1">
              
              {/* FRONT CARD COMPARISON */}
              <DiffViewer title="🎴 MẶT TRƯỚC THẺ (FRONT)" oldText={currentCard?.front || ""} newText={diffFront} />

              {/* BACK CARD COMPARISON */}
              <DiffViewer title="📖 MẶT SAU THẺ (BACK)" oldText={currentCard?.back || ""} newText={diffBack} />

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                ✨ Nhấn <strong className="text-purple-600 dark:text-purple-400">Xác nhận Áp dụng</strong> để cập nhật thẻ học ngay lập tức.
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsFormatDiffModalOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Hủy bỏ (Giữ nguyên)
                </button>
                <button
                  type="button"
                  onClick={handleApplyFormat}
                  disabled={isApplyingFormat}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isApplyingFormat ? "Đang lưu..." : "Xác nhận Áp dụng"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* AI Explanation Diff Modal (GitHub Style Comparison) */}
      {isApplyExplanationModalOpen && (
        <div 
          onClick={() => setIsApplyExplanationModalOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      So sánh & Áp dụng AI vào Mặt sau Thẻ
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-[10px] uppercase tracking-wider">
                      GitHub Diff Style
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Nội dung cũ và nội dung AI đề xuất được highlight rõ ràng. Vui lòng kiểm tra trước khi quyết định.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyExplanationModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1">
              <DiffViewer
                title="📖 MẶT SAU THẺ (BACK)"
                oldText={currentCard?.back || ""}
                newText={deepExplanation || ""}
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                🔒 AI không tự ý thay đổi dữ liệu nếu bạn chưa nhấn <strong className="text-blue-600 dark:text-blue-400">Xác nhận</strong>.
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsApplyExplanationModalOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Hủy (Giữ nguyên cũ)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!deepExplanation) return;
                    setIsApplyingExplanation(true);
                    try {
                      if (onSaveFormattedCard) {
                        await onSaveFormattedCard(
                          currentCard.front || "",
                          deepExplanation,
                          currentCard.example_sentence
                        );
                      } else {
                        setEditFront(currentCard.front || "");
                        setEditBack(deepExplanation);
                        setEditExampleSentence(currentCard.example_sentence || "");
                        const mockEvt = { stopPropagation: () => {} } as React.MouseEvent;
                        await onSaveEdit(mockEvt);
                      }
                      setIsApplyExplanationModalOpen(false);
                      toast.success("Đã áp dụng câu trả lời AI vào mặt sau thẻ!");
                    } catch (err: any) {
                      console.error("Failed to apply AI explanation:", err);
                      toast.error("Lỗi khi áp dụng: " + (err.message || "Không thể cập nhật thẻ"));
                    } finally {
                      setIsApplyingExplanation(false);
                    }
                  }}
                  disabled={isApplyingExplanation}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {isApplyingExplanation ? "Đang lưu..." : "Xác nhận"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Vibe Study Companion: Pomodoro, Breathing Guide, Touch Sketchpad & Memo */}
      <VibeStudyCompanion 
        currentCardId={currentCard?.id}
        deckTitle={deckTitle}
        isFlipped={isFlipped}
        isTimerOpen={isTimerOpen}
        setIsTimerOpen={setIsTimerOpen}
        isScratchpadOpen={isScratchpadOpen}
        setIsScratchpadOpen={setIsScratchpadOpen}
        isMiniPomodoro={isMiniPomodoro}
        setIsMiniPomodoro={setIsMiniPomodoro}
      />

    </div>
  );});
