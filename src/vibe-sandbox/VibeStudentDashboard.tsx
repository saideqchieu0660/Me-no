import CerebrasUsageChart from './CerebrasUsageChart';
import { VibeSyncEngine } from "./sync/VibeSyncEngine";
import { useLiveVibeDecks } from "./sync/useLiveVibeDecks";
import { CardStateManager } from "../lib/CardStateManager";
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { store, Deck, saveLocalUserDecks } from "../lib/store";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Plus,
  X,
  Play,
  TrendingUp,
  Users,
  Target,
  BookOpen,
  BrainCircuit,
  Activity,
  Flame,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  Trophy,
  Sparkles,
  Maximize2,
  Minimize2,
  Bell,
  BellOff,
  BellRing,
  Settings,
  AlertTriangle,
  Trash2,
  Snowflake,
  Volume2,
  VolumeX,
  Clock,
  Network,
  Award,
  Bot,
  User,
  Crown,
  ChevronUp,
  ChevronDown,
  Minus,
  Layers,
  Share2,
  Shield,
  RefreshCw,
  Heart,
  LogOut,
  Bug,
  Type,
  Library,
  Camera,
  Edit3,
  HelpCircle,
  Cpu,
  ShoppingBag,
  Lock,
  Zap,
  Ghost,
  ShieldAlert,
  Eye,
  BarChart3,
  WifiOff,
  Copy,
} from "lucide-react";
import { cn } from "../lib/utils";
import { safeRequest } from "../utils/apiClient";
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
  FirebaseListenerManager,
} from "../lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  limit,
  orderBy,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "motion/react";
import { getIsMuted, setMutedStatus } from "../lib/audio";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { OnboardingTour } from "../components/OnboardingTour";
const DocumentConverter = lazy(() => import("../components/DocumentConverter"));
const DetailedStatsModal = lazy(() => import("../components/DetailedStatsModal").then(m => ({ default: m.DetailedStatsModal })));
import { useTheme } from "../components/ThemeProvider";
const InteractiveTutorial = lazy(() => import("../components/InteractiveTutorial").then(m => ({ default: m.InteractiveTutorial })));
const EditDeckModal = lazy(() => import("../components/EditDeckModal").then(m => ({ default: m.EditDeckModal })));

const VibeDeckStatsBanner = lazy(() => import("./VibeDeckStatsBanner").then(m => ({ default: m.VibeDeckStatsBanner })));
const VibeFocusDeckCard = lazy(() => import("./VibeFocusDeckCard").then(m => ({ default: m.VibeFocusDeckCard })));
const VibeDailyMotivation = lazy(() => import("./VibeDailyMotivation").then(m => ({ default: m.VibeDailyMotivation })));
const VibePomodoroStats = lazy(() => import("./VibePomodoroStats").then(m => ({ default: m.VibePomodoroStats })));

import { DeckList } from "../components/DeckList";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { UnitedEngineFormattingTab } from "../components/UnitedEngineFormattingTab";
import { VibeManualFlashcardPipeline } from "./VibeManualFlashcardPipeline";
import { useAICooldown, triggerAICooldown } from "../lib/cooldown";
import {
  getLevelInfo,
  getUnlockedTitles,
  getUnlockedBorders,
  getAvatarBorderClass,
} from "../utils/xp";
import { toast } from "sonner";
import { getEnvDiagnostics } from "../utils/envDiagnostics";
import { OfflineStorageProgressWidget } from "../components/OfflineStorageProgressWidget";
import { isFeatureEnabled } from "../features.config";
import { MaintenanceStub } from "../components/MaintenanceStub";

export function parseRobustJsonArray(rawText: string): any[] {
  let cleaned = rawText.trim();
  cleaned = cleaned
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          return parsed[key];
        }
      }
    }
  } catch (e) {
    console.warn(
      "JSON.parse direct failed, trying robust regex extraction...",
      e,
    );
  }

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonCandidate = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (Array.isArray(parsed)) return parsed;
    } catch (e2) {
      console.error(
        "Failed to parse extracted bracket region as JSON array",
        e2,
      );
    }
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          return parsed[key];
        }
      }
    } catch (e3) {
      console.error("Failed to parse extracted brace region", e3);
    }
  }

  throw new Error(
    "Không thể trích xuất cấu trúc mảng JSON hợp lệ từ phản hồi của AI.",
  );
}
 
 const QuizCooldownTimer = ({ user }: any) => {
  const { cooldownRemaining } = useAICooldown(user);
  if (cooldownRemaining <= 0) return null;
  return <span>Cooldown: {cooldownRemaining}s</span>;
};

import { UserRoleBadge } from "../components/UserRoleBadge";

import { useSound } from "../hooks/useSound";
import {
  TopPerformersWidget,
  getTier,
} from "../components/TopPerformersWidget";
import { triggerCelebration } from "../lib/celebration";
import { VibeClasses } from "../vibe-sandbox/VibeClasses";
import { VibeStudyEntryModal } from "./VibeStudyEntryModal";

function AnimatedCounter({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const animation = animate(count, value, { duration: 1, ease: "easeOut" });
    return animation.stop;
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
}

// Confetti component removed

type QuizQuestion = {
  cardId?: string;
  deckId?: string;
  question: string;
  options: string[];
  correctAnswerIndex?: number;
  correctIndex?: number;
  correctAnswer?: string;
  explanation?: string;
};

const MOTIVATION_QUOTES = [
  "Virtue is nothing else than right reason. - Seneca",
  "We suffer more often in imagination than in reality. - Seneca",
  "Waste no more time arguing what a good man should be. Be one. - Marcus Aurelius",
  "He who fears death will never do anything worth of a man who is alive. - Seneca",
  "The impediment to action advances action. What stands in the way becomes the way. - Marcus Aurelius",
  "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult. - Seneca",
  "Well begun is half done. - Aristotle",
  "Discipline is the bridge between goals and accomplishment. - Jim Rohn",
  "The struggle you’re in today is developing the strength you need for tomorrow. - Robert Tew",
  "If you want to live a happy life, tie it to a goal, not to people or things. - Albert Einstein",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
  "It is better to conquer yourself than to win a thousand battles. - Buddha",
  "Mastery is not a destination, but a journey of continuous improvement. - Unknown",
  "Growth is painful. Change is painful. But nothing is as painful as staying stuck where you don't belong. - Mandy Hale",
  "Your potential is endless. Go do what you were created to do. - Dharma Mittra",
  "The secret of getting ahead is getting started. - Mark Twain",
  "Persistence guarantees that results are inevitable. - Paramahansa Yogananda",
  "Do what you can, with what you have, where you are. - Theodore Roosevelt",
  "The master has failed more times than the beginner has even tried. - Stephen McCranie",
  "Quality is not an act, it is a habit. - Aristotle",
  "If it is not right do not do it; if it is not true do not say it. - Marcus Aurelius",
  "First say to yourself what you would be; and then do what you have to do. - Epictetus",
  "No man is free who is not master of himself. - Epictetus",
  "Luck is what happens when preparation meets opportunity. - Seneca",
  "The best revenge is not to be like your enemy. - Marcus Aurelius",
  "Man is not worried by real problems so much as by his imagined anxieties about real problems. - Epictetus",
  "It is not death that a man should fear, but he should fear never beginning to live. - Marcus Aurelius",
  "Wealth consists not in having great possessions, but in having few wants. - Epictetus",
  "Whatever can happen at any time can happen today. - Seneca",
  "To be calm is the highest achievement of the self. - Zen proverb",
  "He who has a why to live for can bear almost any how. - Friedrich Nietzsche",
  "That which does not kill us makes us stronger. - Friedrich Nietzsche",
  "I think, therefore I am. - René Descartes",
  "There is only one good, knowledge, and one evil, ignorance. - Socrates",
  "We are what we repeatedly do. Excellence, then, is not an act, but a habit. - Aristotle",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className=" card-3d p-4 rounded-2xl">
        <p className="font-medium text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          <p className="font-light tracking-wide   font-medium text-2xl text-zinc-900 dark:text-zinc-100 leading-none">
            {payload[0].value}
          </p>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            pts
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function VibeStudentDashboard() {
  useEffect(() => {
    document.title = "Henosis - Student Dashboard";
  }, []);

  const { isFixLagEnabled, toggleFixLag } = useTheme();
  const { click, success, error } = useSound();
  const user = store.getCurrentUser();
  const prevLevelRef = useRef<number | null>(null);

  const [levelUpData, setLevelUpData] = useState<{
    level: number;
    quote: string;
  } | null>(null);

  const [editingDeckData, setEditingDeckData] = useState<{
    id: string;
    title: string;
    subject: string;
  } | null>(null);

  const [showAchillesSetup, setShowAchillesSetup] = useState(false);
  const [achillesSelectedDecks, setAchillesSelectedDecks] = useState<string[]>(
    [],
  );
  const [isAchillesQuizMode, setIsAchillesQuizMode] = useState(false);

  useEffect(() => {
    if (user) {
      const xpInfo = getLevelInfo(user.points || 0);
      const currentLevel = user.level || xpInfo.currentLevel;

      if (
        prevLevelRef.current !== null &&
        currentLevel > prevLevelRef.current
      ) {
        const LEVEL_UP_QUOTES = [
          "Sự đầu tư vào kiến thức luôn sinh lợi cao nhất. - Benjamin Franklin",
          "Cái rễ của học hành thì đắng cay, nhưng quả của nó thì ngọt ngào. - Aristotle",
          "Cách duy nhất để học là qua những trải nghiệm. - Khuyết danh",
          "Bộ óc không phải là một chiếc bình cần phải đổ đầy, mà là ngọn lửa cần được thắp sáng. - Plutarch",
          "Hãy học khi người thợ khác đang ngủ; làm việc khi người thợ khác trăn trở. - William Arthur Ward",
          "Hiểu biết giới hạn của bản thân chính là đỉnh cao của sự khôn ngoan. - Plato",
          "Tôi không thể dạy ai cái gì, tôi chỉ có thể làm họ suy nghĩ. - Socrates",
          "Kẻ bất trí phàn nàn về sự thiếu sót của người khác. Kẻ trí tuệ phàn nàn về chính mình. - Immanuel Kant",
          "Tự do không phải là làm những gì mình muốn, mà là làm những gì mình cho là đúng. - Immanuel Kant",
          "Nơi nào có tình yêu, nơi đó có sự sống. - Mahatma Gandhi",
          "Tri thức là sức mạnh, nhưng hành động mới làm nên sự vĩ đại. - Khuyết danh",
          "Biết người là khôn, biết mình là sáng. Tự thắng mình là mạnh. - Lão Tử",
          "Ta không phải là người thông minh, ta chỉ gắn bó với các vấn đề lâu hơn mà thôi. - Albert Einstein",
          "Một hành trình ngàn dặm luôn bắt đầu từ một bước đi nhỏ bé. - Lão Tử",
          "Khi chúng ta không còn có thể thay đổi một tình huống, chúng ta bị thách thức phải thay đổi chính mình. - Viktor Frankl",
          "Điều duy nhất cản trở ta học hỏi chính là nền giáo dục của ta. - Albert Einstein",
          "Lý tính luôn là nô lệ của đam mê. - David Hume",
          "Không có gì trong trí tuệ mà không qua giác quan trước đó. - John Locke",
        ];
        const randomQuote =
          LEVEL_UP_QUOTES[Math.floor(Math.random() * LEVEL_UP_QUOTES.length)];
        setLevelUpData({ level: currentLevel, quote: randomQuote });
        toast.success(`🎉 Trí tuệ thăng hoa! Bạn đã đạt cấp ${currentLevel}!`, {
          description:
            "Bạn vừa mở khóa chân trời nhận thức mới. Thật xuất sắc!",
        });
      }
      prevLevelRef.current = currentLevel;
    }
  }, [user?.points, user?.level]);

  const [quote] = useState(
    () =>
      MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)],
  );
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeLoreItem, setActiveLoreItem] = useState<string | null>(null);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [notebookItems, setNotebookItems] = useState<string[]>([]);

  const handleOpenNotebook = () => {
    try {
      const items = JSON.parse(localStorage.getItem("vibe_collected_ideas") || "[]");
      setNotebookItems(items);
    } catch {
      setNotebookItems([]);
    }
    setIsNotebookOpen(true);
  };

  const [activeTab, setActiveTab] = useState<
    | "all_sets"
    | "ranking"
    | "quiz"
    | "mock_exam_setup"
    | "settings"
    | "profile"
    | "create_deck"
    | "groups"
    | "vibe-classes"
    | "shop"
    | "united-engine"
  >(() => (sessionStorage.getItem("student_dashboard_tab") as any) || "all_sets");
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);


  useEffect(() => {
    sessionStorage.setItem("student_dashboard_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleVibeTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };
    window.addEventListener("vibe-tab-change", handleVibeTabChange as EventListener);
    return () => {
      window.removeEventListener("vibe-tab-change", handleVibeTabChange as EventListener);
    };
  }, []);
  const [selectedShopItem, setSelectedShopItem] = useState<{
    name: string;
    icon: any;
    iconColor: string;
    title: string;
    cost: number;
    desc: string;
    lore: string;
    actionText: string;
    bgEffect: string;
    onBuy: () => void;
  } | null>(null);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [isEditingProfileName, setIsEditingProfileName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement>(null);



  useEffect(() => {
    if (user && !isEditingProfileName) {
      setProfileNameInput(user.name || "");
    }
  }, [user?.name]);

  const resizeImageAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (!event.target?.result) {
          return reject(new Error("Lỗi đọc file (trống)"));
        }
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const max_size = 96;
            let width = img.width;
            let height = img.height;

            const size = Math.min(width, height);
            const xOffset = (width - size) / 2;
            const yOffset = (height - size) / 2;

            canvas.width = max_size;
            canvas.height = max_size;

            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(
                img,
                xOffset,
                yOffset,
                size,
                size,
                0,
                0,
                max_size,
                max_size,
              );
              const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
              resolve(dataUrl);
            } else {
              reject(new Error("Không thể khởi tạo canvas context"));
            }
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Lỗi định dạng ảnh"));
        img.src = event.target.result as string;
      };
      reader.onerror = () => reject(new Error("Lỗi đọc IO file"));
      try {
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  };

  const [viewMode, setViewModeState] = useState<"recent" | "all">(() => {
    return (
      (sessionStorage.getItem("student_viewMode") as "recent" | "all") ||
      "recent"
    );
  });

  const setViewMode = (mode: "recent" | "all") => {
    setViewModeState(mode);
    sessionStorage.setItem("student_viewMode", mode);
  };
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCacheClearConfirm, setShowCacheClearConfirm] = useState(false);
  // Removed unused state
  const [muteAll, setMuteAll] = useState(() => getIsMuted());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("henosis_notifications");
      return saved === "true";
    }
    return false;
  });
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<
    "7_days" | "30_days" | "all_time"
  >("7_days");
  const [isWeeklyStudyModalOpen, setIsWeeklyStudyModalOpen] = useState(false);
  const [isDetailedStatsModalOpen, setIsDetailedStatsModalOpen] =
    useState(false);
  const [showEnvDebug, setShowEnvDebug] = useState(false);
  const [localFontSize, setLocalFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("henosis-font-size");
    return saved ? parseInt(saved, 10) : 16;
  });

  const [localUiDensity, setLocalUiDensity] = useState<
    "comfortable" | "compact"
  >(() => {
    const saved = localStorage.getItem("henosis-ui-density");
    return saved === "compact" || saved === "comfortable"
      ? saved
      : "comfortable";
  });

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.size === "number") {
        setLocalFontSize(customEvent.detail.size);
      }
    };
    const handleDensityChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail &&
        (customEvent.detail.density === "comfortable" ||
          customEvent.detail.density === "compact")
      ) {
        setLocalUiDensity(customEvent.detail.density);
      }
    };
    window.addEventListener(
      "henosis-font-size-changed",
      handleCustomChange as EventListener,
    );
    window.addEventListener(
      "henosis-ui-density-changed",
      handleDensityChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        "henosis-font-size-changed",
        handleCustomChange as EventListener,
      );
      window.removeEventListener(
        "henosis-ui-density-changed",
        handleDensityChange as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const handleNotifChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail &&
        typeof customEvent.detail.enabled === "boolean"
      ) {
        setNotificationsEnabled(customEvent.detail.enabled);
      } else {
        const saved = localStorage.getItem("henosis_notifications") === "true";
        setNotificationsEnabled(saved);
      }
    };
    window.addEventListener("henosis_notifications_changed", handleNotifChange);
    return () => {
      window.removeEventListener(
        "henosis_notifications_changed",
        handleNotifChange,
      );
    };
  }, []);

  const rawDecks = useLiveVibeDecks();
  const [personalCardStates, setPersonalCardStates] = useState<any[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Manual creation states & logic
  const [manualTitle, setManualTitle] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
  const [manualCards, setManualCards] = useState<
    { front: string; back: string }[]
  >([]);

  const existingSubjects = useMemo(() => {
    const subjectsSet = new Set<string>();
    rawDecks.forEach((d) => {
      const s =
        (typeof d.subject === "string"
          ? d.subject
          : JSON.stringify(d.subject)) || "Tự chọn";
      if (s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
    // Add default core subjects in Vietnamese
    const defaults = [
      "Tiếng Anh",
      "Toán học",
      "Vật lý",
      "Hóa học",
      "Sinh học",
      "Lịch sử",
      "Địa lý",
      "Triết học",
      "Tin học / Lập trình",
      "Tự chọn",
    ];
    defaults.forEach((def) => subjectsSet.add(def));
    return Array.from(subjectsSet);
  }, [rawDecks]);
  const [currentFront, setCurrentFront] = useState("");
  const [currentBack, setCurrentBack] = useState("");
  const [creationMethod, setCreationMethod] = useState<"ai" | "manual">("ai");

  const handleAddManualCard = () => {
    if (!currentFront.trim() || !currentBack.trim()) return;
    setManualCards([
      ...manualCards,
      { front: currentFront.trim(), back: currentBack.trim() },
    ]);
    setCurrentFront("");
    setCurrentBack("");
  };

  const handleRemoveManualCard = (index: number) => {
    setManualCards(manualCards.filter((_, idx) => idx !== index));
  };

  const handleSaveManualDeck = async () => {
    if (!manualTitle.trim()) {
      toast("Vui lòng nhập tiêu đề bộ thẻ!");
      return;
    }
    if (manualCards.length === 0) {
      toast("Bộ thẻ cần có ít nhất 1 thẻ!");
      return;
    }
    const deckId = `deck_user_${Date.now()}`;
    const newDeck: Deck = {
      id: deckId,
      title: manualTitle.trim(),
      subject: manualSubject.trim() || "Tự chọn",
      cards: manualCards.map((c, idx) => ({
        id: `card_user_${Date.now()}_${idx}`,
        front: c.front,
        back: c.back,
        subject: manualSubject.trim() || "Tự chọn",
        mastery: 0,
        nextReview: Date.now(),
        isHard: false,
      })),
    };

    await VibeSyncEngine.saveDeck(newDeck);

    setManualTitle("");
    setManualSubject("");
    setIsCreatingNewSubject(false);
    setManualCards([]);
    toast(
      `Chúc mừng! Bộ thẻ "${newDeck.title}" đã được tạo thành công! Bạn có thể xem ngay tại tab "Bộ Học".`,
    );
    setActiveTab("all_sets");
  };

  const navigate = useNavigate();
  const unsubDecksRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    // Load card states efficiently via CardStateManager (caches in IDB, uses delta sync)
    const fetchCardStates = async () => {
      try {
        await CardStateManager.hydrateStates(user.id);
        const states = CardStateManager.getAllStates(user.id).map(s => ({
            id: s.cardId,
            mastery: s.mastery,
            isWeakCard: s.isHard,
            nextReviewDate: s.nextReviewDate
        }));
        if (isMounted) {
          setPersonalCardStates(states);
        }
      } catch (err) {
        console.warn("Failed to fetch initial card states, fallback to memory:", err);
      }
    };

    fetchCardStates();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // 3. Merge raw decks and personal card states to form localDecks and store
  const localDecks = useMemo(() => {
    if (rawDecks.length === 0) return store.getDecks();

    const stateMap = new Map();
    if (personalCardStates && personalCardStates.length > 0) {
      personalCardStates.forEach((s) => stateMap.set(s.id, s));
    }

    return rawDecks.map((deck) => {
      const clonedDeck = { ...deck };
      if (clonedDeck.cards) {
        clonedDeck.cards = clonedDeck.cards.map((card) => {
          const savedState = stateMap.get(card.id);
          if (savedState) {
            return {
              ...card,
              mastery:
                typeof savedState.mastery === "number" &&
                !isNaN(savedState.mastery)
                  ? savedState.mastery
                  : Number(card.mastery) || 0,
              nextReviewDate:
                typeof savedState.nextReviewDate === "number"
                  ? savedState.nextReviewDate
                  : card.nextReviewDate,
              nextReview:
                typeof savedState.nextReview === "number"
                  ? savedState.nextReview
                  : card.nextReview,
              interval:
                typeof savedState.interval === "number"
                  ? savedState.interval
                  : card.interval,
              repetitionCount:
                typeof savedState.repetitionCount === "number"
                  ? savedState.repetitionCount
                  : card.repetitionCount,
              easeFactor:
                typeof savedState.easeFactor === "number"
                  ? savedState.easeFactor
                  : card.easeFactor,
              isNewCard:
                typeof savedState.isNewCard === "boolean"
                  ? savedState.isNewCard
                  : false,
              isHard:
                typeof savedState.isWeakCard !== "undefined"
                  ? savedState.isWeakCard
                  : card.isHard,
            };
          }
          return card;
        });
      }
      return clonedDeck;
    });
  }, [rawDecks, personalCardStates]);

  // Sync to global store transparently
  useEffect(() => {
    const updateStore = async () => {
      const { store: globalStore } = await import("../lib/store");
      if (
        globalStore &&
        typeof (globalStore as any).setDecksLocally === "function" &&
        localDecks.length > 0
      ) {
        (globalStore as any).setDecksLocally(localDecks);
      }
    };
    updateStore();
  }, [localDecks]);

  // Sync overall average mastery progress to Firestore
  useEffect(() => {
    if (!user || localDecks.length === 0) return;

    const allCards = localDecks.flatMap((d) =>
      Array.isArray(d.cards) ? d.cards : [],
    );
    const avgMastery =
      allCards.length > 0
        ? Math.round(
            allCards.reduce((sum, c) => sum + (Number(c.mastery) || 0), 0) /
              allCards.length,
          )
        : 0;

    if (user.averageMastery !== avgMastery) {
      const syncMastery = async () => {
        try {
          const { dbService } = await import("../lib/firebase");
          // Update in Firebase User Profile
          await dbService.updateUserProfile(user.id, {
            averageMastery: avgMastery,
          });
          // Update locally in store
          store.updateCurrentUser({ averageMastery: avgMastery }, true, true);
        } catch (err) {
          console.error("Failed to sync overall averageMastery:", err);
        }
      };
      syncMastery();
    }
  }, [localDecks, user?.id, user?.averageMastery]);

  const decks = localDecks;

  const [dbUsers, setDbUsers] = useState<any[]>([]);

  // Fetch leaderboard data once on mount instead of real-time listener to save Firestore Reads
  useEffect(() => {
    if (!user || !isFeatureEnabled("ENABLE_RANKING")) return;
    
    let isMounted = true;
    
    const fetchLeaderboard = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("points", ">", 0),
          limit(100),
        );
        
        const snapshot = await getDocs(q);
        if (!isMounted) return;
        
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setDbUsers(list);

        // Dynamic synchronization with the global store
        const currentUserData = store.getCurrentUser();
        if (currentUserData) {
          const matched = list.find((u) => u.id === currentUserData.id);
          if (matched) {
            // Guard to block infinite cascading re-renders
            if (
              currentUserData.points !== matched.points ||
              currentUserData.streak !== matched.streak ||
              currentUserData.level !== matched.level ||
              currentUserData.title !== matched.title ||
              currentUserData.avatarBorder !== matched.avatarBorder ||
              currentUserData.isSchoolLover !== matched.isSchoolLover
            ) {
              store.updateCurrentUser(
                {
                  points: matched.points,
                  streak: matched.streak,
                  level: matched.level,
                  title: matched.title,
                  avatarBorder: matched.avatarBorder,
                  isSchoolLover: matched.isSchoolLover,
                },
                true,
                true // Optimization: silent update to prevent global App re-render on leaderboard ticks
              );
            }
          }
        }
      } catch (e) {
        console.warn("Leaderboard query error, fallback to memory:", e);
      }
    };

    fetchLeaderboard();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Listen for real-time changes to the active group, fetching and sorting member profiles dynamically
  useEffect(() => {
    // Group functionality removed
    return () => {};
  }, [user?.id]);

  const sortedUsers = useMemo(() => {
    const currentWeekId = store.getISOWeekId();
    return dbUsers.length > 0
      ? dbUsers
          .map((u) => {
            const isStale =
              u.lastWeeklyResetWeek && u.lastWeeklyResetWeek !== currentWeekId;
            const isMasked = u.hideRankUntil && u.hideRankUntil > Date.now();
            return {
              ...u,
              name: isMasked ? "Kẻ Ẩn Danh" : u.name,
              photoURL: isMasked ? "" : u.photoURL,
              avatarBorder: isMasked ? "none" : u.avatarBorder,
              title: isMasked ? "" : u.title,
              points: isStale ? 0 : u.points || 0,
              level: isMasked ? 1 : u.level,
              streak: isMasked ? 0 : u.streak,
            };
          })
          .filter((u) => {
            const roleLower = (u.role || "").toLowerCase();
            const isTargetRole = ["student", "admin", "teacher"].includes(
              roleLower,
            );
            const isValidUser =
              u.status !== "disabled" &&
              u.isAnonymous !== true &&
              !!u.email && u.email.trim() !== "" &&
              !u.email?.includes("anonymous@local") &&
              u.name !== "Guest Student";
            const hasPoints = (u.points || 0) > 0;
            // Admins/Teachers can be shown always, students must have > 0 points
            return (
              isTargetRole &&
              isValidUser &&
              (roleLower === "admin" || roleLower === "teacher" || hasPoints)
            );
          })
          .sort((a, b) => (b.points || 0) - (a.points || 0))
      : auth.currentUser && !auth.currentUser.isAnonymous
        ? []
        : [...store.getUsers()]
            .map((u) => {
              const isStale =
                u.lastWeeklyResetWeek &&
                u.lastWeeklyResetWeek !== currentWeekId;
              const isMasked = u.hideRankUntil && u.hideRankUntil > Date.now();
              return {
                ...u,
                name: isMasked ? "Kẻ Ẩn Danh" : u.name,
                photoURL: isMasked ? "" : u.photoURL,
                avatarBorder: isMasked ? "none" : u.avatarBorder,
                title: isMasked ? "" : u.title,
                points: isStale ? 0 : u.points || 0,
                level: isMasked ? 1 : u.level,
                streak: isMasked ? 0 : u.streak,
              };
            })
            .filter((u) => {
              const roleLower = (u.role || "").toLowerCase();
              const isTargetRole = ["student", "admin", "teacher"].includes(
                roleLower,
              );
              const isValidUser =
                u.isAnonymous !== true &&
                !!u.email && u.email.trim() !== "" &&
                !u.email?.includes("anonymous@local") &&
                u.name !== "Guest Student";
              const hasPoints = (u.points || 0) > 0;
              return (
                isTargetRole &&
                isValidUser &&
                (roleLower === "admin" || roleLower === "teacher" || hasPoints)
              );
            })
            .sort((a, b) => b.points - a.points);
  }, [
    dbUsers,
    store.getCurrentUser()?.hideRankUntil,
    store.getCurrentUser()?.doubleXPUntil,
  ]);

  const prevRanksRef = useRef<Record<string, number>>({});
  const [rankTrends, setRankTrends] = useState<
    Record<string, "up" | "down" | "same">
  >({});
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);

  const rankCelebratedRef = useRef(false);

  useEffect(() => {
    if (sortedUsers.length === 0) return;

    if (typeof window.requestIdleCallback !== "function") {
      window.requestIdleCallback = function (cb) {
        return setTimeout(function () {
          cb({
            didTimeout: false,
            timeRemaining: function () {
              return 50;
            },
          });
        }, 1);
      } as any;
      window.cancelIdleCallback = function (id) {
        clearTimeout(id);
      };
    }

    const idleHandle = window.requestIdleCallback(() => {
      const currentRanks: Record<string, number> = {};
      let hasChanges = false;
      let userClimbed = false;

      sortedUsers.forEach((u, index) => {
        currentRanks[u.id] = index;
        const prevRank = prevRanksRef.current[u.id];

        if (prevRank !== undefined && prevRank !== index) {
          hasChanges = true;
        }

        if (prevRank !== undefined && index < prevRank && u.id === user?.id) {
          userClimbed = true;
        }
      });

      if (Object.keys(prevRanksRef.current).length === 0) {
        prevRanksRef.current = currentRanks;
        return;
      }

      if (!hasChanges) {
        return;
      }

      window.requestAnimationFrame(() => {
        setRankTrends((prevTrends) => {
          const newTrends = { ...prevTrends };
          sortedUsers.forEach((u, index) => {
            const prevRank = prevRanksRef.current[u.id];
            if (prevRank !== undefined) {
              if (index < prevRank) {
                newTrends[u.id] = "up";
              } else if (index > prevRank) {
                newTrends[u.id] = "down";
              } else {
                newTrends[u.id] = newTrends[u.id] || "same";
              }
            } else {
              newTrends[u.id] = "same";
            }
          });
          return newTrends;
        });

        if (userClimbed && !rankCelebratedRef.current) {
          triggerCelebration();
          rankCelebratedRef.current = true;
        }
      });

      prevRanksRef.current = currentRanks;

      if (!userClimbed) {
        rankCelebratedRef.current = false;
      }
    });

    return () => window.cancelIdleCallback(idleHandle);
  }, [sortedUsers, user?.id]);

  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [activeGroup, setActiveGroup] = useState<any>(null);

  const handleCreateGroup = () => {
    if (groupName.trim()) {
      const g = store.createGroup(groupName);
      setActiveGroup(g);
      setGroupName("");
    }
  };

  const handleJoinGroup = () => {
    if (groupId.trim()) {
      const g = store.joinGroup(groupId);
      if (g) setActiveGroup(g);
    }
  };

  const handleLeaveGroup = () => {
    setActiveGroup(null);
  };

  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"hard" | "soft">("hard");

  const handleDeleteStudentSubmit = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      const { dbService } = await import("../lib/firebase");
      if (deleteMode === "hard") {
        await dbService.deleteUserProfile(studentToDelete.id);
        setDbUsers((prev) => prev.filter((u) => u.id !== studentToDelete.id));
      } else {
        await dbService.updateUserProfile(studentToDelete.id, {
          status: "disabled",
        });
        setDbUsers((prev) =>
          prev.map((u) =>
            u.id === studentToDelete.id ? { ...u, status: "disabled" } : u,
          ),
        );
      }
      setStudentToDelete(null);
    } catch (e: any) {
      console.error("Error deleting student:", e);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // --- Weekly Study Time Calculation ---
  const calculateWeeklyStudyHours = useCallback(() => {
    if (!user?.id) return { hours: 0, minutes: 0 };

    // Admin assigned manual study minutes
    const bonusMinutes = user.studyMinutes || 0;

    const history = store.getReviewHistory(user.id);
    if (!history || history.length === 0) {
      return {
        hours: Math.floor(bonusMinutes / 60),
        minutes: bonusMinutes % 60,
      };
    }

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyHistory = history
      .filter((r) => r.timestamp >= oneWeekAgo)
      .sort((a, b) => a.timestamp - b.timestamp);

    let totalMilliseconds = 0;
    const NEW_SESSION_THRESHOLD = 5 * 60 * 1000; // 5 minutes break = new session
    const DEFAULT_CARD_TIME = 15 * 1000; // 15 seconds for the first card of a session

    for (let i = 0; i < weeklyHistory.length; i++) {
      if (i === 0) {
        totalMilliseconds += DEFAULT_CARD_TIME;
      } else {
        const diff =
          weeklyHistory[i].timestamp - weeklyHistory[i - 1].timestamp;
        if (diff <= NEW_SESSION_THRESHOLD) {
          totalMilliseconds += diff;
        } else {
          totalMilliseconds += DEFAULT_CARD_TIME;
        }
      }
    }

    const totalMinutes =
      Math.floor(totalMilliseconds / (1000 * 60)) + bonusMinutes;
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  }, [user?.id, user?.studyMinutes]);

  const { hours: studyHours, minutes: studyMinutes } = useMemo(
    () => calculateWeeklyStudyHours(),
    [calculateWeeklyStudyHours],
  );
  // -------------------------------------

  const [showRemindLaterModal, setShowRemindLaterModal] = useState(false);
  const [remindLaterCardIds, setRemindLaterCardIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchReminders = () => {
      try {
        setRemindLaterCardIds(
          JSON.parse(
            localStorage.getItem("remind_later_items") || "[]",
          ) as string[],
        );
      } catch {
        setRemindLaterCardIds([]);
      }
    };
    fetchReminders();
    window.addEventListener("focus", fetchReminders);
    return () => window.removeEventListener("focus", fetchReminders);
  }, []);

  const remindLaterCards = useMemo(() => {
    const allCards = decks.flatMap((d) =>
      (d.cards || []).map((c) => ({
        ...c,
        originDeckId: d.id,
        originDeckTitle: d.title,
      })),
    );
    return allCards.filter(
      (c) => c.isHard === true || remindLaterCardIds.includes(c.id),
    );
  }, [decks, remindLaterCardIds]);

  const remindLaterCount = remindLaterCards.length;

  const startRemindLaterStudy = (specificCardId?: string) => {
    let cardsToStudy = remindLaterCards;
    if (specificCardId) {
      cardsToStudy = remindLaterCards.filter((c) => c.id === specificCardId);
    }
    if (cardsToStudy.length === 0) return;

    const remindDeck = {
      id: "remind-later-deck",
      title: "Thẻ nhắc nhở",
      subject: "Quick Study",
      description: "Bộ thẻ gồm các từ vựng bạn đã đánh dấu nhắc nhở lại.",
      cards: cardsToStudy,
      createdAt: new Date().toISOString(),
      ownerId: "system",
    };

    store.setTempDeck(remindDeck as any);
    setShowRemindLaterModal(false);
    navigate("/study/remind-later-deck");
  };

  const startCategoryRemindLaterStudy = useCallback(
    (subject: string, subjectDecks: Deck[]) => {
      const hardCards = subjectDecks
        .flatMap((d) =>
          (d.cards || []).map((c) => ({
            ...c,
            originDeckId: d.id,
            originDeckTitle: d.title,
          })),
        )
        .filter((c) => c.isHard === true || remindLaterCardIds.includes(c.id));
      const uniqueHardCards = Array.from(new Map(hardCards.map(c => [c.id, c])).values());
      if (uniqueHardCards.length === 0) return;

      const remindDeck = {
        id: `remind-later-${subject.replace(/\s+/g, "-")}`,
        title: `Ôn tập thẻ khó: ${subject}`,
        subject: subject,
        description: `Bộ thẻ gồm các từ vựng khó bạn đã đánh dấu trong phân mục ${subject}.`,
        cards: uniqueHardCards,
        createdAt: new Date().toISOString(),
        ownerId: "system",
      };

      store.setTempDeck(remindDeck as any);
      navigate(`/study/${remindDeck.id}`);
    },
    [navigate],
  );

  const startCategoryStudyAll = useCallback(
    (subject: string, subjectDecks: Deck[]) => {
      const allCards = subjectDecks.flatMap((d) =>
        (d.cards || []).map((c) => ({
          ...c,
          originDeckId: d.id,
          originDeckTitle: d.title,
        })),
      );
      if (allCards.length === 0) return;

      const allDeck = {
        id: `study-all-${subject.replace(/\s+/g, "-")}`,
        title: `Học Toàn Bộ: ${subject}`,
        subject: subject,
        description: `Bộ thẻ gồm toàn bộ từ vựng trong phân mục ${subject}.`,
        cards: allCards,
        createdAt: new Date().toISOString(),
        ownerId: "system",
      };

      store.setTempDeck(allDeck as any);
      navigate(`/study/${allDeck.id}`);
    },
    [navigate],
  );

  const streakCelebratedRef = useRef(false);

  useEffect(() => {
    if (user?.id) {
      const key = `last_streak_${user.id}`;
      const oldStreak = parseInt(sessionStorage.getItem(key) || "0", 10);
      if (user.streak && user.streak > oldStreak) {
        if (!streakCelebratedRef.current) {
          triggerCelebration();
          streakCelebratedRef.current = true;
        }
      } else if (user.streak === undefined || user.streak <= oldStreak) {
        streakCelebratedRef.current = false;
      }
      sessionStorage.setItem(key, (user.streak || 0).toString());
    }
  }, [user?.streak, user?.id]);

  const todayString = new Date().toISOString().split("T")[0];
  const [dailyGoal, setDailyGoal] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`daily_goal_${user?.id}`);
      return saved ? parseInt(saved, 10) : 20;
    }
    return 20;
  });

  const [, setForceRender] = useState(0);

  useEffect(() => {
    const handleSyncEvent = () => {
      setForceRender((prev) => prev + 1);
    };
    window.addEventListener("henosis-data-synced", handleSyncEvent);
    return () =>
      window.removeEventListener("henosis-data-synced", handleSyncEvent);
  }, []);

  // Note: we fetch this statically on dashboard load/render since we don't dispatch events on localstorage
  const dailyReviewed =
    typeof window !== "undefined"
      ? parseInt(
          localStorage.getItem(`daily_reviewed_${user?.id}_${todayString}`) ||
            "0",
          10,
        )
      : 0;

  const handleDailyGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 0;
    setDailyGoal(val);
    if (user?.id) localStorage.setItem(`daily_goal_${user.id}`, val.toString());
  };

  const pendingCardsCount = useMemo(() => {
    return decks.reduce((acc, deck) => {
      return (
        acc +
        (deck.cards || []).filter(
          (c) => c.nextReview && c.nextReview <= Date.now(),
        ).length
      );
    }, 0);
  }, [decks]);

  const deckWithLowestMastery = useMemo(() => {
    const decksWithCards = decks.filter((d) => d.cards && d.cards.length > 0);
    if (decksWithCards.length === 0) return null;

    return decksWithCards.reduce((lowest, current) => {
      const currentAvg =
        current.cards.reduce(
          (sum: number, c: any) => sum + (c.mastery || 0),
          0,
        ) / current.cards.length;
      const lowestAvg =
        lowest.cards.reduce(
          (sum: number, c: any) => sum + (c.mastery || 0),
          0,
        ) / lowest.cards.length;

      return currentAvg < lowestAvg ? current : lowest;
    }, decksWithCards[0]);
  }, [decks]);

  const toggleNotifications = async () => {
    const newVal = !notificationsEnabled;
    if (newVal) {
      if (!("Notification" in window)) {
        toast(
          "Trình duyệt của ngài không hỗ trợ Browser Notifications API rồi!",
        );
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast(
          "Ngài cần bật quyền thông báo đẩy trên trình duyệt thì hệ thống mới gửi nhắc nhở được!",
        );
        return;
      }
    }
    setNotificationsEnabled(newVal);
    localStorage.setItem("henosis_notifications", newVal.toString());
    window.dispatchEvent(
      new CustomEvent("henosis_notifications_changed", {
        detail: { enabled: newVal },
      }),
    );

    if (newVal) {
      try {
        new Notification("Henosis Web 🔔", {
          body: "Đã kích hoạt nhắc nhở học tập hàng ngày thành công! Hãy giữ vững ngọn lửa tri thức nhé! 💪🔥",
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearOldData = () => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("weak_cards_") ||
          key.includes("draft") ||
          key.includes("agent"))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    setShowClearConfirm(false);
    // Optionally trigger a page reload or force an update here if needed.
    window.location.reload();
  };

  const handleClearCache = () => {
    const systemKeysToKeep = [
      "theme",
      "isFixLagEnabled",
      "henosis-font-size",
      "henosis-ui-density",
      "autoUpdateInterval",
      "autoUpdateTargetTime",
      "agent3_response_mode",
      "agent3_response_style",
      "agent3_concise_mode",
      "henosis_notifications",
      "ai_request_cooldown_timestamp",
      "last_notified_today",
      "last_study_date",
      "hasRunTutorial",
    ];

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Keep firebase settings and system configs
        if (
          systemKeysToKeep.includes(key) ||
          key.startsWith("firebase:") ||
          key.startsWith("firebase-") ||
          key.includes("firebase")
        ) {
          continue;
        }
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    setShowCacheClearConfirm(false);
    toast("Đã dọn dẹp bộ nhớ cache thành công! 🎉");
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      if (auth.currentUser?.uid) {
        try {
          // Clean up co-study room presence before losing auth context
          const { doc, deleteDoc } = await import("firebase/firestore");
          const { db } = await import("../lib/firebase");
          await deleteDoc(doc(db, "costudy_room", auth.currentUser.uid));
        } catch (roomErr) {
          console.error("Cleanup room error:", roomErr);
        }
      }

      await signOut(auth);
      store.logout();
      FirebaseListenerManager.clearAll();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Quiz states
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [studyEntryDeck, setStudyEntryDeck] = useState<Deck | null>(null);
  const [quizQuote] = useState(
    MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)],
  );

  // Mock Exam specific states
  const [selectedExamDecks, setSelectedExamDecks] = useState<string[]>([]);
  const [examQuestionCount, setExamQuestionCount] = useState<number>(10);

  // AI MCQ Quiz dynamic setups
  const [activeQuizSetup, setActiveQuizSetup] = useState<{
    subject: string;
    decks: Deck[];
  } | null>(null);
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(15);

  const triggerQuiz = async (
    categoryName?: string,
    categoryDecks?: Deck[],
    customQuestionCount: number = 15,
    isAchillesMode: boolean = false,
  ) => {
    let cardsToUse: any[] = [];
    setIsAchillesQuizMode(isAchillesMode);
    if (categoryName && categoryDecks) {
      // Collect ALL cards from the decks in this category!
      for (const d of categoryDecks) {
        const cards = d.cards || [];
        cardsToUse.push(
          ...cards.map((c) => ({
            front: c.front,
            back: c.back,
            subject: c.subject || categoryName,
          })),
        );
      }
      // Shuffle and limit to a larger count so the AI has enough pool to select the exact number of questions
      cardsToUse = cardsToUse
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.max(customQuestionCount * 2, 40));
    } else {
      const allDecks = store.getDecks();
      let weakCards: any[] = [];
      for (const deck of allDecks) {
        const storageKey = `weak_cards_${deck.id}`;
        const weakIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
        let cards = (deck.cards || []).filter((c) => {
          if (weakIds.includes(c.id)) return true;
          // Exclude new unstudied cards mapping to low mastery
          if (
            c.isNewCard === true ||
            (c.isNewCard === undefined &&
              c.mastery === 0 &&
              (c.repetitionCount === undefined || c.repetitionCount === 0))
          )
            return false;
          return c.mastery < 50;
        });
        weakCards.push(
          ...cards.map((c) => ({
            front: c.front,
            back: c.back,
            subject: c.subject,
          })),
        );
      }

      weakCards = weakCards
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.max(customQuestionCount, 15));
      cardsToUse = weakCards;
    }

    if (cardsToUse.length === 0) {
      setQuizError(
        categoryName
          ? `Phân mục "${categoryName}" chưa có thẻ học nào để kiểm tra!`
          : "Bạn chưa có thẻ yếu nào để thực hiện kiểm tra AI. Hãy học thêm một số Flashcard nha!",
      );
      setTimeout(() => setQuizError(null), 3000);
      return;
    }

    if (user && user.role === "student") {
      triggerAICooldown(user);
    }
    setIsQuizLoading(true);
    setActiveTab("quiz");
    setQuizError(null);
    setQuizFinished(false);
    setQuizScore(0);
    setQuizCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);

    try {
      const idToken = (await auth.currentUser?.getIdToken()) || "";
      const res = await safeRequest("/api/agent3/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
          "x-user-is-pro": user?.isPro ? "true" : "false",
        },
        body: JSON.stringify({
          mode: "quiz",
          message: categoryName
            ? `Sinh đề kiểm tra MCQ cho mục học "${categoryName}"`
            : "Sinh đề kiểm tra MCQ theo format chuẩn json.",
          mcqData: cardsToUse,
          questionCount: customQuestionCount,
          difficulty: "medium",
          category_context: categoryName
            ? {
                id: categoryName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                name: categoryName,
                items_count: cardsToUse.length,
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            data.error ||
              "Bạn đang gọi AI quá nhanh. Hãy chờ 20s nạp năng lượng!",
          );
        }
        throw new Error(
          data.error?.message || "Lỗi kết nối từ Hệ thống Gemini",
        );
      }
      if (data.result) {
        let questions = parseRobustJsonArray(data.result);

        // Tầng xử lý tráo bài bằng thuật toán Fisher-Yates (Frontend Guardrail)
        questions = questions.map((q: any) => {
          if (
            q.options &&
            Array.isArray(q.options) &&
            typeof q.correctAnswerIndex === "number"
          ) {
            const correctOption = q.options[q.correctAnswerIndex];
            if (correctOption) {
              const arr = [...q.options];
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
              }
              q.options = arr;
              q.correctAnswerIndex = arr.indexOf(correctOption);
            }
          }
          return q;
        });

        // Guardrail triệt để: Giới hạn chính xác số câu hỏi theo mong muốn của người dùng
        if (questions.length > customQuestionCount) {
          questions = questions.slice(0, customQuestionCount);
        }

        setQuizQuestions(questions);
        setIsQuizLoading(false);
      } else {
        throw new Error("Dữ liệu rỗng bất thường");
      }
    } catch (err: any) {
      console.error("Quiz Error", err);
      setQuizError(
        "Lỗi Hệ Thống Sinh Đề AI: " + (err.message || "Vui lòng thử lại"),
      );
      setActiveTab("all_sets");
      setIsQuizLoading(false);
      setTimeout(() => setQuizError(null), 4000);
    }
  };

  const generateMockExam = async () => {
    if (selectedExamDecks.length === 0) {
      setQuizError("Vui lòng chọn ít nhất 1 bộ thẻ để thi!");
      setTimeout(() => setQuizError(null), 3000);
      return;
    }

    const allDecks = store.getDecks();
    const targetDecks = allDecks.filter((d) =>
      selectedExamDecks.includes(d.id),
    );

    if (user && user.role === "student") {
      triggerAICooldown(user);
    }
    setIsQuizLoading(true);
    setActiveTab("quiz");
    setQuizError(null);
    setQuizFinished(false);
    setQuizScore(0);
    setQuizCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswerRevealed(false);

    try {
      const idToken = (await auth.currentUser?.getIdToken()) || "";
      const res = await safeRequest("/api/exam/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
          "x-user-is-pro": user?.isPro ? "true" : "false",
        },
        body: JSON.stringify({
          decks: targetDecks,
          examType: "multiple_choice",
          count: examQuestionCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(
            data.error ||
              "Bạn đang gọi AI quá nhanh. Hãy chờ 20s nạp năng lượng!",
          );
        }
        throw new Error(data.error || "Lỗi kết nối từ Hệ thống Gemini");
      }
      if (data.result) {
        let questions = parseRobustJsonArray(data.result);

        // Tầng xử lý tráo bài bằng thuật toán Fisher-Yates (Frontend Guardrail)
        questions = questions.map((q: any) => {
          if (
            q.options &&
            Array.isArray(q.options) &&
            typeof q.correctAnswerIndex === "number"
          ) {
            const correctOption = q.options[q.correctAnswerIndex];
            if (correctOption) {
              const arr = [...q.options];
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
              }
              q.options = arr;
              q.correctAnswerIndex = arr.indexOf(correctOption);
            }
          }
          return q;
        });

        // Guardrail triệt để cho Mock Exam
        if (questions.length > examQuestionCount) {
          questions = questions.slice(0, examQuestionCount);
        }

        setQuizQuestions(questions);
        setIsQuizLoading(false);
      } else {
        throw new Error("Dữ liệu rỗng bất thường");
      }
    } catch (err: any) {
      console.error("Exam Generate Error", err);
      setQuizError(
        "Lỗi Hệ Thống Sinh Đề AI: " + (err.message || "Vui lòng thử lại"),
      );
      setActiveTab("mock_exam_setup");
      setIsQuizLoading(false);
      setTimeout(() => setQuizError(null), 4000);
    }
  };

  const currentQ = quizQuestions[quizCurrentIndex];

  const getCorrectIndex = (q: QuizQuestion) => {
    if (q.correctAnswerIndex !== undefined) return q.correctAnswerIndex;
    if (q.correctIndex !== undefined) return q.correctIndex;
    if (q.correctAnswer) {
      const charCode = q.correctAnswer.charCodeAt(0);
      if (charCode >= 65 && charCode <= 68) return charCode - 65; // A=0, B=1...
    }
    return 0; // fallback
  };

  const handleOptionClick = (idx: number) => {
    if (isAnswerRevealed) return;
    setSelectedOption(idx);
    setIsAnswerRevealed(true);

    const isCorrect = idx === getCorrectIndex(currentQ);
    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
    } else if (isAchillesQuizMode) {
      // Penalty: trừ streak hoặc trừ level
      toast(
        "Bạn đã chọn sai! Lời nguyền Achilles giáng xuống... Streak của bạn đã bị phá vỡ hoàn toàn.",
      );
      store.breakAchillesStreak();
      if (user && (user.level || 1) > 1) {
        // just let it break streak for now
      }
      setQuizFinished(true); // Terminate quiz
    }

    if (currentQ.cardId && currentQ.deckId) {
      store.updateCardMastery(currentQ.deckId, currentQ.cardId, isCorrect);
      // Phân tán ra UI reload state
      setForceRender((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    // If Achilles mode failed instantly, quizFinished is already true. But wait, if quizFinished is true, UI already changed and we can't click next.
    const isFailedAchilles =
      isAchillesQuizMode &&
      selectedOption !== null &&
      selectedOption !== getCorrectIndex(currentQ);

    if (isFailedAchilles) {
      setQuizFinished(true);
      return;
    }

    if (quizCurrentIndex + 1 < quizQuestions.length) {
      setQuizCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
    } else {
      setQuizFinished(true);
      // Check if Achilles success
      if (isAchillesQuizMode) {
        const totalCorrect =
          quizScore + (selectedOption === getCorrectIndex(currentQ) ? 1 : 0);
        if (totalCorrect === quizQuestions.length) {
          store.activateAchillesBuff();
          toast(
            "🎉 THÀNH CÔNG! Nghi thức Achilles hoàn tất. Bạn được x4 XP trong vòng 24 giờ!",
          );
          setForceRender((prev) => prev + 1);
        }
      }
    }
  };

  // Mock trend data
  const basePoints = user?.points || 0;

  const getTrendData = () => {
    if (chartPeriod === "30_days") {
      return Array.from({ length: 15 })
        .map((_, i) => ({
          day: `Day ${i * 2 + 1}`,
          points: Math.max(0, basePoints - (15 - i) * 12),
        }))
        .concat([{ day: "Today", points: basePoints }]);
    } else if (chartPeriod === "all_time") {
      return Array.from({ length: 10 })
        .map((_, i) => ({
          day: `Month ${i + 1}`,
          points: Math.max(0, basePoints - (10 - i) * 30),
        }))
        .concat([{ day: "Today", points: basePoints }]);
    } else {
      // 7 days
      return [
        { day: "Day 1", points: Math.max(0, basePoints - 45) },
        { day: "Day 2", points: Math.max(0, basePoints - 38) },
        { day: "Day 3", points: Math.max(0, basePoints - 29) },
        { day: "Day 4", points: Math.max(0, basePoints - 15) },
        { day: "Day 5", points: Math.max(0, basePoints - 8) },
        { day: "Day 6", points: Math.max(0, basePoints - 3) },
        { day: "Today", points: basePoints },
      ];
    }
  };
  const trendData = useMemo(() => getTrendData(), [chartPeriod, basePoints]);
  // Streak Data for the last 30 days
  const getStreakData = useCallback(() => {
    return Array.from({ length: 30 }).map((_, i) => ({
      day: `Day ${i + 1}`,
      streak: Math.max(0, (user?.streak || 0) - (29 - i)),
    }));
  }, [user?.streak]);
  const streakData = useMemo(() => getStreakData(), [getStreakData]);

  const CustomStreakTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className=" card-3d p-4 rounded-2xl">
          <p className="font-medium text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <p className="font-light tracking-wide   font-medium text-2xl text-zinc-900 dark:text-zinc-100 leading-none">
              {payload[0].value}
            </p>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              days
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calendar Days Calculation for tracking active study days
  const calendarYear = currentMonth.getFullYear();
  const calendarMonth = currentMonth.getMonth(); // 0-indexed month
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sunday, 1 is Monday ...
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Translate month names for visual display
  const monthNamesVi = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];
  const calendarMonthLabel = `${monthNamesVi[calendarMonth]} ${calendarYear}`;

  // Build active study days mapping
  const activeStudyDaysSet = new Set<string>();
  if (user) {
    // Collect from actual reviewed items
    store.getReviewHistory(user.id).forEach((record) => {
      const d = new Date(record.timestamp);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      activeStudyDaysSet.add(dateStr);
    });

    // We also map streak backward so the student sees their streak beautifully mapped on the calendar!
    const userStreak = user.streak || 0;
    for (let s = 0; s < userStreak; s++) {
      const d = new Date();
      d.setDate(d.getDate() - s);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      activeStudyDaysSet.add(dateStr);
    }
  }

  const navigatePrevMonth = () => {
    setCurrentMonth(new Date(calendarYear, calendarMonth - 1, 1));
  };
  const navigateNextMonth = () => {
    setCurrentMonth(new Date(calendarYear, calendarMonth + 1, 1));
  };

  if (!user) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in pb-12 relative w-full max-w-full">
      <AnimatePresence>
        {levelUpData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-4"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
              onClick={() => setLevelUpData(null)}
            />
            <div className="relative glass-panel rounded-3xl p-8 max-w-xl w-full flex flex-col items-center text-center shadow-2xl pointer-events-auto bg-orange-50 dark:bg-orange-900/10 border border-orange-500/20">
              <button
                onClick={() => setLevelUpData(null)}
                className="absolute top-4 right-4 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:scale-105 transition"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
              <div className="w-24 h-24 mb-6 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center p-1 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
                <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/30 to-transparent" />
                  <span className="  font-medium font-extrabold text-4xl text-zinc-900 dark:text-zinc-100 z-10">
                    {levelUpData.level}
                  </span>
                </div>
              </div>

              <h2 className="  font-medium text-3xl font-black mb-2 text-zinc-900 dark:text-zinc-100">
                Thăng Cấp!
              </h2>
              <p className="font-light tracking-wide text-zinc-600 dark:text-zinc-300 font-medium mb-8">
                Ngài vừa đạt ranh giới tri thức mới.
              </p>

              <div className="relative p-6 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 ">
                <BookOpen className="absolute -top-3 -left-3 w-8 h-8 text-zinc-900 dark:text-zinc-100 opacity-50" />
                <p className="font-light tracking-wide text-zinc-700 dark:text-zinc-200 font-medium whitespace-pre-wrap">
                  "{levelUpData.quote.split(" - ")[0]}"
                </p>
                <p className="font-light tracking-wide text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-2">
                  — {levelUpData.quote.split(" - ")[1] || "Khuyết danh"}
                </p>
              </div>

              <button
                onClick={() => setLevelUpData(null)}
                className="mt-8 px-8 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                Lĩnh Ngộ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <OnboardingTour
        onComplete={() => {
          const hasRun = localStorage.getItem("hasRunTutorial");
          if (hasRun !== "true") {
            setShowTutorial(true);
          }
        }}
      />
      {/* Thêm Toast Thông báo Toast Thành Công */}
      {joinStatus && (
        <div className="fixed top-20 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right-8 font-bold flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6" />
          {joinStatus}
        </div>
      )}

      {/* Thêm Toast Thông báo lỗi AI */}
      {quizError && (
        <div className="fixed top-20 right-4 z-50 bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right-8 font-bold flex items-center gap-3">
          <XCircle className="w-6 h-6" />
          {quizError}
        </div>
      )}

      {/* Banner chế độ xem Admin */}
      {user &&
        (user.role === "admin" ||
          user.role === "Admin" ||
          user.role === "teacher") && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-900 dark:bg-zinc-100/10 border border-orange-500/30 text-orange-900 dark:text-orange-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-zinc-900 dark:text-zinc-100 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">
                  Bạn đang ở Student View (Học Viên)
                </span>
                . Các thay đổi và học tập thử nghiệm sẽ mô phỏng giống học sinh
                để bạn dễ kiểm thử.
              </div>
            </div>
            <button
              onClick={() => {
                sessionStorage.setItem("isAdminMode", "true");
                window.location.href = "/teacher";
              }}
              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-900 dark:bg-zinc-100  font-extrabold text-xs rounded-lg transition-all duration-300 shadow-md whitespace-nowrap cursor-pointer"
            >
              Quay lại Admin View ⚡
            </button>
          </div>
        )}

      {/* Floating Notebook Button */}
      <button
        onClick={handleOpenNotebook}
        className="fixed bottom-6 right-6 z-[90] p-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-2xl hover:scale-110 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center group"
        title="Sổ tay gom nhặt ý tưởng"
      >
        <BookOpen className="w-6 h-6" />
        <span className="absolute right-full mr-4 bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none">
          Sổ tay cá nhân
        </span>
      </button>

      <AnimatePresence>
        {activeTab !== "quiz" && (
          <motion.section
            key="header-stats"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
            transition={{ duration: 0.3 }}
            className="glass p-4 sm:p-8 rounded-2xl relative overflow-hidden"
            data-tour="step-1"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
            </div>
            <div className="relative z-10">
              <h2 className="  font-medium text-3xl text-zinc-900 dark:text-zinc-100 mb-2">
                Salve, {user?.name}
              </h2>
              <span className="text-sm text-gray-400 block mt-1 mb-2 tracking-wide">
                {user?.email || auth.currentUser?.email || "No Email linked"}
              </span>
              <p className="font-light tracking-wide font-roman text-lg  opacity-80 mb-6 min-h-[3.5rem]">
                {quote}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="bg-zinc-900 dark:bg-zinc-100/20 text-orange-700 dark:text-orange-400 px-4 py-2 rounded-lg font-bold flex items-center gap-2 relative">
                  <TrendingUp className="w-5 h-5" />
                  Weekly Points: <AnimatedCounter value={user?.points || 0} />
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab === "quiz" && (
        <div className="w-full">
          <ErrorBoundary
            fallback={
              <div className="p-8 bg-red-100/50 rounded-lg text-center dark:bg-red-900/10">
                Bài thi tạm thời không khả dụng do lỗi hệ thống AI. Vui lòng
                quay lại sau.
              </div>
            }
          >
            <motion.div
              key="quiz-tab"
              initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
              transition={{ duration: 0.4 }}
            >
              {isQuizLoading ? (
                <div className="glass p-16 rounded-2xl flex flex-col items-center justify-center text-center space-y-6">
                  <Loader2 className="w-16 h-16 animate-spin text-zinc-900 dark:text-zinc-100" />
                  <h2 className="  font-medium text-3xl text-zinc-900 dark:text-zinc-100">
                    Đang khởi tạo bài kiểm tra năng lực...
                  </h2>
                  <p className="font-light tracking-wide opacity-70 max-w-lg  ">
                    Chuyên gia khảo thí AI đang phân tích dữ liệu hổng kiến thức
                    của bạn để tạo 15 câu trắc nghiệm thực chiến.
                  </p>
                  <div className="  font-medium font-mono text-xl bg-zinc-200/60 dark:bg-zinc-800/50 px-6 py-2 rounded-full border border-orange-600/20 dark:border-orange-500/30 text-zinc-800 dark:text-zinc-200">
                    <QuizCooldownTimer user={user} />
                  </div>
                </div>
              ) : quizFinished ? (
                <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center text-center space-y-6">
                  <Trophy className="w-24 h-24 text-zinc-900 dark:text-zinc-100 mb-4" />
                  <h2 className="  font-medium text-4xl text-zinc-900 dark:text-zinc-100">
                    Tổng kết Bài Test
                  </h2>
                  <div className="  font-medium text-6xl font-mono text-zinc-800 dark:text-zinc-200 dark:text-orange-400 my-4">
                    {quizScore}{" "}
                    <span className="  font-medium opacity-40 text-4xl">
                      / {quizQuestions.length}
                    </span>
                  </div>
                  <p className="font-light tracking-wide   font-medium font-roman text-xl  opacity-80 border-l-4 border-orange-500 pl-4 py-2">
                    "{quizQuote}"
                  </p>

                  <div className="pt-8">
                    <button
                      onClick={() => {
                        setActiveTab("all_sets");
                        setQuizQuestions([]);
                        setIsAchillesQuizMode(false);
                      }}
                      className="bg-black dark:bg-white text-white dark: px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition flex items-center gap-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Về trang chủ Dashboard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass p-8 md:p-12 rounded-2xl space-y-8 max-w-4xl mx-auto">
                  <div className="flex justify-between items-center border-b border-orange-600/20 dark:border-orange-500/30 pb-4">
                    <button
                      onClick={() => {
                        setActiveTab("all_sets");
                        setQuizQuestions([]);
                        setIsAchillesQuizMode(false);
                      }}
                      className="opacity-60 hover:opacity-100 transition flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" /> Thoát Bài Test
                    </button>
                    <div className="font-mono bg-zinc-900 dark:bg-zinc-100/10 text-orange-700 dark:text-orange-400 px-4 py-1.5 rounded-full font-bold">
                      Câu hỏi {quizCurrentIndex + 1} / {quizQuestions.length}
                    </div>
                  </div>

                  <div className="min-h-[120px] flex items-center justify-center py-6">
                    <h3 className="  font-medium text-2xl md:text-3xl text-zinc-900 dark:text-zinc-100 leading-relaxed text-center">
                      <div className="markdown-body inline-block">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath, remarkBreaks]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {currentQ?.question || ""}
                        </ReactMarkdown>
                      </div>
                    </h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {currentQ?.options.map((opt, i) => {
                      let optClass =
                        "border border-orange-600/20 dark:border-orange-500/30 hover:border-orange-500 hover:bg-zinc-900 dark:bg-zinc-100/5 bg-zinc-200/60 dark:bg-zinc-800/50 opacity-90 hover:opacity-100";
                      let OptIcon = null;

                      if (isAnswerRevealed) {
                        const cIdx = getCorrectIndex(currentQ);
                        if (i === cIdx) {
                          optClass =
                            "bg-green-500/20 border-green-500 text-green-900 dark:text-green-300 font-bold shadow-md ring-2 ring-green-500 scale-[1.02] transition-transform";
                          OptIcon = (
                            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 absolute right-4" />
                          );
                        } else if (i === selectedOption) {
                          optClass =
                            "bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-400 opacity-60";
                          OptIcon = (
                            <XCircle className="w-6 h-6 text-red-500/50 absolute right-4" />
                          );
                        } else {
                          optClass =
                            "border-orange-600/20 dark:border-orange-500/30 opacity-40 grayscale";
                        }
                      } else if (i === selectedOption) {
                        optClass =
                          "ring-2 ring-orange-500 bg-zinc-900 dark:bg-zinc-100/10 scale-[1.02] transition-transform font-bold";
                      }

                      return (
                        <button
                          key={i}
                          disabled={isAnswerRevealed}
                          onClick={() => handleOptionClick(i)}
                          className={cn(
                            "relative p-6 rounded-xl text-left transition-all duration-300 flex items-center md:text-lg",
                            optClass,
                            isAnswerRevealed
                              ? "cursor-default"
                              : "cursor-pointer",
                          )}
                        >
                          <span className="font-bold opacity-50 mr-4 font-mono">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <div className="markdown-body pr-8">
                            <ReactMarkdown
                              remarkPlugins={[remarkMath, remarkBreaks]}
                              rehypePlugins={[rehypeKatex]}
                            >
                              {opt}
                            </ReactMarkdown>
                          </div>
                          {OptIcon}
                        </button>
                      );
                    })}
                  </div>

                  {isAnswerRevealed && (
                    <div className="pt-8 border-t border-orange-600/20 dark:border-orange-500/30 animate-in fade-in slide-in-from-bottom-4 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex-1 bg-zinc-200/60 dark:bg-zinc-800/50 p-4 rounded-xl border border-orange-600/20 dark:border-orange-500/30">
                        <div className="flex items-center justify-between mb-2 gap-4">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 dark:text-orange-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> AI Giải Thích:
                          </span>
                          <button
                            onClick={() => {
                              const explanationText =
                                currentQ?.explanation ||
                                "Đáp án đúng là " +
                                  String.fromCharCode(
                                    65 + getCorrectIndex(currentQ),
                                  );
                              window.dispatchEvent(
                                new CustomEvent("trigger-agent3", {
                                  detail: {
                                    message: `Hãy phân tích, giải thích chi tiết, đưa ra ví dụ và các thông tin mở rộng sâu hơn cho khái niệm sau: "${explanationText}"`,
                                    context: `Bài thi trắc nghiệm:\nCâu hỏi: ${currentQ?.question || ""}\nĐáp án: ${currentQ?.options?.join(" | ") || ""}\nGiải thích gốc: ${explanationText}`,
                                  },
                                }),
                              );
                            }}
                            className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            title="Agent 3 sẽ giúp bạn đào sâu kiến thức này"
                          >
                            <Bot className="w-3.5 h-3.5" />
                            Tìm hiểu chuyên sâu với Agent 3
                            <span className="absolute inset-0 rounded-full bg-blue-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </div>
                        <p className="font-light tracking-wide   opacity-90">
                          {currentQ?.explanation ||
                            "Đáp án đúng là " +
                              String.fromCharCode(
                                65 + getCorrectIndex(currentQ),
                              )}
                        </p>
                      </div>

                      <button
                        onClick={handleNextQuestion}
                        className="relative overflow-hidden group bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:bg-zinc-200  px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-lg transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 shrink-0 w-full md:w-auto "
                      >
                        {quizCurrentIndex + 1 < quizQuestions.length
                          ? "Câu tiếp theo"
                          : "Xem kết quả"}
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </ErrorBoundary>
        </div>
      )}
      
      </AnimatePresence>


      {activeTab === "all_sets" && (
        <div className="w-full">
        <motion.div
          key="all_sets-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 animate-in fade-in duration-300"
        >
          <div className="flex flex-col gap-2">
            <h3 className="  font-medium text-3xl text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
              📚 Bộ Học
              Tập Toàn Diện
            </h3>
            <p className="font-light tracking-wide text-zinc-500 dark:text-zinc-400 text-sm">
              Xem toàn bộ danh sách các bộ thẻ học của bạn, được phân loại tự
              động và khoa học theo từng chủ đề.
            </p>
          </div>

          <div className="max-w-md">
            <OfflineStorageProgressWidget variant="small" />
          </div>

          <Suspense fallback={null}>
            <CerebrasUsageChart />
            <VibePomodoroStats currentDeckTitle="Tất cả" />
            <VibeFocusDeckCard decks={decks} />
            <VibeDailyMotivation />
          </Suspense>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass p-5 rounded-3xl mb-8 border border-zinc-200/50 dark:border-zinc-800/50">
            <div className="text-zinc-600 dark:text-zinc-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <Layers className="w-5 h-5" /> Quản lý nâng cao
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button onClick={() => toast.info("Tính năng Gộp Thẻ đang được phát triển!")} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all">
                <Layers className="w-4 h-4" /> Gộp Bộ Thẻ
              </button>
              <button onClick={() => toast.info("Tính năng Chia Sẻ Mã đang được phát triển!")} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold shadow-sm hover:shadow hover:-translate-y-0.5 transition-all">
                <Share2 className="w-4 h-4" /> Mã Chia Sẻ
              </button>
            </div>
          </div>

          <div className="glass p-6 md:p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl">
            <DeckList
              decks={decks}
              showSearch={true}
              groupBySubject={true}
              onCategoryQuiz={(subject, subjectDecks) =>
                setActiveQuizSetup({ subject, decks: subjectDecks })
              }
              onCategoryReviewHardCards={startCategoryRemindLaterStudy}
              onCategoryStudyAll={startCategoryStudyAll}
              isAdmin={
                user?.role === "admin" ||
                user?.role === "Admin" ||
                user?.role === "teacher" ||
                sessionStorage.getItem("adminToken") === "true"
              }
              onEditDeck={(deck) =>
                setEditingDeckData({
                  id: deck.id,
                  title:
                    typeof deck.title === "string"
                      ? deck.title
                      : JSON.stringify(deck.title),
                  subject: deck.subject || "Tự chọn",
                })
              }
            />
          </div>
        </motion.div>
      </div>
      )}
      

      {activeTab === "create_deck" && (
        <div className="w-full">
        <motion.div
          key="create_deck-tab"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-5xl mx-auto space-y-6"
        >
          <div className="space-y-4">
            <div className="bg-zinc-900 dark:bg-zinc-100/10 text-orange-700 dark:text-orange-400 p-4 rounded-xl text-xs font-bold ring-1 ring-orange-500/20 text-center">
              💡 Kỷ lục trích xuất 1000 thẻ học siêu tốc nhờ Concurrency Pool 8
              Keys xoay vòng cực mượt!
            </div>
            <Suspense fallback={<div className="p-4 text-center">Loading Converter...</div>}>
              <DocumentConverter />
            </Suspense>
          </div>
        </motion.div>
      </div>
      )}
      

      {activeTab === "vibe-classes" && (
        <div className="w-full">
        <motion.div
          key="vibe-classes-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <VibeClasses />
        </motion.div>
      </div>
      )}
      

      {activeTab === "groups" && (
        <div className="w-full">
        <motion.div
          key="groups-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-8 md:p-12 rounded-2xl relative overflow-hidden max-w-4xl mx-auto"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
          </div>
          <div className="relative z-10 space-y-12">
            {activeGroup ? (
              <div className="space-y-8 animate-in zoom-in-95 duration-500">
                <div className="text-center mb-10">
                  <h3 className="  font-medium text-4xl text-zinc-900 dark:text-zinc-100 mb-2 flex justify-center items-center gap-3">
                    <Users className="w-8 h-8 text-blue-500" />
                    {activeGroup.name}
                  </h3>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <span
                      className="font-mono bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 text-lg font-bold py-2 px-6 rounded-lg select-all cursor-pointer"
                      title="Copy to clipboard"
                    >
                      ID: {activeGroup.id}
                    </span>
                    <button
                      onClick={handleLeaveGroup}
                      className="text-red-500 hover:text-red-600 bg-red-500/10 px-4 py-2 rounded-lg font-bold transition hover:bg-red-500/20"
                    >
                      Rời Nhóm
                    </button>
                  </div>
                </div>

                <div className="bg-background/40 backdrop-blur border border-orange-600/20 dark:border-orange-500/30 p-8 rounded-2xl max-w-2xl mx-auto space-y-6 shadow-xl">
                  <div className="flex items-center gap-3 border-b border-orange-600/20 dark:border-orange-500/30 pb-4">
                    <Sparkles className="w-6 h-6 text-zinc-900 dark:text-zinc-100" />
                    <h4 className="  font-medium text-xl text-zinc-800 dark:text-zinc-100">
                      Xếp Hạng Thành Viên
                    </h4>
                  </div>

                  <ul className="space-y-4">
                    {activeGroup.members.map((member, i) => (
                      <li
                        key={member.id || `member-${i}`}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all",
                          member.isCurrent
                            ? "bg-zinc-900 dark:bg-zinc-100/10 border-orange-500 text-orange-900 dark:text-orange-100 shadow-md transform scale-[1.02]"
                            : "bg-zinc-200/60 dark:bg-zinc-800/50 border-transparent",
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                              i === 0
                                ? "bg-zinc-900 dark:bg-zinc-100  shadow-lg shadow-orange-500/20"
                                : i === 1
                                  ? "bg-gray-300  shadow-lg"
                                  : i === 2
                                    ? "bg-orange-400  shadow-lg"
                                    : "bg-zinc-300/60 dark:bg-zinc-800/80",
                            )}
                          >
                            #{i + 1}
                          </div>
                          <div>
                            <p className="font-light tracking-wide font-bold flex items-center gap-2">
                              {member.name}
                              {member.isCurrent && (
                                <span className="bg-zinc-900 dark:bg-zinc-100  text-xs px-2 py-0.5 rounded-full">
                                  (Bạn)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="font-mono font-bold text-lg opacity-80">
                          {member.points} pts
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-10">
                  <h3 className="  font-medium text-3xl text-zinc-900 dark:text-zinc-100 mb-2">
                    👥 Nhóm Học Tập
                  </h3>
                  <p className="font-light tracking-wide opacity-70   text-lg max-w-xl mx-auto">
                    Tham gia hoặc tạo nhóm để cùng nhau tiến bộ. Hành trình tri
                    thức sẽ bớt gian nan hơn khi có bạn đồng hành.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12">
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-orange-600/20 dark:border-orange-500/30 pb-4">
                      <span className="bg-blue-500 text-white p-2 rounded-lg">
                        <Users className="w-6 h-6" />
                      </span>
                      <h3 className="  font-medium text-2xl text-zinc-900 dark:text-zinc-100">
                        Tham gia nhóm
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <label className="text-base font-bold opacity-80 block">
                        Nhập ID nhóm của bạn:
                      </label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-zinc-200/60 dark:bg-zinc-800/50 border-2 border-orange-600/20 dark:border-orange-500/30 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-lg focus:outline-none focus:border-blue-500 font-mono transition-colors"
                          placeholder="Ví dụ: A7B9F2"
                          value={groupId}
                          onChange={(e) => setGroupId(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleJoinGroup()
                          }
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          click();
                          handleJoinGroup();
                        }}
                        className="bg-blue-600 text-white w-full py-3 rounded-xl text-lg font-bold hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 transition shadow-blue-500/10"
                      >
                        Tham Gia Ngay
                      </motion.button>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-orange-600/20 dark:border-orange-500/30 pb-4">
                      <span className="bg-zinc-900 dark:bg-zinc-100  p-2 rounded-lg">
                        <Sparkles className="w-6 h-6" />
                      </span>
                      <h3 className="  font-medium text-2xl text-zinc-900 dark:text-zinc-100">
                        Tạo nhóm học tập
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <label className="text-base font-bold opacity-80 block">
                        Tên nhóm mới:
                      </label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-zinc-200/60 dark:bg-zinc-800/50 border-2 border-orange-600/20 dark:border-orange-500/30 rounded-xl px-4 py-3 text-zinc-900 dark:text-zinc-100 text-lg focus:outline-none focus:border-orange-500 transition-colors"
                          placeholder="Nhóm vượt vũ môn..."
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleCreateGroup()
                          }
                          disabled={isCreating}
                        />
                      </div>
                      <button
                        onClick={handleCreateGroup}
                        disabled={isCreating}
                        className="relative overflow-hidden group bg-zinc-900 dark:bg-zinc-100  w-full py-3 rounded-xl text-lg font-bold hover:bg-zinc-800 dark:bg-zinc-200 shadow-lg hover:shadow-lg transition-all duration-500 transform hover:-translate-y-1 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none "
                      >
                        {isCreating ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" /> Đang
                            thiết lập...
                          </span>
                        ) : (
                          "Khởi Tạo Nhóm"
                        )}
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
      )}
      

      {activeTab === "ranking" && (
        <div className="w-full">
        <motion.div
          key="ranking-tab"
          id="leaderboard-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-4 md:p-8 rounded-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          </div>
          <div className="relative z-10 max-w-4xl mx-auto space-y-10">
            <div className="text-center">
              <h3 className="  font-medium text-3xl text-zinc-800 dark:text-zinc-100 mb-2">
                🏆 Bảng Xếp Hạng
              </h3>
              <p className="font-light tracking-wide opacity-70">
                Top học sinh có điểm tích lũy phong độ học tập cao nhất. Cập
                nhật real-time. Tự động reset sau tuần.
              </p>
            </div>

            {sortedUsers.length > 0 ? (
              <div className="space-y-12">
                {/* PODIUM FOR TOP 3 */}
                <div className="flex flex-wrap justify-center items-end gap-4 sm:gap-6 md:gap-8 pt-8 relative">
                  {[1, 0, 2].map((pos) => {
                    const u = sortedUsers[pos];
                    if (!u) return null;
                    const tier = getTier(u.points || 0);
                    const isFirst = pos === 0;
                    const isSecond = pos === 1;
                    const isThird = pos === 2;
                    const trend = rankTrends[u.id] || "same";

                    return (
                      <motion.div
                        key={u.id ? `${u.id}-${pos}` : `user-${pos}`}
                        layoutId={`rank-${u.id}`}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                          delay: pos * 0.1,
                        }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        onClick={() => setSelectedUserProfile(u)}
                        className={cn(
                          "relative flex flex-col items-center p-4 sm:p-6 rounded-2xl cursor-pointer transition-all duration-300",
                          "bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10",
                          isFirst
                            ? "order-1 sm:order-2 w-full sm:w-56 shadow-[0_0_40px_-10px_rgba(234,179,8,0.5)] z-20"
                            : isSecond
                              ? "order-2 sm:order-1 w-full sm:w-44 z-10"
                              : "order-3 sm:order-3 w-full sm:w-44 z-10",
                          u.id === user?.id
                            ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-black"
                            : "",
                        )}
                      >
                        {isFirst && (
                          <Crown className="absolute -top-7 w-12 h-12 text-zinc-900 dark:text-zinc-100 drop-shadow-xl" />
                        )}
                        {trend === "up" && (
                          <ChevronUp className="absolute top-3 right-3 w-6 h-6 text-green-500" />
                        )}
                        {trend === "down" && (
                          <ChevronDown className="absolute top-3 right-3 w-6 h-6 text-red-500" />
                        )}

                        <div className="relative mb-4 shrink-0">
                          <div
                            className={cn(
                              "flex items-center justify-center font-bold shrink-0 rounded-full shadow-xl overflow-hidden relative",
                              isFirst
                                ? "w-24 h-24 border-4 border-orange-500/50 shadow-orange-500/30"
                                : isSecond
                                  ? "w-20 h-20 border-4 border-zinc-400/50 shadow-zinc-400/30"
                                  : "w-20 h-20 border-4 border-orange-600/50 shadow-orange-600/30",
                              getAvatarBorderClass(u.avatarBorder),
                            )}
                          >
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.name}
                                className="w-full h-full object-cover rounded-full"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                <span className="  font-medium uppercase text-xl font-mono">
                                  {u.name.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Small rank badge on top-right of the avatar */}
                          <div
                            className={cn(
                              "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ring-2 ring-white dark:ring-zinc-950 shadow-md",
                              isFirst
                                ? "bg-yellow-400 text-yellow-900 "
                                : isSecond
                                  ? "bg-zinc-200 text-zinc-800 "
                                  : "bg-orange-300 text-orange-900 ",
                            )}
                          >
                            {pos + 1}
                          </div>
                        </div>

                        <h4 className="  font-medium text-center text-lg sm:text-xl mb-1 line-clamp-1 break-all px-2">
                          {u.name}
                        </h4>
                        {u.id === user?.id && (
                          <span className="text-[10px] bg-zinc-900 dark:bg-zinc-100  px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 font-bold">
                            You
                          </span>
                        )}
                        <div className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 mb-2">
                          Lv.
                          {u.level || getLevelInfo(u.points || 0).currentLevel}
                        </div>

                        {u.streak ? (
                          <div className="flex items-center gap-1 text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-900 dark:bg-zinc-100/10 px-3 py-1 rounded-full mb-3 border border-orange-500/20">
                            <Flame className="w-3 h-3" /> {u.streak} Days
                          </div>
                        ) : (
                          <div className="h-7 mb-3"></div>
                        )}

                        <div
                          className={cn(
                            "text-[11px] sm:text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 mb-4 border shadow-sm",
                            tier.color,
                          )}
                        >
                          {tier.icon} {tier.name}
                        </div>

                        <div className="mb-2">
                          <UserRoleBadge
                            role={u.role}
                            isSchoolLover={u.isSchoolLover}
                            isPro={u.isPro}
                          />
                        </div>

                        <div className="  font-medium font-mono text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 drop-shadow-sm">
                          {u.points || 0}{" "}
                          <span className="text-sm opacity-50 font-sans">
                            pts
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* LIST FOR THE REST */}
                {sortedUsers.length > 3 && (
                  <div className="space-y-3 pt-6 max-w-2xl mx-auto">
                    {sortedUsers.slice(3).map((u, index) => {
                      const actualRank = index + 4;
                      const tier = getTier(u.points || 0);
                      const trend = rankTrends[u.id] || "same";

                      return (
                        <motion.div
                          layoutId={`rank-${u.id}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 25,
                            delay: index * 0.05,
                          }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedUserProfile(u)}
                          key={u.id ? `${u.id}-${index}` : `user-${index}`}
                          className={cn(
                            "group flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all cursor-pointer backdrop-blur-md content-visibility-auto gpu-accelerated",
                            u.id === user?.id
                              ? "bg-zinc-900 dark:bg-zinc-100/15 border-orange-500 shadow-lg ring-1 ring-orange-500/50"
                              : "bg-white/40 dark:bg-black/20 border-zinc-200 dark:border-zinc-800 hover:border-orange-500/30 hover:bg-white/60 dark:hover:bg-black/40",
                          )}
                        >
                          <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
                            <div className="  font-medium w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl shrink-0 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-2 border-transparent group-hover:border-orange-500/50 transition-colors">
                              {actualRank}
                            </div>

                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg truncate max-w-[120px] sm:max-w-[200px]">
                                  {u.name}
                                </span>
                                {u.id === user?.id && (
                                  <span className="text-[10px] bg-zinc-900 dark:bg-zinc-100  px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                    You
                                  </span>
                                )}
                                {trend === "up" && (
                                  <ChevronUp className="w-5 h-5 text-green-500" />
                                )}
                                {trend === "down" && (
                                  <ChevronDown className="w-5 h-5 text-red-500" />
                                )}
                                {trend === "same" && (
                                  <Minus className="w-4 h-4 text-zinc-400 opacity-50" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 w-fit",
                                    tier.color,
                                  )}
                                >
                                  {tier.name}
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700">
                                  Lv.
                                  {u.level ||
                                    getLevelInfo(u.points || 0).currentLevel}
                                </span>
                                <UserRoleBadge
                                  role={u.role}
                                  isSchoolLover={u.isSchoolLover}
                                  isPro={u.isPro}
                                />
                                {u.streak && (
                                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-900 dark:bg-zinc-100/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                                    <Flame className="w-3 h-3" /> {u.streak}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="flex flex-col items-end font-mono">
                              <span className="  font-medium text-2xl text-zinc-900 dark:text-zinc-100 group-hover:scale-110 transition-transform origin-right">
                                {u.points || 0}
                              </span>
                            </div>
                            {(user?.role === "teacher" ||
                              user?.role === "admin" ||
                              user?.role === "Admin") &&
                              u.id !== user?.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStudentToDelete(u);
                                  }}
                                  className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Xóa học sinh"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 opacity-50 font-bold border-2 border-dashed border-orange-600/20 dark:border-orange-500/30 rounded-xl mt-8 max-w-2xl mx-auto">
                Chưa có học sinh nào trên bảng xếp hạng tuần này.
              </div>
            )}
          </div>
        </motion.div>
      </div>
      )}
      



      <div
        className={
          activeTab === "profile"
            ? "hardware-tab-active w-full"
            : "hardware-tab-content w-full"
        }
      >
        <motion.div
          key="profile-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-4 sm:p-8 rounded-2xl relative overflow-hidden max-w-4xl mx-auto"
        >
          <ErrorBoundary
            fallback={
              <div className="p-8 bg-red-100/50 rounded-lg text-center dark:bg-red-900/10">
                Trang hồ sơ cá nhân hiện tại không khả dụng.
              </div>
            }
          >

            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3 border-b border-orange-600/20 dark:border-orange-500/30 pb-4 mb-8">
                <h3 className="  font-medium text-3xl text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
                  👤 Hồ Sơ Của Bạn
                </h3>
                <button
                  onClick={() => setShowEnvDebug(!showEnvDebug)}
                  className="opacity-10 hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                  title="Toggle Environment Diagnostics"
                >
                  <Bug className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {user &&
                (() => {
                  const displayXP =
                    Number(user?.points || (user as any)?.xp) || 0;
                  const xpInfo = getLevelInfo(displayXP);
                  const userLevel = Number(user?.level) || xpInfo.currentLevel;
                  const equippedTitle = user?.title || xpInfo.title;
                  const equippedBorder = user?.avatarBorder || "none";

                  const storedStreak = Number(user?.streak) || 0;
                  const storedMastery = Number(user?.averageMastery) || 0;
                  const totalPoints = displayXP;
                  const top1WeeksObj = Number(user?.top1Weeks) || 0;

                  return (
                    <div className="space-y-12">
                      <div className=" flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left card-3d p-8 rounded-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        </div>
                        <div className="relative group">
                          <div
                            className={cn(
                              "w-32 h-32 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 object-cover relative z-10 overflow-hidden",
                            )}
                          >
                            {user.photoURL ? (
                              <img
                                src={user.photoURL}
                                alt="Avatar profile"
                                className="w-full h-full rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="  font-medium text-4xl font-mono opacity-50 uppercase">
                                {user.name.charAt(0)}
                              </span>
                            )}
                            <button
                              onClick={() =>
                                profileFileInputRef.current?.click()
                              }
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold transition-opacity cursor-pointer z-25 rounded-full"
                              title="Thay đổi ảnh đại diện"
                            >
                              <Camera className="w-6 h-6 mb-1 text-orange-400" />
                              <span>Tải ảnh</span>
                            </button>
                          </div>

                          {isUploadingPhoto && (
                            <div className="absolute inset-x-0 bottom-4 flex justify-center z-30">
                              <span className="bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full">
                                Đang nén...
                              </span>
                            </div>
                          )}

                          <div
                            className={cn(
                              "absolute -bottom-2 -right-4 font-bold font-mono px-4 py-1.5 rounded-full text-sm border-2 border-white dark:border-zinc-900 shadow-xl z-25 bg-gradient-to-r",
                              xpInfo.badgeColors,
                            )}
                          >
                            Lv.{userLevel}
                          </div>

                          <input
                            type="file"
                            ref={profileFileInputRef}
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                setIsUploadingPhoto(true);
                                const base64 =
                                  await resizeImageAndGetBase64(file);
                                const { dbService } =
                                  await import("../lib/firebase");
                                await dbService.updateUserProfile(user.id, {
                                  photoURL: base64,
                                });
                                store.updateCurrentUser(
                                  { photoURL: base64 },
                                  true,
                                );
                              } catch (err: any) {
                                console.error("Lỗi upload avatar:", err);
                                toast("Không thể tải ảnh: " + err.message);
                              } finally {
                                setIsUploadingPhoto(false);
                              }
                            }}
                            className="hidden"
                          />
                        </div>

                        <div className="space-y-4 flex-1 w-full relative z-10">
                          <div className="space-y-1">
                            {isEditingProfileName ? (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-sm justify-center md:justify-start">
                                <input
                                  type="text"
                                  value={profileNameInput}
                                  onChange={(e) =>
                                    setProfileNameInput(e.target.value)
                                  }
                                  className="px-3 py-1.5 text-base bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                                  placeholder="..."
                                  maxLength={25}
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={async () => {
                                      if (!profileNameInput.trim()) return;
                                      try {
                                        const { dbService } =
                                          await import("../lib/firebase");
                                        await dbService.updateUserProfile(
                                          user.id,
                                          { name: profileNameInput.trim() },
                                        );
                                        store.updateCurrentUser(
                                          { name: profileNameInput.trim() },
                                          true,
                                        );
                                        setIsEditingProfileName(false);
                                      } catch (err: any) {
                                        toast("Lỗi đổi tên: " + err.message);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                  >
                                    Lưu
                                  </button>
                                  <button
                                    onClick={() => {
                                      setProfileNameInput(user.name);
                                      setIsEditingProfileName(false);
                                    }}
                                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 justify-center md:justify-start">
                                <h4 className="  font-medium text-3xl font-display">
                                  {user.name}
                                </h4>
                                <button
                                  onClick={() => {
                                    setProfileNameInput(user.name);
                                    setIsEditingProfileName(true);
                                  }}
                                  className="p-1 px-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
                                  title="Đổi tên hiển thị"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> Sửa tên
                                </button>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start mt-1">
                              <UserRoleBadge
                                role={user.role}
                                isSchoolLover={user.isSchoolLover}
                                isPro={user.isPro}
                              />
                            </div>
                          </div>

                          <div className="pt-2">
                            <div className="flex justify-between text-xs font-mono mb-1.5 opacity-80">
                              <span>
                                {Math.floor(
                                  Number(xpInfo.xpIntoCurrentLevel) || 0,
                                )}{" "}
                                XP
                              </span>
                              <span>
                                {Math.floor(
                                  Number(xpInfo.xpNeededForNextLevel) || 100,
                                )}{" "}
                                XP đến Lv.{userLevel + 1}
                              </span>
                            </div>
                            <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${isNaN(xpInfo.progressPercentage) || !isFinite(xpInfo.progressPercentage) ? 0 : Math.min(Math.max(0, xpInfo.progressPercentage), 100)}%`,
                                }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full relative"
                              >
                                <div
                                  className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"
                                  style={{
                                    backgroundImage:
                                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                                    backgroundSize: "200% 100%",
                                  }}
                                />
                              </motion.div>
                            </div>
                            <p className="font-light tracking-wide text-[10px] mt-2 opacity-50 text-right">
                              Tổng XP: {displayXP}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-4 items-center justify-center md:justify-start">
                            <div className="flex flex-col">
                              <span className="text-xs uppercase tracking-wider opacity-60">
                                Cấp độ hiện tại
                              </span>
                              <span className="  font-medium font-mono text-xl">
                                {userLevel}
                              </span>
                            </div>
                            <div className="w-px h-8 bg-black/10 dark:bg-white/10" />
                            <div className="flex flex-col">
                              <span className="text-xs uppercase tracking-wider opacity-60">
                                Chuỗi ngày
                              </span>
                              <span className="  font-medium font-mono text-xl flex items-center center gap-1">
                                <Flame className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />{" "}
                                {user.streak || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 mt-8">



                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-3 mt-2">
                            <button
                              key="default-tag"
                              onClick={async () => {
                                try {
                                  const { dbService } =
                                    await import("../lib/firebase");
                                  await dbService.updateUserProfile(user.id, {
                                    isSchoolLover: false,
                                  });
                                  store.updateCurrentUser({
                                    isSchoolLover: false,
                                  });
                                  // Simple reactive update trigger
                                  setDbUsers((prev) =>
                                    prev.map((u) =>
                                      u.id === user.id
                                        ? { ...u, isSchoolLover: false }
                                        : u,
                                    ),
                                  );
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className={cn(
                                "px-5 py-3 rounded-xl border font-bold transition-all duration-300 flex items-center gap-2",
                                !user.isSchoolLover
                                  ? "bg-zinc-500 text-white border-zinc-600 shadow-md transform scale-105"
                                  : "bg-white/50 border-zinc-200 text-zinc-600 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-300 hover:border-zinc-500/50",
                              )}
                            >
                              <Activity className="w-4 h-4" /> Mặc định (Học
                              viên)
                            </button>
                            {user.isPro ? (
                              <button
                                key="school-lover-tag"
                                onClick={async () => {
                                  try {
                                    const { dbService } =
                                      await import("../lib/firebase");
                                    await dbService.updateUserProfile(user.id, {
                                      isSchoolLover: true,
                                    });
                                    store.updateCurrentUser({
                                      isSchoolLover: true,
                                    });
                                    // Simple reactive update trigger
                                    setDbUsers((prev) =>
                                      prev.map((u) =>
                                        u.id === user.id
                                          ? { ...u, isSchoolLover: true }
                                          : u,
                                      ),
                                    );
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className={cn(
                                  "px-5 py-3 rounded-xl border font-bold transition-all duration-300 flex items-center gap-2",
                                  user.isSchoolLover
                                    ? "bg-pink-500 text-white border-pink-600 shadow-md transform scale-105"
                                    : "bg-white/50 border-zinc-200 text-zinc-600 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-300 hover:border-pink-500/50",
                                )}
                              >
                                <Heart className="w-4 h-4 fill-pink-100/30 text-white" />
                                💘 Em yêu trường em (VIP)
                              </button>
                            ) : (
                              <button
                                key="school-lover-tag-disabled"
                                disabled
                                title="Bạn cần nâng cấp tài khoản Thành Viên VIP để sử dụng thẻ này"
                                className="px-5 py-3 rounded-xl border font-bold transition-all duration-300 flex items-center gap-2 bg-zinc-100/50 border-zinc-200 text-zinc-400 dark:bg-zinc-800/30 dark:border-zinc-800 dark:text-zinc-600 cursor-not-allowed opacity-70"
                              >
                                <Heart className="w-4 h-4" />
                                💘 Em yêu trường em (Cần VIP)
                              </button>
                            )}
                          </div>
                          <p className="font-light tracking-wide text-sm opacity-60 mt-4  bg-black/5 dark:bg-white/5 p-4 rounded-lg">
                            Mẹo: Điểm XP (Kinh nghiệm) càng cao sẽ giúp cấp độ
                            Level càng tăng. Hãy tiếp tục ôn tập Flashcard để
                            đạt những danh hiệu Huyền thoại nhé.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 mt-8 pt-8 border-t border-black/10 dark:border-white/10">
                        <h4 className="  font-medium text-xl pb-2">
                          Cài đặt ứng dụng
                        </h4>
                        <div className=" card-3d p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                          <div>
                            <h5 className="font-bold mb-1 flex items-center gap-2">
                              <RefreshCw className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />{" "}
                              Tự động cập nhật phiên bản
                            </h5>
                            <p className="font-light tracking-wide text-sm opacity-70">
                              Cài đặt chu kỳ hệ thống tự động bắt bản cập nhật
                              mới nhất. Khuyến nghị bật để trải nghiệm mới mẻ và
                              ổn định.
                            </p>
                          </div>
                          <select
                            className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 font-medium min-w-[220px]"
                            defaultValue={
                              localStorage.getItem("autoUpdateInterval") || "10"
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              localStorage.setItem("autoUpdateInterval", val);
                            }}
                          >
                            <option value="disabled">
                              Tắt cập nhật tự động
                            </option>
                            <option value="5">Mỗi 5 phút</option>
                            <option value="10">Mỗi 10 phút (Mặc định)</option>
                            <option value="30">Mỗi 30 phút</option>
                            <option value="60">Mỗi 1 giờ</option>
                          </select>
                        </div>

                        {showEnvDebug && (
                          <div className="mt-8 p-6 text-xs font-mono bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl overflow-x-auto shadow-inner">
                            <h4 className="font-bold mb-4 uppercase tracking-widest opacity-60 flex items-center gap-2">
                              <Bug className="w-4 h-4" /> Environment
                              Diagnostics
                            </h4>
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="opacity-60 border-b border-black/10 dark:border-white/10">
                                  <th className="pb-3 px-2">Variable</th>
                                  <th className="pb-3 px-2 text-center">
                                    Exists
                                  </th>
                                  <th className="pb-3 px-2">Value Preview</th>
                                </tr>
                              </thead>
                              <tbody className="opacity-80">
                                {Object.entries(getEnvDiagnostics()).map(
                                  ([key, data]) => (
                                    <tr
                                      key={`env-${key}`}
                                      className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    >
                                      <td className="py-3 px-2 font-semibold text-orange-700 dark:text-orange-400">
                                        {key}
                                      </td>
                                      <td className="py-3 px-2 text-center">
                                        {data.exists ? (
                                          <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                                            Yes
                                          </span>
                                        ) : (
                                          <span className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                                            No
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3 px-2 font-mono text-[10px]">
                                        {data.exists && data.preview ? (
                                          <span className="bg-zinc-300/40 dark:bg-zinc-800/40 px-2.5 py-1 rounded border border-zinc-400/20 max-w-xs truncate inline-block">
                                            {data.preview}
                                          </span>
                                        ) : (
                                          <span className="opacity-40">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          </ErrorBoundary>
        </motion.div>
      </div>

      {activeTab === "united-engine" && (
        <div className="w-full">
          <motion.div
            key="united-engine-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="glass p-4 sm:p-8 rounded-2xl relative overflow-hidden max-w-3xl mx-auto"
          >
            <div className="relative z-10 space-y-6">
              <h3 className="font-medium text-3xl text-zinc-800 dark:text-zinc-100 mb-8 flex items-center gap-3 border-b border-orange-600/20 dark:border-orange-500/30 pb-4">
                🔄 United Engine (Data Compiler)
              </h3>
              <div className="flex flex-col gap-10">
                <UnitedEngineFormattingTab />
                <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800/80 my-2" />
                <VibeManualFlashcardPipeline />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="w-full">
        <motion.div
          key="settings-tab"
          id="eco-font-controls-box"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-4 sm:p-8 rounded-2xl relative overflow-hidden max-w-3xl mx-auto"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
          </div>

          <div className="relative z-10">
            <h3 className="  font-medium text-3xl text-zinc-800 dark:text-zinc-100 mb-8 flex items-center gap-3 border-b border-orange-600/20 dark:border-orange-500/30 pb-4">
              ⚙️ Cài Đặt Hệ Thống
            </h3>

            <div className="space-y-6">
              {/* Tùy Chọn Tắt m Toàn Cục */}
              <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="space-y-2 max-w-lg">
                  <h4 className="  font-medium text-xl flex items-center gap-2">
                    {muteAll ? (
                      <VolumeX className="w-5 h-5 text-red-500" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                    )}
                    Tắt Mọi Âm Thanh (Mute All)
                  </h4>
                  <p className="font-light tracking-wide opacity-70 text-sm">
                    Tự động vô hiệu hóa toàn bộ hiệu ứng âm thanh (lật thẻ, âm
                    chính xác, sai) trong các phòng học. Cài đặt này được sao
                    lưu trên bộ nhớ cục bộ thiết bị của bạn.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const nextState = !muteAll;
                    setMuteAll(nextState);
                    setMutedStatus(nextState);
                  }}
                  className={cn(
                    "shrink-0 px-6 py-3 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-lg cursor-pointer",
                    muteAll
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:bg-zinc-200 ",
                  )}
                >
                  {muteAll ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                  {muteAll ? "Đang Tắt Tiếng" : "Bật Âm Thanh"}
                </button>
              </div>

              {/* Tùy chỉnh Cỡ Chữ Hệ Thống */}
              <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="space-y-4 w-full md:max-w-lg">
                  <h4 className="  font-medium text-xl flex items-center gap-2">
                    <Type className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                    Cỡ Chữ Hệ Thống (App Font Size)
                  </h4>
                  <p className="font-light tracking-wide opacity-70 text-sm">
                    Điều chỉnh phóng to/thu nhỏ kích thước chữ của toàn bộ ứng
                    dụng. Các widget và bảng hiển thị sẽ tự động co giãn và căn
                    lề tương ứng mà không bị méo mó hay tràn giao diện.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-semibold text-sm">
                      Tỷ lệ hiện tại:
                    </span>
                    <span className="font-mono font-black text-base text-zinc-800 dark:text-zinc-200 dark:text-orange-400 px-3 py-1 bg-zinc-200/60 dark:bg-zinc-800/70 rounded-lg">
                      {Math.round((localFontSize / 16) * 100)}% ({localFontSize}
                      px)
                    </span>
                  </div>
                </div>

                <div className="w-full md:w-64 flex flex-col gap-2">
                  <input
                    type="range"
                    min="12"
                    max="32"
                    value={localFontSize}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setLocalFontSize(val);
                      localStorage.setItem("henosis-font-size", val.toString());
                      window.dispatchEvent(
                        new CustomEvent("henosis-font-size-changed", {
                          detail: { size: val },
                        }),
                      );
                    }}
                    className="w-full h-2 bg-zinc-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    style={{ accentColor: "#d97706" }}
                  />
                  <div className="flex justify-between text-[11px] text-zinc-500 font-bold font-mono">
                    <span>Nhỏ (12px)</span>
                    <span>Mặc định (16px)</span>
                    <span>Lớn (32px)</span>
                  </div>
                  <button
                    onClick={() => {
                      const defaultVal = 16;
                      setLocalFontSize(defaultVal);
                      localStorage.setItem(
                        "henosis-font-size",
                        defaultVal.toString(),
                      );
                      window.dispatchEvent(
                        new CustomEvent("henosis-font-size-changed", {
                          detail: { size: defaultVal },
                        }),
                      );
                    }}
                    className="mt-2 w-full py-2 px-4 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-lg transition-transform hover:scale-102 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    Đặt lại mặc định (16px)
                  </button>
                </div>
              </div>

              {/* Tùy chỉnh Mật Độ Giao Diện (UI Density) */}
              <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="space-y-2 max-w-lg">
                  <h4 className="  font-medium text-xl flex items-center gap-2">
                    {localUiDensity === "compact" ? (
                      <Minimize2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                    ) : (
                      <Maximize2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
                    )}
                    Mật độ Giao Diện (UI Density)
                  </h4>
                  <p className="font-light tracking-wide opacity-70 text-sm">
                    Thay đổi tỷ lệ khoảng cách (margin, padding, gap) của toàn
                    bộ hệ thống. Chọn "Nhỏ gọn" nếu ngài muốn xem nhiều thông
                    tin hơn trên cùng một màn hình mà không cần tốn nhiều thao
                    tác cuộn.
                  </p>
                </div>
                <div className="flex gap-2 p-1 bg-zinc-200/50 dark:bg-zinc-900 rounded-xl shadow-inner border border-zinc-200/40 dark:border-zinc-800/50">
                  <button
                    onClick={() => {
                      localStorage.setItem("henosis-ui-density", "comfortable");
                      setLocalUiDensity("comfortable");
                      window.dispatchEvent(
                        new CustomEvent("henosis-ui-density-changed", {
                          detail: { density: "comfortable" },
                        }),
                      );
                    }}
                    className={cn(
                      "py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-lg whitespace-nowrap transition-all border-none focus:outline-none cursor-pointer",
                      localUiDensity === "comfortable"
                        ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 dark:text-orange-400 shadow-md"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-250 bg-transparent",
                    )}
                  >
                    Dễ Nhìn (Comfortable)
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem("henosis-ui-density", "compact");
                      setLocalUiDensity("compact");
                      window.dispatchEvent(
                        new CustomEvent("henosis-ui-density-changed", {
                          detail: { density: "compact" },
                        }),
                      );
                    }}
                    className={cn(
                      "py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-lg whitespace-nowrap transition-all border-none focus:outline-none cursor-pointer",
                      localUiDensity === "compact"
                        ? "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 dark:text-orange-400 shadow-md"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-250 bg-transparent",
                    )}
                  >
                    Nhỏ Gọn (Compact)
                  </button>
                </div>
              </div>

              {/* Tùy chọn Tiết kiệm pin / Fix Lag */}
              <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="space-y-2 max-w-lg">
                  <h4 className="  font-medium text-xl flex items-center gap-2">
                    <Snowflake
                      className={cn(
                        "w-5 h-5",
                        isFixLagEnabled
                          ? "text-green-500 animate-[spin_4s_linear_infinite]"
                          : "text-zinc-400",
                      )}
                    />
                    Tiết Kiệm Pin / Fix Lag (Battery Saver)
                  </h4>
                  <p className="font-light tracking-wide opacity-70 text-sm">
                    Giảm tần số quét của hiệu ứng nền và tắt các hoạt ảnh không
                    thiết yếu. Khuyên dùng để tiết kiệm pin hoặc cho thiết bị
                    cấu hình yếu để tăng tốc tối đa.
                  </p>
                </div>
                <button
                  onClick={toggleFixLag}
                  className={cn(
                    "shrink-0 px-6 py-3 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-lg cursor-pointer",
                    isFixLagEnabled
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-zinc-300 dark:bg-zinc-800 hover:bg-zinc-400 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200",
                  )}
                >
                  <Snowflake className="w-5 h-5" />
                  {isFixLagEnabled
                    ? "Đang Bật Tiết Kiệm Pin"
                    : "Bật Tiết Kiệm Pin"}
                </button>
              </div>

              <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="space-y-2 max-w-lg">
                  <h4 className="  font-medium text-xl flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-red-500" /> Xóa Dữ Liệu Cũ
                  </h4>
                  <p className="font-light tracking-wide opacity-70 text-sm">
                    Xóa bỏ các dữ liệu nháp của thẻ học (Agent 3) và danh sách
                    thẻ yếu (weak_cards) khỏi máy. Điều này giúp tối ưu hóa tiến
                    trình.
                  </p>
                </div>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="shrink-0 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-transform hover:scale-105 flex items-center gap-2 shadow-lg"
                >
                  Xóa Dữ Liệu Ngay
                </button>
              </div>

              {/* OFFLINE STORAGE WIDGET */}
              <OfflineStorageProgressWidget />

              <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="space-y-2 max-w-lg">
                  <h4 className="  font-medium text-xl flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-zinc-900 dark:text-zinc-100" /> Dọn Dẹp Bộ
                    Nhớ Cache
                  </h4>
                  <p className="font-light tracking-wide opacity-70 text-sm">
                    Xóa tất cả các dữ liệu tạm thời như bộ nhớ đệm, lịch sử hoạt
                    động, và dữ liệu chuyển đổi tài liệu để giải phóng dung
                    lượng bộ nhớ. Hệ thống sẽ giữ lại cấu hình giao diện, độ
                    mượt và tài khoản hiện tại của ngài.
                  </p>
                </div>
                <button
                  onClick={() => setShowCacheClearConfirm(true)}
                  className="shrink-0 px-6 py-3 bg-zinc-800 dark:bg-zinc-200 hover:bg-orange-700 text-white font-bold rounded-lg transition-transform hover:scale-105 flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  Dọn Dẹp Ngay
                </button>
              </div>

              {auth.currentUser?.isAnonymous ? (
                <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border border-orange-500/20">
                  <div className="space-y-2 max-w-lg">
                    <h4 className="  font-medium text-xl flex items-center gap-2 text-zinc-800 dark:text-zinc-200 dark:text-orange-400">
                      <User className="w-5 h-5" /> Đăng Ký / Đăng Nhập
                    </h4>
                    <p className="font-light tracking-wide opacity-70 text-sm">
                      Ngài đang sử dụng tài khoản tạm thời (Anonymous). Hãy nâng
                      cấp hoặc đăng nhập tài khoản chính thức để sao lưu dữ liệu
                      Stoicism vĩnh viễn và đồng bộ đa thiết bị!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigate("/auth");
                    }}
                    className="shrink-0 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 text-white font-bold rounded-lg transition-transform hover:scale-105 flex items-center gap-2 shadow-lg cursor-pointer border-none"
                  >
                    <User className="w-4 h-4" /> Đăng Ký / Đăng Nhập
                  </button>
                </div>
              ) : (
                <div className=" card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                  <div className="space-y-2 max-w-lg">
                    <h4 className="  font-medium text-xl flex items-center gap-2">
                      <LogOut className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />{" "}
                      Đăng Xuất
                    </h4>
                    <p className="font-light tracking-wide opacity-70 text-sm">
                      Đăng xuất khỏi thiết bị này. Dữ liệu của bạn được đồng bộ
                      an toàn trên hệ thống.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { signOut } = await import("firebase/auth");

                        if (auth.currentUser?.uid) {
                          try {
                            const { doc, deleteDoc } =
                              await import("firebase/firestore");
                            await deleteDoc(
                              doc(db, "costudy_room", auth.currentUser.uid),
                            );
                          } catch (roomErr) {
                            console.error("Cleanup room error:", roomErr);
                          }
                        }

                        if (auth.currentUser?.isAnonymous) {
                          try {
                            const { dbService } =
                              await import("../lib/firebase");
                            await dbService.deleteUserProfile(
                              auth.currentUser.uid,
                            );
                            await auth.currentUser.delete();
                          } catch (delError) {
                            console.error(
                              "Soft failing cleanup of anonymous auth:",
                              delError,
                            );
                          }
                        } else {
                          await signOut(auth);
                        }
                        store.logout();
                        FirebaseListenerManager.clearAll();
                        navigate("/");
                        sessionStorage.removeItem("isAdminMode");
                      } catch (error) {
                        console.error("Lỗi đăng xuất:", error);
                      }
                    }}
                    className="shrink-0 px-6 py-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 font-bold rounded-lg transition-transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-black/5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 hidden sm:block" /> Đăng Xuất
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dialog Confirmation */}
          <AnimatePresence>
            {showClearConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="modal-glass-overlay flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-zinc-100 dark:bg-zinc-900 border border-red-500/30 shadow-2xl rounded-2xl p-6 md:p-8 max-w-md w-full"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="  font-medium text-2xl">
                      Bạn có chắc chắn?
                    </h3>
                    <p className="font-light tracking-wide opacity-80 pb-4">
                      Hành động này sẽ xóa vĩnh viễn các dữ liệu nháp và danh
                      sách thẻ yếu hiện tại (weak_cards) khỏi hệ thống. Bạn
                      không thể hoàn tác thao tác này. Bạn có muốn tiếp tục
                      không?
                    </p>
                    <div className="flex w-full gap-4">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-3 rounded-lg border border-orange-600/20 dark:border-orange-500/30 font-bold transition hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleClearOldData}
                        className="flex-1 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-transform hover:scale-105 shadow-md"
                      >
                        Xác Nhận Xóa
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {showCacheClearConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="modal-glass-overlay flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-zinc-100 dark:bg-zinc-900 border border-orange-500/30 shadow-2xl rounded-2xl p-6 md:p-8 max-w-md w-full"
                >
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-900 dark:bg-zinc-100/10 flex items-center justify-center text-zinc-900 dark:text-zinc-100 mb-2">
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    </div>
                    <h3 className="  font-medium text-2xl">
                      Xác nhận dọn dẹp cache?
                    </h3>
                    <p className="font-light tracking-wide opacity-80 pb-4">
                      Thao tác này sẽ dọn sạch tất cả lịch sử hoạt động cục bộ,
                      danh sách tìm kiếm gần đây và các file đệm tạm thời để
                      giải phóng không gian bộ nhớ. Các tùy chọn hệ thống (giao
                      diện, phông chữ, fix lag) và tài khoản đang đăng nhập sẽ
                      được giữ lại an toàn.
                    </p>
                    <div className="flex w-full gap-4">
                      <button
                        onClick={() => setShowCacheClearConfirm(false)}
                        className="flex-1 py-3 rounded-lg border border-orange-600/20 dark:border-orange-500/30 font-bold transition hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleClearCache}
                        className="flex-1 py-3 rounded-lg bg-zinc-800 dark:bg-zinc-200 hover:bg-orange-700 text-white font-bold transition-transform hover:scale-105 shadow-md cursor-pointer"
                      >
                        Xác Nhận Dọn Dẹp
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      )}
      
      <AnimatePresence>
        {isChartExpanded && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="modal-glass-overlay flex items-center justify-center p-4 md:p-8 z-[100]"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-zinc-100/80 dark:bg-zinc-950/40 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-orange-600/20 dark:border-orange-500/30 rounded-2xl w-full h-[95vh] sm:h-full max-w-6xl md:max-h-[800px] flex flex-col p-4 md:p-8 relative backdrop-blur-xl overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 border-b border-orange-600/20 dark:border-orange-500/30 pb-4 flex-wrap gap-4">
                <h3 className="  font-medium text-2xl md:text-3xl text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                  <Activity className="w-8 h-8 text-zinc-900 dark:text-zinc-100" /> Biểu Đồ Phong
                  Độ Tuần
                </h3>
                <div className="flex items-center gap-4">
                  <select
                    value={chartPeriod}
                    onChange={(e) => setChartPeriod(e.target.value as any)}
                    className="bg-zinc-200/60 dark:bg-zinc-800/50 border border-orange-600/20 dark:border-orange-500/30 rounded-lg px-4 py-2 text-sm md:text-base font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                  >
                    <option value="7_days">Last 7 Days</option>
                    <option value="30_days">Last 30 Days</option>
                    <option value="all_time">All Time</option>
                  </select>
                  <button
                    onClick={() => setIsChartExpanded(false)}
                    className="p-3 bg-zinc-200/60 dark:bg-zinc-800/50 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    <Minimize2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(128,128,128,0.2)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      stroke="currentColor"
                      fontSize={14}
                      tickLine={false}
                      axisLine={false}
                      opacity={0.7}
                      dy={10}
                    />
                    <YAxis
                      stroke="currentColor"
                      fontSize={14}
                      tickLine={false}
                      axisLine={false}
                      opacity={0.7}
                      width={50}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ stroke: "rgba(234,179,8,0.3)", strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="points"
                      stroke="#eab308"
                      strokeWidth={4}
                      dot={{ fill: "#eab308", strokeWidth: 2, r: 6 }}
                      activeDot={{ r: 8, stroke: "white", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </motion.div>
        )}

        {studentToDelete && (
          <div className="modal-glass-overlay flex items-center justify-center p-4">
            <div className="modal-glass-content p-6 max-w-md w-full">
              <h4 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" /> Xác nhận xóa học sinh "
                {studentToDelete.name}"?
              </h4>
              <p className="font-light tracking-wide text-sm opacity-85 mb-4">
                Bạn có quyền xóa hoặc khóa tài khoản học sinh này từ hệ thống
                Henosis.
              </p>

              <div className="mb-6 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider opacity-60">
                  Phương thức xử lý:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteMode("hard")}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                      deleteMode === "hard"
                        ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850",
                    )}
                  >
                    <span>Xóa cứng (Hard)</span>
                    <span className="text-[10px] opacity-60 font-normal">
                      Xóa sạch profile, nhóm và thẻ học
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteMode("soft")}
                    className={cn(
                      "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                      deleteMode === "soft"
                        ? "bg-zinc-900 dark:bg-zinc-100/10 border-orange-500 text-zinc-800 dark:text-zinc-200 dark:text-orange-400"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850",
                    )}
                  >
                    <span>Xóa mềm (Soft)</span>
                    <span className="text-[10px] opacity-60 font-normal">
                      Ẩn tài khoản hoạt động nhưng giữ lịch sử
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStudentToDelete(null)}
                  disabled={isDeletingStudent}
                  className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-850 hover:bg-zinc-300 dark:hover:bg-zinc-800 transition text-sm font-bold  dark:text-white"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleDeleteStudentSubmit}
                  disabled={isDeletingStudent}
                  className={cn(
                    "px-4 py-2 rounded-lg text-white transition text-sm font-bold flex items-center gap-1.5",
                    deleteMode === "hard"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-zinc-800 dark:bg-zinc-200 hover:bg-orange-700",
                  )}
                >
                  {isDeletingStudent ? "Đang xử lý..." : "Xác nhận thực hiện"}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic AI MCQ Quiz Setup Modal */}
      <AnimatePresence>
        {activeQuizSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/70 backdrop-blur-md"
            onClick={() => setActiveQuizSetup(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Sparkles className="w-5 h-5 " />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                      Sinh Đề Thi AI
                    </h3>
                    <p className="font-light tracking-wide text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {activeQuizSetup.subject}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveQuizSetup(null)}
                  className="p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 dark:text-orange-400 uppercase tracking-wider block mb-2">
                    Số lượng câu hỏi trắc nghiệm
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20, 25, 30, 35, 40].map((count) => (
                      <button
                        key={count}
                        onClick={() => setQuizQuestionCount(count)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold transition-all border outline-none cursor-pointer",
                          quizQuestionCount === count
                            ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white font-black shadow-md scale-105"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white",
                        )}
                      >
                        {count} câu
                      </button>
                    ))}
                  </div>
                  <p className="font-light tracking-wide text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 ">
                    * Mặc định là 15 câu. Số lượng câu hỏi càng nhiều, Gemini sẽ
                    hỗ trợ phân tích sâu hơn nhưng sẽ lâu hơn xíu m nha.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-2.5">
                <button
                  onClick={() => setActiveQuizSetup(null)}
                  className="flex-1 py-3 rounded-2xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-black uppercase tracking-wider border border-zinc-200 dark:border-zinc-800 cursor-pointer transition"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    const setup = activeQuizSetup;
                    setActiveQuizSetup(null);
                    triggerQuiz(setup.subject, setup.decks, quizQuestionCount);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-100  hover:scale-105 active:scale-95 text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-500/10 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4  shrink-0" />
                  Bắt đầu thi AI
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAchillesSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/70 backdrop-blur-md"
            onClick={() => setShowAchillesSetup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl w-full max-w-2xl border border-rose-500/30 dark:border-rose-500/40 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500/20 text-rose-600 rounded-xl">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                      Thử Thách Achilles
                    </h3>
                    <p className="font-light tracking-wide text-xs font-semibold text-rose-500 dark:text-rose-400">
                      Chọn 3 bộ thẻ để sinh 40 câu hỏi AI
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAchillesSetup(false)}
                  className="p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-4 custom-scrollbar pr-2">
                {decks.map((deck, idx) => {
                  const isSelected = achillesSelectedDecks.includes(deck.id);
                  const isMaxed = achillesSelectedDecks.length >= 3;
                  return (
                    <div
                      key={deck.id ? `${deck.id}-${idx}` : `deck-${idx}`}
                      onClick={() => {
                        if (isSelected) {
                          setAchillesSelectedDecks((prev) =>
                            prev.filter((id) => id !== deck.id),
                          );
                        } else if (!isMaxed) {
                          setAchillesSelectedDecks((prev) => [
                            ...prev,
                            deck.id,
                          ]);
                        }
                      }}
                      className={cn(
                        "cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between",
                        isSelected
                          ? "bg-rose-500/10 border-rose-500/50"
                          : "bg-zinc-100 dark:bg-zinc-900 border-transparent hover:border-rose-500/30",
                        !isSelected && isMaxed
                          ? "opacity-50 cursor-not-allowed"
                          : "",
                      )}
                    >
                      <div>
                        <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                          {deck.title}
                        </h4>
                        <p className="text-[10px] text-zinc-500">
                          {deck.cards?.length || 0} thẻ • Nhóm:{" "}
                          {deck.subject || "Khác"}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center border",
                          isSelected
                            ? "bg-rose-500 border-rose-500 text-white"
                            : "border-zinc-300 dark:border-zinc-700",
                        )}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-2.5">
                <button
                  onClick={() => setShowAchillesSetup(false)}
                  className="flex-1 py-3 rounded-2xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-black uppercase tracking-wider border border-zinc-200 dark:border-zinc-800 cursor-pointer transition"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    if (achillesSelectedDecks.length !== 3) {
                      toast(
                        "Bạn phải chọn đúng 3 bộ thẻ để bắt đầu thử thách Achilles!",
                      );
                      return;
                    }
                    if (user && user.points < 100) {
                      toast("Không đủ 100 điểm để mở thử thách.");
                      return;
                    }

                    const targetDecks = decks.filter((d) =>
                      achillesSelectedDecks.includes(d.id),
                    );
                    store.deductPoints(100); // Deduct 100 points as entry fee
                    setShowAchillesSetup(false);
                    triggerQuiz("Thử Thách Achilles", targetDecks, 40, true);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-rose-500 dark:bg-rose-600 text-white shadow-rose-500/20 hover:scale-[1.02] active:scale-[0.98] text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  Hiến tế 100 Tinh Hoa & Thi Đấu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <Suspense fallback={null}>
        <DetailedStatsModal
          isOpen={isDetailedStatsModalOpen}
          onClose={() => setIsDetailedStatsModalOpen(false)}
          userId={user?.id || ""}
        />
      </Suspense>


      {/* Quick-View Droplist / Modal Kính Mờ for Thẻ Nhắc Nhở */}
      <AnimatePresence>
        {showRemindLaterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/70 backdrop-blur-md"
            onClick={() => setShowRemindLaterModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-200/50 dark:border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Bell className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="  font-medium text-xl text-zinc-900 dark:text-zinc-100">
                      Danh Sách Nhắc Nhở
                    </h3>
                    <p className="font-light tracking-wide text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {remindLaterCards.length} từ vựng cần ưu tiên ôn tập nhanh
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {remindLaterCards.length > 0 && (
                    <button
                      onClick={() => startRemindLaterStudy()}
                      className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white font-bold text-sm shadow-md hover:shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Cày Tất Cả
                    </button>
                  )}
                  <button
                    onClick={() => setShowRemindLaterModal(false)}
                    className="p-2 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-4 md:p-6 overflow-y-auto space-y-3 custom-scrollbar">
                {remindLaterCards.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-2 opacity-80" />
                    <p className="font-medium text-lg">
                      Tuyệt vời! Bạn không có thẻ nhớ gấp nào.
                    </p>
                    <p className="font-light tracking-wide text-sm opacity-80">
                      Hãy tiếp tục duy trì tiến độ học tập nhé.
                    </p>
                  </div>
                ) : (
                  remindLaterCards.map((card, idx) => {
                    const backVal = card.back || (card as any).meaning || "";
                    const cleanText = backVal
                      ? backVal.replace(/[*_#`\\[\]]/g, "").substring(0, 150)
                      : "";
                    const firstPart = cleanText.split(/[-;]/)[0] || cleanText;

                    return (
                      <div
                        key={`${card.id}-${idx}`}
                        className="group flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-100/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:bg-white dark:hover:bg-zinc-900 transition-all shadow-sm hover:shadow"
                      >
                        <div className="flex-1 w-full relative">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5 line-clamp-1 truncate">
                            <span className="text-lg font-bold text-zinc-900 dark:text-white truncate">
                              {card.front || (card as any).word}
                            </span>
                            {(card.wordForm || (card as any).wordType) && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 shrink-0">
                                {card.wordForm || (card as any).wordType}
                              </span>
                            )}
                            {((card as any).phonetic ||
                              (card as any).pronunciation) && (
                              <span className="text-sm opacity-60  translate-y-px">
                                /
                                {(card as any).phonetic ||
                                  (card as any).pronunciation}
                                /
                              </span>
                            )}
                          </div>
                          <p className="font-light tracking-wide text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">
                            {firstPart || "Chưa có nghĩa chi tiết"}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0 w-full sm:w-auto items-center">
                          <button
                            onClick={() => startRemindLaterStudy(card.id)}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all font-bold text-sm flex items-center justify-center gap-1.5 group-hover:shadow-md border-none cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Học Ngay
                          </button>
                          <button
                            onClick={() => {
                              if (user) {
                                import("../vibe-sandbox/sync/VibeSyncEngine").then(
                                  ({ VibeSyncEngine }) => {
                                    VibeSyncEngine.enqueueChange({
                                        type: "UPSERT_CARD_STATE",
                                        payload: {
                                            uid: user.id,
                                            cardId: card.id,
                                            isWeakCard: false,
                                        }
                                    }).catch(err => console.warn("Queue ignored:", err));
                                  },
                                );
                                // Optmistically update store if possible, though listener will catch it soon
                                const localStoreDecks = store.getDecks();
                                const targetDeck = localStoreDecks.find(
                                  (d) => d.id === card.originDeckId,
                                );
                                if (targetDeck) {
                                  const targetCard = targetDeck.cards.find(
                                    (c) => c.id === card.id,
                                  );
                                  if (targetCard) targetCard.isHard = false;
                                }
                              } else {
                                // Guest mode fallback
                                const updatedIds = remindLaterCardIds.filter(
                                  (id) => id !== card.id,
                                );
                                setRemindLaterCardIds(updatedIds);
                                localStorage.setItem(
                                  "remind_later_items",
                                  JSON.stringify(updatedIds),
                                );
                              }
                            }}
                            className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border-none cursor-pointer"
                            title="Xóa khỏi danh sách nhắc nhở"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gamified User Profile Modal */}
      <AnimatePresence>
        {selectedUserProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/70 backdrop-blur-md"
            onClick={() => setSelectedUserProfile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 right-0 h-32 bg-orange-50 dark:bg-orange-900/10"></div>

              <button
                onClick={() => setSelectedUserProfile(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition z-10"
              >
                <XCircle className="w-6 h-6 text-zinc-700 dark:text-zinc-300" />
              </button>

              <div className="relative pt-12 pb-8 px-8 flex flex-col items-center">
                <div
                  className={cn(
                    "w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 border-4 border-white dark:border-zinc-950 shadow-xl flex items-center justify-center overflow-hidden mb-4 relative",
                    getAvatarBorderClass(selectedUserProfile.avatarBorder),
                  )}
                >
                  {selectedUserProfile.photoURL ? (
                    <img
                      src={selectedUserProfile.photoURL}
                      alt={selectedUserProfile.name}
                      className="w-full h-full object-cover rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="  font-medium text-4xl font-mono opacity-50 uppercase">
                      {selectedUserProfile.name
                        ? selectedUserProfile.name.charAt(0)
                        : "👤"}
                    </span>
                  )}
                  {selectedUserProfile.streak && (
                    <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm flex items-center gap-1">
                      <Flame className="w-3 h-3" /> {selectedUserProfile.streak}
                    </div>
                  )}
                </div>

                <h3 className="  font-medium text-2xl text-zinc-900 dark:text-white mb-1">
                  {selectedUserProfile.name}
                </h3>

                <div className="flex flex-wrap items-center justify-center gap-2 mb-2 mt-4">
                  {(() => {
                    const tier = getTier(selectedUserProfile.points || 0);
                    return (
                      <span
                        className={cn(
                          "text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5",
                          tier.color,
                        )}
                      >
                        {tier.icon} {tier.name}
                      </span>
                    );
                  })()}
                  <UserRoleBadge
                    role={selectedUserProfile.role}
                    isSchoolLover={selectedUserProfile.isSchoolLover}
                    isPro={selectedUserProfile.isPro}
                  />
                </div>


                <div className="w-full grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                    <BrainCircuit className="w-6 h-6 text-blue-500 mb-2" />
                    <span className="  font-medium text-3xl font-black font-mono text-zinc-900 dark:text-white">
                      {selectedUserProfile.level ||
                        getLevelInfo(selectedUserProfile.points || 0)
                          .currentLevel}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1">
                      Level
                    </span>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                    <Target className="w-6 h-6 text-zinc-900 dark:text-zinc-100 mb-2" />
                    <span className="  font-medium text-3xl font-black font-mono text-zinc-900 dark:text-white">
                      {selectedUserProfile.points || 0}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1">
                      Weekly Points
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <InteractiveTutorial
          isOpen={showTutorial}
          onClose={() => {
            localStorage.setItem("hasRunTutorial", "true");
            setShowTutorial(false);
          }}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </Suspense>




      {editingDeckData && (
        <Suspense fallback={null}>
          <EditDeckModal
            isOpen={!!editingDeckData}
            onClose={() => setEditingDeckData(null)}
            deckId={editingDeckData.id}
            initialTitle={editingDeckData.title}
            initialSubject={editingDeckData.subject}
            onSaveSuccess={() => {
              setForceRender((prev) => prev + 1);
            }}
          />
        </Suspense>
      )}
      <VibeStudyEntryModal
        isOpen={!!studyEntryDeck}
        onClose={() => setStudyEntryDeck(null)}
        deck={studyEntryDeck as Deck}
      />

      <AnimatePresence>
        {isNotebookOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsNotebookOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 font-display">Sổ Tay Cá Nhân</h3>
                    <p className="text-xs text-zinc-500 font-medium">Bộ sưu tập mẫu câu của bạn</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNotebookOpen(false)}
                  className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2 custom-scrollbar">
                {notebookItems.length > 0 ? (
                  notebookItems.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800/80 group">
                      <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{item}</p>
                      <div className="mt-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            const newItems = notebookItems.filter((_, i) => i !== idx);
                            setNotebookItems(newItems);
                            localStorage.setItem("vibe_collected_ideas", JSON.stringify(newItems));
                          }}
                          className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Xóa
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-50 font-bold border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
                    <BookOpen className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                    Sổ tay của bạn hiện đang trống.<br/><span className="text-xs font-normal">Bấm nút "Gom nhặt" khi đang học thẻ để lưu ý tưởng vào đây nhé!</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => {
                    if(confirm("Bạn có chắc chắn muốn xóa toàn bộ sổ tay? Dữ liệu không thể khôi phục.")) {
                      setNotebookItems([]);
                      localStorage.setItem("vibe_collected_ideas", "[]");
                    }
                  }}
                  disabled={notebookItems.length === 0}
                  className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl font-bold text-sm transition disabled:opacity-50 cursor-pointer"
                >
                  Xóa tất cả
                </button>
                <button
                  onClick={() => {
                     const textToCopy = notebookItems.join("\n\n");
                     navigator.clipboard.writeText(textToCopy).then(() => {
                       toast.success(`Đã copy ${notebookItems.length} ý tưởng vào bộ nhớ đệm!`);
                     });
                  }}
                  disabled={notebookItems.length === 0}
                  className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  <Copy className="w-4 h-4" /> Copy Toàn Bộ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
